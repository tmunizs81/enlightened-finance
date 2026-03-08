import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { CashFlowChart } from "@/components/dashboard/CashFlowChart";
import { CategoryPieChart } from "@/components/dashboard/CategoryPieChart";
import { GoalsBarChart } from "@/components/dashboard/GoalsBarChart";
import { BalanceForecast } from "@/components/dashboard/BalanceForecast";
import { InsightsPanel } from "@/components/dashboard/InsightsPanel";

const Index = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral das suas finanças</p>
      </div>

      <SummaryCards />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CashFlowChart />
        <CategoryPieChart />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GoalsBarChart />
        <BalanceForecast />
      </div>

      <InsightsPanel />
    </div>
  );
};

export default Index;
