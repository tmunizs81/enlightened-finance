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

  useEffect(() => {
    fetchChallenges();
  }, []);

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
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card space-y-4 p-5"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Swords className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Desafios da Semana</h3>
          {completedThisWeek.length > 0 && (
            <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] text-success">
              +{totalXP} XP
            </span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={generateChallenges}
          disabled={generating}
          className="gap-1.5 border-border text-xs text-muted-foreground hover:text-primary"
        >
          {generating ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          {generating ? "Gerando..." : challenges.length === 0 ? "Gerar Desafios" : "Atualizar"}
        </Button>
      </div>

      {challenges.length === 0 ? (
        <div className="py-4 text-center">
          <Swords className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Clique em "Gerar Desafios" para a IA criar desafios personalizados para esta semana
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {challenges.slice(0, 5).map((ch, i) => (
            <motion.div
              key={ch.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className={`rounded-lg border p-3 ${
                ch.status === "completed"
                  ? "border-success/20 bg-success/5"
                  : "border-border/50 bg-secondary/50"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 text-base">{typeIcons[ch.target_type] || "🎯"}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-foreground">{ch.title}</p>
                    {ch.status === "completed" && <Trophy className="h-3 w-3 text-success" />}
                  </div>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{ch.description}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Progress
                      value={Math.max(0, Math.min(100, ch.current_progress))}
                      className="h-1.5 flex-1"
                    />
                    <span className="w-8 text-right text-[10px] tabular-nums text-muted-foreground">
                      {Math.round(ch.current_progress)}%
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
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
