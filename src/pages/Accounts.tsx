import { motion } from "framer-motion";
import { accounts } from "@/lib/mock-data";
import { CreditCard, Landmark, PiggyBank } from "lucide-react";

const iconMap = {
  checking: Landmark,
  savings: PiggyBank,
  credit: CreditCard,
};

const typeLabels = {
  checking: "Conta Corrente",
  savings: "Poupança / Investimento",
  credit: "Cartão de Crédito",
};

const Accounts = () => {
  const total = accounts.reduce((s, a) => s + a.balance, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Contas</h1>
        <p className="text-sm text-muted-foreground">Gerencie suas contas bancárias e cartões</p>
      </div>

      <div className="glass-card p-5">
        <p className="text-xs text-muted-foreground">Patrimônio Total</p>
        <p className="text-3xl font-bold gradient-text-primary mt-1">
          R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accounts.map((acc, i) => {
          const Icon = iconMap[acc.type];
          const isNegative = acc.balance < 0;
          return (
            <motion.div
              key={acc.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="glass-card-hover p-5"
            >
              <div className="flex items-start gap-4">
                <div className="gradient-bg-primary rounded-lg p-2.5">
                  <Icon className="h-5 w-5 text-primary-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">{acc.name}</p>
                  <p className="text-xs text-muted-foreground">{acc.institution} · {typeLabels[acc.type]}</p>
                  <p className={`text-lg font-bold mt-2 ${isNegative ? "text-destructive" : "text-foreground"}`}>
                    R$ {acc.balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default Accounts;
