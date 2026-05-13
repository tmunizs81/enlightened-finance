import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useSupabaseQuery } from "@/hooks/use-supabase-crud";

interface Category {
  id: string;
  name: string;
  type: string;
  icon: string | null;
}

interface BudgetFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: any) => void;
  initialData?: any;
  loading?: boolean;
  month: number;
  year: number;
}

export function BudgetForm({ open, onOpenChange, onSubmit, initialData, loading, month, year }: BudgetFormProps) {
  const [categoryId, setCategoryId] = useState(initialData?.category_id || "");
  const [amount, setAmount] = useState(initialData?.amount?.toString() || "");
  const [alertThreshold, setAlertThreshold] = useState(initialData?.alert_threshold || 80);
  const [notificationsEnabled, setNotificationsEnabled] = useState(initialData?.notification_enabled ?? true);

  useEffect(() => {
    if (open) {
      setCategoryId(initialData?.category_id || "");
      setAmount(initialData?.amount?.toString() || "");
      setAlertThreshold(initialData?.alert_threshold || 80);
      setNotificationsEnabled(initialData?.notification_enabled ?? true);
    }
  }, [open, initialData]);

  const { data: categories = [] } = useSupabaseQuery<Category>("categories", "name", true);
  const expenseCategories = useMemo(() => {
    const seen = new Set<string>();
    return categories.filter((c) => {
      if (c.type !== "expense") return false;
      const key = c.name.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [categories]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId || !amount) return;
    onSubmit({
      ...(initialData?.id ? { id: initialData.id } : {}),
      category_id: categoryId,
      amount: parseFloat(amount),
      month,
      year,
      alert_threshold: alertThreshold,
      notification_enabled: notificationsEnabled,
    });
    if (!initialData) {
      setCategoryId("");
      setAmount("");
      setAlertThreshold(80);
      setNotificationsEnabled(true);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">{initialData ? "Editar" : "Novo"} Orçamento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Categoria</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue placeholder="Selecione uma categoria..." />
              </SelectTrigger>
              <SelectContent>
                {expenseCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.icon ? `${c.icon} ` : ""}{c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-4 pt-2 border-t border-border/50">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-xs font-medium">Alertas Ativos</Label>
                <p className="text-[10px] text-muted-foreground text-balance">Receber avisos visuais e notificações para esta categoria.</p>
              </div>
              <Switch checked={notificationsEnabled} onCheckedChange={setNotificationsEnabled} />
            </div>

            {notificationsEnabled && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-medium">Gatilho de Alerta ({alertThreshold}%)</Label>
                  <span className="text-[10px] font-bold text-primary">R$ {((parseFloat(amount || "0") * alertThreshold) / 100).toLocaleString("pt-BR")}</span>
                </div>
                <Slider 
                  value={[alertThreshold]} 
                  onValueChange={(v) => setAlertThreshold(v[0])} 
                  min={50} 
                  max={100} 
                  step={5} 
                  className="py-2"
                />
                <p className="text-[10px] text-muted-foreground italic">Você será avisado quando os gastos atingirem {alertThreshold}% do limite.</p>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Limite (R$)</Label>
            <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="bg-secondary border-border" required />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="text-muted-foreground">Cancelar</Button>
            <Button type="submit" disabled={loading || !categoryId} className="gradient-bg-primary text-primary-foreground">
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
