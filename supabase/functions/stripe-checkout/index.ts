// Cria sessão Stripe Checkout (subscription) para o usuário autenticado.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json(500, { error: "STRIPE_SECRET_KEY not configured" });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "Missing authorization" });

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await supa.auth.getUser();
    if (userErr || !userData?.user) return json(401, { error: "Unauthorized" });
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const plan = String(body?.plan || "");
    if (!["individual", "family"].includes(plan)) return json(400, { error: "Invalid plan" });

    const priceId = plan === "family"
      ? Deno.env.get("STRIPE_PRICE_FAMILY")
      : Deno.env.get("STRIPE_PRICE_INDIVIDUAL");
    if (!priceId) return json(500, { error: "Stripe price not configured" });

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

    // Reutiliza customer se já existir
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    let customerId: string | null = null;
    const { data: existingLic } = await admin
      .from("licenses")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (existingLic?.stripe_customer_id) customerId = existingLic.stripe_customer_id;

    if (!customerId) {
      const list = await stripe.customers.list({ email: user.email!, limit: 1 });
      if (list.data[0]) customerId = list.data[0].id;
    }
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email!,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
    }

    const origin = req.headers.get("origin") || "https://fin.t2systems.com.br";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/planos?stripe=success`,
      cancel_url: `${origin}/planos?stripe=cancel`,
      client_reference_id: user.id,
      subscription_data: {
        metadata: { user_id: user.id, plan },
      },
      metadata: { user_id: user.id, plan },
      allow_promotion_codes: true,
      locale: "pt-BR",
    });

    return json(200, { url: session.url, sessionId: session.id });
  } catch (e) {
    console.error("stripe-checkout error:", e);
    return json(500, { error: e instanceof Error ? e.message : "Unknown error" });
  }
});
