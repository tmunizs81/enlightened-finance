import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Lock, User, ArrowRight, Loader2, Ban } from "lucide-react";
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
      toast.error(msg.includes("already registered") ? "E-mail já cadastrado. Faça login." : msg);
    } finally {
      setLoading(false);
    }
  };

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
