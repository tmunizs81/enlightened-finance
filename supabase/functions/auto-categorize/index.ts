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

    const { description, type } = await req.json();
    if (!description || !type) {
      return new Response(JSON.stringify({ category_id: null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch user's categories
    const { data: categories } = await supabase
      .from("categories")
      .select("id, name")
      .eq("user_id", user.id)
      .eq("type", type);

    if (!categories || categories.length === 0) {
      return new Response(JSON.stringify({ category_id: null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch recent transactions for learning patterns
    const { data: recentTx } = await supabase
      .from("transactions")
      .select("description, category_id")
      .eq("user_id", user.id)
      .eq("type", type)
      .not("category_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(50);

    // Check exact/fuzzy match from history first
    const descLower = description.toLowerCase().trim();
    const historyMatch = (recentTx || []).find((t: any) =>
      t.description.toLowerCase().trim() === descLower
    );
    if (historyMatch?.category_id) {
      const cat = categories.find((c: any) => c.id === historyMatch.category_id);
      if (cat) {
        return new Response(JSON.stringify({ category_id: cat.id, category_name: cat.name, source: "history" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Use AI for classification
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ category_id: null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const catList = categories.map((c: any) => `- "${c.name}" (id: ${c.id})`).join("\n");

    // Build history context
    const historyExamples = (recentTx || []).slice(0, 20).map((t: any) => {
      const catName = categories.find((c: any) => c.id === t.category_id)?.name || "?";
      return `"${t.description}" → ${catName}`;
    }).join("\n");

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{
          role: "user",
          content: `Classifique esta transação na categoria mais adequada.

Descrição: "${description}"
Tipo: ${type === "expense" ? "despesa" : "receita"}

Categorias disponíveis:
${catList}

${historyExamples ? `Exemplos do histórico do usuário:\n${historyExamples}` : ""}

Responda APENAS com o JSON: {"category_id":"uuid-da-categoria"}
Se nenhuma categoria se encaixar, responda: {"category_id":null}`,
        }],
      }),
    });

    if (!aiResp.ok) {
      console.error("AI error:", aiResp.status);
      return new Response(JSON.stringify({ category_id: null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await aiResp.json();
    const raw = aiData.choices?.[0]?.message?.content || "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.category_id) {
        const cat = categories.find((c: any) => c.id === parsed.category_id);
        if (cat) {
          return new Response(JSON.stringify({ category_id: cat.id, category_name: cat.name, source: "ai" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    return new Response(JSON.stringify({ category_id: null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("auto-categorize error:", e);
    return new Response(JSON.stringify({ category_id: null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
