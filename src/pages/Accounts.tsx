import { useState } from "react";
import { motion } from "framer-motion";
import { CreditCard, Landmark, PiggyBank, TrendingUp, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSupabaseQuery, useSupabaseInsert, useSupabaseUpdate, useSupabaseDelete } from "@/hooks/use-supabase-crud";
import { AccountForm, CURRENCIES } from "@/components/forms/AccountForm";

const iconMap: Record<string, any> = {
  checking: Landmark,
  savings: PiggyBank,
  credit: CreditCard,
  investment: TrendingUp,
};

const typeLabels: Record<string, string> = {
  checking: "Conta Corrente",
  savings: "Poupança",
  credit: "Cartão de Crédito",
  investment: "Investimento",
};

function getCurrencySymbol(code: string) {
  return CURRENCIES.find((c) => c.code === code)?.symbol || "R$";
}

function formatCurrency(value: number, currency: string) {
  const symbol = getCurrencySymbol(currency);
  return `${symbol} ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

interface Account {
  id: string;
  name: string;
  type: string;
  institution: string | null;
  balance: number;
  currency: string;
  user_id: string;
}

const Accounts = () => {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);

  const { data: accounts = [], isLoading } = useSupabaseQuery<Account>("accounts");
  const insertMutation = useSupabaseInsert("accounts");
  const updateMutation = useSupabaseUpdate("accounts");
  const deleteMutation = useSupabaseDelete("accounts");

  // Group by currency
  const byCurrency = accounts.reduce<Record<string, Account[]>>((acc, a) => {
    const cur = a.currency || "BRL";
    if (!acc[cur]) acc[cur] = [];
    acc[cur].push(a);
    return acc;
  }, {});

  const totalBRL = accounts
    .filter((a) => (a.currency || "BRL") === "BRL")
    .reduce((s, a) => s + Number(a.balance), 0);

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
          <h1 className="text-2xl font-bold text-foreground">Contas</h1>
          <p className="text-sm text-muted-foreground">Gerencie suas contas bancárias e cartões</p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="gradient-bg-primary text-primary-foreground gap-2">
          <Plus className="h-4 w-4" /> Nova Conta
        </Button>
      </div>

      <div className="glass-card p-5">
        <p className="text-xs text-muted-foreground">Patrimônio Total (BRL)</p>
        <p className="text-3xl font-bold gradient-text-primary mt-1">
          R$ {totalBRL.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
        </p>
        {Object.entries(byCurrency)
          .filter(([cur]) => cur !== "BRL")
          .map(([cur, accs]) => {
            const total = accs.reduce((s, a) => s + Number(a.balance), 0);
            return (
              <p key={cur} className="text-sm text-muted-foreground mt-1">
                {formatCurrency(total, cur)}
              </p>
            );
          })}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Carregando...</div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-sm">Nenhuma conta cadastrada</p>
          <p className="text-muted-foreground text-xs mt-1">Clique em "Nova Conta" para adicionar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {accounts.map((acc, i) => {
            const Icon = iconMap[acc.type] || Landmark;
            const isNegative = Number(acc.balance) < 0;
            const cur = acc.currency || "BRL";
            return (
              <motion.div key={acc.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="glass-card-hover p-5">
                <div className="flex items-start gap-4">
                  <div className="gradient-bg-primary rounded-lg p-2.5">
                    <Icon className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{acc.name}</p>
                      {cur !== "BRL" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/15 text-accent font-medium">{cur}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{acc.institution || "—"} · {typeLabels[acc.type] || acc.type}</p>
                    <p className={`text-lg font-bold mt-2 ${isNegative ? "text-destructive" : "text-foreground"}`}>
                      {formatCurrency(Number(acc.balance), cur)}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => { setEditing(acc); setFormOpen(true); }}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteMutation.mutate(acc.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <AccountForm
        open={formOpen}
        onOpenChange={(v) => { setFormOpen(v); if (!v) setEditing(null); }}
        onSubmit={handleSubmit}
        initialData={editing}
        loading={insertMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
};

export default Accounts;
