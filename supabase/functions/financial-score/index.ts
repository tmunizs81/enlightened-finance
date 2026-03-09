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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userId = user.id;
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Fetch all data
    const [txRes, goalsRes, budgetsRes, accountsRes] = await Promise.all([
      supabase.from("transactions").select("*").eq("user_id", userId),
      supabase.from("goals").select("*").eq("user_id", userId),
      supabase.from("budgets").select("*").eq("user_id", userId),
      supabase.from("accounts").select("*").eq("user_id", userId),
    ]);

    const transactions = txRes.data || [];
    const goals = goalsRes.data || [];
    const budgets = budgetsRes.data || [];
    const accounts = accountsRes.data || [];

    // 1. Savings Rate (0-25 points)
    const thisMonthTx = transactions.filter((t: any) => {
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear && t.status === "paid";
    });
    const monthIncome = thisMonthTx.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + Number(t.amount), 0);
    const monthExpense = thisMonthTx.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + Number(t.amount), 0);
    const savingsRate = monthIncome > 0 ? ((monthIncome - monthExpense) / monthIncome) * 100 : 0;
    const savingsScore = Math.min(25, Math.max(0, savingsRate >= 30 ? 25 : savingsRate >= 20 ? 20 : savingsRate >= 10 ? 15 : savingsRate > 0 ? 8 : 0));

    // 2. Goal Progress (0-25 points)
    const goalProgress = goals.length > 0
      ? goals.reduce((s: number, g: any) => s + Math.min(1, Number(g.current_amount) / Number(g.target_amount)), 0) / goals.length
      : 0;
    const goalsScore = Math.round(goalProgress * 25);

    // 3. Budget Discipline (0-25 points)
    let budgetScore = 12; // default if no budgets
    if (budgets.length > 0) {
      const currentBudgets = budgets.filter((b: any) => b.month === currentMonth + 1 && b.year === currentYear);
      if (currentBudgets.length > 0) {
        let withinBudget = 0;
        for (const b of currentBudgets) {
          const catSpent = thisMonthTx
            .filter((t: any) => t.type === "expense" && t.category_id === b.category_id)
            .reduce((s: number, t: any) => s + Number(t.amount), 0);
          if (catSpent <= Number(b.amount)) withinBudget++;
        }
        budgetScore = Math.round((withinBudget / currentBudgets.length) * 25);
      }
    }

    // 4. Financial Health (0-25 points)
    const totalBalance = accounts.reduce((s: number, a: any) => s + Number(a.balance), 0);
    const pendingExpenses = transactions
      .filter((t: any) => t.type === "expense" && t.status === "pending")
      .reduce((s: number, t: any) => s + Number(t.amount), 0);
    const hasEmergencyFund = totalBalance > monthExpense * 3;
    const noPendingOverdue = transactions.filter((t: any) => t.status === "overdue").length === 0;
    let healthScore = 0;
    if (totalBalance > 0) healthScore += 8;
    if (hasEmergencyFund) healthScore += 8;
    if (noPendingOverdue) healthScore += 5;
    if (pendingExpenses < monthIncome * 0.3) healthScore += 4;
    healthScore = Math.min(25, healthScore);

    const totalScore = savingsScore + goalsScore + budgetScore + healthScore;

    // Generate tips
    const tips: string[] = [];
    if (savingsRate < 20) tips.push("💡 Tente economizar pelo menos 20% da sua renda mensal.");
    if (goals.length === 0) tips.push("🎯 Defina metas financeiras para melhorar seu score.");
    if (!hasEmergencyFund) tips.push("🛡️ Construa uma reserva de emergência de 3 meses de gastos.");
    if (!noPendingOverdue) tips.push("⚠️ Regularize suas contas em atraso.");
    if (budgets.length === 0) tips.push("📊 Crie orçamentos por categoria para controlar gastos.");

    const label = totalScore >= 80 ? "Excelente" : totalScore >= 60 ? "Bom" : totalScore >= 40 ? "Regular" : "Atenção";

    return new Response(JSON.stringify({
      score: totalScore,
      label,
      breakdown: {
        savings: { score: savingsScore, max: 25, rate: Math.round(savingsRate) },
        goals: { score: goalsScore, max: 25, progress: Math.round(goalProgress * 100) },
        budget: { score: budgetScore, max: 25 },
        health: { score: healthScore, max: 25 },
      },
      tips,
      monthIncome,
      monthExpense,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("financial-score error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
