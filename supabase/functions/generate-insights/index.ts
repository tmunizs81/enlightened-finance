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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Não autorizado");

    // Fetch user's transactions (last 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const [txResult, catResult, accountResult, goalResult] = await Promise.all([
      supabase.from("transactions").select("*").gte("date", ninetyDaysAgo.toISOString().split("T")[0]).order("date", { ascending: false }),
      supabase.from("categories").select("*"),
      supabase.from("accounts").select("*"),
      supabase.from("goals").select("*"),
    ]);

    const transactions = txResult.data || [];
    const categories = catResult.data || [];
    const accounts = accountResult.data || [];
    const goals = goalResult.data || [];

    const catMap = new Map(categories.map((c: any) => [c.id, c.name]));

    // Build summary for AI
    const totalIncome = transactions.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + Number(t.amount), 0);
    const totalExpense = transactions.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + Number(t.amount), 0);

    const expByCategory: Record<string, number> = {};
    transactions.filter((t: any) => t.type === "expense").forEach((t: any) => {
      const name = catMap.get(t.category_id) || "Sem categoria";
      expByCategory[name] = (expByCategory[name] || 0) + Number(t.amount);
    });

    const totalBalance = accounts.reduce((s: number, a: any) => s + Number(a.balance), 0);
    const overdueCount = transactions.filter((t: any) => t.status === "overdue").length;

    const goalsSummary = goals.map((g: any) => `${g.name}: R$${Number(g.current_amount).toFixed(0)}/${Number(g.target_amount).toFixed(0)} (${g.deadline || "sem prazo"})`).join("; ");

    const prompt = `Analise os dados financeiros abaixo e gere de 3 a 5 insights acionáveis para o usuário. 
Cada insight deve ter um type (warning, success ou destructive), um título curto e uma descrição de até 2 frases.

Dados dos últimos 90 dias:
- Receitas totais: R$${totalIncome.toFixed(2)}
- Despesas totais: R$${totalExpense.toFixed(2)}
- Saldo líquido: R$${(totalIncome - totalExpense).toFixed(2)}
- Saldo total em contas: R$${totalBalance.toFixed(2)}
- Transações atrasadas: ${overdueCount}
- Gastos por categoria: ${JSON.stringify(expByCategory)}
- Metas: ${goalsSummary || "nenhuma meta cadastrada"}
- Total de transações: ${transactions.length}

Regras:
- Use "destructive" para alertas graves (gastos excessivos, contas atrasadas)
- Use "warning" para avisos (tendências preocupantes, metas atrasadas)  
- Use "success" para elogios (boa economia, metas no caminho)
- Se houver poucas transações, sugira ao usuário cadastrar mais dados`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Você é um analista financeiro. Retorne insights estruturados." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_insights",
              description: "Return structured financial insights",
              parameters: {
                type: "object",
                properties: {
                  insights: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string", enum: ["warning", "success", "destructive"] },
                        title: { type: "string" },
                        description: { type: "string" },
                      },
                      required: ["type", "title", "description"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["insights"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_insights" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
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
    let insights: any[] = [];

    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      insights = parsed.insights || [];
    }

    // Save insights to database
    if (insights.length > 0) {
      // Delete old insights for this user
      await supabase.from("ai_insights").delete().eq("user_id", user.id);

      // Insert new ones
      const rows = insights.map((ins: any) => ({
        user_id: user.id,
        type: ins.type,
        title: ins.title,
        description: ins.description,
        read: false,
      }));
      await supabase.from("ai_insights").insert(rows);
    }

    return new Response(JSON.stringify({ insights }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-insights error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
