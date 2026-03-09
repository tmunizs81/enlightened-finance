import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { toast } from "sonner";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [licenseValid, setLicenseValid] = useState(true);

  const checkLicense = useCallback(async (userId: string): Promise<boolean> => {
    try {
      // Verificar se o usuário é admin — admins não precisam de licença
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      if (roleData) return true;

      const { data, error } = await supabase
        .from("licenses")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        toast.error("Você não possui uma licença ativa. Contate o administrador.");
        return false;
      }

      const isActive = data.status === "active";
      const notExpired = new Date(data.expires_at) > new Date();

      if (!isActive) {
        toast.error("Sua licença foi bloqueada. Contate o administrador.");
        return false;
      }

      if (!notExpired) {
        toast.error("Sua licença expirou. Contate o administrador.");
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error checking license:", error);
      return false;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // Primeiro obter sessão existente
    supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      console.log("getSession:", { currentSession });
      if (!mounted) return;

      if (currentSession?.user) {
        const isValid = await checkLicense(currentSession.user.id);
        if (!mounted) return;

        if (isValid) {
          setSession(currentSession);
          setLicenseValid(true);
        } else {
          await supabase.auth.signOut();
          setSession(null);
          setLicenseValid(false);
        }
      } else {
        setSession(null);
        setLicenseValid(true);
      }
        setLoading(false);
      console.log("getSession done, loading:", false);
    }).catch(error => {
      console.error("getSession error:", error);
      if (!mounted) return;
      setLoading(false);
    });

    // Escutar mudanças de autenticação (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;

        // Ignorar INITIAL_SESSION pois getSession já trata
        if (event === "INITIAL_SESSION") return;

        if (event === "SIGNED_OUT") {
          setSession(null);
          setLicenseValid(true);
          setLoading(false);
          return;
        }

        if (newSession?.user) {
          const isValid = await checkLicense(newSession.user.id);
          if (!mounted) return;

          if (isValid) {
            setSession(newSession);
            setLicenseValid(true);
          } else {
            await supabase.auth.signOut();
            setSession(null);
            setLicenseValid(false);
          }
        } else {
          setSession(newSession);
          setLicenseValid(true);
        }
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [checkLicense]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { session, user: session?.user ?? null, loading, signOut, licenseValid };
}
