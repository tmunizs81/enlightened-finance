import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Sparkles, Check, X, Loader2, PiggyBank } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

interface Suggestion {
  catName: string;
  catId: string;
  currentAvg: number;
  suggestedBudget: number;
  reason: string;
}

export function AIBudgetSuggestions() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [avgIncome, setAvgIncome] = useState(0);
  const [applying, setApplying] = useState<string | null>(null);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const { user } = useAuth();

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-budget-suggest");
      if (error) throw error;
      if (data) {
        setSuggestions(data.suggestions || []);
        setAvgIncome(data.avgIncome || 0);
      }
    } catch (e) {
      console.error("Error fetching budget suggestions:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const applyBudget = async (suggestion: Suggestion) => {
    if (!user) return;
    setApplying(suggestion.catId);
    try {
      const now = new Date();
      const { error } = await supabase.from("budgets").upsert({
        user_id: user.id,
        category_id: suggestion.catId === "none" ? null : suggestion.catId,
        amount: suggestion.suggestedBudget,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
      }, { onConflict: "user_id,category_id,month,year" });

      if (error) throw error;
      setApplied((prev) => new Set([...prev, suggestion.catId]));
      toast.success(`Orçamento de ${suggestion.catName} definido!`);
    } catch (e: any) {
      toast.error("Erro ao aplicar orçamento");
    } finally {
      setApplying(null);
    }
  };

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Orçamentos Sugeridos pela IA</h3>
        </div>
        <div className="flex items-center justify-center py-8 gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">Analisando seus gastos...</span>
        </div>
      </motion.div>
    );
  }

  if (suggestions.length === 0) return null;

  const totalSuggested = suggestions.reduce((s, sg) => s + sg.suggestedBudget, 0);
  const savingsProjected = avgIncome - totalSuggested;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Orçamentos Sugeridos pela IA</h3>
        </div>
        {avgIncome > 0 && (
          <div className="flex items-center gap-1.5 text-[10px]">
            <PiggyBank className="h-3 w-3 text-success" />
            <span className="text-success font-medium">
              Economia projetada: R$ {savingsProjected.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
            </span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {suggestions.slice(0, 8).map((s) => {
          const diff = s.currentAvg - s.suggestedBudget;
          const isApplied = applied.has(s.catId);

          return (
            <div key={s.catId} className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/30 border border-border/50">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium text-foreground truncate">{s.catName}</p>
                  {diff > 0 && (
                    <span className="text-[10px] text-success bg-success/10 px-1.5 py-0.5 rounded-full">
                      -R$ {diff.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground truncate">{s.reason}</p>
                <div className="flex gap-3 mt-1">
                  <span className="text-[10px] text-muted-foreground">
                    Atual: R$ {s.currentAvg.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                  </span>
                  <span className="text-[10px] text-primary font-medium">
                    Sugerido: R$ {s.suggestedBudget.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
              <div>
                {isApplied ? (
                  <div className="h-7 w-7 rounded-md bg-success/15 flex items-center justify-center">
                    <Check className="h-3.5 w-3.5 text-success" />
                  </div>
                ) : (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-primary hover:bg-primary/10"
                    onClick={() => applyBudget(s)}
                    disabled={applying === s.catId}
                  >
                    {applying === s.catId ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
