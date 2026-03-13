import { useState } from "react";
import { motion } from "framer-motion";
import { Brain, Sparkles, TrendingUp, AlertTriangle, CheckCircle, Target, RefreshCw, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface GoalRecommendation {
  goal_name: string;
  status: "on_track" | "needs_attention" | "behind" | "completed";
  suggested_monthly: number;
  tip: string;
  priority: number;
}

interface GoalAnalysis {
  summary: string;
  overall_status: "excellent" | "good" | "attention" | "critical";
  recommendations: GoalRecommendation[];
  savings_plan: string;
}

const statusConfig = {
  on_track: { icon: CheckCircle, label: "No caminho", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  needs_attention: { icon: AlertTriangle, label: "Atenção", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  behind: { icon: AlertTriangle, label: "Atrasada", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
  completed: { icon: CheckCircle, label: "Concluída", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
};

const overallConfig = {
  excellent: { color: "from-emerald-500/20 to-emerald-600/5", icon: "🏆", label: "Excelente" },
  good: { color: "from-primary/20 to-primary/5", icon: "✅", label: "Bom" },
  attention: { color: "from-amber-500/20 to-amber-600/5", icon: "⚠️", label: "Atenção" },
  critical: { color: "from-red-500/20 to-red-600/5", icon: "🚨", label: "Crítico" },
};

export function GoalAIMonitor() {
  const [analysis, setAnalysis] = useState<GoalAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("goal-monitor");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAnalysis(data);
      setHasLoaded(true);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erro ao analisar metas");
    } finally {
      setLoading(false);
    }
  };

  if (!hasLoaded) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Coach IA de Metas</h3>
          </div>
          <Button onClick={runAnalysis} disabled={loading} size="sm" className="gradient-bg-primary text-primary-foreground gap-2">
            {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {loading ? "Analisando..." : "Analisar Metas"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Clique para receber recomendações personalizadas da IA sobre suas metas financeiras.</p>
      </motion.div>
    );
  }

  if (!analysis) return null;

  const overall = overallConfig[analysis.overall_status] || overallConfig.attention;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {/* Summary Card */}
      <div className={`glass-card p-5 bg-gradient-to-br ${overall.color}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Coach IA de Metas</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{overall.icon} {overall.label}</span>
          </div>
          <Button onClick={runAnalysis} disabled={loading} size="sm" variant="ghost" className="text-muted-foreground h-7 gap-1">
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            <span className="text-xs">Atualizar</span>
          </Button>
        </div>
        <p className="text-xs text-foreground/80 leading-relaxed">{analysis.summary}</p>
      </div>

      {/* Recommendations per goal */}
      {analysis.recommendations.sort((a, b) => a.priority - b.priority).map((rec, i) => {
        const config = statusConfig[rec.status] || statusConfig.needs_attention;
        const StatusIcon = config.icon;
        return (
          <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} className={`glass-card p-4 border ${config.bg}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <StatusIcon className={`h-4 w-4 ${config.color}`} />
                  <span className="text-sm font-medium text-foreground">{rec.goal_name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${config.bg} ${config.color}`}>{config.label}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed flex items-start gap-1.5">
                  <Lightbulb className="h-3 w-3 mt-0.5 shrink-0 text-amber-400" />
                  {rec.tip}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] text-muted-foreground">Aporte sugerido</p>
                <p className="text-sm font-bold text-primary">R$ {rec.suggested_monthly.toLocaleString("pt-BR")}<span className="text-[10px] font-normal text-muted-foreground">/mês</span></p>
              </div>
            </div>
          </motion.div>
        );
      })}

      {/* Savings Plan */}
      {analysis.savings_plan && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="glass-card p-4 border border-primary/20 bg-primary/5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-foreground">Plano de Economia</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{analysis.savings_plan}</p>
        </motion.div>
      )}
    </motion.div>
  );
}
