import { useMemo } from "react";
import { motion } from "framer-motion";
import { BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { useSupabaseQuery } from "@/hooks/use-supabase-crud";

interface Transaction {
  id: string;
  amount: number;
  type: string;
  status: string;
  date: string;
}

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function MonthlyComparison() {
  const { data: transactions = [] } = useSupabaseQuery<Transaction>("transactions", "date", false);

  const chartData = useMemo(() => {
    const now = new Date();
    const months: { month: string; receitas: number; despesas: number }[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = d.getMonth();
      const y = d.getFullYear();
      const monthTx = transactions.filter((t) => {
        const td = new Date(t.date);
        return td.getMonth() === m && td.getFullYear() === y && t.status === "paid";
      });
      months.push({
        month: `${MONTH_NAMES[m]}/${String(y).slice(2)}`,
        receitas: monthTx.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0),
        despesas: monthTx.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0),
      });
    }

    return months;
  }, [transactions]);

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Comparativo Mensal</h3>
      </div>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barGap={2}>
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(215, 15%, 55%)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(215, 15%, 55%)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ background: "hsl(220, 18%, 10%)", border: "1px solid hsl(220, 14%, 18%)", borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: "hsl(210, 20%, 92%)" }}
              formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR")}`, ""]}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="receitas" name="Receitas" fill="hsl(152, 60%, 48%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="despesas" name="Despesas" fill="hsl(0, 72%, 55%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
