import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useSupabaseQuery } from "@/hooks/use-supabase-crud";

interface Transaction {
  id: string;
  amount: number;
  type: string;
  date: string;
  status: string;
}
interface Account {
  id: string;
  balance: number;
}

export function BalanceForecast() {
  const { data: transactions = [] } = useSupabaseQuery<Transaction>("transactions", "date");
  const { data: accounts = [] } = useSupabaseQuery<Account>("accounts");

  const currentBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);

  // Calculate avg monthly net from paid transactions
  const monthlyNet = new Map<string, number>();
  transactions
    .filter((t) => t.status === "paid")
    .forEach((t) => {
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const val = t.type === "income" ? Number(t.amount) : -Number(t.amount);
      monthlyNet.set(key, (monthlyNet.get(key) || 0) + val);
    });

  const nets = Array.from(monthlyNet.values());
  const avgNet = nets.length > 0 ? nets.reduce((a, b) => a + b, 0) / nets.length : 0;

  const now = new Date();
  const monthNames = (d: Date) => d.toLocaleString("pt-BR", { month: "short" }).replace(".", "");

  // Build data: current month as "real", next 5 months as "previsto"
  const data = [];
  data.push({ month: monthNames(now), real: currentBalance, previsto: null as number | null });

  let projected = currentBalance;
  for (let i = 1; i <= 5; i++) {
    const future = new Date(now.getFullYear(), now.getMonth() + i, 1);
    projected += avgNet;
    data.push({ month: monthNames(future), real: null as number | null, previsto: Math.round(projected) });
  }

  if (currentBalance === 0 && transactions.length === 0) {
    return (
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-1">Previsão de Saldo</h3>
        <p className="text-xs text-muted-foreground mb-4">Projeção baseada no seu histórico</p>
        <p className="text-xs text-muted-foreground text-center py-12">Adicione contas e transações para ver a projeção</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-1">Previsão de Saldo</h3>
      <p className="text-xs text-muted-foreground mb-4">Projeção baseada na média mensal (R$ {avgNet >= 0 ? "+" : ""}{avgNet.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}/mês)</p>
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
            <XAxis dataKey="month" tick={{ fill: "hsl(215, 15%, 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "hsl(215, 15%, 55%)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip contentStyle={{ background: "hsl(220, 18%, 12%)", border: "1px solid hsl(220, 14%, 22%)", borderRadius: "8px", color: "hsl(210, 20%, 92%)", fontSize: 12 }} formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR")}`, undefined]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="real" name="Atual" stroke="hsl(175, 80%, 50%)" strokeWidth={2.5} dot={{ fill: "hsl(175, 80%, 50%)", r: 4 }} connectNulls={false} />
            <Line type="monotone" dataKey="previsto" name="Previsto" stroke="hsl(265, 70%, 60%)" strokeWidth={2} strokeDasharray="6 4" dot={{ fill: "hsl(265, 70%, 60%)", r: 3 }} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
