import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";
import { toast } from "sonner";

type Tables = "transactions" | "accounts" | "goals" | "categories" | "budgets" | "ai_insights" | "recurring_transactions" | "achievements" | "streaks" | "financial_rules";

export function useSupabaseQuery<T>(table: Tables, orderBy = "created_at", ascending = false) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [table, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .order(orderBy, { ascending });
      if (error) throw error;
      return data as T[];
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 min - avoid redundant refetches
    gcTime: 10 * 60 * 1000,
    refetchOnMount: "always",
  });
}

export function useSupabaseInsert<T extends Record<string, unknown>>(table: Tables) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (values: Omit<T, "id" | "user_id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from(table)
        .insert({ ...values, user_id: user!.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
      toast.success("Criado com sucesso!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSupabaseUpdate<T extends Record<string, unknown>>(table: Tables) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: { id: string } & Partial<T>) => {
      const { data, error } = await supabase
        .from(table)
        .update(values as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
      toast.success("Atualizado com sucesso!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSupabaseDelete(table: Tables) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
      toast.success("Removido com sucesso!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
