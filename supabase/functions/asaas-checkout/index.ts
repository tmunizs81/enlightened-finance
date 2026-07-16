// Cria/atualiza customer e subscription no Asaas para o usuário autenticado.
// Retorna a URL da primeira cobrança para o cliente pagar.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLANS = {
  individual: { value: 24.9, description: "SimplyFin - Plano Individual (mensal)", max_seats: 1, plan_type: "monthly" },
  family: { value: 49.9, description: "SimplyFin - Plano Família até 5 (mensal)", max_seats: 5, plan_type: "family" },
} as const;

type PlanKey = keyof typeof PLANS;
type BillingType = "PIX" | "BOLETO" | "CREDIT_CARD" | "UNDEFINED";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function asaasBase() {
  const env = (Deno.env.get("ASAAS_ENV") || "sandbox").toLowerCase();
  return env === "production"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3";
}

async function asaasFetch(path: string, init: RequestInit = {}) {
  const apiKey = Deno.env.get("ASAAS_API_KEY");
  if (!apiKey) throw new Error("ASAAS_API_KEY not configured");
  const res = await fetch(`${asaasBase()}${path}`, {
    ...init,
    headers: {
      access_token: apiKey,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    console.error(`Asaas ${path} failed [${res.status}]:`, data);
    throw new Error(
      typeof data === "object" && data?.errors?.[0]?.description
        ? data.errors[0].description
        : `Asaas request failed: ${res.status}`,
    );
  }
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData?.user) return json(401, { error: "Unauthorized" });

  const user = userData.user;
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const body = await req.json().catch(() => ({}));
    const plan = String(body.plan || "individual") as PlanKey;
    const billingType = String(body.billing_type || "UNDEFINED").toUpperCase() as BillingType;
    const cpfCnpj = String(body.cpf_cnpj || "").replace(/\D/g, "");

    if (!PLANS[plan]) return json(400, { error: "Plano inválido" });
    const cfg = PLANS[plan];

    // profile
    const { data: profile } = await admin
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .maybeSingle();

    // Encontra/cria customer no Asaas — busca por email primeiro
    let customerId: string | null = null;

    // Reutiliza se já existir uma licença com asaas_customer_id
    const { data: existingLic } = await admin
      .from("licenses")
      .select("id, asaas_customer_id, asaas_subscription_id")
      .eq("user_id", user.id)
      .not("asaas_customer_id", "is", null)
      .order("created_at", { ascending: false })
      .maybeSingle();

    if (existingLic?.asaas_customer_id) {
      customerId = existingLic.asaas_customer_id;
    } else {
      const search = await asaasFetch(
        `/customers?email=${encodeURIComponent(user.email || "")}`,
      );
      if (search?.data?.[0]?.id) {
        customerId = search.data[0].id;
      } else {
        if (!cpfCnpj || cpfCnpj.length < 11)
          return json(400, { error: "CPF/CNPJ é obrigatório para primeira assinatura" });
        const created = await asaasFetch("/customers", {
          method: "POST",
          body: JSON.stringify({
            name: profile?.display_name || user.email,
            email: user.email,
            cpfCnpj,
            notificationDisabled: false,
            externalReference: user.id,
          }),
        });
        customerId = created.id;
      }
    }

    // Se já existe subscription ativa/pendente, retorna o link atual
    if (existingLic?.asaas_subscription_id) {
      const sub = await asaasFetch(`/subscriptions/${existingLic.asaas_subscription_id}`);
      if (sub?.status && sub.status !== "INACTIVE" && sub.status !== "EXPIRED") {
        const payments = await asaasFetch(
          `/subscriptions/${existingLic.asaas_subscription_id}/payments?limit=1&order=desc`,
        );
        const firstPay = payments?.data?.[0];
        if (firstPay?.id && billingType === "PIX") {
          try {
            await asaasFetch(`/payments/${firstPay.id}`, {
              method: "PUT",
              body: JSON.stringify({ billingType: "PIX" }),
            });
          } catch (e) {
            console.warn("could not switch existing payment to PIX", e);
          }
        }
        return json(200, {
          reused: true,
          subscription_id: existingLic.asaas_subscription_id,
          invoiceUrl: firstPay?.invoiceUrl || null,
        });
      }
    }

    // Próxima cobrança: amanhã (Asaas exige > hoje)
    const next = new Date();
    next.setDate(next.getDate() + 1);
    const nextDueDate = next.toISOString().slice(0, 10);

    // Asaas aceita BOLETO | CREDIT_CARD | UNDEFINED em assinaturas (PIX não).
    // Se o usuário escolheu PIX, criamos a subscription como UNDEFINED e depois
    // forçamos a PRIMEIRA cobrança para PIX via PUT /payments/{id}.
    const subBillingType =
      billingType === "CREDIT_CARD" ? "CREDIT_CARD" : "UNDEFINED";

    const subscription = await asaasFetch("/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        customer: customerId,
        billingType: subBillingType,
        value: cfg.value,
        nextDueDate,
        cycle: "MONTHLY",
        description: cfg.description,
        externalReference: `user:${user.id}:plan:${plan}`,
      }),
    });

    // Primeira fatura
    const firstPayments = await asaasFetch(
      `/subscriptions/${subscription.id}/payments?limit=1&order=asc`,
    );
    let firstPayment = firstPayments?.data?.[0];

    // Se cliente pediu PIX, converte a primeira cobrança para PIX
    if (firstPayment?.id && billingType === "PIX") {
      try {
        const updated = await asaasFetch(`/payments/${firstPayment.id}`, {
          method: "PUT",
          body: JSON.stringify({ billingType: "PIX" }),
        });
        firstPayment = updated || firstPayment;
      } catch (e) {
        console.warn("could not switch first payment to PIX, falling back to invoice page", e);
      }
    }

    const invoiceUrl = firstPayment?.invoiceUrl || null;

    // Cria/atualiza licença como PENDING
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    const { data: keyData } = await admin.rpc("generate_license_key");

    if (existingLic?.id) {
      await admin
        .from("licenses")
        .update({
          asaas_customer_id: customerId,
          asaas_subscription_id: subscription.id,
          status: "blocked",
          last_payment_status: "pending",
          plan_type: cfg.plan_type,
          max_seats: cfg.max_seats,
          price_brl: cfg.value,
          next_charge_at: nextDueDate,
        })
        .eq("id", existingLic.id);
    } else {
      await admin.from("licenses").insert({
        user_id: user.id,
        license_key: keyData,
        status: "blocked", // libera no webhook após confirmar pagamento
        expires_at: expiresAt.toISOString(),
        plan_type: cfg.plan_type,
        max_seats: cfg.max_seats,
        price_brl: cfg.value,
        asaas_customer_id: customerId,
        asaas_subscription_id: subscription.id,
        last_payment_status: "pending",
        next_charge_at: nextDueDate,
        notes: "Assinatura Asaas",
      });
    }

    return json(200, {
      subscription_id: subscription.id,
      customer_id: customerId,
      invoiceUrl,
      payment_id: firstPayment?.id ?? null,
    });
  } catch (e) {
    console.error("asaas-checkout error:", e);
    return json(500, { error: e instanceof Error ? e.message : "Unknown error" });
  }
});
