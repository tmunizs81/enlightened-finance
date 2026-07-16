import { AlertTriangle, Clock, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useLicense } from "@/hooks/use-license";
import { Button } from "@/components/ui/button";

export function LicenseBanner() {
  const { inGrace, inTrial, daysUntilBlock, source, isValid } = useLicense();

  if (!isValid && !inTrial && !inGrace) {
    return (
      <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <span>Sua assinatura expirou. Escolha um plano para continuar usando.</span>
        </div>
        <Button asChild size="sm" variant="destructive">
          <Link to="/planos">Assinar agora</Link>
        </Button>
      </div>
    );
  }

  if (inGrace) {
    return (
      <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm">
        <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
          <Clock className="h-4 w-4" />
          <span>
            Pagamento em atraso — acesso será bloqueado em{" "}
            <strong>{daysUntilBlock} dia(s)</strong>.
          </span>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/planos">Renovar agora</Link>
        </Button>
      </div>
    );
  }

  if (inTrial && source === "trial") {
    return (
      <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 text-sm">
        <div className="flex items-center gap-2 text-primary">
          <Sparkles className="h-4 w-4" />
          <span>
            Você está no período de teste — <strong>{daysUntilBlock} dia(s)</strong> restantes.
          </span>
        </div>
        <Button asChild size="sm">
          <Link to="/planos">Assinar plano</Link>
        </Button>
      </div>
    );
  }

  return null;
}
