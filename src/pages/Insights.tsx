import { motion } from "framer-motion";
import { insights } from "@/lib/mock-data";
import { AlertTriangle, CheckCircle, XCircle, Brain } from "lucide-react";

const iconMap = {
  warning: AlertTriangle,
  success: CheckCircle,
  destructive: XCircle,
};

const colorMap = {
  warning: "text-warning bg-warning/15",
  success: "text-success bg-success/15",
  destructive: "text-destructive bg-destructive/15",
};

const Insights = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="gradient-bg-primary rounded-lg p-2.5">
          <Brain className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Insights da IA</h1>
          <p className="text-sm text-muted-foreground">Análise inteligente das suas finanças</p>
        </div>
      </div>

      <div className="glass-card p-5">
        <p className="text-xs text-muted-foreground mb-1">💡 Chat com IA</p>
        <p className="text-sm text-muted-foreground">
          A integração com IA será habilitada ao conectar o Lovable Cloud. Você poderá perguntar coisas como: 
          <em>"Quanto gastei com iFood em fevereiro?"</em>
        </p>
      </div>

      <div className="space-y-3">
        {insights.map((insight, i) => {
          const Icon = iconMap[insight.type];
          return (
            <motion.div
              key={insight.id}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass-card-hover p-5 flex gap-4"
            >
              <div className={`rounded-lg p-2.5 h-fit ${colorMap[insight.type]}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{insight.title}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{insight.description}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default Insights;
