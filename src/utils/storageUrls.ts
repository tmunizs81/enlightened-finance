import { supabase } from "@/integrations/supabase/client";

const BUCKET = "receipts";
const SIGNED_TTL = 60 * 60; // 1 hour (validity on server)
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes (validity in memory)
const CLEANUP_INTERVAL = 60 * 1000; // 1 minute
const STORAGE_KEY_PREFIX = "sf_signed_url_cache_";

interface CachedUrl {
  url: string;
  expiresAt: number;
}

// Memory cache structured by userId to avoid multi-session conflicts
const urlCache: Record<string, Record<string, CachedUrl>> = {};
const pendingRequests: Record<string, Promise<string | null>> = {};

// Background cleanup of expired entries
setInterval(() => {
  const now = Date.now();
  Object.keys(urlCache).forEach(userId => {
    const userCache = urlCache[userId];
    Object.keys(userCache).forEach(path => {
      if (userCache[path].expiresAt <= now) {
        delete userCache[path];
      }
    });
  });
}, CLEANUP_INTERVAL);

/**
 * Loads cache from sessionStorage for a specific user
 */
function loadFromSessionStorage(userId: string) {
  try {
    const key = STORAGE_KEY_PREFIX + userId;
    const stored = sessionStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      const now = Date.now();
      // Filter expired
      const valid: Record<string, CachedUrl> = {};
      Object.keys(parsed).forEach(path => {
        if (parsed[path].expiresAt > now) {
          valid[path] = parsed[path];
        }
      });
      urlCache[userId] = valid;
    }
  } catch (e) {
    console.error("Error loading signed URL cache from sessionStorage", e);
  }
}

/**
 * Saves cache to sessionStorage for a specific user
 */
function saveToSessionStorage(userId: string) {
  try {
    const key = STORAGE_KEY_PREFIX + userId;
    if (urlCache[userId]) {
      sessionStorage.setItem(key, JSON.stringify(urlCache[userId]));
    }
  } catch (e) {
    console.error("Error saving signed URL cache to sessionStorage", e);
  }
}

/**
 * Extracts the storage path from a stored receipt/boleto value.
 */
export function extractStoragePath(value: string): string {
  if (!value) return value;
  const m = value.match(/\/object\/(?:public|sign)\/receipts\/([^?]+)/);
  if (m) return decodeURIComponent(m[1]);
  return value;
}

/**
 * Returns a short-lived signed URL for viewing a private receipt/boleto file.
 * Implements an in-memory and session-persistent cache with request deduplication.
 */
export async function getSignedReceiptUrl(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  const path = extractStoragePath(value);

  // Identify current user
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id || 'anonymous';

  // Initialize cache for user if needed
  if (!urlCache[userId]) {
    urlCache[userId] = {};
    loadFromSessionStorage(userId);
  }
  
  // Check cache
  const cached = urlCache[userId][path];
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  // Deduplicate inflight requests for the same path
  const requestKey = `${userId}:${path}`;
  if (pendingRequests[requestKey]) {
    return pendingRequests[requestKey];
  }

  const signPromise = (async () => {
    try {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL);
      
      if (error || !data?.signedUrl) {
        console.error("Failed to sign receipt URL:", error?.message);
        return null;
      }

      // Update cache
      urlCache[userId][path] = {
        url: data.signedUrl,
        expiresAt: Date.now() + CACHE_TTL
      };
      
      saveToSessionStorage(userId);
      return data.signedUrl;
    } catch (e) {
      return null;
    } finally {
      delete pendingRequests[requestKey];
    }
  })();

  pendingRequests[requestKey] = signPromise;
  return signPromise;
}

/**
 * Prefetches a signed URL without returning it, warming up the cache.
 */
export function prefetchSignedUrl(value: string | null | undefined) {
  if (!value) return;
  getSignedReceiptUrl(value).catch(() => { /* ignore prefetch errors */ });
}
