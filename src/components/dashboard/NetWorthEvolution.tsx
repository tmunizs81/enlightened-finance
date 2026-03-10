import { useMemo } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Area, AreaChart } from "recharts";
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
  created_at: string;
}

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function NetWorthEvolution() {
  const { data: accounts = [] } = useSupabaseQuery<Account>("accounts");
  const { data: transactions = [] } = useSupabaseQuery<Transaction>("transactions", "date", false);

  const chartData = useMemo(() => {
    const currentBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);
    const now = new Date();
    const months: { month: string; patrimonio: number }[] = [];

    // Build monthly net changes going backwards
    const monthlyChanges: number[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = d.getMonth();
      const y = d.getFullYear();
      const monthTx = transactions.filter((t) => {
        const td = new Date(t.date);
        return td.getMonth() === m && td.getFullYear() === y && t.status === "paid";
      });
      const income = monthTx.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
      const expense = monthTx.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
      monthlyChanges.push(income - expense);
    }

    // Reconstruct balances backwards from current
    let balance = currentBalance;
    const balances: number[] = new Array(12);
    balances[11] = balance;
    for (let i = 10; i >= 0; i--) {
      balance -= monthlyChanges[i + 1];
      balances[i] = balance;
    }

    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      months.push({
        month: `${MONTH_NAMES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`,
        patrimonio: Math.round(balances[i] * 100) / 100,
      });
    }

    return months;
  }, [accounts, transactions]);

  const currentValue = chartData[chartData.length - 1]?.patrimonio ?? 0;
  const previousValue = chartData[chartData.length - 2]?.patrimonio ?? 0;
  const change = currentValue - previousValue;
  const changePercent = previousValue !== 0 ? ((change / Math.abs(previousValue)) * 100) : 0;
  const isPositive = change >= 0;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Evolução do Patrimônio</h3>
        </div>
        <div className="flex items-center gap-1.5">
          {isPositive ? (
            <TrendingUp className="h-3.5 w-3.5 text-success" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5 text-destructive" />
          )}
          <span className={`text-xs font-medium ${isPositive ? "text-success" : "text-destructive"}`}>
            {isPositive ? "+" : ""}{changePercent.toFixed(1)}% este mês
          </span>
        </div>
      </div>

      <div className="text-center">
        <p className="text-2xl font-bold text-foreground">
          R$ {currentValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
        </p>
        <p className="text-xs text-muted-foreground">Patrimônio líquido atual</p>
      </div>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(175, 80%, 50%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(175, 80%, 50%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="month"
              tick={{ fontSize: 10, fill: "hsl(215, 15%, 55%)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "hsl(215, 15%, 55%)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(220, 18%, 10%)",
                border: "1px solid hsl(220, 14%, 18%)",
                borderRadius: 8,
                fontSize: 11,
              }}
              labelStyle={{ color: "hsl(210, 20%, 92%)" }}
              formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, "Patrimônio"]}
            />
            <Area
              type="monotone"
              dataKey="patrimonio"
              stroke="hsl(175, 80%, 50%)"
              strokeWidth={2}
              fill="url(#netWorthGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
