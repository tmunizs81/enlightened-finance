import { useState } from "react";
import { Check, Loader2, CreditCard, QrCode, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useLicense } from "@/hooks/use-license";

type PlanKey = "individual" | "family";
type Billing = "PIX" | "BOLETO" | "CREDIT_CARD";

const PLANS: Record<PlanKey, { name: string; price: number; features: string[] }> = {
  individual: {
    name: "Individual",
    price: 24.9,
    features: [
      "Uso individual (1 login)",
      "Todos os recursos financeiros",
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
      "Convite por email com token",
    ],
  },
};

export default function Plans() {
  const { toast } = useToast();
  const { license, inTrial, daysUntilBlock, source } = useLicense();
  const [openPlan, setOpenPlan] = useState<PlanKey | null>(null);
  const [billing, setBilling] = useState<Billing>("PIX");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [loading, setLoading] = useState(false);

  const hasActiveAsaas = !!license?.asaas_subscription_id && license?.status === "active";

  const checkout = async () => {
    if (!openPlan) return;
    if (!cpfCnpj || cpfCnpj.replace(/\D/g, "").length < 11) {
      toast({ title: "CPF/CNPJ obrigatório", description: "Informe um documento válido.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("asaas-checkout", {
        body: { plan: openPlan, billing_type: billing, cpf_cnpj: cpfCnpj },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const url = (data as any)?.invoiceUrl;
      if (url) {
        window.location.href = url;
      } else {
        toast({ title: "Assinatura criada", description: "Aguarde o processamento do pagamento." });
        setOpenPlan(null);
      }
    } catch (e) {
      toast({
        title: "Erro no checkout",
        description: e instanceof Error ? e.message : "Falha ao criar cobrança",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-5xl space-y-6 py-8">
      <div>
        <h1 className="text-3xl font-bold">Planos SimplyFin</h1>
        <p className="mt-1 text-muted-foreground">
          Assine para ter acesso completo. Pague com Pix, boleto ou cartão de crédito.
        </p>
      </div>

      {inTrial && source === "trial" && (
        <div className="rounded-lg border border-primary/40 bg-primary/10 p-4 text-sm">
          Você está no período de teste — <strong>{daysUntilBlock} dia(s)</strong> restantes.
        </div>
      )}
      {hasActiveAsaas && (
        <div className="rounded-lg border border-green-500/40 bg-green-500/10 p-4 text-sm">
          Assinatura ativa: <strong>{license?.plan_type === "family" ? "Família" : "Individual"}</strong> ·
          próxima cobrança em {license?.next_charge_at ? new Date(license.next_charge_at).toLocaleDateString("pt-BR") : "—"}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {(["individual", "family"] as PlanKey[]).map((key) => {
          const p = PLANS[key];
          return (
            <Card key={key} className={key === "family" ? "border-primary" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {p.name}
                  {key === "family" && (
                    <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs text-primary">
                      Popular
                    </span>
                  )}
                </CardTitle>
                <div className="pt-2">
                  <span className="text-4xl font-bold">R$ {p.price.toFixed(2).replace(".", ",")}</span>
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
                  className="w-full"
                  onClick={() => setOpenPlan(key)}
                  disabled={hasActiveAsaas}
                >
                  {hasActiveAsaas ? "Plano ativo" : "Assinar"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!openPlan} onOpenChange={(o) => !o && setOpenPlan(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assinar plano {openPlan && PLANS[openPlan].name}</DialogTitle>
            <DialogDescription>
              R$ {openPlan && PLANS[openPlan].price.toFixed(2).replace(".", ",")} por mês, com renovação automática.
              Cancele a qualquer momento.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Forma de pagamento</Label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {([
                  { v: "PIX", icon: QrCode, label: "Pix" },
                  { v: "BOLETO", icon: FileText, label: "Boleto" },
                  { v: "CREDIT_CARD", icon: CreditCard, label: "Cartão" },
                ] as { v: Billing; icon: any; label: string }[]).map(({ v, icon: Icon, label }) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setBilling(v)}
                    className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-xs transition ${
                      billing === v ? "border-primary bg-primary/10" : "border-border hover:bg-muted"
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
              />
              <p className="mt-1 text-xs text-muted-foreground">Necessário para emissão da cobrança.</p>
            </div>

            <Button onClick={checkout} disabled={loading} className="w-full">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {loading ? "Gerando cobrança..." : "Continuar para pagamento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
