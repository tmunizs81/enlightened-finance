import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useSupabaseQuery, useSupabaseInsert, useSupabaseUpdate, useSupabaseDelete } from "@/hooks/use-supabase-crud";
import { GoalForm } from "@/components/forms/GoalForm";
import { useConfetti } from "@/hooks/use-confetti";

const colorMap: Record<string, string> = {
  primary: "text-primary",
  accent: "text-accent",
  success: "text-success",
  warning: "text-warning",
};

interface Goal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  icon: string | null;
  color: string | null;
  deadline: string | null;
  user_id: string;
}

const Goals = () => {
  const { fireCanon } = useConfetti();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);

  const { data: goals = [], isLoading } = useSupabaseQuery<Goal>("goals");
  const insertMutation = useSupabaseInsert("goals");
  const updateMutation = useSupabaseUpdate("goals");
  const deleteMutation = useSupabaseDelete("goals");

  const handleSubmit = (data: any) => {
    if (data.id) {
      updateMutation.mutate(data, { onSuccess: () => { setEditing(null); setFormOpen(false); } });
    } else {
      insertMutation.mutate(data, { onSuccess: () => setFormOpen(false) });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Metas de Economia</h1>
          <p className="text-sm text-muted-foreground">Sistema de envelopes para suas metas financeiras</p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="gradient-bg-primary text-primary-foreground gap-2">
          <Plus className="h-4 w-4" /> Nova Meta
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Carregando...</div>
      ) : goals.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-sm">Nenhuma meta criada</p>
          <p className="text-muted-foreground text-xs mt-1">Clique em "Nova Meta" para começar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map((goal, i) => {
            const pct = goal.target_amount > 0 ? Math.round((Number(goal.current_amount) / Number(goal.target_amount)) * 100) : 0;
            return (
              <motion.div key={goal.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="glass-card-hover p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{goal.icon || "🎯"}</span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{goal.name}</p>
                      <p className="text-xs text-muted-foreground">
                        R$ {Number(goal.current_amount).toLocaleString("pt-BR")} de R$ {Number(goal.target_amount).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-lg font-bold ${colorMap[goal.color || "primary"]}`}>{pct}%</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => { setEditing(goal); setFormOpen(true); }}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteMutation.mutate(goal.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Progress value={pct} className="h-2 bg-secondary" />
                  <div className="flex justify-between">
                    {goal.deadline && (
                      <p className="text-[10px] text-muted-foreground">Prazo: {new Date(goal.deadline).toLocaleDateString("pt-BR")}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground ml-auto">
                      Faltam R$ {(Number(goal.target_amount) - Number(goal.current_amount)).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <GoalForm
        open={formOpen}
        onOpenChange={(v) => { setFormOpen(v); if (!v) setEditing(null); }}
        onSubmit={handleSubmit}
        initialData={editing}
        loading={insertMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
};

export default Goals;
