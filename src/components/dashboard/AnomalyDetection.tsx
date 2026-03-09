import { useMemo } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, TrendingUp } from "lucide-react";
import { useSupabaseQuery } from "@/hooks/use-supabase-crud";

interface Transaction {
  id: string;
  amount: number;
  type: string;
  status: string;
  date: string;
  description: string;
  category_id: string | null;
}

interface Category {
  id: string;
  name: string;
}

interface Anomaly {
  description: string;
  amount: number;
  average: number;
  ratio: number;
  category: string;
  date: string;
}

export function AnomalyDetection() {
  const { data: transactions = [] } = useSupabaseQuery<Transaction>("transactions", "date", false);
  const { data: categories = [] } = useSupabaseQuery<Category>("categories", "name", true);

  const anomalies = useMemo(() => {
    const catMap = new Map(categories.map((c) => [c.id, c.name]));
    const expenses = transactions.filter((t) => t.type === "expense" && t.status === "paid");

    // Group by category
    const catGroups = new Map<string, number[]>();
    expenses.forEach((t) => {
      const key = t.category_id || "sem-categoria";
      if (!catGroups.has(key)) catGroups.set(key, []);
      catGroups.get(key)!.push(Number(t.amount));
    });

    const found: Anomaly[] = [];
    // Check last 10 transactions for anomalies
    const recent = expenses.slice(0, 10);
    for (const tx of recent) {
      const key = tx.category_id || "sem-categoria";
      const amounts = catGroups.get(key) || [];
      if (amounts.length < 3) continue;
      const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const ratio = Number(tx.amount) / avg;
      if (ratio >= 2.5) {
        found.push({
          description: tx.description,
          amount: Number(tx.amount),
          average: avg,
          ratio,
          category: catMap.get(tx.category_id || "") || "Sem categoria",
          date: tx.date,
        });
      }
    }
    return found.slice(0, 5);
  }, [transactions, categories]);

  if (anomalies.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-success" />
          <h3 className="text-sm font-semibold text-foreground">Detecção de Anomalias</h3>
        </div>
        <div className="flex items-center gap-2 text-success text-xs">
          <TrendingUp className="h-3.5 w-3.5" />
          <span>Nenhum gasto incomum detectado. Tudo normal! ✅</span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-warning" />
        <h3 className="text-sm font-semibold text-foreground">Detecção de Anomalias</h3>
        <span className="text-[10px] bg-warning/15 text-warning px-2 py-0.5 rounded-full ml-auto">{anomalies.length} alerta(s)</span>
      </div>
      <div className="space-y-2">
        {anomalies.map((a, i) => (
          <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-warning/5 border border-warning/15">
            <AlertTriangle className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{a.description}</p>
              <p className="text-[10px] text-muted-foreground">{a.category} · {new Date(a.date + "T12:00:00").toLocaleDateString("pt-BR")}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-bold text-warning">R$ {a.amount.toLocaleString("pt-BR")}</p>
              <p className="text-[10px] text-muted-foreground">Média: R$ {a.average.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</p>
              <p className="text-[10px] text-destructive font-medium">{a.ratio.toFixed(1)}x acima</p>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
