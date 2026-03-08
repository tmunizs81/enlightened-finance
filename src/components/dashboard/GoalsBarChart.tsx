import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useSupabaseQuery } from "@/hooks/use-supabase-crud";

interface Goal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
}

export function GoalsBarChart() {
  const { data: goals = [] } = useSupabaseQuery<Goal>("goals");

  const data = goals.map((g) => ({
    name: g.name.length > 12 ? g.name.slice(0, 12) + "…" : g.name,
    meta: Number(g.target_amount),
    real: Number(g.current_amount),
  }));

  if (data.length === 0) {
    return (
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Metas: Alvo vs Atual</h3>
        <p className="text-xs text-muted-foreground text-center py-12">Adicione metas para ver o gráfico</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">Metas: Alvo vs Atual</h3>
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" horizontal={false} />
            <XAxis type="number" tick={{ fill: "hsl(215, 15%, 55%)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
            <YAxis type="category" dataKey="name" tick={{ fill: "hsl(215, 15%, 55%)", fontSize: 11 }} axisLine={false} tickLine={false} width={100} />
            <Tooltip contentStyle={{ background: "hsl(220, 18%, 12%)", border: "1px solid hsl(220, 14%, 22%)", borderRadius: "8px", color: "hsl(210, 20%, 92%)", fontSize: 12 }} formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR")}`, undefined]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="meta" name="Alvo" fill="hsl(220, 14%, 24%)" radius={[0, 4, 4, 0]} />
            <Bar dataKey="real" name="Atual" fill="hsl(175, 80%, 50%)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
