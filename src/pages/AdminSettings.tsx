import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/use-user-role";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import { toast } from "sonner";
import { Loader2, Save, CreditCard, Landmark, GitCommit, RefreshCw, UserPlus } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { BUILD_INFO } from "@/lib/build-info";

type Gateway = "asaas" | "stripe";

export default function AdminSettings() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [gateway, setGateway] = useState<Gateway>("asaas");
  const [signupsEnabled, setSignupsEnabled] = useState<boolean>(true);
  const [togglingSignups, setTogglingSignups] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const reload = async (silent = false) => {
    if (!silent) setRefreshing(true);
    const { data, error } = await supabase
      .from("app_settings")
      .select("active_payment_gateway, signups_enabled, updated_at")
      .eq("id", true)
      .maybeSingle();
    if (!error && data) {
      setGateway((data.active_payment_gateway as Gateway) || "asaas");
      setSignupsEnabled(data.signups_enabled ?? true);
      setUpdatedAt(data.updated_at);
      setLastFetched(new Date());
      if (!silent) {
        toast.success("Atualizado", {
          description: `Gateway ativo: ${(data.active_payment_gateway || "asaas").toUpperCase()}`,
        });
      }
    } else if (error && !silent) {
      toast.error("Falha ao recarregar", { description: error.message });
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    reload(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      await reload(true);
    }
  };

  const toggleSignups = async (next: boolean) => {
    setTogglingSignups(true);
    const previous = signupsEnabled;
    setSignupsEnabled(next);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("app_settings")
      .update({
        signups_enabled: next,
        updated_at: new Date().toISOString(),
        updated_by: user?.id ?? null,
      })
      .eq("id", true);
    setTogglingSignups(false);
    if (error) {
      setSignupsEnabled(previous);
      toast.error("Erro ao atualizar cadastros", { description: error.message });
    } else {
      toast.success(next ? "Cadastros habilitados" : "Cadastros desabilitados");
    }
  };

  if (roleLoading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

  const gatewayLabel = gateway === "stripe" ? "Stripe" : "Asaas";
  const gatewayColor = gateway === "stripe"
    ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-500"
    : "bg-emerald-500/10 border-emerald-500/30 text-emerald-500";
  const GatewayIcon = gateway === "stripe" ? CreditCard : Landmark;

  return (
    <div className="container mx-auto max-w-3xl space-y-6 py-8">
      <div>
        <h1 className="text-3xl font-bold">Configurações do sistema</h1>
        <p className="mt-1 text-muted-foreground">Somente administradores.</p>
      </div>

      {/* Resumo do estado atual */}
      <Card className={`border-2 ${gatewayColor}`}>
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className={`rounded-lg border p-2 ${gatewayColor}`}>
              <GatewayIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Gateway ativo agora
              </p>
              <p className="text-xl font-bold">{loading ? "..." : gatewayLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-xs text-muted-foreground">
              <p>Valor salvo em <code>app_settings.active_payment_gateway</code></p>
              <p className="font-mono">{loading ? "—" : gateway}</p>
              {lastFetched && (
                <p className="mt-0.5">
                  Lido do backend às {lastFetched.toLocaleTimeString("pt-BR")}
                </p>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => reload(false)}
              disabled={refreshing || loading}
              title="Recarregar app_settings direto do banco"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

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
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setGateway("asaas")}
                className={`flex w-full items-start gap-3 rounded-lg border p-4 text-left transition ${
                  gateway === "asaas" ? "border-primary bg-primary/5" : "hover:bg-muted"
                }`}
              >
                <div className={`mt-1 h-4 w-4 shrink-0 rounded-full border-2 ${gateway === "asaas" ? "border-primary bg-primary" : "border-muted-foreground"}`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 font-medium">
                    <Landmark className="h-4 w-4" /> Asaas
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Pix, boleto e cartão brasileiro. Ideal para clientes no Brasil.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setGateway("stripe")}
                className={`flex w-full items-start gap-3 rounded-lg border p-4 text-left transition ${
                  gateway === "stripe" ? "border-primary bg-primary/5" : "hover:bg-muted"
                }`}
              >
                <div className={`mt-1 h-4 w-4 shrink-0 rounded-full border-2 ${gateway === "stripe" ? "border-primary bg-primary" : "border-muted-foreground"}`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 font-medium">
                    <CreditCard className="h-4 w-4" /> Stripe
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Cartão de crédito internacional. Cobrança recorrente automática.
                  </p>
                </div>
              </button>
            </div>
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCommit className="h-4 w-4" /> Build atual
          </CardTitle>
          <CardDescription>
            Use estes valores para confirmar que o VPS está rodando o mesmo build publicado.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase text-muted-foreground">Ambiente</p>
            <p className="font-medium">{BUILD_INFO.env}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">Commit</p>
            <p className="font-mono">{BUILD_INFO.commit}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">Build</p>
            <p>{new Date(BUILD_INFO.buildTime).toLocaleString("pt-BR")}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
