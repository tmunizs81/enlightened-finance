import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Achievement definitions
const ACHIEVEMENTS = [
  { key: "first_transaction", title: "Primeiro Passo", desc: "Registre sua primeira transação", icon: "🚀", condition: (d: any) => d.totalTransactions >= 1 },
  { key: "ten_transactions", title: "Organizador", desc: "Registre 10 transações", icon: "📋", condition: (d: any) => d.totalTransactions >= 10 },
  { key: "fifty_transactions", title: "Mestre do Registro", desc: "Registre 50 transações", icon: "📊", condition: (d: any) => d.totalTransactions >= 50 },
  { key: "hundred_transactions", title: "Lendário", desc: "Registre 100 transações", icon: "🏆", condition: (d: any) => d.totalTransactions >= 100 },
  { key: "first_goal", title: "Sonhador", desc: "Crie sua primeira meta", icon: "🎯", condition: (d: any) => d.totalGoals >= 1 },
  { key: "goal_achieved", title: "Conquistador", desc: "Atinja 100% de uma meta", icon: "⭐", condition: (d: any) => d.goalsCompleted >= 1 },
  { key: "three_goals_done", title: "Imparável", desc: "Conclua 3 metas", icon: "🔥", condition: (d: any) => d.goalsCompleted >= 3 },
  { key: "first_budget", title: "Planejador", desc: "Crie seu primeiro orçamento", icon: "📐", condition: (d: any) => d.totalBudgets >= 1 },
  { key: "budget_discipline", title: "Disciplinado", desc: "Fique dentro do orçamento por 1 mês", icon: "🎖️", condition: (d: any) => d.withinBudget },
  { key: "saver_10", title: "Poupador", desc: "Economize 10% da renda em um mês", icon: "🐷", condition: (d: any) => d.savingsRate >= 10 },
  { key: "saver_20", title: "Investidor Nato", desc: "Economize 20% da renda em um mês", icon: "💎", condition: (d: any) => d.savingsRate >= 20 },
  { key: "saver_30", title: "Mestre da Poupança", desc: "Economize 30% da renda em um mês", icon: "👑", condition: (d: any) => d.savingsRate >= 30 },
  { key: "multi_account", title: "Diversificado", desc: "Cadastre 3 contas diferentes", icon: "🏦", condition: (d: any) => d.totalAccounts >= 3 },
  { key: "streak_7", title: "Foco Semanal", desc: "7 dias seguidos sem gastos extras", icon: "🔥", condition: (d: any) => d.bestStreak >= 7 },
  { key: "streak_30", title: "Mês de Ferro", desc: "30 dias seguidos sem gastos extras", icon: "💪", condition: (d: any) => d.bestStreak >= 30 },
  { key: "emergency_fund", title: "Reserva Segura", desc: "Saldo cobre 3 meses de gastos", icon: "🛡️", condition: (d: any) => d.hasEmergencyFund },
  { key: "categorizer", title: "Categorizador", desc: "Crie 5 categorias", icon: "🏷️", condition: (d: any) => d.totalCategories >= 5 },
  { key: "recurring_setup", title: "Automatizador", desc: "Configure 3 recorrentes", icon: "🔄", condition: (d: any) => d.totalRecurring >= 3 },
];

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
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const firstDay = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(currentYear, currentMonth + 1, 0).toISOString().split("T")[0];

    // Fetch all data in parallel
    const [txRes, goalsRes, budgetsRes, accountsRes, categoriesRes, recurringRes, streaksRes, existingAch] = await Promise.all([
      supabase.from("transactions").select("*").eq("user_id", userId),
      supabase.from("goals").select("*").eq("user_id", userId),
      supabase.from("budgets").select("*").eq("user_id", userId).eq("month", currentMonth + 1).eq("year", currentYear),
      supabase.from("accounts").select("*").eq("user_id", userId),
      supabase.from("categories").select("*").eq("user_id", userId),
      supabase.from("recurring_transactions").select("*").eq("user_id", userId).eq("active", true),
      supabase.from("streaks").select("*").eq("user_id", userId).eq("streak_type", "no_unnecessary_spending").maybeSingle(),
      supabase.from("achievements").select("*").eq("user_id", userId),
    ]);

    const transactions = txRes.data || [];
    const goals = goalsRes.data || [];
    const budgets = budgetsRes.data || [];
    const accounts = accountsRes.data || [];
    const categories = categoriesRes.data || [];
    const recurring = recurringRes.data || [];
    const existingAchievements = existingAch.data || [];

    // Calculate metrics
    const monthTx = transactions.filter((t: any) => t.date >= firstDay && t.date <= lastDay && t.status === "paid");
    const monthIncome = monthTx.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + Number(t.amount), 0);
    const monthExpense = monthTx.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + Number(t.amount), 0);
    const savingsRate = monthIncome > 0 ? ((monthIncome - monthExpense) / monthIncome) * 100 : 0;
    const totalBalance = accounts.reduce((s: number, a: any) => s + Number(a.balance), 0);
    const hasEmergencyFund = monthExpense > 0 ? totalBalance >= monthExpense * 3 : totalBalance > 0;

    const goalsCompleted = goals.filter((g: any) => Number(g.current_amount) >= Number(g.target_amount)).length;

    // Budget discipline check
    let withinBudget = false;
    if (budgets.length > 0) {
      const catSpending: Record<string, number> = {};
      monthTx.filter((t: any) => t.type === "expense").forEach((t: any) => {
        const key = t.category_id || "none";
        catSpending[key] = (catSpending[key] || 0) + Number(t.amount);
      });
      withinBudget = budgets.every((b: any) => {
        const spent = catSpending[b.category_id || "none"] || 0;
        return spent <= Number(b.amount);
      });
    }

    // Streak calculation
    let currentStreak = streaksRes.data?.current_streak || 0;
    let bestStreak = streaksRes.data?.best_streak || 0;
    const lastCheck = streaksRes.data?.last_check_date;
    const today = now.toISOString().split("T")[0];

    if (lastCheck !== today) {
      // Check if yesterday had any "unnecessary" expenses (non-essential categories)
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      const yesterdayExpenses = transactions.filter(
        (t: any) => t.date === yesterdayStr && t.type === "expense" && t.status === "paid"
      );

      // Simple heuristic: day with no expenses or only small ones = good day
      const totalYesterday = yesterdayExpenses.reduce((s: number, t: any) => s + Number(t.amount), 0);
      const avgDailyExpense = monthExpense > 0 ? monthExpense / now.getDate() : 0;

      if (totalYesterday <= avgDailyExpense * 0.5 || yesterdayExpenses.length === 0) {
        currentStreak++;
      } else {
        currentStreak = 0;
      }

      if (currentStreak > bestStreak) bestStreak = currentStreak;

      // Upsert streak
      await supabase.from("streaks").upsert({
        user_id: userId,
        streak_type: "no_unnecessary_spending",
        current_streak: currentStreak,
        best_streak: bestStreak,
        last_check_date: today,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,streak_type" });
    }

    // Check and unlock achievements
    const metrics = {
      totalTransactions: transactions.length,
      totalGoals: goals.length,
      goalsCompleted,
      totalBudgets: budgets.length,
      withinBudget,
      savingsRate,
      totalAccounts: accounts.length,
      bestStreak,
      hasEmergencyFund,
      totalCategories: categories.length,
      totalRecurring: recurring.length,
    };

    const existingKeys = new Set(existingAchievements.map((a: any) => a.achievement_key));
    const newlyUnlocked: string[] = [];

    for (const ach of ACHIEVEMENTS) {
      if (!existingKeys.has(ach.key) && ach.condition(metrics)) {
        await supabase.from("achievements").insert({
          user_id: userId,
          achievement_key: ach.key,
          progress: 100,
        });
        newlyUnlocked.push(ach.key);
      }
    }

    // Build response
    const allAchievements = ACHIEVEMENTS.map((ach) => {
      const existing = existingAchievements.find((a: any) => a.achievement_key === ach.key);
      const justUnlocked = newlyUnlocked.includes(ach.key);
      return {
        key: ach.key,
        title: ach.title,
        description: ach.desc,
        icon: ach.icon,
        unlocked: !!existing || justUnlocked,
        unlockedAt: existing?.unlocked_at || (justUnlocked ? new Date().toISOString() : null),
        justUnlocked,
      };
    });

    const unlockedCount = allAchievements.filter((a) => a.unlocked).length;
    const totalCount = allAchievements.length;
    const level = unlockedCount <= 3 ? "Iniciante" : unlockedCount <= 8 ? "Intermediário" : unlockedCount <= 14 ? "Avançado" : "Mestre Financeiro";
    const xp = unlockedCount * 100;

    return new Response(JSON.stringify({
      achievements: allAchievements,
      stats: {
        unlocked: unlockedCount,
        total: totalCount,
        level,
        xp,
        nextLevelXp: (Math.ceil(unlockedCount / 5) * 5) * 100,
        currentStreak,
        bestStreak,
        savingsRate: Math.round(savingsRate),
      },
      newlyUnlocked: allAchievements.filter((a) => a.justUnlocked),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("achievements error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
