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

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const today = now.toISOString().split("T")[0];

    // Fetch all active recurring transactions that haven't been generated this month
    const { data: recurrings, error: fetchErr } = await supabase
      .from("recurring_transactions")
      .select("*")
      .eq("active", true);

    if (fetchErr) throw fetchErr;

    let created = 0;
    let skipped = 0;

    for (const rec of recurrings || []) {
      // Check if already generated for this month
      const lastGen = rec.last_generated;
      if (lastGen) {
        const lastGenMonth = lastGen.substring(0, 7); // YYYY-MM
        if (lastGenMonth >= currentMonth) {
          skipped++;
          continue;
        }
      }

      // Determine the date for this month's transaction
      const day = Math.min(rec.day_of_month, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate());
      const txDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

      // Create the transaction
      const { error: insertErr } = await supabase.from("transactions").insert({
        user_id: rec.user_id,
        description: rec.description,
        amount: rec.amount,
        type: rec.type,
        category_id: rec.category_id,
        account_id: rec.account_id,
        date: txDate,
        status: "pending",
        notes: "Transação recorrente gerada automaticamente",
      });

      if (insertErr) {
        console.error(`Error creating transaction for recurring ${rec.id}:`, insertErr);
        continue;
      }

      // Update last_generated
      await supabase
        .from("recurring_transactions")
        .update({ last_generated: today })
        .eq("id", rec.id);

      created++;
    }

    console.log(`Process recurring: created=${created}, skipped=${skipped}`);

    return new Response(JSON.stringify({ created, skipped }), {
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
