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
  grace_until?: string | null;
  last_payment_status?: string | null;
  asaas_subscription_id?: string | null;
  next_charge_at?: string | null;
}

export function useLicense() {
  const { user } = useAuth();
  const [license, setLicense] = useState<License | null>(null);
  const [loading, setLoading] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [source, setSource] = useState<"own" | "family" | "trial" | null>(null);
  const [inGrace, setInGrace] = useState(false);
  const [inTrial, setInTrial] = useState(false);
  const [trialEndsAt, setTrialEndsAt] = useState<Date | null>(null);
  const [daysUntilBlock, setDaysUntilBlock] = useState<number | null>(null);

  useEffect(() => {
    if (!user) {
      setLicense(null);
      setIsValid(false);
      setSource(null);
      setInGrace(false);
      setInTrial(false);
      setTrialEndsAt(null);
      setDaysUntilBlock(null);
      setLoading(false);
      return;
    }

    const check = async () => {
      try {
        const now = new Date();

        // 1) licença própria
        const { data: own } = await supabase
          .from("licenses")
          .select("*")
          .eq("user_id", user.id)
          .order("expires_at", { ascending: false })
          .maybeSingle();

        if (own) {
          const exp = new Date(own.expires_at);
          const grace = (own as any).grace_until ? new Date((own as any).grace_until) : null;
          const graceDate = grace || new Date(exp.getTime() + 3 * 86400000);
          const activeStatus = own.status === "active";

          if (activeStatus && exp > now) {
            setLicense(own as License);
            setIsValid(true);
            setSource("own");
            setInGrace(false);
            setDaysUntilBlock(Math.ceil((exp.getTime() - now.getTime()) / 86400000));
            return;
          }
          if (activeStatus && graceDate > now) {
            setLicense(own as License);
            setIsValid(true);
            setSource("own");
            setInGrace(true);
            setDaysUntilBlock(Math.ceil((graceDate.getTime() - now.getTime()) / 86400000));
            return;
          }
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
            .gt("expires_at", now.toISOString())
            .order("expires_at", { ascending: false })
            .maybeSingle();

          if (familyLic) {
            setLicense(familyLic as License);
            setIsValid(true);
            setSource("family");
            setInGrace(false);
            return;
          }
        }

        // 3) trial ativo (perfil recém-criado sem licença paga)
        const { data: profile } = await supabase
          .from("profiles")
          .select("trial_ends_at")
          .eq("user_id", user.id)
          .maybeSingle();

        const trialEnd = (profile as any)?.trial_ends_at
          ? new Date((profile as any).trial_ends_at)
          : null;
        if (trialEnd && trialEnd > now) {
          setTrialEndsAt(trialEnd);
          setInTrial(true);
          setIsValid(true);
          setSource("trial");
          setLicense((own as License) ?? null);
          setDaysUntilBlock(Math.ceil((trialEnd.getTime() - now.getTime()) / 86400000));
          return;
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

    check();
  }, [user]);

  return { license, isValid, loading, source, inGrace, inTrial, trialEndsAt, daysUntilBlock };
}
