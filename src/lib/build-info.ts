import { supabase } from "@/integrations/supabase/client";

declare const __APP_COMMIT__: string;
declare const __APP_BUILD_TIME__: string;

export const APP_COMMIT: string =
  typeof __APP_COMMIT__ !== "undefined" ? __APP_COMMIT__ : "dev";

export const APP_BUILD_TIME: string =
  typeof __APP_BUILD_TIME__ !== "undefined" ? __APP_BUILD_TIME__ : new Date().toISOString();

export const APP_ENV: string =
  (import.meta.env.VITE_APP_ENV as string | undefined) ||
  (import.meta.env.PROD ? "production" : "development");

export function getSupabaseHost(): string {
  try {
    // @ts-ignore - restUrl is internal but stable
    return new URL(supabase.supabaseUrl).host;
  } catch {
    return "";
  }
}

export const BUILD_INFO = {
  commit: APP_COMMIT,
  buildTime: APP_BUILD_TIME,
  env: APP_ENV,
};
