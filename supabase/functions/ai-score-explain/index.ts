import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { scoreData } = await req.json();
    const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
    if (!DEEPSEEK_API_KEY) throw new Error("DEEPSEEK_API_KEY not configured");

    const prompt = `Você é um consultor financeiro analisando o score financeiro de um usuário. Dados:

Score total: ${scoreData.score}/100 (${scoreData.label})
- Economia: ${scoreData.breakdown.savings.score}/${scoreData.breakdown.savings.max} (taxa: ${scoreData.breakdown.savings.rate}%)
- Metas: ${scoreData.breakdown.goals.score}/${scoreData.breakdown.goals.max} (progresso: ${scoreData.breakdown.goals.progress}%)
- Orçamento: ${scoreData.breakdown.budget.score}/${scoreData.breakdown.budget.max}
- Saúde financeira: ${scoreData.breakdown.health.score}/${scoreData.breakdown.health.max}
- Receita mensal: R$ ${scoreData.monthIncome || 0}
- Despesa mensal: R$ ${scoreData.monthExpense || 0}

Dê uma explicação curta e personalizada (máximo 5 frases em português) sobre:
1. O que está puxando o score para baixo
2. Uma ação concreta e específica para melhorar AGORA
3. Qual seria o impacto estimado no score

Seja direto, prático e motivador. Responda APENAS com a análise.`;

    const aiResp = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${DEEPSEEK_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI error:", aiResp.status, errText);
      return new Response(JSON.stringify({ explanation: "" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    const explanation = aiData.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ explanation }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-score-explain error:", e);
    return new Response(JSON.stringify({ explanation: "" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
