import { motion } from "framer-motion";
import { Wallet, AlertCircle, Clock, PiggyBank } from "lucide-react";

const cards = [
  {
    title: "Saldo Total",
    value: "R$ 123.810,30",
    change: "+8.2%",
    positive: true,
    icon: Wallet,
    gradient: "gradient-bg-primary",
  },
  {
    title: "Contas a Pagar Hoje",
    value: "R$ 0,00",
    subtitle: "Nenhuma pendência",
    icon: AlertCircle,
    gradient: "bg-success",
  },
  {
    title: "Receitas Pendentes",
    value: "R$ 8.200,00",
    subtitle: "2 recebimentos",
    icon: Clock,
    gradient: "bg-warning",
  },
  {
    title: "Economia do Mês",
    value: "R$ 10.300,00",
    change: "+62%",
    positive: true,
    icon: PiggyBank,
    gradient: "bg-accent",
  },
];

export function SummaryCards() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map((card, i) => (
        <motion.div
          key={card.title}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08, duration: 0.4 }}
          className="glass-card-hover p-5"
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">{card.title}</p>
              <p className="text-xl font-bold text-foreground">{card.value}</p>
              {card.change && (
                <p className={`text-xs font-medium ${card.positive ? "text-success" : "text-destructive"}`}>
                  {card.change} vs mês anterior
                </p>
              )}
              {card.subtitle && (
                <p className="text-xs text-muted-foreground">{card.subtitle}</p>
              )}
            </div>
            <div className={`${card.gradient} rounded-lg p-2.5`}>
              <card.icon className="h-4 w-4 text-primary-foreground" />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
