import { useState } from "react";
import { motion } from "framer-motion";
import { CreditCard, Landmark, PiggyBank, TrendingUp, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSupabaseQuery, useSupabaseInsert, useSupabaseUpdate, useSupabaseDelete } from "@/hooks/use-supabase-crud";
import { AccountForm } from "@/components/forms/AccountForm";

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

interface Account {
  id: string;
  name: string;
  type: string;
  institution: string | null;
  balance: number;
  user_id: string;
}

const Accounts = () => {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);

  const { data: accounts = [], isLoading } = useSupabaseQuery<Account>("accounts");
  const insertMutation = useSupabaseInsert("accounts");
  const updateMutation = useSupabaseUpdate("accounts");
  const deleteMutation = useSupabaseDelete("accounts");

  const total = accounts.reduce((s, a) => s + Number(a.balance), 0);

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
        <p className="text-xs text-muted-foreground">Patrimônio Total</p>
        <p className="text-3xl font-bold gradient-text-primary mt-1">
          R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
        </p>
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
            return (
              <motion.div key={acc.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="glass-card-hover p-5">
                <div className="flex items-start gap-4">
                  <div className="gradient-bg-primary rounded-lg p-2.5">
                    <Icon className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">{acc.name}</p>
                    <p className="text-xs text-muted-foreground">{acc.institution || "—"} · {typeLabels[acc.type] || acc.type}</p>
                    <p className={`text-lg font-bold mt-2 ${isNegative ? "text-destructive" : "text-foreground"}`}>
                      R$ {Number(acc.balance).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
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
