// Recebe eventos do Stripe e sincroniza tabela licenses + payment_events.
// Endpoint público — valida assinatura via STRIPE_WEBHOOK_SECRET.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
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

  const startedAt = performance.now();
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!stripeKey || !webhookSecret) return json(500, { error: "Stripe not configured" });

  const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return json(400, { error: "Missing stripe-signature" });

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, signature, webhookSecret);
  } catch (e) {
    console.error("stripe-webhook signature verification failed:", e);
    return json(400, { error: "Invalid signature" });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  let status: "success" | "error" | "skipped" = "success";
  let errorMessage: string | null = null;
  let note: string | null = null;
  let userId: string | null = null;
  let subscriptionId: string | null = null;
  let customerId: string | null = null;
  let paymentId: string | null = null;

  try {
    const obj: any = event.data.object;
    customerId = obj?.customer || null;
    subscriptionId = obj?.subscription || obj?.id?.startsWith?.("sub_") ? (obj.subscription || obj.id) : null;
    paymentId = obj?.payment_intent || obj?.id || null;

    // resolver user_id
    if (obj?.metadata?.user_id) userId = obj.metadata.user_id;
    if (!userId && obj?.client_reference_id) userId = obj.client_reference_id;
    if (!userId && customerId) {
      const { data } = await admin
        .from("licenses").select("user_id")
        .eq("stripe_customer_id", customerId).maybeSingle();
      if (data) userId = data.user_id;
    }

    const upsertLicense = async (patch: Record<string, unknown>) => {
      if (!userId) return;
      const { data: existing } = await admin
        .from("licenses").select("id").eq("user_id", userId).maybeSingle();
      if (existing) {
        await admin.from("licenses").update(patch).eq("id", existing.id);
      } else {
        await admin.from("licenses").insert({ user_id: userId, ...patch });
      }
    };

    switch (event.type) {
      case "checkout.session.completed": {
        const session = obj as Stripe.Checkout.Session;
        const plan = String(session.metadata?.plan || "individual");
        await upsertLicense({
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
          plan_type: plan === "family" ? "family" : "monthly",
          max_seats: plan === "family" ? 5 : 1,
          status: "active",
        });
        break;
      }
      case "invoice.paid":
      case "invoice.payment_succeeded": {
        const invoice = obj as Stripe.Invoice;
        const periodEnd = invoice.lines?.data?.[0]?.period?.end;
        const expires = periodEnd ? new Date(periodEnd * 1000) : new Date(Date.now() + 30 * 86400000);
        const grace = new Date(expires); grace.setDate(grace.getDate() + 3);
        await upsertLicense({
          stripe_customer_id: invoice.customer as string,
          stripe_subscription_id: invoice.subscription as string,
          status: "active",
          expires_at: expires.toISOString(),
          grace_until: grace.toISOString(),
          last_payment_status: "confirmed",
        });
        break;
      }
      case "invoice.payment_failed": {
        await upsertLicense({ last_payment_status: "overdue" });
        break;
      }
      case "customer.subscription.deleted":
      case "customer.subscription.paused": {
        await upsertLicense({ status: "blocked" });
        break;
      }
      case "customer.subscription.updated": {
        const sub = obj as Stripe.Subscription;
        const nextCharge = sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString() : null;
        const patch: Record<string, unknown> = {
          stripe_subscription_id: sub.id,
          stripe_customer_id: sub.customer as string,
        };
        if (nextCharge) patch.next_charge_at = nextCharge;
        if (sub.status === "active" || sub.status === "trialing") patch.status = "active";
        if (sub.status === "canceled" || sub.status === "unpaid") patch.status = "blocked";
        await upsertLicense(patch);
        break;
      }
      case "charge.refunded": {
        await upsertLicense({ status: "blocked", last_payment_status: "refunded" });
        break;
      }
      default:
        status = "skipped";
        note = `unhandled event ${event.type}`;
    }
  } catch (e) {
    status = "error";
    errorMessage = e instanceof Error ? e.message : String(e);
    console.error("stripe-webhook processing error:", e);
  }

  const processingMs = Math.round(performance.now() - startedAt);

  await admin.from("payment_events").insert({
    provider: "stripe",
    event_type: event.type,
    payment_id: paymentId,
    subscription_id: subscriptionId,
    customer_id: customerId,
    user_id: userId,
    payload: event as unknown as Record<string, unknown>,
    status,
    error_message: errorMessage,
    processing_ms: processingMs,
  });

  if (status === "error") return json(500, { error: errorMessage });
  return json(200, { ok: true, processed: event.type, status, note, processing_ms: processingMs });
});
