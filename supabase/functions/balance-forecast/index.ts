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

    const [txRes, accountsRes, recurringRes] = await Promise.all([
      supabase.from("transactions").select("amount, type, status, date").eq("user_id", userId).eq("status", "paid").order("date", { ascending: false }).limit(500),
      supabase.from("accounts").select("balance").eq("user_id", userId),
      supabase.from("recurring_transactions").select("amount, type, active").eq("user_id", userId).eq("active", true),
    ]);

    const transactions = txRes.data || [];
    const accounts = accountsRes.data || [];
    const recurring = recurringRes.data || [];

    const currentBalance = accounts.reduce((s: number, a: any) => s + Number(a.balance), 0);

    // Monthly net calculation from last 6 months
    const monthlyNets: number[] = [];
    const now = new Date();
    for (let i = 1; i <= 6; i++) {
      const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const mStart = m.toISOString().split("T")[0];
      const mEndStr = mEnd.toISOString().split("T")[0];
      const mTx = transactions.filter((t: any) => t.date >= mStart && t.date <= mEndStr);
      const income = mTx.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + Number(t.amount), 0);
      const expense = mTx.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + Number(t.amount), 0);
      monthlyNets.push(income - expense);
    }

    const avgNet = monthlyNets.length > 0 ? monthlyNets.reduce((a, b) => a + b, 0) / monthlyNets.length : 0;
    const stdDev = monthlyNets.length > 1
      ? Math.sqrt(monthlyNets.reduce((s, v) => s + Math.pow(v - avgNet, 2), 0) / (monthlyNets.length - 1))
      : Math.abs(avgNet) * 0.3;

    // Recurring impact
    const monthlyRecurringNet = recurring.reduce((s: number, r: any) => s + (r.type === "income" ? 1 : -1) * Number(r.amount), 0);

    // Weighted average (recurrings more reliable)
    const projectedMonthlyNet = avgNet * 0.6 + monthlyRecurringNet * 0.4;

    // Build AI context for analysis
    const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
    let aiAnalysis = "";

    if (DEEPSEEK_API_KEY) {
      try {
        const prompt = `Analise estes dados financeiros e dê uma previsão curta (máximo 3 frases em português) sobre a tendência do saldo:
- Saldo atual: R$ ${currentBalance.toFixed(2)}
- Média mensal líquida (últimos 6 meses): R$ ${avgNet.toFixed(2)}
- Desvio padrão: R$ ${stdDev.toFixed(2)}
- Recorrentes líquido mensal: R$ ${monthlyRecurringNet.toFixed(2)}
- Meses com dados: ${monthlyNets.map((n, i) => `Mês -${i + 1}: R$ ${n.toFixed(0)}`).join(", ")}
Responda APENAS com a análise, sem saudações.`;

        const aiResp = await fetch("https://api.deepseek.com/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${DEEPSEEK_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [{ role: "user", content: prompt }],
          }),
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          aiAnalysis = aiData.choices?.[0]?.message?.content || "";
        }
      } catch (e) {
        console.error("AI analysis error:", e);
      }
    }

    // Build forecast data points
    const scenarios = {
      optimistic: [] as { month: string; value: number }[],
      realistic: [] as { month: string; value: number }[],
      pessimistic: [] as { month: string; value: number }[],
    };

    let optBalance = currentBalance;
    let realBalance = currentBalance;
    let pessBalance = currentBalance;

    const monthName = (d: Date) => d.toLocaleString("pt-BR", { month: "short" }).replace(".", "");

    // Current month
    const nowLabel = monthName(now);
    scenarios.optimistic.push({ month: nowLabel, value: currentBalance });
    scenarios.realistic.push({ month: nowLabel, value: currentBalance });
    scenarios.pessimistic.push({ month: nowLabel, value: currentBalance });

    for (let i = 1; i <= 6; i++) {
      const future = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const label = monthName(future);

      optBalance += projectedMonthlyNet + stdDev * 0.8;
      realBalance += projectedMonthlyNet;
      pessBalance += projectedMonthlyNet - stdDev * 0.8;

      scenarios.optimistic.push({ month: label, value: Math.round(optBalance) });
      scenarios.realistic.push({ month: label, value: Math.round(realBalance) });
      scenarios.pessimistic.push({ month: label, value: Math.round(pessBalance) });
    }

    return new Response(JSON.stringify({
      currentBalance,
      scenarios,
      monthlyNet: Math.round(projectedMonthlyNet),
      stdDev: Math.round(stdDev),
      aiAnalysis,
      projected30: Math.round(currentBalance + projectedMonthlyNet),
      projected60: Math.round(currentBalance + projectedMonthlyNet * 2),
      projected90: Math.round(currentBalance + projectedMonthlyNet * 3),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("balance-forecast error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
