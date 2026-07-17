type SignupAvailability = {
  signupsEnabled: boolean;
  updatedAt: string | null;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export async function fetchSignupAvailability(): Promise<SignupAvailability> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/app_settings`);
  url.searchParams.set("select", "signups_enabled,updated_at");
  url.searchParams.set("id", "eq.true");
  url.searchParams.set("limit", "1");

  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      Accept: "application/json",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });

  if (!response.ok) {
    throw new Error("Não foi possível confirmar o status de novos cadastros.");
  }

  const rows = (await response.json()) as Array<{
    signups_enabled: boolean | null;
    updated_at: string | null;
  }>;
  const row = rows[0];

  return {
    signupsEnabled: row?.signups_enabled === true,
    updatedAt: row?.updated_at ?? null,
  };
}