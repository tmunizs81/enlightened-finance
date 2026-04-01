import { useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  Repeat, Plus, Pencil, Trash2, ArrowUpRight, ArrowDownRight,
  Pause, Play, Calendar, Paperclip, FileText, X, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useSupabaseQuery, useSupabaseInsert, useSupabaseUpdate, useSupabaseDelete } from "@/hooks/use-supabase-crud";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

interface RecurringTransaction {
  id: string;
  description: string;
  amount: number;
  type: string;
  category_id: string | null;
  account_id: string | null;
  day_of_month: number;
  active: boolean;
  last_generated: string | null;
  user_id: string;
  boleto_url: string | null;
}

interface Category {
  id: string;
  name: string;
  type: string;
  icon: string | null;
}

interface Account {
  id: string;
  name: string;
  institution: string | null;
}

function RecurringForm({
  open, onOpenChange, onSubmit, initialData, loading,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (d: any) => void;
  initialData?: RecurringTransaction | null;
  loading: boolean;
}) {
  const { user } = useAuth();
  const boletoRef = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState(initialData?.description || "");
  const [amount, setAmount] = useState(initialData?.amount?.toString() || "");
  const [type, setType] = useState(initialData?.type || "expense");
  const [dayOfMonth, setDayOfMonth] = useState(initialData?.day_of_month?.toString() || "1");
  const [categoryId, setCategoryId] = useState(initialData?.category_id || "none");
  const [accountId, setAccountId] = useState(initialData?.account_id || "none");
  const [boletoFile, setBoletoFile] = useState<File | null>(null);
  const [boletoPreview, setBoletoPreview] = useState<string | null>(initialData?.boleto_url || null);
  const [uploading, setUploading] = useState(false);

  const { data: categories = [] } = useSupabaseQuery<Category>("categories", "name", true);
  const { data: accounts = [] } = useSupabaseQuery<Account>("accounts", "name", true);
  const filteredCats = categories.filter((c) => c.type === type);

  const handleBoletoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Arquivo muito grande. Máximo: 10MB"); return; }
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(file.type)) { toast.error("Formato não suportado."); return; }
    setBoletoFile(file);
    if (file.type.startsWith("image/")) { setBoletoPreview(URL.createObjectURL(file)); } else { setBoletoPreview(null); }
  };

  const removeBoleto = () => {
    setBoletoFile(null);
    setBoletoPreview(null);
    if (boletoRef.current) boletoRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let boletoUrl = initialData?.boleto_url || null;
    if (!boletoFile && !boletoPreview) boletoUrl = null;

    if (boletoFile && user) {
      setUploading(true);
      try {
        const ext = boletoFile.name.split(".").pop() || "pdf";
        const path = `${user.id}/boletos/${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("receipts").upload(path, boletoFile, { upsert: true });
        if (error) throw error;
        const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(path);
        boletoUrl = urlData.publicUrl;
      } catch (err: any) {
        toast.error("Erro ao enviar boleto: " + err.message);
      } finally {
        setUploading(false);
      }
    }

    onSubmit({
      ...(initialData?.id ? { id: initialData.id } : {}),
      description,
      amount: parseFloat(amount),
      type,
      day_of_month: parseInt(dayOfMonth),
      category_id: categoryId === "none" ? null : categoryId,
      account_id: accountId === "none" ? null : accountId,
      active: initialData?.active ?? true,
      boleto_url: boletoUrl,
    });
    if (!initialData) {
      setDescription(""); setAmount(""); setType("expense"); setDayOfMonth("1"); setCategoryId("none"); setAccountId("none");
      removeBoleto();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">{initialData ? "Editar" : "Nova"} Transação Recorrente</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Descrição</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} className="bg-secondary border-border" required placeholder="Ex: Aluguel, Netflix, Salário..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Valor (R$)</Label>
              <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="bg-secondary border-border" required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Dia do mês</Label>
              <Input type="number" min="1" max="31" value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} className="bg-secondary border-border" required />
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
              <Label className="text-xs text-muted-foreground">Categoria</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem categoria</SelectItem>
                  {filteredCats.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ""}{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Conta</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem conta</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}{a.institution ? ` (${a.institution})` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Boleto Upload */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Boleto / Carnê</Label>
            <input ref={boletoRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={handleBoletoChange} />
            {!boletoFile && !boletoPreview ? (
              <button type="button" onClick={() => boletoRef.current?.click()} className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border border-dashed border-border bg-secondary/50 text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors">
                <FileText className="h-4 w-4" />
                <span className="text-xs">Anexar boleto (JPG, PNG, PDF — máx 10MB)</span>
              </button>
            ) : (
              <div className="relative rounded-lg border border-border bg-secondary/50 p-3">
                <button type="button" onClick={removeBoleto} className="absolute top-2 right-2 h-6 w-6 rounded-full bg-destructive/80 text-destructive-foreground flex items-center justify-center hover:bg-destructive transition-colors z-10">
                  <X className="h-3 w-3" />
                </button>
                {boletoPreview && boletoPreview.startsWith("blob:") ? (
                  <img src={boletoPreview} alt="Boleto" className="max-h-32 rounded-md mx-auto object-contain" />
                ) : boletoPreview ? (
                  <img src={boletoPreview} alt="Boleto" className="max-h-32 rounded-md object-contain" />
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <FileText className="h-5 w-5" />
                    <span className="text-xs">{boletoFile?.name || "Boleto anexado"}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="text-muted-foreground">Cancelar</Button>
            <Button type="submit" disabled={loading || uploading} className="gradient-bg-primary text-primary-foreground">
              {uploading ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Enviando...</> : loading ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const Recurring = () => {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringTransaction | null>(null);
  const [processing, setProcessing] = useState(false);

  const { data: recurrings = [], isLoading } = useSupabaseQuery<RecurringTransaction>("recurring_transactions" as any, "description", true);
  const { data: categories = [] } = useSupabaseQuery<Category>("categories", "name", true);
  const { data: accounts = [] } = useSupabaseQuery<Account>("accounts", "name", true);

  const insertMutation = useSupabaseInsert("recurring_transactions" as any);
  const updateMutation = useSupabaseUpdate("recurring_transactions" as any);
  const deleteMutation = useSupabaseDelete("recurring_transactions" as any);

  const catMap = new Map(categories.map((c) => [c.id, c]));
  const accMap = new Map(accounts.map((a) => [a.id, a]));

  const handleSubmit = (data: any) => {
    if (data.id) {
      updateMutation.mutate(data, { onSuccess: () => { setEditing(null); setFormOpen(false); } });
    } else {
      insertMutation.mutate(data, { onSuccess: () => setFormOpen(false) });
    }
  };

  const toggleActive = (rec: RecurringTransaction) => {
    updateMutation.mutate({ id: rec.id, active: !rec.active } as any);
  };

  const processNow = async () => {
    setProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-recurring`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({}),
      });
      if (!resp.ok) throw new Error("Erro ao processar");
      const result = await resp.json();
      toast.success(`${result.created} transação(ões) gerada(s), ${result.skipped} já existia(m).`);
    } catch (e: any) {
      toast.error(e.message || "Erro ao processar recorrentes");
    } finally {
      setProcessing(false);
    }
  };

  const totalMonthly = recurrings.filter((r) => r.active).reduce((s, r) => {
    return r.type === "expense" ? s - Number(r.amount) : s + Number(r.amount);
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="gradient-bg-primary rounded-lg p-2.5">
            <Repeat className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Recorrentes</h1>
            <p className="text-sm text-muted-foreground">Transações automáticas mensais</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={processNow} disabled={processing} className="text-xs border-border text-muted-foreground hover:text-primary gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {processing ? "Processando..." : "Gerar Agora"}
          </Button>
          <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="gradient-bg-primary text-primary-foreground gap-2">
            <Plus className="h-4 w-4" /> Nova
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="glass-card p-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Impacto mensal líquido</p>
          <p className={`text-lg font-bold ${totalMonthly >= 0 ? "text-success" : "text-destructive"}`}>
            {totalMonthly >= 0 ? "+" : ""}R$ {totalMonthly.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-muted-foreground">{recurrings.filter((r) => r.active).length} ativas</p>
          <p className="text-[10px] text-muted-foreground">{recurrings.filter((r) => !r.active).length} pausadas</p>
        </div>
      </div>

      <div className="glass-card p-4">
        <p className="text-xs text-muted-foreground">
          💡 As transações recorrentes são geradas automaticamente no <strong className="text-foreground">dia 1 de cada mês</strong>.
          Você também pode clicar em "Gerar Agora" para processar manualmente.
        </p>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Carregando...</div>
      ) : recurrings.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Repeat className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma transação recorrente.</p>
          <p className="text-xs text-muted-foreground mt-1">Adicione salário, aluguel, assinaturas, etc.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {recurrings.map((rec, i) => {
            const cat = catMap.get(rec.category_id || "");
            const acc = accMap.get(rec.account_id || "");
            return (
              <motion.div
                key={rec.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className={`glass-card-hover p-4 flex items-center gap-4 ${!rec.active ? "opacity-50" : ""}`}
              >
                <div className={`rounded-lg p-2 ${rec.type === "income" ? "bg-success/15" : "bg-destructive/15"}`}>
                  {rec.type === "income" ? <ArrowUpRight className="h-4 w-4 text-success" /> : <ArrowDownRight className="h-4 w-4 text-destructive" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{rec.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {cat ? `${cat.icon || ""}${cat.name} · ` : ""}
                    {acc ? `${acc.name} · ` : ""}
                    Dia {rec.day_of_month}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-bold tabular-nums ${rec.type === "income" ? "text-success" : "text-foreground"}`}>
                    {rec.type === "income" ? "+" : "-"} R$ {Number(rec.amount).toLocaleString("pt-BR")}
                  </p>
                  {rec.last_generated && (
                    <p className="text-[10px] text-muted-foreground">
                      Último: {new Date(rec.last_generated).toLocaleDateString("pt-BR")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {rec.boleto_url && (
                    <a href={rec.boleto_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-warning hover:text-warning/80" title="Ver boleto">
                        <FileText className="h-3 w-3" />
                      </Button>
                    </a>
                  )}
                  <Switch checked={rec.active} onCheckedChange={() => toggleActive(rec)} className="scale-75" />
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => { setEditing(rec); setFormOpen(true); }}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteMutation.mutate(rec.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <RecurringForm
        open={formOpen}
        onOpenChange={(v) => { setFormOpen(v); if (!v) setEditing(null); }}
        onSubmit={handleSubmit}
        initialData={editing}
        loading={insertMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
};

export default Recurring;
