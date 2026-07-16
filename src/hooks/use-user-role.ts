import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

export function useUserRole() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Aguarda auth resolver antes de decidir
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: { action: "me" },
      });

      if (cancelled) return;
      if (!error) {
        setIsAdmin(Boolean(data?.is_admin));
        setLoading(false);
        return;
      }

      console.error("useUserRole admin-users error:", error);
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (cancelled) return;
      if (roleError) console.error("useUserRole fallback error:", roleError);
      setIsAdmin(Boolean(roleData));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  return { isAdmin, loading };
}
