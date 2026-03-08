import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AccountFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: any) => void;
  initialData?: any;
  loading?: boolean;
}

export function AccountForm({ open, onOpenChange, onSubmit, initialData, loading }: AccountFormProps) {
  const [name, setName] = useState(initialData?.name || "");
  const [type, setType] = useState(initialData?.type || "checking");
  const [institution, setInstitution] = useState(initialData?.institution || "");
  const [balance, setBalance] = useState(initialData?.balance?.toString() || "0");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...(initialData?.id ? { id: initialData.id } : {}),
      name,
      type,
      institution,
      balance: parseFloat(balance),
    });
    if (!initialData) {
      setName(""); setType("checking"); setInstitution(""); setBalance("0");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">{initialData ? "Editar" : "Nova"} Conta</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nome da Conta</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-secondary border-border" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tipo</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="checking">Conta Corrente</SelectItem>
                  <SelectItem value="savings">Poupança</SelectItem>
                  <SelectItem value="credit">Cartão de Crédito</SelectItem>
                  <SelectItem value="investment">Investimento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Instituição</Label>
              <Input value={institution} onChange={(e) => setInstitution(e.target.value)} className="bg-secondary border-border" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Saldo Atual (R$)</Label>
            <Input type="number" step="0.01" value={balance} onChange={(e) => setBalance(e.target.value)} className="bg-secondary border-border" required />
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
