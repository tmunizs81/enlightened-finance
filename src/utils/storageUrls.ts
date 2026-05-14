import { supabase } from "@/integrations/supabase/client";

const BUCKET = "receipts";
const SIGNED_TTL = 60 * 60; // 1 hour

/**
 * Extracts the storage path from a stored receipt/boleto value.
 * Accepts either a raw path ("userId/folder/file.ext") or a legacy
 * Supabase public/sign URL — handles both for backward compatibility.
 */
export function extractStoragePath(value: string): string {
  if (!value) return value;
  // Legacy URL formats: /storage/v1/object/{public|sign}/receipts/<path>
  const m = value.match(/\/object\/(?:public|sign)\/receipts\/([^?]+)/);
  if (m) return decodeURIComponent(m[1]);
  return value;
}

/**
 * Returns a short-lived signed URL for viewing a private receipt/boleto file.
 * Falls back to the raw value if signing fails (so the UI can still show an error).
 */
export async function getSignedReceiptUrl(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  const path = extractStoragePath(value);
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL);
  if (error || !data?.signedUrl) {
    console.error("Failed to sign receipt URL:", error?.message);
    return null;
  }
  return data.signedUrl;
}
