import { useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle, CheckCircle, XCircle, Brain, RefreshCw, Loader2, Trash2,
  TrendingUp, TrendingDown, Minus, CalendarRange, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSupabaseQuery, useSupabaseDelete } from "@/hooks/use-supabase-crud";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface Insight {
  id: string;
  type: string;
  title: string;
  description: string;
  read: boolean;
  created_at: string;
}

interface MonthlySummary {
  current: { month: string; income: number; expense: number; net: number; count: number; byCat: Record<string, number> };
  previous: { month: string; income: number; expense: number; net: number; count: number; byCat: Record<string, number> };
  changes: { income: number; expense: number; net: number };
  ai: { narrative: string; verdict: string; top_change_category?: string; top_change_percent?: number };
}

const iconMap: Record<string, any> = { warning: AlertTriangle, success: CheckCircle, destructive: XCircle };
const colorMap: Record<string, string> = {
  warning: "text-warning bg-warning/15",
  success: "text-success bg-success/15",
  destructive: "text-destructive bg-destructive/15",
};

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function PctBadge({ value }: { value: number }) {
  const isPos = value > 0;
  const isZero = Math.abs(value) < 0.5;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${isZero ? "text-muted-foreground" : isPos ? "text-success" : "text-destructive"}`}>
      {isZero ? <Minus className="h-3 w-3" /> : isPos ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

const Insights = () => {
  const { data: insights = [], isLoading } = useSupabaseQuery<Insight>("ai_insights" as any, "created_at", false);
  const deleteInsight = useSupabaseDelete("ai_insights" as any);
  const [generating, setGenerating] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const qc = useQueryClient();

  const generateInsights = async () => {
    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-insights`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({}),
      });
      if (!resp.ok) { const err = await resp.json().catch(() => ({ error: "Erro" })); throw new Error(err.error || `Erro ${resp.status}`); }
      qc.invalidateQueries({ queryKey: ["ai_insights"] });
      toast.success("Insights gerados com sucesso!");
    } catch (e: any) { toast.error(e.message || "Erro ao gerar insights"); } finally { setGenerating(false); }
  };

  const generateSummary = async () => {
    setSummaryLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/monthly-summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({}),
      });
      if (!resp.ok) { const err = await resp.json().catch(() => ({ error: "Erro" })); throw new Error(err.error || `Erro ${resp.status}`); }
      const data = await resp.json();
      setSummary(data);
      toast.success("Resumo mensal gerado!");
    } catch (e: any) { toast.error(e.message || "Erro ao gerar resumo"); } finally { setSummaryLoading(false); }
  };

  const verdictConfig: Record<string, { icon: any; color: string; label: string }> = {
    positive: { icon: TrendingUp, color: "text-success bg-success/15", label: "Mês positivo" },
    neutral: { icon: Minus, color: "text-muted-foreground bg-muted", label: "Mês neutro" },
    negative: { icon: TrendingDown, color: "text-destructive bg-destructive/15", label: "Mês negativo" },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
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
        <Button onClick={generateInsights} disabled={generating} className="gradient-bg-primary text-primary-foreground gap-2">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {generating ? "Analisando..." : "Gerar Insights"}
        </Button>
      </div>

      {/* Monthly Summary Section */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarRange className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Resumo Mensal Comparativo</h2>
          </div>
          <Button variant="outline" size="sm" onClick={generateSummary} disabled={summaryLoading} className="text-xs border-border text-muted-foreground hover:text-primary gap-1.5">
            {summaryLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            {summaryLoading ? "Gerando..." : "Gerar Resumo"}
          </Button>
        </div>

        {!summary && !summaryLoading && (
          <p className="text-xs text-muted-foreground text-center py-4">
            Clique em "Gerar Resumo" para a IA comparar seu mês atual com o anterior.
          </p>
        )}

        {summaryLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-xs text-muted-foreground">Analisando seus dados...</span>
          </div>
        )}

        {summary && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Comparison Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-secondary/50 border border-border/50 p-3 space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Receitas</p>
                <p className="text-sm font-bold text-foreground">{formatBRL(summary.current.income)}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">{formatBRL(summary.previous.income)}</span>
                  <PctBadge value={summary.changes.income} />
                </div>
              </div>
              <div className="rounded-lg bg-secondary/50 border border-border/50 p-3 space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Despesas</p>
                <p className="text-sm font-bold text-foreground">{formatBRL(summary.current.expense)}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">{formatBRL(summary.previous.expense)}</span>
                  <PctBadge value={-summary.changes.expense} />
                </div>
              </div>
              <div className="rounded-lg bg-secondary/50 border border-border/50 p-3 space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Saldo</p>
                <p className={`text-sm font-bold ${summary.current.net >= 0 ? "text-success" : "text-destructive"}`}>{formatBRL(summary.current.net)}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">{formatBRL(summary.previous.net)}</span>
                  <PctBadge value={summary.changes.net} />
                </div>
              </div>
            </div>

            {/* AI Verdict */}
            {summary.ai.narrative && (() => {
              const vc = verdictConfig[summary.ai.verdict] || verdictConfig.neutral;
              const VIcon = vc.icon;
              return (
                <div className="rounded-lg bg-secondary/30 border border-border/50 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className={`rounded-md p-1.5 ${vc.color}`}>
                      <VIcon className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-xs font-semibold text-foreground">{vc.label} — {summary.current.month} vs {summary.previous.month}</span>
                  </div>
                  <div className="text-xs text-muted-foreground leading-relaxed prose prose-sm prose-invert max-w-none">
                    <ReactMarkdown>{summary.ai.narrative}</ReactMarkdown>
                  </div>
                  {summary.ai.top_change_category && (
                    <p className="text-[10px] text-muted-foreground/70">
                      📊 Maior variação: <strong className="text-foreground">{summary.ai.top_change_category}</strong>
                      {summary.ai.top_change_percent != null && ` (${summary.ai.top_change_percent > 0 ? "+" : ""}${summary.ai.top_change_percent.toFixed(1)}%)`}
                    </p>
                  )}
                </div>
              );
            })()}
          </motion.div>
        )}
      </div>

      {/* How it works */}
      <div className="glass-card p-5">
        <p className="text-xs text-muted-foreground mb-1">💡 Como funciona</p>
        <p className="text-sm text-muted-foreground">
          A IA analisa suas transações dos últimos 90 dias, contas, metas e categorias para gerar insights personalizados.
          Clique em <strong>"Gerar Insights"</strong> para atualizar a análise.
        </p>
      </div>

      {/* Insights List */}
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
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0" onClick={() => deleteInsight.mutate(insight.id)}>
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
