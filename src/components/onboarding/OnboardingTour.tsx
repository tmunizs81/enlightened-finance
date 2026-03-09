import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, Wallet, ArrowLeftRight, Target, Brain, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const steps = [
  {
    icon: Sparkles,
    title: "Bem-vindo ao T2-SimplyFin! 🚀",
    description: "Seu assistente financeiro inteligente com IA. Vamos fazer um tour rápido pelas principais funcionalidades.",
    color: "text-primary",
  },
  {
    icon: Wallet,
    title: "Cadastre suas Contas",
    description: "Comece adicionando suas contas bancárias, carteiras e investimentos para ter uma visão completa do seu patrimônio.",
    route: "/accounts",
    color: "text-success",
  },
  {
    icon: ArrowLeftRight,
    title: "Registre Transações",
    description: "Lance suas receitas e despesas manualmente, ou importe um extrato CSV do seu banco para agilizar.",
    route: "/transactions",
    color: "text-warning",
  },
  {
    icon: Target,
    title: "Defina suas Metas",
    description: "Crie metas financeiras como reserva de emergência, viagem ou investimento. Acompanhe o progresso no dashboard.",
    route: "/goals",
    color: "text-accent",
  },
  {
    icon: Brain,
    title: "IA ao seu dispor",
    description: "Use o chat com IA para tirar dúvidas, analisar seus gastos e receber dicas personalizadas. Tudo pronto!",
    color: "text-primary",
  },
];

export function OnboardingTour() {
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const seen = localStorage.getItem("t2-onboarding-done");
    if (!seen) setVisible(true);
  }, []);

  const handleNext = () => {
    if (current < steps.length - 1) {
      setCurrent(current + 1);
      if (steps[current + 1]?.route) {
        navigate(steps[current + 1].route!);
      }
    } else {
      handleClose();
    }
  };

  const handleClose = () => {
    localStorage.setItem("t2-onboarding-done", "true");
    setVisible(false);
    navigate("/");
  };

  if (!visible) return null;

  const step = steps[current];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <motion.div
          key={current}
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          transition={{ duration: 0.3 }}
          className="glass-card p-8 max-w-md w-full text-center space-y-5"
        >
          <button onClick={handleClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>

          <div className={`inline-flex p-4 rounded-2xl bg-secondary ${step.color}`}>
            <step.icon className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-bold text-foreground">{step.title}</h2>
            <p className="text-sm text-muted-foreground">{step.description}</p>
          </div>

          {/* Progress dots */}
          <div className="flex justify-center gap-1.5">
            {steps.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all ${i === current ? "w-6 bg-primary" : "w-1.5 bg-muted"}`} />
            ))}
          </div>

          <div className="flex gap-2 justify-center">
            <Button variant="ghost" onClick={handleClose} className="text-xs text-muted-foreground">
              Pular tour
            </Button>
            <Button onClick={handleNext} className="gradient-bg-primary text-primary-foreground gap-1.5">
              {current === steps.length - 1 ? "Começar!" : "Próximo"}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
