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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userId = user.id;
    const now = new Date();

    const [txRes, catRes, budgetRes, goalsRes] = await Promise.all([
      supabase.from("transactions").select("amount, type, status, date, category_id").eq("user_id", userId).eq("status", "paid").order("date", { ascending: false }).limit(500),
      supabase.from("categories").select("id, name, type").eq("user_id", userId),
      supabase.from("budgets").select("*").eq("user_id", userId).eq("month", now.getMonth() + 1).eq("year", now.getFullYear()),
      supabase.from("goals").select("name, target_amount, current_amount, deadline").eq("user_id", userId),
    ]);

    const transactions = txRes.data || [];
    const categories = catRes.data || [];
    const existingBudgets = budgetRes.data || [];
    const goals = goalsRes.data || [];
    const catMap = new Map(categories.map((c: any) => [c.id, c.name]));

    // Calculate average spending per category over last 3 months
    const catMonthly = new Map<string, number[]>();
    for (let i = 0; i < 3; i++) {
      const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const mStart = m.toISOString().split("T")[0];
      const mEndStr = mEnd.toISOString().split("T")[0];

      const mTx = transactions.filter((t: any) => t.date >= mStart && t.date <= mEndStr && t.type === "expense");
      const catTotals = new Map<string, number>();
      mTx.forEach((t: any) => {
        const catId = t.category_id || "none";
        catTotals.set(catId, (catTotals.get(catId) || 0) + Number(t.amount));
      });

      catTotals.forEach((total, catId) => {
        if (!catMonthly.has(catId)) catMonthly.set(catId, []);
        catMonthly.get(catId)!.push(total);
      });
    }

    // Build spending summary for AI
    const spendingSummary: any[] = [];
    catMonthly.forEach((amounts, catId) => {
      const avg = amounts.reduce((a, b) => a + b, 0) / Math.max(amounts.length, 1);
      const catName = catMap.get(catId) || "Sem categoria";
      const hasExisting = existingBudgets.some((b: any) => b.category_id === catId);
      spendingSummary.push({ catId, catName, avg: Math.round(avg), months: amounts.length, hasExisting });
    });

    // Monthly income
    const monthlyIncomes: number[] = [];
    for (let i = 0; i < 3; i++) {
      const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const inc = transactions
        .filter((t: any) => t.date >= m.toISOString().split("T")[0] && t.date <= mEnd.toISOString().split("T")[0] && t.type === "income")
        .reduce((s: number, t: any) => s + Number(t.amount), 0);
      monthlyIncomes.push(inc);
    }
    const avgIncome = monthlyIncomes.reduce((a, b) => a + b, 0) / Math.max(monthlyIncomes.length, 1);

    // Use AI to suggest optimal budgets
    const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
    let suggestions: any[] = [];

    if (DEEPSEEK_API_KEY && spendingSummary.length > 0) {
      try {
        const prompt = `Você é um planejador financeiro. Com base nos dados abaixo, sugira orçamentos mensais ideais para cada categoria.

Renda média mensal: R$ ${avgIncome.toFixed(0)}
${goals.length > 0 ? `Metas: ${goals.map((g: any) => `${g.name} (faltam R$ ${(Number(g.target_amount) - Number(g.current_amount)).toFixed(0)})`).join(", ")}` : ""}

Gastos médios por categoria (últimos 3 meses):
${spendingSummary.map((s: any) => `- ${s.catName}: R$ ${s.avg}/mês`).join("\n")}

Responda APENAS com um JSON array no formato:
[{"catName": "nome", "catId": "id", "currentAvg": numero, "suggestedBudget": numero, "reason": "motivo curto"}]

Regras:
- Sugira valores realistas, idealmente 5-15% menor que a média para categorias não essenciais
- Mantenha ou aumente para categorias essenciais
- Considere as metas do usuário
- Inclua TODAS as categorias listadas`;

        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [{ role: "user", content: prompt }],
            tools: [{
              type: "function",
              function: {
                name: "suggest_budgets",
                description: "Return budget suggestions for each category",
                parameters: {
                  type: "object",
                  properties: {
                    suggestions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          catName: { type: "string" },
                          catId: { type: "string" },
                          currentAvg: { type: "number" },
                          suggestedBudget: { type: "number" },
                          reason: { type: "string" },
                        },
                        required: ["catName", "catId", "currentAvg", "suggestedBudget", "reason"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["suggestions"],
                  additionalProperties: false,
                },
              },
            }],
            tool_choice: { type: "function", function: { name: "suggest_budgets" } },
          }),
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall?.function?.arguments) {
            const parsed = JSON.parse(toolCall.function.arguments);
            suggestions = parsed.suggestions || [];
          }
        }
      } catch (e) {
        console.error("AI budget suggestion error:", e);
      }
    }

    // Fallback: if AI didn't return suggestions, use calculated ones
    if (suggestions.length === 0) {
      suggestions = spendingSummary.map((s: any) => ({
        catName: s.catName,
        catId: s.catId,
        currentAvg: s.avg,
        suggestedBudget: Math.round(s.avg * 0.9),
        reason: "Redução de 10% sobre a média",
      }));
    }

    return new Response(JSON.stringify({
      suggestions,
      avgIncome: Math.round(avgIncome),
      existingBudgetsCount: existingBudgets.length,
      totalSuggestedExpense: suggestions.reduce((s: number, sg: any) => s + sg.suggestedBudget, 0),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-budget-suggest error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
