import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

interface License {
  id: string;
  user_id: string;
  license_key: string;
  status: "active" | "blocked";
  expires_at: string;
  created_at: string;
  updated_at: string;
  plan_type?: string;
  max_seats?: number;
}

export function useLicense() {
  const { user } = useAuth();
  const [license, setLicense] = useState<License | null>(null);
  const [loading, setLoading] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [source, setSource] = useState<"own" | "family" | null>(null);

  useEffect(() => {
    if (!user) {
      setLicense(null);
      setIsValid(false);
      setSource(null);
      setLoading(false);
      return;
    }

    const checkLicense = async () => {
      try {
        // 1) licença própria
        const { data: own } = await supabase
          .from("licenses")
          .select("*")
          .eq("user_id", user.id)
          .order("expires_at", { ascending: false })
          .maybeSingle();

        const ownValid =
          !!own && own.status === "active" && new Date(own.expires_at) > new Date();

        if (ownValid) {
          setLicense(own as License);
          setIsValid(true);
          setSource("own");
          return;
        }

        // 2) licença família herdada
        const { data: membership } = await supabase
          .from("family_members")
          .select("family_id, families(owner_id)")
          .eq("user_id", user.id)
          .maybeSingle();

        const ownerId = (membership as any)?.families?.owner_id;
        if (ownerId) {
          const { data: familyLic } = await supabase
            .from("licenses")
            .select("*")
            .eq("user_id", ownerId)
            .eq("plan_type", "family")
            .eq("status", "active")
            .gt("expires_at", new Date().toISOString())
            .order("expires_at", { ascending: false })
            .maybeSingle();

          if (familyLic) {
            setLicense(familyLic as License);
            setIsValid(true);
            setSource("family");
            return;
          }
        }

        setLicense((own as License) ?? null);
        setIsValid(false);
        setSource(null);
      } catch (error) {
        console.error("Error checking license:", error);
        setIsValid(false);
      } finally {
        setLoading(false);
      }
    };

    checkLicense();
  }, [user]);

  return { license, isValid, loading, source };
}
