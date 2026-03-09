import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, AlertTriangle, Zap, ChevronDown, ChevronUp, Lightbulb, Target, Calendar } from "lucide-react";
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
  high: { label: "Estouro previsto", color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/20", badge: "destructive" as const },
  medium: { label: "Atenção", color: "text-warning", bg: "bg-warning/10", border: "border-warning/20", badge: "secondary" as const },
  low: { label: "Controlado", color: "text-success", bg: "bg-success/10", border: "border-success/20", badge: "secondary" as const },
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
  const progressDay = summary.daysInMonth > 0 ? (summary.dayOfMonth / summary.daysInMonth) * 100 : 0;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Alertas Preditivos de Orçamento
            {highRisk.length > 0 && (
              <Badge variant="destructive" className="text-[10px] h-4 px-1.5">
                {highRisk.length} em risco
              </Badge>
            )}
          </CardTitle>
          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {summary.daysLeft} dias restantes
          </div>
        </div>

        {/* Month progress bar */}
        <div className="mt-2">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>Dia {summary.dayOfMonth} de {summary.daysInMonth}</span>
            <span>Gasto: {formatBRL(summary.totalSpentSoFar)} → Projeção: {formatBRL(summary.projectedTotal)}</span>
          </div>
          <div className="relative h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="absolute h-full bg-primary/40 rounded-full"
              style={{ width: `${progressDay}%` }}
            />
            {/* Budget marker at 100% spending rate */}
            <div className="absolute h-full w-px bg-primary/60 right-0" />
          </div>
          {summary.upcomingRecurringTotal > 0 && (
            <p className="text-[10px] text-muted-foreground mt-1">
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
              pred.pctSpent >= 100 ? "bg-destructive"
              : pred.pctSpent >= 80 ? "bg-warning"
              : "bg-primary";
            const projectedWidth = Math.min(pred.pctProjected, 130);

            return (
              <motion.div
                key={pred.categoryId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-lg p-3 border ${risk.bg} ${risk.border}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: pred.categoryColor }}
                    />
                    <span className="text-xs font-semibold text-foreground">{pred.categoryName}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {pred.risk !== "low" && (
                      <AlertTriangle className={`h-3 w-3 ${risk.color}`} />
                    )}
                    <span className={`text-[10px] font-medium ${risk.color}`}>{risk.label}</span>
                  </div>
                </div>

                {/* Spending progress */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Gasto: {formatBRL(pred.spent)} / {formatBRL(pred.budget)}</span>
                    <span>{pred.pctSpent}%</span>
                  </div>
                  <div className="relative h-2 bg-muted rounded-full overflow-hidden">
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
                      Projeção fim do mês: <span className={pred.projectedOverrun > 0 ? "text-destructive font-medium" : "text-foreground"}>
                        {formatBRL(pred.projectedTotal)}
                      </span>
                    </span>
                    {pred.projectedOverrun > 0 && (
                      <span className="text-destructive font-medium">
                        +{formatBRL(pred.projectedOverrun)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Daily allowance & days until overrun */}
                <div className="flex gap-3 mt-2">
                  <div className="flex items-center gap-1">
                    <Target className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">
                      Limite diário: <span className="text-foreground font-medium">{formatBRL(pred.dailyAllowance)}</span>
                    </span>
                  </div>
                  {pred.daysUntilOverrun !== null && pred.daysUntilOverrun < summary.daysLeft && pred.daysUntilOverrun >= 0 && (
                    <div className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 text-destructive" />
                      <span className="text-[10px] text-destructive font-medium">
                        Estoura em {pred.daysUntilOverrun === 0 ? "hoje" : `${pred.daysUntilOverrun} dia${pred.daysUntilOverrun !== 1 ? "s" : ""}`}
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
            className="w-full flex items-center justify-center gap-1 text-[11px] text-muted-foreground hover:text-foreground py-1 transition-colors"
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
              className="w-full flex items-center gap-2 text-xs font-medium text-primary hover:text-primary/80 transition-colors py-1"
            >
              <Zap className="h-3.5 w-3.5" />
              Sugestões da IA para economizar
              {showSuggestions ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
            </button>
            <AnimatePresence>
              {showSuggestions && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="rounded-lg bg-primary/5 border border-primary/15 p-3 space-y-2 mt-1">
                    {aiSuggestions.map((s, i) => (
                      <div key={i} className="flex gap-2">
                        <Lightbulb className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                        <p className="text-[11px] text-foreground leading-relaxed">{s}</p>
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
