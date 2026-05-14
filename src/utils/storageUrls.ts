import { supabase } from "@/integrations/supabase/client";

const BUCKET = "receipts";
const SIGNED_TTL = 60 * 60; // 1 hour (validity on server)
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes (validity in memory)
const CLEANUP_INTERVAL = 60 * 1000; // 1 minute
const STORAGE_KEY_PREFIX = "sf_signed_url_cache_";

// Adaptive concurrency parameters
let maxConcurrent = 2;
const MIN_CONCURRENT = 1;
const MAX_CONCURRENT = 4;
const LATENCY_THRESHOLD_LOW = 300; // ms
const LATENCY_THRESHOLD_HIGH = 800; // ms

interface CachedUrl {
  url: string;
  expiresAt: number;
}

// Memory cache structured by userId
const urlCache: Record<string, Record<string, CachedUrl>> = {};
const pendingRequests: Record<string, { promise: Promise<string | null>, controller: AbortController }> = {};

// Current authenticated user ID tracker for sync helper functions
let currentUserId: string | null = null;

// Use session storage for user info if available (faster than async getUser)
try {
  const authKey = Object.keys(localStorage).find(k => k.endsWith('-auth-token'));
  if (authKey) {
    const session = JSON.parse(localStorage.getItem(authKey) || '{}');
    currentUserId = session?.user?.id || null;
  }
} catch (e) {}

// Subscribe to auth changes to keep currentUserId updated
supabase.auth.onAuthStateChange((_event, session) => {
  currentUserId = session?.user?.id || null;
  if (currentUserId && !urlCache[currentUserId]) {
    urlCache[currentUserId] = {};
    loadFromSessionStorage(currentUserId);
  }
});

// Queue for concurrency limiting
let activeRequestsCount = 0;
const requestQueue: (() => void)[] = [];

// Background cleanup
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

async function processQueue() {
  if (activeRequestsCount >= maxConcurrent || requestQueue.length === 0) return;
  const next = requestQueue.shift();
  if (next) {
    activeRequestsCount++;
    next();
  }
}

function adjustConcurrency(latency: number, success: boolean) {
  if (!success) {
    maxConcurrent = Math.max(MIN_CONCURRENT, maxConcurrent - 1);
    return;
  }
  if (latency < LATENCY_THRESHOLD_LOW) {
    maxConcurrent = Math.min(MAX_CONCURRENT, maxConcurrent + 1);
  } else if (latency > LATENCY_THRESHOLD_HIGH) {
    maxConcurrent = Math.max(MIN_CONCURRENT, maxConcurrent - 1);
  }
}

function loadFromSessionStorage(userId: string) {
  try {
    const key = STORAGE_KEY_PREFIX + userId;
    const stored = sessionStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      const now = Date.now();
      const valid: Record<string, CachedUrl> = {};
      Object.keys(parsed).forEach(path => {
        if (parsed[path].expiresAt > now) valid[path] = parsed[path];
      });
      urlCache[userId] = valid;
    }
  } catch (e) {}
}

function saveToSessionStorage(userId: string) {
  try {
    const key = STORAGE_KEY_PREFIX + userId;
    if (urlCache[userId]) sessionStorage.setItem(key, JSON.stringify(urlCache[userId]));
  } catch (e) {}
}

export function extractStoragePath(value: string): string {
  if (!value) return value;
  const m = value.match(/\/object\/(?:public|sign)\/receipts\/([^?]+)/);
  if (m) return decodeURIComponent(m[1]);
  return value;
}

/**
 * Checks if a URL is cached for the current user.
 */
export function isUrlCached(value: string | null | undefined): boolean {
  if (!value || !currentUserId) return false;
  const path = extractStoragePath(value);
  const userCache = urlCache[currentUserId];
  if (!userCache) return false;
  const cached = userCache[path];
  return !!(cached && cached.expiresAt > Date.now());
}

/**
 * Checks if a URL is currently being signed for the current user.
 */
export function isUrlPending(value: string | null | undefined): boolean {
  if (!value || !currentUserId) return false;
  const path = extractStoragePath(value);
  const requestKey = `${currentUserId}:${path}`;
  return !!pendingRequests[requestKey];
}

export async function getSignedReceiptUrl(
  value: string | null | undefined, 
  signal?: AbortSignal
): Promise<string | null> {
  if (!value) return null;
  const path = extractStoragePath(value);

  // Use currentUserId if available, otherwise fallback to session
  let userId = currentUserId;
  if (!userId) {
    const { data: { session } } = await supabase.auth.getSession();
    userId = session?.user?.id || 'anonymous';
    currentUserId = userId;
  }

  if (!urlCache[userId]) {
    urlCache[userId] = {};
    loadFromSessionStorage(userId);
  }
  
  const cached = urlCache[userId][path];
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const requestKey = `${userId}:${path}`;
  if (pendingRequests[requestKey]) return pendingRequests[requestKey].promise;

  const controller = new AbortController();
  
  const signPromise = new Promise<string | null>((resolve) => {
    const executeSigning = async () => {
      const startTime = Date.now();
      let success = false;
      try {
        if (signal) {
          signal.addEventListener('abort', () => controller.abort(), { once: true });
        }

        const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL);
        
        if (error || !data?.signedUrl) {
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
        success = true;
        resolve(data.signedUrl);
      } catch (e) {
        resolve(null);
      } finally {
        const latency = Date.now() - startTime;
        adjustConcurrency(latency, success);
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

export function cancelSignedUrlRequest(value: string | null | undefined) {
  if (!value || !currentUserId) return;
  const path = extractStoragePath(value);
  const requestKey = `${currentUserId}:${path}`;
  if (pendingRequests[requestKey]) {
    pendingRequests[requestKey].controller.abort();
    delete pendingRequests[requestKey];
  }
}

export function prefetchSignedUrl(value: string | null | undefined) {
  if (!value) return;
  getSignedReceiptUrl(value).catch(() => {});
}
