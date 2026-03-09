import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSupabaseQuery } from "@/hooks/use-supabase-crud";
import { Download, FileText, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
}

interface Account {
  id: string;
  name: string;
  balance: number;
}

interface Category {
  id: string;
  name: string;
  type: string;
}

const Reports = () => {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [selectedMonth, setSelectedMonth] = useState(currentMonth.toString());
  
  const { data: transactions = [] } = useSupabaseQuery<Transaction>("transactions", "date", false);
  const { data: accounts = [] } = useSupabaseQuery<Account>("accounts");
  const { data: categories = [] } = useSupabaseQuery<Category>("categories");

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const months = [
    { value: "1", label: "Janeiro" },
    { value: "2", label: "Fevereiro" },
    { value: "3", label: "Março" },
    { value: "4", label: "Abril" },
    { value: "5", label: "Maio" },
    { value: "6", label: "Junho" },
    { value: "7", label: "Julho" },
    { value: "8", label: "Agosto" },
    { value: "9", label: "Setembro" },
    { value: "10", label: "Outubro" },
    { value: "11", label: "Novembro" },
    { value: "12", label: "Dezembro" },
  ];

  // Filter transactions by selected period
  const filteredTransactions = transactions.filter((t) => {
    const date = new Date(t.date);
    return (
      date.getFullYear() === parseInt(selectedYear) &&
      date.getMonth() + 1 === parseInt(selectedMonth)
    );
  });

  // Calculate totals
  const totalIncome = filteredTransactions
    .filter((t) => t.type === "income" && t.status === "paid")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalExpense = filteredTransactions
    .filter((t) => t.type === "expense" && t.status === "paid")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const balance = totalIncome - totalExpense;
  const totalBalance = accounts.reduce((sum, a) => sum + Number(a.balance), 0);

  // Group by category
  const categoryData = categories.map((cat) => {
    const catTransactions = filteredTransactions.filter(
      (t) => t.category_id === cat.id && t.status === "paid"
    );
    const total = catTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
    return {
      name: cat.name,
      type: cat.type,
      total,
      count: catTransactions.length,
    };
  }).filter((c) => c.total > 0);

  const exportToPDF = () => {
    try {
      const doc = new jsPDF();
      const monthLabel = months.find((m) => m.value === selectedMonth)?.label || "";
      
      // Header
      doc.setFontSize(20);
      doc.text("T2-FinAI - Relatório Financeiro", 14, 20);
      
      doc.setFontSize(12);
      doc.text(`Período: ${monthLabel}/${selectedYear}`, 14, 30);
      doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, 14, 37);

      // Summary
      doc.setFontSize(14);
      doc.text("Resumo do Período", 14, 50);
      
      autoTable(doc, {
        startY: 55,
        head: [["Descrição", "Valor"]],
        body: [
          ["Receitas", `R$ ${totalIncome.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`],
          ["Despesas", `R$ ${totalExpense.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`],
          ["Saldo do Período", `R$ ${balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`],
          ["Saldo Total Atual", `R$ ${totalBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`],
        ],
        theme: "grid",
        headStyles: { fillColor: [79, 70, 229] },
      });

      // Category breakdown
      if (categoryData.length > 0) {
        doc.setFontSize(14);
        doc.text("Despesas por Categoria", 14, (doc as any).lastAutoTable.finalY + 15);
        
        autoTable(doc, {
          startY: (doc as any).lastAutoTable.finalY + 20,
          head: [["Categoria", "Quantidade", "Total"]],
          body: categoryData
            .filter((c) => c.type === "expense")
            .map((c) => [
              c.name,
              c.count.toString(),
              `R$ ${c.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
            ]),
          theme: "grid",
          headStyles: { fillColor: [79, 70, 229] },
        });
      }

      // Transactions
      if (filteredTransactions.length > 0) {
        doc.setFontSize(14);
        doc.text("Transações Detalhadas", 14, (doc as any).lastAutoTable.finalY + 15);
        
        autoTable(doc, {
          startY: (doc as any).lastAutoTable.finalY + 20,
          head: [["Data", "Descrição", "Tipo", "Status", "Valor"]],
          body: filteredTransactions.map((t) => [
            new Date(t.date).toLocaleDateString("pt-BR"),
            t.description,
            t.type === "income" ? "Receita" : "Despesa",
            t.status === "paid" ? "Pago" : "Pendente",
            `R$ ${Number(t.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
          ]),
          theme: "striped",
          headStyles: { fillColor: [79, 70, 229] },
          styles: { fontSize: 9 },
        });
      }

      doc.save(`relatorio-${monthLabel}-${selectedYear}.pdf`);
      toast.success("Relatório exportado com sucesso!");
    } catch (error) {
      console.error("Erro ao exportar PDF:", error);
      toast.error("Erro ao exportar relatório");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
        <p className="text-sm text-muted-foreground">Visualize e exporte relatórios financeiros detalhados</p>
      </div>

      {/* Period Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Período do Relatório</CardTitle>
          <CardDescription>Selecione o mês e ano para gerar o relatório</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-foreground mb-2 block">Mês</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-foreground mb-2 block">Ano</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={exportToPDF} className="gap-2">
                <Download className="h-4 w-4" />
                Exportar PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Receitas</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              R$ {totalIncome.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Despesas</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              R$ {totalExpense.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo do Período</CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${balance >= 0 ? "text-success" : "text-destructive"}`}>
              R$ {balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo Total</CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              R$ {totalBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown */}
      {categoryData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Despesas por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">% do Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categoryData
                  .filter((c) => c.type === "expense")
                  .sort((a, b) => b.total - a.total)
                  .map((cat) => (
                    <TableRow key={cat.name}>
                      <TableCell className="font-medium">{cat.name}</TableCell>
                      <TableCell className="text-right">{cat.count}</TableCell>
                      <TableCell className="text-right">
                        R$ {cat.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right">
                        {totalExpense > 0 ? ((cat.total / totalExpense) * 100).toFixed(1) : 0}%
                      </TableCell>
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
            {filteredTransactions.length} transação(ões) encontrada(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredTransactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma transação encontrada para este período
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>{new Date(transaction.date).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="font-medium">{transaction.description}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          transaction.type === "income"
                            ? "bg-success/10 text-success"
                            : "bg-destructive/10 text-destructive"
                        }`}
                      >
                        {transaction.type === "income" ? "Receita" : "Despesa"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          transaction.status === "paid"
                            ? "bg-primary/10 text-primary"
                            : "bg-warning/10 text-warning"
                        }`}
                      >
                        {transaction.status === "paid" ? "Pago" : "Pendente"}
                      </span>
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium ${
                        transaction.type === "income" ? "text-success" : "text-destructive"
                      }`}
                    >
                      R$ {Number(transaction.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Reports;
