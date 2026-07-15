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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-card animate-pulse p-5">
              <div className="mb-3 h-10 w-10 rounded-xl bg-muted" />
              <div className="mb-2 h-4 w-24 rounded bg-muted" />
              <div className="h-3 w-32 rounded bg-muted" />
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
    Iniciante: "text-muted-foreground",
    Intermediário: "text-primary",
    Avançado: "text-warning",
    "Mestre Financeiro": "gradient-text-primary",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Conquistas</h1>
        <p className="text-sm text-muted-foreground">Acompanhe suas conquistas financeiras</p>
      </div>

      {/* Stats Header */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-5"
        >
          <div className="flex items-center gap-3">
            <div className="gradient-bg-primary flex h-10 w-10 items-center justify-center rounded-xl">
              <Trophy className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Nível
              </p>
              <p className={`text-base font-bold ${levelColors[stats.level] || "text-foreground"}`}>
                {stats.level}
              </p>
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

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="glass-card p-5"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning">
              <Medal className="h-5 w-5 text-warning-foreground" />
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Conquistas
              </p>
              <p className="text-base font-bold text-foreground">
                {stats.unlocked}{" "}
                <span className="text-xs font-normal text-muted-foreground">/ {stats.total}</span>
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="glass-card p-5"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive">
              <Flame className="h-5 w-5 text-destructive-foreground" />
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Streak Atual
              </p>
              <p className="text-base font-bold text-foreground">
                {stats.currentStreak}{" "}
                <span className="text-xs font-normal text-muted-foreground">dias</span>
              </p>
              <p className="text-[10px] text-muted-foreground">Recorde: {stats.bestStreak} dias</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24 }}
          className="glass-card p-5"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success">
              <TrendingUp className="h-5 w-5 text-success-foreground" />
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Economia
              </p>
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
            className={`rounded-lg px-4 py-2 text-xs font-medium transition-colors ${
              filter === f
                ? "gradient-bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {f === "all"
              ? `Todas (${achievements.length})`
              : f === "unlocked"
                ? `Desbloqueadas (${stats.unlocked})`
                : `Bloqueadas (${stats.total - stats.unlocked})`}
          </button>
        ))}
      </div>

      {/* Achievement Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {filtered.map((ach, i) => (
            <motion.div
              key={ach.key}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: i * 0.03, duration: 0.3 }}
              className={`glass-card-hover relative overflow-hidden p-5 ${
                ach.justUnlocked ? "border-primary/50 ring-1 ring-primary/20" : ""
              } ${!ach.unlocked ? "opacity-60" : ""}`}
            >
              {ach.justUnlocked && (
                <div className="absolute right-2 top-2">
                  <span className="flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[9px] font-medium text-primary">
                    <Zap className="h-2.5 w-2.5" /> Novo!
                  </span>
                </div>
              )}

              <div className="flex items-start gap-3">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl ${
                    ach.unlocked ? "bg-primary/15" : "bg-muted"
                  }`}
                >
                  {ach.unlocked ? ach.icon : <Lock className="h-5 w-5 text-muted-foreground" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-semibold ${ach.unlocked ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    {ach.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{ach.description}</p>
                  {ach.unlocked && ach.unlockedAt && (
                    <p className="mt-1.5 flex items-center gap-1 text-[10px] text-primary">
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
        <div className="py-12 text-center">
          <Trophy className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {filter === "unlocked"
              ? "Nenhuma conquista desbloqueada ainda."
              : "Todas as conquistas foram desbloqueadas! 🎉"}
          </p>
        </div>
      )}
    </div>
  );
};

export default Achievements;
