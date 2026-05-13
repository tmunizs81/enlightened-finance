import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Repeat,
  Plus,
  Pencil,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  FileText,
  Paperclip,
  X,
  Loader2,
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

interface CurrentMonthTransaction {
  id: string;
  description: string;
  type: string;
  status: string;
  account_id: string | null;
  category_id: string | null;
  receipt_url: string | null;
}

interface CurrentMonthTransactionState {
  status: RecurringStatus;
  receipt_url: string | null;
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

type RecurringStatus = "pending" | "paid" | "overdue";

interface MonthTransaction {
  description: string;
  type: string;
  status: string;
  account_id: string | null;
  category_id: string | null;
}

type RecurringSubmitPayload = Omit<RecurringTransaction, "last_generated" | "user_id"> & {
  receipt_url?: string | null;
};

const statusStyles: Record<RecurringStatus, string> = {
  paid: "bg-success/15 text-success border-success/20",
  pending: "bg-warning/15 text-warning border-warning/20",
  overdue: "bg-destructive/15 text-destructive border-destructive/20",
};

const statusLabels: Record<RecurringStatus, string> = {
  paid: "Pago",
  pending: "Pendente",
  overdue: "Atrasado",
};

const normalizeRecurringStatus = (status?: string | null): RecurringStatus => {
  if (status === "paid" || status === "overdue") return status;
  return "pending";
};

const isImagePreview = (value: string | null) => {
  if (!value) return false;
  return value.startsWith("blob:") || /\.(png|jpe?g|webp|gif|bmp|svg)(\?|$)/i.test(value);
};

const buildRecurringKey = (
  description: string,
  type: string,
  accountId: string | null,
  categoryId: string | null,
) => [description.trim().toLowerCase(), type, accountId || "none", categoryId || "none"].join("::");

const getCurrentMonthRange = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const lastDay = new Date(year, month + 1, 0).getDate();
  const monthStr = String(month + 1).padStart(2, "0");
  return {
    monthStart: `${year}-${monthStr}-01`,
    monthEnd: `${year}-${monthStr}-${String(lastDay).padStart(2, "0")}`,
  };
};

const loadCurrentMonthStatusMap = async (userId: string) => {
  const { monthStart, monthEnd } = getCurrentMonthRange();
  const { data, error } = await supabase
    .from("transactions")
    .select("id, description, type, status, account_id, category_id, receipt_url")
    .eq("user_id", userId)
    .gte("date", monthStart)
    .lte("date", monthEnd);

  if (error) throw error;

  const map = new Map<string, CurrentMonthTransactionState>();
  (data || []).forEach((tx: CurrentMonthTransaction) => {
    const key = buildRecurringKey(tx.description, tx.type, tx.account_id, tx.category_id);
    map.set(key, {
      status: normalizeRecurringStatus(tx.status),
      receipt_url: tx.receipt_url || null,
    });
  });

  return map;
};

const applyRecurringFilters = (
  query: any,
  userId: string,
  source: Pick<RecurringTransaction, "description" | "type" | "account_id" | "category_id">,
) => {
  const { monthStart, monthEnd } = getCurrentMonthRange();

  let nextQuery = query
    .eq("user_id", userId)
    .eq("description", source.description)
    .eq("type", source.type)
    .gte("date", monthStart)
    .lte("date", monthEnd);

  nextQuery = source.account_id ? nextQuery.eq("account_id", source.account_id) : nextQuery.is("account_id", null);
  nextQuery = source.category_id ? nextQuery.eq("category_id", source.category_id) : nextQuery.is("category_id", null);

  return nextQuery;
};

function RecurringForm({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  loading,
  currentStatus = "pending",
  currentReceiptUrl = null,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (d: any) => void;
  initialData?: RecurringTransaction | null;
  loading: boolean;
  currentStatus?: RecurringStatus;
  currentReceiptUrl?: string | null;
}) {
  const { user } = useAuth();
  const boletoRef = useRef<HTMLInputElement>(null);
  const receiptRef = useRef<HTMLInputElement>(null);
  const editingIdRef = useRef<string | null>(null);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("expense");
  const [status, setStatus] = useState<RecurringStatus>("pending");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [categoryId, setCategoryId] = useState("none");
  const [accountId, setAccountId] = useState("none");
  const [boletoFile, setBoletoFile] = useState<File | null>(null);
  const [boletoPreview, setBoletoPreview] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    editingIdRef.current = initialData?.id || null;
    setDescription(initialData?.description ?? "");
    setAmount(initialData?.amount != null ? String(initialData.amount) : "");
    setType(initialData?.type || "expense");
    setStatus(currentStatus);
    setDayOfMonth(initialData?.day_of_month != null ? String(initialData.day_of_month) : "1");
    setCategoryId(initialData?.category_id || "none");
    setAccountId(initialData?.account_id || "none");
    setBoletoFile(null);
    setBoletoPreview(initialData?.boleto_url || null);
    setReceiptFile(null);
    setReceiptPreview(null); // Explicitly reset preview when opening/switching recurring items
  }, [initialData, open, currentStatus]);

  const { data: categories = [] } = useSupabaseQuery<Category>("categories", "name", true);
  const { data: accounts = [] } = useSupabaseQuery<Account>("accounts", "name", true);
  const filteredCats = categories.filter((c) => c.type === type);

  const handleBoletoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo: 10MB");
      return;
    }
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(file.type)) {
      toast.error("Formato não suportado.");
      return;
    }
    setBoletoFile(file);
    if (file.type.startsWith("image/")) {
      setBoletoPreview(URL.createObjectURL(file));
    } else {
      setBoletoPreview(null);
    }
  };

  const removeBoleto = () => {
    setBoletoFile(null);
    setBoletoPreview(null);
    if (boletoRef.current) boletoRef.current.value = "";
  };

  const handleReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Arquivo muito grande. Máximo: 10MB"); return; }
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(file.type)) { toast.error("Formato não suportado."); return; }
    setReceiptFile(file);
    if (file.type.startsWith("image/")) { setReceiptPreview(URL.createObjectURL(file)); } else { setReceiptPreview(null); }
  };

  const removeReceipt = () => {
    setReceiptFile(null);
    setReceiptPreview(null);
    if (receiptRef.current) receiptRef.current.value = "";
  };

  const uploadFile = async (file: File, folder: string): Promise<string | null> => {
    if (!user) return null;
    const ext = file.name.split(".").pop() || "pdf";
    const path = `${user.id}/${folder}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("receipts").upload(path, file, { upsert: true });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(path);
    return urlData.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentEditingId = editingIdRef.current;

    let boletoUrl = initialData?.boleto_url || null;
    if (!boletoFile && !boletoPreview) boletoUrl = null;

    // Receipt URL is only for the current month's transaction, not stored in recurring_transactions table
    let receiptUrl = null;

    setUploading(true);
    try {
      if (boletoFile) boletoUrl = await uploadFile(boletoFile, "boletos");
      if (receiptFile) receiptUrl = await uploadFile(receiptFile, "comprovantes");
    } catch (err: any) {
      toast.error("Erro ao enviar arquivo: " + err.message);
      setUploading(false);
      return;
    }
    setUploading(false);

    onSubmit({
      ...(currentEditingId ? { id: currentEditingId } : {}),
      description,
      amount: parseFloat(amount),
      type,
      day_of_month: parseInt(dayOfMonth),
      category_id: categoryId === "none" ? null : categoryId,
      account_id: accountId === "none" ? null : accountId,
      active: initialData?.active ?? true,
      boleto_url: boletoUrl,
      _receipt_url: receiptUrl,
      _status: status,
    });

    if (!currentEditingId) {
      setDescription("");
      setAmount("");
      setType("expense");
      setStatus("pending");
      setDayOfMonth("1");
      setCategoryId("none");
      setAccountId("none");
      removeBoleto();
      removeReceipt();
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
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-secondary border-border"
              required
              placeholder="Ex: Aluguel, Netflix, Salário..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Valor (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-secondary border-border"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Dia do mês</Label>
              <Input
                type="number"
                min="1"
                max="31"
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(e.target.value)}
                className="bg-secondary border-border"
                required
              />
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
              <Select value={status} onValueChange={(value) => setStatus(value as RecurringStatus)}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="paid">Pago</SelectItem>
                  <SelectItem value="overdue">Atrasado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
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
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Boleto / Carnê</Label>
            <input ref={boletoRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={handleBoletoChange} />
            {!boletoFile && !boletoPreview ? (
              <button
                type="button"
                onClick={() => boletoRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border border-dashed border-border bg-secondary/50 text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors"
              >
                <FileText className="h-4 w-4" />
                <span className="text-xs">Anexar boleto (JPG, PNG, PDF — máx 10MB)</span>
              </button>
            ) : (
              <div className="relative rounded-lg border border-border bg-secondary/50 p-3">
                <button
                  type="button"
                  onClick={removeBoleto}
                  className="absolute top-2 right-2 h-6 w-6 rounded-full bg-destructive/80 text-destructive-foreground flex items-center justify-center hover:bg-destructive transition-colors z-10"
                >
                  <X className="h-3 w-3" />
                </button>
                {isImagePreview(boletoPreview) ? (
                  <img src={boletoPreview} alt="Boleto" className="max-h-32 rounded-md mx-auto object-contain" />
                ) : boletoPreview ? (
                  <a href={boletoPreview} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                    <FileText className="h-5 w-5" />
                    <span className="text-xs">Boleto anexado</span>
                  </a>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <FileText className="h-5 w-5" />
                    <span className="text-xs">{boletoFile?.name || "Boleto anexado"}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">📎 Comprovante</Label>
            <input ref={receiptRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={handleReceiptChange} />
            {!receiptFile && !receiptPreview ? (
              <button
                type="button"
                onClick={() => receiptRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border border-dashed border-border bg-secondary/50 text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors"
              >
                <Paperclip className="h-4 w-4" />
                <span className="text-xs">Anexar comprovante (JPG, PNG, PDF — máx 10MB)</span>
              </button>
            ) : (
              <div className="relative rounded-lg border border-border bg-secondary/50 p-3">
                <button
                  type="button"
                  onClick={removeReceipt}
                  className="absolute top-2 right-2 h-6 w-6 rounded-full bg-destructive/80 text-destructive-foreground flex items-center justify-center hover:bg-destructive transition-colors z-10"
                >
                  <X className="h-3 w-3" />
                </button>
                {isImagePreview(receiptPreview) ? (
                  <img src={receiptPreview} alt="Comprovante" className="max-h-32 rounded-md mx-auto object-contain" />
                ) : receiptPreview ? (
                  <a href={receiptPreview} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                    <Paperclip className="h-5 w-5" />
                    <span className="text-xs">Comprovante anexado</span>
                  </a>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Paperclip className="h-5 w-5" />
                    <span className="text-xs">{receiptFile?.name || "Comprovante anexado"}</span>
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
  const [monthTxMap, setMonthTxMap] = useState<Map<string, CurrentMonthTransactionState>>(new Map());
  const { user } = useAuth();

  const { data: recurrings = [], isLoading } = useSupabaseQuery<RecurringTransaction>("recurring_transactions" as any, "description", true);
  const { data: categories = [] } = useSupabaseQuery<Category>("categories", "name", true);
  const { data: accounts = [] } = useSupabaseQuery<Account>("accounts", "name", true);

  useEffect(() => {
    if (!user) {
      setMonthTxMap(new Map());
      return;
    }

    loadCurrentMonthStatusMap(user.id)
      .then(setMonthTxMap)
      .catch(() => setMonthTxMap(new Map()));
  }, [user?.id]);

  const getRecurringStatus = (rec: RecurringTransaction): RecurringStatus => {
    const key = buildRecurringKey(rec.description, rec.type, rec.account_id, rec.category_id);
    const txState = monthTxMap.get(key);
    if (txState) return txState.status;

    const now = new Date();
    if (rec.day_of_month <= now.getDate()) return "overdue";
    return "pending";
  };

  const getCurrentMonthTransactionState = (rec: RecurringTransaction) => {
    const key = buildRecurringKey(rec.description, rec.type, rec.account_id, rec.category_id);
    return monthTxMap.get(key);
  };

  const insertMutation = useSupabaseInsert("recurring_transactions" as any);
  const updateMutation = useSupabaseUpdate("recurring_transactions" as any);
  const deleteMutation = useSupabaseDelete("recurring_transactions" as any);

  const catMap = new Map(categories.map((c) => [c.id, c]));
  const accMap = new Map(accounts.map((a) => [a.id, a]));

  const syncCurrentMonthTransaction = async (
    previousData: RecurringTransaction,
    nextData: RecurringSubmitPayload,
    nextStatus: RecurringStatus,
  ) => {
    if (!user) return;

    const matchQuery = applyRecurringFilters(
      supabase.from("transactions").select("id"),
      user.id,
      previousData,
    );

    const { data: existingTransactions, error: fetchError } = await matchQuery.limit(1);
    if (fetchError) throw fetchError;

    const transactionPayload = {
      description: nextData.description,
      amount: nextData.amount,
      type: nextData.type,
      status: nextStatus,
      category_id: nextData.category_id,
      account_id: nextData.account_id,
      boleto_url: nextData.boleto_url,
      receipt_url: nextData.receipt_url ?? null,
    };

    if (existingTransactions && existingTransactions.length > 0) {
      const { error: updateError } = await applyRecurringFilters(
        supabase.from("transactions").update(transactionPayload as any),
        user.id,
        previousData,
      );

      if (updateError) throw updateError;
      return;
    }

    const now = new Date();
    const day = Math.min(nextData.day_of_month, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate());
    const txDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    const { error: insertError } = await supabase.from("transactions").insert({
      ...transactionPayload,
      user_id: user.id,
      date: txDate,
      notes: "Transação recorrente sincronizada manualmente",
    } as any);

    if (insertError) throw insertError;
  };

  const handleSubmit = async (data: any) => {
    const { _status, _receipt_url, ...submitData } = data;
    const nextStatus = (_status || "pending") as RecurringStatus;
    
    // Create payload for syncing the current month's transaction
    const syncPayload: RecurringSubmitPayload = {
      ...submitData,
      receipt_url: _receipt_url ?? null,
    };

    if (submitData.id) {
      updateMutation.mutate(submitData, {
        onSuccess: async () => {
          try {
            if (editing) {
              await syncCurrentMonthTransaction(editing, syncPayload, nextStatus);
            }
            if (user) {
              setMonthTxMap(await loadCurrentMonthStatusMap(user.id));
            }
          } catch (error: any) {
            toast.error(error.message || "Recorrente salvo, mas o status do mês não foi sincronizado.");
          } finally {
            setEditing(null);
            setFormOpen(false);
          }
        },
      });
    } else {
      insertMutation.mutate(submitData, {
        onSuccess: async (createdRecurring: any) => {
          try {
            if (user && (nextStatus !== "pending" || Boolean(_receipt_url))) {
              await syncCurrentMonthTransaction(createdRecurring, syncPayload, nextStatus);
              setMonthTxMap(await loadCurrentMonthStatusMap(user.id));
            }
          } catch (error: any) {
            toast.error(error.message || "Recorrente criado, mas o lançamento do mês não foi sincronizado.");
          } finally {
            setFormOpen(false);
          }
        },
      });
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
        body: JSON.stringify({ force: true }),
      });
      if (!resp.ok) throw new Error("Erro ao processar");
      const result = await resp.json();
      if (user) {
        setMonthTxMap(await loadCurrentMonthStatusMap(user.id));
      }
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
            const status = getRecurringStatus(rec);
            const currentMonthTransaction = getCurrentMonthTransactionState(rec);

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
                <div className="text-right shrink-0 flex flex-col items-end gap-1">
                  <p className={`text-sm font-bold tabular-nums ${rec.type === "income" ? "text-success" : "text-foreground"}`}>
                    {rec.type === "income" ? "+" : "-"} R$ {Number(rec.amount).toLocaleString("pt-BR")}
                  </p>
                  <Badge variant="outline" className={`text-[10px] flex-shrink-0 ${statusStyles[status]}`}>
                    {statusLabels[status]}
                  </Badge>
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
                  {currentMonthTransaction?.receipt_url && (
                    <a href={currentMonthTransaction.receipt_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-success hover:text-success/80" title="Ver comprovante">
                        <Paperclip className="h-3 w-3" />
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
        currentStatus={editing ? getRecurringStatus(editing) : "pending"}
        currentReceiptUrl={editing ? getCurrentMonthTransactionState(editing)?.receipt_url ?? null : null}
        loading={insertMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
};

export default Recurring;
