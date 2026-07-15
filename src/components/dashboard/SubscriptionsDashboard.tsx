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
  const { data: recurrings = [] } = useSupabaseQuery<RecurringTransaction>(
    "recurring_transactions" as any,
    "amount",
    false,
  );
  const { data: categories = [] } = useSupabaseQuery<Category>("categories", "name", true);

  const subscriptions = useMemo(() => {
    const catMap = new Map(categories.map((c) => [c.id, c.name]));
    return recurrings
      .filter((r) => r.type === "expense" && r.active)
      .map((r) => ({
        ...r,
        categoryName: r.category_id
          ? catMap.get(r.category_id) || "Sem categoria"
          : "Sem categoria",
      }))
      .sort((a, b) => Number(b.amount) - Number(a.amount));
  }, [recurrings, categories]);

  const totalMonthly = subscriptions.reduce((s, r) => s + Number(r.amount), 0);
  const totalAnnual = totalMonthly * 12;

  if (subscriptions.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card space-y-4 p-5"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Assinaturas & Recorrentes</h3>
        </div>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
          {subscriptions.length} ativa(s)
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-destructive/15 bg-destructive/5 p-3">
          <p className="text-[10px] text-muted-foreground">Total Mensal</p>
          <p className="text-sm font-bold text-destructive">
            R$ {totalMonthly.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-lg border border-warning/15 bg-warning/5 p-3">
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
            <div
              key={sub.id}
              className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-secondary/30"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
                <TrendingDown className="h-3.5 w-3.5 text-destructive" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground">{sub.description}</p>
                <p className="text-[10px] text-muted-foreground">
                  {sub.categoryName} · Dia {sub.day_of_month}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-bold tabular-nums text-foreground">
                  R$ {Number(sub.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[10px] text-muted-foreground">{pctOfTotal.toFixed(0)}%</p>
              </div>
            </div>
          );
        })}
      </div>

      {totalMonthly > 500 && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/15 bg-warning/5 p-2.5">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" />
          <p className="text-[10px] text-muted-foreground">
            Suas assinaturas somam{" "}
            <strong className="text-foreground">
              R$ {totalAnnual.toLocaleString("pt-BR")}/ano
            </strong>
            . Revise se todas são essenciais.
          </p>
        </div>
      )}
    </motion.div>
  );
}
