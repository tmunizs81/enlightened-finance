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

    const body = await req.json().catch(() => ({}));
    const action = body.action || "generate";

    // === GET active challenges ===
    if (action === "list") {
      const { data: challenges } = await supabase
        .from("weekly_challenges")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      // Update progress for active challenges
      const active = (challenges || []).filter((c: any) => c.status === "active");
      for (const ch of active) {
        const progress = await calculateProgress(supabase, user.id, ch);
        if (progress !== ch.current_progress) {
          const update: any = { current_progress: progress };
          if (progress >= 100) {
            update.status = "completed";
            update.completed_at = new Date().toISOString();
          }
          await supabase.from("weekly_challenges").update(update).eq("id", ch.id);
          ch.current_progress = progress;
          if (progress >= 100) ch.status = "completed";
        }
      }

      return new Response(JSON.stringify({ challenges: challenges || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === GENERATE new challenges ===
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + 1); // Monday
    const weekStartStr = weekStart.toISOString().split("T")[0];

    // Check if already generated this week
    const { data: existing } = await supabase
      .from("weekly_challenges")
      .select("id")
      .eq("user_id", user.id)
      .gte("week_start", weekStartStr)
      .limit(1);

    if (existing && existing.length > 0) {
      // Return existing
      const { data: challenges } = await supabase
        .from("weekly_challenges")
        .select("*")
        .eq("user_id", user.id)
        .gte("week_start", weekStartStr);
      return new Response(JSON.stringify({ challenges: challenges || [], already_generated: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch user data for AI
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const firstDay = `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`;
    const lastDay = new Date(currentYear, currentMonth, 0).toISOString().split("T")[0];

    const [txRes, catRes, budgetRes, goalRes] = await Promise.all([
      supabase.from("transactions").select("*").eq("user_id", user.id).eq("type", "expense").gte("date", firstDay).lte("date", lastDay),
      supabase.from("categories").select("id, name").eq("user_id", user.id).eq("type", "expense"),
      supabase.from("budgets").select("*").eq("user_id", user.id).eq("month", currentMonth).eq("year", currentYear),
      supabase.from("goals").select("*").eq("user_id", user.id),
    ]);

    const transactions = txRes.data || [];
    const categories = catRes.data || [];
    const budgets = budgetRes.data || [];
    const goals = goalRes.data || [];

    const catMap: Record<string, string> = {};
    categories.forEach((c: any) => { catMap[c.id] = c.name; });

    const spendByCategory: Record<string, number> = {};
    transactions.forEach((t: any) => {
      const name = catMap[t.category_id] || "Outros";
      spendByCategory[name] = (spendByCategory[name] || 0) + Number(t.amount);
    });
    const totalSpend = transactions.reduce((s: number, t: any) => s + Number(t.amount), 0);

    const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
    if (!DEEPSEEK_API_KEY) throw new Error("DEEPSEEK_API_KEY not configured");

    const weekEndDate = new Date(weekStart);
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    const weekEndStr = weekEndDate.toISOString().split("T")[0];

    const prompt = `Crie 3 desafios financeiros semanais personalizados para o usuário.

Dados do mês atual:
- Gasto total: R$ ${totalSpend.toFixed(2)}
- Gastos por categoria: ${JSON.stringify(spendByCategory)}
- Orçamentos: ${budgets.map((b: any) => `${catMap[b.category_id] || "Geral"}: R$ ${Number(b.amount).toFixed(2)}`).join(", ") || "nenhum"}
- Metas: ${goals.map((g: any) => `${g.name}: ${Math.round(Number(g.current_amount) / Number(g.target_amount) * 100)}%`).join(", ") || "nenhuma"}

Categorias disponíveis com IDs:
${categories.map((c: any) => `- "${c.name}" (id: ${c.id})`).join("\n")}

Regras:
- Cada desafio deve ser ACIONÁVEL e MENSURÁVEL
- Tipos: "spending_reduction" (reduzir gasto em categoria), "savings" (economizar valor), "no_spend_days" (dias sem gastar)
- XP: 30-100 baseado na dificuldade
- Use categorias onde o usuário gasta mais`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você cria desafios financeiros gamificados. Retorne JSON estruturado." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "return_challenges",
            description: "Return weekly financial challenges",
            parameters: {
              type: "object",
              properties: {
                challenges: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      description: { type: "string" },
                      target_type: { type: "string", enum: ["spending_reduction", "savings", "no_spend_days"] },
                      target_category_id: { type: "string", description: "UUID of category or null" },
                      target_amount: { type: "number", description: "Target amount in BRL" },
                      target_percent: { type: "number", description: "Target reduction percentage" },
                      xp_reward: { type: "number" },
                    },
                    required: ["title", "description", "target_type", "xp_reward"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["challenges"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "return_challenges" } },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error:", aiResp.status, t);
      throw new Error("AI gateway error");
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let challenges: any[] = [];

    if (toolCall?.function?.arguments) {
      challenges = JSON.parse(toolCall.function.arguments).challenges || [];
    }

    // Insert challenges
    const rows = challenges.slice(0, 3).map((ch: any) => ({
      user_id: user.id,
      title: ch.title,
      description: ch.description,
      target_type: ch.target_type,
      target_category_id: ch.target_category_id || null,
      target_amount: ch.target_amount || null,
      target_percent: ch.target_percent || null,
      xp_reward: ch.xp_reward || 50,
      week_start: weekStartStr,
      week_end: weekEndStr,
    }));

    if (rows.length > 0) {
      await supabase.from("weekly_challenges").insert(rows);
    }

    const { data: newChallenges } = await supabase
      .from("weekly_challenges")
      .select("*")
      .eq("user_id", user.id)
      .gte("week_start", weekStartStr);

    return new Response(JSON.stringify({ challenges: newChallenges || [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("weekly-challenges error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function calculateProgress(supabase: any, userId: string, challenge: any): Promise<number> {
  const weekStart = challenge.week_start;
  const weekEnd = challenge.week_end;

  if (challenge.target_type === "spending_reduction") {
    const { data: txs } = await supabase
      .from("transactions")
      .select("amount")
      .eq("user_id", userId)
      .eq("type", "expense")
      .gte("date", weekStart)
      .lte("date", weekEnd)
      .eq("status", "paid");

    let spent = 0;
    if (challenge.target_category_id) {
      const filtered = (txs || []).filter((t: any) => t.category_id === challenge.target_category_id);
      spent = filtered.reduce((s: number, t: any) => s + Number(t.amount), 0);
    } else {
      spent = (txs || []).reduce((s: number, t: any) => s + Number(t.amount), 0);
    }

    if (challenge.target_amount) {
      return Math.min(100, Math.round(((challenge.target_amount - spent) / challenge.target_amount) * 100));
    }
    return spent === 0 ? 100 : 0;
  }

  if (challenge.target_type === "no_spend_days") {
    const days = 7;
    const { data: txs } = await supabase
      .from("transactions")
      .select("date")
      .eq("user_id", userId)
      .eq("type", "expense")
      .gte("date", weekStart)
      .lte("date", weekEnd)
      .eq("status", "paid");

    const spendDays = new Set((txs || []).map((t: any) => t.date));
    const noSpendDays = days - spendDays.size;
    const target = challenge.target_amount || 3;
    return Math.min(100, Math.round((noSpendDays / target) * 100));
  }

  return 0;
}
