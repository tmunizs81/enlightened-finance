import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Users, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

export default function FamilyInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data, error: err } = await supabase.functions.invoke("family-management", {
        body: { action: "get_invite_by_token", token },
      });
      if (err || data?.error) {
        setError(err?.message || data?.error);
      } else {
        setInvite(data.invite);
      }
      setLoading(false);
    })();
  }, [token]);

  const accept = async () => {
    setAccepting(true);
    const { data, error: err } = await supabase.functions.invoke("family-management", {
      body: { action: "accept_invite", token },
    });
    setAccepting(false);
    if (err || data?.error) {
      toast({
        title: "Não foi possível aceitar",
        description: err?.message || data?.error,
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Bem-vindo à família!" });
    navigate("/familia");
  };

  return (
    <div className="container mx-auto flex min-h-[60vh] max-w-lg items-center py-8">
      <Card className="w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Users className="h-7 w-7 text-primary" />
          </div>
          <CardTitle>Convite para família</CardTitle>
          <CardDescription>
            {loading ? "Carregando..." : error ? "Convite inválido" : "Você foi convidado"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {error && (
            <div className="flex flex-col items-center gap-2 text-destructive">
              <XCircle className="h-8 w-8" />
              <p>{error}</p>
            </div>
          )}
          {invite && (
            <>
              <div className="rounded-md border border-border bg-secondary/30 p-4">
                <p className="text-sm text-muted-foreground">Família</p>
                <p className="text-lg font-semibold">{invite.families?.name}</p>
                <p className="mt-2 text-sm text-muted-foreground">Seu papel será</p>
                <p className="font-medium capitalize">{invite.role}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Ao aceitar, você passa a ver e (conforme o papel) editar transações,
                contas, orçamentos e metas compartilhados desta família.
                Seus dados pessoais atuais <strong>permanecem privados</strong>.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate("/")}
                  disabled={accepting}
                >
                  Recusar
                </Button>
                <Button className="flex-1" onClick={accept} disabled={accepting}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Aceitar
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
