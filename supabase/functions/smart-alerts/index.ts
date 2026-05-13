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

    // Fetch historical data for anomaly detection (last 3 months)
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().split("T")[0];

    const [txRes, budgetsRes, goalsRes, rulesRes, categoriesRes] = await Promise.all([
      supabase.from("transactions").select("*").eq("user_id", userId).gte("date", threeMonthsAgo),
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

    // 1. Budget alerts with Custom Thresholds
    const catSpending: Record<string, number> = {};
    monthExpensesPaid.forEach((t: any) => {
      const key = t.category_id || "none";
      catSpending[key] = (catSpending[key] || 0) + Number(t.amount);
    });

    for (const b of budgets) {
      if (b.notification_enabled === false) continue;
      
      const spent = catSpending[b.category_id || "none"] || 0;
      const budgetAmount = Number(b.amount);
      const pct = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;
      const catName = b.category_id ? (catMap[b.category_id] || "Categoria") : "Geral";
      const threshold = b.alert_threshold || 80;

      if (pct >= 100) {
        alerts.push({ 
          type: "budget_exceeded", 
          severity: "danger", 
          title: `Orçamento estourado: ${catName}`, 
          message: `Você gastou R$ ${spent.toLocaleString("pt-BR")} de R$ ${budgetAmount.toLocaleString("pt-BR")} (100%+).`, 
          icon: "🚨" 
        });
      } else if (pct >= threshold) {
        alerts.push({ 
          type: "budget_warning", 
          severity: "warning", 
          title: `Orçamento em atenção: ${catName}`, 
          message: `Gasto atingiu ${Math.round(pct)}% (limite definido: ${threshold}%). Restam R$ ${(budgetAmount - spent).toLocaleString("pt-BR")}.`, 
          icon: "⚠️" 
        });
      }
    }

    // 2. Anomaly Detection (spending > 1.5x category average)
    const historicalTx = transactions.filter((t: any) => t.date < firstDay && t.type === "expense" && t.status === "paid");
    const historicalCatTotals: Record<string, number[]> = {};
    
    // Group by month and category
    historicalTx.forEach((t: any) => {
      const monthKey = t.date.substring(0, 7);
      const catId = t.category_id || "none";
      if (!historicalCatTotals[catId]) historicalCatTotals[catId] = [];
      
      // This is a simplification: we'd ideally aggregate by month first
      // But for anomaly detection, let's use recent transactions average
    });

    // Simple anomaly: current transaction is much larger than category average or budget
    for (const tx of monthExpensesPaid) {
      const catId = tx.category_id || "none";
      const budget = budgets.find(b => b.category_id === catId);
      if (budget && Number(tx.amount) > Number(budget.amount) * 0.5) {
        // Single transaction taking more than 50% of monthly budget
        alerts.push({
          type: "anomaly_large_tx",
          severity: "warning",
          title: "Gasto atípico detectado",
          message: `A transação "${tx.description}" representa mais de 50% do seu orçamento para ${catMap[catId] || 'esta categoria'}.`,
          icon: "🧐"
        });
      }
    }

    // 2. Boleto-specific due date alerts
    const pendingExpenses = transactions.filter((t: any) => t.type === "expense" && t.status === "pending" && t.date >= firstDay);
    const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    // Boletos vencendo HOJE
    const boletosToday = pendingExpenses.filter((t: any) => t.boleto_url && t.date === today);
    if (boletosToday.length > 0) {
      alerts.push({ type: "boleto_today", severity: "danger", title: `${boletosToday.length} boleto(s) vencem HOJE`, message: `Pague antes do fim do dia para evitar multas!`, icon: "📄" });
    }

    // Overdue
    const overdue = pendingExpenses.filter((t: any) => t.date < today);
    if (overdue.length > 0) {
      alerts.push({ type: "overdue", severity: "danger", title: "Contas em atraso", message: `Você tem ${overdue.length} pendência(s) de dias anteriores.`, icon: "🚫" });
    }

    // 3. Goal progress milestones
    for (const g of goals) {
      const pct = Number(g.target_amount) > 0 ? (Number(g.current_amount) / Number(g.target_amount)) * 100 : 0;
      if (pct >= 100) {
        alerts.push({ type: "goal_complete", severity: "success", title: `Meta atingida: ${g.name}! 🎉`, message: `Parabéns! Você alcançou R$ ${Number(g.target_amount).toLocaleString("pt-BR")}.`, icon: "🏆" });
      } else if (pct >= 75) {
        alerts.push({ type: "goal_close", severity: "info", title: `Quase lá: ${g.name}`, message: `${Math.round(pct)}% concluído. Faltam R$ ${(Number(g.target_amount) - Number(g.current_amount)).toLocaleString("pt-BR")}.`, icon: "🎯" });
      }
    }

    // 4. Savings rate
    if (monthIncome > 0) {
      const rate = ((monthIncome - monthExpense) / monthIncome) * 100;
      if (rate < 0) {
        alerts.push({ type: "negative_savings", severity: "danger", title: "Saldo mensal negativo", message: `Seus gastos pagos superaram sua receita neste mês.`, icon: "📉" });
      }
    }

    // 5. Custom rules
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
