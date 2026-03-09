import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";

export function WeeklySummary() {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check cache
    const cached = sessionStorage.getItem("t2-weekly-summary");
    const cacheTime = sessionStorage.getItem("t2-weekly-summary-time");
    if (cached && cacheTime && Date.now() - Number(cacheTime) < 3600000) {
      setSummary(cached);
      setLoading(false);
      return;
    }

    supabase.functions.invoke("weekly-summary").then(({ data, error }) => {
      if (!error && data?.summary) {
        setSummary(data.summary);
        sessionStorage.setItem("t2-weekly-summary", data.summary);
        sessionStorage.setItem("t2-weekly-summary-time", String(Date.now()));
      }
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Resumo Semanal IA</h3>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span className="text-xs">Gerando análise da semana...</span>
        </div>
      </motion.div>
    );
  }

  if (!summary) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Resumo Semanal IA</h3>
        <span className="text-[9px] bg-primary/15 text-primary px-2 py-0.5 rounded-full ml-auto">IA</span>
      </div>
      <div className="prose prose-sm prose-invert max-w-none text-xs leading-relaxed text-muted-foreground [&_strong]:text-foreground [&_p]:mb-1.5">
        <ReactMarkdown>{summary}</ReactMarkdown>
      </div>
    </motion.div>
  );
}
