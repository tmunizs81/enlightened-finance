import { useState, useEffect, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight, Search, Plus, Pencil, Trash2, Paperclip, X, Download, Split, Tag, FileText } from "lucide-react";
import { CSVImport } from "@/components/import/CSVImport";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SkeletonList } from "@/components/ui/skeleton-card";
import { useSupabaseQuery, useSupabaseInsert, useSupabaseUpdate, useSupabaseDelete } from "@/hooks/use-supabase-crud";
import { TransactionForm } from "@/components/forms/TransactionForm";
import { TagManager } from "@/components/tags/TagManager";
import { TransactionSplitDialog } from "@/components/splits/TransactionSplitDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useDebounce } from "@/hooks/use-debounce";
import { useConfirmDelete } from "@/hooks/use-confirm-delete";

const statusStyles: Record<string, string> = {
  paid: "bg-success/15 text-success border-success/20",
  pending: "bg-warning/15 text-warning border-warning/20",
  overdue: "bg-destructive/15 text-destructive border-destructive/20",
};

const statusLabels: Record<string, string> = {
  paid: "Pago",
  pending: "Pendente",
  overdue: "Atrasado",
};

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: string;
  status: string;
  date: string;
  user_id: string;
  account_id: string | null;
  category_id: string | null;
  notes: string | null;
  receipt_url: string | null;
  boleto_url: string | null;
}

interface Category {
  id: string;
  name: string;
  icon: string | null;
  type: string;
}

interface TagData {
  id: string;
  name: string;
  color: string;
}

const PAGE_SIZE = 50;

const Transactions = () => {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptLabel, setReceiptLabel] = useState<string>("Comprovante");
  const [splitTx, setSplitTx] = useState<Transaction | null>(null);
  const [allTags, setAllTags] = useState<TagData[]>([]);
  const [txTags, setTxTags] = useState<Record<string, TagData[]>>({});
  const [txSplits, setTxSplits] = useState<Set<string>>(new Set());
  const [tagsVersion, setTagsVersion] = useState(0);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const { deleteTarget, isConfirmOpen, requestDelete, cancelDelete, confirmDelete } = useConfirmDelete();

  const { data: transactions = [], isLoading } = useSupabaseQuery<Transaction>("transactions", "date", false);
  const { data: categories = [] } = useSupabaseQuery<Category>("categories", "name", true);
  const insertMutation = useSupabaseInsert("transactions");
  const updateMutation = useSupabaseUpdate("transactions");
  const deleteMutation = useSupabaseDelete("transactions");

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setEditing(null);
      setFormOpen(true);
    }
  }, [searchParams]);

  const loadTags = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("tags" as any).select("*").eq("user_id", user.id);
    if (data) setAllTags(data as any[]);
  }, [user]);

  const loadTxTags = useCallback(async () => {
    if (!user || transactions.length === 0) return;
    const txIds = transactions.map((t) => t.id);
    const { data } = await supabase
      .from("transaction_tags" as any)
      .select("transaction_id, tag_id")
      .in("transaction_id", txIds);

    if (data) {
      const map: Record<string, TagData[]> = {};
      for (const row of data as any[]) {
        const tag = allTags.find((t) => t.id === row.tag_id);
        if (tag) {
          if (!map[row.transaction_id]) map[row.transaction_id] = [];
          map[row.transaction_id].push(tag);
        }
      }
      setTxTags(map);
    }
  }, [user, transactions, allTags]);

  const loadSplitInfo = useCallback(async () => {
    if (transactions.length === 0) return;
    const txIds = transactions.map((t) => t.id);
    const { data } = await supabase
      .from("transaction_splits" as any)
      .select("transaction_id")
      .in("transaction_id", txIds);

    if (data) {
      setTxSplits(new Set((data as any[]).map((d: any) => d.transaction_id)));
    }
  }, [transactions]);

  useEffect(() => { loadTags(); }, [loadTags]);
  useEffect(() => { loadTxTags(); }, [loadTxTags, tagsVersion]);
  useEffect(() => { loadSplitInfo(); }, [loadSplitInfo]);

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const filtered = useMemo(() => {
    const lowerSearch = debouncedSearch.toLowerCase();
    return transactions.filter((t) => {
      const matchFilter = filter === "all" || t.type === filter;
      if (!matchFilter) return false;
      if (!lowerSearch) return true;
      const matchSearch = t.description.toLowerCase().includes(lowerSearch);
      const tagMatch = (txTags[t.id] || []).some((tag) => tag.name.toLowerCase().includes(lowerSearch));
      return matchSearch || tagMatch;
    });
  }, [transactions, debouncedSearch, filter, txTags]);

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [debouncedSearch, filter]);

  const visibleItems = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  const invalidateAccounts = () => queryClient.invalidateQueries({ queryKey: ["accounts"] });

  const handleSubmit = (data: any) => {
    if (data.id) {
      updateMutation.mutate(data, { onSuccess: () => { setEditing(null); setFormOpen(false); invalidateAccounts(); } });
    } else {
      insertMutation.mutate(data, { onSuccess: () => { setFormOpen(false); invalidateAccounts(); } });
    }
  };

  const handleDeleteConfirm = () => {
    confirmDelete((id) => {
      deleteMutation.mutate(id, { onSuccess: invalidateAccounts });
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Transações</h1>
          <p className="text-sm text-muted-foreground">Gerencie suas receitas e despesas</p>
        </div>
        <div className="flex gap-2">
          <CSVImport />
          <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="gradient-bg-primary text-primary-foreground gap-2">
            <Plus className="h-4 w-4" /> Nova
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar transações ou tags..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-secondary border-border" />
        </div>
        <div className="flex gap-2">
          {(["all", "income", "expense"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${filter === f ? "gradient-bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
              {f === "all" ? "Todos" : f === "income" ? "Receitas" : "Despesas"}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <SkeletonList count={6} />
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <div className="text-4xl">📋</div>
          <p className="text-muted-foreground text-sm font-medium">Nenhuma transação encontrada</p>
          <p className="text-muted-foreground text-xs">Clique em "Nova" para adicionar sua primeira transação</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visibleItems.map((t, i) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.03 }} className="glass-card-hover p-4 flex items-center gap-4">
              <div className={`rounded-lg p-2 ${t.type === "income" ? "bg-success/15" : "bg-destructive/15"}`}>
                {t.type === "income" ? <ArrowUpRight className="h-4 w-4 text-success" /> : <ArrowDownRight className="h-4 w-4 text-destructive" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground truncate">{t.description}</p>
                  {txSplits.has(t.id) && (
                    <Badge variant="outline" className="text-[9px] border-primary/30 text-primary">Split</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t.category_id && catMap.has(t.category_id) ? `${catMap.get(t.category_id)!.icon || ""}${catMap.get(t.category_id)!.name} · ` : ""}{new Date(t.date).toLocaleDateString("pt-BR")}
                </p>
                <div className="mt-1">
                  <TagManager
                    transactionId={t.id}
                    tags={txTags[t.id] || []}
                    allTags={allTags}
                    onTagsChange={() => { setTagsVersion((v) => v + 1); loadTags(); }}
                  />
                </div>
              </div>
              <Badge variant="outline" className={`text-[10px] hidden sm:flex ${statusStyles[t.status]}`}>{statusLabels[t.status]}</Badge>
              <p className={`text-sm font-bold tabular-nums ${t.type === "income" ? "text-success" : "text-foreground"}`}>
                {t.type === "income" ? "+" : "-"} R$ {Number(t.amount).toLocaleString("pt-BR")}
              </p>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" title="Dividir" onClick={() => setSplitTx(t)}>
                  <Split className="h-3 w-3" />
                </Button>
                {t.receipt_url && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-primary hover:text-primary/80" type="button" title="Comprovante" onClick={() => { setReceiptUrl(t.receipt_url); setReceiptLabel("Comprovante"); }}>
                    <Paperclip className="h-3 w-3" />
                  </Button>
                )}
                {t.boleto_url && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-warning hover:text-warning/80" type="button" title="Boleto" onClick={() => { setReceiptUrl(t.boleto_url); setReceiptLabel("Boleto"); }}>
                    <FileText className="h-3 w-3" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => { setEditing(t); setFormOpen(true); }}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => requestDelete(t.id, t.description)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </motion.div>
          ))}

          {visibleCount < filtered.length && (
            <div className="text-center pt-2">
              <Button variant="outline" size="sm" onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}>
                Carregar mais ({filtered.length - visibleCount} restantes)
              </Button>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={isConfirmOpen}
        onOpenChange={(open) => { if (!open) cancelDelete(); }}
        title="Excluir transação"
        description={`Tem certeza que deseja excluir "${deleteTarget?.name || "esta transação"}"? Esta ação não pode ser desfeita.`}
        onConfirm={handleDeleteConfirm}
      />

      <TransactionForm
        open={formOpen}
        onOpenChange={(v) => { setFormOpen(v); if (!v) setEditing(null); }}
        onSubmit={handleSubmit}
        initialData={editing}
        loading={insertMutation.isPending || updateMutation.isPending}
      />

      {splitTx && (
        <TransactionSplitDialog
          open={!!splitTx}
          onOpenChange={(v) => { if (!v) setSplitTx(null); }}
          transactionId={splitTx.id}
          transactionAmount={Number(splitTx.amount)}
          transactionType={splitTx.type}
          transactionDescription={splitTx.description}
          categories={categories}
          onSaved={() => loadSplitInfo()}
        />
      )}

      <Dialog open={!!receiptUrl} onOpenChange={(v) => { if (!v) setReceiptUrl(null); }}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden bg-background border-border">
          <DialogTitle className="sr-only">{receiptLabel}</DialogTitle>
          <div className="flex items-center justify-between p-3 border-b border-border">
            <p className="text-sm font-medium text-foreground">{receiptLabel}</p>
            <div className="flex gap-1">
              <a href={receiptUrl || ""} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </a>
            </div>
          </div>
          {receiptUrl && (
            receiptUrl.toLowerCase().endsWith(".pdf") ? (
              <div className="flex flex-col items-center justify-center p-8 space-y-4">
                <FileText className="h-16 w-16 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Arquivo PDF</p>
                <a href={receiptUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="gap-2">
                    <Download className="h-4 w-4" /> Abrir / Baixar PDF
                  </Button>
                </a>
              </div>
            ) : (
              <img src={receiptUrl} alt={receiptLabel} className="w-full max-h-[70vh] object-contain p-4" loading="lazy" />
            )
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Transactions;
