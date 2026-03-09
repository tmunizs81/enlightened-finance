import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Focus, Wallet, Clock, Flame, ArrowRight, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseQuery } from "@/hooks/use-supabase-crud";

interface Transaction {
  id: string;
  amount: number;
  type: string;
  status: string;
  date: string;
  description: string;
}

interface Streak {
  current_streak: number;
  best_streak: number;
}

export function FocusMode() {
  const [visible, setVisible] = useState(false);
  const [dailyBudget, setDailyBudget] = useState(0);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const { data: transactions = [] } = useSupabaseQuery<Transaction>("transactions", "date", false);

  const today = new Date().toISOString().split("T")[0];
  const todaySpent = transactions
    .filter((t) => t.date === today && t.type === "expense" && t.status === "paid")
    .reduce((s, t) => s + Number(t.amount), 0);

  const upcomingBills = transactions
    .filter((t) => {
      if (t.type !== "expense" || t.status !== "pending") return false;
      const d = new Date(t.date);
      const now = new Date();
      const diff = (d.getTime() - now.getTime()) / 86400000;
      return diff >= 0 && diff <= 7;
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);

  useEffect(() => {
    Promise.all([
      supabase.functions.invoke("smart-alerts"),
      supabase.from("streaks").select("*").eq("streak_type", "no_unnecessary_spending").maybeSingle(),
      supabase.functions.invoke("financial-score"),
    ]).then(([alertsRes, streakRes, scoreRes]) => {
      if (alertsRes.data) setDailyBudget(alertsRes.data.dailyBudget || 0);
      if (streakRes.data) setStreak(streakRes.data);
      if (scoreRes.data) setScore(scoreRes.data.score);
    });
  }, []);

  if (!visible) {
    return (
      <Button
        variant="outline"
        onClick={() => setVisible(true)}
        className="gap-2 border-primary/30 text-primary hover:bg-primary/10 text-xs"
      >
        <Focus className="h-3.5 w-3.5" /> Modo Foco
      </Button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-card p-6 space-y-5 relative"
    >
      <button onClick={() => setVisible(false)} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
        <EyeOff className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-2">
        <Focus className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Modo Foco</h3>
        <span className="text-[10px] text-muted-foreground">Seu dia em resumo</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Daily budget */}
        <div className="bg-primary/5 border border-primary/15 rounded-xl p-4 text-center">
          <Wallet className="h-5 w-5 text-primary mx-auto mb-1" />
          <p className="text-[10px] text-muted-foreground">Pode gastar hoje</p>
          <p className="text-lg font-bold text-primary">R$ {dailyBudget.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
          {todaySpent > 0 && <p className="text-[10px] text-muted-foreground mt-0.5">Já gastou: R$ {todaySpent.toLocaleString("pt-BR")}</p>}
        </div>

        {/* Score */}
        <div className="bg-secondary/50 border border-border/50 rounded-xl p-4 text-center">
          <div className={`text-2xl font-bold mx-auto ${score && score >= 60 ? "text-success" : score && score >= 40 ? "text-warning" : "text-destructive"}`}>
            {score ?? "—"}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Score Financeiro</p>
        </div>

        {/* Streak */}
        <div className="bg-destructive/5 border border-destructive/15 rounded-xl p-4 text-center">
          <Flame className="h-5 w-5 text-destructive mx-auto mb-1" />
          <p className="text-lg font-bold text-foreground">{streak?.current_streak || 0}</p>
          <p className="text-[10px] text-muted-foreground">dias de streak</p>
        </div>

        {/* Upcoming */}
        <div className="bg-warning/5 border border-warning/15 rounded-xl p-4 text-center">
          <Clock className="h-5 w-5 text-warning mx-auto mb-1" />
          <p className="text-lg font-bold text-foreground">{upcomingBills.length}</p>
          <p className="text-[10px] text-muted-foreground">contas esta semana</p>
        </div>
      </div>

      {/* Upcoming bills detail */}
      {upcomingBills.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Próximas contas</p>
          {upcomingBills.map((bill) => (
            <div key={bill.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-secondary/30">
              <div className="flex items-center gap-2">
                <ArrowRight className="h-3 w-3 text-warning" />
                <span className="text-xs text-foreground">{bill.description}</span>
              </div>
              <div className="text-right">
                <span className="text-xs font-medium text-foreground">R$ {Number(bill.amount).toLocaleString("pt-BR")}</span>
                <span className="text-[10px] text-muted-foreground ml-2">{new Date(bill.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
