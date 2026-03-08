import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { PiggyBank, Plus, Pencil, Trash2, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useSupabaseQuery, useSupabaseInsert, useSupabaseUpdate, useSupabaseDelete } from "@/hooks/use-supabase-crud";
import { BudgetForm } from "@/components/forms/BudgetForm";
import { toast } from "sonner";

interface Budget {
  id: string;
  category_id: string | null;
  amount: number;
  month: number;
  year: number;
  user_id: string;
}

interface Category {
  id: string;
  name: string;
  type: string;
  icon: string | null;
  color: string | null;
}

interface Transaction {
  id: string;
  amount: number;
  type: string;
  category_id: string | null;
  date: string;
  status: string;
}

const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const Budgets = () => {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);

  const { data: budgets = [], isLoading } = useSupabaseQuery<Budget>("budgets", "created_at", false);
  const { data: categories = [] } = useSupabaseQuery<Category>("categories", "name", true);
  const { data: transactions = [] } = useSupabaseQuery<Transaction>("transactions", "date", false);

  const insertBudget = useSupabaseInsert("budgets");
  const updateBudget = useSupabaseUpdate("budgets");
  const deleteBudget = useSupabaseDelete("budgets");

  const catMap = new Map(categories.map((c) => [c.id, c]));

  const monthBudgets = budgets.filter((b) => b.month === month && b.year === year);

  // Calculate actual spending per category for the selected month
  const spending = useMemo(() => {
    const map: Record<string, number> = {};
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = `${year}-${String(month).padStart(2, "0")}-31`;

    transactions
      .filter((t) => t.type === "expense" && t.date >= startDate && t.date <= endDate)
      .forEach((t) => {
        const key = t.category_id || "none";
        map[key] = (map[key] || 0) + Number(t.amount);
      });
    return map;
  }, [transactions, month, year]);

  const totalBudget = monthBudgets.reduce((s, b) => s + Number(b.amount), 0);
  const totalSpent = monthBudgets.reduce((s, b) => s + (spending[b.category_id || "none"] || 0), 0);

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(year - 1); }
    else setMonth(month - 1);
  };

  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(year + 1); }
    else setMonth(month + 1);
  };

  const handleSubmit = (data: any) => {
    if (data.id) {
      updateBudget.mutate(data, { onSuccess: () => { setEditing(null); setFormOpen(false); } });
    } else {
      // Check if budget already exists for this category/month/year
      const exists = monthBudgets.find((b) => b.category_id === data.category_id);
      if (exists) {
        toast.error("Já existe um orçamento para esta categoria neste mês.");
        return;
      }
      insertBudget.mutate(data, { onSuccess: () => setFormOpen(false) });
    }
  };

  const overBudgetCount = monthBudgets.filter((b) => {
    const spent = spending[b.category_id || "none"] || 0;
    return spent > Number(b.amount);
  }).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="gradient-bg-primary rounded-lg p-2.5">
            <PiggyBank className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Orçamentos</h1>
            <p className="text-sm text-muted-foreground">Controle seus gastos por categoria</p>
          </div>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="gradient-bg-primary text-primary-foreground gap-2">
          <Plus className="h-4 w-4" /> Novo
        </Button>
      </div>

      {/* Month Selector */}
      <div className="flex items-center justify-center gap-4">
        <Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8 text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold text-foreground min-w-[160px] text-center">
          {monthNames[month - 1]} {year}
        </span>
        <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8 text-muted-foreground hover:text-foreground">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-card p-4 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Orçado</p>
          <p className="text-lg font-bold text-foreground">R$ {totalBudget.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Gasto</p>
          <p className={`text-lg font-bold ${totalSpent > totalBudget ? "text-destructive" : "text-foreground"}`}>
            R$ {totalSpent.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Disponível</p>
          <p className={`text-lg font-bold ${totalBudget - totalSpent >= 0 ? "text-success" : "text-destructive"}`}>
            R$ {(totalBudget - totalSpent).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Over budget alert */}
      {overBudgetCount > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-xs text-destructive">
            <strong>{overBudgetCount} {overBudgetCount === 1 ? "categoria ultrapassou" : "categorias ultrapassaram"}</strong> o limite de orçamento neste mês!
          </p>
        </motion.div>
      )}

      {/* Budget List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Carregando...</div>
      ) : monthBudgets.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <PiggyBank className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum orçamento definido para este mês.</p>
          <p className="text-xs text-muted-foreground mt-1">Crie categorias de despesa e defina limites mensais.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {monthBudgets.map((budget, i) => {
            const cat = catMap.get(budget.category_id || "");
            const spent = spending[budget.category_id || "none"] || 0;
            const limit = Number(budget.amount);
            const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
            const isOver = spent > limit;
            const isWarning = pct >= 80 && !isOver;

            return (
              <motion.div
                key={budget.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass-card-hover p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{cat?.icon || "📁"}</span>
                    <span className="text-sm font-semibold text-foreground">{cat?.name || "Sem categoria"}</span>
                    {isOver && (
                      <Badge variant="outline" className="text-[10px] bg-destructive/15 text-destructive border-destructive/20">
                        <AlertTriangle className="h-2.5 w-2.5 mr-1" /> Estourado
                      </Badge>
                    )}
                    {isWarning && (
                      <Badge variant="outline" className="text-[10px] bg-warning/15 text-warning border-warning/20">
                        Quase no limite
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => { setEditing(budget); setFormOpen(true); }}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteBudget.mutate(budget.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      R$ {spent.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} / R$ {limit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                    <span className={`font-semibold ${isOver ? "text-destructive" : isWarning ? "text-warning" : "text-muted-foreground"}`}>
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                  <Progress
                    value={pct}
                    className={`h-2 ${isOver ? "[&>div]:bg-destructive" : isWarning ? "[&>div]:bg-warning" : "[&>div]:bg-primary"}`}
                  />
                  {isOver && (
                    <p className="text-[11px] text-destructive">
                      Excedido em R$ {(spent - limit).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <BudgetForm
        open={formOpen}
        onOpenChange={(v) => { setFormOpen(v); if (!v) setEditing(null); }}
        onSubmit={handleSubmit}
        initialData={editing}
        loading={insertBudget.isPending || updateBudget.isPending}
        month={month}
        year={year}
      />
    </div>
  );
};

export default Budgets;
