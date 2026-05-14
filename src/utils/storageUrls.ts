import { supabase } from "@/integrations/supabase/client";

const BUCKET = "receipts";
const SIGNED_TTL = 60 * 60; // 1 hour (validity on server)
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes (validity in memory)
const CLEANUP_INTERVAL = 60 * 1000; // 1 minute
const STORAGE_KEY_PREFIX = "sf_signed_url_cache_";
const MAX_CONCURRENT_SIGNING = 2;

interface CachedUrl {
  url: string;
  expiresAt: number;
}

// Memory cache structured by userId to avoid multi-session conflicts
const urlCache: Record<string, Record<string, CachedUrl>> = {};
const pendingRequests: Record<string, { promise: Promise<string | null>, controller: AbortController }> = {};

// Queue for concurrency limiting
let activeRequestsCount = 0;
const requestQueue: (() => void)[] = [];

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
 * Process the queue based on concurrency limit
 */
async function processQueue() {
  if (activeRequestsCount >= MAX_CONCURRENT_SIGNING || requestQueue.length === 0) return;
  const next = requestQueue.shift();
  if (next) {
    activeRequestsCount++;
    next();
  }
}

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
 * Implements cache, deduplication, AbortController, and concurrency limiting.
 */
export async function getSignedReceiptUrl(
  value: string | null | undefined, 
  signal?: AbortSignal
): Promise<string | null> {
  if (!value) return null;
  const path = extractStoragePath(value);

  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id || 'anonymous';

  if (!urlCache[userId]) {
    urlCache[userId] = {};
    loadFromSessionStorage(userId);
  }
  
  const cached = urlCache[userId][path];
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  const requestKey = `${userId}:${path}`;
  if (pendingRequests[requestKey]) {
    return pendingRequests[requestKey].promise;
  }

  const controller = new AbortController();
  
  const signPromise = new Promise<string | null>((resolve) => {
    const executeSigning = async () => {
      try {
        if (signal) {
          signal.addEventListener('abort', () => controller.abort(), { once: true });
        }

        const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL);
        
        if (error || !data?.signedUrl) {
          console.error("Failed to sign receipt URL:", error?.message);
          resolve(null);
          return;
        }

        if (controller.signal.aborted) {
          resolve(null);
          return;
        }

        urlCache[userId][path] = {
          url: data.signedUrl,
          expiresAt: Date.now() + CACHE_TTL
        };
        
        saveToSessionStorage(userId);
        resolve(data.signedUrl);
      } catch (e) {
        resolve(null);
      } finally {
        activeRequestsCount--;
        delete pendingRequests[requestKey];
        processQueue();
      }
    };

    requestQueue.push(executeSigning);
    processQueue();
  });

  pendingRequests[requestKey] = { promise: signPromise, controller };
  return signPromise;
}

/**
 * Prefetches a signed URL without returning it, warming up the cache.
 */
export function prefetchSignedUrl(value: string | null | undefined) {
  if (!value) return;
  getSignedReceiptUrl(value).catch(() => { /* ignore prefetch errors */ });
}
