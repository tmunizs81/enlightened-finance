import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSupabaseQuery, useSupabaseInsert } from "@/hooks/use-supabase-crud";
import { Plus } from "lucide-react";

interface Account {
  id: string;
  name: string;
  type: string;
  institution: string | null;
}

interface Category {
  id: string;
  name: string;
  type: string;
  icon: string | null;
}

interface TransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: any) => void;
  initialData?: any;
  loading?: boolean;
}

export function TransactionForm({ open, onOpenChange, onSubmit, initialData, loading }: TransactionFormProps) {
  const [description, setDescription] = useState(initialData?.description || "");
  const [amount, setAmount] = useState(initialData?.amount?.toString() || "");
  const [type, setType] = useState(initialData?.type || "expense");
  const [status, setStatus] = useState(initialData?.status || "pending");
  const [date, setDate] = useState(initialData?.date || new Date().toISOString().split("T")[0]);
  const [categoryId, setCategoryId] = useState(initialData?.category_id || "none");
  const [accountId, setAccountId] = useState(initialData?.account_id || "none");
  const [newCatName, setNewCatName] = useState("");
  const [showNewCat, setShowNewCat] = useState(false);

  const { data: categories = [] } = useSupabaseQuery<Category>("categories", "name", true);
  const { data: accounts = [] } = useSupabaseQuery<Account>("accounts", "name", true);
  const insertCategory = useSupabaseInsert("categories");

  const filteredCats = categories.filter((c) => c.type === type);

  const handleAddCategory = () => {
    if (!newCatName.trim()) return;
    insertCategory.mutate(
      { name: newCatName.trim(), type, icon: null, color: null } as any,
      {
        onSuccess: (data: any) => {
          setCategoryId(data.id);
          setNewCatName("");
          setShowNewCat(false);
        },
      }
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...(initialData?.id ? { id: initialData.id } : {}),
      description,
      amount: parseFloat(amount),
      type,
      status,
      date,
      category_id: categoryId === "none" ? null : categoryId,
      account_id: accountId === "none" ? null : accountId,
    });
    if (!initialData) {
      setDescription(""); setAmount(""); setType("expense"); setStatus("pending"); setCategoryId("none"); setAccountId("none");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">{initialData ? "Editar" : "Nova"} Transação</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Descrição</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} className="bg-secondary border-border" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Valor (R$)</Label>
              <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="bg-secondary border-border" required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-secondary border-border" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tipo</Label>
              <Select value={type} onValueChange={(v) => { setType(v); setCategoryId("none"); }}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Despesa</SelectItem>
                  <SelectItem value="income">Receita</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="paid">Pago</SelectItem>
                  <SelectItem value="overdue">Atrasado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Categoria</Label>
            {!showNewCat ? (
              <div className="flex gap-2">
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger className="bg-secondary border-border flex-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem categoria</SelectItem>
                    {filteredCats.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.icon ? `${c.icon} ` : ""}{c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="icon" className="shrink-0 border-border text-muted-foreground hover:text-primary" onClick={() => setShowNewCat(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder={`Nova categoria de ${type === "income" ? "receita" : "despesa"}...`}
                  className="bg-secondary border-border flex-1"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddCategory(); } }}
                />
                <Button type="button" size="sm" disabled={insertCategory.isPending || !newCatName.trim()} onClick={handleAddCategory} className="gradient-bg-primary text-primary-foreground text-xs">
                  {insertCategory.isPending ? "..." : "Criar"}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setShowNewCat(false); setNewCatName(""); }} className="text-muted-foreground text-xs">
                  ✕
                </Button>
              </div>
            )}
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
