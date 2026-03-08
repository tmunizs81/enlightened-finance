import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { balanceForecast } from "@/lib/mock-data";

export function BalanceForecast() {
  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-1">Previsão de Saldo</h3>
      <p className="text-xs text-muted-foreground mb-4">Projeção baseada no seu histórico</p>
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={balanceForecast}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
            <XAxis dataKey="month" tick={{ fill: "hsl(215, 15%, 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "hsl(215, 15%, 55%)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{
                background: "hsl(220, 18%, 12%)",
                border: "1px solid hsl(220, 14%, 22%)",
                borderRadius: "8px",
                color: "hsl(210, 20%, 92%)",
                fontSize: 12,
              }}
              formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR")}`, undefined]}
            />
            <Line type="monotone" dataKey="real" stroke="hsl(175, 80%, 50%)" strokeWidth={2.5} dot={{ fill: "hsl(175, 80%, 50%)", r: 4 }} connectNulls={false} />
            <Line type="monotone" dataKey="previsto" stroke="hsl(265, 70%, 60%)" strokeWidth={2} strokeDasharray="6 4" dot={{ fill: "hsl(265, 70%, 60%)", r: 3 }} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
