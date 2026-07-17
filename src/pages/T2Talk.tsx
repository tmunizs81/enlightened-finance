import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  MessageSquare,
  Instagram,
  Facebook,
  Mail,
  Phone,
  Bot,
  Users,
  BarChart3,
  Zap,
  Clock,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Headphones,
  Menu,
  X,
  Globe,
  Workflow,
  Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const channels = [
  { icon: MessageSquare, name: "WhatsApp", color: "text-emerald-400" },
  { icon: Instagram, name: "Instagram", color: "text-pink-400" },
  { icon: Facebook, name: "Messenger", color: "text-blue-400" },
  { icon: Mail, name: "E-mail", color: "text-amber-400" },
  { icon: Globe, name: "Web Chat", color: "text-cyan-400" },
  { icon: Phone, name: "Telefonia", color: "text-violet-400" },
];

const features = [
  {
    icon: Workflow,
    title: "Caixa de entrada única",
    desc: "Todos os canais em uma única tela. Sua equipe não perde mais mensagem em lugar nenhum.",
  },
  {
    icon: Bot,
    title: "IA que atende por você",
    desc: "Bots inteligentes qualificam leads, respondem dúvidas e escalam para humanos só quando precisa.",
  },
  {
    icon: Users,
    title: "Distribuição automática",
    desc: "Roteamento por fila, setor, skill ou plantão. Cada cliente vai para o atendente certo.",
  },
  {
    icon: Timer,
    title: "SLA e tempo de resposta",
    desc: "Alertas em tempo real quando um chat esfria. Nenhuma mensagem esquecida no limbo.",
  },
  {
    icon: BarChart3,
    title: "Relatórios que vendem",
    desc: "Volume, conversão, tempo médio, ranking de atendentes e CSAT em dashboards claros.",
  },
  {
    icon: ShieldCheck,
    title: "Seguro e auditável",
    desc: "Histórico completo por cliente, LGPD, permissões granulares e logs de tudo.",
  },
];

const metrics = [
  { k: "3x", v: "mais rápido no primeiro contato" },
  { k: "-42%", v: "de clientes perdidos por demora" },
  { k: "+58%", v: "de conversão no comercial" },
  { k: "24/7", v: "atendimento com IA sem pausa" },
];

const plans = [
  {
    name: "Starter",
    price: "197",
    tag: "Para começar",
    features: [
      "Até 3 atendentes",
      "WhatsApp + Web Chat",
      "Bot básico com IA",
      "Relatórios essenciais",
      "Suporte por e-mail",
    ],
    highlight: false,
  },
  {
    name: "Growth",
    price: "497",
    tag: "Mais popular",
    features: [
      "Até 10 atendentes",
      "Todos os canais (WhatsApp, IG, FB, e-mail, web)",
      "IA avançada + fluxos automáticos",
      "SLA, filas e distribuição inteligente",
      "Integrações (CRM, ERP, API)",
      "Suporte prioritário",
    ],
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Sob consulta",
    tag: "Operações grandes",
    features: [
      "Atendentes ilimitados",
      "Multi-empresa / multi-marca",
      "IA customizada com sua base",
      "Onboarding dedicado",
      "SLA contratual e CSM",
    ],
    highlight: false,
  },
];

export default function T2Talk() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* NAV */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/70 backdrop-blur-xl">
        <div className="container mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-16 sm:px-6 lg:px-8">
          <a href="#top" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-bg-primary text-primary-foreground">
              <MessageSquare className="h-4 w-4" />
            </div>
            <span className="text-base font-bold tracking-tight sm:text-lg">
              T2<span className="gradient-text-primary">Talk</span>
            </span>
          </a>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex lg:gap-8">
            <a href="#canais" className="hover:text-foreground">Canais</a>
            <a href="#recursos" className="hover:text-foreground">Recursos</a>
            <a href="#resultados" className="hover:text-foreground">Resultados</a>
            <a href="#planos" className="hover:text-foreground">Planos</a>
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            <Button asChild variant="ghost" size="sm">
              <a href="#contato">Falar com vendas</a>
            </Button>
            <Button asChild size="sm" className="gradient-bg-primary text-primary-foreground">
              <a href="#planos">
                Testar grátis
                <ArrowRight className="ml-1 h-4 w-4" />
              </a>
            </Button>
          </div>
          <button
            type="button"
            aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/50 md:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {mobileOpen && (
          <div className="border-t border-border/50 bg-background/95 backdrop-blur-xl md:hidden">
            <nav className="container mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3 text-sm">
              <a href="#canais" onClick={() => setMobileOpen(false)} className="rounded-md px-3 py-2 hover:bg-muted">Canais</a>
              <a href="#recursos" onClick={() => setMobileOpen(false)} className="rounded-md px-3 py-2 hover:bg-muted">Recursos</a>
              <a href="#resultados" onClick={() => setMobileOpen(false)} className="rounded-md px-3 py-2 hover:bg-muted">Resultados</a>
              <a href="#planos" onClick={() => setMobileOpen(false)} className="rounded-md px-3 py-2 hover:bg-muted">Planos</a>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button asChild variant="outline" size="sm">
                  <a href="#contato" onClick={() => setMobileOpen(false)}>Vendas</a>
                </Button>
                <Button asChild size="sm" className="gradient-bg-primary text-primary-foreground">
                  <a href="#planos" onClick={() => setMobileOpen(false)}>Testar grátis</a>
                </Button>
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* HERO */}
      <section id="top" className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            background:
              "radial-gradient(700px circle at 15% 10%, hsl(var(--primary) / 0.30), transparent 60%), radial-gradient(600px circle at 85% 20%, hsl(var(--accent) / 0.25), transparent 60%)",
          }}
        />
        <div className="container relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-3xl text-center"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary sm:text-xs">
              <Sparkles className="h-3.5 w-3.5" />
              Omnichannel + IA para times que odeiam perder cliente
            </span>
            <h1 className="mt-5 text-3xl font-extrabold leading-[1.1] tracking-tight sm:mt-6 sm:text-4xl md:text-5xl lg:text-6xl">
              Cada mensagem respondida.
              <span className="block gradient-text-primary">Nenhum cliente esquecido.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:mt-6 sm:text-lg">
              T2Talk une WhatsApp, Instagram, Messenger, e-mail, web chat e telefonia
              em uma única caixa de entrada — com IA que atende, distribui e vende
              enquanto sua equipe dorme.
            </p>
            <div className="mt-7 flex flex-col items-stretch justify-center gap-3 sm:mt-8 sm:flex-row sm:items-center">
              <Button asChild size="lg" className="gradient-bg-primary text-primary-foreground">
                <a href="#planos">
                  Testar 7 dias grátis
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#contato">Agendar demonstração</a>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Sem cartão de crédito · Setup em minutos · Cancele quando quiser
            </p>
          </motion.div>

          {/* Metrics */}
          <div id="resultados" className="mx-auto mt-14 grid max-w-4xl grid-cols-2 gap-3 sm:mt-20 sm:gap-6 md:grid-cols-4">
            {metrics.map((m) => (
              <div key={m.v} className="glass-card p-4 text-center">
                <div className="text-2xl font-extrabold gradient-text-primary sm:text-3xl">{m.k}</div>
                <div className="mt-1 text-[11px] text-muted-foreground sm:text-xs">{m.v}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PAIN */}
      <section className="border-y border-border/50 bg-card/30 py-14 sm:py-20">
        <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold sm:text-3xl md:text-4xl">
              Quanto custa uma mensagem sem resposta?
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              78% dos consumidores compram de quem responde primeiro. Se sua equipe
              está pulando entre 5 aplicativos, você já perdeu a venda.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:mt-12 sm:grid-cols-3">
            {[
              { icon: Clock, title: "Resposta lenta", desc: "Cliente pergunta preço às 20h e recebe resposta no dia seguinte — comprando do concorrente." },
              { icon: MessageSquare, title: "Mensagens perdidas", desc: "WhatsApp no celular do vendedor, Instagram no social media, e-mail em outro lugar. Ninguém enxerga o todo." },
              { icon: Headphones, title: "Atendente sobrecarregado", desc: "Uma pessoa gerenciando 4 telas ao mesmo tempo — e o cliente sente." },
            ].map((p) => (
              <Card key={p.title} className="glass-card-hover">
                <CardHeader>
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
                    <p.icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base sm:text-lg">{p.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{p.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CHANNELS */}
      <section id="canais" className="container mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold sm:text-3xl md:text-4xl">Todos os canais. Uma única tela.</h2>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            Seus clientes falam onde quiserem. Sua equipe atende de um lugar só.
          </p>
        </div>
        <div className="mx-auto mt-10 grid max-w-4xl grid-cols-2 gap-3 sm:mt-12 sm:grid-cols-3 md:grid-cols-6">
          {channels.map((c) => (
            <div
              key={c.name}
              className="glass-card flex flex-col items-center gap-2 p-4 text-center"
            >
              <c.icon className={`h-7 w-7 ${c.color}`} />
              <span className="text-xs font-medium sm:text-sm">{c.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="recursos" className="border-t border-border/50 bg-card/30 py-14 sm:py-20">
        <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold sm:text-3xl md:text-4xl">A plataforma que sua operação merece</h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              Feita para times comerciais e de suporte que precisam escalar sem contratar mais gente.
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
        </div>
      </section>

      {/* HOW */}
      <section className="container mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold sm:text-3xl md:text-4xl">No ar em 3 passos</h2>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            Do primeiro login ao primeiro cliente atendido, em menos de uma tarde.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:mt-12 sm:gap-6 md:grid-cols-3">
          {[
            { icon: Zap, title: "1. Conecte seus canais", desc: "Plugue WhatsApp Business, Instagram, Facebook, e-mail e web chat em poucos cliques." },
            { icon: Bot, title: "2. Configure a IA", desc: "Ensine o bot com sua base de conhecimento. Ele já começa qualificando leads no dia 1." },
            { icon: TrendingUp, title: "3. Escale sem contratar", desc: "Acompanhe métricas em tempo real e cresça o time apenas quando os dados pedirem." },
          ].map((s) => (
            <div key={s.title} className="glass-card p-5 sm:p-6">
              <s.icon className="h-8 w-8 text-primary" />
              <h3 className="mt-4 text-base font-semibold sm:text-lg">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="border-y border-border/50 bg-card/30 py-14 sm:py-20">
        <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                quote: "Reduzimos em 60% o tempo de primeira resposta. O comercial fechou o mês com recorde.",
                author: "Ana Prado",
                role: "Diretora Comercial · Rede varejo SP",
              },
              {
                quote: "A IA do T2Talk resolve 7 em cada 10 dúvidas sem envolver um atendente. Absurdo de bom.",
                author: "Marcos Rezende",
                role: "CEO · SaaS B2B",
              },
              {
                quote: "Antes eram 4 apps abertos. Hoje é uma tela. A equipe respira, o cliente é atendido.",
                author: "Camila Duarte",
                role: "Gerente de CX · E-commerce",
              },
            ].map((t) => (
              <Card key={t.author} className="glass-card h-full">
                <CardContent className="pt-6">
                  <p className="text-sm italic text-foreground">"{t.quote}"</p>
                  <div className="mt-4 border-t border-border/50 pt-3">
                    <p className="text-sm font-semibold">{t.author}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* PLANS */}
      <section id="planos" className="container mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold sm:text-3xl md:text-4xl">Planos que crescem com você</h2>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            Comece pequeno, escale quando fizer sentido. Sem surpresa na fatura.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {plans.map((p) => (
            <Card
              key={p.name}
              className={`relative flex flex-col ${
                p.highlight ? "border-primary shadow-[0_0_40px_hsl(var(--primary)/0.20)]" : ""
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
                  {p.price === "Sob consulta" ? (
                    <span className="text-2xl font-extrabold sm:text-3xl">Sob consulta</span>
                  ) : (
                    <>
                      <span className="text-3xl font-extrabold sm:text-4xl">R$ {p.price}</span>
                      <span className="text-muted-foreground"> /mês</span>
                    </>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between space-y-4">
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
                  <a href="#contato">
                    {p.price === "Sob consulta" ? "Falar com vendas" : "Começar agora"}
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA / CONTATO */}
      <section id="contato" className="container mx-auto max-w-5xl px-4 pb-14 sm:px-6 sm:pb-20 lg:px-8">
        <div
          className="glass-card relative overflow-hidden p-6 text-center sm:p-10 md:p-14"
          style={{
            background:
              "linear-gradient(135deg, hsl(var(--primary) / 0.18), hsl(var(--accent) / 0.12))",
          }}
        >
          <h2 className="text-2xl font-bold sm:text-3xl md:text-4xl">
            Pare de perder cliente por demora.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
            Fale com um especialista T2Talk e veja em 20 minutos como transformar seu atendimento
            em máquina de conversão.
          </p>
          <div className="mt-6 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg" className="gradient-bg-primary text-primary-foreground">
              <a href="#planos">
                Testar 7 dias grátis
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="https://wa.me/5500000000000?text=Quero%20conhecer%20o%20T2Talk" target="_blank" rel="noreferrer">
                <MessageSquare className="mr-2 h-4 w-4" />
                Chamar no WhatsApp
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border/50 py-6 sm:py-8">
        <div className="container mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-center text-xs text-muted-foreground sm:px-6 sm:text-sm md:flex-row md:text-left lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded gradient-bg-primary text-primary-foreground">
              <MessageSquare className="h-3 w-3" />
            </div>
            <span>© {new Date().getFullYear()} T2Talk · T2 Soluções Tecnológicas</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
            <a href="#recursos" className="hover:text-foreground">Recursos</a>
            <a href="#planos" className="hover:text-foreground">Planos</a>
            <a href="#contato" className="hover:text-foreground">Contato</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
