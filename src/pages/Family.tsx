import { useState } from "react";
import { Users, UserPlus, Crown, Shield, Eye, Trash2, LogOut, ArrowRightLeft, Copy, Check } from "lucide-react";
import { useFamily, type FamilyRole } from "@/hooks/use-family";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";

const roleIcons: Record<FamilyRole, JSX.Element> = {
  owner: <Crown className="h-3.5 w-3.5" />,
  admin: <Shield className="h-3.5 w-3.5" />,
  member: <Users className="h-3.5 w-3.5" />,
  viewer: <Eye className="h-3.5 w-3.5" />,
};

const roleLabel: Record<FamilyRole, string> = {
  owner: "Dono",
  admin: "Admin",
  member: "Membro",
  viewer: "Somente leitura",
};

export default function FamilyPage() {
  const {
    family,
    members,
    invites,
    myRole,
    seatsUsed,
    seatsMax,
    loading,
    isOwner,
    canManage,
    call,
    refresh,
  } = useFamily();

  const [familyName, setFamilyName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<FamilyRole>("member");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const inviteUrl = (token: string) => `${window.location.origin}/familia/convite/${token}`;

  const wrap = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast({
        title: "Erro",
        description: e instanceof Error ? e.message : "Falha",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 rounded bg-muted" />
          <div className="h-32 rounded bg-muted" />
        </div>
      </div>
    );
  }

  // Sem família — mostrar criação
  if (!family) {
    return (
      <div className="container mx-auto max-w-2xl py-8">
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <Users className="h-8 w-8 text-primary" />
            Modo Família
          </h1>
          <p className="mt-1 text-muted-foreground">
            Compartilhe finanças com até 5 pessoas usando uma única licença família.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Criar sua família</CardTitle>
            <CardDescription>
              Você se tornará o Dono, poderá convidar até 4 membros e todos verão as
              transações, contas, orçamentos e metas criadas a partir do momento da entrada.
              Requer licença ativa do tipo <strong>família</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Nome da família</Label>
              <Input
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                placeholder="Ex.: Família Silva"
                maxLength={60}
              />
            </div>
            <Button
              disabled={busy || familyName.trim().length < 2}
              onClick={() =>
                wrap(async () => {
                  await call("create_family", { name: familyName.trim() });
                  toast({ title: "Família criada!" });
                  setFamilyName("");
                })
              }
            >
              Criar família
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <Users className="h-8 w-8 text-primary" />
            {family.name}
          </h1>
          <p className="mt-1 flex items-center gap-2 text-muted-foreground">
            Seu papel:
            <Badge variant="secondary" className="gap-1">
              {roleIcons[myRole ?? "member"]}
              {roleLabel[myRole ?? "member"]}
            </Badge>
            · {seatsUsed}/{seatsMax} assentos usados
          </p>
        </div>
        <div className="flex gap-2">
          {!isOwner && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <LogOut className="mr-2 h-4 w-4" /> Sair
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Sair da família?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Você deixará de ver todos os dados compartilhados. Os registros que
                    você criou dentro da família <strong>permanecem com a família</strong>.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      wrap(async () => {
                        await call("leave_family");
                        toast({ title: "Você saiu da família" });
                      })
                    }
                  >
                    Sair
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {isOwner && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="mr-2 h-4 w-4" /> Excluir família
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir família?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Todos os membros perderão acesso ao pool compartilhado. Os dados
                    permanecem no banco mas voltam a estar sem vínculo familiar.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      wrap(async () => {
                        await call("delete_family");
                        toast({ title: "Família excluída" });
                      })
                    }
                  >
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Convidar */}
      {canManage && seatsUsed + invites.length < seatsMax && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" /> Convidar membro
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Input
              type="email"
              placeholder="email@exemplo.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="max-w-xs"
            />
            <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as FamilyRole)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Somente leitura</SelectItem>
                <SelectItem value="member">Membro</SelectItem>
                {isOwner && <SelectItem value="admin">Admin</SelectItem>}
              </SelectContent>
            </Select>
            <Button
              disabled={busy || !inviteEmail.includes("@")}
              onClick={() =>
                wrap(async () => {
                  await call("invite_member", { email: inviteEmail, role: inviteRole });
                  toast({ title: "Convite criado" });
                  setInviteEmail("");
                })
              }
            >
              Enviar convite
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Convites pendentes */}
      {invites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Convites pendentes ({invites.length})</CardTitle>
            <CardDescription>
              Compartilhe o link com a pessoa convidada. Expira em 7 dias.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {invites.map((inv) => (
              <div
                key={inv.id}
                className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-secondary/30 p-3"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium">{inv.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {roleLabel[inv.role]} · expira em{" "}
                    {new Date(inv.expires_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(inviteUrl(inv.token));
                    setCopiedToken(inv.token);
                    toast({ title: "Link copiado" });
                    setTimeout(() => setCopiedToken(null), 2000);
                  }}
                >
                  {copiedToken === inv.token ? (
                    <Check className="mr-1 h-3 w-3" />
                  ) : (
                    <Copy className="mr-1 h-3 w-3" />
                  )}
                  Copiar link
                </Button>
                {canManage && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      wrap(async () => {
                        await call("revoke_invite", { invite_id: inv.id });
                        toast({ title: "Convite revogado" });
                      })
                    }
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Membros */}
      <Card>
        <CardHeader>
          <CardTitle>Membros ({members.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {members.map((m) => (
            <div
              key={m.id}
              className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3"
            >
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {m.display_name || m.email || m.user_id.slice(0, 8)}
                </p>
                <p className="text-xs text-muted-foreground">{m.email}</p>
              </div>
              <Badge variant="secondary" className="gap-1">
                {roleIcons[m.role]}
                {roleLabel[m.role]}
              </Badge>
              {canManage && m.role !== "owner" && m.user_id !== family.owner_id && (
                <>
                  <Select
                    value={m.role}
                    onValueChange={(v) =>
                      wrap(async () => {
                        await call("update_member_role", { member_id: m.id, role: v });
                        toast({ title: "Papel atualizado" });
                      })
                    }
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">Somente leitura</SelectItem>
                      <SelectItem value="member">Membro</SelectItem>
                      {isOwner && <SelectItem value="admin">Admin</SelectItem>}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      wrap(async () => {
                        await call("remove_member", { member_id: m.id });
                        toast({ title: "Membro removido" });
                      })
                    }
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </>
              )}
              {isOwner && m.role !== "owner" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    wrap(async () => {
                      await call("transfer_ownership", { new_owner_user_id: m.user_id });
                      toast({ title: "Titularidade transferida" });
                    })
                  }
                >
                  <ArrowRightLeft className="mr-1 h-3 w-3" />
                  Transferir
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
