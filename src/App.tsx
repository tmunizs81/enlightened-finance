import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { AIChatPanel } from "@/components/chat/AIChatPanel";
import { useAuth } from "@/hooks/use-auth";
import Index from "./pages/Index";
import Transactions from "./pages/Transactions";
import Goals from "./pages/Goals";
import Accounts from "./pages/Accounts";
import Insights from "./pages/Insights";
import Budgets from "./pages/Budgets";
import Recurring from "./pages/Recurring";
import Reports from "./pages/Reports";
import SettingsPage from "./pages/Settings";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import AdminLicenses from "./pages/AdminLicenses";
import LicenseStatus from "./pages/LicenseStatus";
import Install from "./pages/Install";
import Achievements from "./pages/Achievements";
import FinancialRules from "./pages/FinancialRules";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/goals" element={<Goals />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/budgets" element={<Budgets />} />
        <Route path="/recurring" element={<Recurring />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/admin/licenses" element={<AdminLicenses />} />
        <Route path="/license" element={<LicenseStatus />} />
        <Route path="/install" element={<Install />} />
        <Route path="/achievements" element={<Achievements />} />
        <Route path="/rules" element={<FinancialRules />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <AIChatPanel />
    </AppLayout>
  );
}

function AuthRoute() {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (session) return <Navigate to="/" replace />;
  return <Auth />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<AuthRoute />} />
          <Route path="/*" element={<ProtectedRoutes />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
