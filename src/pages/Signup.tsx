import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Mail,
  Lock,
  User,
  ArrowRight,
  Loader2,
  Sparkles,
  Clock,
  Users,
  ShieldCheck,
  Bell,
  CheckCircle2,
} from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

const schema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(100),
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres").max(128),
});

export default function Signup() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const plan = params.get("plan") === "family" ? "family" : "individual";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [signupsEnabled, setSignupsEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("signups_enabled")
        .eq("id", true)
        .maybeSingle();
      setSignupsEnabled(data?.signups_enabled ?? true);
    })();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signupsEnabled === false) {
      toast.error("Cadastros temporariamente indisponíveis.");
      return;
    }
    const parsed = schema.safeParse({ name, email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/checkout?plan=${plan}`,
          data: { display_name: parsed.data.name },
        },
      });
      if (error) throw error;

      // Se sessão já criada (confirmação de email desabilitada), segue direto para o checkout
      if (data.session) {
        toast.success("Conta criada! Vamos ao pagamento.");
        navigate(`/checkout?plan=${plan}`, { replace: true });
        return;
      }

      // Tenta login imediato — funciona quando o projeto autoconfirma emails
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      if (!signInErr) {
        toast.success("Conta criada! Vamos ao pagamento.");
        navigate(`/checkout?plan=${plan}`, { replace: true });
        return;
      }

      toast.success("Enviamos um link de confirmação para o seu e-mail.");
      navigate("/auth", { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao criar conta";
      if (msg.includes("SIGNUPS_DISABLED")) {
        setSignupsEnabled(false);
        toast.error("Cadastros temporariamente desabilitados pelo administrador.");
      } else if (msg.includes("already registered")) {
        toast.error("E-mail já cadastrado. Faça login.");
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  if (signupsEnabled === null) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: "var(--gradient-dark)" }}
      >
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (signupsEnabled === false) {
    const planLabel =
      plan === "family" ? "Família · R$ 49,90/mês" : "Individual · R$ 24,90/mês";
    const [waitEmail, setWaitEmailLocal] = [
      (globalThis as any).__wl_email ?? "",
      (v: string) => ((globalThis as any).__wl_email = v),
    ];
    return (
      <div
        className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-4"
        style={{ background: "var(--gradient-dark)" }}
      >
        {/* Glow decor */}
        <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[36rem] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="glass-card relative z-10 w-full max-w-xl overflow-hidden p-8 sm:p-10"
        >
          <div className="mb-6 flex items-center justify-between">
            <img
              src={logo}
              alt="SimplyFin"
              className="h-11 w-11 rounded-xl object-contain"
            />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              Lotação máxima
            </span>
          </div>

          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-accent">
            <Sparkles className="h-3.5 w-3.5" />
            Alta demanda em {new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </div>

          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
            Novos cadastros{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              temporariamente pausados
            </span>
          </h1>

          <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
            Estamos recebendo um volume acima do esperado de novas famílias e profissionais
            entrando no <strong className="text-foreground">SimplyFin</strong>. Para garantir a
            qualidade da experiência, os cadastros foram temporariamente encerrados enquanto
            expandimos nossa infraestrutura.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              { icon: Users, label: "Vagas esgotadas", value: "Lote atual" },
              { icon: Clock, label: "Reabertura", value: "Em breve" },
              { icon: ShieldCheck, label: "Qualidade", value: "Garantida" },
            ].map(({ icon: Icon, label, value }) => (
              <div
                key={label}
                className="rounded-xl border border-border/60 bg-secondary/40 p-3"
              >
                <Icon className="mb-2 h-4 w-4 text-primary" />
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {label}
                </div>
                <div className="text-sm font-semibold">{value}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-start gap-3">
              <Bell className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="text-xs text-muted-foreground">
                Você tentava assinar o plano{" "}
                <span className="font-semibold text-foreground">{planLabel}</span>. Assim que
                novas vagas forem liberadas, os cadastros serão reabertos por ordem de chegada.
              </div>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const email = (
                (e.currentTarget.elements.namedItem("wl") as HTMLInputElement) || { value: "" }
              ).value.trim();
              if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
                toast.error("Informe um e-mail válido.");
                return;
              }
              setWaitEmailLocal(email);
              toast.success("Pronto! Avisaremos você no e-mail assim que reabrirmos.");
              (e.currentTarget as HTMLFormElement).reset();
            }}
            className="mt-6 flex flex-col gap-2 sm:flex-row"
          >
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="wl"
                type="email"
                defaultValue={waitEmail}
                placeholder="Quero ser avisado no e-mail"
                className="border-border bg-secondary pl-9"
                maxLength={255}
                required
              />
            </div>
            <Button type="submit" className="gradient-bg-primary text-primary-foreground">
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Avise-me
            </Button>
          </form>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline" className="flex-1">
              <Link to="/auth">Já sou cliente — entrar</Link>
            </Button>
            <Button asChild variant="ghost" className="flex-1">
              <Link to="/">Voltar à página inicial</Link>
            </Button>
          </div>

          <p className="mt-6 text-center text-[11px] text-muted-foreground/70">
            Obrigado pela paciência — estamos crescendo com responsabilidade. 💚
          </p>
        </motion.div>
      </div>
    );
  }





  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center p-4"
      style={{ background: "var(--gradient-dark)" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card w-full max-w-md p-8"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <img src={logo} alt="SimplyFin" className="mb-3 h-16 w-16 rounded-2xl object-contain" />
          <h1 className="text-xl font-bold">Crie sua conta SimplyFin</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Plano escolhido:{" "}
            <span className="font-semibold text-primary">
              {plan === "family" ? "Família · R$ 49,90/mês" : "Individual · R$ 24,90/mês"}
            </span>
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nome completo</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                className="border-border bg-secondary pl-9"
                required
                maxLength={100}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">E-mail</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="border-border bg-secondary pl-9"
                required
                maxLength={255}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="border-border bg-secondary pl-9"
                required
                minLength={6}
                maxLength={128}
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="gradient-bg-primary w-full text-primary-foreground"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="mr-2 h-4 w-4" />
            )}
            {loading ? "Criando conta..." : "Continuar para pagamento"}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Já tem conta?{" "}
          <Link to="/auth" className="text-primary hover:underline">
            Entrar
          </Link>
        </p>
      </motion.div>

      <Link to="/" className="mt-6 text-xs text-muted-foreground/70 hover:text-foreground">
        ← Voltar para a página inicial
      </Link>
    </div>
  );
}
