import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Check, CreditCard, QrCode, FileText, Loader2, ShieldCheck, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

type PlanKey = "individual" | "family";
type Billing = "PIX" | "BOLETO" | "CREDIT_CARD";
type Gateway = "asaas" | "stripe";

const PLANS: Record<PlanKey, { name: string; price: number; features: string[] }> = {
  individual: {
    name: "Individual",
    price: 24.9,
    features: [
      "1 login com acesso completo",
      "IA, insights e alertas",
      "Backup automático",
      "Integração Telegram",
    ],
  },
  family: {
    name: "Família",
    price: 49.9,
    features: [
      "Até 5 logins compartilhando dados",
      "4 papéis (Owner/Admin/Member/Viewer)",
      "Pool único de contas e transações",
      "Todos os recursos do Individual",
    ],
  },
};

export default function Checkout() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { session, loading: authLoading } = useAuth();
  const planKey: PlanKey = params.get("plan") === "family" ? "family" : "individual";
  const plan = PLANS[planKey];

  const [gateway, setGateway] = useState<Gateway>("asaas");
  const [gatewayLoading, setGatewayLoading] = useState(true);
  const [billing, setBilling] = useState<Billing>("PIX");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [loading, setLoading] = useState(false);

  // Se não estiver autenticado, envia para cadastro mantendo o plano
  useEffect(() => {
    if (!authLoading && !session) {
      navigate(`/signup?plan=${planKey}`, { replace: true });
    }
  }, [authLoading, session, navigate, planKey]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("active_payment_gateway")
        .eq("id", true)
        .maybeSingle();
      if (data?.active_payment_gateway) setGateway(data.active_payment_gateway as Gateway);
      setGatewayLoading(false);
    })();
  }, []);

  const pay = async () => {
    if (gateway === "asaas") {
      if (!cpfCnpj || cpfCnpj.replace(/\D/g, "").length < 11) {
        toast.error("Informe um CPF ou CNPJ válido.");
        return;
      }
    }

    setLoading(true);
    try {
      const fn = gateway === "stripe" ? "stripe-checkout" : "asaas-checkout";
      const body =
        gateway === "stripe"
          ? {
              plan: planKey,
              success_url: `${window.location.origin}/checkout/success?plan=${planKey}`,
              cancel_url: `${window.location.origin}/checkout/cancel?plan=${planKey}`,
            }
          : { plan: planKey, billing_type: billing, cpf_cnpj: cpfCnpj };

      const { data, error } = await supabase.functions.invoke(fn, { body });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      const url = (data as any)?.url || (data as any)?.invoiceUrl;
      if (url) {
        window.location.href = url;
      } else {
        navigate(`/checkout/success?plan=${planKey}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar cobrança");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="container mx-auto max-w-5xl px-4">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold">Finalizar assinatura</h1>
          <p className="mt-1 text-muted-foreground">
            Confirme o plano e o método de pagamento para ativar o SimplyFin.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-[1fr_1.2fr]">
          {/* Resumo do plano */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Plano {plan.name}</span>
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">
                  Mensal
                </span>
              </CardTitle>
              <div className="pt-2">
                <span className="text-4xl font-extrabold">
                  R$ {plan.price.toFixed(2).replace(".", ",")}
                </span>
                <span className="text-muted-foreground"> /mês</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 text-primary" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="rounded-lg border border-border/50 bg-muted/30 p-3 text-xs text-muted-foreground">
                Renovação automática mensal. Cancele quando quiser.
              </div>
              <Link
                to={`/checkout?plan=${planKey === "family" ? "individual" : "family"}`}
                className="block text-center text-xs text-primary hover:underline"
              >
                Trocar para o plano {planKey === "family" ? "Individual" : "Família"}
              </Link>
            </CardContent>
          </Card>

          {/* Pagamento */}
          <Card>
            <CardHeader>
              <CardTitle>Pagamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {gatewayLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando gateway...
                </div>
              ) : gateway === "asaas" ? (
                <>
                  <div>
                    <Label>Forma de pagamento</Label>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {(
                        [
                          { v: "PIX", icon: QrCode, label: "Pix" },
                          { v: "BOLETO", icon: FileText, label: "Boleto" },
                          { v: "CREDIT_CARD", icon: CreditCard, label: "Cartão" },
                        ] as { v: Billing; icon: any; label: string }[]
                      ).map(({ v, icon: Icon, label }) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setBilling(v)}
                          className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-xs transition ${
                            billing === v
                              ? "border-primary bg-primary/10"
                              : "border-border hover:bg-muted"
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="cpf">CPF ou CNPJ</Label>
                    <Input
                      id="cpf"
                      value={cpfCnpj}
                      onChange={(e) => setCpfCnpj(e.target.value)}
                      placeholder="000.000.000-00"
                      className="mt-1"
                      maxLength={18}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Necessário para emissão da cobrança pelo Asaas.
                    </p>
                  </div>
                </>
              ) : (
                <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4 text-sm">
                  <CreditCard className="mt-0.5 h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Pagamento seguro via Stripe</p>
                    <p className="text-xs text-muted-foreground">
                      Você será redirecionado ao checkout Stripe para inserir os dados do cartão.
                    </p>
                  </div>
                </div>
              )}

              <Button
                onClick={pay}
                disabled={loading || gatewayLoading}
                className="gradient-bg-primary w-full text-primary-foreground"
                size="lg"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading
                  ? "Gerando cobrança..."
                  : gateway === "stripe"
                    ? "Ir para o Stripe"
                    : "Gerar cobrança"}
              </Button>

              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                Pagamento processado com criptografia ponta a ponta
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
