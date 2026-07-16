import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

export type FamilyRole = "owner" | "admin" | "member" | "viewer";

export interface FamilyMember {
  id: string;
  family_id: string;
  user_id: string;
  role: FamilyRole;
  joined_at: string;
  email?: string | null;
  display_name?: string | null;
}

export interface FamilyInvite {
  id: string;
  family_id: string;
  email: string;
  token: string;
  role: FamilyRole;
  invited_by: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export interface Family {
  id: string;
  name: string;
  owner_id: string;
  license_id: string | null;
  max_seats: number;
  created_at: string;
  updated_at: string;
}

const roleLevel: Record<FamilyRole, number> = { viewer: 1, member: 2, admin: 3, owner: 4 };

export function useFamily() {
  const { user } = useAuth();
  const [family, setFamily] = useState<Family | null>(null);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [invites, setInvites] = useState<FamilyInvite[]>([]);
  const [myRole, setMyRole] = useState<FamilyRole | null>(null);
  const [seatsUsed, setSeatsUsed] = useState(0);
  const [seatsMax, setSeatsMax] = useState(5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setFamily(null);
      setMembers([]);
      setInvites([]);
      setMyRole(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.functions.invoke("family-management", {
      body: { action: "get_my_family" },
    });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setFamily(data?.family ?? null);
    setMembers(data?.members ?? []);
    setInvites(data?.invites ?? []);
    setMyRole(data?.my_role ?? null);
    setSeatsUsed(data?.seats_used ?? 0);
    setSeatsMax(data?.seats_max ?? 5);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const call = useCallback(
    async (action: string, extra: Record<string, unknown> = {}) => {
      const { data, error: err } = await supabase.functions.invoke("family-management", {
        body: { action, ...extra },
      });
      if (err) throw new Error(err.message);
      if (data?.error) throw new Error(data.error);
      await refresh();
      return data;
    },
    [refresh],
  );

  const canWrite = myRole ? roleLevel[myRole] >= 2 : true; // sem família = pode escrever no próprio escopo
  const canManage = myRole ? roleLevel[myRole] >= 3 : false;
  const isOwner = myRole === "owner";

  return {
    family,
    members,
    invites,
    myRole,
    seatsUsed,
    seatsMax,
    loading,
    error,
    refresh,
    canWrite,
    canManage,
    isOwner,
    isInFamily: !!family,
    call,
  };
}
