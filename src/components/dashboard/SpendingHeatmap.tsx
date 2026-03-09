import { useMemo } from "react";
import { motion } from "framer-motion";
import { Flame } from "lucide-react";
import { useSupabaseQuery } from "@/hooks/use-supabase-crud";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Transaction {
  id: string;
  amount: number;
  type: string;
  status: string;
  date: string;
}

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WEEKS_TO_SHOW = 12;

export function SpendingHeatmap() {
  const { data: transactions = [] } = useSupabaseQuery<Transaction>("transactions", "date", false);

  const { cells, maxAmount } = useMemo(() => {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - WEEKS_TO_SHOW * 7 + 1);
    // Align to Sunday
    startDate.setDate(startDate.getDate() - startDate.getDay());

    const dayMap = new Map<string, number>();
    transactions
      .filter((t) => t.type === "expense" && t.status === "paid")
      .forEach((t) => {
        const key = t.date;
        dayMap.set(key, (dayMap.get(key) || 0) + Number(t.amount));
      });

    let maxAmount = 0;
    const cells: { date: string; amount: number; day: number; week: number }[] = [];
    
    for (let w = 0; w < WEEKS_TO_SHOW; w++) {
      for (let d = 0; d < 7; d++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + w * 7 + d);
        const key = date.toISOString().split("T")[0];
        const amount = dayMap.get(key) || 0;
        if (amount > maxAmount) maxAmount = amount;
        if (date <= today) {
          cells.push({ date: key, amount, day: d, week: w });
        }
      }
    }

    return { cells, maxAmount };
  }, [transactions]);

  const getIntensity = (amount: number) => {
    if (amount === 0 || maxAmount === 0) return 0;
    return Math.ceil((amount / maxAmount) * 4);
  };

  const intensityColors = [
    "bg-muted",
    "bg-primary/20",
    "bg-primary/40",
    "bg-primary/60",
    "bg-primary/90",
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Flame className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Heatmap de Gastos</h3>
        <span className="text-[10px] text-muted-foreground ml-auto">Últimas {WEEKS_TO_SHOW} semanas</span>
      </div>

      <div className="flex gap-1">
        <div className="flex flex-col gap-1 mr-1 pt-0.5">
          {DAYS.map((d, i) => (
            i % 2 === 1 ? <span key={d} className="text-[9px] text-muted-foreground h-3 flex items-center">{d}</span> : <span key={d} className="h-3" />
          ))}
        </div>
        <div className="flex gap-1 flex-1 overflow-hidden">
          {Array.from({ length: WEEKS_TO_SHOW }, (_, w) => (
            <div key={w} className="flex flex-col gap-1">
              {Array.from({ length: 7 }, (_, d) => {
                const cell = cells.find((c) => c.week === w && c.day === d);
                if (!cell) return <div key={d} className="h-3 w-3 rounded-sm" />;
                const intensity = getIntensity(cell.amount);
                return (
                  <Tooltip key={d}>
                    <TooltipTrigger asChild>
                      <div className={`h-3 w-3 rounded-sm ${intensityColors[intensity]} transition-colors cursor-default`} />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-[10px]">
                      <p>{new Date(cell.date + "T12:00:00").toLocaleDateString("pt-BR")}</p>
                      <p className="font-medium">R$ {cell.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1.5 justify-end">
        <span className="text-[9px] text-muted-foreground">Menos</span>
        {intensityColors.map((c, i) => (
          <div key={i} className={`h-2.5 w-2.5 rounded-sm ${c}`} />
        ))}
        <span className="text-[9px] text-muted-foreground">Mais</span>
      </div>
    </motion.div>
  );
}
