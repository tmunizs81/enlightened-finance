import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/use-user-role";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Loader2, Save, CreditCard, Landmark } from "lucide-react";

type Gateway = "asaas" | "stripe";

export default function AdminSettings() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [gateway, setGateway] = useState<Gateway>("asaas");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("active_payment_gateway, updated_at")
        .eq("id", true)
        .maybeSingle();
      if (!error && data) {
        setGateway((data.active_payment_gateway as Gateway) || "asaas");
        setUpdatedAt(data.updated_at);
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("app_settings")
      .update({
        active_payment_gateway: gateway,
        updated_at: new Date().toISOString(),
        updated_by: user?.id ?? null,
      })
      .eq("id", true);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
    } else {
      toast.success("Gateway atualizado", { description: `Agora usando ${gateway === "stripe" ? "Stripe" : "Asaas"}.` });
      setUpdatedAt(new Date().toISOString());
    }
  };

  if (roleLoading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="container mx-auto max-w-3xl space-y-6 py-8">
      <div>
        <h1 className="text-3xl font-bold">Configurações do sistema</h1>
        <p className="mt-1 text-muted-foreground">Somente administradores.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gateway de pagamento ativo</CardTitle>
          <CardDescription>
            Define qual provedor processa as novas assinaturas em <code>/planos</code>.
            Assinaturas já ativas continuam no gateway em que foram criadas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <RadioGroup value={gateway} onValueChange={(v) => setGateway(v as Gateway)}>
              <label
                htmlFor="asaas"
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition ${
                  gateway === "asaas" ? "border-primary bg-primary/5" : "hover:bg-muted"
                }`}
              >
                <RadioGroupItem value="asaas" id="asaas" className="mt-1" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 font-medium">
                    <Landmark className="h-4 w-4" /> Asaas
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Pix, boleto e cartão brasileiro. Ideal para clientes no Brasil.
                  </p>
                </div>
              </label>

              <label
                htmlFor="stripe"
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition ${
                  gateway === "stripe" ? "border-primary bg-primary/5" : "hover:bg-muted"
                }`}
              >
                <RadioGroupItem value="stripe" id="stripe" className="mt-1" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 font-medium">
                    <CreditCard className="h-4 w-4" /> Stripe
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Cartão de crédito internacional. Cobrança recorrente automática.
                  </p>
                </div>
              </label>
            </RadioGroup>
          )}

          {updatedAt && (
            <p className="text-xs text-muted-foreground">
              Última alteração: {new Date(updatedAt).toLocaleString("pt-BR")}
            </p>
          )}

          <Button onClick={save} disabled={saving || loading}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configuração do Stripe</CardTitle>
          <CardDescription>Necessário se o gateway Stripe estiver ativo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>Secrets configurados no backend (não editáveis aqui):</p>
          <ul className="list-disc pl-6 text-muted-foreground">
            <li><code>STRIPE_SECRET_KEY</code> — chave secreta da sua conta Stripe</li>
            <li><code>STRIPE_WEBHOOK_SECRET</code> — segredo do endpoint webhook</li>
            <li><code>STRIPE_PRICE_INDIVIDUAL</code> — ID do preço R$ 24,90/mês</li>
            <li><code>STRIPE_PRICE_FAMILY</code> — ID do preço R$ 49,90/mês</li>
          </ul>
          <div className="rounded-md bg-muted p-3">
            <p className="font-medium">URL do webhook Stripe:</p>
            <code className="mt-1 block break-all text-xs">
              https://difwlzancpnvwkiyhmll.supabase.co/functions/v1/stripe-webhook
            </code>
            <p className="mt-2 text-xs text-muted-foreground">
              Adicione essa URL em Stripe Dashboard → Developers → Webhooks e escute os eventos: <br />
              <code>checkout.session.completed</code>, <code>invoice.paid</code>, <code>invoice.payment_failed</code>,{" "}
              <code>customer.subscription.updated</code>, <code>customer.subscription.deleted</code>,{" "}
              <code>charge.refunded</code>.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
