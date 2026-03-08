import { useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle, XCircle, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSupabaseQuery } from "@/hooks/use-supabase-crud";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Insight {
  id: string;
  type: string;
  title: string;
  description: string;
  read: boolean;
  created_at: string;
}

const iconMap: Record<string, any> = {
  warning: AlertTriangle,
  success: CheckCircle,
  destructive: XCircle,
};

const colorMap: Record<string, string> = {
  warning: "text-warning",
  success: "text-success",
  destructive: "text-destructive",
};

export function InsightsPanel() {
  const { data: insights = [], isLoading } = useSupabaseQuery<Insight>("ai_insights" as any, "created_at", false);
  const [generating, setGenerating] = useState(false);
  const qc = useQueryClient();

  const generateInsights = async () => {
    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-insights`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({}),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erro" }));
        throw new Error(err.error || `Erro ${resp.status}`);
      }

      qc.invalidateQueries({ queryKey: ["ai_insights"] });
      toast.success("Insights gerados com sucesso!");
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar insights");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">🧠 Insights da IA</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={generateInsights}
          disabled={generating}
          className="text-xs border-border text-muted-foreground hover:text-primary gap-1.5"
        >
          {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          {generating ? "Analisando..." : "Gerar Insights"}
        </Button>
      </div>
      <div className="space-y-3">
        {isLoading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {!isLoading && insights.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            Clique em "Gerar Insights" para a IA analisar suas transações e gerar alertas personalizados.
          </p>
        )}
        {insights.map((insight, i) => {
          const Icon = iconMap[insight.type] || AlertTriangle;
          return (
            <motion.div
              key={insight.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1, duration: 0.3 }}
              className="flex gap-3 p-3 rounded-lg bg-secondary/50 border border-border/50"
            >
              <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${colorMap[insight.type] || "text-muted-foreground"}`} />
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
