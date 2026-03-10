import { useMemo } from "react";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { CashFlowChart } from "@/components/dashboard/CashFlowChart";
import { CategoryPieChart } from "@/components/dashboard/CategoryPieChart";
import { GoalsBarChart } from "@/components/dashboard/GoalsBarChart";
import { InsightsPanel } from "@/components/dashboard/InsightsPanel";
import { FinancialScore } from "@/components/dashboard/FinancialScore";
import { SpendingHeatmap } from "@/components/dashboard/SpendingHeatmap";
import { MonthlyComparison } from "@/components/dashboard/MonthlyComparison";
import { AnomalyDetection } from "@/components/dashboard/AnomalyDetection";
import { SmartAlerts } from "@/components/dashboard/SmartAlerts";
import { BalanceForecastML } from "@/components/dashboard/BalanceForecastML";
import { WeeklySummary } from "@/components/dashboard/WeeklySummary";
import { FocusMode } from "@/components/dashboard/FocusMode";
import { GoalProjection } from "@/components/dashboard/GoalProjection";
import { WeeklyChallenges } from "@/components/dashboard/WeeklyChallenges";
import { SubscriptionsDashboard } from "@/components/dashboard/SubscriptionsDashboard";
import { YearlyComparison } from "@/components/dashboard/YearlyComparison";
import { AIBudgetSuggestions } from "@/components/dashboard/AIBudgetSuggestions";
import { PredictiveAlerts } from "@/components/dashboard/PredictiveAlerts";
import { NetWorthEvolution } from "@/components/dashboard/NetWorthEvolution";
import { NationalBenchmark } from "@/components/dashboard/NationalBenchmark";
import {
  DraggableDashboard,
  DashboardWidgetManager,
  useDashboardWidgets,
  DashboardWidget,
} from "@/components/dashboard/DraggableDashboard";

const Index = () => {
  const defaultWidgets: DashboardWidget[] = useMemo(
    () => [
      { id: "smart-alerts", label: "Alertas Inteligentes", component: <SmartAlerts />, visible: true },
      { id: "predictive-alerts", label: "Alertas Preditivos", component: <PredictiveAlerts />, visible: true },
      { id: "summary-cards", label: "Cards de Resumo", component: <SummaryCards />, visible: true },
      {
        id: "cashflow-score",
        label: "Fluxo de Caixa + Score",
        component: (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2"><CashFlowChart /></div>
            <FinancialScore />
          </div>
        ),
        visible: true,
      },
      { id: "net-worth", label: "Evolução Patrimônio", component: <NetWorthEvolution />, visible: true },
      { id: "weekly-challenges", label: "Desafios Semanais", component: <WeeklyChallenges />, visible: true },
      { id: "weekly-summary", label: "Resumo Semanal", component: <WeeklySummary />, visible: true },
      {
        id: "monthly-category",
        label: "Comparativo + Categorias",
        component: (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <MonthlyComparison />
            <CategoryPieChart />
          </div>
        ),
        visible: true,
      },
      { id: "yearly-comparison", label: "Comparativo Anual", component: <YearlyComparison />, visible: true },
      {
        id: "forecast-goals",
        label: "Previsão + Projeção Metas",
        component: (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BalanceForecastML />
            <GoalProjection />
          </div>
        ),
        visible: true,
      },
      { id: "ai-budget", label: "Sugestões IA Orçamento", component: <AIBudgetSuggestions />, visible: true },
      {
        id: "heatmap-anomaly",
        label: "Heatmap + Anomalias",
        component: (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SpendingHeatmap />
            <AnomalyDetection />
          </div>
        ),
        visible: true,
      },
      {
        id: "subs-goals",
        label: "Assinaturas + Metas",
        component: (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SubscriptionsDashboard />
            <GoalsBarChart />
          </div>
        ),
        visible: true,
      },
      { id: "national-benchmark", label: "Comparativo Nacional", component: <NationalBenchmark />, visible: true },
      { id: "insights", label: "Insights", component: <InsightsPanel />, visible: true },
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
          <FocusMode />
        </div>
      </div>

      <DraggableDashboard widgets={widgets} onDragEnd={onDragEnd} />
    </div>
  );
};

export default Index;
