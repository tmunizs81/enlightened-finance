import { useState } from "react";
import { motion } from "framer-motion";
import { transactions, type Transaction } from "@/lib/mock-data";
import { ArrowUpRight, ArrowDownRight, Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

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

const Transactions = () => {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");

  const filtered = transactions.filter((t) => {
    const matchSearch = t.description.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || t.type === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Transações</h1>
        <p className="text-sm text-muted-foreground">Gerencie suas receitas e despesas</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar transações..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-secondary border-border"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "income", "expense"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
                filter === f
                  ? "gradient-bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "all" ? "Todos" : f === "income" ? "Receitas" : "Despesas"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {filtered.map((t, i) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="glass-card-hover p-4 flex items-center gap-4"
          >
            <div className={`rounded-lg p-2 ${t.type === "income" ? "bg-success/15" : "bg-destructive/15"}`}>
              {t.type === "income" ? (
                <ArrowUpRight className="h-4 w-4 text-success" />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-destructive" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{t.description}</p>
              <p className="text-xs text-muted-foreground">
                {t.category} · {t.account} · {new Date(t.date).toLocaleDateString("pt-BR")}
              </p>
            </div>
            <Badge variant="outline" className={`text-[10px] ${statusStyles[t.status]}`}>
              {statusLabels[t.status]}
            </Badge>
            <p className={`text-sm font-bold tabular-nums ${t.type === "income" ? "text-success" : "text-foreground"}`}>
              {t.type === "income" ? "+" : "-"} R$ {t.amount.toLocaleString("pt-BR")}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Transactions;
