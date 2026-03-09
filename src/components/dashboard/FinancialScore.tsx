import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Target, PiggyBank, Shield, Lightbulb, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ScoreData {
  score: number;
  label: string;
  breakdown: {
    savings: { score: number; max: number; rate: number };
    goals: { score: number; max: number; progress: number };
    budget: { score: number; max: number };
    health: { score: number; max: number };
  };
  tips: string[];
  monthIncome?: number;
  monthExpense?: number;
}

export function FinancialScore() {
  const [data, setData] = useState<ScoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiExplanation, setAiExplanation] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    supabase.functions.invoke("financial-score").then(({ data: d, error }) => {
      if (!error && d) {
        setData(d);
        // Fetch AI explanation
        setAiLoading(true);
        supabase.functions.invoke("ai-score-explain", { body: { scoreData: d } }).then(({ data: aiD }) => {
          if (aiD?.explanation) setAiExplanation(aiD.explanation);
          setAiLoading(false);
        }).catch(() => setAiLoading(false));
      }
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="glass-card p-6 animate-pulse">
        <div className="h-4 w-32 bg-muted rounded mb-4" />
        <div className="h-24 w-24 rounded-full bg-muted mx-auto" />
      </div>
    );
  }

  if (!data) return null;

  const scoreColor = data.score >= 80 ? "text-success" : data.score >= 60 ? "text-primary" : data.score >= 40 ? "text-warning" : "text-destructive";
  const ringColor = data.score >= 80 ? "stroke-success" : data.score >= 60 ? "stroke-primary" : data.score >= 40 ? "stroke-warning" : "stroke-destructive";
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (data.score / 100) * circumference;

  const breakdownItems = [
    { icon: PiggyBank, label: "Economia", score: data.breakdown.savings.score, max: data.breakdown.savings.max, detail: `${data.breakdown.savings.rate}% da renda` },
    { icon: Target, label: "Metas", score: data.breakdown.goals.score, max: data.breakdown.goals.max, detail: `${data.breakdown.goals.progress}% concluído` },
    { icon: TrendingUp, label: "Orçamento", score: data.breakdown.budget.score, max: data.breakdown.budget.max },
    { icon: Shield, label: "Saúde", score: data.breakdown.health.score, max: data.breakdown.health.max },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 space-y-5">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Score Financeiro</h3>
      </div>

      <div className="flex items-center gap-6">
        {/* Ring */}
        <div className="relative shrink-0">
          <svg width="110" height="110" className="-rotate-90">
            <circle cx="55" cy="55" r="45" fill="none" strokeWidth="8" className="stroke-muted" />
            <motion.circle
              cx="55" cy="55" r="45" fill="none" strokeWidth="8"
              className={ringColor}
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-2xl font-bold ${scoreColor}`}>{data.score}</span>
            <span className="text-[10px] text-muted-foreground">{data.label}</span>
          </div>
        </div>

        {/* Breakdown */}
        <div className="flex-1 space-y-2">
          {breakdownItems.map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <item.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div className="flex-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="text-foreground font-medium">{item.score}/{item.max}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted mt-0.5">
                  <motion.div
                    className="h-full rounded-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${(item.score / item.max) * 100}%` }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Explanation */}
      {(aiExplanation || aiLoading) && (
        <div className="space-y-1.5 pt-2 border-t border-border">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-primary" />
            <span className="text-[11px] font-medium text-foreground">Análise da IA</span>
          </div>
          {aiLoading ? (
            <div className="flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
              <span className="text-[10px] text-muted-foreground">Analisando seu score...</span>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground leading-relaxed">{aiExplanation}</p>
          )}
        </div>
      )}

      {/* Tips */}
      {data.tips.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-border">
          <div className="flex items-center gap-1.5">
            <Lightbulb className="h-3 w-3 text-warning" />
            <span className="text-[11px] font-medium text-foreground">Dicas para melhorar</span>
          </div>
          {data.tips.slice(0, 3).map((tip, i) => (
            <p key={i} className="text-[11px] text-muted-foreground">{tip}</p>
          ))}
        </div>
      )}
    </motion.div>
  );
}
