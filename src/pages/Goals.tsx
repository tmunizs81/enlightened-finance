import { motion } from "framer-motion";
import { goals } from "@/lib/mock-data";
import { Progress } from "@/components/ui/progress";

const colorMap: Record<string, string> = {
  primary: "text-primary",
  accent: "text-accent",
  success: "text-success",
  warning: "text-warning",
};

const Goals = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Metas de Economia</h1>
        <p className="text-sm text-muted-foreground">Sistema de envelopes para suas metas financeiras</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {goals.map((goal, i) => {
          const pct = Math.round((goal.current / goal.target) * 100);
          return (
            <motion.div
              key={goal.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="glass-card-hover p-5 space-y-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{goal.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{goal.name}</p>
                    <p className="text-xs text-muted-foreground">
                      R$ {goal.current.toLocaleString("pt-BR")} de R$ {goal.target.toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>
                <span className={`text-lg font-bold ${colorMap[goal.color]}`}>{pct}%</span>
              </div>
              <div className="space-y-1">
                <Progress value={pct} className="h-2 bg-secondary" />
                <p className="text-[10px] text-muted-foreground text-right">
                  Faltam R$ {(goal.target - goal.current).toLocaleString("pt-BR")}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default Goals;
