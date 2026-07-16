// Detecção avançada de anomalias financeiras + assinaturas fantasma
// - Gastos anormais (transação atípica vs média histórica da categoria/descrição)
// - Aumento de preço em recorrentes (Netflix subiu R$X)
// - Sobreposição de assinaturas (múltiplos streamings/músicas)
// - Taxas fantasma (tarifas bancárias que reaparecem)
// Persiste em ai_insights e retorna estrutura para o frontend.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

// Normalização para agrupar "IFOOD*123" e "IFOOD DELIVERY" como o mesmo merchant
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

// Palavras que indicam streaming/assinatura de mídia
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    // Últimos 180 dias de despesas pagas
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

    // ================= 1) GASTOS ANORMAIS =================
    // Agrupa por descrição normalizada e mede desvio da média
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
      const avg = totalHistoric / amounts.length;

      // Soma últimos 7 dias vs média semanal histórica
      const recent = txs.filter((t) => now - new Date(t.date).getTime() <= sevenDays);
      if (recent.length === 0) continue;
      const recentSum = recent.reduce((a, t) => a + Number(t.amount), 0);

      const weeklyAvg = (totalHistoric / 180) * 7; // média semanal nos 6 meses
      if (weeklyAvg < 20) continue; // ignora ruído
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

    // ================= 2) AUMENTO EM RECORRENTES =================
    // Compara amount atual do recurring com histórico das transações que fazem match
    const priceIncreases: any[] = [];
    for (const rec of recurrings) {
      const key = normalize(rec.description);
      if (!key) continue;
      const matches = (byMerchant.get(key) || []).filter(
        (t) => Math.abs(new Date(t.date).getTime() - now) > 5 * 24 * 3600 * 1000, // exclui últimos 5 dias
      );
      if (matches.length < 2) continue;

      // Amount histórico mediano (usa mediana pra resistir a outliers)
      const historic = matches.map((t) => Number(t.amount)).sort((a, b) => a - b);
      const median = historic[Math.floor(historic.length / 2)];
      const current = Number(rec.amount);
      if (median <= 0) continue;
      const delta = current - median;
      const pct = (delta / median) * 100;

      if (Math.abs(delta) >= 3 && Math.abs(pct) >= 8) {
        priceIncreases.push({
          description: rec.description,
          category: catMap.get(rec.category_id || "") || "Sem categoria",
          oldPrice: Math.round(median * 100) / 100,
          newPrice: Math.round(current * 100) / 100,
          delta: Math.round(delta * 100) / 100,
          pct: Math.round(pct * 10) / 10,
          direction: delta > 0 ? "up" : "down",
        });
      }
    }
    priceIncreases.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));

    // ================= 3) ASSINATURAS SOBREPOSTAS (STREAMING) =================
    const streamingGroups = new Map<string, { name: string; amount: number; source: string }[]>();

    // considera recorrentes ativos + itens únicos detectados nas transações do último mês
    const consider: { description: string; amount: number; source: string }[] = [
      ...recurrings.map((r) => ({
        description: r.description,
        amount: Number(r.amount),
        source: "recurring" as const,
      })),
    ];

    // adiciona também assinaturas identificadas em transações não vinculadas a recurring
    const lastMonth = now - 35 * 24 * 3600 * 1000;
    const seenMerchant = new Set<string>();
    for (const tx of transactions) {
      if (new Date(tx.date).getTime() < lastMonth) continue;
      const svc = classifyStreaming(tx.description);
      if (!svc) continue;
      const key = normalize(tx.description);
      if (seenMerchant.has(key)) continue;
      seenMerchant.add(key);
      consider.push({
        description: tx.description,
        amount: Number(tx.amount),
        source: "transaction",
      });
    }

    for (const item of consider) {
      const svc = classifyStreaming(item.description);
      if (!svc) continue;
      if (!streamingGroups.has("streaming")) streamingGroups.set("streaming", []);
      // dedup por nome de serviço
      const arr = streamingGroups.get("streaming")!;
      if (arr.find((x) => x.name === svc)) continue;
      arr.push({ name: svc, amount: item.amount, source: item.source });
    }

    const overlappingSubs: any[] = [];
    for (const [group, items] of streamingGroups.entries()) {
      if (items.length >= 3) {
        const total = items.reduce((a, b) => a + b.amount, 0);
        overlappingSubs.push({
          group,
          count: items.length,
          services: items,
          monthlyTotal: Math.round(total * 100) / 100,
        });
      }
    }

    // ================= 4) TAXAS FANTASMA =================
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
        lastDate: txs[0].date,
      });
    }
    phantomFees.sort((a, b) => b.totalPaid - a.totalPaid);

    // ================= 5) GERA MENSAGENS + PERSISTE EM ai_insights =================
    const insightsToInsert: {
      user_id: string;
      type: string;
      title: string;
      description: string;
    }[] = [];

    for (const a of spendingAnomalies.slice(0, 5)) {
      insightsToInsert.push({
        user_id: userId,
        type: "warning",
        title: `Gasto ${a.ratio}x acima da média em "${a.sample}"`,
        description: `Nos últimos 7 dias você gastou ${brl(a.recentSum)} em ${a.category} com "${a.sample}" (${a.count} transações). Sua média semanal histórica é ${brl(a.weeklyAvg)}.`,
      });
    }

    for (const p of priceIncreases.slice(0, 5)) {
      const verb = p.direction === "up" ? "subiu" : "caiu";
      insightsToInsert.push({
        user_id: userId,
        type: p.direction === "up" ? "warning" : "success",
        title: `${p.description} ${verb} ${brl(Math.abs(p.delta))}`,
        description: `De ${brl(p.oldPrice)} para ${brl(p.newPrice)} (${p.pct > 0 ? "+" : ""}${p.pct}%). Categoria: ${p.category}.`,
      });
    }

    for (const s of overlappingSubs) {
      const list = s.services.map((x: any) => x.name).join(", ");
      insightsToInsert.push({
        user_id: userId,
        type: "warning",
        title: `Você tem ${s.count} assinaturas de streaming ativas`,
        description: `Total mensal: ${brl(s.monthlyTotal)}. Serviços: ${list}. Considere revisar qual usa menos e cancelar.`,
      });
    }

    for (const f of phantomFees.slice(0, 5)) {
      insightsToInsert.push({
        user_id: userId,
        type: "destructive",
        title: `Taxa recorrente: "${f.description}"`,
        description: `Apareceu ${f.occurrences}x em ${f.monthsSpanned} meses — total pago ${brl(f.totalPaid)} (média ${brl(f.avgAmount)}/cobrança). Vale contestar com o banco.`,
      });
    }

    // Dedup contra insights criados nas últimas 72h
    if (insightsToInsert.length > 0) {
      const cutoff = new Date(Date.now() - 72 * 3600 * 1000).toISOString();
      const { data: existing } = await supabase
        .from("ai_insights")
        .select("title")
        .eq("user_id", userId)
        .gte("created_at", cutoff);
      const existingTitles = new Set((existing || []).map((r: any) => r.title));
      const fresh = insightsToInsert.filter((i) => !existingTitles.has(i.title));
      if (fresh.length > 0) {
        await supabase.from("ai_insights").insert(fresh);
      }
    }

    // ================= 6) NARRATIVA IA (opcional) =================
    let aiNarrative = "";
    const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
    const totalFindings =
      spendingAnomalies.length +
      priceIncreases.length +
      overlappingSubs.length +
      phantomFees.length;

    if (DEEPSEEK_API_KEY && totalFindings > 0) {
      try {
        const summary = [
          spendingAnomalies.length
            ? `${spendingAnomalies.length} gastos anormais`
            : "",
          priceIncreases.length
            ? `${priceIncreases.length} mudanças de preço em assinaturas`
            : "",
          overlappingSubs.length
            ? `${overlappingSubs[0].count} streamings sobrepostos`
            : "",
          phantomFees.length ? `${phantomFees.length} taxas recorrentes suspeitas` : "",
        ]
          .filter(Boolean)
          .join(", ");

        const detail = [
          ...spendingAnomalies.slice(0, 3).map(
            (a) =>
              `Gasto ${a.ratio}x acima em "${a.sample}" (${brl(a.recentSum)} vs ${brl(a.weeklyAvg)} média semanal)`,
          ),
          ...priceIncreases.slice(0, 3).map(
            (p) =>
              `"${p.description}" ${p.direction === "up" ? "subiu" : "caiu"} de ${brl(p.oldPrice)} para ${brl(p.newPrice)} (${p.pct}%)`,
          ),
          ...overlappingSubs.map(
            (s) =>
              `${s.count} streamings ativos: ${s.services.map((x: any) => x.name).join(", ")} = ${brl(s.monthlyTotal)}/mês`,
          ),
          ...phantomFees.slice(0, 3).map(
            (f) => `Taxa "${f.description}" apareceu ${f.occurrences}x, total ${brl(f.totalPaid)}`,
          ),
        ].join("\n- ");

        const prompt = `Você é um consultor financeiro brasileiro direto e prático. O usuário tem: ${summary}.

Detalhes:
- ${detail}

Escreva um parágrafo curto (máx 4 frases) em português destacando o que é mais urgente resolver e uma ação prática. Sem saudações, sem markdown, sem emojis excessivos.`;

        const aiResp = await fetch("https://api.deepseek.com/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.4,
            max_tokens: 300,
          }),
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          aiNarrative = aiData.choices?.[0]?.message?.content?.trim() || "";
        }
      } catch (e) {
        console.error("AI narrative error:", e);
      }
    }

    return new Response(
      JSON.stringify({
        totalFindings,
        spendingAnomalies: spendingAnomalies.slice(0, 5),
        priceIncreases: priceIncreases.slice(0, 5),
        overlappingSubs,
        phantomFees: phantomFees.slice(0, 5),
        aiNarrative,
        insightsCreated: insightsToInsert.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("detect-financial-anomalies error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
