import { useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle, XCircle, Brain, RefreshCw, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSupabaseQuery, useSupabaseDelete } from "@/hooks/use-supabase-crud";
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
  warning: "text-warning bg-warning/15",
  success: "text-success bg-success/15",
  destructive: "text-destructive bg-destructive/15",
};

const Insights = () => {
  const { data: insights = [], isLoading } = useSupabaseQuery<Insight>("ai_insights" as any, "created_at", false);
  const deleteInsight = useSupabaseDelete("ai_insights" as any);
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="gradient-bg-primary rounded-lg p-2.5">
            <Brain className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Insights da IA</h1>
            <p className="text-sm text-muted-foreground">Análise inteligente das suas finanças</p>
          </div>
        </div>
        <Button
          onClick={generateInsights}
          disabled={generating}
          className="gradient-bg-primary text-primary-foreground gap-2"
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {generating ? "Analisando..." : "Gerar Insights"}
        </Button>
      </div>

      <div className="glass-card p-5">
        <p className="text-xs text-muted-foreground mb-1">💡 Como funciona</p>
        <p className="text-sm text-muted-foreground">
          A IA analisa suas transações dos últimos 90 dias, contas, metas e categorias para gerar insights personalizados.
          Clique em <strong>"Gerar Insights"</strong> para atualizar a análise.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && insights.length === 0 && (
        <div className="glass-card p-8 text-center">
          <Brain className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum insight gerado ainda.</p>
          <p className="text-xs text-muted-foreground mt-1">Cadastre transações e clique em "Gerar Insights" para a IA analisar seus dados.</p>
        </div>
      )}

      <div className="space-y-3">
        {insights.map((insight, i) => {
          const Icon = iconMap[insight.type] || AlertTriangle;
          return (
            <motion.div
              key={insight.id}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass-card-hover p-5 flex gap-4"
            >
              <div className={`rounded-lg p-2.5 h-fit ${colorMap[insight.type] || "text-muted-foreground bg-muted"}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">{insight.title}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{insight.description}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-2">
                  {new Date(insight.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => deleteInsight.mutate(insight.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default Insights;
