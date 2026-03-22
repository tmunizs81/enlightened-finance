import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard, ArrowLeftRight, Target, Wallet, PiggyBank, Repeat,
  FileText, Brain, Settings, Trophy, Zap, Key, Download, Plus, Search,
  DollarSign,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

const pages = [
  { name: "Dashboard", path: "/", icon: LayoutDashboard },
  { name: "Transações", path: "/transactions", icon: ArrowLeftRight },
  { name: "Recorrentes", path: "/recurring", icon: Repeat },
  { name: "Orçamentos", path: "/budgets", icon: PiggyBank },
  { name: "Metas", path: "/goals", icon: Target },
  { name: "Contas", path: "/accounts", icon: Wallet },
  { name: "Conquistas", path: "/achievements", icon: Trophy },
  { name: "Relatórios", path: "/reports", icon: FileText },
  { name: "Insights IA", path: "/insights", icon: Brain },
  { name: "Regras", path: "/rules", icon: Zap },
  { name: "Instalar App", path: "/install", icon: Download },
  { name: "Minha Licença", path: "/license", icon: Key },
  { name: "Configurações", path: "/settings", icon: Settings },
];

interface SearchResult {
  id: string;
  label: string;
  sublabel: string;
  type: "transaction" | "goal" | "budget" | "account";
  path: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const searchAll = useCallback(async (q: string) => {
    if (!user || !q || q.length < 2) {
      setResults([]);
      return;
    }

    const pattern = `%${q}%`;

    const [txRes, goalRes, accRes] = await Promise.all([
      supabase
        .from("transactions")
        .select("id, description, amount, type, date")
        .ilike("description", pattern)
        .order("date", { ascending: false })
        .limit(5),
      supabase
        .from("goals")
        .select("id, name, target_amount, current_amount")
        .ilike("name", pattern)
        .limit(5),
      supabase
        .from("accounts")
        .select("id, name, balance, type")
        .ilike("name", pattern)
        .limit(5),
    ]);

    const items: SearchResult[] = [];

    txRes.data?.forEach((t) =>
      items.push({
        id: t.id,
        label: t.description,
        sublabel: `${t.type === "income" ? "+" : "-"}R$ ${Number(t.amount).toLocaleString("pt-BR")} · ${new Date(t.date).toLocaleDateString("pt-BR")}`,
        type: "transaction",
        path: "/transactions",
      })
    );

    goalRes.data?.forEach((g) =>
      items.push({
        id: g.id,
        label: g.name,
        sublabel: `R$ ${Number(g.current_amount).toLocaleString("pt-BR")} / R$ ${Number(g.target_amount).toLocaleString("pt-BR")}`,
        type: "goal",
        path: "/goals",
      })
    );

    accRes.data?.forEach((a) =>
      items.push({
        id: a.id,
        label: a.name,
        sublabel: `Saldo: R$ ${Number(a.balance).toLocaleString("pt-BR")}`,
        type: "account",
        path: "/accounts",
      })
    );

    setResults(items);
  }, [user]);

  useEffect(() => {
    const timer = setTimeout(() => searchAll(query), 200);
    return () => clearTimeout(timer);
  }, [query, searchAll]);

  const go = (path: string) => {
    navigate(path);
    setOpen(false);
    setQuery("");
    setResults([]);
  };

  const typeIcons: Record<string, typeof Search> = {
    transaction: ArrowLeftRight,
    goal: Target,
    budget: PiggyBank,
    account: Wallet,
  };

  const typeLabels: Record<string, string> = {
    transaction: "Transações",
    goal: "Metas",
    budget: "Orçamentos",
    account: "Contas",
  };

  const groupedResults = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.type]) acc[r.type] = [];
    acc[r.type].push(r);
    return acc;
  }, {});

  return (
    <CommandDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setQuery(""); setResults([]); } }}>
      <CommandInput
        placeholder="Buscar transações, metas, contas..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

        <CommandGroup heading="Páginas">
          {pages.map((p) => (
            <CommandItem key={p.path} onSelect={() => go(p.path)} className="gap-2">
              <p.icon className="h-4 w-4 text-muted-foreground" />
              <span>{p.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Ações rápidas">
          <CommandItem onSelect={() => go("/transactions?new=1")} className="gap-2">
            <Plus className="h-4 w-4 text-muted-foreground" />
            <span>Nova transação</span>
          </CommandItem>
          <CommandItem onSelect={() => go("/goals?new=1")} className="gap-2">
            <Plus className="h-4 w-4 text-muted-foreground" />
            <span>Nova meta</span>
          </CommandItem>
          <CommandItem onSelect={() => go("/budgets?new=1")} className="gap-2">
            <Plus className="h-4 w-4 text-muted-foreground" />
            <span>Novo orçamento</span>
          </CommandItem>
        </CommandGroup>

        {Object.entries(groupedResults).map(([type, items]) => (
          <div key={type}>
            <CommandSeparator />
            <CommandGroup heading={typeLabels[type] || type}>
              {items.map((item) => {
                const Icon = typeIcons[item.type] || Search;
                return (
                  <CommandItem key={item.id} onSelect={() => go(item.path)} className="gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <span className="truncate block text-sm">{item.label}</span>
                      <span className="text-xs text-muted-foreground truncate block">{item.sublabel}</span>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </div>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
