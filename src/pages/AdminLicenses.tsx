import { Key } from "lucide-react";
import { AdminManagementSection } from "@/components/settings/AdminManagementSection";

export default function AdminLicenses() {
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