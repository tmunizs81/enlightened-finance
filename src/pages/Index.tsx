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

const Index = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral das suas finanças</p>
        </div>
        <FocusMode />
      </div>

      <SmartAlerts />

      <SummaryCards />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <CashFlowChart />
        </div>
        <FinancialScore />
      </div>

      <WeeklySummary />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MonthlyComparison />
        <CategoryPieChart />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BalanceForecastML />
        <GoalProjection />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SpendingHeatmap />
        <AnomalyDetection />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GoalsBarChart />
      </div>

      <InsightsPanel />
    </div>
  );
};

export default Index;
