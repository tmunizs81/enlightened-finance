import { Link, useSearchParams } from "react-router-dom";
import { XCircle, ArrowLeft, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function CheckoutCancel() {
  const [params] = useSearchParams();
  const plan = params.get("plan") === "family" ? "family" : "individual";

  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{ background: "var(--gradient-dark)" }}
    >
      <Card className="w-full max-w-lg">
        <CardContent className="flex flex-col items-center p-10 text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/15 text-destructive">
            <XCircle className="h-9 w-9" />
          </div>
          <h1 className="text-2xl font-bold">Pagamento cancelado</h1>
          <p className="mt-2 text-muted-foreground">
            Nenhuma cobrança foi realizada. Você pode tentar novamente quando quiser — seus dados de
            cadastro continuam salvos.
          </p>

          <div className="mt-6 w-full rounded-lg border border-border/50 bg-muted/30 p-4 text-left text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Precisa de ajuda?</p>
            <ul className="mt-2 space-y-1 text-xs">
              <li>· Verifique se o cartão está com limite disponível.</li>
              <li>· Tente Pix ou boleto se o cartão falhar.</li>
              <li>· Fale com o suporte pelo Telegram se o erro persistir.</li>
            </ul>
          </div>

          <div className="mt-6 flex w-full flex-col gap-2 sm:flex-row">
            <Button asChild className="gradient-bg-primary w-full text-primary-foreground">
              <Link to={`/checkout?plan=${plan}`}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Tentar novamente
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link to="/">
                <HelpCircle className="mr-2 h-4 w-4" /> Voltar à página inicial
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
