import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight, Search, Plus, Pencil, Trash2, Paperclip } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSupabaseQuery, useSupabaseInsert, useSupabaseUpdate, useSupabaseDelete } from "@/hooks/use-supabase-crud";
import { TransactionForm } from "@/components/forms/TransactionForm";

const statusStyles: Record<string, string> = {
  paid: "bg-success/15 text-success border-success/20",
  pending: "bg-warning/15 text-warning border-warning/20",
  overdue: "bg-destructive/15 text-destructive border-destructive/20",
};

const statusLabels: Record<string, string> = {
  paid: "Pago",
  pending: "Pendente",
  overdue: "Atrasado",
};

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: string;
  status: string;
  date: string;
  user_id: string;
  account_id: string | null;
  category_id: string | null;
  notes: string | null;
  receipt_url: string | null;
}

interface Category {
  id: string;
  name: string;
  icon: string | null;
}

const Transactions = () => {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const { data: transactions = [], isLoading } = useSupabaseQuery<Transaction>("transactions", "date", false);
  const { data: categories = [] } = useSupabaseQuery<Category>("categories", "name", true);
  const insertMutation = useSupabaseInsert("transactions");
  const updateMutation = useSupabaseUpdate("transactions");
  const deleteMutation = useSupabaseDelete("transactions");

  const catMap = new Map(categories.map((c) => [c.id, c]));

  const filtered = transactions.filter((t) => {
    const matchSearch = t.description.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || t.type === filter;
    return matchSearch && matchFilter;
  });

  const handleSubmit = (data: any) => {
    if (data.id) {
      updateMutation.mutate(data, { onSuccess: () => { setEditing(null); setFormOpen(false); } });
    } else {
      insertMutation.mutate(data, { onSuccess: () => setFormOpen(false) });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Transações</h1>
          <p className="text-sm text-muted-foreground">Gerencie suas receitas e despesas</p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="gradient-bg-primary text-primary-foreground gap-2">
          <Plus className="h-4 w-4" /> Nova
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar transações..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-secondary border-border" />
        </div>
        <div className="flex gap-2">
          {(["all", "income", "expense"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${filter === f ? "gradient-bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
              {f === "all" ? "Todos" : f === "income" ? "Receitas" : "Despesas"}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-sm">Nenhuma transação encontrada</p>
          <p className="text-muted-foreground text-xs mt-1">Clique em "Nova" para adicionar</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((t, i) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="glass-card-hover p-4 flex items-center gap-4">
              <div className={`rounded-lg p-2 ${t.type === "income" ? "bg-success/15" : "bg-destructive/15"}`}>
                {t.type === "income" ? <ArrowUpRight className="h-4 w-4 text-success" /> : <ArrowDownRight className="h-4 w-4 text-destructive" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{t.description}</p>
                <p className="text-xs text-muted-foreground">
                  {t.category_id && catMap.has(t.category_id) ? `${catMap.get(t.category_id)!.icon || ""}${catMap.get(t.category_id)!.name} · ` : ""}{new Date(t.date).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <Badge variant="outline" className={`text-[10px] hidden sm:flex ${statusStyles[t.status]}`}>{statusLabels[t.status]}</Badge>
              <p className={`text-sm font-bold tabular-nums ${t.type === "income" ? "text-success" : "text-foreground"}`}>
                {t.type === "income" ? "+" : "-"} R$ {Number(t.amount).toLocaleString("pt-BR")}
              </p>
              <div className="flex gap-1">
                {t.receipt_url && (
                  <a href={t.receipt_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-primary hover:text-primary/80" type="button">
                      <Paperclip className="h-3 w-3" />
                    </Button>
                  </a>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => { setEditing(t); setFormOpen(true); }}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteMutation.mutate(t.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <TransactionForm
        open={formOpen}
        onOpenChange={(v) => { setFormOpen(v); if (!v) setEditing(null); }}
        onSubmit={handleSubmit}
        initialData={editing}
        loading={insertMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
};

export default Transactions;
