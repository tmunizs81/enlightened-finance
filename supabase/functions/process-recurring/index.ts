import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let force = false;
    try {
      const body = await req.json();
      force = body?.force === true;
    } catch { /* empty body is fine */ }

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const today = now.toISOString().split("T")[0];

    const { data: recurrings, error: fetchErr } = await supabase
      .from("recurring_transactions")
      .select("*")
      .eq("active", true);

    if (fetchErr) throw fetchErr;

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const rec of recurrings || []) {
      if (!force) {
        const lastGen = rec.last_generated;
        if (lastGen) {
          const lastGenMonth = lastGen.substring(0, 7);
          if (lastGenMonth >= currentMonth) {
            skipped++;
            continue;
          }
        }
      }

      // When forcing, check if transaction already exists this month to avoid duplicates
      if (force) {
        const monthStart = `${currentMonth}-01`;
        const monthEnd = `${currentMonth}-31`;
        const { data: existing } = await supabase
          .from("transactions")
          .select("id")
          .eq("user_id", rec.user_id)
          .eq("description", rec.description)
          .eq("type", rec.type)
          .gte("date", monthStart)
          .lte("date", monthEnd)
          .limit(1);

        if (existing && existing.length > 0) {
          console.log(`Force mode: transaction already exists for "${rec.description}" this month, skipping`);
          // Fix last_generated if it wasn't set
          if (!rec.last_generated || rec.last_generated.substring(0, 7) < currentMonth) {
            await supabase.from("recurring_transactions").update({ last_generated: today }).eq("id", rec.id);
          }
          skipped++;
          continue;
        }
      }

      const day = Math.min(rec.day_of_month, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate());
      const txDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

      const insertPayload = {
        user_id: rec.user_id,
        description: rec.description,
        amount: rec.amount,
        type: rec.type,
        category_id: rec.category_id,
        account_id: rec.account_id,
        date: txDate,
        status: "pending",
        notes: "Transação recorrente gerada automaticamente",
        boleto_url: rec.boleto_url || null,
      };

      console.log(`Inserting transaction for "${rec.description}":`, JSON.stringify(insertPayload));

      const { data: insertedData, error: insertErr } = await supabase
        .from("transactions")
        .insert(insertPayload)
        .select("id");

      if (insertErr) {
        console.error(`ERROR inserting transaction for "${rec.description}" (recurring ${rec.id}):`, JSON.stringify(insertErr));
        errors++;
        continue;
      }

      console.log(`SUCCESS: Created transaction ${insertedData?.[0]?.id} for "${rec.description}"`);

      const { error: updateErr } = await supabase
        .from("recurring_transactions")
        .update({ last_generated: today })
        .eq("id", rec.id);

      if (updateErr) {
        console.error(`ERROR updating last_generated for "${rec.description}":`, JSON.stringify(updateErr));
      }

      created++;
    }

    console.log(`Process recurring: created=${created}, skipped=${skipped}, errors=${errors}, force=${force}`);

    return new Response(JSON.stringify({ created, skipped, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("process-recurring error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
