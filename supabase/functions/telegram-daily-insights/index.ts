import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get all users with Telegram configured
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, telegram_bot_token, telegram_chat_id")
      .not("telegram_bot_token", "is", null)
      .not("telegram_chat_id", "is", null);

    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ message: "No users with Telegram configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;
    for (const p of profiles) {
      try {
        await processUserDailySummary(supabase, DEEPSEEK_API_KEY, p.user_id, p.telegram_bot_token, p.telegram_chat_id);
        processed++;
      } catch (e) {
        console.error(`Error processing user ${p.user_id}:`, e);
      }
    }

    return new Response(JSON.stringify({ users_processed: processed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("telegram-daily-insights error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function processUserDailySummary(
  supabase: any,
  deepseekKey: string,
  userId: string,
  botToken: string,
  chatId: string
) {
  const sendTg = async (text: string, extra: any = {}) => {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown", ...extra }),
    });
  };

  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const firstDay = `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`;
  const lastDay = new Date(currentYear, currentMonth, 0);
  const lastDayStr = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;
  const daysInMonth = lastDay.getDate();
  const dayOfMonth = now.getDate();
  const daysLeft = daysInMonth - dayOfMonth;

  // Previous month for comparison
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
  const prevFirstDay = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;
  const prevLastDay = new Date(prevYear, prevMonth, 0);
  const prevLastDayStr = `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(prevLastDay.getDate()).padStart(2, "0")}`;

  // Fetch all data in parallel
  const [txRes, prevTxRes, budgetRes, goalRes, catRes, accRes, todayTxRes] = await Promise.all([
    supabase.from("transactions").select("*").eq("user_id", userId).gte("date", firstDay).lte("date", lastDayStr),
    supabase.from("transactions").select("*").eq("user_id", userId).gte("date", prevFirstDay).lte("date", prevLastDayStr),
    supabase.from("budgets").select("*").eq("user_id", userId).eq("month", currentMonth).eq("year", currentYear),
    supabase.from("goals").select("*").eq("user_id", userId),
    supabase.from("categories").select("id, name, type").eq("user_id", userId),
    supabase.from("accounts").select("id, name, balance").eq("user_id", userId),
    supabase.from("transactions").select("*").eq("user_id", userId).eq("date", today),
  ]);

  const monthTx = txRes.data || [];
  const prevMonthTx = prevTxRes.data || [];
  const budgets = budgetRes.data || [];
  const goals = goalRes.data || [];
  const categories = catRes.data || [];
  const accounts = accRes.data || [];
  const todayTx = todayTxRes.data || [];
  const catMap = new Map(categories.map((c: any) => [c.id, c.name]));

  // Calculate metrics
  const monthExpenses = monthTx.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + Number(t.amount), 0);
  const monthIncome = monthTx.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + Number(t.amount), 0);
  const prevExpenses = prevMonthTx.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + Number(t.amount), 0);
  const todayExpenses = todayTx.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + Number(t.amount), 0);
  const todayIncome = todayTx.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + Number(t.amount), 0);
  const totalBalance = accounts.reduce((s: number, a: any) => s + Number(a.balance), 0);

  // Spending by category
  const byCat: Record<string, number> = {};
  monthTx.filter((t: any) => t.type === "expense").forEach((t: any) => {
    const name = t.category_id ? (catMap.get(t.category_id) || "Outros") : "Sem categoria";
    byCat[name] = (byCat[name] || 0) + Number(t.amount);
  });
  const topCategories = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Budget status
  const budgetAlerts: string[] = [];
  for (const b of budgets) {
    const budgetAmt = Number(b.amount);
    const catId = b.category_id;
    const spent = catId
      ? monthTx.filter((t: any) => t.type === "expense" && t.category_id === catId).reduce((s: number, t: any) => s + Number(t.amount), 0)
      : monthExpenses;
    const pct = (spent / budgetAmt) * 100;
    const catName = catId ? (catMap.get(catId) || "Categoria") : "Geral";

    if (spent > budgetAmt) {
      budgetAlerts.push(`🚨 ${catName}: *estourou* (${pct.toFixed(0)}%)`);
    } else if (pct >= 80) {
      budgetAlerts.push(`⚠️ ${catName}: ${pct.toFixed(0)}% usado`);
    }

    // Predict end-of-month
    const dailyRate = spent / dayOfMonth;
    const projectedTotal = dailyRate * daysInMonth;
    if (projectedTotal > budgetAmt && pct < 100) {
      budgetAlerts.push(`📊 ${catName}: projeção de R$ ${projectedTotal.toFixed(0)} (orçamento: R$ ${budgetAmt.toFixed(0)})`);
    }
  }

  // Goals at risk
  const goalAlerts: string[] = [];
  for (const g of goals) {
    const target = Number(g.target_amount);
    const current = Number(g.current_amount);
    if (target <= 0) continue;
    const pct = (current / target) * 100;

    if (g.deadline) {
      const deadline = new Date(g.deadline);
      const daysToDeadline = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const remaining = target - current;

      if (daysToDeadline > 0 && daysToDeadline <= 30 && pct < 80) {
        const dailyNeeded = remaining / daysToDeadline;
        goalAlerts.push(`⏰ *${g.name}*: ${pct.toFixed(0)}%, faltam ${daysToDeadline} dias — precisa R$ ${dailyNeeded.toFixed(2)}/dia`);
      } else if (daysToDeadline <= 0 && pct < 100) {
        goalAlerts.push(`❌ *${g.name}*: prazo expirado com ${pct.toFixed(0)}% concluído`);
      }
    }

    if (pct >= 90 && pct < 100) {
      goalAlerts.push(`✨ *${g.name}*: ${pct.toFixed(0)}% — quase lá!`);
    }
  }

  // Spending pattern comparison
  const prevDailyAvg = prevExpenses > 0 ? prevExpenses / prevLastDay.getDate() : 0;
  const currentDailyAvg = dayOfMonth > 0 ? monthExpenses / dayOfMonth : 0;
  const spendingTrend = prevDailyAvg > 0 ? ((currentDailyAvg - prevDailyAvg) / prevDailyAvg) * 100 : 0;

  // Build context for AI analysis
  const aiContext = `
Dados financeiros do usuário para hoje (${now.toLocaleDateString("pt-BR")}):

SALDO TOTAL: R$ ${totalBalance.toFixed(2)}

GASTOS HOJE: R$ ${todayExpenses.toFixed(2)} | Receitas hoje: R$ ${todayIncome.toFixed(2)}

MÊS ATUAL (${currentMonth}/${currentYear}):
- Despesas: R$ ${monthExpenses.toFixed(2)}
- Receitas: R$ ${monthIncome.toFixed(2)}
- Economia: R$ ${(monthIncome - monthExpenses).toFixed(2)}
- Dias restantes: ${daysLeft}
- Média diária de gastos: R$ ${currentDailyAvg.toFixed(2)}

MÊS ANTERIOR:
- Despesas: R$ ${prevExpenses.toFixed(2)}
- Média diária: R$ ${prevDailyAvg.toFixed(2)}
- Tendência: ${spendingTrend > 0 ? `+${spendingTrend.toFixed(0)}%` : `${spendingTrend.toFixed(0)}%`}

TOP CATEGORIAS DE GASTO:
${topCategories.map(([name, val]) => `- ${name}: R$ ${val.toFixed(2)}`).join("\n")}

ALERTAS ORÇAMENTO:
${budgetAlerts.length > 0 ? budgetAlerts.join("\n") : "Nenhum"}

METAS EM RISCO:
${goalAlerts.length > 0 ? goalAlerts.join("\n") : "Nenhuma"}
`;

  // Call DeepSeek for personalized analysis
  let aiAnalysis = "";
  try {
    const aiResp = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${deepseekKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{
          role: "system",
          content: `Você é um consultor financeiro pessoal. Analise os dados e gere um resumo diário inteligente com:
1. Uma frase motivacional sobre finanças
2. Análise do dia (gastos, tendências)
3. Uma dica personalizada de economia baseada nos padrões
4. Alerta se alguma meta está em risco com sugestão de ação
5. Previsão: vai estourar o orçamento? O que fazer?

Seja direto, empático e prático. Use emojis. Máximo 500 caracteres.`
        }, {
          role: "user",
          content: aiContext,
        }],
      }),
    });

    if (aiResp.ok) {
      const aiData = await aiResp.json();
      aiAnalysis = aiData.choices?.[0]?.message?.content || "";
    }
  } catch (e) {
    console.error("AI analysis error:", e);
  }

  // Build message
  const monthName = now.toLocaleDateString("pt-BR", { month: "long" });
  let msg = `🌙 *T2-SimplyFin — Resumo Diário*\n📅 ${now.toLocaleDateString("pt-BR")}\n\n`;

  // Today summary
  msg += `📊 *Hoje:*\n`;
  if (todayTx.length === 0) {
    msg += `  Nenhuma transação registrada\n`;
  } else {
    if (todayExpenses > 0) msg += `  📉 Gastos: R$ ${todayExpenses.toFixed(2)}\n`;
    if (todayIncome > 0) msg += `  📈 Receitas: R$ ${todayIncome.toFixed(2)}\n`;
  }

  // Month summary
  msg += `\n💰 *${monthName.charAt(0).toUpperCase() + monthName.slice(1)}:*\n`;
  msg += `  Receitas: R$ ${monthIncome.toFixed(2)}\n`;
  msg += `  Despesas: R$ ${monthExpenses.toFixed(2)}\n`;
  msg += `  Saldo: R$ ${(monthIncome - monthExpenses).toFixed(2)}\n`;

  // Spending trend
  if (spendingTrend !== 0 && prevDailyAvg > 0) {
    const trendIcon = spendingTrend > 0 ? "📈" : "📉";
    const trendLabel = spendingTrend > 0 ? "acima" : "abaixo";
    msg += `\n${trendIcon} *Tendência:* ${Math.abs(spendingTrend).toFixed(0)}% ${trendLabel} do mês anterior\n`;
  }

  // Budget alerts
  if (budgetAlerts.length > 0) {
    msg += `\n🎯 *Orçamento:*\n${budgetAlerts.join("\n")}\n`;
  }

  // Goal alerts
  if (goalAlerts.length > 0) {
    msg += `\n🏆 *Metas:*\n${goalAlerts.join("\n")}\n`;
  }

  // AI insights
  if (aiAnalysis) {
    msg += `\n🤖 *IA diz:*\n${aiAnalysis}\n`;
  }

  msg += `\n💳 *Saldo total:* R$ ${totalBalance.toFixed(2)}`;
  msg += `\n\n_${daysLeft} dias restantes no mês_`;

  // Add interactive buttons
  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: "📊 Ver extrato", callback_data: "daily_extrato" },
        { text: "🎯 Ver metas", callback_data: "daily_metas" },
      ],
      [
        { text: "💡 Dicas de economia", callback_data: "daily_dicas" },
        { text: "📈 Análise completa", callback_data: "daily_analise" },
      ],
    ],
  };

  await sendTg(msg, { reply_markup: inlineKeyboard });
}
