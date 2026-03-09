import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, AlertTriangle, CheckCircle, Info, XCircle, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Alert {
  type: string;
  severity: "info" | "warning" | "danger" | "success";
  title: string;
  message: string;
  icon: string;
}

const severityStyles: Record<string, { bg: string; border: string; icon: typeof Info }> = {
  danger: { bg: "bg-destructive/10", border: "border-destructive/20", icon: XCircle },
  warning: { bg: "bg-warning/10", border: "border-warning/20", icon: AlertTriangle },
  info: { bg: "bg-primary/10", border: "border-primary/20", icon: Info },
  success: { bg: "bg-success/10", border: "border-success/20", icon: CheckCircle },
};

const severityText: Record<string, string> = {
  danger: "text-destructive",
  warning: "text-warning",
  info: "text-primary",
  success: "text-success",
};

export function SmartAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [dailyBudget, setDailyBudget] = useState(0);
  const [daysLeft, setDaysLeft] = useState(0);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.functions.invoke("smart-alerts").then(({ data, error }) => {
      if (!error && data) {
        setAlerts(data.alerts || []);
        setDailyBudget(data.dailyBudget || 0);
        setDaysLeft(data.daysLeft || 0);
      }
      setLoading(false);
    });
  }, []);

  const visibleAlerts = alerts.filter((a) => !dismissed.has(a.type + a.title));

  if (loading || visibleAlerts.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <Bell className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Alertas Inteligentes</h3>
        <span className="text-[10px] bg-destructive/15 text-destructive px-2 py-0.5 rounded-full">{visibleAlerts.length}</span>
      </div>
      <AnimatePresence>
        {visibleAlerts.slice(0, 5).map((alert) => {
          const style = severityStyles[alert.severity];
          const IconComp = style.icon;
          return (
            <motion.div
              key={alert.type + alert.title}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, height: 0 }}
              className={`flex items-start gap-3 p-3 rounded-lg ${style.bg} border ${style.border}`}
            >
              <span className="text-base shrink-0 mt-0.5">{alert.icon}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium ${severityText[alert.severity]}`}>{alert.title}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{alert.message}</p>
              </div>
              <button onClick={() => setDismissed((p) => new Set(p).add(alert.type + alert.title))} className="text-muted-foreground hover:text-foreground shrink-0">
                <X className="h-3 w-3" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
      {dailyBudget > 0 && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/15 mt-1">
          <div>
            <p className="text-[10px] text-muted-foreground">Orçamento diário restante</p>
            <p className="text-sm font-bold text-primary">R$ {dailyBudget.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
          </div>
          <p className="text-[10px] text-muted-foreground">{daysLeft} dias restantes</p>
        </div>
      )}
    </motion.div>
  );
}
