import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Category {
  id: string;
  name: string;
  icon: string | null;
  type: string;
}

interface Split {
  id?: string;
  category_id: string | null;
  description: string;
  amount: string;
}

interface TransactionSplitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactionId: string;
  transactionAmount: number;
  transactionType: string;
  transactionDescription: string;
  categories: Category[];
  onSaved: () => void;
}

export function TransactionSplitDialog({
  open, onOpenChange, transactionId, transactionAmount,
  transactionType, transactionDescription, categories, onSaved,
}: TransactionSplitDialogProps) {
  const [splits, setSplits] = useState<Split[]>([]);
  const [saving, setSaving] = useState(false);

  const filteredCats = categories.filter((c) => c.type === transactionType);

  useEffect(() => {
    if (open && transactionId) loadSplits();
  }, [open, transactionId]);

  const loadSplits = async () => {
    const { data } = await supabase
      .from("transaction_splits" as any)
      .select("*")
      .eq("transaction_id", transactionId)
      .order("created_at", { ascending: true });

    if (data && (data as any[]).length > 0) {
      setSplits((data as any[]).map((s: any) => ({
        id: s.id,
        category_id: s.category_id,
        description: s.description || "",
        amount: String(s.amount),
      })));
    } else {
      setSplits([
        { category_id: null, description: transactionDescription, amount: String(transactionAmount / 2) },
        { category_id: null, description: "", amount: String(transactionAmount / 2) },
      ]);
    }
  };

  const totalSplits = splits.reduce((s, sp) => s + (parseFloat(sp.amount) || 0), 0);
  const diff = transactionAmount - totalSplits;

  const addSplit = () => {
    setSplits([...splits, { category_id: null, description: "", amount: diff > 0 ? String(diff) : "0" }]);
  };

  const removeSplit = (idx: number) => {
    if (splits.length <= 2) return;
    setSplits(splits.filter((_, i) => i !== idx));
  };

  const updateSplit = (idx: number, field: keyof Split, value: string) => {
    const updated = [...splits];
    (updated[idx] as any)[field] = value;
    setSplits(updated);
  };

  const handleSave = async () => {
    if (Math.abs(diff) > 0.01) {
      toast.error(`A soma dos splits deve ser igual a R$ ${transactionAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
      return;
    }

    setSaving(true);
    try {
      // Delete existing splits
      await supabase
        .from("transaction_splits" as any)
        .delete()
        .eq("transaction_id", transactionId);

      // Insert new splits
      const inserts = splits.map((s) => ({
        transaction_id: transactionId,
        category_id: s.category_id || null,
        description: s.description || null,
        amount: parseFloat(s.amount),
      }));

      const { error } = await supabase
        .from("transaction_splits" as any)
        .insert(inserts as any);

      if (error) throw error;
      toast.success("Splits salvos com sucesso!");
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Erro ao salvar splits: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">Dividir Transação</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Total: R$ {transactionAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </DialogHeader>

        <div className="space-y-3">
          {splits.map((split, idx) => (
            <div key={idx} className="glass-card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Split {idx + 1}</span>
                {splits.length > 2 && (
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeSplit(idx)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Descrição</Label>
                  <Input
                    value={split.description}
                    onChange={(e) => updateSplit(idx, "description", e.target.value)}
                    className="h-8 text-xs bg-secondary border-border"
                    placeholder="Descrição..."
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Valor (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={split.amount}
                    onChange={(e) => updateSplit(idx, "amount", e.target.value)}
                    className="h-8 text-xs bg-secondary border-border"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Categoria</Label>
                <Select value={split.category_id || "none"} onValueChange={(v) => updateSplit(idx, "category_id", v === "none" ? "" : v)}>
                  <SelectTrigger className="h-8 text-xs bg-secondary border-border">
                    <SelectValue placeholder="Categoria..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem categoria</SelectItem>
                    {filteredCats.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.icon ? `${c.icon} ` : ""}{c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>

        <Button variant="outline" size="sm" className="w-full gap-2 text-xs border-dashed border-border text-muted-foreground" onClick={addSplit}>
          <Plus className="h-3 w-3" /> Adicionar split
        </Button>

        <div className={`text-center text-xs font-medium ${Math.abs(diff) > 0.01 ? "text-destructive" : "text-success"}`}>
          {Math.abs(diff) > 0.01
            ? `Diferença: R$ ${Math.abs(diff).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} ${diff > 0 ? "restante" : "excedente"}`
            : "✓ Valores conferem"}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-muted-foreground">Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || Math.abs(diff) > 0.01} className="gradient-bg-primary text-primary-foreground">
            {saving ? "Salvando..." : "Salvar Splits"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
