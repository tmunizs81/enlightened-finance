import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface GoalFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: any) => void;
  initialData?: any;
  loading?: boolean;
}

export function GoalForm({ open, onOpenChange, onSubmit, initialData, loading }: GoalFormProps) {
  const [name, setName] = useState(initialData?.name || "");
  const [targetAmount, setTargetAmount] = useState(initialData?.target_amount?.toString() || "");
  const [currentAmount, setCurrentAmount] = useState(initialData?.current_amount?.toString() || "0");
  const [icon, setIcon] = useState(initialData?.icon || "🎯");
  const [color, setColor] = useState(initialData?.color || "primary");
  const [deadline, setDeadline] = useState(initialData?.deadline || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...(initialData?.id ? { id: initialData.id } : {}),
      name,
      target_amount: parseFloat(targetAmount),
      current_amount: parseFloat(currentAmount),
      icon,
      color,
      deadline: deadline || null,
    });
    if (!initialData) {
      setName(""); setTargetAmount(""); setCurrentAmount("0"); setIcon("🎯"); setDeadline("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">{initialData ? "Editar" : "Nova"} Meta</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-[60px_1fr] gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Ícone</Label>
              <Input value={icon} onChange={(e) => setIcon(e.target.value)} className="bg-secondary border-border text-center text-lg" maxLength={2} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nome da Meta</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-secondary border-border" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Valor Alvo (R$)</Label>
              <Input type="number" step="0.01" min="0" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} className="bg-secondary border-border" required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Valor Atual (R$)</Label>
              <Input type="number" step="0.01" min="0" value={currentAmount} onChange={(e) => setCurrentAmount(e.target.value)} className="bg-secondary border-border" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Prazo (opcional)</Label>
            <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="bg-secondary border-border" />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="text-muted-foreground">Cancelar</Button>
            <Button type="submit" disabled={loading} className="gradient-bg-primary text-primary-foreground">
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
