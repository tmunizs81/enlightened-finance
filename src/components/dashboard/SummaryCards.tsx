import { memo, useMemo } from "react";
import { motion } from "framer-motion";
import { Wallet, AlertCircle, Clock, PiggyBank } from "lucide-react";
import { useSupabaseQuery } from "@/hooks/use-supabase-crud";

interface Transaction {
  id: string;
  amount: number;
  type: string;
  status: string;
  date: string;
}
interface Account {
  id: string;
  balance: number;
}

export const SummaryCards = memo(function SummaryCards() {
  const { data: accounts = [] } = useSupabaseQuery<Account>("accounts");
  const { data: transactions = [] } = useSupabaseQuery<Transaction>("transactions", "date", false);

  const cards = useMemo(() => {
    const totalBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const thisMonthTx = transactions.filter((t) => {
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear && t.status === "paid";
    });
    const monthIncome = thisMonthTx.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const monthExpense = thisMonthTx.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
    const savings = monthIncome - monthExpense;

    const pendingIncome = transactions
      .filter((t) => t.type === "income" && t.status === "pending")
      .reduce((s, t) => s + Number(t.amount), 0);
    const pendingIncomeCount = transactions.filter((t) => t.type === "income" && t.status === "pending").length;

    return [
      {
        title: "Saldo Total",
        value: `R$ ${totalBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
        icon: Wallet,
        gradient: "gradient-bg-primary",
      },
      {
        title: "Gastos do Mês",
        value: `R$ ${monthExpense.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
        subtitle: `${thisMonthTx.filter((t) => t.type === "expense").length} despesa(s)`,
        icon: AlertCircle,
        gradient: "bg-destructive",
      },
      {
        title: "Receitas Pendentes",
        value: `R$ ${pendingIncome.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
        subtitle: `${pendingIncomeCount} recebimento(s)`,
        icon: Clock,
        gradient: "bg-warning",
      },
      {
        title: "Economia do Mês",
        value: `R$ ${savings.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
        icon: PiggyBank,
        gradient: "bg-accent",
      },
    ];
  }, [accounts, transactions]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map((card, i) => (
        <motion.div key={card.title} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08, duration: 0.4 }} className="glass-card-hover p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">{card.title}</p>
              <p className="text-xl font-bold text-foreground">{card.value}</p>
              {card.subtitle && <p className="text-xs text-muted-foreground">{card.subtitle}</p>}
            </div>
            <div className={`${card.gradient} rounded-lg p-2.5`}>
              <card.icon className="h-4 w-4 text-primary-foreground" />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
});
