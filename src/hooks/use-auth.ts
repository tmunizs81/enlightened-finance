import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { toast } from "sonner";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [licenseValid, setLicenseValid] = useState(true);

  useEffect(() => {
    const checkLicense = async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from("licenses")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();

        if (error) throw error;

        if (!data) {
          toast.error("Você não possui uma licença ativa. Contate o administrador.");
          await supabase.auth.signOut();
          return false;
        }

        const isActive = data.status === "active";
        const notExpired = new Date(data.expires_at) > new Date();

        if (!isActive) {
          toast.error("Sua licença foi bloqueada. Contate o administrador.");
          await supabase.auth.signOut();
          return false;
        }

        if (!notExpired) {
          toast.error("Sua licença expirou. Contate o administrador.");
          await supabase.auth.signOut();
          return false;
        }

        return true;
      } catch (error) {
        console.error("Error checking license:", error);
        return false;
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const isValid = await checkLicense(session.user.id);
        setLicenseValid(isValid);
        if (isValid) {
          setSession(session);
        } else {
          setSession(null);
        }
      } else {
        setSession(session);
        setLicenseValid(true);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const isValid = await checkLicense(session.user.id);
        setLicenseValid(isValid);
        if (isValid) {
          setSession(session);
        } else {
          setSession(null);
        }
      } else {
        setSession(session);
        setLicenseValid(true);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { session, user: session?.user ?? null, loading, signOut, licenseValid };
}
