import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useSupabaseQuery } from "@/hooks/use-supabase-crud";

interface Transaction {
  id: string;
  amount: number;
  type: string;
  description: string;
}

const COLORS = [
  "hsl(175, 80%, 50%)",
  "hsl(265, 70%, 60%)",
  "hsl(152, 60%, 48%)",
  "hsl(38, 92%, 55%)",
  "hsl(340, 70%, 58%)",
  "hsl(200, 70%, 50%)",
];

// Simple category extraction from description keywords
function guessCategory(desc: string): string {
  const lower = desc.toLowerCase();
  if (["aluguel", "luz", "água", "internet", "condomínio", "iptu"].some((k) => lower.includes(k))) return "Moradia";
  if (["ifood", "mercado", "supermercado", "restaurante", "padaria"].some((k) => lower.includes(k))) return "Alimentação";
  if (["uber", "99", "gasolina", "estacionamento", "ônibus"].some((k) => lower.includes(k))) return "Transporte";
  if (["netflix", "spotify", "cinema", "lazer", "bar"].some((k) => lower.includes(k))) return "Lazer";
  if (["farmácia", "médico", "academia", "plano de saúde"].some((k) => lower.includes(k))) return "Saúde";
  return "Outros";
}

export function CategoryPieChart() {
  const { data: transactions = [] } = useSupabaseQuery<Transaction>("transactions");

  const expenses = transactions.filter((t) => t.type === "expense");
  const categoryMap = new Map<string, number>();
  expenses.forEach((t) => {
    const cat = guessCategory(t.description);
    categoryMap.set(cat, (categoryMap.get(cat) || 0) + Number(t.amount));
  });

  const data = Array.from(categoryMap.entries()).map(([name, value], i) => ({
    name,
    value,
    fill: COLORS[i % COLORS.length],
  }));

  if (data.length === 0) {
    return (
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Gastos por Categoria</h3>
        <p className="text-xs text-muted-foreground text-center py-12">Adicione despesas para ver o gráfico</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">Gastos por Categoria</h3>
      <div className="h-[260px] flex items-center">
        <div className="w-1/2 h-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" strokeWidth={0}>
                {data.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "hsl(220, 18%, 12%)", border: "1px solid hsl(220, 14%, 22%)", borderRadius: "8px", color: "hsl(210, 20%, 92%)", fontSize: 12 }} formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR")}`, undefined]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="w-1/2 space-y-2">
          {data.map((cat) => (
            <div key={cat.name} className="flex items-center gap-2 text-xs">
              <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: cat.fill }} />
              <span className="text-muted-foreground flex-1">{cat.name}</span>
              <span className="font-medium text-foreground">R$ {cat.value.toLocaleString("pt-BR")}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
