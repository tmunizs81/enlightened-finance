import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, ArrowRight, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function CheckoutSuccess() {
  const [params] = useSearchParams();
  const plan = params.get("plan") === "family" ? "Família" : "Individual";

  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{ background: "var(--gradient-dark)" }}
    >
      <Card className="w-full max-w-lg">
        <CardContent className="flex flex-col items-center p-10 text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-success/15 text-success">
            <CheckCircle2 className="h-9 w-9" />
          </div>
          <h1 className="text-2xl font-bold">Assinatura confirmada!</h1>
          <p className="mt-2 text-muted-foreground">
            Seu plano <span className="font-semibold text-foreground">{plan}</span> foi ativado com
            sucesso. Assim que o pagamento for compensado, sua licença será liberada
            automaticamente.
          </p>

          <div className="mt-6 w-full rounded-lg border border-border/50 bg-muted/30 p-4 text-left text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Próximos passos</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs">
              <li>Entre no sistema com seu e-mail e senha.</li>
              <li>Complete o onboarding e cadastre suas contas.</li>
              <li>Convide sua família (se plano Família) na aba Família.</li>
            </ol>
          </div>

          <div className="mt-6 flex w-full flex-col gap-2 sm:flex-row">
            <Button asChild className="gradient-bg-primary w-full text-primary-foreground">
              <Link to="/">
                Entrar no sistema
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link to="/license">
                <Home className="mr-2 h-4 w-4" /> Ver licença
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
