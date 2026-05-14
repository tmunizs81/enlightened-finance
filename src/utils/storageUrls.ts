import { supabase } from "@/integrations/supabase/client";

const BUCKET = "receipts";
const SIGNED_TTL = 60 * 60; // 1 hour (validity on server)
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes (validity in memory)

interface CachedUrl {
  url: string;
  expiresAt: number;
}

const urlCache: Record<string, CachedUrl> = {};

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
 * Implements an in-memory cache to avoid redundant API calls.
 */
export async function getSignedReceiptUrl(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  const path = extractStoragePath(value);

  // Check cache
  const cached = urlCache[path];
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL);
  
  if (error || !data?.signedUrl) {
    console.error("Failed to sign receipt URL:", error?.message);
    return null;
  }

  // Update cache
  urlCache[path] = {
    url: data.signedUrl,
    expiresAt: Date.now() + CACHE_TTL
  };

  return data.signedUrl;
}
