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
} from "lucide-react";
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
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* NAV */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/70 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <img src={logo} alt="SimplyFin" className="h-8 w-8 rounded-lg" />
            <span className="text-lg font-bold tracking-tight">
              Simply<span className="gradient-text-primary">Fin</span>
            </span>
          </div>
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#recursos" className="hover:text-foreground">Recursos</a>
            <a href="#planos" className="hover:text-foreground">Planos</a>
            <a href="#faq" className="hover:text-foreground">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
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
        </div>
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
        <div className="container relative mx-auto max-w-6xl px-4 py-20 md:py-28">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-3xl text-center"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Sua vida financeira, finalmente sob controle
            </span>
            <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight md:text-6xl">
              Organize, planeje e cresça financeiramente
              <span className="block gradient-text-primary">com inteligência artificial.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              SimplyFin é o sistema completo de controle e saúde financeira para você e sua família.
              Menos planilhas, mais decisões inteligentes.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
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
          <div className="mx-auto mt-16 grid max-w-4xl grid-cols-2 gap-6 md:grid-cols-4">
            {[
              { k: "100%", v: "Seus dados criptografados" },
              { k: "24/7", v: "IA acompanhando você" },
              { k: "5", v: "Logins no plano família" },
              { k: "∞", v: "Contas e categorias" },
            ].map((m) => (
              <div key={m.v} className="glass-card p-4 text-center">
                <div className="text-2xl font-bold gradient-text-primary">{m.k}</div>
                <div className="mt-1 text-xs text-muted-foreground">{m.v}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="recursos" className="container mx-auto max-w-6xl px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold md:text-4xl">Tudo para dominar suas finanças</h2>
          <p className="mt-3 text-muted-foreground">
            Uma plataforma única, pensada para famílias e profissionais que levam a saúde financeira a sério.
          </p>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
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
                  <CardTitle className="text-lg">{f.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Highlights strip */}
        <div className="mt-12 grid grid-cols-2 gap-3 text-sm md:grid-cols-3 lg:grid-cols-6">
          {highlights.map((h) => (
            <div
              key={h}
              className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/50 px-3 py-2"
            >
              <Check className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">{h}</span>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="border-y border-border/50 bg-card/30 py-20">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold md:text-4xl">Comece em 3 passos</h2>
            <p className="mt-3 text-muted-foreground">
              Do cadastro à primeira decisão financeira inteligente em minutos.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { icon: Zap, title: "1. Crie sua conta", desc: "Cadastro em segundos e acesso imediato ao teste gratuito." },
              { icon: PiggyBank, title: "2. Conecte sua vida financeira", desc: "Importe extratos, cadastre contas e comece a acompanhar." },
              { icon: BarChart3, title: "3. Deixe a IA guiar", desc: "Receba insights, alertas e recomendações personalizadas." },
            ].map((s) => (
              <div key={s.title} className="glass-card p-6">
                <s.icon className="h-8 w-8 text-primary" />
                <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLANS */}
      <section id="planos" className="container mx-auto max-w-5xl px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold md:text-4xl">Planos simples e transparentes</h2>
          <p className="mt-3 text-muted-foreground">
            Escolha o plano ideal. Pague com Pix, boleto ou cartão. Cancele quando quiser.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {plans.map((p) => (
            <Card
              key={p.name}
              className={`relative ${
                p.highlight ? "border-primary shadow-[0_0_40px_hsl(var(--primary)/0.15)]" : ""
              }`}
            >
              {p.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full gradient-bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                  {p.tag}
                </div>
              )}
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{p.name}</span>
                  {!p.highlight && (
                    <span className="text-xs font-normal text-muted-foreground">{p.tag}</span>
                  )}
                </CardTitle>
                <div className="pt-2">
                  <span className="text-4xl font-extrabold">R$ {p.price}</span>
                  <span className="text-muted-foreground"> /mês</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 text-primary" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  className={`w-full ${p.highlight ? "gradient-bg-primary text-primary-foreground" : ""}`}
                  variant={p.highlight ? "default" : "outline"}
                >
                  <Link to="/signup">Assinar {p.name}</Link>
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
      <section className="border-t border-border/50 bg-card/30 py-16">
        <div className="container mx-auto grid max-w-5xl gap-8 px-4 md:grid-cols-3">
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
      <section id="faq" className="container mx-auto max-w-3xl px-4 py-20">
        <h2 className="text-center text-3xl font-bold md:text-4xl">Perguntas frequentes</h2>
        <div className="mt-10 space-y-4">
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
              <summary className="cursor-pointer list-none font-medium">
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
      <section className="container mx-auto max-w-5xl px-4 pb-20">
        <div
          className="glass-card relative overflow-hidden p-10 text-center md:p-14"
          style={{
            background:
              "linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--accent) / 0.10))",
          }}
        >
          <h2 className="text-3xl font-bold md:text-4xl">Pronto para transformar suas finanças?</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Junte-se a quem já assumiu o controle da vida financeira com o SimplyFin.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
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
      <footer className="border-t border-border/50 py-8">
        <div className="container mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground md:flex-row">
          <div className="flex items-center gap-2">
            <img src={logo} alt="SimplyFin" className="h-6 w-6 rounded" />
            <span>© {new Date().getFullYear()} SimplyFin · T2 Soluções Tecnológicas</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#recursos" className="hover:text-foreground">Recursos</a>
            <a href="#planos" className="hover:text-foreground">Planos</a>
            <Link to="/auth" className="hover:text-foreground">Entrar</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
