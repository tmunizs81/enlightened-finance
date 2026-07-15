import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ArrowRight,
  ArrowLeft,
  Wallet,
  ArrowLeftRight,
  Target,
  Brain,
  Sparkles,
  Briefcase,
  GraduationCap,
  Building2,
  Users,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

type Profile = "clt" | "freelancer" | "estudante" | "empresario";

const PROFILE_CONFIG: Record<
  Profile,
  { label: string; icon: any; categories: { name: string; type: string; icon: string }[] }
> = {
  clt: {
    label: "CLT / Assalariado",
    icon: Building2,
    categories: [
      { name: "Salário", type: "income", icon: "💰" },
      { name: "Vale Refeição", type: "income", icon: "🍽️" },
      { name: "13º Salário", type: "income", icon: "🎄" },
      { name: "Aluguel", type: "expense", icon: "🏠" },
      { name: "Alimentação", type: "expense", icon: "🛒" },
      { name: "Transporte", type: "expense", icon: "🚌" },
      { name: "Saúde", type: "expense", icon: "🏥" },
      { name: "Lazer", type: "expense", icon: "🎮" },
      { name: "Educação", type: "expense", icon: "📚" },
      { name: "Vestuário", type: "expense", icon: "👕" },
    ],
  },
  freelancer: {
    label: "Freelancer / Autônomo",
    icon: Briefcase,
    categories: [
      { name: "Projetos", type: "income", icon: "💻" },
      { name: "Consultoria", type: "income", icon: "📋" },
      { name: "Recorrente Clientes", type: "income", icon: "🔄" },
      { name: "Impostos (DAS/INSS)", type: "expense", icon: "📄" },
      { name: "Ferramentas/Software", type: "expense", icon: "🛠️" },
      { name: "Coworking", type: "expense", icon: "🏢" },
      { name: "Marketing", type: "expense", icon: "📣" },
      { name: "Alimentação", type: "expense", icon: "🛒" },
      { name: "Transporte", type: "expense", icon: "🚗" },
      { name: "Saúde", type: "expense", icon: "🏥" },
    ],
  },
  estudante: {
    label: "Estudante",
    icon: GraduationCap,
    categories: [
      { name: "Mesada", type: "income", icon: "💵" },
      { name: "Freelance/Bico", type: "income", icon: "💻" },
      { name: "Bolsa/Estágio", type: "income", icon: "🎓" },
      { name: "Mensalidade", type: "expense", icon: "🏫" },
      { name: "Material Escolar", type: "expense", icon: "📚" },
      { name: "Alimentação", type: "expense", icon: "🍔" },
      { name: "Transporte", type: "expense", icon: "🚌" },
      { name: "Lazer", type: "expense", icon: "🎮" },
      { name: "Streaming", type: "expense", icon: "📺" },
    ],
  },
  empresario: {
    label: "Empresário / MEI",
    icon: Users,
    categories: [
      { name: "Vendas", type: "income", icon: "🛍️" },
      { name: "Serviços", type: "income", icon: "📋" },
      { name: "Pró-labore", type: "expense", icon: "💰" },
      { name: "Fornecedores", type: "expense", icon: "📦" },
      { name: "Funcionários", type: "expense", icon: "👥" },
      { name: "Impostos", type: "expense", icon: "📄" },
      { name: "Aluguel Comercial", type: "expense", icon: "🏪" },
      { name: "Marketing", type: "expense", icon: "📣" },
      { name: "Contador", type: "expense", icon: "🧮" },
      { name: "Equipamentos", type: "expense", icon: "🖥️" },
    ],
  },
};

const TOUR_STEPS = [
  {
    icon: Sparkles,
    title: "Bem-vindo ao T2-SimplyFin! 🚀",
    description:
      "Seu assistente financeiro inteligente. Vamos configurar tudo para você em poucos passos.",
    color: "text-primary",
  },
  {
    icon: Wallet,
    title: "Cadastre suas Contas",
    description:
      "Adicione contas bancárias, carteiras e investimentos. Suportamos múltiplas moedas!",
    route: "/accounts",
    color: "text-success",
  },
  {
    icon: ArrowLeftRight,
    title: "Registre Transações",
    description: "Lance receitas e despesas, importe extratos CSV/OFX, ou use tags personalizadas.",
    route: "/transactions",
    color: "text-warning",
  },
  {
    icon: Target,
    title: "Defina suas Metas",
    description: "Crie metas financeiras e acompanhe o progresso com projeções inteligentes.",
    route: "/goals",
    color: "text-accent",
  },
  {
    icon: Brain,
    title: "Tudo Pronto! 🎉",
    description:
      "Use ⌘K para busca rápida, arraste widgets no dashboard e explore o chat com IA. Boas finanças!",
    color: "text-primary",
  },
];

export function OnboardingTour() {
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<"profile" | "tour">("profile");
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [creatingCategories, setCreatingCategories] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const seen = localStorage.getItem("t2-onboarding-done");
    if (!seen) setVisible(true);
  }, []);

  const handleProfileSelect = async (profile: Profile) => {
    setSelectedProfile(profile);
    if (!user) {
      setPhase("tour");
      return;
    }

    setCreatingCategories(true);
    try {
      const config = PROFILE_CONFIG[profile];
      const categoriesToInsert = config.categories.map((c) => ({
        name: c.name,
        type: c.type,
        icon: c.icon,
        user_id: user.id,
      }));

      const { error } = await supabase.from("categories").insert(categoriesToInsert);
      if (error && !error.message.includes("duplicate")) throw error;

      toast.success(`Categorias de "${config.label}" criadas!`);
    } catch (e: any) {
      console.error("Erro ao criar categorias:", e);
    } finally {
      setCreatingCategories(false);
      setPhase("tour");
    }
  };

  const handleNext = () => {
    if (current < TOUR_STEPS.length - 1) {
      setCurrent(current + 1);
      if (TOUR_STEPS[current + 1]?.route) {
        navigate(TOUR_STEPS[current + 1].route!);
      }
    } else {
      handleClose();
    }
  };

  const handleBack = () => {
    if (current > 0) setCurrent(current - 1);
  };

  const handleClose = () => {
    localStorage.setItem("t2-onboarding-done", "true");
    setVisible(false);
    navigate("/");
  };

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      >
        {phase === "profile" ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="glass-card relative w-full max-w-lg space-y-6 p-8 text-center"
          >
            <button
              onClick={handleClose}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="inline-flex rounded-2xl bg-primary/15 p-4">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-bold text-foreground">Qual é o seu perfil?</h2>
              <p className="text-sm text-muted-foreground">
                Vamos pré-configurar categorias ideais para o seu dia a dia financeiro.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {(
                Object.entries(PROFILE_CONFIG) as [Profile, (typeof PROFILE_CONFIG)[Profile]][]
              ).map(([key, config]) => {
                const Icon = config.icon;
                return (
                  <button
                    key={key}
                    onClick={() => handleProfileSelect(key)}
                    disabled={creatingCategories}
                    className={`rounded-xl border p-4 text-left transition-all hover:border-primary/50 hover:bg-primary/5 ${
                      selectedProfile === key
                        ? "border-primary bg-primary/10"
                        : "border-border bg-secondary/30"
                    } ${creatingCategories ? "cursor-wait opacity-50" : ""}`}
                  >
                    <Icon className="mb-2 h-5 w-5 text-primary" />
                    <p className="text-sm font-medium text-foreground">{config.label}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {config.categories.length} categorias
                    </p>
                  </button>
                );
              })}
            </div>

            <Button variant="ghost" onClick={handleClose} className="text-xs text-muted-foreground">
              Pular configuração
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key={current}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.3 }}
            className="glass-card relative w-full max-w-md space-y-5 p-8 text-center"
          >
            <button
              onClick={handleClose}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>

            {(() => {
              const step = TOUR_STEPS[current];
              return (
                <>
                  <div className={`inline-flex rounded-2xl bg-secondary p-4 ${step.color}`}>
                    <step.icon className="h-8 w-8" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-lg font-bold text-foreground">{step.title}</h2>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </div>
                </>
              );
            })()}

            <div className="flex justify-center gap-1.5">
              {TOUR_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${i === current ? "w-6 bg-primary" : "w-1.5 bg-muted"}`}
                />
              ))}
            </div>

            <div className="flex justify-center gap-2">
              {current > 0 && (
                <Button
                  variant="ghost"
                  onClick={handleBack}
                  className="gap-1 text-xs text-muted-foreground"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Anterior
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={handleClose}
                className="text-xs text-muted-foreground"
              >
                Pular
              </Button>
              <Button
                onClick={handleNext}
                className="gradient-bg-primary gap-1.5 text-primary-foreground"
              >
                {current === TOUR_STEPS.length - 1 ? "Começar!" : "Próximo"}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
