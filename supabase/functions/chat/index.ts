import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
    if (!DEEPSEEK_API_KEY) throw new Error("DEEPSEEK_API_KEY is not configured");

    const authHeader = req.headers.get("Authorization");
    let financialContext = "";

    if (authHeader) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } }
        );

        const chatToken = authHeader.replace("Bearer ", "");
        const { data: chatClaims } = await supabase.auth.getClaims(chatToken);
        if (chatClaims?.claims) {
          const userId = chatClaims.claims.sub as string;
          const now = new Date();
          const currentMonth = now.getMonth();
          const currentYear = now.getFullYear();
          const firstDayOfMonth = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`;
          const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).toISOString().split("T")[0];

          const [txRes, accountsRes, goalsRes, budgetsRes, categoriesRes, recurringRes] = await Promise.all([
            supabase.from("transactions").select("*").eq("user_id", userId).order("date", { ascending: false }).limit(200),
            supabase.from("accounts").select("*").eq("user_id", userId),
            supabase.from("goals").select("*").eq("user_id", userId),
            supabase.from("budgets").select("*").eq("user_id", userId).eq("month", currentMonth + 1).eq("year", currentYear),
            supabase.from("categories").select("*").eq("user_id", userId),
            supabase.from("recurring_transactions").select("*").eq("user_id", userId).eq("active", true),
          ]);

          const transactions = txRes.data || [];
          const accounts = accountsRes.data || [];
          const goals = goalsRes.data || [];
          const budgets = budgetsRes.data || [];
          const categories = categoriesRes.data || [];
          const recurring = recurringRes.data || [];

          const catMap: Record<string, string> = {};
          categories.forEach((c: any) => { catMap[c.id] = c.name; });

          const monthTx = transactions.filter((t: any) => t.date >= firstDayOfMonth && t.date <= lastDayOfMonth);
          const monthIncome = monthTx.filter((t: any) => t.type === "income" && t.status === "paid").reduce((s: number, t: any) => s + Number(t.amount), 0);
          const monthExpense = monthTx.filter((t: any) => t.type === "expense" && t.status === "paid").reduce((s: number, t: any) => s + Number(t.amount), 0);
          const monthPending = monthTx.filter((t: any) => t.status === "pending").reduce((s: number, t: any) => s + Number(t.amount), 0);

          const catSpending: Record<string, number> = {};
          monthTx.filter((t: any) => t.type === "expense" && t.status === "paid").forEach((t: any) => {
            const catName = t.category_id ? (catMap[t.category_id] || "Sem categoria") : "Sem categoria";
            catSpending[catName] = (catSpending[catName] || 0) + Number(t.amount);
          });

          const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
          const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
          const firstDayPrev = `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-01`;
          const lastDayPrev = new Date(prevYear, prevMonth + 1, 0).toISOString().split("T")[0];
          const prevMonthTx = transactions.filter((t: any) => t.date >= firstDayPrev && t.date <= lastDayPrev);
          const prevMonthExpense = prevMonthTx.filter((t: any) => t.type === "expense" && t.status === "paid").reduce((s: number, t: any) => s + Number(t.amount), 0);
          const prevMonthIncome = prevMonthTx.filter((t: any) => t.type === "income" && t.status === "paid").reduce((s: number, t: any) => s + Number(t.amount), 0);

          const totalBalance = accounts.reduce((s: number, a: any) => s + Number(a.balance), 0);
          const accountsSummary = accounts.map((a: any) => `${a.name} (${a.type}): R$ ${Number(a.balance).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`).join("\n");
          const goalsSummary = goals.map((g: any) => {
            const pct = Math.round((Number(g.current_amount) / Number(g.target_amount)) * 100);
            return `${g.name}: R$ ${Number(g.current_amount).toLocaleString("pt-BR")} / R$ ${Number(g.target_amount).toLocaleString("pt-BR")} (${pct}%)${g.deadline ? ` - prazo: ${g.deadline}` : ""}`;
          }).join("\n");
          const budgetSummary = budgets.map((b: any) => {
            const catName = b.category_id ? (catMap[b.category_id] || "Categoria") : "Geral";
            const spent = catSpending[catName] || 0;
            const pct = Math.round((spent / Number(b.amount)) * 100);
            return `${catName}: gasto R$ ${spent.toLocaleString("pt-BR")} de R$ ${Number(b.amount).toLocaleString("pt-BR")} (${pct}%)`;
          }).join("\n");
          const recurringSummary = recurring.map((r: any) => 
            `${r.description}: R$ ${Number(r.amount).toLocaleString("pt-BR")} (${r.type === "income" ? "receita" : "despesa"}, dia ${r.day_of_month})`
          ).join("\n");
          const recentTx = transactions.slice(0, 15).map((t: any) => {
            const catName = t.category_id ? (catMap[t.category_id] || "") : "";
            return `${t.date} | ${t.type === "income" ? "+" : "-"}R$ ${Number(t.amount).toLocaleString("pt-BR")} | ${t.description}${catName ? ` [${catName}]` : ""} | ${t.status}`;
          }).join("\n");
          const sortedCats = Object.entries(catSpending).sort(([, a], [, b]) => (b as number) - (a as number));
          const topCats = sortedCats.slice(0, 8).map(([name, amount]) => 
            `${name}: R$ ${(amount as number).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
          ).join("\n");
          const categoryList = categories.map((c: any) => `${c.name} (${c.type})`).join(", ");

          financialContext = `
=== DADOS FINANCEIROS DO USUÁRIO (${now.toLocaleDateString("pt-BR")}) ===

📊 RESUMO DO MÊS ATUAL (${now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}):
- Receitas: R$ ${monthIncome.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
- Despesas: R$ ${monthExpense.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
- Economia: R$ ${(monthIncome - monthExpense).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
- Pendentes: R$ ${monthPending.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}

📊 MÊS ANTERIOR:
- Receitas: R$ ${prevMonthIncome.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
- Despesas: R$ ${prevMonthExpense.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}

💰 SALDO TOTAL: R$ ${totalBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}

🏦 CONTAS:
${accountsSummary || "Nenhuma conta cadastrada"}

🏷️ GASTOS POR CATEGORIA (mês atual):
${topCats || "Nenhum gasto registrado"}

📋 CATEGORIAS DISPONÍVEIS:
${categoryList || "Nenhuma categoria cadastrada"}

${budgets.length > 0 ? `📐 ORÇAMENTOS DO MÊS:\n${budgetSummary}` : ""}

${goals.length > 0 ? `🎯 METAS:\n${goalsSummary}` : ""}

${recurring.length > 0 ? `🔄 RECORRENTES:\n${recurringSummary}` : ""}

📝 TRANSAÇÕES RECENTES:
${recentTx || "Nenhuma transação"}

=== FIM DOS DADOS ===`;
        }
      } catch (e) {
        console.error("Error fetching financial data:", e);
      }
    }

    const systemPrompt = `Você é o assistente financeiro inteligente do T2-SimplyFin. Responda sempre em português brasileiro.

Você tem acesso aos DADOS FINANCEIROS REAIS do usuário abaixo. Use esses dados para responder perguntas específicas sobre as finanças dele.

${financialContext}

INSTRUÇÕES IMPORTANTES:
- Quando o usuário perguntar sobre gastos, receitas, saldos, metas, etc., USE OS DADOS REAIS acima.
- Sempre cite valores exatos quando disponíveis.
- Se o usuário perguntar sobre uma categoria específica, procure nos dados por categoria.
- Compare com o mês anterior quando relevante.
- Dê dicas personalizadas baseadas nos dados reais do usuário.
- Seja conciso, direto e use formatação markdown quando útil.
- Use emojis com moderação para tornar as respostas mais amigáveis.
- Se não tiver dados suficientes para responder, informe ao usuário e dê dicas gerais.
- Quando o usuário perguntar "quanto gastei com X", procure nos gastos por categoria e nas transações recentes.
- Calcule percentuais e comparativos quando fizer sentido.`;

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
