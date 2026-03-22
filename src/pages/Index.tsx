import { lazy, Suspense, useMemo } from "react";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import {
  DraggableDashboard,
  DashboardWidgetManager,
  useDashboardWidgets,
  DashboardWidget,
} from "@/components/dashboard/DraggableDashboard";

// Lazy load heavy dashboard widgets
const CashFlowChart = lazy(() => import("@/components/dashboard/CashFlowChart").then(m => ({ default: m.CashFlowChart })));
const CategoryPieChart = lazy(() => import("@/components/dashboard/CategoryPieChart").then(m => ({ default: m.CategoryPieChart })));
const GoalsBarChart = lazy(() => import("@/components/dashboard/GoalsBarChart").then(m => ({ default: m.GoalsBarChart })));
const InsightsPanel = lazy(() => import("@/components/dashboard/InsightsPanel").then(m => ({ default: m.InsightsPanel })));
const FinancialScore = lazy(() => import("@/components/dashboard/FinancialScore").then(m => ({ default: m.FinancialScore })));
const SpendingHeatmap = lazy(() => import("@/components/dashboard/SpendingHeatmap").then(m => ({ default: m.SpendingHeatmap })));
const MonthlyComparison = lazy(() => import("@/components/dashboard/MonthlyComparison").then(m => ({ default: m.MonthlyComparison })));
const AnomalyDetection = lazy(() => import("@/components/dashboard/AnomalyDetection").then(m => ({ default: m.AnomalyDetection })));
const SmartAlerts = lazy(() => import("@/components/dashboard/SmartAlerts").then(m => ({ default: m.SmartAlerts })));
const BalanceForecastML = lazy(() => import("@/components/dashboard/BalanceForecastML").then(m => ({ default: m.BalanceForecastML })));
const WeeklySummary = lazy(() => import("@/components/dashboard/WeeklySummary").then(m => ({ default: m.WeeklySummary })));
const FocusMode = lazy(() => import("@/components/dashboard/FocusMode").then(m => ({ default: m.FocusMode })));
const GoalProjection = lazy(() => import("@/components/dashboard/GoalProjection").then(m => ({ default: m.GoalProjection })));
const WeeklyChallenges = lazy(() => import("@/components/dashboard/WeeklyChallenges").then(m => ({ default: m.WeeklyChallenges })));
const SubscriptionsDashboard = lazy(() => import("@/components/dashboard/SubscriptionsDashboard").then(m => ({ default: m.SubscriptionsDashboard })));
const YearlyComparison = lazy(() => import("@/components/dashboard/YearlyComparison").then(m => ({ default: m.YearlyComparison })));
const AIBudgetSuggestions = lazy(() => import("@/components/dashboard/AIBudgetSuggestions").then(m => ({ default: m.AIBudgetSuggestions })));
const PredictiveAlerts = lazy(() => import("@/components/dashboard/PredictiveAlerts").then(m => ({ default: m.PredictiveAlerts })));
const NetWorthEvolution = lazy(() => import("@/components/dashboard/NetWorthEvolution").then(m => ({ default: m.NetWorthEvolution })));
const NationalBenchmark = lazy(() => import("@/components/dashboard/NationalBenchmark").then(m => ({ default: m.NationalBenchmark })));

function WidgetFallback() {
  return <div className="glass-card p-6 animate-pulse"><div className="h-32 bg-muted rounded" /></div>;
}

function LazyWrap({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<WidgetFallback />}>{children}</Suspense>;
}

const Index = () => {
  const defaultWidgets: DashboardWidget[] = useMemo(
    () => [
      { id: "smart-alerts", label: "Alertas Inteligentes", component: <LazyWrap><SmartAlerts /></LazyWrap>, visible: true },
      { id: "predictive-alerts", label: "Alertas Preditivos", component: <LazyWrap><PredictiveAlerts /></LazyWrap>, visible: true },
      { id: "summary-cards", label: "Cards de Resumo", component: <SummaryCards />, visible: true },
      {
        id: "cashflow-score",
        label: "Fluxo de Caixa + Score",
        component: (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2"><LazyWrap><CashFlowChart /></LazyWrap></div>
            <LazyWrap><FinancialScore /></LazyWrap>
          </div>
        ),
        visible: true,
      },
      { id: "net-worth", label: "Evolução Patrimônio", component: <LazyWrap><NetWorthEvolution /></LazyWrap>, visible: true },
      { id: "weekly-challenges", label: "Desafios Semanais", component: <LazyWrap><WeeklyChallenges /></LazyWrap>, visible: true },
      { id: "weekly-summary", label: "Resumo Semanal", component: <LazyWrap><WeeklySummary /></LazyWrap>, visible: true },
      {
        id: "monthly-category",
        label: "Comparativo + Categorias",
        component: (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <LazyWrap><MonthlyComparison /></LazyWrap>
            <LazyWrap><CategoryPieChart /></LazyWrap>
          </div>
        ),
        visible: true,
      },
      { id: "yearly-comparison", label: "Comparativo Anual", component: <LazyWrap><YearlyComparison /></LazyWrap>, visible: true },
      {
        id: "forecast-goals",
        label: "Previsão + Projeção Metas",
        component: (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <LazyWrap><BalanceForecastML /></LazyWrap>
            <LazyWrap><GoalProjection /></LazyWrap>
          </div>
        ),
        visible: true,
      },
      { id: "ai-budget", label: "Sugestões IA Orçamento", component: <LazyWrap><AIBudgetSuggestions /></LazyWrap>, visible: true },
      {
        id: "heatmap-anomaly",
        label: "Heatmap + Anomalias",
        component: (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <LazyWrap><SpendingHeatmap /></LazyWrap>
            <LazyWrap><AnomalyDetection /></LazyWrap>
          </div>
        ),
        visible: true,
      },
      {
        id: "subs-goals",
        label: "Assinaturas + Metas",
        component: (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <LazyWrap><SubscriptionsDashboard /></LazyWrap>
            <LazyWrap><GoalsBarChart /></LazyWrap>
          </div>
        ),
        visible: true,
      },
      { id: "national-benchmark", label: "Comparativo Nacional", component: <LazyWrap><NationalBenchmark /></LazyWrap>, visible: true },
      { id: "insights", label: "Insights", component: <LazyWrap><InsightsPanel /></LazyWrap>, visible: true },
    ],
    []
  );

  const { widgets, onDragEnd, toggleVisibility, resetLayout } = useDashboardWidgets(defaultWidgets);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral das suas finanças</p>
        </div>
        <div className="flex items-center gap-2">
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
