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
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const firstDay = `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`;
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const dayOfMonth = now.getDate();
    const daysLeft = daysInMonth - dayOfMonth;

    // Fetch all needed data in parallel
    const [txRes, budgetsRes, categoriesRes, recurringRes] = await Promise.all([
      supabase.from("transactions")
        .select("*")
        .eq("user_id", userId)
        .gte("date", firstDay)
        .eq("type", "expense"),
      supabase.from("budgets")
        .select("*, categories(name, color, icon)")
        .eq("user_id", userId)
        .eq("month", currentMonth)
        .eq("year", currentYear),
      supabase.from("categories").select("*").eq("user_id", userId),
      supabase.from("recurring_transactions")
        .select("*")
        .eq("user_id", userId)
        .eq("active", true)
        .eq("type", "expense"),
    ]);

    const expenses = txRes.data || [];
    const budgets = budgetsRes.data || [];
    const categories = categoriesRes.data || [];
    const recurring = recurringRes.data || [];

    const catMap: Record<string, any> = {};
    categories.forEach((c: any) => { catMap[c.id] = c; });

    // Calculate spending per category so far this month
    const catSpending: Record<string, number> = {};
    expenses.forEach((t: any) => {
      if (t.status === "paid") {
        const key = t.category_id || "none";
        catSpending[key] = (catSpending[key] || 0) + Number(t.amount);
      }
    });

    // Calculate daily spending rate
    const totalSpentSoFar = Object.values(catSpending).reduce((a, b) => a + b, 0);
    const dailyRate = dayOfMonth > 0 ? totalSpentSoFar / dayOfMonth : 0;
    const projectedTotal = totalSpentSoFar + (dailyRate * daysLeft);

    // Calculate upcoming recurring expenses this month
    const upcomingRecurring = recurring.filter((r: any) => r.day_of_month > dayOfMonth);
    const upcomingRecurringTotal = upcomingRecurring.reduce((s: number, r: any) => s + Number(r.amount), 0);

    // Build predictions per budget
    const predictions: any[] = [];

    for (const budget of budgets) {
      const catId = budget.category_id || "none";
      const spent = catSpending[catId] || 0;
      const budgetAmount = Number(budget.amount);
      const remaining = budgetAmount - spent;
      const catDailyRate = dayOfMonth > 0 ? spent / dayOfMonth : 0;
      const projectedCatTotal = spent + (catDailyRate * daysLeft);
      const projectedOverrun = projectedCatTotal - budgetAmount;
      const daysUntilOverrun = catDailyRate > 0 && remaining > 0
        ? Math.floor(remaining / catDailyRate)
        : null;

      const catName = budget.category_id
        ? (catMap[budget.category_id]?.name || "Categoria")
        : "Geral";
      const catColor = budget.category_id
        ? (catMap[budget.category_id]?.color || "#6366f1")
        : "#6366f1";

      const pctSpent = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;
      const pctProjected = budgetAmount > 0 ? (projectedCatTotal / budgetAmount) * 100 : 0;

      // Only include if there's meaningful budget usage or risk
      if (pctSpent > 5 || pctProjected > 60) {
        predictions.push({
          categoryId: catId,
          categoryName: catName,
          categoryColor: catColor,
          budget: budgetAmount,
          spent,
          remaining: Math.max(0, remaining),
          pctSpent: Math.round(pctSpent),
          projectedTotal: Math.round(projectedCatTotal),
          projectedOverrun: Math.round(projectedOverrun),
          pctProjected: Math.round(pctProjected),
          daysUntilOverrun,
          dailyAllowance: daysLeft > 0 ? Math.max(0, remaining / daysLeft) : 0,
          risk: projectedOverrun > 0 ? "high" : pctProjected > 80 ? "medium" : "low",
        });
      }
    }

    // Sort by risk level
    const riskOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    predictions.sort((a, b) => riskOrder[a.risk] - riskOrder[b.risk]);

    // Build context for AI analysis
    const highRisk = predictions.filter((p) => p.risk === "high");
    const mediumRisk = predictions.filter((p) => p.risk === "medium");

    let aiSuggestions: string[] = [];

    if (predictions.length > 0) {
      const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");

      if (GROQ_API_KEY) {
        const context = predictions.map((p) =>
          `${p.categoryName}: gasto R$${p.spent.toFixed(2)} de R$${p.budget.toFixed(2)} (${p.pctSpent}%), projeção ${p.pctProjected}% ao final do mês${p.projectedOverrun > 0 ? `, estouro previsto de R$${p.projectedOverrun.toFixed(2)}` : ""}`
        ).join("\n");

        const prompt = `Analise estas projeções de orçamento e dê conselhos curtos e práticos (máximo 3 frases em português):
${context}

Responda APENAS com a análise, sem saudações. Foque em ações concretas para evitar o estouro.`;

        try {
          const aiRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${GROQ_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "llama-3.3-70b-versatile",
              messages: [
                { role: "system", content: "Você é um consultor financeiro conciso. Responda sempre em português brasileiro com bullet points curtos e práticos." },
                { role: "user", content: prompt },
              ],
              tools: [
                {
                  type: "function",
                  function: {
                    name: "return_suggestions",
                    description: "Retorna sugestões financeiras práticas",
                    parameters: {
                      type: "object",
                      properties: {
                        suggestions: {
                          type: "array",
                          items: { type: "string" },
                          description: "Lista de 3 sugestões práticas e específicas",
                        },
                      },
                      required: ["suggestions"],
                    },
                  },
                },
              ],
              tool_choice: { type: "function", function: { name: "return_suggestions" } },
            }),
          });

          if (aiRes.ok) {
            const aiData = await aiRes.json();
            const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
            if (toolCall) {
              const parsed = JSON.parse(toolCall.function.arguments);
              aiSuggestions = parsed.suggestions || [];
            }
          }
        } catch (aiErr) {
          console.error("AI error:", aiErr);
        }
      }
    }

    return new Response(
      JSON.stringify({
        predictions,
        summary: {
          totalSpentSoFar,
          projectedTotal,
          dailyRate,
          daysLeft,
          dayOfMonth,
          daysInMonth,
          upcomingRecurringTotal,
          highRiskCount: highRisk.length,
          mediumRiskCount: mediumRisk.length,
        },
        aiSuggestions,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("predictive-alerts error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
