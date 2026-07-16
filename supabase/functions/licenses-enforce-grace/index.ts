// Cron diário — bloqueia licenças cujo grace_until já passou.
// Rede de segurança caso o webhook do Asaas falhe em algum evento.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const nowIso = new Date().toISOString();

  // 1) Bloqueia licenças com grace_until vencido
  const { data: expiredByGrace, error: e1 } = await admin
    .from("licenses")
    .update({ status: "blocked" })
    .eq("status", "active")
    .not("grace_until", "is", null)
    .lt("grace_until", nowIso)
    .select("id");

  // 2) Fallback: licenças sem grace_until, com expires_at + 3d vencido
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const { data: expiredByDate, error: e2 } = await admin
    .from("licenses")
    .update({ status: "blocked" })
    .eq("status", "active")
    .is("grace_until", null)
    .lt("expires_at", threeDaysAgo.toISOString())
    .select("id");

  if (e1 || e2) {
    console.error("licenses-enforce-grace error:", e1 || e2);
    return new Response(
      JSON.stringify({ error: (e1 || e2)?.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const total = (expiredByGrace?.length || 0) + (expiredByDate?.length || 0);
  return new Response(
    JSON.stringify({ ok: true, blocked: total }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
