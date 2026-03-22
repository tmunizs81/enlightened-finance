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
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) throw new Error("Não autorizado");

    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();

    const curStart = new Date(curYear, curMonth, 1).toISOString().split("T")[0];
    const curEnd = new Date(curYear, curMonth + 1, 0).toISOString().split("T")[0];
    const prevStart = new Date(curYear, curMonth - 1, 1).toISOString().split("T")[0];
    const prevEnd = new Date(curYear, curMonth, 0).toISOString().split("T")[0];

    const [curTx, prevTx, catResult] = await Promise.all([
      supabase.from("transactions").select("*").gte("date", curStart).lte("date", curEnd),
      supabase.from("transactions").select("*").gte("date", prevStart).lte("date", prevEnd),
      supabase.from("categories").select("*"),
    ]);

    const curTransactions = curTx.data || [];
    const prevTransactions = prevTx.data || [];
    const categories = catResult.data || [];
    const catMap = new Map(categories.map((c: any) => [c.id, c.name]));

    const summarize = (txs: any[]) => {
      const income = txs.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + Number(t.amount), 0);
      const expense = txs.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + Number(t.amount), 0);
      const byCat: Record<string, number> = {};
      txs.filter((t: any) => t.type === "expense").forEach((t: any) => {
        const name = catMap.get(t.category_id) || "Sem categoria";
        byCat[name] = (byCat[name] || 0) + Number(t.amount);
      });
      return { income, expense, net: income - expense, count: txs.length, byCat };
    };

    const cur = summarize(curTransactions);
    const prev = summarize(prevTransactions);

    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const curMonthName = monthNames[curMonth];
    const prevMonthName = monthNames[curMonth === 0 ? 11 : curMonth - 1];

    const prompt = `Gere um resumo financeiro mensal comparativo em português brasileiro.

Mês atual (${curMonthName}):
- Receitas: R$${cur.income.toFixed(2)}
- Despesas: R$${cur.expense.toFixed(2)}
- Saldo: R$${cur.net.toFixed(2)}
- Transações: ${cur.count}
- Gastos por categoria: ${JSON.stringify(cur.byCat)}

Mês anterior (${prevMonthName}):
- Receitas: R$${prev.income.toFixed(2)}
- Despesas: R$${prev.expense.toFixed(2)}
- Saldo: R$${prev.net.toFixed(2)}
- Transações: ${prev.count}
- Gastos por categoria: ${JSON.stringify(prev.byCat)}

Retorne um resumo narrativo de 3-5 frases analisando a evolução, destacando categorias com maior variação e dando uma recomendação prática.`;

    const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
    if (!DEEPSEEK_API_KEY) throw new Error("DEEPSEEK_API_KEY not configured");

    const aiResponse = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "Você é um analista financeiro pessoal. Seja direto e use emojis com moderação." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_summary",
              description: "Return structured monthly financial summary",
              parameters: {
                type: "object",
                properties: {
                  narrative: { type: "string", description: "3-5 sentence analysis in Portuguese" },
                  verdict: { type: "string", enum: ["positive", "neutral", "negative"], description: "Overall month assessment" },
                  top_change_category: { type: "string", description: "Category with biggest change" },
                  top_change_percent: { type: "number", description: "Percentage change of that category (negative = reduction)" },
                },
                required: ["narrative", "verdict"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_summary" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let aiSummary = { narrative: "", verdict: "neutral", top_change_category: null, top_change_percent: null };

    if (toolCall?.function?.arguments) {
      aiSummary = { ...aiSummary, ...JSON.parse(toolCall.function.arguments) };
    }

    const pctChange = (cur: number, prev: number) => prev === 0 ? (cur > 0 ? 100 : 0) : ((cur - prev) / prev) * 100;

    return new Response(JSON.stringify({
      current: { month: curMonthName, ...cur },
      previous: { month: prevMonthName, ...prev },
      changes: {
        income: pctChange(cur.income, prev.income),
        expense: pctChange(cur.expense, prev.expense),
        net: pctChange(cur.net, prev.net),
      },
      ai: aiSummary,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("monthly-summary error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
