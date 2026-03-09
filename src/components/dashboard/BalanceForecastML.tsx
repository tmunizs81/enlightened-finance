import { useMemo } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Calendar } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine } from "recharts";
import { useSupabaseQuery } from "@/hooks/use-supabase-crud";

interface Transaction {
  id: string;
  amount: number;
  type: string;
  status: string;
  date: string;
}

interface Account {
  id: string;
  balance: number;
}

interface RecurringTransaction {
  id: string;
  amount: number;
  type: string;
  day_of_month: number;
  active: boolean;
}

export function BalanceForecastML() {
  const { data: transactions = [] } = useSupabaseQuery<Transaction>("transactions", "date", false);
  const { data: accounts = [] } = useSupabaseQuery<Account>("accounts");
  const { data: recurring = [] } = useSupabaseQuery<RecurringTransaction>("recurring_transactions");

  const chartData = useMemo(() => {
    const currentBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);
    const now = new Date();

    // Calculate average daily income/expense from last 90 days
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const recentTx = transactions.filter((t) => t.date >= ninetyDaysAgo.toISOString().split("T")[0] && t.status === "paid");
    
    const totalDays = Math.max(1, Math.ceil((now.getTime() - ninetyDaysAgo.getTime()) / 86400000));
    const avgDailyIncome = recentTx.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0) / totalDays;
    const avgDailyExpense = recentTx.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0) / totalDays;

    // Add recurring transactions impact
    const monthlyRecurringIncome = recurring.filter((r) => r.active && r.type === "income").reduce((s, r) => s + Number(r.amount), 0);
    const monthlyRecurringExpense = recurring.filter((r) => r.active && r.type === "expense").reduce((s, r) => s + Number(r.amount), 0);

    const dailyNet = (avgDailyIncome + monthlyRecurringIncome / 30) - (avgDailyExpense + monthlyRecurringExpense / 30);

    const points: { day: string; saldo: number; type: string }[] = [];
    
    // Past 15 days (actual)
    for (let i = 14; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const dayTx = transactions.filter((t) => t.date === dateStr && t.status === "paid");
      const dayNet = dayTx.reduce((s, t) => s + (t.type === "income" ? 1 : -1) * Number(t.amount), 0);
      points.push({
        day: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        saldo: currentBalance - transactions.filter((t) => t.date > dateStr && t.status === "paid").reduce((s, t) => s + (t.type === "income" ? 1 : -1) * Number(t.amount), 0),
        type: "real",
      });
    }

    // Future 90 days (predicted)
    let projected = currentBalance;
    for (let i = 1; i <= 90; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      projected += dailyNet;
      
      if (i % 3 === 0) { // sample every 3 days to keep chart clean
        points.push({
          day: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
          saldo: Math.round(projected * 100) / 100,
          type: "projeção",
        });
      }
    }

    return { points, projected30: Math.round((currentBalance + dailyNet * 30) * 100) / 100, projected60: Math.round((currentBalance + dailyNet * 60) * 100) / 100, projected90: Math.round((currentBalance + dailyNet * 90) * 100) / 100, currentBalance };
  }, [transactions, accounts, recurring]);

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Previsão de Saldo</h3>
        </div>
        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "30 dias", value: chartData.projected30 },
          { label: "60 dias", value: chartData.projected60 },
          { label: "90 dias", value: chartData.projected90 },
        ].map((p) => (
          <div key={p.label} className="bg-secondary/50 rounded-lg p-2 text-center border border-border/50">
            <p className="text-[10px] text-muted-foreground">{p.label}</p>
            <p className={`text-xs font-bold ${p.value >= chartData.currentBalance ? "text-success" : "text-destructive"}`}>
              R$ {p.value.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
          </div>
        ))}
      </div>

      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData.points}>
            <XAxis dataKey="day" tick={{ fontSize: 9, fill: "hsl(215, 15%, 55%)" }} axisLine={false} tickLine={false} interval={Math.floor(chartData.points.length / 6)} />
            <YAxis tick={{ fontSize: 9, fill: "hsl(215, 15%, 55%)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip contentStyle={{ background: "hsl(220, 18%, 10%)", border: "1px solid hsl(220, 14%, 18%)", borderRadius: 8, fontSize: 11 }} formatter={(v: number) => [`R$ ${v.toLocaleString("pt-BR")}`, "Saldo"]} />
            <ReferenceLine y={0} stroke="hsl(0, 72%, 55%)" strokeDasharray="3 3" strokeOpacity={0.5} />
            <Line type="monotone" dataKey="saldo" stroke="hsl(175, 80%, 50%)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[10px] text-muted-foreground text-center">Linha contínua = real | Projeção baseada em histórico + recorrentes</p>
    </motion.div>
  );
}
