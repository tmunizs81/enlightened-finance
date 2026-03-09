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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const requestedUserId = body.user_id;

    // If no user_id, broadcast mode: process all users with Telegram configured
    if (!requestedUserId) {
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

      let totalAlerts = 0;
      for (const p of profiles) {
        try {
          const result = await processUser(supabase, p.user_id, p.telegram_bot_token, p.telegram_chat_id);
          totalAlerts += result;
        } catch (e) {
          console.error(`Error processing user ${p.user_id}:`, e);
        }
      }

      return new Response(JSON.stringify({ users_processed: profiles.length, total_alerts: totalAlerts }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Single user mode
    const { data: profile } = await supabase
      .from("profiles")
      .select("telegram_bot_token, telegram_chat_id")
      .eq("user_id", requestedUserId)
      .single();

    if (!profile?.telegram_bot_token || !profile?.telegram_chat_id) {
      return new Response(JSON.stringify({ message: "No Telegram configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const alertCount = await processUser(supabase, requestedUserId, profile.telegram_bot_token, profile.telegram_chat_id);

    return new Response(JSON.stringify({ alerts_sent: alertCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("spending-monitor error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function processUser(supabase: any, user_id: string, botToken: string, chatId: string): Promise<number> {
  const sendTg = async (text: string) => {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "Markdown",
        }),
      });
    };

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const firstDay = `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`;
    const lastDay = new Date(currentYear, currentMonth, 0);
    const lastDayStr = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;

    const [budgetRes, txRes, goalRes, catRes] = await Promise.all([
      supabase.from("budgets").select("*").eq("user_id", user_id).eq("month", currentMonth).eq("year", currentYear),
      supabase.from("transactions").select("*").eq("user_id", user_id).eq("type", "expense").gte("date", firstDay).lte("date", lastDayStr),
      supabase.from("goals").select("*").eq("user_id", user_id),
      supabase.from("categories").select("id, name").eq("user_id", user_id),
    ]);

    const budgets = budgetRes.data || [];
    const transactions = txRes.data || [];
    const goals = goalRes.data || [];
    const categories = catRes.data || [];
    const catMap = new Map(categories.map((c: any) => [c.id, c.name]));

    const alerts: string[] = [];

    const spendingByCategory: Record<string, number> = {};
    const totalSpending = transactions.reduce((sum: number, t: any) => {
      const catId = t.category_id || "sem_categoria";
      spendingByCategory[catId] = (spendingByCategory[catId] || 0) + Number(t.amount);
      return sum + Number(t.amount);
    }, 0);

    for (const budget of budgets) {
      const budgetAmount = Number(budget.amount);
      const catId = budget.category_id;

      if (catId) {
        const spent = spendingByCategory[catId] || 0;
        const catName = catMap.get(catId) || "Categoria";
        const pct = (spent / budgetAmount) * 100;

        if (spent > budgetAmount) {
          alerts.push(`🚨 *Orçamento estourado!*\n📂 ${catName}: R$ ${spent.toFixed(2)} / R$ ${budgetAmount.toFixed(2)} (${pct.toFixed(0)}%)`);
        } else if (pct >= 80) {
          alerts.push(`⚠️ *Orçamento quase no limite!*\n📂 ${catName}: R$ ${spent.toFixed(2)} / R$ ${budgetAmount.toFixed(2)} (${pct.toFixed(0)}%)`);
        }
      } else {
        const pct = (totalSpending / budgetAmount) * 100;
        if (totalSpending > budgetAmount) {
          alerts.push(`🚨 *Orçamento geral estourado!*\nGasto total: R$ ${totalSpending.toFixed(2)} / R$ ${budgetAmount.toFixed(2)} (${pct.toFixed(0)}%)`);
        } else if (pct >= 80) {
          alerts.push(`⚠️ *Orçamento geral quase no limite!*\nGasto total: R$ ${totalSpending.toFixed(2)} / R$ ${budgetAmount.toFixed(2)} (${pct.toFixed(0)}%)`);
        }
      }
    }

    for (const goal of goals) {
      const target = Number(goal.target_amount);
      const current = Number(goal.current_amount);
      if (target <= 0) continue;
      const pct = (current / target) * 100;

      if (pct >= 100) {
        alerts.push(`🎉 *Meta alcançada!*\n🎯 ${goal.name}: R$ ${current.toFixed(2)} / R$ ${target.toFixed(2)}`);
      } else if (pct >= 80) {
        alerts.push(`✨ *Meta quase lá!*\n🎯 ${goal.name}: R$ ${current.toFixed(2)} / R$ ${target.toFixed(2)} (${pct.toFixed(0)}%)`);
      }

      if (goal.deadline) {
        const deadline = new Date(goal.deadline);
        const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysLeft <= 7 && daysLeft > 0 && pct < 80) {
          alerts.push(`⏰ *Meta com prazo próximo!*\n🎯 ${goal.name}: faltam ${daysLeft} dias e só ${pct.toFixed(0)}% concluído`);
        }
      }
    }

    if (transactions.length >= 5) {
      const dayOfMonth = now.getDate();
      const daysInMonth = lastDay.getDate();
      const expectedPct = (dayOfMonth / daysInMonth) * 100;

      for (const budget of budgets) {
        const budgetAmount = Number(budget.amount);
        const catId = budget.category_id;
        const spent = catId ? (spendingByCategory[catId] || 0) : totalSpending;
        const actualPct = (spent / budgetAmount) * 100;

        if (actualPct > expectedPct * 1.3 && actualPct < 80) {
          const catName = catId ? (catMap.get(catId) || "Categoria") : "Geral";
          alerts.push(`📊 *Ritmo de gasto acelerado!*\n📂 ${catName}: ${actualPct.toFixed(0)}% do orçamento usado com ${expectedPct.toFixed(0)}% do mês passado`);
        }
      }
    }

    if (alerts.length > 0) {
      const message = `☀️ *T2-SimplyFin — Relatório Diário (8h)*\n\n${alerts.join("\n\n")}\n\n_Acesse o app para mais detalhes._`;
      await sendTg(message);
    }

    return alerts.length;
}
