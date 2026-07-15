import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Sparkles, Loader2, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Anomaly {
  description: string;
  amount: number;
  average: number;
  ratio: number;
  category: string;
  date: string;
}

export function AnomalyDetection() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [aiExplanation, setAiExplanation] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.functions
      .invoke("ai-anomalies")
      .then(({ data, error }) => {
        if (!error && data) {
          setAnomalies(data.anomalies || []);
          setAiExplanation(data.aiExplanation || "");
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card space-y-3 p-5"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <h3 className="text-sm font-semibold text-foreground">Detecção de Anomalias IA</h3>
        </div>
        <div className="flex items-center justify-center gap-1.5 py-4">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">Analisando padrões...</span>
        </div>
      </motion.div>
    );
  }

  if (anomalies.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card space-y-3 p-5"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-success" />
          <h3 className="text-sm font-semibold text-foreground">Detecção de Anomalias IA</h3>
        </div>
        <div className="flex items-center gap-2 text-xs text-success">
          <TrendingUp className="h-3.5 w-3.5" />
          <span>Nenhum gasto incomum detectado. Tudo normal! ✅</span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card space-y-3 p-5"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-warning" />
        <h3 className="text-sm font-semibold text-foreground">Detecção de Anomalias IA</h3>
        <span className="ml-auto rounded-full bg-warning/15 px-2 py-0.5 text-[10px] text-warning">
          {anomalies.length} alerta(s)
        </span>
      </div>

      <div className="space-y-2">
        {anomalies.map((a, i) => (
          <div
            key={i}
            className="flex items-start gap-3 rounded-lg border border-warning/15 bg-warning/5 p-2.5"
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">{a.description}</p>
              <p className="text-[10px] text-muted-foreground">
                {a.category} · {new Date(a.date + "T12:00:00").toLocaleDateString("pt-BR")}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs font-bold text-warning">
                R$ {a.amount.toLocaleString("pt-BR")}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Média: R$ {a.average.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
              </p>
              <p className="text-[10px] font-medium text-destructive">{a.ratio}x acima</p>
            </div>
          </div>
        ))}
      </div>

      {/* AI Analysis */}
      {aiExplanation && (
        <div className="space-y-1.5 rounded-lg border border-primary/15 bg-primary/5 p-3">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-primary" />
            <span className="text-[11px] font-medium text-foreground">Análise da IA</span>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">{aiExplanation}</p>
        </div>
      )}
    </motion.div>
  );
}
