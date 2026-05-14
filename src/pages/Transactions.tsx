import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight, Search, Plus, Pencil, Trash2, Paperclip, X, Download, Split, Tag, FileText, Printer, PieChart } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { CSVImport } from "@/components/import/CSVImport";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SkeletonList } from "@/components/ui/skeleton-card";
import { useSupabaseQuery, useSupabaseInsert, useSupabaseUpdate, useSupabaseDelete } from "@/hooks/use-supabase-crud";
import { TransactionForm } from "@/components/forms/TransactionForm";
import { TagManager } from "@/components/tags/TagManager";
import { TransactionSplitDialog } from "@/components/splits/TransactionSplitDialog";
import { TransactionAdvancedSearch, emptyFilters, type AdvancedFilters } from "@/components/transactions/TransactionAdvancedSearch";
import { TransactionBatchBar } from "@/components/transactions/TransactionBatchBar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useDebounce } from "@/hooks/use-debounce";
import { useConfirmDelete } from "@/hooks/use-confirm-delete";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import logoImage from "@/assets/logo.png";
import { getSignedReceiptUrl, prefetchSignedUrl, cancelSignedUrlRequest, isUrlCached, isUrlPending } from "@/utils/storageUrls";

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

interface Account {
  id: string;
  name: string;
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
  const [advFilters, setAdvFilters] = useState<AdvancedFilters>(emptyFilters);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptLabel, setReceiptLabel] = useState<string>("Comprovante");
  const [receiptBlobUrl, setReceiptBlobUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [splitTx, setSplitTx] = useState<Transaction | null>(null);
  const [allTags, setAllTags] = useState<TagData[]>([]);
  const [txTags, setTxTags] = useState<Record<string, TagData[]>>({});
  const [txSplits, setTxSplits] = useState<Set<string>>(new Set());
  const [tagsVersion, setTagsVersion] = useState(0);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isSigning, setIsSigning] = useState<string | null>(null); // path or id being signed
  const prefetchTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});
  const abortControllersRef = useRef<Record<string, AbortController>>({});

  // Batch selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false);

  const { deleteTarget, isConfirmOpen, requestDelete, cancelDelete, confirmDelete } = useConfirmDelete();

  const { data: transactions = [], isLoading } = useSupabaseQuery<Transaction>("transactions", "date", false);
  const { data: categories = [] } = useSupabaseQuery<Category>("categories", "name", true);
  const { data: accounts = [] } = useSupabaseQuery<Account>("accounts", "name", true);
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

  // Fetch PDF as blob to bypass Content-Disposition: attachment from signed URLs
  useEffect(() => {
    if (!receiptUrl || !receiptUrl.toLowerCase().includes(".pdf")) {
      setReceiptBlobUrl(null);
      return;
    }
    let cancelled = false;
    let createdUrl: string | null = null;
    setLoadingPdf(true);
    fetch(receiptUrl)
      .then((r) => r.blob())
      .then((blob) => {
        if (cancelled) return;
        // Force inline-friendly mime type
        const pdfBlob = blob.type === "application/pdf" ? blob : new Blob([blob], { type: "application/pdf" });
        createdUrl = URL.createObjectURL(pdfBlob);
        setReceiptBlobUrl(createdUrl);
      })
      .catch(() => { if (!cancelled) setReceiptBlobUrl(null); })
      .finally(() => { if (!cancelled) setLoadingPdf(false); });
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [receiptUrl]);

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const filtered = useMemo(() => {
    const lowerSearch = debouncedSearch.toLowerCase();
    return transactions.filter((t) => {
      if (filter !== "all" && t.type !== filter) return false;
      if (lowerSearch) {
        const matchSearch = t.description.toLowerCase().includes(lowerSearch);
        const tagMatch = (txTags[t.id] || []).some((tag) => tag.name.toLowerCase().includes(lowerSearch));
        if (!matchSearch && !tagMatch) return false;
      }
      // Advanced filters
      if (advFilters.dateFrom && t.date < advFilters.dateFrom) return false;
      if (advFilters.dateTo && t.date > advFilters.dateTo) return false;
      if (advFilters.categoryId && t.category_id !== advFilters.categoryId) return false;
      if (advFilters.accountId && t.account_id !== advFilters.accountId) return false;
      if (advFilters.status && t.status !== advFilters.status) return false;
      if (advFilters.amountMin && Number(t.amount) < Number(advFilters.amountMin)) return false;
      if (advFilters.amountMax && Number(t.amount) > Number(advFilters.amountMax)) return false;
      return true;
    });
  }, [transactions, debouncedSearch, filter, txTags, advFilters]);

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [debouncedSearch, filter, advFilters]);

  const visibleItems = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, t) => {
        const amt = Number(t.amount);
        if (t.type === "income") acc.income += amt;
        else acc.expense += amt;
        return acc;
      },
      { income: 0, expense: 0 }
    );
  }, [filtered]);

  const handleExportPDF = async () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header Configuration
    const margin = 14;
    const logoSize = 12;
    const headerY = 20;
    
    // Add Logo
    try {
      doc.addImage(logoImage, 'PNG', margin, headerY - 5, logoSize, logoSize);
    } catch (e) {
      doc.setFillColor(59, 130, 246);
      doc.roundedRect(margin, headerY - 5, logoSize, logoSize, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.text("SF", margin + 2, headerY + 2);
    }
    
    // System Title - Aligned with logo
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("SimplyFin", margin + logoSize + 4, headerY + 3);
    
    // Report Title - Right aligned
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "normal");
    const reportTitle = "Relatório de Transações";
    const titleWidth = doc.getTextWidth(reportTitle);
    doc.text(reportTitle, pageWidth - margin - titleWidth, headerY + 2);
    
    // Metadata - Under titles
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    const dateText = `Gerado em: ${new Date().toLocaleString("pt-BR")}`;
    const dateWidth = doc.getTextWidth(dateText);
    doc.text(dateText, pageWidth - margin - dateWidth, headerY + 8);
    
    const accountName = advFilters.accountId ? accounts.find(a => a.id === advFilters.accountId)?.name : "Todas as Contas";
    doc.text(`Filtro: ${accountName}`, margin, headerY + 12);

    // Summary Section with visual elements
    doc.setDrawColor(240, 240, 240);
    doc.line(14, 58, pageWidth - 14, 58);

    doc.setFontSize(12);
    doc.setTextColor(40, 40, 40);
    doc.setFont("helvetica", "bold");
    doc.text("Resumo Financeiro", 14, 68);
    
    // Data for mini-charts or stats boxes
    const balance = totals.income - totals.expense;
    
    // Statistics Boxes
    autoTable(doc, {
      startY: 75,
      body: [
        [
          { content: `RECEITAS\nR$ ${totals.income.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, styles: { textColor: [34, 197, 94], fontStyle: 'bold' } },
          { content: `DESPESAS\nR$ ${totals.expense.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, styles: { textColor: [239, 68, 68], fontStyle: 'bold' } },
          { content: `SALDO\nR$ ${balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, styles: { textColor: balance >= 0 ? [59, 130, 246] : [239, 68, 68], fontStyle: 'bold' } }
        ]
      ],
      theme: 'plain',
      styles: { cellPadding: 5, fontSize: 10, halign: 'center', cellWidth: (pageWidth - 28) / 3 },
    });

    // Simple textual "chart" for Category distribution if filtered by many
    if (filtered.length > 0) {
      doc.setFontSize(11);
      doc.setTextColor(40, 40, 40);
      doc.text("Distribuição por Categoria (Top 5)", 14, 105);
      
      const catTotals: Record<string, number> = {};
      filtered.forEach(t => {
        const catName = t.category_id && catMap.has(t.category_id) ? catMap.get(t.category_id)!.name : "Sem Categoria";
        catTotals[catName] = (catTotals[catName] || 0) + Number(t.amount);
      });

      const sortedCats = Object.entries(catTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      const maxCatVal = sortedCats[0]?.[1] || 1;
      
      let chartY = 115;
      sortedCats.forEach(([name, val]) => {
        const barWidth = (val / maxCatVal) * 100;
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(name, 14, chartY);
        
        doc.setFillColor(240, 240, 240);
        doc.rect(50, chartY - 3, 100, 4, 'F');
        doc.setFillColor(59, 130, 246);
        doc.rect(50, chartY - 3, Math.max(2, barWidth), 4, 'F');
        
        doc.setTextColor(60, 60, 60);
        doc.text(`R$ ${val.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 155, chartY);
        chartY += 8;
      });
    }

    const tableData = filtered.map(t => [
      new Date(t.date).toLocaleDateString("pt-BR"),
      t.description,
      t.category_id && catMap.has(t.category_id) ? catMap.get(t.category_id)!.name : "-",
      statusLabels[t.status] || t.status,
      t.type === "income" ? "Receita" : "Despesa",
      `R$ ${Number(t.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
    ]);

    autoTable(doc, {
      startY: filtered.length > 0 ? 165 : 105,
      head: [["Data", "Descrição", "Categoria", "Status", "Tipo", "Valor"]],
      body: tableData,
      theme: 'striped',
      headStyles: { 
        fillColor: [59, 130, 246],
        textColor: [255, 255, 255],
        fontSize: 10,
        halign: 'center'
      },
      columnStyles: {
        5: { halign: 'right' }
      },
      styles: {
        fontSize: 8,
        cellPadding: 3
      },
      margin: { top: 20 }
    });

    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Página ${i} de ${totalPages}`, pageWidth - 30, doc.internal.pageSize.getHeight() - 10);
    }

    doc.save(`relatorio_financeiro_${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success("Relatório personalizado gerado com sucesso!");
  };

  // Clear selection when filters change
  useEffect(() => { setSelected(new Set()); }, [debouncedSearch, filter, advFilters]);

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

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === visibleItems.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(visibleItems.map((t) => t.id)));
    }
  };

  const handleBatchDelete = async () => {
    setBatchDeleting(true);
    try {
      const ids = Array.from(selected);
      const { error } = await supabase.from("transactions").delete().in("id", ids);
      if (error) throw error;
      toast.success(`${ids.length} transações excluídas`);
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      invalidateAccounts();
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir");
    } finally {
      setBatchDeleting(false);
      setBatchConfirmOpen(false);
    }
  };

  const handlePrefetch = (t: Transaction) => {
    const prefetchId = t.id;
    if (prefetchTimeoutRef.current[prefetchId]) {
      clearTimeout(prefetchTimeoutRef.current[prefetchId]);
    }
    prefetchTimeoutRef.current[prefetchId] = setTimeout(() => {
      if (t.receipt_url) prefetchSignedUrl(t.receipt_url);
      if (t.boleto_url) prefetchSignedUrl(t.boleto_url);
      delete prefetchTimeoutRef.current[prefetchId];
    }, 150);
  };

  const TransactionRow = ({ t, i }: { t: Transaction, i: number }) => {
    const rowRef = useRef<HTMLDivElement>(null);
    const [cachedState, setCachedState] = useState({ 
      receipt: isUrlCached(t.receipt_url), 
      boleto: isUrlCached(t.boleto_url),
      pendingReceipt: isUrlPending(t.receipt_url),
      pendingBoleto: isUrlPending(t.boleto_url)
    });

    useEffect(() => {
      if (!rowRef.current) return;
      
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            if (t.receipt_url || t.boleto_url) {
              handlePrefetch(t);
            }
          } else {
            // Cancel prefetch if it hasn't completed and row is no longer visible
            if (t.receipt_url) cancelSignedUrlRequest(t.receipt_url);
            if (t.boleto_url) cancelSignedUrlRequest(t.boleto_url);
          }
        });
      }, { threshold: 0.1, rootMargin: '50px' });

      observer.observe(rowRef.current);
      return () => observer.disconnect();
    }, [t]);

    // Update local cache indicators periodically or on interaction
    useEffect(() => {
      const interval = setInterval(() => {
        setCachedState({
          receipt: isUrlCached(t.receipt_url),
          boleto: isUrlCached(t.boleto_url),
          pendingReceipt: isUrlPending(t.receipt_url),
          pendingBoleto: isUrlPending(t.boleto_url)
        });
      }, 2000);
      return () => clearInterval(interval);
    }, [t]);

    return (
      <motion.div 
        ref={rowRef}
        key={t.id} 
        initial={{ opacity: 0, y: 8 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ delay: Math.min(i, 10) * 0.03 }} 
        className={`glass-card-hover p-4 flex items-center gap-4 ${selected.has(t.id) ? "ring-1 ring-primary/40 bg-primary/5" : ""}`}
        onMouseEnter={() => handlePrefetch(t)}
        onFocus={() => handlePrefetch(t)}
        tabIndex={0}
      >
        <Checkbox
          checked={selected.has(t.id)}
          onCheckedChange={() => toggleSelect(t.id)}
          aria-label={`Selecionar ${t.description}`}
        />
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
        <Badge variant="outline" className={`text-[10px] flex-shrink-0 ${statusStyles[t.status]}`}>{statusLabels[t.status]}</Badge>
        <p className={`text-sm font-bold tabular-nums ${t.type === "income" ? "text-success" : "text-foreground"}`}>
          {t.type === "income" ? "+" : "-"} R$ {Number(t.amount).toLocaleString("pt-BR")}
        </p>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" title="Dividir" onClick={() => setSplitTx(t)}>
            <Split className="h-3 w-3" />
          </Button>
          {t.receipt_url && (
            <Button 
              variant="ghost" 
              size="icon" 
              className={`h-7 w-7 transition-all ${cachedState.receipt ? "text-success" : cachedState.pendingReceipt ? "text-primary animate-pulse" : "text-primary"} hover:text-primary/80`} 
              type="button" 
              title={cachedState.receipt ? "Comprovante (em cache)" : "Comprovante"} 
              disabled={isSigning === t.id + '-receipt'}
              onClick={async () => { 
                const requestId = t.id + '-receipt';
                if (abortControllersRef.current[requestId]) abortControllersRef.current[requestId].abort();
                const controller = new AbortController();
                abortControllersRef.current[requestId] = controller;
                setIsSigning(requestId);
                try {
                  const u = await getSignedReceiptUrl(t.receipt_url, controller.signal); 
                  if (u) { setReceiptUrl(u); setReceiptLabel("Comprovante"); }
                  else if (!controller.signal.aborted) toast.error("Não foi possível abrir o comprovante."); 
                } finally {
                  if (abortControllersRef.current[requestId] === controller) {
                    delete abortControllersRef.current[requestId];
                    setIsSigning(prev => prev === requestId ? null : prev);
                  }
                }
              }}
            >
              {isSigning === t.id + '-receipt' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />}
            </Button>
          )}
          {t.boleto_url && (
            <Button 
              variant="ghost" 
              size="icon" 
              className={`h-7 w-7 transition-all ${cachedState.boleto ? "text-success" : cachedState.pendingBoleto ? "text-warning animate-pulse" : "text-warning"} hover:text-warning/80`} 
              type="button" 
              title={cachedState.boleto ? "Boleto (em cache)" : "Boleto"} 
              disabled={isSigning === t.id + '-boleto'}
              onClick={async () => { 
                const requestId = t.id + '-boleto';
                if (abortControllersRef.current[requestId]) abortControllersRef.current[requestId].abort();
                const controller = new AbortController();
                abortControllersRef.current[requestId] = controller;
                setIsSigning(requestId);
                try {
                  const u = await getSignedReceiptUrl(t.boleto_url, controller.signal); 
                  if (u) { setReceiptUrl(u); setReceiptLabel("Boleto"); }
                  else if (!controller.signal.aborted) toast.error("Não foi possível abrir o boleto."); 
                } finally {
                  if (abortControllersRef.current[requestId] === controller) {
                    delete abortControllersRef.current[requestId];
                    setIsSigning(prev => prev === requestId ? null : prev);
                  }
                }
              }}
            >
              {isSigning === t.id + '-boleto' ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
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
    );
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

      <TransactionAdvancedSearch
        filters={advFilters}
        onChange={setAdvFilters}
        categories={categories}
        accounts={accounts}
      />

      {filtered.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 glass-card bg-primary/5 border-primary/10"
        >
          <div className="flex gap-8 w-full md:w-auto justify-center md:justify-start">
            <div className="space-y-0.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Receitas</p>
              <p className="text-base font-bold text-success">
                R$ {totals.income.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Despesas</p>
              <p className="text-base font-bold text-destructive">
                R$ {totals.expense.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Saldo</p>
              <p className={`text-base font-bold ${totals.income - totals.expense >= 0 ? "text-primary" : "text-destructive"}`}>
                R$ {(totals.income - totals.expense).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleExportPDF}
            className="w-full md:w-auto gap-2 bg-background hover:bg-secondary border-border"
          >
            <Printer className="h-4 w-4" />
            Imprimir PDF
          </Button>
        </motion.div>
      )}

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
          {/* Select all header */}
          <div className="flex items-center gap-3 px-4 py-2">
            <Checkbox
              checked={visibleItems.length > 0 && selected.size === visibleItems.length}
              onCheckedChange={toggleSelectAll}
              aria-label="Selecionar todos"
            />
            <span className="text-xs text-muted-foreground">
              {selected.size > 0
                ? `${selected.size} de ${filtered.length} selecionados`
                : `${filtered.length} transações`}
            </span>
          </div>

          {visibleItems.map((t, i) => (
            <TransactionRow key={t.id} t={t} i={i} />
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

      {/* Batch action bar */}
      <TransactionBatchBar
        count={selected.size}
        onDelete={() => setBatchConfirmOpen(true)}
        onClear={() => setSelected(new Set())}
        loading={batchDeleting}
      />

      {/* Batch delete confirm */}
      <ConfirmDialog
        open={batchConfirmOpen}
        onOpenChange={(open) => { if (!open) setBatchConfirmOpen(false); }}
        title="Excluir transações em lote"
        description={`Tem certeza que deseja excluir ${selected.size} transações? Esta ação não pode ser desfeita.`}
        onConfirm={handleBatchDelete}
      />

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
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-background border-border">
          <DialogTitle className="sr-only">{receiptLabel}</DialogTitle>
          <div className="flex items-center justify-between p-3 border-b border-border">
            <p className="text-sm font-medium text-foreground">{receiptLabel}</p>
            <div className="flex gap-1">
              <a href={receiptUrl || ""} target="_blank" rel="noopener noreferrer" download>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Baixar">
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </a>
            </div>
          </div>
          {receiptUrl && (
            receiptUrl.toLowerCase().includes(".pdf") ? (
              loadingPdf ? (
                <div className="flex flex-col items-center justify-center p-12 space-y-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Carregando PDF...</p>
                </div>
              ) : receiptBlobUrl ? (
                <iframe src={receiptBlobUrl} title={receiptLabel} className="w-full h-[80vh] border-0" />
              ) : (
                <div className="flex flex-col items-center justify-center p-8 space-y-4">
                  <FileText className="h-16 w-16 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Não foi possível carregar o PDF.</p>
                  <a href={receiptUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" className="gap-2">
                      <Download className="h-4 w-4" /> Abrir / Baixar PDF
                    </Button>
                  </a>
                </div>
              )
            ) : (
              <img src={receiptUrl} alt={receiptLabel} className="w-full max-h-[80vh] object-contain p-4" loading="lazy" />
            )
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Transactions;
