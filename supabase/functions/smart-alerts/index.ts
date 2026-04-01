import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader! } } }
    );

    const token = (authHeader || "").replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userId = claimsData.claims.sub as string;
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const firstDay = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(currentYear, currentMonth + 1, 0).toISOString().split("T")[0];
    const today = now.toISOString().split("T")[0];

    const [txRes, budgetsRes, goalsRes, rulesRes, categoriesRes] = await Promise.all([
      supabase.from("transactions").select("*").eq("user_id", userId),
      supabase.from("budgets").select("*").eq("user_id", userId).eq("month", currentMonth + 1).eq("year", currentYear),
      supabase.from("goals").select("*").eq("user_id", userId),
      supabase.from("financial_rules").select("*").eq("user_id", userId).eq("active", true),
      supabase.from("categories").select("*").eq("user_id", userId),
    ]);

    const transactions = txRes.data || [];
    const budgets = budgetsRes.data || [];
    const goals = goalsRes.data || [];
    const rules = rulesRes.data || [];
    const categories = categoriesRes.data || [];
    const catMap: Record<string, string> = {};
    categories.forEach((c: any) => { catMap[c.id] = c.name; });

    const monthTx = transactions.filter((t: any) => t.date >= firstDay && t.date <= lastDay);
    const monthExpensesPaid = monthTx.filter((t: any) => t.type === "expense" && t.status === "paid");
    const monthIncome = monthTx.filter((t: any) => t.type === "income" && t.status === "paid").reduce((s: number, t: any) => s + Number(t.amount), 0);
    const monthExpense = monthExpensesPaid.reduce((s: number, t: any) => s + Number(t.amount), 0);

    const alerts: { type: string; severity: "info" | "warning" | "danger" | "success"; title: string; message: string; icon: string }[] = [];

    // 1. Budget alerts
    const catSpending: Record<string, number> = {};
    monthExpensesPaid.forEach((t: any) => {
      const key = t.category_id || "none";
      catSpending[key] = (catSpending[key] || 0) + Number(t.amount);
    });

    for (const b of budgets) {
      const spent = catSpending[b.category_id || "none"] || 0;
      const pct = Number(b.amount) > 0 ? (spent / Number(b.amount)) * 100 : 0;
      const catName = b.category_id ? (catMap[b.category_id] || "Categoria") : "Geral";

      if (pct >= 100) {
        alerts.push({ type: "budget_exceeded", severity: "danger", title: `Orçamento estourado: ${catName}`, message: `Você gastou R$ ${spent.toLocaleString("pt-BR")} de R$ ${Number(b.amount).toLocaleString("pt-BR")} (${Math.round(pct)}%).`, icon: "🚨" });
      } else if (pct >= 80) {
        alerts.push({ type: "budget_warning", severity: "warning", title: `Orçamento quase no limite: ${catName}`, message: `Já usou ${Math.round(pct)}% do orçamento. Restam R$ ${(Number(b.amount) - spent).toLocaleString("pt-BR")}.`, icon: "⚠️" });
      }
    }

    // 2. Boleto-specific due date alerts
    const pendingExpenses = transactions.filter((t: any) => t.type === "expense" && t.status === "pending");
    const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
    const in3days = new Date(now); in3days.setDate(in3days.getDate() + 3);
    const in7days = new Date(now); in7days.setDate(in7days.getDate() + 7);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];
    const in3daysStr = in3days.toISOString().split("T")[0];
    const in7daysStr = in7days.toISOString().split("T")[0];

    // Boletos vencendo
    const boletosAll = pendingExpenses.filter((t: any) => t.boleto_url);
    const boletosToday = boletosAll.filter((t: any) => t.date === today);
    const boletosTomorrow = boletosAll.filter((t: any) => t.date === tomorrowStr);
    const boletosSoon = boletosAll.filter((t: any) => t.date > tomorrowStr && t.date <= in3daysStr);
    const boletosWeek = boletosAll.filter((t: any) => t.date > in3daysStr && t.date <= in7daysStr);
    const boletosOverdue = boletosAll.filter((t: any) => t.date < today);

    if (boletosOverdue.length > 0) {
      const total = boletosOverdue.reduce((s: number, t: any) => s + Number(t.amount), 0);
      const names = boletosOverdue.map((t: any) => t.description).slice(0, 3).join(", ");
      alerts.push({ type: "boleto_overdue", severity: "danger", title: `${boletosOverdue.length} boleto(s) vencido(s)!`, message: `Total: R$ ${total.toLocaleString("pt-BR")}. ${names}${boletosOverdue.length > 3 ? "..." : ""}. Pague para evitar juros!`, icon: "🚨" });
    }
    if (boletosToday.length > 0) {
      const total = boletosToday.reduce((s: number, t: any) => s + Number(t.amount), 0);
      const names = boletosToday.map((t: any) => t.description).slice(0, 3).join(", ");
      alerts.push({ type: "boleto_today", severity: "danger", title: `${boletosToday.length} boleto(s) vencem HOJE`, message: `Total: R$ ${total.toLocaleString("pt-BR")}. ${names}. Pague antes do fim do dia!`, icon: "📄" });
    }
    if (boletosTomorrow.length > 0) {
      const total = boletosTomorrow.reduce((s: number, t: any) => s + Number(t.amount), 0);
      alerts.push({ type: "boleto_tomorrow", severity: "warning", title: `${boletosTomorrow.length} boleto(s) vencem amanhã`, message: `Total: R$ ${total.toLocaleString("pt-BR")}. Prepare o pagamento!`, icon: "📋" });
    }
    if (boletosSoon.length > 0) {
      const total = boletosSoon.reduce((s: number, t: any) => s + Number(t.amount), 0);
      alerts.push({ type: "boleto_soon", severity: "info", title: `${boletosSoon.length} boleto(s) nos próximos 3 dias`, message: `Total: R$ ${total.toLocaleString("pt-BR")}. Planeje-se!`, icon: "📅" });
    }
    if (boletosWeek.length > 0) {
      const total = boletosWeek.reduce((s: number, t: any) => s + Number(t.amount), 0);
      alerts.push({ type: "boleto_week", severity: "info", title: `${boletosWeek.length} boleto(s) na próxima semana`, message: `Total: R$ ${total.toLocaleString("pt-BR")}.`, icon: "🗓️" });
    }

    // General pending (non-boleto) due dates
    const nonBoleto = pendingExpenses.filter((t: any) => !t.boleto_url);
    const dueToday = nonBoleto.filter((t: any) => t.date === today);
    const dueTomorrow = nonBoleto.filter((t: any) => t.date === tomorrowStr);

    if (dueToday.length > 0) {
      const total = dueToday.reduce((s: number, t: any) => s + Number(t.amount), 0);
      alerts.push({ type: "due_today", severity: "danger", title: `${dueToday.length} conta(s) vencem hoje`, message: `Total: R$ ${total.toLocaleString("pt-BR")}. Não esqueça de pagar!`, icon: "🔴" });
    }
    if (dueTomorrow.length > 0) {
      const total = dueTomorrow.reduce((s: number, t: any) => s + Number(t.amount), 0);
      alerts.push({ type: "due_tomorrow", severity: "warning", title: `${dueTomorrow.length} conta(s) vencem amanhã`, message: `Total: R$ ${total.toLocaleString("pt-BR")}`, icon: "🟡" });
    }

    // 3. Overdue (non-boleto)
    const overdue = nonBoleto.filter((t: any) => t.date < today);
    if (overdue.length > 0) {
      const total = overdue.reduce((s: number, t: any) => s + Number(t.amount), 0);
      alerts.push({ type: "overdue", severity: "danger", title: `${overdue.length} conta(s) em atraso`, message: `Total em atraso: R$ ${total.toLocaleString("pt-BR")}. Regularize para manter seu score!`, icon: "🚫" });
    }

    // 4. Goal progress milestones
    for (const g of goals) {
      const pct = Number(g.target_amount) > 0 ? (Number(g.current_amount) / Number(g.target_amount)) * 100 : 0;
      if (pct >= 100) {
        alerts.push({ type: "goal_complete", severity: "success", title: `Meta atingida: ${g.name}! 🎉`, message: `Parabéns! Você alcançou R$ ${Number(g.target_amount).toLocaleString("pt-BR")}.`, icon: "🏆" });
      } else if (pct >= 75) {
        alerts.push({ type: "goal_close", severity: "info", title: `Quase lá: ${g.name}`, message: `${Math.round(pct)}% concluído. Faltam R$ ${(Number(g.target_amount) - Number(g.current_amount)).toLocaleString("pt-BR")}.`, icon: "🎯" });
      }
    }

    // 5. Savings rate
    if (monthIncome > 0) {
      const rate = ((monthIncome - monthExpense) / monthIncome) * 100;
      if (rate < 0) {
        alerts.push({ type: "negative_savings", severity: "danger", title: "Gastos acima da renda!", message: `Você gastou R$ ${Math.abs(monthIncome - monthExpense).toLocaleString("pt-BR")} a mais do que recebeu.`, icon: "📉" });
      } else if (rate >= 30) {
        alerts.push({ type: "great_savings", severity: "success", title: "Excelente economia!", message: `Você está economizando ${Math.round(rate)}% da renda. Continue assim!`, icon: "🌟" });
      }
    }

    // 6. Custom rules
    for (const rule of rules) {
      let triggered = false;
      if (rule.condition_type === "category_spending") {
        const spent = catSpending[rule.condition_category_id] || 0;
        if (spent > Number(rule.condition_amount)) triggered = true;
      } else if (rule.condition_type === "total_spending") {
        if (monthExpense > Number(rule.condition_amount)) triggered = true;
      }

      if (triggered) {
        const catName = rule.condition_category_id ? (catMap[rule.condition_category_id] || "") : "";
        alerts.push({
          type: "custom_rule",
          severity: "warning",
          title: rule.name,
          message: rule.action_message || `Regra ativada${catName ? ` para ${catName}` : ""}: gasto ultrapassou R$ ${Number(rule.condition_amount).toLocaleString("pt-BR")}`,
          icon: "⚡",
        });
      }
    }

    // Daily budget
    const daysLeft = new Date(currentYear, currentMonth + 1, 0).getDate() - now.getDate() + 1;
    const remainingBudget = monthIncome - monthExpense;
    const dailyBudget = daysLeft > 0 ? remainingBudget / daysLeft : 0;

    const sortedAlerts = alerts.sort((a, b) => {
      const order: Record<string, number> = { danger: 0, warning: 1, info: 2, success: 3 };
      return order[a.severity] - order[b.severity];
    });

    // Save boleto alerts as persistent insights
    const boletoAlerts = sortedAlerts.filter(a => a.type.startsWith("boleto_"));
    if (boletoAlerts.length > 0) {
      const insightsToSave = boletoAlerts.map(a => ({
        user_id: userId,
        type: a.type,
        title: `${a.icon} ${a.title}`,
        description: a.message,
      }));
      // Avoid duplicates: check today's existing insights
      const { data: existingInsights } = await supabase
        .from("ai_insights")
        .select("title")
        .eq("user_id", userId)
        .gte("created_at", today + "T00:00:00");
      const existingTitles = new Set((existingInsights || []).map((i: any) => i.title));
      const newInsights = insightsToSave.filter(i => !existingTitles.has(i.title));
      if (newInsights.length > 0) {
        await supabase.from("ai_insights").insert(newInsights);
      }
    }

    // Send alerts to Telegram if configured
    const { data: profile } = await supabase
      .from("profiles")
      .select("telegram_bot_token, telegram_chat_id")
      .eq("user_id", userId)
      .single();

    if (profile?.telegram_bot_token && profile?.telegram_chat_id && sortedAlerts.length > 0) {
      const dangerAndWarning = sortedAlerts.filter(a => a.severity === "danger" || a.severity === "warning");
      if (dangerAndWarning.length > 0) {
        // Separate boleto alerts in Telegram message
        const boletoTg = dangerAndWarning.filter(a => a.type.startsWith("boleto_"));
        const otherTg = dangerAndWarning.filter(a => !a.type.startsWith("boleto_"));

        let text = `🔔 *T2-SimplyFin — Alertas*\n`;

        if (boletoTg.length > 0) {
          text += `\n📄 *BOLETOS:*\n`;
          text += boletoTg.map(a => `${a.icon} *${a.title}*\n${a.message}`).join("\n\n");
        }
        if (otherTg.length > 0) {
          text += `\n\n💳 *CONTAS:*\n`;
          text += otherTg.map(a => `${a.icon} *${a.title}*\n${a.message}`).join("\n\n");
        }

        const budgetLine = dailyBudget > 0 ? `\n\n💰 Orçamento diário: R$ ${dailyBudget.toFixed(2)} (${daysLeft} dias restantes)` : "";
        text += `${budgetLine}\n\n_Acesse o app para mais detalhes._`;

        try {
          await fetch(`https://api.telegram.org/bot${profile.telegram_bot_token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: profile.telegram_chat_id, text, parse_mode: "Markdown" }),
          });
        } catch (tgErr) {
          console.error("Telegram send error:", tgErr);
        }
      }
    }

    return new Response(JSON.stringify({
      alerts: sortedAlerts,
      dailyBudget: Math.max(0, dailyBudget),
      daysLeft,
      monthIncome,
      monthExpense,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("smart-alerts error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
