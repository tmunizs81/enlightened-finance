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
}

export function useLicense() {
  const { user } = useAuth();
  const [license, setLicense] = useState<License | null>(null);
  const [loading, setLoading] = useState(true);
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    if (!user) {
      setLicense(null);
      setIsValid(false);
      setLoading(false);
      return;
    }

    const checkLicense = async () => {
      try {
        const { data, error } = await supabase
          .from("licenses")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) throw error;

        setLicense(data as License | null);

        if (!data) {
          setIsValid(false);
        } else {
          const isActive = data.status === "active";
          const notExpired = new Date(data.expires_at) > new Date();
          setIsValid(isActive && notExpired);
        }
      } catch (error) {
        console.error("Error checking license:", error);
        setIsValid(false);
      } finally {
        setLoading(false);
      }
    };

    checkLicense();
  }, [user]);

  return { license, isValid, loading };
}
