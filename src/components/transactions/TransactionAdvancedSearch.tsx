import { useState } from "react";
import { Filter, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Category {
  id: string;
  name: string;
  icon: string | null;
  type: string;
}

interface Account {
  id: string;
  name: string;
}

export interface AdvancedFilters {
  dateFrom: string;
  dateTo: string;
  categoryId: string;
  accountId: string;
  status: string;
  amountMin: string;
  amountMax: string;
}

const emptyFilters: AdvancedFilters = {
  dateFrom: "",
  dateTo: "",
  categoryId: "",
  accountId: "",
  status: "",
  amountMin: "",
  amountMax: "",
};

interface Props {
  filters: AdvancedFilters;
  onChange: (filters: AdvancedFilters) => void;
  categories: Category[];
  accounts: Account[];
}

export function TransactionAdvancedSearch({ filters, onChange, categories, accounts }: Props) {
  const [open, setOpen] = useState(false);

  const activeCount = Object.values(filters).filter(Boolean).length;

  const clearAll = () => onChange(emptyFilters);

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(!open)}
        className="gap-2 text-xs"
      >
        <Filter className="h-3.5 w-3.5" />
        Filtros avançados
        {activeCount > 0 && (
          <span className="bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 text-[10px] font-bold">
            {activeCount}
          </span>
        )}
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </Button>

      {open && (
        <div className="glass-card p-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-foreground">Filtros</p>
            {activeCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAll} className="h-6 text-xs gap-1 text-muted-foreground">
                <X className="h-3 w-3" /> Limpar
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground font-medium">Data inicial</label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
                className="h-8 text-xs bg-secondary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground font-medium">Data final</label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
                className="h-8 text-xs bg-secondary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground font-medium">Categoria</label>
              <Select value={filters.categoryId} onValueChange={(v) => onChange({ ...filters, categoryId: v === "all" ? "" : v })}>
                <SelectTrigger className="h-8 text-xs bg-secondary">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.icon || ""} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground font-medium">Conta</label>
              <Select value={filters.accountId} onValueChange={(v) => onChange({ ...filters, accountId: v === "all" ? "" : v })}>
                <SelectTrigger className="h-8 text-xs bg-secondary">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground font-medium">Status</label>
              <Select value={filters.status} onValueChange={(v) => onChange({ ...filters, status: v === "all" ? "" : v })}>
                <SelectTrigger className="h-8 text-xs bg-secondary">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="paid">Pago</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="overdue">Atrasado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground font-medium">Valor mínimo</label>
              <Input
                type="number"
                placeholder="0,00"
                value={filters.amountMin}
                onChange={(e) => onChange({ ...filters, amountMin: e.target.value })}
                className="h-8 text-xs bg-secondary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground font-medium">Valor máximo</label>
              <Input
                type="number"
                placeholder="0,00"
                value={filters.amountMax}
                onChange={(e) => onChange({ ...filters, amountMax: e.target.value })}
                className="h-8 text-xs bg-secondary"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { emptyFilters };
