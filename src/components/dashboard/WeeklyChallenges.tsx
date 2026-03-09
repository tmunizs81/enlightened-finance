import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Swords, Trophy, Sparkles, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Challenge {
  id: string;
  title: string;
  description: string;
  target_type: string;
  current_progress: number;
  xp_reward: number;
  status: string;
  week_start: string;
  week_end: string;
}

export function WeeklyChallenges() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchChallenges = async () => {
    const { data, error } = await supabase.functions.invoke("weekly-challenges", {
      body: { action: "list" },
    });
    if (!error && data) setChallenges(data.challenges || []);
    setLoading(false);
  };

  useEffect(() => { fetchChallenges(); }, []);

  const generateChallenges = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("weekly-challenges", {
        body: { action: "generate" },
      });
      if (error) throw error;
      setChallenges(data.challenges || []);
      if (data.already_generated) {
        toast.info("Desafios desta semana já foram gerados!");
      } else {
        toast.success("Novos desafios criados! 🎯");
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar desafios");
    } finally {
      setGenerating(false);
    }
  };

  const activeChallenges = challenges.filter((c) => c.status === "active");
  const completedThisWeek = challenges.filter((c) => c.status === "completed");
  const totalXP = completedThisWeek.reduce((s, c) => s + c.xp_reward, 0);

  const typeIcons: Record<string, string> = {
    spending_reduction: "💸",
    savings: "💰",
    no_spend_days: "🚫",
  };

  if (loading) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Swords className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Desafios da Semana</h3>
          {completedThisWeek.length > 0 && (
            <span className="text-[10px] bg-success/15 text-success px-2 py-0.5 rounded-full">
              +{totalXP} XP
            </span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={generateChallenges}
          disabled={generating}
          className="text-xs border-border text-muted-foreground hover:text-primary gap-1.5"
        >
          {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          {generating ? "Gerando..." : challenges.length === 0 ? "Gerar Desafios" : "Atualizar"}
        </Button>
      </div>

      {challenges.length === 0 ? (
        <div className="text-center py-4">
          <Swords className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-xs text-muted-foreground">Clique em "Gerar Desafios" para a IA criar desafios personalizados para esta semana</p>
        </div>
      ) : (
        <div className="space-y-3">
          {challenges.slice(0, 5).map((ch, i) => (
            <motion.div
              key={ch.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className={`p-3 rounded-lg border ${
                ch.status === "completed"
                  ? "bg-success/5 border-success/20"
                  : "bg-secondary/50 border-border/50"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <span className="text-base mt-0.5">{typeIcons[ch.target_type] || "🎯"}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-foreground">{ch.title}</p>
                    {ch.status === "completed" && <Trophy className="h-3 w-3 text-success" />}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{ch.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Progress
                      value={Math.max(0, Math.min(100, ch.current_progress))}
                      className="flex-1 h-1.5"
                    />
                    <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">
                      {Math.round(ch.current_progress)}%
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Sparkles className="h-3 w-3 text-warning" />
                  <span className="text-[10px] font-medium text-warning">{ch.xp_reward} XP</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
