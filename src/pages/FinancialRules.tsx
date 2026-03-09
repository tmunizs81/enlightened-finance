import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Plus, Trash2, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useSupabaseQuery, useSupabaseInsert, useSupabaseDelete, useSupabaseUpdate } from "@/hooks/use-supabase-crud";
import { toast } from "sonner";

interface Rule {
  id: string;
  name: string;
  condition_type: string;
  condition_category_id: string | null;
  condition_amount: number | null;
  condition_period: string;
  action_type: string;
  action_message: string | null;
  active: boolean;
}

interface Category {
  id: string;
  name: string;
  type: string;
}

const FinancialRules = () => {
  const [formOpen, setFormOpen] = useState(false);
  const { data: rules = [], isLoading } = useSupabaseQuery<Rule>("financial_rules" as any);
  const { data: categories = [] } = useSupabaseQuery<Category>("categories", "name", true);
  const insertMutation = useSupabaseInsert("financial_rules" as any);
  const updateMutation = useSupabaseUpdate("financial_rules" as any);
  const deleteMutation = useSupabaseDelete("financial_rules" as any);

  const [name, setName] = useState("");
  const [conditionType, setConditionType] = useState("category_spending");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = () => {
    if (!name || !amount) { toast.error("Preencha nome e valor"); return; }
    insertMutation.mutate({
      name,
      condition_type: conditionType,
      condition_category_id: conditionType === "category_spending" ? categoryId || null : null,
      condition_amount: parseFloat(amount),
      action_type: "alert",
      action_message: message || null,
    } as any, {
      onSuccess: () => {
        setFormOpen(false);
        setName(""); setAmount(""); setMessage(""); setCategoryId("");
      }
    });
  };

  const expenseCategories = categories.filter((c) => c.type === "expense");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Regras Automáticas</h1>
          <p className="text-sm text-muted-foreground">Configure alertas automáticos para seus gastos</p>
        </div>
        <Button onClick={() => setFormOpen(true)} className="gradient-bg-primary text-primary-foreground gap-2">
          <Plus className="h-4 w-4" /> Nova Regra
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Carregando...</div>
      ) : rules.length === 0 ? (
        <div className="text-center py-12">
          <Zap className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma regra criada</p>
          <p className="text-xs text-muted-foreground mt-1">Exemplo: "Me avise se gastar mais de R$500 com alimentação"</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {rules.map((rule, i) => {
              const catName = rule.condition_category_id
                ? categories.find((c) => c.id === rule.condition_category_id)?.name || "Categoria"
                : "Total";
              return (
                <motion.div key={rule.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.05 }} className="glass-card-hover p-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-warning/15 flex items-center justify-center shrink-0">
                    <Zap className="h-5 w-5 text-warning" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{rule.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Se {rule.condition_type === "category_spending" ? `gastos em ${catName}` : "gastos totais"} &gt; R$ {Number(rule.condition_amount).toLocaleString("pt-BR")}
                    </p>
                    {rule.action_message && <p className="text-[10px] text-muted-foreground mt-0.5">"{rule.action_message}"</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={rule.active}
                      onCheckedChange={(v) => updateMutation.mutate({ id: rule.id, active: v } as any)}
                    />
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteMutation.mutate(rule.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="bg-background border-border">
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Zap className="h-4 w-4 text-warning" /> Nova Regra Automática
          </DialogTitle>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Nome da regra</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Limite de alimentação" className="bg-secondary border-border" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Tipo de condição</Label>
              <Select value={conditionType} onValueChange={setConditionType}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="category_spending">Gasto por categoria</SelectItem>
                  <SelectItem value="total_spending">Gasto total do mês</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {conditionType === "category_spending" && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Categoria</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Valor limite (R$)</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="500" className="bg-secondary border-border" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Mensagem personalizada (opcional)</Label>
              <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Cuidado com os gastos!" className="bg-secondary border-border" />
            </div>
            <Button onClick={handleSubmit} disabled={insertMutation.isPending} className="w-full gradient-bg-primary text-primary-foreground">
              Criar Regra
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FinancialRules;
