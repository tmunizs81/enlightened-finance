import { useMemo } from "react";
import { motion } from "framer-motion";
import { BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useSupabaseQuery } from "@/hooks/use-supabase-crud";

interface Transaction {
  id: string;
  amount: number;
  type: string;
  status: string;
  date: string;
}

const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function YearlyComparison() {
  const { data: transactions = [] } = useSupabaseQuery<Transaction>("transactions", "date", false);

  const chartData = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const prevYear = currentYear - 1;

    const getMonthlyData = (year: number) => {
      const monthly = Array(12).fill(0);
      transactions
        .filter((t) => t.type === "expense" && t.status === "paid")
        .forEach((t) => {
          const d = new Date(t.date);
          if (d.getFullYear() === year) {
            monthly[d.getMonth()] += Number(t.amount);
          }
        });
      return monthly;
    };

    const currentData = getMonthlyData(currentYear);
    const prevData = getMonthlyData(prevYear);

    return monthNames.map((name, i) => ({
      month: name,
      [prevYear]: Math.round(prevData[i]),
      [currentYear]: Math.round(currentData[i]),
    }));
  }, [transactions]);

  const currentYear = new Date().getFullYear();
  const prevYear = currentYear - 1;

  const totalCurrent = chartData.reduce((s, d) => s + (d[currentYear] || 0), 0);
  const totalPrev = chartData.reduce((s, d) => s + (d[prevYear] || 0), 0);
  const diff = totalPrev > 0 ? ((totalCurrent - totalPrev) / totalPrev * 100) : 0;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Comparativo Anual</h3>
        </div>
        {totalPrev > 0 && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${diff <= 0 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
            {diff > 0 ? "+" : ""}{diff.toFixed(0)}% vs {prevYear}
          </span>
        )}
      </div>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barGap={2} barSize={8}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "11px",
              }}
              formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR")}`, ""]}
            />
            <Legend wrapperStyle={{ fontSize: "10px" }} />
            <Bar dataKey={prevYear} fill="hsl(var(--muted-foreground))" radius={[2, 2, 0, 0]} name={`${prevYear}`} />
            <Bar dataKey={currentYear} fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} name={`${currentYear}`} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
