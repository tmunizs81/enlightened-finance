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

    const [txRes, catRes] = await Promise.all([
      supabase.from("transactions").select("*").eq("user_id", userId).eq("type", "expense").eq("status", "paid").order("date", { ascending: false }).limit(300),
      supabase.from("categories").select("id, name").eq("user_id", userId),
    ]);

    const transactions = txRes.data || [];
    const categories = catRes.data || [];
    const catMap = new Map(categories.map((c: any) => [c.id, c.name]));

    // Detect anomalies: transactions 2x+ above category average
    const catGroups = new Map<string, number[]>();
    transactions.forEach((t: any) => {
      const key = t.category_id || "none";
      if (!catGroups.has(key)) catGroups.set(key, []);
      catGroups.get(key)!.push(Number(t.amount));
    });

    const anomalies: any[] = [];
    const recent = transactions.slice(0, 20);
    for (const tx of recent) {
      const key = tx.category_id || "none";
      const amounts = catGroups.get(key) || [];
      if (amounts.length < 3) continue;
      const avg = amounts.reduce((a: number, b: number) => a + b, 0) / amounts.length;
      const ratio = Number(tx.amount) / avg;
      if (ratio >= 2.0) {
        anomalies.push({
          description: tx.description,
          amount: Number(tx.amount),
          average: Math.round(avg),
          ratio: Math.round(ratio * 10) / 10,
          category: catMap.get(tx.category_id || "") || "Sem categoria",
          date: tx.date,
        });
      }
    }

    // Get AI explanation for anomalies
    let aiExplanation = "";
    const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");

    if (DEEPSEEK_API_KEY && anomalies.length > 0) {
      try {
        const anomalyText = anomalies.slice(0, 5).map((a: any) =>
          `"${a.description}" em ${a.category}: R$ ${a.amount} (média R$ ${a.average}, ${a.ratio}x acima)`
        ).join("\n");

        const prompt = `Você é um consultor financeiro. Analise estas anomalias de gastos e dê conselhos curtos e práticos (max 4 frases em português):
${anomalyText}
Responda APENAS com a análise, sem saudações. Seja direto e prático.`;

        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [{ role: "user", content: prompt }],
          }),
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          aiExplanation = aiData.choices?.[0]?.message?.content || "";
        }
      } catch (e) {
        console.error("AI anomaly analysis error:", e);
      }
    }

    return new Response(JSON.stringify({
      anomalies: anomalies.slice(0, 5),
      aiExplanation,
      totalAnomalies: anomalies.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-anomalies error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
