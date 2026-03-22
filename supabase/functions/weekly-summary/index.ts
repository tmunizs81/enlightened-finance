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
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader! } } });
    const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
    if (!DEEPSEEK_API_KEY) throw new Error("DEEPSEEK_API_KEY not configured");

    const token = (authHeader || "").replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userId = claimsData.claims.sub as string;
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split("T")[0];

    const [txRes, categoriesRes, goalsRes] = await Promise.all([
      supabase.from("transactions").select("*").eq("user_id", userId).gte("date", weekAgoStr).order("date", { ascending: false }),
      supabase.from("categories").select("*").eq("user_id", userId),
      supabase.from("goals").select("*").eq("user_id", userId),
    ]);

    const transactions = txRes.data || [];
    const categories = categoriesRes.data || [];
    const goals = goalsRes.data || [];
    const catMap: Record<string, string> = {};
    categories.forEach((c: any) => { catMap[c.id] = c.name; });

    const income = transactions.filter((t: any) => t.type === "income" && t.status === "paid").reduce((s: number, t: any) => s + Number(t.amount), 0);
    const expense = transactions.filter((t: any) => t.type === "expense" && t.status === "paid").reduce((s: number, t: any) => s + Number(t.amount), 0);

    const catSpending: Record<string, number> = {};
    transactions.filter((t: any) => t.type === "expense" && t.status === "paid").forEach((t: any) => {
      const name = t.category_id ? (catMap[t.category_id] || "Outros") : "Outros";
      catSpending[name] = (catSpending[name] || 0) + Number(t.amount);
    });
    const topCats = Object.entries(catSpending).sort(([, a], [, b]) => (b as number) - (a as number)).slice(0, 5);

    const prompt = `Analise os dados financeiros da última semana e gere um resumo conciso em português brasileiro com emojis:

📊 SEMANA (${weekAgoStr} a ${now.toISOString().split("T")[0]}):
- Receitas: R$ ${income.toLocaleString("pt-BR")}
- Despesas: R$ ${expense.toLocaleString("pt-BR")}
- Saldo: R$ ${(income - expense).toLocaleString("pt-BR")}
- Transações: ${transactions.length}

🏷️ Top gastos: ${topCats.map(([name, amount]) => `${name}: R$ ${(amount as number).toLocaleString("pt-BR")}`).join(", ") || "Nenhum"}

🎯 Metas: ${goals.map((g: any) => `${g.name}: ${Math.round((Number(g.current_amount) / Number(g.target_amount)) * 100)}%`).join(", ") || "Nenhuma"}

Gere em 4-5 linhas: 1) Resumo do comportamento 2) Destaque positivo ou negativo 3) Dica prática para a próxima semana. Seja direto e motivacional.`;

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${DEEPSEEK_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "Você é um analista financeiro pessoal. Responda sempre em português brasileiro, conciso e motivacional." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({
        summary: `📊 **Resumo da Semana**\n\nReceitas: R$ ${income.toLocaleString("pt-BR")} | Despesas: R$ ${expense.toLocaleString("pt-BR")}\n\n${income > expense ? "✅ Semana positiva!" : "⚠️ Gastos acima da receita."}`,
        weekIncome: income,
        weekExpense: expense,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await response.json();
    const summary = aiData.choices?.[0]?.message?.content || "Resumo indisponível.";

    return new Response(JSON.stringify({ summary, weekIncome: income, weekExpense: expense }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("weekly-summary error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
