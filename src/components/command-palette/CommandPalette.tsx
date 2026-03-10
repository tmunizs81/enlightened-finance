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

interface RecentTransaction {
  id: string;
  description: string;
  amount: number;
  type: string;
  date: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [recentTx, setRecentTx] = useState<RecentTransaction[]>([]);
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

  const loadRecent = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("transactions")
      .select("id, description, amount, type, date")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5);
    if (data) setRecentTx(data);
  }, [user]);

  useEffect(() => {
    if (open) loadRecent();
  }, [open, loadRecent]);

  const go = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Buscar páginas, transações..." />
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

        {recentTx.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Transações recentes">
              {recentTx.map((t) => (
                <CommandItem key={t.id} onSelect={() => go("/transactions")} className="gap-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{t.description}</span>
                  <span className={`text-xs font-mono ${t.type === "income" ? "text-success" : "text-muted-foreground"}`}>
                    {t.type === "income" ? "+" : "-"}R$ {Number(t.amount).toLocaleString("pt-BR")}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
