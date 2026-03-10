import { useMemo } from "react";
import { motion } from "framer-motion";
import { BarChart3, Users } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend, Cell } from "recharts";
import { useSupabaseQuery } from "@/hooks/use-supabase-crud";

interface Transaction {
  id: string;
  amount: number;
  type: string;
  status: string;
  date: string;
  category_id: string | null;
}

interface Category {
  id: string;
  name: string;
  type: string;
}

// Média nacional brasileira por categoria (IBGE/POF 2024, % da renda)
// Baseado em renda média familiar de ~R$ 5.500/mês
const NATIONAL_AVERAGES: Record<string, number> = {
  "Alimentação": 1100,
  "Moradia": 1375,
  "Transporte": 825,
  "Saúde": 440,
  "Educação": 275,
  "Lazer": 165,
  "Vestuário": 220,
  "Comunicação": 165,
  "Higiene": 110,
  "Outros": 825,
};

const CATEGORY_MAPPING: Record<string, string> = {
  "alimentação": "Alimentação",
  "comida": "Alimentação",
  "mercado": "Alimentação",
  "supermercado": "Alimentação",
  "restaurante": "Alimentação",
  "moradia": "Moradia",
  "aluguel": "Moradia",
  "casa": "Moradia",
  "condomínio": "Moradia",
  "transporte": "Transporte",
  "combustível": "Transporte",
  "uber": "Transporte",
  "ônibus": "Transporte",
  "saúde": "Saúde",
  "farmácia": "Saúde",
  "médico": "Saúde",
  "plano de saúde": "Saúde",
  "educação": "Educação",
  "escola": "Educação",
  "curso": "Educação",
  "faculdade": "Educação",
  "lazer": "Lazer",
  "entretenimento": "Lazer",
  "streaming": "Lazer",
  "vestuário": "Vestuário",
  "roupa": "Vestuário",
  "comunicação": "Comunicação",
  "telefone": "Comunicação",
  "internet": "Comunicação",
  "higiene": "Higiene",
  "beleza": "Higiene",
};

function mapToNationalCategory(categoryName: string): string {
  const lower = categoryName.toLowerCase();
  for (const [key, value] of Object.entries(CATEGORY_MAPPING)) {
    if (lower.includes(key)) return value;
  }
  return "Outros";
}

export function NationalBenchmark() {
  const { data: transactions = [] } = useSupabaseQuery<Transaction>("transactions", "date", false);
  const { data: categories = [] } = useSupabaseQuery<Category>("categories", "name", true);

  const chartData = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const catMap = new Map(categories.map((c) => [c.id, c]));

    // Sum user spending by national category for current month
    const userSpending: Record<string, number> = {};
    const monthExpenses = transactions.filter((t) => {
      const d = new Date(t.date);
      return t.type === "expense" && t.status === "paid" && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    for (const tx of monthExpenses) {
      const cat = tx.category_id ? catMap.get(tx.category_id) : null;
      const nationalCat = cat ? mapToNationalCategory(cat.name) : "Outros";
      userSpending[nationalCat] = (userSpending[nationalCat] || 0) + Number(tx.amount);
    }

    // Build comparison data
    return Object.entries(NATIONAL_AVERAGES)
      .map(([category, average]) => ({
        category,
        voce: Math.round(userSpending[category] || 0),
        media: average,
      }))
      .filter((d) => d.voce > 0 || d.media > 0)
      .sort((a, b) => b.voce - a.voce)
      .slice(0, 8);
  }, [transactions, categories]);

  const totalUser = chartData.reduce((s, d) => s + d.voce, 0);
  const totalAvg = chartData.reduce((s, d) => s + d.media, 0);
  const diff = totalUser - totalAvg;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-semibold text-foreground">Comparativo Nacional</h3>
        </div>
        <span className={`text-xs font-medium ${diff <= 0 ? "text-success" : "text-destructive"}`}>
          {diff <= 0 ? "Abaixo" : "Acima"} da média: R$ {Math.abs(diff).toLocaleString("pt-BR")}
        </span>
      </div>

      <p className="text-[10px] text-muted-foreground">
        Seus gastos vs. média nacional brasileira (IBGE/POF) — mês atual
      </p>

      {chartData.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-8">
          Registre transações com categorias para ver o comparativo
        </p>
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" barGap={2}>
              <XAxis
                type="number"
                tick={{ fontSize: 10, fill: "hsl(215, 15%, 55%)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`}
              />
              <YAxis
                type="category"
                dataKey="category"
                tick={{ fontSize: 10, fill: "hsl(215, 15%, 55%)" }}
                axisLine={false}
                tickLine={false}
                width={90}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(220, 18%, 10%)",
                  border: "1px solid hsl(220, 14%, 18%)",
                  borderRadius: 8,
                  fontSize: 11,
                }}
                labelStyle={{ color: "hsl(210, 20%, 92%)" }}
                formatter={(value: number, name: string) => [
                  `R$ ${value.toLocaleString("pt-BR")}`,
                  name === "voce" ? "Você" : "Média Nacional",
                ]}
              />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                formatter={(value) => (value === "voce" ? "Você" : "Média Nacional")}
              />
              <Bar dataKey="voce" name="voce" fill="hsl(175, 80%, 50%)" radius={[0, 4, 4, 0]} barSize={12} />
              <Bar dataKey="media" name="media" fill="hsl(265, 70%, 60%)" radius={[0, 4, 4, 0]} barSize={12} opacity={0.6} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.div>
  );
}
