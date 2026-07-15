import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  AlertTriangle,
  Zap,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Target,
  Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface Prediction {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  budget: number;
  spent: number;
  remaining: number;
  pctSpent: number;
  projectedTotal: number;
  projectedOverrun: number;
  pctProjected: number;
  daysUntilOverrun: number | null;
  dailyAllowance: number;
  risk: "high" | "medium" | "low";
}

interface Summary {
  totalSpentSoFar: number;
  projectedTotal: number;
  dailyRate: number;
  daysLeft: number;
  dayOfMonth: number;
  daysInMonth: number;
  upcomingRecurringTotal: number;
  highRiskCount: number;
  mediumRiskCount: number;
}

const riskConfig = {
  high: {
    label: "Estouro previsto",
    color: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/20",
    badge: "destructive" as const,
  },
  medium: {
    label: "Atenção",
    color: "text-warning",
    bg: "bg-warning/10",
    border: "border-warning/20",
    badge: "secondary" as const,
  },
  low: {
    label: "Controlado",
    color: "text-success",
    bg: "bg-success/10",
    border: "border-success/20",
    badge: "secondary" as const,
  },
};

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function PredictiveAlerts() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);

  useEffect(() => {
    supabase.functions.invoke("predictive-alerts").then(({ data, error }) => {
      if (!error && data) {
        setPredictions(data.predictions || []);
        setSummary(data.summary || null);
        setAiSuggestions(data.aiSuggestions || []);
      }
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!summary || predictions.length === 0) return null;

  const visiblePredictions = expanded ? predictions : predictions.slice(0, 3);
  const highRisk = predictions.filter((p) => p.risk === "high");
  const progressDay =
    summary.daysInMonth > 0 ? (summary.dayOfMonth / summary.daysInMonth) * 100 : 0;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-primary" />
            Alertas Preditivos de Orçamento
            {highRisk.length > 0 && (
              <Badge variant="destructive" className="h-4 px-1.5 text-[10px]">
                {highRisk.length} em risco
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {summary.daysLeft} dias restantes
          </div>
        </div>

        {/* Month progress bar */}
        <div className="mt-2">
          <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
            <span>
              Dia {summary.dayOfMonth} de {summary.daysInMonth}
            </span>
            <span>
              Gasto: {formatBRL(summary.totalSpentSoFar)} → Projeção:{" "}
              {formatBRL(summary.projectedTotal)}
            </span>
          </div>
          <div className="relative h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="absolute h-full rounded-full bg-primary/40"
              style={{ width: `${progressDay}%` }}
            />
            {/* Budget marker at 100% spending rate */}
            <div className="absolute right-0 h-full w-px bg-primary/60" />
          </div>
          {summary.upcomingRecurringTotal > 0 && (
            <p className="mt-1 text-[10px] text-muted-foreground">
              + {formatBRL(summary.upcomingRecurringTotal)} em recorrentes previstos
            </p>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <AnimatePresence>
          {visiblePredictions.map((pred) => {
            const risk = riskConfig[pred.risk];
            const progressColor =
              pred.pctSpent >= 100
                ? "bg-destructive"
                : pred.pctSpent >= 80
                  ? "bg-warning"
                  : "bg-primary";
            const projectedWidth = Math.min(pred.pctProjected, 130);

            return (
              <motion.div
                key={pred.categoryId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-lg border p-3 ${risk.bg} ${risk.border}`}
              >
                <div className="mb-2 flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: pred.categoryColor }}
                    />
                    <span className="text-xs font-semibold text-foreground">
                      {pred.categoryName}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {pred.risk !== "low" && <AlertTriangle className={`h-3 w-3 ${risk.color}`} />}
                    <span className={`text-[10px] font-medium ${risk.color}`}>{risk.label}</span>
                  </div>
                </div>

                {/* Spending progress */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>
                      Gasto: {formatBRL(pred.spent)} / {formatBRL(pred.budget)}
                    </span>
                    <span>{pred.pctSpent}%</span>
                  </div>
                  <div className="relative h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all ${progressColor}`}
                      style={{ width: `${Math.min(pred.pctSpent, 100)}%` }}
                    />
                    {/* Projected marker */}
                    {pred.pctProjected > pred.pctSpent && (
                      <div
                        className="absolute top-0 h-full border-r-2 border-dashed border-destructive/60"
                        style={{ width: `${Math.min(projectedWidth, 100)}%` }}
                      />
                    )}
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">
                      Projeção fim do mês:{" "}
                      <span
                        className={
                          pred.projectedOverrun > 0
                            ? "font-medium text-destructive"
                            : "text-foreground"
                        }
                      >
                        {formatBRL(pred.projectedTotal)}
                      </span>
                    </span>
                    {pred.projectedOverrun > 0 && (
                      <span className="font-medium text-destructive">
                        +{formatBRL(pred.projectedOverrun)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Daily allowance & days until overrun */}
                <div className="mt-2 flex gap-3">
                  <div className="flex items-center gap-1">
                    <Target className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">
                      Limite diário:{" "}
                      <span className="font-medium text-foreground">
                        {formatBRL(pred.dailyAllowance)}
                      </span>
                    </span>
                  </div>
                  {pred.daysUntilOverrun !== null &&
                    pred.daysUntilOverrun < summary.daysLeft &&
                    pred.daysUntilOverrun >= 0 && (
                      <div className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 text-destructive" />
                        <span className="text-[10px] font-medium text-destructive">
                          Estoura em{" "}
                          {pred.daysUntilOverrun === 0
                            ? "hoje"
                            : `${pred.daysUntilOverrun} dia${pred.daysUntilOverrun !== 1 ? "s" : ""}`}
                        </span>
                      </div>
                    )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {predictions.length > 3 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex w-full items-center justify-center gap-1 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? "Mostrar menos" : `Ver mais ${predictions.length - 3} categorias`}
          </button>
        )}

        {/* AI Suggestions */}
        {aiSuggestions.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-1">
            <button
              onClick={() => setShowSuggestions((v) => !v)}
              className="flex w-full items-center gap-2 py-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
            >
              <Zap className="h-3.5 w-3.5" />
              Sugestões da IA para economizar
              {showSuggestions ? (
                <ChevronUp className="ml-auto h-3 w-3" />
              ) : (
                <ChevronDown className="ml-auto h-3 w-3" />
              )}
            </button>
            <AnimatePresence>
              {showSuggestions && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-1 space-y-2 rounded-lg border border-primary/15 bg-primary/5 p-3">
                    {aiSuggestions.map((s, i) => (
                      <div key={i} className="flex gap-2">
                        <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                        <p className="text-[11px] leading-relaxed text-foreground">{s}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
