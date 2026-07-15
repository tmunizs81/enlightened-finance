import { useAuth } from "@/hooks/use-auth";
import { useLicense } from "@/hooks/use-license";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Key, Calendar, Clock, ShieldCheck, ShieldX } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Progress } from "@/components/ui/progress";

export default function LicenseStatus() {
  const { user } = useAuth();
  const { license, isValid, loading } = useLicense();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!license) {
    return (
      <div className="container mx-auto max-w-2xl py-8">
        <Card className="border-destructive/30">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <ShieldX className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl">Sem Licença</CardTitle>
            <CardDescription>
              Você não possui uma licença ativa. Contate o administrador para obter acesso.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const expiresAt = new Date(license.expires_at);
  const createdAt = new Date(license.created_at);
  const now = new Date();
  const daysRemaining = differenceInDays(expiresAt, now);
  const totalDays = differenceInDays(expiresAt, createdAt);
  const daysUsed = differenceInDays(now, createdAt);
  const progressPercent =
    totalDays > 0 ? Math.min(100, Math.max(0, (daysUsed / totalDays) * 100)) : 100;
  const isExpired = expiresAt < now;
  const isBlocked = license.status === "blocked";
  const isExpiringSoon = daysRemaining <= 7 && daysRemaining > 0;

  return (
    <div className="container mx-auto max-w-2xl space-y-6 py-8">
      <div className="flex items-center gap-3">
        <Key className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Minha Licença</h1>
          <p className="text-muted-foreground">Status e detalhes da sua licença</p>
        </div>
      </div>

      {/* Status Card */}
      <Card className={isValid ? "border-primary/30" : "border-destructive/30"}>
        <CardHeader className="pb-2 text-center">
          <div
            className={`mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full ${
              isValid ? "bg-primary/10" : "bg-destructive/10"
            }`}
          >
            {isValid ? (
              <ShieldCheck className="h-10 w-10 text-primary" />
            ) : (
              <ShieldX className="h-10 w-10 text-destructive" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {isBlocked ? "Licença Bloqueada" : isExpired ? "Licença Expirada" : "Licença Ativa"}
          </CardTitle>
          <div className="mt-2 flex justify-center">
            {isBlocked ? (
              <Badge variant="secondary" className="px-4 py-1 text-sm">
                Bloqueada
              </Badge>
            ) : isExpired ? (
              <Badge variant="destructive" className="px-4 py-1 text-sm">
                Expirada
              </Badge>
            ) : isExpiringSoon ? (
              <Badge
                variant="outline"
                className="border-amber-500 px-4 py-1 text-sm text-amber-600"
              >
                Expira em breve
              </Badge>
            ) : (
              <Badge variant="default" className="px-4 py-1 text-sm">
                Ativa
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Progress bar */}
          {!isBlocked && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Uso do período</span>
                <span>{Math.round(progressPercent)}%</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{format(createdAt, "dd/MM/yyyy")}</span>
                <span>{format(expiresAt, "dd/MM/yyyy")}</span>
              </div>
            </div>
          )}

          {/* Details */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-4">
              <Calendar className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Data de Início</p>
                <p className="text-sm text-muted-foreground">
                  {format(createdAt, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-4">
              <Clock className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Expira em</p>
                <p className="text-sm text-muted-foreground">
                  {format(expiresAt, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
                {!isExpired && !isBlocked && (
                  <p
                    className={`mt-1 text-xs font-medium ${
                      isExpiringSoon ? "text-amber-600" : "text-primary"
                    }`}
                  >
                    {daysRemaining} {daysRemaining === 1 ? "dia restante" : "dias restantes"}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-4 sm:col-span-2">
              <Key className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Chave de Licença</p>
                <code className="mt-1 inline-block rounded bg-muted px-2 py-1 text-xs">
                  {license.license_key}
                </code>
              </div>
            </div>
          </div>

          {(isExpired || isBlocked) && (
            <div className="rounded-lg bg-destructive/10 p-4 text-center">
              <p className="text-sm font-medium text-destructive">
                {isBlocked
                  ? "Sua licença foi bloqueada. Contate o administrador para mais informações."
                  : "Sua licença expirou. Contate o administrador para renovação."}
              </p>
            </div>
          )}

          {isExpiringSoon && !isExpired && (
            <div className="rounded-lg bg-amber-50 p-4 text-center dark:bg-amber-950/20">
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                Sua licença expira em {daysRemaining} {daysRemaining === 1 ? "dia" : "dias"}.
                Contate o administrador para renovação.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
