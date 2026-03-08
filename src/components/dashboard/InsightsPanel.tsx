import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { insights } from "@/lib/mock-data";

const iconMap = {
  warning: AlertTriangle,
  success: CheckCircle,
  destructive: XCircle,
};

const colorMap = {
  warning: "text-warning",
  success: "text-success",
  destructive: "text-destructive",
};

export function InsightsPanel() {
  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">🧠 Insights da IA</h3>
      <div className="space-y-3">
        {insights.map((insight, i) => {
          const Icon = iconMap[insight.type];
          return (
            <motion.div
              key={insight.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1, duration: 0.3 }}
              className="flex gap-3 p-3 rounded-lg bg-secondary/50 border border-border/50"
            >
              <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${colorMap[insight.type]}`} />
              <div>
                <p className="text-xs font-semibold text-foreground">{insight.title}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{insight.description}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
