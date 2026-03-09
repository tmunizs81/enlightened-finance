import { useMemo } from "react";
import { motion } from "framer-motion";
import { Target, CalendarClock } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine } from "recharts";
import { useSupabaseQuery } from "@/hooks/use-supabase-crud";

interface Goal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  icon: string | null;
  color: string | null;
  deadline: string | null;
  created_at: string;
}

const COLORS = ["hsl(175, 80%, 50%)", "hsl(265, 70%, 60%)", "hsl(152, 60%, 48%)", "hsl(38, 92%, 55%)", "hsl(340, 70%, 58%)"];

export function GoalProjection() {
  const { data: goals = [] } = useSupabaseQuery<Goal>("goals");

  const projections = useMemo(() => {
    return goals.filter((g) => Number(g.current_amount) < Number(g.target_amount)).map((goal, idx) => {
      const current = Number(goal.current_amount);
      const target = Number(goal.target_amount);
      const remaining = target - current;
      const created = new Date(goal.created_at);
      const now = new Date();
      const daysSinceCreation = Math.max(1, Math.ceil((now.getTime() - created.getTime()) / 86400000));
      const dailyRate = current / daysSinceCreation;
      const daysToComplete = dailyRate > 0 ? Math.ceil(remaining / dailyRate) : 999;
      const estimatedDate = new Date(now);
      estimatedDate.setDate(estimatedDate.getDate() + daysToComplete);

      // Generate points
      const points: { day: string; value: number }[] = [];
      const totalDays = Math.min(daysToComplete, 365);
      const step = Math.max(1, Math.floor(totalDays / 20));
      
      for (let i = 0; i <= totalDays; i += step) {
        const d = new Date(now);
        d.setDate(d.getDate() + i);
        points.push({
          day: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
          value: Math.min(target, current + dailyRate * i),
        });
      }
      // Ensure last point reaches target
      if (points[points.length - 1]?.value < target) {
        points.push({ day: estimatedDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), value: target });
      }

      return {
        ...goal,
        dailyRate,
        daysToComplete: Math.min(daysToComplete, 9999),
        estimatedDate,
        points,
        color: COLORS[idx % COLORS.length],
        progress: Math.round((current / target) * 100),
      };
    });
  }, [goals]);

  if (projections.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Projeção de Metas</h3>
      </div>

      <div className="space-y-4">
        {projections.slice(0, 3).map((proj) => (
          <div key={proj.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">{proj.icon || "🎯"}</span>
                <span className="text-xs font-medium text-foreground">{proj.name}</span>
                <span className="text-[10px] text-muted-foreground">({proj.progress}%)</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <CalendarClock className="h-3 w-3" />
                {proj.daysToComplete < 9999
                  ? `~${proj.estimatedDate.toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}`
                  : "Sem previsão"
                }
              </div>
            </div>
            <div className="h-24">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={proj.points}>
                  <XAxis dataKey="day" tick={{ fontSize: 8, fill: "hsl(215, 15%, 55%)" }} axisLine={false} tickLine={false} interval={Math.floor(proj.points.length / 4)} />
                  <YAxis tick={{ fontSize: 8, fill: "hsl(215, 15%, 55%)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} domain={[0, Number(proj.target_amount)]} />
                  <Tooltip contentStyle={{ background: "hsl(220, 18%, 10%)", border: "1px solid hsl(220, 14%, 18%)", borderRadius: 8, fontSize: 10 }} formatter={(v: number) => [`R$ ${v.toLocaleString("pt-BR")}`, proj.name]} />
                  <ReferenceLine y={Number(proj.target_amount)} stroke="hsl(152, 60%, 48%)" strokeDasharray="4 4" strokeOpacity={0.5} />
                  <Line type="monotone" dataKey="value" stroke={proj.color} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {proj.deadline && (
              <p className="text-[10px] text-muted-foreground">
                Prazo: {new Date(proj.deadline).toLocaleDateString("pt-BR")}
                {proj.estimatedDate <= new Date(proj.deadline) ? " ✅ No ritmo certo" : " ⚠️ Aumente os aportes"}
              </p>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}
