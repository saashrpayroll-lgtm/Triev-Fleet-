import { supabase } from '@/config/supabase';

// ─── Query Deduplication & Multi-Tier (Memory + SessionStorage) Cache ─────────
// Prevents duplicate concurrent fetches when multiple widgets mount together,
// and caches fresh responses across tab reloads (F5) for 5 min to eliminate
// redundant PostgREST egress and keep daily bandwidth well under the 5 GB plan limit.

interface CacheEntry {
    data: any[];
    expiresAt: number;
}

const queryCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<{ data: any[] | null; error: any }>>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes — dashboard data is not real-time critical
const SESSION_CACHE_PREFIX = 'tf_cache_v4_';

function getSessionCache(key: string): any[] | null {
    try {
        if (typeof window === 'undefined' || !window.sessionStorage) return null;
        const itemStr = window.sessionStorage.getItem(SESSION_CACHE_PREFIX + key);
        if (!itemStr) return null;
        const entry = JSON.parse(itemStr);
        if (entry && entry.expiresAt > Date.now() && Array.isArray(entry.data)) {
            return entry.data;
        }
        window.sessionStorage.removeItem(SESSION_CACHE_PREFIX + key);
    } catch {
        // Ignore JSON/sessionStorage access errors
    }
    return null;
}

function setSessionCache(key: string, data: any[], ttlMs: number) {
    try {
        if (typeof window === 'undefined' || !window.sessionStorage) return;
        const payload = JSON.stringify({ data, expiresAt: Date.now() + ttlMs });
        // Don't store oversized payloads exceeding 2.5 MB in sessionStorage
        if (payload.length > 2.5 * 1024 * 1024) return;
        window.sessionStorage.setItem(SESSION_CACHE_PREFIX + key, payload);
    } catch {
        // If quota exceeded, prune expired entries
        pruneSessionCache();
    }
}

function pruneSessionCache() {
    try {
        if (typeof window === 'undefined' || !window.sessionStorage) return;
        const keysToRemove: string[] = [];
        for (let i = 0; i < window.sessionStorage.length; i++) {
            const k = window.sessionStorage.key(i);
            if (k && k.startsWith(SESSION_CACHE_PREFIX)) {
                try {
                    const item = JSON.parse(window.sessionStorage.getItem(k) || '{}');
                    if (!item.expiresAt || item.expiresAt <= Date.now()) {
                        keysToRemove.push(k);
                    }
                } catch {
                    keysToRemove.push(k);
                }
            }
        }
        keysToRemove.forEach(k => window.sessionStorage.removeItem(k));
    } catch { /* ignore */ }
}

export function invalidateDbCache(tablePrefix?: string) {
    if (!tablePrefix) {
        queryCache.clear();
        try {
            if (typeof window !== 'undefined' && window.sessionStorage) {
                const keysToRemove: string[] = [];
                for (let i = 0; i < window.sessionStorage.length; i++) {
                    const k = window.sessionStorage.key(i);
                    if (k && k.startsWith(SESSION_CACHE_PREFIX)) {
                        keysToRemove.push(k);
                    }
                }
                keysToRemove.forEach(k => window.sessionStorage.removeItem(k));
            }
        } catch { /* ignore */ }
        return;
    }
    for (const key of queryCache.keys()) {
        if (key.startsWith(tablePrefix)) {
            queryCache.delete(key);
        }
    }
    try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
            const prefix = SESSION_CACHE_PREFIX + tablePrefix;
            const keysToRemove: string[] = [];
            for (let i = 0; i < window.sessionStorage.length; i++) {
                const k = window.sessionStorage.key(i);
                if (k && k.startsWith(prefix)) {
                    keysToRemove.push(k);
                }
            }
            keysToRemove.forEach(k => window.sessionStorage.removeItem(k));
        }
    } catch { /* ignore */ }
}

/**
 * Fetches all matching rows from the 'riders' table, automatically paginating
 * beyond Supabase's default 1000-row limit per request.
 * 
 * @param selectQuery - The columns you want to select, e.g., 'id, rider_name, status'
 * @param filter - Optional. Supply { column, value, type: 'eq' | 'in' } to filter matches.
 * @returns { data: any[] | null, error: any } - Mimics the Supabase standard response
 */
export async function fetchAllRidersPaginated(
    selectQuery: string = '*',
    filter?: { column: string; value: any; type?: 'eq' | 'in' }
): Promise<{ data: any[] | null; error: any }> {
    const cacheKey = `riders:${selectQuery}:${JSON.stringify(filter || {})}`;

    // 1. Check in-memory cache
    const cached = queryCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return { data: cached.data, error: null };
    }

    // 1.1 Check persistent sessionStorage cache (preserves across F5 refreshes)
    const sessionData = getSessionCache(cacheKey);
    if (sessionData) {
        queryCache.set(cacheKey, { data: sessionData, expiresAt: Date.now() + CACHE_TTL_MS });
        return { data: sessionData, error: null };
    }

    // 2. Check in-flight promise deduplication
    const inFlight = inFlightRequests.get(cacheKey);
    if (inFlight) {
        return inFlight;
    }

    // 3. Dispatch fetch
    const fetchPromise = (async () => {
        const allData: any[] = [];
        let from = 0;
        const limit = 1000;

        try {
            while (true) {
                let query = supabase
                    .from('riders')
                    .select(selectQuery)
                    .range(from, from + limit - 1);

                if (filter) {
                    if (filter.type === 'in' && Array.isArray(filter.value)) {
                        query = query.in(filter.column, filter.value);
                    } else {
                        query = query.eq(filter.column, filter.value);
                    }
                }

                const { data, error } = await query;

                if (error) throw error;
                if (!data || data.length === 0) break;

                allData.push(...data);

                if (data.length < limit) break;
                from += limit;
            }

            // Cache result in memory and sessionStorage
            queryCache.set(cacheKey, {
                data: allData,
                expiresAt: Date.now() + CACHE_TTL_MS
            });
            setSessionCache(cacheKey, allData, CACHE_TTL_MS);

            return { data: allData, error: null };
        } catch (err: any) {
            console.error("fetchAllRidersPaginated error:", err);
            return { data: null, error: err };
        } finally {
            inFlightRequests.delete(cacheKey);
        }
    })();

    inFlightRequests.set(cacheKey, fetchPromise);
    return fetchPromise;
}

/**
 * Fetches all matching rows from any table, automatically paginating
 * beyond Supabase's default 1000-row limit per request.
 */
export async function fetchTablePaginated(
    tableName: string,
    selectQuery: string = '*',
    filters?: { column?: string; value: any; operator?: 'eq' | 'in' | 'gte' | 'lte' | 'neq' | 'or' | 'ilike' | 'like' }[]
): Promise<{ data: any[] | null; error: any }> {
    const cacheKey = `${tableName}:${selectQuery}:${JSON.stringify(filters || [])}`;

    // 1. Check in-memory cache
    const cached = queryCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return { data: cached.data, error: null };
    }

    // 1.1 Check persistent sessionStorage cache (preserves across F5 refreshes)
    const sessionData = getSessionCache(cacheKey);
    if (sessionData) {
        queryCache.set(cacheKey, { data: sessionData, expiresAt: Date.now() + CACHE_TTL_MS });
        return { data: sessionData, error: null };
    }

    // 2. Check in-flight promise deduplication
    const inFlight = inFlightRequests.get(cacheKey);
    if (inFlight) {
        return inFlight;
    }

    // 3. Dispatch fetch
    const fetchPromise = (async () => {
        const allData: any[] = [];
        let from = 0;
        const limit = 1000;

        try {
            while (true) {
                let query = supabase
                    .from(tableName as any)
                    .select(selectQuery)
                    .range(from, from + limit - 1);

                if (filters) {
                    for (const filter of filters) {
                        const op = filter.operator || 'eq';
                        if (op === 'or') {
                            query = query.or(filter.value);
                        } else if (filter.column) {
                            if (op === 'eq') query = query.eq(filter.column, filter.value);
                            if (op === 'neq') query = query.neq(filter.column, filter.value);
                            if (op === 'gte') query = query.gte(filter.column, filter.value);
                            if (op === 'lte') query = query.lte(filter.column, filter.value);
                            if (op === 'in' && Array.isArray(filter.value)) query = query.in(filter.column, filter.value);
                            if (op === 'ilike') query = query.ilike(filter.column, filter.value);
                            if (op === 'like') query = query.like(filter.column, filter.value);
                        }
                    }
                }

                const { data, error } = await query;

                if (error) throw error;
                if (!data || data.length === 0) break;

                allData.push(...data);

                if (data.length < limit) break;
                from += limit;
            }

            // Cache result in memory and sessionStorage (skip sessionStorage for live ledger)
            const isLiveTable = tableName === 'wallet_ledger';
            const ttl = isLiveTable ? 5000 : CACHE_TTL_MS;
            queryCache.set(cacheKey, {
                data: allData,
                expiresAt: Date.now() + ttl
            });
            if (!isLiveTable) {
                setSessionCache(cacheKey, allData, CACHE_TTL_MS);
            }

            return { data: allData, error: null };
        } catch (err: any) {
            console.error(`fetchTablePaginated (${tableName}) error:`, err);
            return { data: null, error: err };
        } finally {
            inFlightRequests.delete(cacheKey);
        }
    })();

    inFlightRequests.set(cacheKey, fetchPromise);
    return fetchPromise;
}
