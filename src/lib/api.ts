type ApiOptions = Omit<RequestInit, 'body'> & {
  body?: any;
  skipCache?: boolean;
  ttl?: number;
};

interface CacheEntry {
  data: any;
  timestamp: number;
}

const memoryCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<any>>();
const DEFAULT_TTL_MS = 15000; // 15s in-memory SWR cache for instant page navigation & component switches

export function invalidateClientCache(prefix?: string) {
  if (!prefix) {
    memoryCache.clear();
    return;
  }
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix) || key.includes(prefix)) {
      memoryCache.delete(key);
    }
  }
}

export async function api<T = any>(path: string, options?: ApiOptions): Promise<T> {
  const { body, skipCache, ttl = DEFAULT_TTL_MS, ...rest } = options || {};
  const method = (rest.method || 'GET').toUpperCase();
  const isGet = method === 'GET';

  const cacheKey = path;

  // On any mutation (POST, PUT, DELETE), clear cached GET data for that entity
  if (!isGet) {
    const baseEndpoint = path.split('?')[0];
    invalidateClientCache(baseEndpoint);
    if (baseEndpoint.includes('attendance') || baseEndpoint.includes('calendar') || baseEndpoint.includes('leaves') || baseEndpoint.includes('employees') || baseEndpoint.includes('qr')) {
      invalidateClientCache('/api/stats');
      invalidateClientCache('/api/attendance');
      invalidateClientCache('/api/employees');
      invalidateClientCache('/api/qr');
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ngo:mutation', { detail: { path, method } }));
    }
  } else if (!skipCache) {
    const cached = memoryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.data as T;
    }

    // Deduplicate in-flight concurrent requests to the same endpoint
    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey) as Promise<T>;
    }
  }

  const fetchPromise = (async () => {
    try {
      const res = await fetch(path, {
        headers: { 'Content-Type': 'application/json' },
        ...rest,
        body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
      });
      const text = await res.text();
      let data: any = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = text; }
      if (!res.ok) {
        const msg = (data && (data.error || data.message)) || `Request failed (${res.status})`;
        throw new Error(msg);
      }
      if (isGet && !skipCache) {
        memoryCache.set(cacheKey, { data, timestamp: Date.now() });
      }
      return data as T;
    } finally {
      if (isGet) {
        inFlightRequests.delete(cacheKey);
      }
    }
  })();

  if (isGet && !skipCache) {
    inFlightRequests.set(cacheKey, fetchPromise);
  }

  return fetchPromise;
}

api.invalidate = invalidateClientCache;
