import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Flame, Star, Lock, Zap, TrendingUp, Medal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

interface Achievement {
  key: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt: string | null;
  justUnlocked: boolean;
}

interface Stats {
  unlocked: number;
  total: number;
  level: string;
  xp: number;
  nextLevelXp: number;
  currentStreak: number;
  bestStreak: number;
  savingsRate: number;
}

interface AchievementsData {
  achievements: Achievement[];
  stats: Stats;
  newlyUnlocked: Achievement[];
}

const Achievements = () => {
  const [data, setData] = useState<AchievementsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unlocked" | "locked">("all");

  useEffect(() => {
    supabase.functions.invoke("achievements").then(({ data: d, error }) => {
      if (!error && d) {
        setData(d);
        // Show toast for newly unlocked
        if (d.newlyUnlocked?.length > 0) {
          d.newlyUnlocked.forEach((a: Achievement) => {
            toast.success(`${a.icon} Conquista desbloqueada: ${a.title}!`);
          });
        }
      }
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Conquistas</h1>
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-card p-5 animate-pulse">
              <div className="h-10 w-10 bg-muted rounded-xl mb-3" />
              <div className="h-4 w-24 bg-muted rounded mb-2" />
              <div className="h-3 w-32 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { achievements, stats } = data;
  const filtered = achievements.filter((a) => {
    if (filter === "unlocked") return a.unlocked;
    if (filter === "locked") return !a.unlocked;
    return true;
  });

  const levelColors: Record<string, string> = {
    "Iniciante": "text-muted-foreground",
    "Intermediário": "text-primary",
    "Avançado": "text-warning",
    "Mestre Financeiro": "gradient-text-primary",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Conquistas</h1>
        <p className="text-sm text-muted-foreground">Acompanhe suas conquistas financeiras</p>
      </div>

      {/* Stats Header */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl gradient-bg-primary flex items-center justify-center">
              <Trophy className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Nível</p>
              <p className={`text-base font-bold ${levelColors[stats.level] || "text-foreground"}`}>{stats.level}</p>
            </div>
          </div>
          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{stats.xp} XP</span>
              <span>{stats.nextLevelXp} XP</span>
            </div>
            <Progress value={(stats.xp / stats.nextLevelXp) * 100} className="h-1.5" />
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="glass-card p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-warning flex items-center justify-center">
              <Medal className="h-5 w-5 text-warning-foreground" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Conquistas</p>
              <p className="text-base font-bold text-foreground">{stats.unlocked} <span className="text-muted-foreground text-xs font-normal">/ {stats.total}</span></p>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="glass-card p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-destructive flex items-center justify-center">
              <Flame className="h-5 w-5 text-destructive-foreground" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Streak Atual</p>
              <p className="text-base font-bold text-foreground">{stats.currentStreak} <span className="text-muted-foreground text-xs font-normal">dias</span></p>
              <p className="text-[10px] text-muted-foreground">Recorde: {stats.bestStreak} dias</p>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }} className="glass-card p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-success flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-success-foreground" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Economia</p>
              <p className="text-base font-bold text-foreground">{stats.savingsRate}%</p>
              <p className="text-[10px] text-muted-foreground">da renda este mês</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(["all", "unlocked", "locked"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
              filter === f ? "gradient-bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {f === "all" ? `Todas (${achievements.length})` : f === "unlocked" ? `Desbloqueadas (${stats.unlocked})` : `Bloqueadas (${stats.total - stats.unlocked})`}
          </button>
        ))}
      </div>

      {/* Achievement Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {filtered.map((ach, i) => (
            <motion.div
              key={ach.key}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: i * 0.03, duration: 0.3 }}
              className={`glass-card-hover p-5 relative overflow-hidden ${
                ach.justUnlocked ? "border-primary/50 ring-1 ring-primary/20" : ""
              } ${!ach.unlocked ? "opacity-60" : ""}`}
            >
              {ach.justUnlocked && (
                <div className="absolute top-2 right-2">
                  <span className="text-[9px] bg-primary/15 text-primary px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                    <Zap className="h-2.5 w-2.5" /> Novo!
                  </span>
                </div>
              )}

              <div className="flex items-start gap-3">
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center text-xl shrink-0 ${
                  ach.unlocked ? "bg-primary/15" : "bg-muted"
                }`}>
                  {ach.unlocked ? ach.icon : <Lock className="h-5 w-5 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${ach.unlocked ? "text-foreground" : "text-muted-foreground"}`}>
                    {ach.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{ach.description}</p>
                  {ach.unlocked && ach.unlockedAt && (
                    <p className="text-[10px] text-primary mt-1.5 flex items-center gap-1">
                      <Star className="h-2.5 w-2.5" />
                      {new Date(ach.unlockedAt).toLocaleDateString("pt-BR")}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <Trophy className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            {filter === "unlocked" ? "Nenhuma conquista desbloqueada ainda." : "Todas as conquistas foram desbloqueadas! 🎉"}
          </p>
        </div>
      )}
    </div>
  );
};

export default Achievements;
