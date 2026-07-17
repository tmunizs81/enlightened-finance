import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Sparkles,
  ShieldCheck,
  Wallet,
  LineChart,
  Users,
  Bot,
  Bell,
  Target,
  PiggyBank,
  Zap,
  BarChart3,
  Lock,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import logo from "@/assets/logo.png";

const features = [
  {
    icon: Wallet,
    title: "Controle total de gastos",
    desc: "Registre receitas, despesas e parcelas em segundos. Categorização automática por IA.",
  },
  {
    icon: LineChart,
    title: "Planejamento inteligente",
    desc: "Orçamentos por categoria, previsões de saldo e projeção de metas guiadas por IA.",
  },
  {
    icon: Bot,
    title: "Assistente com IA",
    desc: "Insights, anomalias, alertas preditivos e um chat que entende sua vida financeira.",
  },
  {
    icon: Users,
    title: "Modo Família",
    desc: "Até 5 logins compartilhando o mesmo pool financeiro com papéis e permissões.",
  },
  {
    icon: Bell,
    title: "Alertas & Telegram",
    desc: "Lembretes de contas, resumos diários e cadastro por foto direto no Telegram.",
  },
  {
    icon: Target,
    title: "Metas & Gamificação",
    desc: "Conquistas, streaks e desafios semanais para manter você no caminho certo.",
  },
];

const highlights = [
  "Backup automático diário",
  "Multi-moeda (BRL, USD, EUR, BTC...)",
  "Importação de CSV / OFX",
  "Score de saúde financeira",
  "Relatórios em PDF",
  "Benchmark nacional (IBGE)",
];

const plans = [
  {
    name: "Individual",
    price: "24,90",
    tag: "Ideal para você",
    features: [
      "1 login com acesso completo",
      "IA, insights e alertas",
      "Backup automático",
      "Integração Telegram",
      "Relatórios em PDF",
    ],
    highlight: false,
  },
  {
    name: "Família",
    price: "49,90",
    tag: "Mais popular",
    features: [
      "Até 5 logins compartilhando dados",
      "4 papéis (Owner/Admin/Member/Viewer)",
      "Pool único de contas e transações",
      "Todos os recursos do Individual",
      "Convite por email com token",
    ],
    highlight: true,
  },
];

export default function Landing() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* NAV */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/70 backdrop-blur-xl">
        <div className="container mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-16 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="SimplyFin" className="h-7 w-7 rounded-lg sm:h-8 sm:w-8" />
            <span className="text-base font-bold tracking-tight sm:text-lg">
              Simply<span className="gradient-text-primary">Fin</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex lg:gap-8">
            <a href="#recursos" className="hover:text-foreground">Recursos</a>
            <a href="#planos" className="hover:text-foreground">Planos</a>
            <a href="#faq" className="hover:text-foreground">FAQ</a>
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            <Button asChild variant="ghost" size="sm">
              <Link to="/auth">Entrar</Link>
            </Button>
            <Button asChild size="sm" className="gradient-bg-primary text-primary-foreground">
              <Link to="/signup">
                Começar
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
          {/* Mobile hamburger */}
          <button
            type="button"
            aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/50 text-foreground md:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {/* Mobile menu */}
        {mobileOpen && (
          <div className="border-t border-border/50 bg-background/95 backdrop-blur-xl md:hidden">
            <nav className="container mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3 text-sm">
              <a href="#recursos" onClick={() => setMobileOpen(false)} className="rounded-md px-3 py-2 hover:bg-muted">Recursos</a>
              <a href="#planos" onClick={() => setMobileOpen(false)} className="rounded-md px-3 py-2 hover:bg-muted">Planos</a>
              <a href="#faq" onClick={() => setMobileOpen(false)} className="rounded-md px-3 py-2 hover:bg-muted">FAQ</a>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link to="/auth" onClick={() => setMobileOpen(false)}>Entrar</Link>
                </Button>
                <Button asChild size="sm" className="gradient-bg-primary text-primary-foreground">
                  <Link to="/signup" onClick={() => setMobileOpen(false)}>Começar</Link>
                </Button>
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(600px circle at 20% 10%, hsl(var(--primary) / 0.25), transparent 60%), radial-gradient(500px circle at 80% 30%, hsl(var(--accent) / 0.20), transparent 60%)",
          }}
        />
        <div className="container relative mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-3xl text-center"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary sm:text-xs">
              <Sparkles className="h-3.5 w-3.5" />
              Sua vida financeira, finalmente sob controle
            </span>
            <h1 className="mt-5 text-3xl font-extrabold leading-[1.1] tracking-tight sm:mt-6 sm:text-4xl md:text-5xl lg:text-6xl">
              Organize, planeje e cresça financeiramente
              <span className="block gradient-text-primary">com inteligência artificial.</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:mt-6 sm:text-lg">
              SimplyFin é o sistema completo de controle e saúde financeira para você e sua família.
              Menos planilhas, mais decisões inteligentes.
            </p>
            <div className="mt-7 flex flex-col items-stretch justify-center gap-3 sm:mt-8 sm:flex-row sm:items-center">
              <Button asChild size="lg" className="gradient-bg-primary text-primary-foreground">
                <Link to="/signup">
                  Começar teste grátis
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#planos">Ver planos</a>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              7 dias de teste · Sem cartão de crédito · Cancele quando quiser
            </p>
          </motion.div>

          {/* Metrics */}
          <div className="mx-auto mt-12 grid max-w-4xl grid-cols-2 gap-3 sm:mt-16 sm:gap-6 md:grid-cols-4">
            {[
              { k: "100%", v: "Seus dados criptografados" },
              { k: "24/7", v: "IA acompanhando você" },
              { k: "5", v: "Logins no plano família" },
              { k: "∞", v: "Contas e categorias" },
            ].map((m) => (
              <div key={m.v} className="glass-card p-3 text-center sm:p-4">
                <div className="text-xl font-bold gradient-text-primary sm:text-2xl">{m.k}</div>
                <div className="mt-1 text-[11px] text-muted-foreground sm:text-xs">{m.v}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="recursos" className="container mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold sm:text-3xl md:text-4xl">Tudo para dominar suas finanças</h2>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            Uma plataforma única, pensada para famílias e profissionais que levam a saúde financeira a sério.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:mt-12 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
            >
              <Card className="glass-card-hover h-full">
                <CardHeader>
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base sm:text-lg">{f.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Highlights strip */}
        <div className="mt-10 grid grid-cols-1 gap-3 text-sm sm:mt-12 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {highlights.map((h) => (
            <div
              key={h}
              className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/50 px-3 py-2"
            >
              <Check className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-muted-foreground">{h}</span>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="border-y border-border/50 bg-card/30 py-14 sm:py-20">
        <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold sm:text-3xl md:text-4xl">Comece em 3 passos</h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              Do cadastro à primeira decisão financeira inteligente em minutos.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:mt-12 sm:gap-6 md:grid-cols-3">
            {[
              { icon: Zap, title: "1. Crie sua conta", desc: "Cadastro em segundos e acesso imediato ao teste gratuito." },
              { icon: PiggyBank, title: "2. Conecte sua vida financeira", desc: "Importe extratos, cadastre contas e comece a acompanhar." },
              { icon: BarChart3, title: "3. Deixe a IA guiar", desc: "Receba insights, alertas e recomendações personalizadas." },
            ].map((s) => (
              <div key={s.title} className="glass-card p-5 sm:p-6">
                <s.icon className="h-8 w-8 text-primary" />
                <h3 className="mt-4 text-base font-semibold sm:text-lg">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLANS */}
      <section id="planos" className="container mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold sm:text-3xl md:text-4xl">Planos simples e transparentes</h2>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            Escolha o plano ideal. Pague com Pix, boleto ou cartão. Cancele quando quiser.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-1 md:grid-cols-2">
          {plans.map((p) => (
            <Card
              key={p.name}
              className={`relative ${
                p.highlight ? "border-primary shadow-[0_0_40px_hsl(var(--primary)/0.15)]" : ""
              }`}
            >
              {p.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full gradient-bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                  {p.tag}
                </div>
              )}
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  <span>{p.name}</span>
                  {!p.highlight && (
                    <span className="text-xs font-normal text-muted-foreground">{p.tag}</span>
                  )}
                </CardTitle>
                <div className="pt-2">
                  <span className="text-3xl font-extrabold sm:text-4xl">R$ {p.price}</span>
                  <span className="text-muted-foreground"> /mês</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  className={`w-full ${p.highlight ? "gradient-bg-primary text-primary-foreground" : ""}`}
                  variant={p.highlight ? "default" : "outline"}
                >
                  <Link to={`/signup?plan=${p.name === "Família" ? "family" : "individual"}`}>Assinar {p.name}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Ao assinar, você será direcionado ao checkout seguro após o login.
        </p>
      </section>

      {/* TRUST */}
      <section className="border-t border-border/50 bg-card/30 py-12 sm:py-16">
        <div className="container mx-auto grid max-w-5xl gap-6 px-4 sm:gap-8 sm:px-6 md:grid-cols-3 lg:px-8">
          {[
            { icon: ShieldCheck, title: "Segurança em primeiro lugar", desc: "Criptografia, RLS por usuário e backups automáticos." },
            { icon: Lock, title: "Privacidade garantida", desc: "Seus dados são seus. Nunca vendemos ou compartilhamos." },
            { icon: Sparkles, title: "Evolução contínua", desc: "Novos recursos e melhorias baseados em IA todos os meses." },
          ].map((t) => (
            <div key={t.title} className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <t.icon className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-semibold">{t.title}</h4>
                <p className="mt-1 text-sm text-muted-foreground">{t.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="container mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <h2 className="text-center text-2xl font-bold sm:text-3xl md:text-4xl">Perguntas frequentes</h2>
        <div className="mt-8 space-y-3 sm:mt-10 sm:space-y-4">
          {[
            {
              q: "Como funciona o teste gratuito?",
              a: "Você tem 7 dias de acesso completo, sem cartão de crédito. Ao final, escolha o plano que melhor se encaixa.",
            },
            {
              q: "Posso compartilhar com a minha família?",
              a: "Sim! O plano Família permite até 5 logins com papéis distintos, todos compartilhando o mesmo pool financeiro.",
            },
            {
              q: "Quais formas de pagamento vocês aceitam?",
              a: "Pix, boleto e cartão de crédito com renovação automática. Você pode cancelar quando quiser.",
            },
            {
              q: "Meus dados estão seguros?",
              a: "Sim. Utilizamos criptografia, políticas de acesso por linha (RLS) e backups automáticos diários.",
            },
          ].map((f) => (
            <details
              key={f.q}
              className="group rounded-lg border border-border/50 bg-card/50 p-4 open:bg-card"
            >
              <summary className="cursor-pointer list-none text-sm font-medium sm:text-base">
                <span className="mr-2 text-primary group-open:hidden">+</span>
                <span className="mr-2 hidden text-primary group-open:inline">−</span>
                {f.q}
              </summary>
              <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto max-w-5xl px-4 pb-14 sm:px-6 sm:pb-20 lg:px-8">
        <div
          className="glass-card relative overflow-hidden p-6 text-center sm:p-10 md:p-14"
          style={{
            background:
              "linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--accent) / 0.10))",
          }}
        >
          <h2 className="text-2xl font-bold sm:text-3xl md:text-4xl">Pronto para transformar suas finanças?</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
            Junte-se a quem já assumiu o controle da vida financeira com o SimplyFin.
          </p>
          <div className="mt-6 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg" className="gradient-bg-primary text-primary-foreground">
              <Link to="/signup">
                Criar minha conta grátis
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth">Já sou cliente</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border/50 py-6 sm:py-8">
        <div className="container mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-center text-xs text-muted-foreground sm:px-6 sm:text-sm md:flex-row md:text-left lg:px-8">
          <div className="flex items-center gap-2">
            <img src={logo} alt="SimplyFin" className="h-6 w-6 rounded" />
            <span>© {new Date().getFullYear()} SimplyFin · T2 Soluções Tecnológicas</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
            <a href="#recursos" className="hover:text-foreground">Recursos</a>
            <a href="#planos" className="hover:text-foreground">Planos</a>
            <Link to="/auth" className="hover:text-foreground">Entrar</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
