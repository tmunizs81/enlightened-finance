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
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!license) {
    return (
      <div className="container mx-auto py-8 max-w-2xl">
        <Card className="border-destructive/30">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
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
  const progressPercent = totalDays > 0 ? Math.min(100, Math.max(0, (daysUsed / totalDays) * 100)) : 100;
  const isExpired = expiresAt < now;
  const isBlocked = license.status === "blocked";
  const isExpiringSoon = daysRemaining <= 7 && daysRemaining > 0;

  return (
    <div className="container mx-auto py-8 max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Key className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Minha Licença</h1>
          <p className="text-muted-foreground">Status e detalhes da sua licença</p>
        </div>
      </div>

      {/* Status Card */}
      <Card className={isValid ? "border-primary/30" : "border-destructive/30"}>
        <CardHeader className="text-center pb-2">
          <div className={`mx-auto mb-4 h-20 w-20 rounded-full flex items-center justify-center ${
            isValid ? "bg-primary/10" : "bg-destructive/10"
          }`}>
            {isValid ? (
              <ShieldCheck className="h-10 w-10 text-primary" />
            ) : (
              <ShieldX className="h-10 w-10 text-destructive" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {isBlocked ? "Licença Bloqueada" : isExpired ? "Licença Expirada" : "Licença Ativa"}
          </CardTitle>
          <div className="flex justify-center mt-2">
            {isBlocked ? (
              <Badge variant="secondary" className="text-sm px-4 py-1">Bloqueada</Badge>
            ) : isExpired ? (
              <Badge variant="destructive" className="text-sm px-4 py-1">Expirada</Badge>
            ) : isExpiringSoon ? (
              <Badge variant="outline" className="text-sm px-4 py-1 border-yellow-500 text-yellow-500">
                Expira em breve
              </Badge>
            ) : (
              <Badge variant="default" className="text-sm px-4 py-1">Ativa</Badge>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Data de Início</p>
                <p className="text-sm text-muted-foreground">
                  {format(createdAt, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
              <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Expira em</p>
                <p className="text-sm text-muted-foreground">
                  {format(expiresAt, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
                {!isExpired && !isBlocked && (
                  <p className={`text-xs mt-1 font-medium ${
                    isExpiringSoon ? "text-yellow-500" : "text-primary"
                  }`}>
                    {daysRemaining} {daysRemaining === 1 ? "dia restante" : "dias restantes"}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 sm:col-span-2">
              <Key className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Chave de Licença</p>
                <code className="text-xs bg-muted px-2 py-1 rounded mt-1 inline-block">
                  {license.license_key}
                </code>
              </div>
            </div>
          </div>

          {(isExpired || isBlocked) && (
            <div className="p-4 rounded-lg bg-destructive/10 text-center">
              <p className="text-sm text-destructive font-medium">
                {isBlocked
                  ? "Sua licença foi bloqueada. Contate o administrador para mais informações."
                  : "Sua licença expirou. Contate o administrador para renovação."}
              </p>
            </div>
          )}

          {isExpiringSoon && !isExpired && (
            <div className="p-4 rounded-lg bg-yellow-500/10 text-center">
              <p className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">
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
