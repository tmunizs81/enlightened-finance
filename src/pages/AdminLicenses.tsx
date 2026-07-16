import { Key, Shield } from "lucide-react";
import { AdminManagementSection } from "@/components/settings/AdminManagementSection";
import { useUserRole } from "@/hooks/use-user-role";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminLicenses() {
  const { isAdmin, loading: roleLoading } = useUserRole();

  if (roleLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-destructive" />
              Acesso Negado
            </CardTitle>
            <CardDescription>Você não tem permissão para acessar esta área.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 py-8">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold text-foreground">
          <Key className="h-8 w-8 text-primary" />
          Gerenciamento Comercial
        </h1>
        <p className="mt-1 text-muted-foreground">
          Central para usuários, administradores, licenças mensais e auditoria.
        </p>
      </div>

      <AdminManagementSection />
    </div>
  );
}