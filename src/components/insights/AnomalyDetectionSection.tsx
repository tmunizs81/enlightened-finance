import { useState } from "react";
import { motion } from "framer-motion";
import {
  ShieldAlert,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Loader2,
  Radar,
  Tv,
  Receipt,
  AlertOctagon,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface SpendingAnomaly {
  merchant: string;
  sample: string;
  category: string;
  recentSum: number;
  weeklyAvg: number;
  ratio: number;
  count: number;
}
interface PriceChange {
  description: string;
  category: string;
  oldPrice: number;
  newPrice: number;
  delta: number;
  pct: number;
  direction: "up" | "down";
}
interface OverlappingSub {
  group: string;
  count: number;
  services: { name: string; amount: number; source: string }[];
  monthlyTotal: number;
}
interface PhantomFee {
  description: string;
  occurrences: number;
  monthsSpanned: number;
  totalPaid: number;
  avgAmount: number;
  lastDate: string;
}

interface AnomalyResult {
  totalFindings: number;
  spendingAnomalies: SpendingAnomaly[];
  priceIncreases: PriceChange[];
  overlappingSubs: OverlappingSub[];
  phantomFees: PhantomFee[];
  aiNarrative: string;
  insightsCreated: number;
}

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function AnomalyDetectionSection() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AnomalyResult | null>(null);
  const qc = useQueryClient();

  const run = async () => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/detect-financial-anomalies`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({}),
        },
      );
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erro" }));
        throw new Error(err.error || `Erro ${resp.status}`);
      }
      const json: AnomalyResult = await resp.json();
      setData(json);
      qc.invalidateQueries({ queryKey: ["ai_insights"] });
      if (json.totalFindings === 0) {
        toast.success("Nenhuma anomalia detectada. Suas finanças estão saudáveis!");
      } else {
        toast.success(
          `${json.totalFindings} alerta(s) encontrado(s) · ${json.insightsCreated} novo(s) insight(s)`,
        );
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao analisar anomalias");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card space-y-4 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radar className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">
            Detector de Anomalias e Assinaturas Fantasma
          </h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={run}
          disabled={loading}
          className="gap-1.5 border-border text-xs text-muted-foreground hover:text-primary"
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Sparkles className="h-3 w-3" />
          )}
          {loading ? "Analisando..." : "Executar Análise"}
        </Button>
      </div>

      {!data && !loading && (
        <p className="py-4 text-center text-xs text-muted-foreground">
          Analisa 180 dias de histórico para encontrar gastos anormais, aumentos em
          assinaturas, streamings sobrepostos e taxas bancárias recorrentes.
        </p>
      )}

      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-xs text-muted-foreground">
            Cruzando padrões e chamando IA...
          </span>
        </div>
      )}

      {data && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {data.totalFindings === 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 p-4 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" />
              Nenhuma anomalia detectada nos últimos 180 dias.
            </div>
          )}

          {data.aiNarrative && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
                <Sparkles className="h-3 w-3" /> Análise da IA
              </div>
              <p className="text-sm leading-relaxed text-foreground">
                {data.aiNarrative}
              </p>
            </div>
          )}

          {/* Spending anomalies */}
          {data.spendingAnomalies.length > 0 && (
            <Section
              icon={<ShieldAlert className="h-4 w-4 text-warning" />}
              title="Gastos anormais (últimos 7 dias)"
            >
              {data.spendingAnomalies.map((a, i) => (
                <Row
                  key={i}
                  left={
                    <>
                      <div className="text-sm font-medium">{a.sample}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {a.category} · {a.count} transaç
                        {a.count > 1 ? "ões" : "ão"}
                      </div>
                    </>
                  }
                  right={
                    <>
                      <div className="text-sm font-semibold text-warning">
                        {brl(a.recentSum)}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {a.ratio}x acima da média ({brl(a.weeklyAvg)}/sem)
                      </div>
                    </>
                  }
                />
              ))}
            </Section>
          )}

          {/* Price changes */}
          {data.priceIncreases.length > 0 && (
            <Section
              icon={<TrendingUp className="h-4 w-4 text-warning" />}
              title="Mudanças de preço em assinaturas"
            >
              {data.priceIncreases.map((p, i) => (
                <Row
                  key={i}
                  left={
                    <>
                      <div className="text-sm font-medium">{p.description}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {p.category}
                      </div>
                    </>
                  }
                  right={
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground line-through">
                        {brl(p.oldPrice)}
                      </span>
                      <span className="text-sm font-semibold">{brl(p.newPrice)}</span>
                      <span
                        className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                          p.direction === "up"
                            ? "bg-warning/15 text-warning"
                            : "bg-success/15 text-success"
                        }`}
                      >
                        {p.direction === "up" ? (
                          <TrendingUp className="h-2.5 w-2.5" />
                        ) : (
                          <TrendingDown className="h-2.5 w-2.5" />
                        )}
                        {p.pct > 0 ? "+" : ""}
                        {p.pct}%
                      </span>
                    </div>
                  }
                />
              ))}
            </Section>
          )}

          {/* Overlapping subscriptions */}
          {data.overlappingSubs.length > 0 && (
            <Section
              icon={<Tv className="h-4 w-4 text-warning" />}
              title="Assinaturas sobrepostas"
            >
              {data.overlappingSubs.map((s, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border/50 bg-secondary/40 p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-medium">
                      {s.count} streamings ativos
                    </div>
                    <div className="text-sm font-semibold text-warning">
                      {brl(s.monthlyTotal)}/mês
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {s.services.map((svc, j) => (
                      <span
                        key={j}
                        className="rounded-full border border-border bg-background/50 px-2 py-0.5 text-[11px] capitalize"
                      >
                        {svc.name} · {brl(svc.amount)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </Section>
          )}

          {/* Phantom fees */}
          {data.phantomFees.length > 0 && (
            <Section
              icon={<Receipt className="h-4 w-4 text-destructive" />}
              title="Taxas recorrentes suspeitas"
            >
              {data.phantomFees.map((f, i) => (
                <Row
                  key={i}
                  left={
                    <>
                      <div className="text-sm font-medium">{f.description}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {f.occurrences}x em {f.monthsSpanned} meses · média{" "}
                        {brl(f.avgAmount)}
                      </div>
                    </>
                  }
                  right={
                    <>
                      <div className="text-sm font-semibold text-destructive">
                        {brl(f.totalPaid)}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        total pago
                      </div>
                    </>
                  }
                />
              ))}
            </Section>
          )}

          {data.insightsCreated > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-secondary/40 p-2 text-[11px] text-muted-foreground">
              <AlertOctagon className="h-3 w-3" />
              {data.insightsCreated} alerta(s) salvos na Central de Notificações.
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon} {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-secondary/40 p-3">
      <div className="min-w-0 flex-1">{left}</div>
      <div className="flex-shrink-0 text-right">{right}</div>
    </div>
  );
}
