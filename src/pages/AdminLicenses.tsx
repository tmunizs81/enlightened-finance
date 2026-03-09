import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/use-user-role";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Shield, UserPlus, Ban, CheckCircle, Key, Trash2, Pencil, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { format } from "date-fns";

interface License {
  id: string;
  user_id: string;
  license_key: string;
  status: "active" | "blocked";
  expires_at: string;
  created_at: string;
}

interface Profile {
  user_id: string;
  display_name: string | null;
}

export default function AdminLicenses() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState("");
  const [expirationMonths, setExpirationMonths] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingLicense, setEditingLicense] = useState<License | null>(null);
  const [editStatus, setEditStatus] = useState<"active" | "blocked">("active");
  const [editExpiresAt, setEditExpiresAt] = useState("");
  const [editUserId, setEditUserId] = useState("");

  // Buscar todos os perfis via RPC (bypassa RLS)
  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_profiles");
      if (error) throw error;
      return (data || []) as Profile[];
    },
    enabled: isAdmin,
  });

  // Buscar todas as licenças
  const { data: licenses = [] } = useQuery({
    queryKey: ["admin-licenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("licenses")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as License[];
    },
    enabled: isAdmin,
  });

  // Criar licença
  const createLicenseMutation = useMutation({
    mutationFn: async ({ userId, months }: { userId: string; months: number }) => {
      const { data: keyData, error: keyError } = await supabase.rpc("generate_license_key");
      if (keyError) throw keyError;

      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + months);

      const { data, error } = await supabase
        .from("licenses")
        .insert({
          user_id: userId,
          license_key: keyData,
          status: "active",
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-licenses"] });
      toast.success("Licença criada com sucesso!");
      setDialogOpen(false);
      setSelectedUserId("");
      setExpirationMonths(1);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Atualizar status da licença
  const updateLicenseStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "blocked" }) => {
      const { error } = await supabase.from("licenses").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-licenses"] });
      toast.success(variables.status === "active" ? "Licença ativada!" : "Licença bloqueada!");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Editar licença
  const editLicenseMutation = useMutation({
    mutationFn: async ({ id, status, expires_at, user_id }: { id: string; status: string; expires_at: string; user_id: string }) => {
      const { error } = await supabase
        .from("licenses")
        .update({ status, expires_at, user_id })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-licenses"] });
      toast.success("Licença atualizada com sucesso!");
      setEditDialogOpen(false);
      setEditingLicense(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Deletar licença
  const deleteLicenseMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("licenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-licenses"] });
      toast.success("Licença excluída com sucesso!");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const openEditDialog = (license: License) => {
    setEditingLicense(license);
    setEditStatus(license.status);
    setEditExpiresAt(license.expires_at.split("T")[0]);
    setEditUserId(license.user_id);
    setEditDialogOpen(true);
  };

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-destructive" />
              Acesso Negado
            </CardTitle>
            <CardDescription>
              Você não tem permissão para acessar esta área.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const usersWithoutLicense = profiles.filter(
    (profile) => !licenses.some((license) => license.user_id === profile.user_id)
  );

  const licensesWithProfiles = licenses.map((license) => {
    const profile = profiles.find((p) => p.user_id === license.user_id);
    return { ...license, display_name: profile?.display_name || "Usuário sem nome" };
  });

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Key className="h-8 w-8 text-primary" />
            Gerenciar Licenças
          </h1>
          <p className="text-muted-foreground mt-1">
            Controle de acesso e licenciamento de usuários
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Nova Licença
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Nova Licença</DialogTitle>
              <DialogDescription>
                Atribua uma licença a um usuário que ainda não possui.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="user">Usuário</Label>
                <select
                  id="user"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                >
                  <option value="">Selecione um usuário</option>
                  {usersWithoutLicense.map((profile) => (
                    <option key={profile.user_id} value={profile.user_id}>
                      {profile.display_name || "Sem nome"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="months">Validade (meses)</Label>
                <Input
                  id="months"
                  type="number"
                  min="1"
                  max="120"
                  value={expirationMonths}
                  onChange={(e) => setExpirationMonths(parseInt(e.target.value) || 1)}
                />
              </div>

              <Button
                onClick={() =>
                  createLicenseMutation.mutate({ userId: selectedUserId, months: expirationMonths })
                }
                disabled={!selectedUserId || createLicenseMutation.isPending}
                className="w-full"
              >
                {createLicenseMutation.isPending ? "Criando..." : "Criar Licença"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Licença</DialogTitle>
            <DialogDescription>
              Altere os dados da licença selecionada.
            </DialogDescription>
          </DialogHeader>
          {editingLicense && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Chave</Label>
                <code className="block text-xs bg-muted px-3 py-2 rounded">{editingLicense.license_key}</code>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-user">Usuário</Label>
                <select
                  id="edit-user"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={editUserId}
                  onChange={(e) => setEditUserId(e.target.value)}
                >
                  {profiles.map((profile) => (
                    <option key={profile.user_id} value={profile.user_id}>
                      {profile.display_name || "Sem nome"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-status">Status</Label>
                <select
                  id="edit-status"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as "active" | "blocked")}
                >
                  <option value="active">Ativa</option>
                  <option value="blocked">Bloqueada</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-expires">Data de Expiração</Label>
                <Input
                  id="edit-expires"
                  type="date"
                  value={editExpiresAt}
                  onChange={(e) => setEditExpiresAt(e.target.value)}
                />
              </div>

              <Button
                onClick={() =>
                  editLicenseMutation.mutate({
                    id: editingLicense.id,
                    status: editStatus,
                    expires_at: new Date(editExpiresAt + "T23:59:59").toISOString(),
                    user_id: editUserId,
                  })
                }
                disabled={editLicenseMutation.isPending}
                className="w-full"
              >
                {editLicenseMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {editLicenseMutation.isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Licenças Ativas</CardTitle>
          <CardDescription>
            Total de {licenses.length} licenças cadastradas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Chave de Licença</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expira em</TableHead>
                <TableHead>Criada em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {licensesWithProfiles.map((license) => {
                const isExpired = new Date(license.expires_at) < new Date();
                const isActive = license.status === "active" && !isExpired;

                return (
                  <TableRow key={license.id}>
                    <TableCell className="font-medium">{license.display_name}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">{license.license_key}</code>
                    </TableCell>
                    <TableCell>
                      {isExpired ? (
                        <Badge variant="destructive">Expirada</Badge>
                      ) : license.status === "active" ? (
                        <Badge variant="default">Ativa</Badge>
                      ) : (
                        <Badge variant="secondary">Bloqueada</Badge>
                      )}
                    </TableCell>
                    <TableCell>{format(new Date(license.expires_at), "dd/MM/yyyy")}</TableCell>
                    <TableCell>{format(new Date(license.created_at), "dd/MM/yyyy")}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {license.status === "active" ? (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => updateLicenseStatusMutation.mutate({ id: license.id, status: "blocked" })}
                            disabled={updateLicenseStatusMutation.isPending}
                          >
                            <Ban className="h-3 w-3 mr-1" />
                            Bloquear
                          </Button>
                        ) : (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => updateLicenseStatusMutation.mutate({ id: license.id, status: "active" })}
                            disabled={updateLicenseStatusMutation.isPending}
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Ativar
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(license)}
                          className="text-muted-foreground hover:text-primary"
                        >
                          <Pencil className="h-3 w-3 mr-1" />
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm("Tem certeza que deseja excluir esta licença?")) {
                              deleteLicenseMutation.mutate(license.id);
                            }
                          }}
                          disabled={deleteLicenseMutation.isPending}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
  const { isAdmin, loading: roleLoading } = useUserRole();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState("");
  const [expirationMonths, setExpirationMonths] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Buscar todos os perfis via RPC (bypassa RLS)
  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc("admin_list_profiles");
      if (error) throw error;
      return (data || []) as Profile[];
    },
    enabled: isAdmin,
  });

  // Buscar todas as licenças
  const { data: licenses = [] } = useQuery({
    queryKey: ["admin-licenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("licenses")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as License[];
    },
    enabled: isAdmin,
  });

  // Criar licença
  const createLicenseMutation = useMutation({
    mutationFn: async ({ userId, months }: { userId: string; months: number }) => {
      // Gerar license key
      const { data: keyData, error: keyError } = await supabase.rpc("generate_license_key");
      if (keyError) throw keyError;

      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + months);

      const { data, error } = await supabase
        .from("licenses")
        .insert({
          user_id: userId,
          license_key: keyData,
          status: "active",
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-licenses"] });
      toast.success("Licença criada com sucesso!");
      setDialogOpen(false);
      setSelectedUserId("");
      setExpirationMonths(1);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Atualizar status da licença
  const updateLicenseStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "blocked" }) => {
      const { error } = await supabase
        .from("licenses")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-licenses"] });
      toast.success(
        variables.status === "active" ? "Licença ativada!" : "Licença bloqueada!"
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-destructive" />
              Acesso Negado
            </CardTitle>
            <CardDescription>
              Você não tem permissão para acessar esta área.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Usuários sem licença
  const usersWithoutLicense = profiles.filter(
    (profile) => !licenses.some((license) => license.user_id === profile.user_id)
  );

  // Combinar licenses com profiles
  const licensesWithProfiles = licenses.map((license) => {
    const profile = profiles.find((p) => p.user_id === license.user_id);
    return {
      ...license,
      display_name: profile?.display_name || "Usuário sem nome",
    };
  });

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Key className="h-8 w-8 text-primary" />
            Gerenciar Licenças
          </h1>
          <p className="text-muted-foreground mt-1">
            Controle de acesso e licenciamento de usuários
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Nova Licença
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Nova Licença</DialogTitle>
              <DialogDescription>
                Atribua uma licença a um usuário que ainda não possui.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="user">Usuário</Label>
                <select
                  id="user"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                >
                  <option value="">Selecione um usuário</option>
                  {usersWithoutLicense.map((profile) => (
                    <option key={profile.user_id} value={profile.user_id}>
                      {profile.display_name || "Sem nome"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="months">Validade (meses)</Label>
                <Input
                  id="months"
                  type="number"
                  min="1"
                  max="120"
                  value={expirationMonths}
                  onChange={(e) => setExpirationMonths(parseInt(e.target.value) || 1)}
                />
              </div>

              <Button
                onClick={() =>
                  createLicenseMutation.mutate({
                    userId: selectedUserId,
                    months: expirationMonths,
                  })
                }
                disabled={!selectedUserId || createLicenseMutation.isPending}
                className="w-full"
              >
                {createLicenseMutation.isPending ? "Criando..." : "Criar Licença"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Licenças Ativas</CardTitle>
          <CardDescription>
            Total de {licenses.length} licenças cadastradas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Chave de Licença</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expira em</TableHead>
                <TableHead>Criada em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {licensesWithProfiles.map((license) => {
                const isExpired = new Date(license.expires_at) < new Date();
                const isActive = license.status === "active" && !isExpired;

                return (
                  <TableRow key={license.id}>
                    <TableCell className="font-medium">
                      {license.display_name}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {license.license_key}
                      </code>
                    </TableCell>
                    <TableCell>
                      {isExpired ? (
                        <Badge variant="destructive">Expirada</Badge>
                      ) : license.status === "active" ? (
                        <Badge variant="default">Ativa</Badge>
                      ) : (
                        <Badge variant="secondary">Bloqueada</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {format(new Date(license.expires_at), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>
                      {format(new Date(license.created_at), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {license.status === "active" ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() =>
                            updateLicenseStatusMutation.mutate({
                              id: license.id,
                              status: "blocked",
                            })
                          }
                          disabled={updateLicenseStatusMutation.isPending}
                        >
                          <Ban className="h-3 w-3 mr-1" />
                          Bloquear
                        </Button>
                      ) : (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() =>
                            updateLicenseStatusMutation.mutate({
                              id: license.id,
                              status: "active",
                            })
                          }
                          disabled={updateLicenseStatusMutation.isPending}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Ativar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
