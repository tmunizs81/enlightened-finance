import { lazy, Suspense, useMemo, useState } from "react";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import {
  DraggableDashboard,
  DashboardWidgetManager,
  useDashboardWidgets,
  DashboardWidget,
} from "@/components/dashboard/DraggableDashboard";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { useSupabaseQuery } from "@/hooks/use-supabase-crud";
import { generateMonthlyReport } from "@/utils/reportGenerator";
import { toast } from "sonner";

// Lazy load heavy dashboard widgets
const CashFlowChart = lazy(() =>
  import("@/components/dashboard/CashFlowChart").then((m) => ({ default: m.CashFlowChart })),
);
const CategoryPieChart = lazy(() =>
  import("@/components/dashboard/CategoryPieChart").then((m) => ({ default: m.CategoryPieChart })),
);
const GoalsBarChart = lazy(() =>
  import("@/components/dashboard/GoalsBarChart").then((m) => ({ default: m.GoalsBarChart })),
);
const InsightsPanel = lazy(() =>
  import("@/components/dashboard/InsightsPanel").then((m) => ({ default: m.InsightsPanel })),
);
const FinancialScore = lazy(() =>
  import("@/components/dashboard/FinancialScore").then((m) => ({ default: m.FinancialScore })),
);
const SpendingHeatmap = lazy(() =>
  import("@/components/dashboard/SpendingHeatmap").then((m) => ({ default: m.SpendingHeatmap })),
);
const MonthlyComparison = lazy(() =>
  import("@/components/dashboard/MonthlyComparison").then((m) => ({
    default: m.MonthlyComparison,
  })),
);
const AnomalyDetection = lazy(() =>
  import("@/components/dashboard/AnomalyDetection").then((m) => ({ default: m.AnomalyDetection })),
);
const SmartAlerts = lazy(() =>
  import("@/components/dashboard/SmartAlerts").then((m) => ({ default: m.SmartAlerts })),
);
const BalanceForecastML = lazy(() =>
  import("@/components/dashboard/BalanceForecastML").then((m) => ({
    default: m.BalanceForecastML,
  })),
);
const WeeklySummary = lazy(() =>
  import("@/components/dashboard/WeeklySummary").then((m) => ({ default: m.WeeklySummary })),
);
const FocusMode = lazy(() =>
  import("@/components/dashboard/FocusMode").then((m) => ({ default: m.FocusMode })),
);
const GoalProjection = lazy(() =>
  import("@/components/dashboard/GoalProjection").then((m) => ({ default: m.GoalProjection })),
);
const WeeklyChallenges = lazy(() =>
  import("@/components/dashboard/WeeklyChallenges").then((m) => ({ default: m.WeeklyChallenges })),
);
const SubscriptionsDashboard = lazy(() =>
  import("@/components/dashboard/SubscriptionsDashboard").then((m) => ({
    default: m.SubscriptionsDashboard,
  })),
);
const YearlyComparison = lazy(() =>
  import("@/components/dashboard/YearlyComparison").then((m) => ({ default: m.YearlyComparison })),
);
const AIBudgetSuggestions = lazy(() =>
  import("@/components/dashboard/AIBudgetSuggestions").then((m) => ({
    default: m.AIBudgetSuggestions,
  })),
);
const PredictiveAlerts = lazy(() =>
  import("@/components/dashboard/PredictiveAlerts").then((m) => ({ default: m.PredictiveAlerts })),
);
const NetWorthEvolution = lazy(() =>
  import("@/components/dashboard/NetWorthEvolution").then((m) => ({
    default: m.NetWorthEvolution,
  })),
);
const NationalBenchmark = lazy(() =>
  import("@/components/dashboard/NationalBenchmark").then((m) => ({
    default: m.NationalBenchmark,
  })),
);

function WidgetFallback() {
  return (
    <div className="glass-card animate-pulse p-6">
      <div className="h-32 rounded bg-muted" />
    </div>
  );
}

function LazyWrap({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<WidgetFallback />}>{children}</Suspense>;
}

const Index = () => {
  const defaultWidgets: DashboardWidget[] = useMemo(
    () => [
      {
        id: "smart-alerts",
        label: "Alertas Inteligentes",
        component: (
          <LazyWrap>
            <SmartAlerts />
          </LazyWrap>
        ),
        visible: true,
      },
      {
        id: "predictive-alerts",
        label: "Alertas Preditivos",
        component: (
          <LazyWrap>
            <PredictiveAlerts />
          </LazyWrap>
        ),
        visible: true,
      },
      { id: "summary-cards", label: "Cards de Resumo", component: <SummaryCards />, visible: true },
      {
        id: "cashflow-score",
        label: "Fluxo de Caixa + Score",
        component: (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <LazyWrap>
                <CashFlowChart />
              </LazyWrap>
            </div>
            <LazyWrap>
              <FinancialScore />
            </LazyWrap>
          </div>
        ),
        visible: true,
      },
      {
        id: "net-worth",
        label: "Evolução Patrimônio",
        component: (
          <LazyWrap>
            <NetWorthEvolution />
          </LazyWrap>
        ),
        visible: true,
      },
      {
        id: "weekly-challenges",
        label: "Desafios Semanais",
        component: (
          <LazyWrap>
            <WeeklyChallenges />
          </LazyWrap>
        ),
        visible: true,
      },
      {
        id: "weekly-summary",
        label: "Resumo Semanal",
        component: (
          <LazyWrap>
            <WeeklySummary />
          </LazyWrap>
        ),
        visible: true,
      },
      {
        id: "monthly-category",
        label: "Comparativo + Categorias",
        component: (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <LazyWrap>
              <MonthlyComparison />
            </LazyWrap>
            <LazyWrap>
              <CategoryPieChart />
            </LazyWrap>
          </div>
        ),
        visible: true,
      },
      {
        id: "yearly-comparison",
        label: "Comparativo Anual",
        component: (
          <LazyWrap>
            <YearlyComparison />
          </LazyWrap>
        ),
        visible: true,
      },
      {
        id: "forecast-goals",
        label: "Previsão + Projeção Metas",
        component: (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <LazyWrap>
              <BalanceForecastML />
            </LazyWrap>
            <LazyWrap>
              <GoalProjection />
            </LazyWrap>
          </div>
        ),
        visible: true,
      },
      {
        id: "ai-budget",
        label: "Sugestões IA Orçamento",
        component: (
          <LazyWrap>
            <AIBudgetSuggestions />
          </LazyWrap>
        ),
        visible: true,
      },
      {
        id: "heatmap-anomaly",
        label: "Heatmap + Anomalias",
        component: (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <LazyWrap>
              <SpendingHeatmap />
            </LazyWrap>
            <LazyWrap>
              <AnomalyDetection />
            </LazyWrap>
          </div>
        ),
        visible: true,
      },
      {
        id: "subs-goals",
        label: "Assinaturas + Metas",
        component: (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <LazyWrap>
              <SubscriptionsDashboard />
            </LazyWrap>
            <LazyWrap>
              <GoalsBarChart />
            </LazyWrap>
          </div>
        ),
        visible: true,
      },
      {
        id: "national-benchmark",
        label: "Comparativo Nacional",
        component: (
          <LazyWrap>
            <NationalBenchmark />
          </LazyWrap>
        ),
        visible: true,
      },
      {
        id: "insights",
        label: "Insights",
        component: (
          <LazyWrap>
            <InsightsPanel />
          </LazyWrap>
        ),
        visible: true,
      },
    ],
    [],
  );

  const { widgets, onDragEnd, toggleVisibility, resetLayout } = useDashboardWidgets(defaultWidgets);
  const [generating, setGenerating] = useState(false);

  const { data: transactions = [] } = useSupabaseQuery<any>("transactions");
  const { data: categories = [] } = useSupabaseQuery<any>("categories");

  const handleDownloadReport = async () => {
    setGenerating(true);
    try {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const monthNames = [
        "Janeiro",
        "Fevereiro",
        "Março",
        "Abril",
        "Maio",
        "Junho",
        "Julho",
        "Agosto",
        "Setembro",
        "Outubro",
        "Novembro",
        "Dezembro",
      ];

      const thisMonthTx = transactions.filter((t: any) => {
        const d = new Date(t.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      });

      if (thisMonthTx.length === 0) {
        toast.error("Nenhuma transação encontrada para este mês.");
        return;
      }

      const totalIncome = thisMonthTx
        .filter((t: any) => t.type === "income" && t.status === "paid")
        .reduce((s: number, t: any) => s + Number(t.amount), 0);
      const totalExpense = thisMonthTx
        .filter((t: any) => t.type === "expense" && t.status === "paid")
        .reduce((s: number, t: any) => s + Number(t.amount), 0);

      const catMap = new Map(categories.map((c: any) => [c.id, c.name]));
      const categorySpendingMap = new Map<string, number>();

      thisMonthTx
        .filter((t: any) => t.type === "expense" && t.status === "paid")
        .forEach((t: any) => {
          const catName = t.category_id
            ? catMap.get(t.category_id) || "Sem Categoria"
            : "Sem Categoria";
          categorySpendingMap.set(
            catName,
            (categorySpendingMap.get(catName) || 0) + Number(t.amount),
          );
        });

      const categorySpendingArray = Array.from(categorySpendingMap.entries())
        .map(([name, amount]) => ({
          name,
          amount,
          percentage: totalExpense > 0 ? (amount / totalExpense) * 100 : 0,
        }))
        .sort((a, b) => b.amount - a.amount);

      const reportTransactions = thisMonthTx
        .filter((t: any) => t.status === "paid" || t.type === "expense")
        .map((t: any) => ({
          date: t.date,
          description: t.description,
          category: t.category_id ? catMap.get(t.category_id) || "-" : "-",
          amount: Number(t.amount),
          type: t.type,
        }))
        .sort((a: any, b: any) => b.date.localeCompare(a.date));

      await generateMonthlyReport(
        {
          totalIncome,
          totalExpense,
          balance: totalIncome - totalExpense,
          monthName: monthNames[currentMonth],
          year: currentYear,
        },
        categorySpendingArray,
        reportTransactions,
      );

      toast.success("Relatório mensal gerado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar relatório:", error);
      toast.error("Erro ao gerar relatório mensal.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral das suas finanças</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadReport}
            disabled={generating}
            className="hidden gap-1.5 border-primary/20 text-xs hover:bg-primary/5 sm:flex"
          >
            {generating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            {generating ? "Gerando..." : "Relatório Mensal"}
          </Button>
          <DashboardWidgetManager
            widgets={widgets}
            toggleVisibility={toggleVisibility}
            resetLayout={resetLayout}
          />
          <Suspense fallback={null}>
            <FocusMode />
          </Suspense>
        </div>
      </div>

      <DraggableDashboard widgets={widgets} onDragEnd={onDragEnd} />
    </div>
  );
};

export default Index;
