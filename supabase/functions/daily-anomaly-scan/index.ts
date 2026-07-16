// Cron diário: varre todos os usuários com Telegram configurado,
// roda a detecção de anomalias financeiras e envia alerta no Telegram
// se houver achados relevantes.
//
// Deve ser chamado por pg_cron uma vez por dia.
// Autenticação: usa SUPABASE_SERVICE_ROLE_KEY (função opera como service role).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Tx = {
  id: string;
  description: string;
  amount: number | string;
  date: string;
  category_id: string | null;
  type: string;
  status: string;
};

type Recurring = {
  id: string;
  description: string;
  amount: number | string;
  active: boolean;
  category_id: string | null;
};

function normalize(desc: string): string {
  return (desc || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\b(pag|pagamento|compra|debito|credito|cartao|pix|ted|doc|parc\d*|\d{2,})\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 3)
    .join(" ");
}

const STREAMING_KEYWORDS = [
  "netflix", "spotify", "prime", "disney", "hbo", "max ", "globoplay",
  "youtube", "deezer", "apple music", "apple tv", "paramount", "star+",
  "star plus", "crunchyroll", "tidal",
];

const BANK_FEE_KEYWORDS = [
  "tarifa", "taxa", "anuidade", "mensalidade", "iof", "juros", "manutencao",
  "cesta", "pacote de servicos",
];

function classifyStreaming(desc: string): string | null {
  const d = desc.toLowerCase();
  for (const kw of STREAMING_KEYWORDS) {
    if (d.includes(kw)) return kw.trim();
  }
  return null;
}

function isBankFee(desc: string): boolean {
  const d = desc.toLowerCase();
  return BANK_FEE_KEYWORDS.some((k) => d.includes(k));
}

function brl(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function analyzeUser(supabase: any, userId: string) {
  const sinceIso = new Date(Date.now() - 180 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const [txRes, recRes, catRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, description, amount, date, category_id, type, status")
      .eq("user_id", userId)
      .eq("type", "expense")
      .eq("status", "paid")
      .gte("date", sinceIso)
      .order("date", { ascending: false })
      .limit(1000),
    supabase
      .from("recurring_transactions")
      .select("id, description, amount, active, category_id")
      .eq("user_id", userId)
      .eq("type", "expense")
      .eq("active", true),
    supabase.from("categories").select("id, name").eq("user_id", userId),
  ]);

  const transactions: Tx[] = (txRes.data as Tx[]) || [];
  const recurrings: Recurring[] = (recRes.data as Recurring[]) || [];
  const catMap = new Map<string, string>(
    (catRes.data || []).map((c: any) => [c.id, c.name as string]),
  );

  const byMerchant = new Map<string, Tx[]>();
  for (const tx of transactions) {
    const key = normalize(tx.description);
    if (!key) continue;
    if (!byMerchant.has(key)) byMerchant.set(key, []);
    byMerchant.get(key)!.push(tx);
  }

  const spendingAnomalies: any[] = [];
  const now = Date.now();
  const sevenDays = 7 * 24 * 3600 * 1000;

  for (const [merchant, txs] of byMerchant.entries()) {
    if (txs.length < 4) continue;
    const amounts = txs.map((t) => Number(t.amount));
    const totalHistoric = amounts.reduce((a, b) => a + b, 0);
    const recent = txs.filter((t) => now - new Date(t.date).getTime() <= sevenDays);
    if (recent.length === 0) continue;
    const recentSum = recent.reduce((a, t) => a + Number(t.amount), 0);
    const weeklyAvg = (totalHistoric / 180) * 7;
    if (weeklyAvg < 20) continue;
    const ratio = recentSum / weeklyAvg;
    if (ratio >= 2.5) {
      spendingAnomalies.push({
        merchant,
        sample: recent[0].description,
        category: catMap.get(recent[0].category_id || "") || "Sem categoria",
        recentSum: Math.round(recentSum * 100) / 100,
        weeklyAvg: Math.round(weeklyAvg * 100) / 100,
        ratio: Math.round(ratio * 10) / 10,
        count: recent.length,
      });
    }
  }
  spendingAnomalies.sort((a, b) => b.ratio - a.ratio);

  const priceIncreases: any[] = [];
  for (const rec of recurrings) {
    const key = normalize(rec.description);
    if (!key) continue;
    const matches = (byMerchant.get(key) || []).filter(
      (t) => Math.abs(new Date(t.date).getTime() - now) > 5 * 24 * 3600 * 1000,
    );
    if (matches.length < 2) continue;
    const historic = matches.map((t) => Number(t.amount)).sort((a, b) => a - b);
    const median = historic[Math.floor(historic.length / 2)];
    const current = Number(rec.amount);
    if (median <= 0) continue;
    const delta = current - median;
    const pct = (delta / median) * 100;
    if (Math.abs(delta) >= 3 && Math.abs(pct) >= 8) {
      priceIncreases.push({
        description: rec.description,
        oldPrice: Math.round(median * 100) / 100,
        newPrice: Math.round(current * 100) / 100,
        delta: Math.round(delta * 100) / 100,
        pct: Math.round(pct * 10) / 10,
        direction: delta > 0 ? "up" : "down",
      });
    }
  }
  priceIncreases.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));

  const streamingGroups = new Map<string, { name: string; amount: number }[]>();
  const consider: { description: string; amount: number }[] = recurrings.map((r) => ({
    description: r.description,
    amount: Number(r.amount),
  }));
  const lastMonth = now - 35 * 24 * 3600 * 1000;
  const seenMerchant = new Set<string>();
  for (const tx of transactions) {
    if (new Date(tx.date).getTime() < lastMonth) continue;
    if (!classifyStreaming(tx.description)) continue;
    const key = normalize(tx.description);
    if (seenMerchant.has(key)) continue;
    seenMerchant.add(key);
    consider.push({ description: tx.description, amount: Number(tx.amount) });
  }
  for (const item of consider) {
    const svc = classifyStreaming(item.description);
    if (!svc) continue;
    if (!streamingGroups.has("streaming")) streamingGroups.set("streaming", []);
    const arr = streamingGroups.get("streaming")!;
    if (arr.find((x) => x.name === svc)) continue;
    arr.push({ name: svc, amount: item.amount });
  }
  const overlappingSubs: any[] = [];
  for (const [_, items] of streamingGroups.entries()) {
    if (items.length >= 3) {
      const total = items.reduce((a, b) => a + b.amount, 0);
      overlappingSubs.push({
        count: items.length,
        services: items,
        monthlyTotal: Math.round(total * 100) / 100,
      });
    }
  }

  const feeGroups = new Map<string, Tx[]>();
  for (const tx of transactions) {
    if (!isBankFee(tx.description)) continue;
    const key = normalize(tx.description);
    if (!feeGroups.has(key)) feeGroups.set(key, []);
    feeGroups.get(key)!.push(tx);
  }
  const phantomFees: any[] = [];
  for (const [_, txs] of feeGroups.entries()) {
    if (txs.length < 2) continue;
    const total = txs.reduce((a, t) => a + Number(t.amount), 0);
    const monthsSpanned = new Set(txs.map((t) => t.date.slice(0, 7))).size;
    if (monthsSpanned < 2) continue;
    phantomFees.push({
      description: txs[0].description,
      occurrences: txs.length,
      monthsSpanned,
      totalPaid: Math.round(total * 100) / 100,
      avgAmount: Math.round((total / txs.length) * 100) / 100,
    });
  }
  phantomFees.sort((a, b) => b.totalPaid - a.totalPaid);

  return { spendingAnomalies, priceIncreases, overlappingSubs, phantomFees };
}

function buildTelegramMessage(r: {
  spendingAnomalies: any[];
  priceIncreases: any[];
  overlappingSubs: any[];
  phantomFees: any[];
}): string | null {
  const lines: string[] = [];
  lines.push("🚨 <b>SimplyFin — Alerta Diário de Anomalias</b>\n");

  if (r.spendingAnomalies.length) {
    lines.push("💸 <b>Gastos anormais (últimos 7 dias):</b>");
    for (const a of r.spendingAnomalies.slice(0, 3)) {
      lines.push(`• <b>${a.sample}</b>: ${brl(a.recentSum)} (${a.ratio}x acima da média)`);
    }
    lines.push("");
  }
  if (r.priceIncreases.length) {
    lines.push("📈 <b>Mudanças em assinaturas:</b>");
    for (const p of r.priceIncreases.slice(0, 3)) {
      const arrow = p.direction === "up" ? "🔺" : "🔻";
      lines.push(`${arrow} <b>${p.description}</b>: ${brl(p.oldPrice)} → ${brl(p.newPrice)} (${p.pct > 0 ? "+" : ""}${p.pct}%)`);
    }
    lines.push("");
  }
  if (r.overlappingSubs.length) {
    for (const s of r.overlappingSubs) {
      lines.push(`📺 <b>${s.count} streamings ativos</b> = ${brl(s.monthlyTotal)}/mês`);
      lines.push(`Serviços: ${s.services.map((x: any) => x.name).join(", ")}`);
      lines.push("Considere cancelar o menos usado.");
      lines.push("");
    }
  }
  if (r.phantomFees.length) {
    lines.push("👻 <b>Taxas fantasma detectadas:</b>");
    for (const f of r.phantomFees.slice(0, 3)) {
      lines.push(`• <b>${f.description}</b>: ${f.occurrences}x em ${f.monthsSpanned} meses = ${brl(f.totalPaid)}`);
    }
    lines.push("");
  }

  const total =
    r.spendingAnomalies.length +
    r.priceIncreases.length +
    r.overlappingSubs.length +
    r.phantomFees.length;
  if (total === 0) return null;

  lines.push("👉 Abra o app para ver detalhes e agir.");
  return lines.join("\n");
}

async function sendTelegram(botToken: string, chatId: string, text: string) {
  const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  if (!resp.ok) {
    console.error("Telegram send failed:", resp.status, await resp.text());
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("user_id, telegram_bot_token, telegram_chat_id, display_name")
      .not("telegram_bot_token", "is", null)
      .not("telegram_chat_id", "is", null);

    if (error) throw error;

    let processed = 0;
    let alerted = 0;
    const errors: any[] = [];

    for (const p of profiles || []) {
      processed++;
      try {
        const result = await analyzeUser(supabase, p.user_id);
        const msg = buildTelegramMessage(result);
        if (!msg) continue;

        // dedup: não envia se já mandou hoje
        const today = new Date().toISOString().slice(0, 10);
        const { data: sentToday } = await supabase
          .from("ai_insights")
          .select("id")
          .eq("user_id", p.user_id)
          .eq("type", "warning")
          .ilike("title", "Alerta diário Telegram%")
          .gte("created_at", `${today}T00:00:00Z`)
          .limit(1);

        if (sentToday && sentToday.length > 0) continue;

        await sendTelegram(p.telegram_bot_token, p.telegram_chat_id, msg);

        await supabase.from("ai_insights").insert({
          user_id: p.user_id,
          type: "warning",
          title: `Alerta diário Telegram ${today}`,
          description: `Enviado alerta de anomalias via Telegram.`,
        });

        alerted++;
      } catch (e) {
        console.error(`Erro no usuário ${p.user_id}:`, e);
        errors.push({ user_id: p.user_id, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return new Response(
      JSON.stringify({ processed, alerted, errors: errors.length, details: errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("daily-anomaly-scan fatal:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
