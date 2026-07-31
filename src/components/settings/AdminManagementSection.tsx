import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Shield,
  Users,
  Key,
  Loader2,
  Search,
  UserPlus,
  Trash2,
  KeyRound,
  ArrowUpCircle,
  ArrowDownCircle,
  Link2,
  Link2Off,
  Plus,
  Pencil,
  History,
  AlertTriangle,
  DollarSign,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useAuth } from "@/hooks/use-auth";

type PlanType = "monthly" | "yearly" | "lifetime" | "family";

interface License {
  id: string;
  license_key: string;
  user_id: string | null;
  status: string;
  expires_at: string;
  plan_type: PlanType;
  price_brl: number;
  notes: string | null;
  created_at?: string;
}

interface UserRow {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  display_name: string | null;
  roles: string[];
  license: License | null;
}

interface AuditEntry {
  id: string;
  actor_email: string | null;
  action: string;
  target_type: string | null;
  target_email: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

async function invokeAdmin<T = any>(action: string, extra: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("admin-users", {
    body: { action, ...extra },
  });
  if (error) {
    // FunctionsHttpError guarda a resposta real em error.context — extrai a mensagem do backend
    let detail = "";
    const ctx = (error as any)?.context;
    try {
      if (ctx && typeof ctx.json === "function") {
        const parsed = await ctx.clone().json();
        detail = parsed?.error || "";
      } else if (ctx && typeof ctx.text === "function") {
        detail = await ctx.clone().text();
      }
    } catch {
      /* ignora falha de parse */
    }
    throw new Error(detail || error.message || "Falha na chamada ao servidor");
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}


function formatDate(v?: string | null) {
  if (!v) return "—";
  try {
    return format(new Date(v), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return "—";
  }
}
function formatDateOnly(v?: string | null) {
  if (!v) return "—";
  try {
    return format(new Date(v), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return "—";
  }
}

function LicenseBadge({ license }: { license: License | null }) {
  if (!license) return <Badge variant="outline" className="text-[10px]">Sem licença</Badge>;
  const now = Date.now();
  const exp = new Date(license.expires_at).getTime();
  const isExpired = license.status !== "active" || exp < now;
  if (isExpired)
    return (
      <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-[10px] text-destructive">
        {license.status === "revoked" ? "Revogada" : "Vencida"} · {formatDateOnly(license.expires_at)}
      </Badge>
    );
  return (
    <Badge variant="outline" className="border-success/30 bg-success/10 text-[10px] text-success">
      Ativa até {formatDateOnly(license.expires_at)}
    </Badge>
  );
}

function CreateUserDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [withLicense, setWithLicense] = useState(true);
  const [months, setMonths] = useState(1);
  const [priceBrl, setPriceBrl] = useState(0);
  const [planType, setPlanType] = useState<PlanType>("monthly");

  const submit = async () => {
    if (!email.trim() || password.length < 8) {
      toast.error("Email válido e senha mínima 8 caracteres");
      return;
    }
    setLoading(true);
    try {
      await invokeAdmin("create", {
        email: email.trim(),
        password,
        displayName: displayName.trim() || undefined,
        role,
        license: withLicense ? { months, plan_type: planType, price_brl: priceBrl } : undefined,
      });
      toast.success("Usuário criado");
      setOpen(false);
      setEmail("");
      setPassword("");
      setDisplayName("");
      setRole("user");
      onCreated();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao criar usuário");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="mr-2 h-3.5 w-3.5" /> Novo Usuário
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Criar novo usuário</DialogTitle>
          <DialogDescription>Cria a conta já confirmada e pode vincular licença.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Nome</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Senha (mín. 8)</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Perfil</Label>
            <Select value={role} onValueChange={(v: any) => setRole(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Usuário</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <input
              id="wl"
              type="checkbox"
              checked={withLicense}
              onChange={(e) => setWithLicense(e.target.checked)}
            />
            <Label htmlFor="wl" className="text-xs">Já criar e vincular licença</Label>
          </div>
          {withLicense && (
            <div className="grid grid-cols-3 gap-2 rounded-md border border-border/40 p-3">
              <div>
                <Label className="text-xs">Meses</Label>
                <Input type="number" min={1} max={120} value={months} onChange={(e) => setMonths(Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">Plano</Label>
                <Select value={planType} onValueChange={(v: any) => setPlanType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="yearly">Anual</SelectItem>
                    <SelectItem value="lifetime">Vitalícia</SelectItem>
                    <SelectItem value="family">Família (até 5)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">R$/mês</Label>
                <Input type="number" step="0.01" value={priceBrl} onChange={(e) => setPriceBrl(Number(e.target.value))} />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />} Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ user, onDone }: { user: UserRow; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    if (password.length < 8) {
      toast.error("Mínimo 8 caracteres");
      return;
    }
    setLoading(true);
    try {
      await invokeAdmin("update_password", { user_id: user.id, password });
      toast.success("Senha atualizada");
      setOpen(false);
      setPassword("");
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" title="Resetar senha">
          <KeyRound className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nova senha para {user.email}</DialogTitle>
          <DialogDescription>Mínimo 8 caracteres. Usuário deve trocar após 1º login.</DialogDescription>
        </DialogHeader>
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={loading}>{loading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LinkLicenseDialog({ user, unlinked, onDone }: { user: UserRow; unlinked: License[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      await invokeAdmin("link_license", { license_id: selected, user_id: user.id });
      toast.success("Licença vinculada");
      setOpen(false);
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" title="Vincular licença">
          <Link2 className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular licença a {user.email}</DialogTitle>
        </DialogHeader>
        {unlinked.length === 0 ? (
          <p className="text-xs text-muted-foreground">Não há licenças disponíveis. Crie uma na aba Licenças.</p>
        ) : (
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {unlinked.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.license_key} · {l.plan_type} · vence {formatDateOnly(l.expires_at)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={loading || !selected}>{loading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}Vincular</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateLicenseDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [months, setMonths] = useState(1);
  const [planType, setPlanType] = useState<PlanType>("monthly");
  const [priceBrl, setPriceBrl] = useState(0);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setLoading(true);
    try {
      await invokeAdmin("create_license", { months, plan_type: planType, price_brl: priceBrl, notes, max_seats: planType === "family" ? 5 : 1 });
      toast.success("Licença criada");
      setOpen(false);
      setNotes("");
      onCreated();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="mr-2 h-3.5 w-3.5" />Gerar Licença</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Gerar nova licença</DialogTitle>
          <DialogDescription>Chave gerada automaticamente. Vincula a um usuário depois.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="text-xs">Meses</Label>
            <Input type="number" min={1} max={120} value={months} onChange={(e) => setMonths(Number(e.target.value))} />
          </div>
          <div>
            <Label className="text-xs">Plano</Label>
            <Select value={planType} onValueChange={(v: any) => setPlanType(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Mensal</SelectItem>
                <SelectItem value="yearly">Anual</SelectItem>
                <SelectItem value="lifetime">Vitalícia</SelectItem>
                <SelectItem value="family">Família (até 5)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">R$/mês</Label>
            <Input type="number" step="0.01" value={priceBrl} onChange={(e) => setPriceBrl(Number(e.target.value))} />
          </div>
        </div>
        <div>
          <Label className="text-xs">Observações</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: cliente indicado por..." />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={loading}>{loading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AdminManagementSection() {
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [unlinked, setUnlinked] = useState<License[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, lRes, aRes] = await Promise.all([
        invokeAdmin<{ users: UserRow[]; unlinked_licenses: License[] }>("list"),
        invokeAdmin<{ licenses: License[] }>("list_licenses"),
        invokeAdmin<{ entries: AuditEntry[] }>("audit_log"),
      ]);
      setUsers(uRes.users);
      setUnlinked(uRes.unlinked_licenses);
      setLicenses(lRes.licenses);
      setAudit(aRes.entries);
    } catch (e: any) {
      toast.error(`Erro: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const admins = useMemo(() => users.filter((u) => u.roles.includes("admin")), [users]);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter(
      (u) => u.email?.toLowerCase().includes(s) || u.display_name?.toLowerCase().includes(s),
    );
  }, [users, q]);

  const kpi = useMemo(() => {
    const now = Date.now();
    const active = licenses.filter((l) => l.status === "active" && new Date(l.expires_at).getTime() > now);
    const expired = licenses.filter((l) => l.status !== "revoked" && new Date(l.expires_at).getTime() <= now);
    const revoked = licenses.filter((l) => l.status === "revoked");
    const mrr = active.reduce((s, l) => {
      if (l.plan_type === "yearly") return s + Number(l.price_brl) / 12;
      if (l.plan_type === "lifetime") return s;
      return s + Number(l.price_brl);
    }, 0);
    return { total: licenses.length, active: active.length, expired: expired.length, revoked: revoked.length, mrr };
  }, [licenses]);

  // Typo detection: emails com edit distance <=1 do mesmo prefixo
  const typoAlerts = useMemo(() => {
    const bySlug = new Map<string, UserRow[]>();
    users.forEach((u) => {
      const email = (u.email || "").toLowerCase();
      const slug = email.replace(/\.[a-z]{2,4}$/, "");
      const arr = bySlug.get(slug) || [];
      arr.push(u);
      bySlug.set(slug, arr);
    });
    return Array.from(bySlug.values()).filter((g) => g.length > 1);
  }, [users]);

  const changeRole = async (u: UserRow, newRole: "admin" | "user") => {
    try {
      await invokeAdmin("update_role", { user_id: u.id, role: newRole });
      toast.success(`Perfil atualizado`);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const deleteUser = async (u: UserRow) => {
    try {
      await invokeAdmin("delete", { user_id: u.id });
      toast.success("Usuário excluído");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const revokeLicense = async (l: License) => {
    try {
      await invokeAdmin("update_license", { license_id: l.id, patch: { status: "revoked" } });
      toast.success("Licença revogada");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  const extendLicense = async (l: License, months: number) => {
    try {
      await invokeAdmin("extend_license", { license_id: l.id, months });
      toast.success(`+${months} mês(es) adicionado(s)`);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  const unlinkLicense = async (l: License) => {
    try {
      await invokeAdmin("unlink_license", { license_id: l.id });
      toast.success("Licença desvinculada");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  const deleteLicense = async (l: License) => {
    try {
      await invokeAdmin("delete_license", { license_id: l.id });
      toast.success("Licença excluída");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="glass-card space-y-4 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-sm font-semibold text-foreground">Gestão Comercial</h2>
            <p className="text-[10px] text-muted-foreground">Usuários, administradores e licenças mensais</p>
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
          {loading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}Atualizar
        </Button>
      </div>

      {typoAlerts.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-xs">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div>
            <strong>Possíveis emails duplicados por typo:</strong>
            <ul className="mt-1 list-disc pl-4">
              {typoAlerts.map((g, i) => (
                <li key={i}>{g.map((u) => u.email).join(" · ")}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <Tabs defaultValue="users">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="users"><Users className="mr-1 h-3 w-3" />Usuários</TabsTrigger>
          <TabsTrigger value="admins"><Shield className="mr-1 h-3 w-3" />Admins</TabsTrigger>
          <TabsTrigger value="licenses"><Key className="mr-1 h-3 w-3" />Licenças</TabsTrigger>
          <TabsTrigger value="audit"><History className="mr-1 h-3 w-3" />Auditoria</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-3 pt-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar por email ou nome..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-7" />
            </div>
            <CreateUserDialog onCreated={load} />
          </div>
          <div className="overflow-x-auto rounded-md border border-border/40">
            <table className="w-full text-xs">
              <thead className="bg-muted/30 text-[10px] uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Email</th>
                  <th className="px-3 py-2 text-left">Perfil</th>
                  <th className="px-3 py-2 text-left">Licença</th>
                  <th className="px-3 py-2 text-left">Último login</th>
                  <th className="px-3 py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const isAdmin = u.roles.includes("admin");
                  const isSelf = u.id === currentUser?.id;
                  return (
                    <tr key={u.id} className="border-t border-border/30">
                      <td className="px-3 py-2">
                        <div>{u.email}</div>
                        {u.display_name && <div className="text-[10px] text-muted-foreground">{u.display_name}</div>}
                      </td>
                      <td className="px-3 py-2">
                        {isAdmin ? (
                          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-[10px] text-primary">Admin</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">Usuário</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2"><LicenseBadge license={u.license} /></td>
                      <td className="px-3 py-2 text-muted-foreground">{formatDate(u.last_sign_in_at)}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <ResetPasswordDialog user={u} onDone={load} />
                          <LinkLicenseDialog user={u} unlinked={unlinked} onDone={load} />
                          {isAdmin ? (
                            <Button size="sm" variant="ghost" title="Rebaixar" disabled={isSelf} onClick={() => changeRole(u, "user")}>
                              <ArrowDownCircle className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" title="Promover a admin" onClick={() => changeRole(u, "admin")}>
                              <ArrowUpCircle className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost" title="Excluir" disabled={isSelf}>
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir {u.email}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Todos os dados financeiros do usuário serão apagados em cascata. Ação irreversível.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteUser(u)}>Excluir</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Nenhum usuário</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="admins" className="space-y-3 pt-4">
          <p className="text-xs text-muted-foreground">
            {admins.length} administrador(es). Ao menos 1 admin deve existir no sistema (proteção anti-lockout).
          </p>
          <div className="space-y-2">
            {admins.map((u) => {
              const isSelf = u.id === currentUser?.id;
              return (
                <div key={u.id} className="flex items-center justify-between rounded-md border border-border/40 p-3">
                  <div>
                    <div className="text-xs font-medium">{u.email} {isSelf && <span className="text-[10px] text-primary">(você)</span>}</div>
                    <div className="text-[10px] text-muted-foreground">Cadastrado em {formatDateOnly(u.created_at)} · Último login {formatDate(u.last_sign_in_at)}</div>
                  </div>
                  <div className="flex gap-1">
                    <ResetPasswordDialog user={u} onDone={load} />
                    <Button size="sm" variant="ghost" disabled={isSelf} onClick={() => changeRole(u, "user")}>
                      <ArrowDownCircle className="mr-1 h-3.5 w-3.5" />Rebaixar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="licenses" className="space-y-3 pt-4">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            <div className="rounded-md border border-border/40 p-2 text-center">
              <div className="text-[10px] text-muted-foreground">Total</div>
              <div className="text-lg font-semibold">{kpi.total}</div>
            </div>
            <div className="rounded-md border border-success/30 bg-success/5 p-2 text-center">
              <div className="text-[10px] text-muted-foreground">Ativas</div>
              <div className="text-lg font-semibold text-success">{kpi.active}</div>
            </div>
            <div className="rounded-md border border-warning/30 bg-warning/5 p-2 text-center">
              <div className="text-[10px] text-muted-foreground">Vencidas</div>
              <div className="text-lg font-semibold text-warning">{kpi.expired}</div>
            </div>
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-center">
              <div className="text-[10px] text-muted-foreground">Revogadas</div>
              <div className="text-lg font-semibold text-destructive">{kpi.revoked}</div>
            </div>
            <div className="rounded-md border border-primary/30 bg-primary/5 p-2 text-center">
              <div className="text-[10px] text-muted-foreground">MRR estimado</div>
              <div className="flex items-center justify-center gap-1 text-lg font-semibold text-primary">
                <DollarSign className="h-3 w-3" />
                {kpi.mrr.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <CreateLicenseDialog onCreated={load} />
          </div>
          <div className="overflow-x-auto rounded-md border border-border/40">
            <table className="w-full text-xs">
              <thead className="bg-muted/30 text-[10px] uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Chave</th>
                  <th className="px-3 py-2 text-left">Plano</th>
                  <th className="px-3 py-2 text-left">Usuário</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Expira</th>
                  <th className="px-3 py-2 text-left">R$/mês</th>
                  <th className="px-3 py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {licenses.map((l) => {
                  const owner = users.find((u) => u.id === l.user_id);
                  const now = Date.now();
                  const expired = l.status !== "active" || new Date(l.expires_at).getTime() < now;
                  return (
                    <tr key={l.id} className="border-t border-border/30">
                      <td className="px-3 py-2 font-mono text-[10px]">{l.license_key}</td>
                      <td className="px-3 py-2">{l.plan_type}</td>
                      <td className="px-3 py-2">{owner?.email ?? <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-3 py-2">
                        {expired ? (
                          <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-[10px] text-destructive">
                            {l.status === "revoked" ? "Revogada" : "Vencida"}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-success/30 bg-success/10 text-[10px] text-success">Ativa</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2">{formatDateOnly(l.expires_at)}</td>
                      <td className="px-3 py-2">{Number(l.price_brl).toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" title="+1 mês" onClick={() => extendLicense(l, 1)}>+1m</Button>
                          <Button size="sm" variant="ghost" title="+12 meses" onClick={() => extendLicense(l, 12)}>+12m</Button>
                          {l.user_id && (
                            <Button size="sm" variant="ghost" title="Desvincular" onClick={() => unlinkLicense(l)}>
                              <Link2Off className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {l.status === "active" && (
                            <Button size="sm" variant="ghost" title="Revogar" onClick={() => revokeLicense(l)}>
                              <Pencil className="h-3.5 w-3.5 text-warning" />
                            </Button>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost" title="Excluir">
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir licença?</AlertDialogTitle>
                                <AlertDialogDescription>A chave {l.license_key} será removida permanentemente.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteLicense(l)}>Excluir</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {licenses.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Nenhuma licença</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="audit" className="space-y-2 pt-4">
          <p className="text-xs text-muted-foreground">Últimas 200 ações administrativas.</p>
          <div className="max-h-96 overflow-y-auto rounded-md border border-border/40">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/30 text-[10px] uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Quando</th>
                  <th className="px-3 py-2 text-left">Quem</th>
                  <th className="px-3 py-2 text-left">Ação</th>
                  <th className="px-3 py-2 text-left">Alvo</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((e) => (
                  <tr key={e.id} className="border-t border-border/30">
                    <td className="px-3 py-2 text-muted-foreground">{formatDate(e.created_at)}</td>
                    <td className="px-3 py-2">{e.actor_email || e.id.slice(0, 8)}</td>
                    <td className="px-3 py-2 font-mono text-[10px]">{e.action}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {e.target_email || e.target_id || "—"}
                    </td>
                  </tr>
                ))}
                {audit.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">Sem registros</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
