import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoImage from "@/assets/logo.png";

interface SummaryData {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  monthName: string;
  year: number;
}

interface CategorySpending {
  name: string;
  amount: number;
  percentage: number;
}

interface Transaction {
  date: string;
  description: string;
  category: string;
  amount: number;
  type: "income" | "expense";
}

export const generateMonthlyReport = async (
  summary: SummaryData,
  categories: CategorySpending[],
  transactions: Transaction[],
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // --- Header ---
  const margin = 14;
  const logoSize = 12;
  const headerY = 20;

  try {
    doc.addImage(logoImage, "PNG", margin, headerY - 5, logoSize, logoSize);
  } catch (e) {
    // Fallback if logo fails
    doc.setFillColor(59, 130, 246);
    doc.roundedRect(margin, headerY - 5, logoSize, logoSize, 2, 2, "F");
  }

  doc.setTextColor(40, 40, 40);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("SimplyFin", margin + logoSize + 4, headerY + 3);

  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "normal");
  const reportTitle = `Relatório Mensal - ${summary.monthName} / ${summary.year}`;
  const titleWidth = doc.getTextWidth(reportTitle);
  doc.text(reportTitle, pageWidth - margin - titleWidth, headerY + 2);

  // --- Summary Box ---
  doc.setDrawColor(240, 240, 240);
  doc.line(margin, 35, pageWidth - margin, 35);

  doc.setFontSize(14);
  doc.setTextColor(40, 40, 40);
  doc.setFont("helvetica", "bold");
  doc.text("Resumo Financeiro", margin, 48);

  autoTable(doc, {
    startY: 55,
    body: [
      [
        {
          content: `RECEITAS\nR$ ${summary.totalIncome.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
          styles: { textColor: [34, 197, 94], fontStyle: "bold" },
        },
        {
          content: `DESPESAS\nR$ ${summary.totalExpense.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
          styles: { textColor: [239, 68, 68], fontStyle: "bold" },
        },
        {
          content: `SALDO\nR$ ${summary.balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
          styles: {
            textColor: summary.balance >= 0 ? [59, 130, 246] : [239, 68, 68],
            fontStyle: "bold",
          },
        },
      ],
    ],
    theme: "plain",
    styles: { cellPadding: 5, fontSize: 10, halign: "center", cellWidth: (pageWidth - 28) / 3 },
  });

  // --- Category Chart (Bars) ---
  doc.setFontSize(12);
  doc.setTextColor(40, 40, 40);
  doc.setFont("helvetica", "bold");
  doc.text("Gastos por Categoria", margin, 95);

  let chartY = 105;
  const maxAmount = categories.length > 0 ? Math.max(...categories.map((c) => c.amount)) : 1;

  categories.slice(0, 8).forEach((cat) => {
    const barWidth = (cat.amount / maxAmount) * 100;
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "normal");
    doc.text(cat.name, margin, chartY);

    doc.setFillColor(240, 240, 240);
    doc.rect(50, chartY - 3, 100, 4, "F");
    doc.setFillColor(59, 130, 246);
    doc.rect(50, chartY - 3, Math.max(2, barWidth), 4, "F");

    doc.setTextColor(60, 60, 60);
    doc.text(
      `R$ ${cat.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (${cat.percentage.toFixed(1)}%)`,
      155,
      chartY,
    );
    chartY += 8;
  });

  // --- Transactions Table ---
  doc.setFontSize(12);
  doc.setTextColor(40, 40, 40);
  doc.setFont("helvetica", "bold");
  doc.text("Detalhamento de Transações", margin, chartY + 10);

  autoTable(doc, {
    startY: chartY + 18,
    head: [["Data", "Descrição", "Categoria", "Tipo", "Valor"]],
    body: transactions.map((t) => [
      new Date(t.date).toLocaleDateString("pt-BR"),
      t.description,
      t.category,
      t.type === "income" ? "Receita" : "Despesa",
      `R$ ${t.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
    ]),
    theme: "striped",
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: [255, 255, 255],
      fontSize: 10,
      halign: "center",
    },
    columnStyles: {
      4: { halign: "right" },
    },
    styles: {
      fontSize: 8,
      cellPadding: 3,
    },
    margin: { top: 20 },
  });

  // --- Footer ---
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Página ${i} de ${totalPages} | Gerado por SimplyFin em ${new Date().toLocaleDateString("pt-BR")}`,
      margin,
      doc.internal.pageSize.getHeight() - 10,
    );
  }

  doc.save(`Relatorio_SimpliFin_${summary.monthName}_${summary.year}.pdf`);
};
