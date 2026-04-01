import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSupabaseQuery, useSupabaseInsert } from "@/hooks/use-supabase-crud";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Plus, Paperclip, X, FileImage, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

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
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState(initialData?.description || "");
  const [amount, setAmount] = useState(initialData?.amount?.toString() || "");
  const [type, setType] = useState(initialData?.type || "expense");
  const [status, setStatus] = useState(initialData?.status || "pending");
  const [date, setDate] = useState(initialData?.date || new Date().toISOString().split("T")[0]);
  const [categoryId, setCategoryId] = useState(initialData?.category_id || "none");
  const [accountId, setAccountId] = useState(initialData?.account_id || "none");
  const [newCatName, setNewCatName] = useState("");
  const [showNewCat, setShowNewCat] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(initialData?.receipt_url || null);
  const [boletoFile, setBoletoFile] = useState<File | null>(null);
  const [boletoPreview, setBoletoPreview] = useState<string | null>(initialData?.boleto_url || null);
  const [uploading, setUploading] = useState(false);
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [aiSuggested, setAiSuggested] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [installments, setInstallments] = useState("1");
  const [isInstallment, setIsInstallment] = useState(false);

  const { data: categories = [] } = useSupabaseQuery<Category>("categories", "name", true);
  const { data: accounts = [] } = useSupabaseQuery<Account>("accounts", "name", true);
  const insertCategory = useSupabaseInsert("categories");

  const filteredCats = useMemo(() => {
    const seen = new Set<string>();
    return categories.filter((c) => {
      if (c.type !== type) return false;
      const key = c.name.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [categories, type]);

  // Auto-categorize with AI
  const autoCategorize = useCallback(async (desc: string, txType: string) => {
    if (desc.length < 3 || categoryId !== "none") return;
    setAiSuggesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("auto-categorize", {
        body: { description: desc, type: txType },
      });
      if (!error && data?.category_id) {
        setAiSuggested(data.category_name);
        setCategoryId(data.category_id);
      }
    } catch {
      // silently fail
    } finally {
      setAiSuggesting(false);
    }
  }, [categoryId]);

  const handleDescriptionChange = (value: string) => {
    setDescription(value);
    setAiSuggested(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length >= 4 && categoryId === "none") {
      debounceRef.current = setTimeout(() => autoCategorize(value, type), 800);
    }
  };

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.error("Arquivo muito grande. Máximo: 10MB");
      return;
    }

    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(file.type)) {
      toast.error("Formato não suportado. Use JPG, PNG, WebP ou PDF.");
      return;
    }

    setReceiptFile(file);
    if (file.type.startsWith("image/")) {
      setReceiptPreview(URL.createObjectURL(file));
    } else {
      setReceiptPreview(null);
    }
  };

  const removeReceipt = () => {
    setReceiptFile(null);
    setReceiptPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const uploadReceipt = async (): Promise<string | null> => {
    if (!receiptFile || !user) return initialData?.receipt_url || null;

    setUploading(true);
    try {
      const ext = receiptFile.name.split(".").pop() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;

      const { error } = await supabase.storage
        .from("receipts")
        .upload(path, receiptFile, { upsert: true });

      if (error) throw error;

      const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(path);
      return urlData.publicUrl;
    } catch (err: any) {
      toast.error("Erro ao enviar comprovante: " + err.message);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let receiptUrl = initialData?.receipt_url || null;

    // If user removed receipt
    if (!receiptFile && !receiptPreview) {
      receiptUrl = null;
    }

    // If user added new file
    if (receiptFile) {
      receiptUrl = await uploadReceipt();
    }

    const numInstallments = isInstallment ? parseInt(installments) : 1;
    const installmentAmount = parseFloat(amount) / numInstallments;

    for (let i = 0; i < numInstallments; i++) {
      const installmentDate = new Date(date);
      installmentDate.setMonth(installmentDate.getMonth() + i);
      const dateStr = installmentDate.toISOString().split("T")[0];
      const desc = numInstallments > 1
        ? `${description} (${i + 1}/${numInstallments})`
        : description;

      onSubmit({
        ...(i === 0 && initialData?.id ? { id: initialData.id } : {}),
        description: desc,
        amount: installmentAmount,
        type,
        status: i === 0 ? status : "pending",
        date: dateStr,
        category_id: categoryId === "none" ? null : categoryId,
        account_id: accountId === "none" ? null : accountId,
        receipt_url: i === 0 ? receiptUrl : null,
      });
    }

    if (!initialData) {
      setDescription(""); setAmount(""); setType("expense"); setStatus("pending");
      setCategoryId("none"); setAccountId("none"); setIsInstallment(false); setInstallments("1");
      removeReceipt();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">{initialData ? "Editar" : "Nova"} Transação</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Descrição</Label>
            <Input value={description} onChange={(e) => handleDescriptionChange(e.target.value)} className="bg-secondary border-border" required />
            {aiSuggesting && (
              <div className="flex items-center gap-1.5 text-[10px] text-primary">
                <Sparkles className="h-3 w-3 animate-pulse" />
                <span>IA sugerindo categoria...</span>
              </div>
            )}
            {aiSuggested && !aiSuggesting && (
              <div className="flex items-center gap-1.5 text-[10px] text-success">
                <Sparkles className="h-3 w-3" />
                <span>IA sugeriu: <strong>{aiSuggested}</strong></span>
              </div>
            )}
            
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

          {/* Installments */}
          {type === "expense" && !initialData && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="installment-check"
                  checked={isInstallment}
                  onChange={(e) => { setIsInstallment(e.target.checked); if (!e.target.checked) setInstallments("1"); }}
                  className="rounded border-border"
                />
                <Label htmlFor="installment-check" className="text-xs text-muted-foreground cursor-pointer">Parcelar</Label>
              </div>
              {isInstallment && (
                <div className="flex items-center gap-2">
                  <Select value={installments} onValueChange={setInstallments}>
                    <SelectTrigger className="bg-secondary border-border w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                        <SelectItem key={n} value={n.toString()}>{n}x</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {amount && parseFloat(amount) > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      {parseInt(installments)}x de R$ {(parseFloat(amount) / parseInt(installments)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Account */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Conta</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem conta</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}{a.institution ? ` (${a.institution})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Receipt Upload */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Comprovante</Label>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />

            {!receiptFile && !receiptPreview ? (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
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

                {receiptPreview && receiptPreview.startsWith("blob:") ? (
                  <img src={receiptPreview} alt="Comprovante" className="max-h-32 rounded-md mx-auto object-contain" />
                ) : receiptPreview ? (
                  <div className="flex items-center gap-2">
                    <img src={receiptPreview} alt="Comprovante" className="max-h-32 rounded-md object-contain" />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <FileImage className="h-5 w-5" />
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
