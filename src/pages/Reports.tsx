import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSupabaseQuery } from "@/hooks/use-supabase-crud";
import { Download, FileText, TrendingDown, TrendingUp, Wallet, BarChart3, Filter, X, Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

interface Transaction {
  id: string;
  amount: number;
  type: string;
  status: string;
  date: string;
  description: string;
  category_id: string | null;
  account_id: string | null;
}

interface Account {
  id: string;
  name: string;
  balance: number;
  type: string;
}

interface Category {
  id: string;
  name: string;
  type: string;
  icon: string | null;
}

interface Goal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
}

interface Budget {
  id: string;
  amount: number;
  category_id: string | null;
  month: number;
  year: number;
}

const CHART_COLORS = [
  [79, 70, 229],
  [16, 185, 129],
  [245, 158, 11],
  [239, 68, 68],
  [59, 130, 246],
  [168, 85, 247],
  [236, 72, 153],
  [20, 184, 166],
  [249, 115, 22],
  [99, 102, 241],
];

const Reports = () => {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [selectedMonth, setSelectedMonth] = useState(currentMonth.toString());
  const [filterType, setFilterType] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterAccount, setFilterAccount] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const { data: transactions = [] } = useSupabaseQuery<Transaction>("transactions", "date", false);
  const { data: accounts = [] } = useSupabaseQuery<Account>("accounts");
  const { data: categories = [] } = useSupabaseQuery<Category>("categories");
  const { data: goals = [] } = useSupabaseQuery<Goal>("goals");
  const { data: budgets = [] } = useSupabaseQuery<Budget>("budgets");

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const months = [
    { value: "1", label: "Janeiro" }, { value: "2", label: "Fevereiro" },
    { value: "3", label: "Março" }, { value: "4", label: "Abril" },
    { value: "5", label: "Maio" }, { value: "6", label: "Junho" },
    { value: "7", label: "Julho" }, { value: "8", label: "Agosto" },
    { value: "9", label: "Setembro" }, { value: "10", label: "Outubro" },
    { value: "11", label: "Novembro" }, { value: "12", label: "Dezembro" },
  ];

  const acctMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // Unique categories used in the period
  const uniqueCategories = useMemo(() => {
    const seen = new Set<string>();
    return categories.filter((c) => {
      const key = c.name.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [categories]);

  // Base filter by month/year
  const periodFiltered = useMemo(() => transactions.filter((t) => {
    const d = new Date(t.date);
    return d.getFullYear() === parseInt(selectedYear) && d.getMonth() + 1 === parseInt(selectedMonth);
  }), [transactions, selectedYear, selectedMonth]);

  // Advanced filters
  const filtered = useMemo(() => {
    return periodFiltered.filter((t) => {
      if (filterType !== "all" && t.type !== filterType) return false;
      if (filterCategory !== "all" && t.category_id !== filterCategory) return false;
      if (filterAccount !== "all" && t.account_id !== filterAccount) return false;
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (filterDateFrom && t.date < filterDateFrom) return false;
      if (filterDateTo && t.date > filterDateTo) return false;
      if (searchTerm && !t.description.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [periodFiltered, filterType, filterCategory, filterAccount, filterStatus, filterDateFrom, filterDateTo, searchTerm]);

  const activeFilterCount = [filterType, filterCategory, filterAccount, filterStatus].filter((f) => f !== "all").length
    + (filterDateFrom ? 1 : 0) + (filterDateTo ? 1 : 0) + (searchTerm ? 1 : 0);

  const clearFilters = () => {
    setFilterType("all");
    setFilterCategory("all");
    setFilterAccount("all");
    setFilterStatus("all");
    setFilterDateFrom("");
    setFilterDateTo("");
    setSearchTerm("");
  };

  const totalIncome = filtered.filter((t) => t.type === "income" && t.status === "paid").reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = filtered.filter((t) => t.type === "expense" && t.status === "paid").reduce((s, t) => s + Number(t.amount), 0);
  const balance = totalIncome - totalExpense;
  const totalBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);
  const pendingCount = filtered.filter((t) => t.status === "pending").length;
  const paidCount = filtered.filter((t) => t.status === "paid").length;

  const categoryData = useMemo(() => {
    const seen = new Set<string>();
    return categories.map((cat) => {
      const catTx = filtered.filter((t) => t.category_id === cat.id && t.status === "paid");
      const total = catTx.reduce((s, t) => s + Number(t.amount), 0);
      return { name: cat.name, type: cat.type, total, count: catTx.length, icon: cat.icon };
    }).filter((c) => {
      if (c.total <= 0) return false;
      const key = c.name.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => b.total - a.total);
  }, [categories, filtered]);

  const expenseCategories = categoryData.filter((c) => c.type === "expense");
  const incomeCategories = categoryData.filter((c) => c.type === "income");

  const topExpenses = useMemo(() =>
    filtered.filter((t) => t.type === "expense" && t.status === "paid")
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .slice(0, 10),
    [filtered]
  );

  const budgetComparison = useMemo(() => {
    const monthBudgets = budgets.filter((b) => b.month === parseInt(selectedMonth) && b.year === parseInt(selectedYear));
    return monthBudgets.map((b) => {
      const cat = catMap.get(b.category_id || "");
      const spent = filtered.filter((t) => t.category_id === b.category_id && t.type === "expense" && t.status === "paid")
        .reduce((s, t) => s + Number(t.amount), 0);
      return { category: cat?.name || "Geral", budget: Number(b.amount), spent, pct: Number(b.amount) > 0 ? (spent / Number(b.amount)) * 100 : 0 };
    });
  }, [budgets, filtered, selectedMonth, selectedYear, catMap]);

  // Account breakdown
  const accountBreakdown = useMemo(() => {
    return accounts.map((acc) => {
      const accTx = filtered.filter((t) => t.account_id === acc.id && t.status === "paid");
      const income = accTx.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
      const expense = accTx.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
      return { name: acc.name, type: acc.type, balance: Number(acc.balance), income, expense, txCount: accTx.length };
    }).filter((a) => a.txCount > 0);
  }, [accounts, filtered]);

  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  const drawBarChart = (doc: jsPDF, data: { label: string; value: number; color: number[] }[], x: number, y: number, w: number, h: number, title: string) => {
    if (data.length === 0) return y;
    const maxVal = Math.max(...data.map((d) => d.value));
    const barH = Math.min(12, (h - 20) / data.length);
    const gap = 2;

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(title, x, y);
    y += 8;

    data.forEach((item, i) => {
      const barW = maxVal > 0 ? ((item.value / maxVal) * (w - 60)) : 0;
      const barY = y + i * (barH + gap);

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 80, 80);
      const label = item.label.length > 15 ? item.label.substring(0, 15) + "…" : item.label;
      doc.text(label, x, barY + barH / 2 + 1);

      doc.setFillColor(item.color[0], item.color[1], item.color[2]);
      doc.roundedRect(x + 55, barY - 2, Math.max(barW, 2), barH - 1, 1, 1, "F");

      doc.setTextColor(40, 40, 40);
      doc.text(fmt(item.value), x + 58 + barW, barY + barH / 2 + 1);
    });

    doc.setTextColor(0, 0, 0);
    return y + data.length * (barH + gap) + 5;
  };

  const exportToPDF = () => {
    try {
      const doc = new jsPDF();
      const monthLabel = months.find((m) => m.value === selectedMonth)?.label || "";
      const pageW = doc.internal.pageSize.getWidth();

      // === HEADER ===
      doc.setFillColor(79, 70, 229);
      doc.rect(0, 0, pageW, 35, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("T2-SimplyFin", 14, 16);
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(`Relatório Financeiro · ${monthLabel} ${selectedYear}`, 14, 26);
      doc.setFontSize(8);
      doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}`, pageW - 14, 26, { align: "right" });

      // Active filters info
      if (activeFilterCount > 0) {
        doc.setFontSize(7);
        const filtersText: string[] = [];
        if (filterType !== "all") filtersText.push(`Tipo: ${filterType === "income" ? "Receita" : "Despesa"}`);
        if (filterCategory !== "all") filtersText.push(`Categoria: ${catMap.get(filterCategory)?.name || filterCategory}`);
        if (filterAccount !== "all") filtersText.push(`Conta: ${acctMap.get(filterAccount)?.name || filterAccount}`);
        if (filterStatus !== "all") filtersText.push(`Status: ${filterStatus === "paid" ? "Pago" : "Pendente"}`);
        if (searchTerm) filtersText.push(`Busca: "${searchTerm}"`);
        doc.text(`Filtros: ${filtersText.join(" | ")}`, 14, 32);
      }

      doc.setTextColor(0, 0, 0);

      // === SUMMARY BOXES ===
      let y = 45;
      const boxW = (pageW - 38) / 4;
      const boxes = [
        { label: "Receitas", value: fmt(totalIncome), color: [16, 185, 129] },
        { label: "Despesas", value: fmt(totalExpense), color: [239, 68, 68] },
        { label: "Saldo Período", value: fmt(balance), color: balance >= 0 ? [16, 185, 129] : [239, 68, 68] },
        { label: "Patrimônio", value: fmt(totalBalance), color: [79, 70, 229] },
      ];
      boxes.forEach((box, i) => {
        const bx = 14 + i * (boxW + 4);
        doc.setFillColor(245, 245, 250);
        doc.roundedRect(bx, y, boxW, 22, 2, 2, "F");
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text(box.label, bx + 4, y + 8);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(box.color[0], box.color[1], box.color[2]);
        doc.text(box.value, bx + 4, y + 18);
      });
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
      y += 32;

      // === EXPENSE BAR CHART ===
      if (expenseCategories.length > 0) {
        const chartData = expenseCategories.slice(0, 8).map((c, i) => ({
          label: c.name, value: c.total, color: CHART_COLORS[i % CHART_COLORS.length],
        }));
        y = drawBarChart(doc, chartData, 14, y, pageW / 2 - 20, 100, "Despesas por Categoria");
      }

      // === INCOME BAR CHART ===
      if (incomeCategories.length > 0) {
        const chartData = incomeCategories.slice(0, 5).map((c, i) => ({
          label: c.name, value: c.total, color: CHART_COLORS[(i + 3) % CHART_COLORS.length],
        }));
        const chartX = pageW / 2 + 5;
        drawBarChart(doc, chartData, chartX, y - (expenseCategories.length > 0 ? expenseCategories.slice(0, 8).length * 14 + 13 : 0), pageW / 2 - 20, 100, "Receitas por Categoria");
      }

      // === BUDGET vs ACTUAL ===
      if (budgetComparison.length > 0) {
        y += 5;
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("Orçamento vs Realizado", 14, y);
        y += 3;

        autoTable(doc, {
          startY: y,
          head: [["Categoria", "Orçamento", "Gasto", "% Usado", "Status"]],
          body: budgetComparison.map((b) => [
            b.category,
            fmt(b.budget),
            fmt(b.spent),
            `${b.pct.toFixed(1)}%`,
            b.pct > 100 ? "⚠️ Estourado" : b.pct > 80 ? "⚡ Atenção" : "✅ OK",
          ]),
          theme: "grid",
          headStyles: { fillColor: [79, 70, 229], fontSize: 9 },
          styles: { fontSize: 8 },
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      }

      // === TOP EXPENSES ===
      if (topExpenses.length > 0) {
        if (y > 240) { doc.addPage(); y = 20; }
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("Top 10 Maiores Despesas", 14, y);
        y += 3;

        autoTable(doc, {
          startY: y,
          head: [["#", "Data", "Descrição", "Categoria", "Conta", "Valor"]],
          body: topExpenses.map((t, i) => [
            (i + 1).toString(),
            new Date(t.date).toLocaleDateString("pt-BR"),
            t.description,
            catMap.get(t.category_id || "")?.name || "—",
            acctMap.get(t.account_id || "")?.name || "—",
            fmt(Number(t.amount)),
          ]),
          theme: "grid",
          headStyles: { fillColor: [239, 68, 68], fontSize: 9 },
          styles: { fontSize: 8 },
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      }

      // === ACCOUNT BALANCES ===
      if (accounts.length > 0) {
        if (y > 240) { doc.addPage(); y = 20; }
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("Saldo por Conta", 14, y);
        y += 3;

        autoTable(doc, {
          startY: y,
          head: [["Conta", "Tipo", "Saldo"]],
          body: accounts.map((a) => [
            a.name,
            a.type === "checking" ? "Corrente" : a.type === "savings" ? "Poupança" : a.type === "investment" ? "Investimento" : a.type,
            fmt(Number(a.balance)),
          ]),
          theme: "grid",
          headStyles: { fillColor: [59, 130, 246], fontSize: 9 },
          styles: { fontSize: 8 },
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      }

      // === GOALS PROGRESS ===
      if (goals.length > 0) {
        if (y > 240) { doc.addPage(); y = 20; }
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("Progresso das Metas", 14, y);
        y += 3;

        autoTable(doc, {
          startY: y,
          head: [["Meta", "Atual", "Objetivo", "Progresso", "Prazo"]],
          body: goals.map((g) => {
            const pct = Number(g.target_amount) > 0 ? (Number(g.current_amount) / Number(g.target_amount)) * 100 : 0;
            return [
              g.name,
              fmt(Number(g.current_amount)),
              fmt(Number(g.target_amount)),
              `${pct.toFixed(1)}%`,
              g.deadline ? new Date(g.deadline).toLocaleDateString("pt-BR") : "—",
            ];
          }),
          theme: "grid",
          headStyles: { fillColor: [16, 185, 129], fontSize: 9 },
          styles: { fontSize: 8 },
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      }

      // === ALL TRANSACTIONS ===
      if (filtered.length > 0) {
        if (y > 220) { doc.addPage(); y = 20; }
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(`Transações Detalhadas (${filtered.length})`, 14, y);
        y += 3;

        autoTable(doc, {
          startY: y,
          head: [["Data", "Descrição", "Categoria", "Conta", "Tipo", "Status", "Valor"]],
          body: filtered.map((t) => [
            new Date(t.date).toLocaleDateString("pt-BR"),
            t.description,
            catMap.get(t.category_id || "")?.name || "—",
            acctMap.get(t.account_id || "")?.name || "—",
            t.type === "income" ? "Receita" : "Despesa",
            t.status === "paid" ? "Pago" : t.status === "pending" ? "Pendente" : "Atrasado",
            fmt(Number(t.amount)),
          ]),
          theme: "striped",
          headStyles: { fillColor: [79, 70, 229], fontSize: 8 },
          styles: { fontSize: 7 },
        });
      }

      // === FOOTER ===
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text(`T2-SimplyFin · ${monthLabel} ${selectedYear} · Página ${i}/${pageCount}`, pageW / 2, doc.internal.pageSize.getHeight() - 8, { align: "center" });
      }

      doc.save(`relatorio-${monthLabel}-${selectedYear}.pdf`);
      toast.success("Relatório PDF exportado com sucesso!");
    } catch (error) {
      console.error("Erro ao exportar PDF:", error);
      toast.error("Erro ao exportar relatório");
    }
  };

  const acctTypeLabel = (t: string) => t === "checking" ? "Corrente" : t === "savings" ? "Poupança" : t === "investment" ? "Investimento" : t === "credit" ? "Crédito" : t;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
          <p className="text-sm text-muted-foreground">Visualize e exporte relatórios financeiros detalhados</p>
        </div>
        <Button onClick={exportToPDF} className="gap-2 gradient-bg-primary text-primary-foreground">
          <Download className="h-4 w-4" /> Exportar PDF
        </Button>
      </div>

      {/* Period + Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" /> Período e Filtros</CardTitle>
              <CardDescription>Selecione o período e aplique filtros avançados</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="gap-2">
              <Filter className="h-4 w-4" />
              Filtros
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Period Row */}
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[150px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Mês</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Ano</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="border-t border-border pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Filtros Avançados</span>
                {activeFilterCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-xs h-7">
                    <X className="h-3 w-3" /> Limpar filtros
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo</label>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="income">Receita</SelectItem>
                      <SelectItem value="expense">Despesa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Categoria</label>
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {uniqueCategories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Conta</label>
                  <Select value={filterAccount} onValueChange={setFilterAccount}>
                    <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="paid">Pago</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Data inicial</label>
                  <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Data final</label>
                  <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Buscar descrição</label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Pesquisar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Receitas</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent><div className="text-xl font-bold text-success">{fmt(totalIncome)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Despesas</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent><div className="text-xl font-bold text-destructive">{fmt(totalExpense)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo Período</CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><div className={`text-xl font-bold ${balance >= 0 ? "text-success" : "text-destructive"}`}>{fmt(balance)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo Total</CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><div className="text-xl font-bold text-primary">{fmt(totalBalance)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Transações</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-foreground">{filtered.length}</div>
            <div className="text-xs text-muted-foreground mt-1">{paidCount} pagas · {pendingCount} pendentes</div>
          </CardContent>
        </Card>
      </div>

      {/* Budget vs Actual */}
      {budgetComparison.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Orçamento vs Realizado</CardTitle>
            <CardDescription>Acompanhe o uso do seu orçamento por categoria</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {budgetComparison.map((b) => (
              <div key={b.category} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{b.category}</span>
                  <span className={b.pct > 100 ? "text-destructive" : "text-muted-foreground"}>
                    {fmt(b.spent)} / {fmt(b.budget)} ({b.pct.toFixed(0)}%)
                  </span>
                </div>
                <Progress value={Math.min(b.pct, 100)} className={`h-2 ${b.pct > 100 ? "[&>div]:bg-destructive" : b.pct > 80 ? "[&>div]:bg-warning" : ""}`} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Account Breakdown */}
      {accountBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Movimentação por Conta</CardTitle>
            <CardDescription>Receitas e despesas agrupadas por conta</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Conta</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Receitas</TableHead>
                  <TableHead className="text-right">Despesas</TableHead>
                  <TableHead className="text-right">Saldo Atual</TableHead>
                  <TableHead className="text-right">Transações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accountBreakdown.map((a) => (
                  <TableRow key={a.name}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell>{acctTypeLabel(a.type)}</TableCell>
                    <TableCell className="text-right text-success">{fmt(a.income)}</TableCell>
                    <TableCell className="text-right text-destructive">{fmt(a.expense)}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(a.balance)}</TableCell>
                    <TableCell className="text-right">{a.txCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Category Breakdown */}
      {expenseCategories.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Despesas por Categoria</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">% do Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenseCategories.map((cat) => (
                  <TableRow key={cat.name}>
                    <TableCell className="font-medium">{cat.icon} {cat.name}</TableCell>
                    <TableCell className="text-right">{cat.count}</TableCell>
                    <TableCell className="text-right">{fmt(cat.total)}</TableCell>
                    <TableCell className="text-right">{totalExpense > 0 ? ((cat.total / totalExpense) * 100).toFixed(1) : 0}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Income Categories */}
      {incomeCategories.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Receitas por Categoria</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">% do Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incomeCategories.map((cat) => (
                  <TableRow key={cat.name}>
                    <TableCell className="font-medium">{cat.icon} {cat.name}</TableCell>
                    <TableCell className="text-right">{cat.count}</TableCell>
                    <TableCell className="text-right">{fmt(cat.total)}</TableCell>
                    <TableCell className="text-right">{totalIncome > 0 ? ((cat.total / totalIncome) * 100).toFixed(1) : 0}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Top Expenses */}
      {topExpenses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top 10 Maiores Despesas</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topExpenses.map((t, i) => (
                  <TableRow key={t.id}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>{new Date(t.date).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="font-medium">{t.description}</TableCell>
                    <TableCell>{catMap.get(t.category_id || "")?.name || "—"}</TableCell>
                    <TableCell>{acctMap.get(t.account_id || "")?.name || "—"}</TableCell>
                    <TableCell className="text-right text-destructive font-medium">{fmt(Number(t.amount))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Transações do Período</CardTitle>
          <CardDescription>
            {filtered.length} transação(ões) encontrada(s)
            {activeFilterCount > 0 && ` · ${activeFilterCount} filtro(s) ativo(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma transação encontrada para os filtros selecionados</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Conta</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="whitespace-nowrap">{new Date(t.date).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="font-medium">{t.description}</TableCell>
                      <TableCell>{catMap.get(t.category_id || "")?.name || "—"}</TableCell>
                      <TableCell>{acctMap.get(t.account_id || "")?.name || "—"}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${t.type === "income" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                          {t.type === "income" ? "Receita" : "Despesa"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${t.status === "paid" ? "bg-primary/10 text-primary" : "bg-warning/10 text-warning"}`}>
                          {t.status === "paid" ? "Pago" : "Pendente"}
                        </span>
                      </TableCell>
                      <TableCell className={`text-right font-medium whitespace-nowrap ${t.type === "income" ? "text-success" : "text-destructive"}`}>
                        {fmt(Number(t.amount))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Reports;
