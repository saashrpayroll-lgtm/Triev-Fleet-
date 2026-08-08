/**
 * ─── Rider Rating Service ──────────────────────────────────────
 *
 * Handles batch-fetching wallet ledger data from Supabase
 * and computing star ratings for all riders in a single optimized query.
 *
 * Features:
 *  - Single batch query (no N+1 queries)
 *  - 5-minute in-memory cache
 *  - Graceful degradation if ledger data unavailable
 */

import { supabase } from '@/config/supabase';
import { Rider } from '@/types';
import {
    LedgerEntry,
    StarRatingResult,
    calculateStarRating,
    calculateQuickStars,
} from '@/utils/starRatingEngine';

// ─── Cache ──────────────────────────────────────────────────────

interface CacheEntry {
    result: StarRatingResult;
    expiry: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const ratingCache = new Map<string, CacheEntry>();

function getCached(riderId: string): StarRatingResult | null {
    const entry = ratingCache.get(riderId);
    if (entry && entry.expiry > Date.now()) return entry.result;
    if (entry) ratingCache.delete(riderId); // Expired
    return null;
}

function setCache(riderId: string, result: StarRatingResult): void {
    ratingCache.set(riderId, { result, expiry: Date.now() + CACHE_TTL_MS });
}

// Periodic cleanup to prevent memory leaks
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of ratingCache) {
        if (entry.expiry < now) ratingCache.delete(key);
    }
}, 60_000);

// ─── Public API ─────────────────────────────────────────────────

export const RiderRatingService = {

    /**
     * Fetch star ratings for a batch of riders.
     * Makes ONE Supabase query for all riders at once.
     */
    fetchRatingsForRiders: async (
        riders: Rider[],
        periodDays: number = 30
    ): Promise<Map<string, StarRatingResult>> => {
        const results = new Map<string, StarRatingResult>();

        if (!riders.length) return results;

        // Check cache first
        const uncachedRiders: Rider[] = [];
        const uncachedIds: string[] = [];

        for (const r of riders) {
            const cached = getCached(r.id);
            if (cached) {
                results.set(r.id, cached);
            } else {
                uncachedRiders.push(r);
                uncachedIds.push(r.id);
            }
        }

        if (uncachedIds.length === 0) return results; // All cached!

        try {
            // Single batch query — last N days of ledger for all uncached riders
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - periodDays);
            const cutoffISO = cutoffDate.toISOString();

            // Supabase `.in()` has a limit (~100 items in one call for some APIs),
            // so we chunk if needed.
            const CHUNK_SIZE = 80;
            const allLedgerEntries: LedgerEntry[] = [];

            for (let i = 0; i < uncachedIds.length; i += CHUNK_SIZE) {
                const chunkIds = uncachedIds.slice(i, i + CHUNK_SIZE);

                const { data, error } = await supabase
                    .from('wallet_ledger')
                    .select('id, rider_id, amount, mode, transaction_type, transaction_date, created_at')
                    .in('rider_id', chunkIds)
                    .or(`transaction_date.gte.${cutoffISO},and(transaction_date.is.null,created_at.gte.${cutoffISO})`)
                    .order('transaction_date', { ascending: true });

                if (error) {
                    console.error('[RiderRatingService] Ledger batch fetch error:', error);
                    // Fall back to quick ratings for this chunk
                    for (const id of chunkIds) {
                        const rider = uncachedRiders.find(r => r.id === id);
                        if (rider) {
                            const quickResult = buildQuickRating(rider);
                            setCache(id, quickResult);
                            results.set(id, quickResult);
                        }
                    }
                    continue;
                }

                if (data) allLedgerEntries.push(...(data as LedgerEntry[]));
            }

            // Group ledger entries by rider_id
            const ledgerByRider = new Map<string, LedgerEntry[]>();
            for (const entry of allLedgerEntries) {
                const existing = ledgerByRider.get(entry.rider_id) || [];
                existing.push(entry);
                ledgerByRider.set(entry.rider_id, existing);
            }

            // Compute ratings for each uncached rider
            for (const rider of uncachedRiders) {
                if (results.has(rider.id)) continue; // Already handled in error fallback
                const ledger = ledgerByRider.get(rider.id) || [];
                const rating = calculateStarRating(rider, ledger, periodDays);
                setCache(rider.id, rating);
                results.set(rider.id, rating);
            }

        } catch (err) {
            console.error('[RiderRatingService] Unexpected error:', err);
            // Fallback: quick ratings for all uncached
            for (const rider of uncachedRiders) {
                if (!results.has(rider.id)) {
                    const quickResult = buildQuickRating(rider);
                    results.set(rider.id, quickResult);
                }
            }
        }

        return results;
    },

    /**
     * Fetch star rating for a single rider (with full ledger data).
     */
    fetchRatingForSingleRider: async (
        rider: Rider,
        periodDays: number = 30
    ): Promise<StarRatingResult> => {
        const cached = getCached(rider.id);
        if (cached) return cached;

        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - periodDays);
            const cutoffISO = cutoffDate.toISOString();

            const { data, error } = await supabase
                .from('wallet_ledger')
                .select('id, rider_id, amount, mode, transaction_type, transaction_date, created_at')
                .eq('rider_id', rider.id)
                .or(`transaction_date.gte.${cutoffISO},and(transaction_date.is.null,created_at.gte.${cutoffISO})`)
                .order('transaction_date', { ascending: true });

            if (error) {
                console.error('[RiderRatingService] Single rider fetch error:', error);
                return buildQuickRating(rider);
            }

            const ledger = (data as LedgerEntry[]) || [];
            const rating = calculateStarRating(rider, ledger, periodDays);
            setCache(rider.id, rating);
            return rating;

        } catch (err) {
            console.error('[RiderRatingService] Unexpected error:', err);
            return buildQuickRating(rider);
        }
    },

    /**
     * Get a quick star rating without any DB calls (wallet + status only).
     * Used for immediate display while full data loads.
     */
    getQuickRating: (rider: Rider): StarRatingResult => {
        return buildQuickRating(rider);
    },

    /**
     * Force clear the cache (useful after bulk wallet updates).
     */
    clearCache: (): void => {
        ratingCache.clear();
    },

    /**
     * Clear cache for specific rider IDs.
     */
    invalidateRiders: (riderIds: string[]): void => {
        for (const id of riderIds) {
            ratingCache.delete(id);
        }
    },
};

// ─── Internal Helpers ───────────────────────────────────────────

function buildQuickRating(rider: Rider): StarRatingResult {
    const quick = calculateQuickStars(rider);
    return {
        totalScore: quick.stars * 20 - 5, // Rough score from stars
        stars: quick.stars,
        label: quick.label,
        color: quick.color,
        bgColor: quick.stars >= 4 ? 'bg-emerald-50 dark:bg-emerald-950/40'
            : quick.stars >= 3 ? 'bg-amber-50 dark:bg-amber-950/40'
            : 'bg-red-50 dark:bg-red-950/40',
        borderColor: quick.stars >= 4 ? 'border-emerald-200 dark:border-emerald-800'
            : quick.stars >= 3 ? 'border-amber-200 dark:border-amber-800'
            : 'border-red-200 dark:border-red-800',
        factors: [],
        churn: {
            level: quick.stars <= 2 ? 'high' : quick.stars <= 3 ? 'moderate' : 'stable',
            percentage: quick.stars <= 1 ? 80 : quick.stars <= 2 ? 50 : quick.stars <= 3 ? 30 : 10,
            reasoning: 'Quick estimate — view details for full analysis',
            label: quick.stars <= 2 ? 'High Risk' : quick.stars <= 3 ? 'Moderate' : 'Stable',
            color: quick.stars <= 2 ? 'text-orange-600' : quick.stars <= 3 ? 'text-amber-600' : 'text-emerald-600',
        },
        isNewRider: false,
        computedAt: new Date().toISOString(),
    };
}
