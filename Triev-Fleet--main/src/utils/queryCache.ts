/**
 * queryCache.ts
 * ─────────────────────────────────────────────────────────────
 * A lightweight in-memory cache to dramatically reduce Supabase egress.
 *
 * STRATEGY:
 *   - First load → fetch from DB, store in cache.
 *   - Subsequent loads within TTL → serve from cache (zero egress).
 *   - Realtime events → patch cache in-place (zero egress).
 *   - Tab visibility restore → only re-fetch if data is stale.
 *
 * Default TTL: 10 minutes. Can be customized per key.
 */

const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes
const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes — for visibility change guard

interface CacheEntry<T = any> {
    data: T;
    timestamp: number;
    ttlMs: number;
}

const _store = new Map<string, CacheEntry>();

export const queryCache = {
    /**
     * Get cached data. Returns null if missing or expired.
     */
    get<T>(key: string): T | null {
        const entry = _store.get(key);
        if (!entry) return null;
        if (Date.now() - entry.timestamp > entry.ttlMs) {
            _store.delete(key);
            return null;
        }
        return entry.data as T;
    },

    /**
     * Store data in cache.
     */
    set<T>(key: string, data: T, ttlMs = DEFAULT_TTL_MS): void {
        _store.set(key, { data, timestamp: Date.now(), ttlMs });
    },

    /**
     * Patch a single row inside a cached array.
     * Used with Supabase realtime payload.new / payload.old.
     * Returns true if cache was updated, false if cache miss (caller should re-fetch).
     */
    patchRow<T extends { id: any }>(
        key: string,
        newRow: T | null,
        oldRow: T | null,
        eventType: 'INSERT' | 'UPDATE' | 'DELETE'
    ): boolean {
        const entry = _store.get(key);
        if (!entry || !Array.isArray(entry.data)) return false;

        // Clone to avoid mutating cached ref
        const data: T[] = [...entry.data];

        if (eventType === 'DELETE' && oldRow) {
            const idx = data.findIndex((r) => r.id === oldRow.id);
            if (idx !== -1) data.splice(idx, 1);
        } else if (eventType === 'INSERT' && newRow) {
            // Avoid duplicates
            const exists = data.some((r) => r.id === newRow.id);
            if (!exists) data.unshift(newRow);
        } else if (eventType === 'UPDATE' && newRow) {
            const idx = data.findIndex((r) => r.id === newRow.id);
            if (idx !== -1) {
                data[idx] = { ...data[idx], ...newRow };
            } else {
                data.unshift(newRow);
            }
        }

        // Update entry in-place, refresh timestamp
        _store.set(key, { ...entry, data, timestamp: Date.now() });
        return true;
    },

    /**
     * Check if data for a key is fresh (within staleThresholdMs).
     * Use before re-fetching on visibility change or manual refresh.
     */
    isFresh(key: string, staleThresholdMs = STALE_THRESHOLD_MS): boolean {
        const entry = _store.get(key);
        if (!entry) return false;
        // Also ensure it's not globally expired
        if (Date.now() - entry.timestamp > entry.ttlMs) {
            _store.delete(key);
            return false;
        }
        return Date.now() - entry.timestamp < staleThresholdMs;
    },

    /**
     * Invalidate a specific key (force re-fetch on next access).
     */
    invalidate(key: string): void {
        _store.delete(key);
    },

    /**
     * Invalidate all keys matching a prefix.
     * e.g. invalidatePrefix('riders') clears 'riders', 'riders:tl-123', etc.
     */
    invalidatePrefix(prefix: string): void {
        for (const key of _store.keys()) {
            if (key.startsWith(prefix)) _store.delete(key);
        }
    },

    /**
     * Clear the entire cache (e.g., on logout).
     */
    clear(): void {
        _store.clear();
    },

    /**
     * Get age of a cache entry in milliseconds. Returns Infinity if not cached.
     */
    getAgeMs(key: string): number {
        const entry = _store.get(key);
        if (!entry) return Infinity;
        return Date.now() - entry.timestamp;
    }
};
