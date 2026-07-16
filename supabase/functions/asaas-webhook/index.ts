// Recebe eventos do Asaas (Payments/Subscriptions) e sincroniza tabela licenses.
// Endpoint público — valida via header `asaas-access-token` == secret ASAAS_WEBHOOK_TOKEN.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, asaas-access-token",
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

  const expectedToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
  const provided = req.headers.get("asaas-access-token");
  if (!expectedToken || provided !== expectedToken) {
    console.warn("asaas-webhook unauthorized request");
    return json(401, { error: "Unauthorized" });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let payload: any;
  try { payload = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }

  const event = String(payload?.event || "");
  const payment = payload?.payment || {};
  const subscriptionId: string | null = payment?.subscription || payload?.subscription?.id || null;
  const customerId: string | null = payment?.customer || payload?.customer || null;
  const paymentId: string | null = payment?.id || null;

  // Resolve user via subscription/customer
  let userId: string | null = null;
  let licenseId: string | null = null;

  if (subscriptionId) {
    const { data } = await admin
      .from("licenses")
      .select("id, user_id")
      .eq("asaas_subscription_id", subscriptionId)
      .maybeSingle();
    if (data) { userId = data.user_id; licenseId = data.id; }
  }
  if (!licenseId && customerId) {
    const { data } = await admin
      .from("licenses")
      .select("id, user_id")
      .eq("asaas_customer_id", customerId)
      .order("created_at", { ascending: false })
      .maybeSingle();
    if (data) { userId = data.user_id; licenseId = data.id; }
  }

  let status: "success" | "error" | "skipped" = "success";
  let errorMessage: string | null = null;
  let note: string | null = null;

  try {
    if (!licenseId) {
      status = "skipped";
      note = "no matching license";
      console.warn("asaas-webhook: license not found for event", event, subscriptionId, customerId);
    } else {
      switch (event) {
        case "PAYMENT_CONFIRMED":
        case "PAYMENT_RECEIVED":
        case "PAYMENT_RECEIVED_IN_CASH":
        case "PAYMENT_ANTICIPATED": {
          const { data: cur } = await admin
            .from("licenses").select("expires_at").eq("id", licenseId).maybeSingle();
          const base = cur?.expires_at ? new Date(cur.expires_at) : new Date();
          const start = base > new Date() ? base : new Date();
          start.setDate(start.getDate() + 30);
          const grace = new Date(start);
          grace.setDate(grace.getDate() + 3);
          await admin
            .from("licenses")
            .update({
              status: "active",
              expires_at: start.toISOString(),
              grace_until: grace.toISOString(),
              last_payment_status: "confirmed",
            })
            .eq("id", licenseId);
          break;
        }
        case "PAYMENT_OVERDUE": {
          await admin
            .from("licenses")
            .update({ last_payment_status: "overdue" })
            .eq("id", licenseId);
          break;
        }
        case "PAYMENT_REFUNDED":
        case "PAYMENT_REFUND_IN_PROGRESS":
        case "PAYMENT_CHARGEBACK_REQUESTED":
        case "PAYMENT_CHARGEBACK_DISPUTE": {
          await admin
            .from("licenses")
            .update({ status: "blocked", last_payment_status: "refunded" })
            .eq("id", licenseId);
          break;
        }
        case "PAYMENT_DELETED":
        case "SUBSCRIPTION_DELETED":
        case "SUBSCRIPTION_INACTIVATED": {
          await admin
            .from("licenses")
            .update({ status: "blocked" })
            .eq("id", licenseId);
          break;
        }
        case "PAYMENT_CREATED":
        case "PAYMENT_UPDATED": {
          const due = payment?.dueDate;
          if (due) {
            await admin.from("licenses").update({ next_charge_at: due }).eq("id", licenseId);
          }
          break;
        }
        default:
          status = "skipped";
          note = `unhandled event ${event}`;
          break;
      }
    }
  } catch (e) {
    status = "error";
    errorMessage = e instanceof Error ? e.message : String(e);
    console.error("asaas-webhook processing error:", e);
  }

  const processingMs = Math.round(performance.now() - startedAt);

  // Audit event with status/timing
  await admin.from("payment_events").insert({
    provider: "asaas",
    event_type: event,
    payment_id: paymentId,
    subscription_id: subscriptionId,
    customer_id: customerId,
    user_id: userId,
    payload,
    status,
    error_message: errorMessage,
    processing_ms: processingMs,
  });

  if (status === "error") {
    return json(500, { error: errorMessage });
  }
  return json(200, { ok: true, processed: event, status, note, processing_ms: processingMs });
});
