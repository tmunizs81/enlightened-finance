import { useMemo } from "react";
import { motion } from "framer-motion";
import { CreditCard, AlertTriangle, TrendingDown } from "lucide-react";
import { useSupabaseQuery } from "@/hooks/use-supabase-crud";

interface RecurringTransaction {
  id: string;
  description: string;
  amount: number;
  type: string;
  category_id: string | null;
  active: boolean;
  day_of_month: number;
}

interface Category {
  id: string;
  name: string;
}

export function SubscriptionsDashboard() {
  const { data: recurrings = [] } = useSupabaseQuery<RecurringTransaction>("recurring_transactions" as any, "amount", false);
  const { data: categories = [] } = useSupabaseQuery<Category>("categories", "name", true);

  const subscriptions = useMemo(() => {
    const catMap = new Map(categories.map((c) => [c.id, c.name]));
    return recurrings
      .filter((r) => r.type === "expense" && r.active)
      .map((r) => ({
        ...r,
        categoryName: r.category_id ? catMap.get(r.category_id) || "Sem categoria" : "Sem categoria",
      }))
      .sort((a, b) => Number(b.amount) - Number(a.amount));
  }, [recurrings, categories]);

  const totalMonthly = subscriptions.reduce((s, r) => s + Number(r.amount), 0);
  const totalAnnual = totalMonthly * 12;

  if (subscriptions.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Assinaturas & Recorrentes</h3>
        </div>
        <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">
          {subscriptions.length} ativa(s)
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/15">
          <p className="text-[10px] text-muted-foreground">Total Mensal</p>
          <p className="text-sm font-bold text-destructive">
            R$ {totalMonthly.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="p-3 rounded-lg bg-warning/5 border border-warning/15">
          <p className="text-[10px] text-muted-foreground">Total Anual</p>
          <p className="text-sm font-bold text-warning">
            R$ {totalAnnual.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        {subscriptions.slice(0, 8).map((sub, i) => {
          const pctOfTotal = totalMonthly > 0 ? (Number(sub.amount) / totalMonthly) * 100 : 0;
          return (
            <div key={sub.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/30 transition-colors">
              <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                <TrendingDown className="h-3.5 w-3.5 text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{sub.description}</p>
                <p className="text-[10px] text-muted-foreground">{sub.categoryName} · Dia {sub.day_of_month}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-bold text-foreground tabular-nums">
                  R$ {Number(sub.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[10px] text-muted-foreground">{pctOfTotal.toFixed(0)}%</p>
              </div>
            </div>
          );
        })}
      </div>

      {totalMonthly > 500 && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-warning/5 border border-warning/15">
          <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />
          <p className="text-[10px] text-muted-foreground">
            Suas assinaturas somam <strong className="text-foreground">R$ {totalAnnual.toLocaleString("pt-BR")}/ano</strong>. 
            Revise se todas são essenciais.
          </p>
        </div>
      )}
    </motion.div>
  );
}
