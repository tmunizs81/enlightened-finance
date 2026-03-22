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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const now = new Date();
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const [goalsRes, txRes, accountsRes] = await Promise.all([
      supabase.from("goals").select("*").eq("user_id", user.id),
      supabase.from("transactions").select("amount, type, date, description").eq("status", "paid").gte("date", sixtyDaysAgo.toISOString().split("T")[0]).order("date", { ascending: false }),
      supabase.from("accounts").select("balance"),
    ]);

    const goals = goalsRes.data || [];
    const transactions = txRes.data || [];
    const accounts = accountsRes.data || [];

    if (goals.length === 0) {
      return new Response(JSON.stringify({ recommendations: [], summary: "Nenhuma meta cadastrada." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const totalBalance = accounts.reduce((s: number, a: any) => s + Number(a.balance), 0);
    const monthlyIncome = transactions.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + Number(t.amount), 0) / 2;
    const monthlyExpense = transactions.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + Number(t.amount), 0) / 2;
    const monthlySavings = monthlyIncome - monthlyExpense;

    const goalsSummary = goals.map((g: any) => {
      const current = Number(g.current_amount);
      const target = Number(g.target_amount);
      const pct = target > 0 ? Math.round((current / target) * 100) : 0;
      const remaining = target - current;
      const created = new Date(g.created_at);
      const daysSinceCreation = Math.max(1, Math.ceil((now.getTime() - created.getTime()) / 86400000));
      const dailyRate = current / daysSinceCreation;
      const daysToComplete = dailyRate > 0 ? Math.ceil(remaining / dailyRate) : -1;
      
      let deadlineStatus = "sem prazo";
      if (g.deadline) {
        const dl = new Date(g.deadline);
        const daysLeft = Math.ceil((dl.getTime() - now.getTime()) / 86400000);
        deadlineStatus = daysToComplete > 0 && daysToComplete <= daysLeft 
          ? `no prazo (faltam ${daysLeft} dias)` 
          : daysToComplete > 0 
            ? `atrasada (precisa de ${daysToComplete} dias, tem ${daysLeft})` 
            : `sem progresso (faltam ${daysLeft} dias)`;
      }

      return `- ${g.icon || "🎯"} ${g.name}: ${pct}% (R$${current.toFixed(0)} de R$${target.toFixed(0)}, faltam R$${remaining.toFixed(0)}) | Ritmo: R$${(dailyRate * 30).toFixed(0)}/mês | Status: ${deadlineStatus}`;
    }).join("\n");

    const prompt = `Você é um coach financeiro especializado em metas de economia. Analise as metas do usuário e dê recomendações personalizadas.

DADOS DO USUÁRIO:
- Saldo total em contas: R$ ${totalBalance.toFixed(2)}
- Renda média mensal: R$ ${monthlyIncome.toFixed(2)}
- Despesa média mensal: R$ ${monthlyExpense.toFixed(2)}
- Economia média mensal: R$ ${monthlySavings.toFixed(2)}

METAS:
${goalsSummary}

INSTRUÇÕES:
- Para cada meta, avalie o progresso e dê uma dica específica
- Sugira um valor mensal ideal para aportar em cada meta
- Se alguma meta está atrasada, dê estratégias concretas
- Se a economia mensal é insuficiente para todas as metas, sugira priorização
- Identifique se alguma meta é irrealista e sugira ajustes
- Seja motivador mas realista
- Use emojis para tornar a leitura agradável`;

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
          { role: "system", content: "Você é um coach financeiro brasileiro. Responda sempre em português." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "return_goal_analysis",
            description: "Return goal analysis with recommendations",
            parameters: {
              type: "object",
              properties: {
                summary: { type: "string", description: "Resumo geral da saúde das metas (2-3 frases)" },
                overall_status: { type: "string", enum: ["excellent", "good", "attention", "critical"], description: "Status geral" },
                recommendations: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      goal_name: { type: "string" },
                      status: { type: "string", enum: ["on_track", "needs_attention", "behind", "completed"] },
                      suggested_monthly: { type: "number", description: "Valor mensal sugerido para aportar" },
                      tip: { type: "string", description: "Dica específica para esta meta (1-2 frases)" },
                      priority: { type: "number", description: "Prioridade 1-5 (1=mais urgente)" },
                    },
                    required: ["goal_name", "status", "suggested_monthly", "tip", "priority"],
                    additionalProperties: false,
                  },
                },
                savings_plan: { type: "string", description: "Plano de economia sugerido considerando todas as metas (2-3 frases)" },
              },
              required: ["summary", "overall_status", "recommendations", "savings_plan"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "return_goal_analysis" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    let result = { summary: "", overall_status: "attention", recommendations: [] as any[], savings_plan: "" };

    if (toolCall?.function?.arguments) {
      result = JSON.parse(toolCall.function.arguments);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("goal-monitor error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
