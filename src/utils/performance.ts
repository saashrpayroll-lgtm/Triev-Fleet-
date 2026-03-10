import { User, Rider, Lead } from '../types';
import { getValidHistoricalDate, PerformancePeriod } from './dateUtils';

// Re-export for backward compatibility so existing imports still work
export type { PerformancePeriod };

export interface TLPerformanceMetrics {
    score: number;
    activeRiders: number;
    inactiveRiders: number;
    churnRiders: number;
    totalRiders: number;
    collection: number;
    allotments: number;
    submissions: number;
    netGrowth: number;
    positiveWallet: number;
    negativeWallet: number;
    positiveWalletCount: number;   // 🆕 riders with wallet > 0
    negativeWalletCount: number;   // 🆕 active riders with wallet < 0
    collectionPerRider: number;    // 🆕 collection / max(activeRiders,1)
    convertedLeads: number;
    leadsTotal: number;
    conversionRate: number;
    efficiency: number;
    avgRiderAge: number;
    aiGrade: 'S' | 'A' | 'B' | 'C' | 'D'; // 🆕 AI performance grade
    isTrending: boolean;
    badges?: string[]; // Gamification Badges (e.g., '🏆 Top Collector', '🎯 Zero Churn')
}

/**
 * AI Scoring Weights (Impact Matrix)
 */
export const AI_WEIGHTS = {
    ACTIVE_RIDER: 25,        // Fleet health
    INACTIVE_RIDER: -15,    // Idling penalty
    CHURN_RIDER: -40,       // Permanent loss penalty
    ALLOTMENT: 30,          // Growth reward
    SUBMISSION: -25,        // Shrinkage penalty
    NET_GROWTH: 60,         // Overall expansion multiplier
    COLLECTION_1K: 12,      // Revenue generation
    POSITIVE_WALLET_1K: 3,  // Financial stability
    NEGATIVE_WALLET_1K: -15, // Debt risk
    LEAD_CONVERSION: 45,    // Sourcing quality
    LEAD_REJECTION: -10,    // Sourcing effort waste
    RIDER_TENURE_DAY: 0.6,   // Stability/Retention
};

/**
 * Derive AI performance grade from score + efficiency
 */
export const getAIGrade = (score: number, efficiency: number): 'S' | 'A' | 'B' | 'C' | 'D' => {
    if (score >= 5000 && efficiency >= 85) return 'S';
    if (score >= 3000 && efficiency >= 70) return 'A';
    if (score >= 1500 && efficiency >= 55) return 'B';
    if (score >= 500) return 'C';
    return 'D';
};

export const calculateAIScore = (
    tl: User,
    riders: Rider[],
    leads: Lead[],
    collections: number,
    period?: PerformancePeriod,
    historicalActiveFleet?: number
): TLPerformanceMetrics => {
    const now = new Date();

    // Unified property extractors for robustness against both raw Supabase (snake_case)
    // and mapped state objects (camelCase).
    const getTLId = (u: any) => u.id || u.user_id;
    const tlId = getTLId(tl);

    const getRiderTLId = (r: any) => r.teamLeaderId || r.team_leader_id;
    const getRiderStatus = (r: any) => String(r.status || '').toLowerCase();
    const getRiderWallet = (r: any) => Number(r.walletAmount ?? r.wallet_amount ?? 0);
    const getRiderAllotment = (r: any) => r.allotmentDate || r.allotment_date;
    const getRiderInactivated = (r: any) => r.inactivatedAt || r.inactivated_at;
    const getRiderCreated = (r: any) => r.createdAt || r.created_at;
    const getRiderUpdated = (r: any) => r.updatedAt || r.updated_at;

    const getLeadCreatedBy = (l: any) => l.createdBy || l.created_by;
    const getLeadStatus = (l: any) => l.status;

    // Filter riders belonging to this TL
    const tlRiders = riders.filter(r => getRiderTLId(r) === tlId);
    const tlLeads = leads.filter(l => getLeadCreatedBy(l) === tlId);

    // Basic Stats (Period-aware)
    let activeRiders = 0;
    let inactiveRiders = 0;
    let churnRiders = 0;
    let totalRiders = 0;

    if (period) {
        tlRiders.forEach(r => {
            const status = getRiderStatus(r);
            // ✅ FIX: Use getValidHistoricalDate to correctly handle bulk-imported riders
            // whose allotment_date may be missing (falls back to created_at)
            const allotDateStr = getValidHistoricalDate(
                getRiderAllotment(r),
                getRiderCreated(r)
            );

            if (!allotDateStr) {
                // No date info — count by current live status
                if (status === 'active') activeRiders++;
                else if (status === 'inactive') inactiveRiders++;
                else if (status === 'deleted') churnRiders++;
                totalRiders++;
                return;
            }

            if (allotDateStr <= period.end) {
                totalRiders++;
                // ✅ FIX: Do NOT use UpdatedAt as a fallback for inactivation.
                // If a rider is 'active' or 'Inactive' (imported capitalization), we must be careful.
                const inactiveDateStr = getValidHistoricalDate(getRiderInactivated(r));

                const isCurrentlyActive = status === 'active';
                const isCurrentlyInactive = status === 'inactive';
                const isCurrentlyDeleted = status === 'deleted';

                if (isCurrentlyActive && (!inactiveDateStr || inactiveDateStr > period.end)) {
                    // Currently active and not inactivated before period end
                    activeRiders++;
                } else if (inactiveDateStr && inactiveDateStr <= period.end) {
                    // Inactivated ON or BEFORE period.end
                    if (isCurrentlyDeleted) churnRiders++;
                    else inactiveRiders++;
                } else if (isCurrentlyActive) {
                    // Safety fallback for active riders without inactivation date
                    activeRiders++;
                } else if (isCurrentlyInactive || isCurrentlyDeleted) {
                    // If currently inactive/deleted, but were they active during the period?
                    // If they were inactivated AFTER period.end, they WERE active during the period.
                    if (inactiveDateStr && inactiveDateStr > period.end) {
                        activeRiders++;
                    } else {
                        // Inactivated before or during
                        if (isCurrentlyDeleted) churnRiders++;
                        else inactiveRiders++;
                    }
                }
            }
        });
    } else {
        activeRiders = tlRiders.filter(r => getRiderStatus(r) === 'active').length;
        inactiveRiders = tlRiders.filter(r => getRiderStatus(r) === 'inactive').length;
        churnRiders = tlRiders.filter(r => getRiderStatus(r) === 'deleted').length;
        totalRiders = tlRiders.length;
    }

    // ✅ FIX: Prioritize true historical snapshots over dynamic logic for fleet count
    // Accept 0 as a valid historical number (don't fallback if explicitly 0)
    if (historicalActiveFleet !== undefined) {
        activeRiders = Number(historicalActiveFleet);
    }

    // Wallet Stats
    const positiveWallet = tlRiders.filter(r => getRiderWallet(r) > 0).reduce((s, r) => s + getRiderWallet(r), 0);
    const negativeWallet = tlRiders.filter(r => getRiderWallet(r) < 0).reduce((s, r) => s + getRiderWallet(r), 0);
    const positiveWalletCount = tlRiders.filter(r => getRiderWallet(r) > 0).length;
    const negativeWalletCount = tlRiders.filter(r => getRiderStatus(r) === 'active' && getRiderWallet(r) < 0).length;
    const collectionPerRider = activeRiders > 0 ? Math.round(collections / activeRiders) : 0;

    // Lead Stats
    const convertedLeads = tlLeads.filter(l => getLeadStatus(l) === 'Convert').length;
    const notConvertedLeads = tlLeads.filter(l => getLeadStatus(l) === 'Not Convert').length;
    const conversionRate = tlLeads.length > 0 ? Math.round((convertedLeads / tlLeads.length) * 100) : 0;

    // Retention/Tenure Stats
    const istDateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
    const todayStr = istDateFormatter.format(now);
    const todayIST = new Date(todayStr).getTime();

    const riderAges = tlRiders
        .filter(r => getRiderStatus(r) === 'active' && getRiderAllotment(r))
        .map(r => {
            const rDateStr = istDateFormatter.format(new Date(getRiderAllotment(r)!));
            const rDateIST = new Date(rDateStr).getTime();
            return Math.max(0, Math.floor((todayIST - rDateIST) / 86400000));
        });
    const avgRiderAge = riderAges.length > 0 ? riderAges.reduce((a, b) => a + b, 0) / riderAges.length : 0;

    // Growth Metrics (Period-aware)
    let allotments = 0;
    let submissions = 0;

    if (period) {
        allotments = tlRiders.filter(r => {
            // ✅ FIX: Use getValidHistoricalDate for consistent date handling
            const dateStr = getValidHistoricalDate(
                getRiderAllotment(r),
                getRiderCreated(r)
            );
            if (!dateStr) return false;
            return dateStr >= period.start && dateStr <= period.end;
        }).length;

        submissions = tlRiders.filter(r => {
            const status = getRiderStatus(r);
            if (status !== 'inactive' && status !== 'deleted') return false;
            const dateStr = getValidHistoricalDate(
                getRiderInactivated(r),
                getRiderUpdated(r)
            );
            if (!dateStr) return false;
            return dateStr >= period.start && dateStr <= period.end;
        }).length;
    } else {
        // If no period, count all-time allotments and check current status for submissions
        allotments = tlRiders.length;
        submissions = inactiveRiders + churnRiders;
    }

    const netGrowth = allotments - submissions;

    // AI Impact Score Calculation
    let score = 0;

    // Core Score
    score += activeRiders * AI_WEIGHTS.ACTIVE_RIDER;
    score += inactiveRiders * AI_WEIGHTS.INACTIVE_RIDER;
    score += churnRiders * AI_WEIGHTS.CHURN_RIDER;

    // Growth Impact
    score += allotments * AI_WEIGHTS.ALLOTMENT;
    score += submissions * AI_WEIGHTS.SUBMISSION;
    score += netGrowth * AI_WEIGHTS.NET_GROWTH;

    // Financial Impact
    score += Math.floor(collections / 1000) * AI_WEIGHTS.COLLECTION_1K;
    score += Math.floor(positiveWallet / 1000) * AI_WEIGHTS.POSITIVE_WALLET_1K;
    score -= Math.abs(Math.floor(negativeWallet / 1000)) * Math.abs(AI_WEIGHTS.NEGATIVE_WALLET_1K);

    // Sourcing Impact
    score += convertedLeads * AI_WEIGHTS.LEAD_CONVERSION;
    score += notConvertedLeads * AI_WEIGHTS.LEAD_REJECTION;

    // Stability Impact
    score += Math.floor(avgRiderAge * AI_WEIGHTS.RIDER_TENURE_DAY);

    // Final Normalization
    score = Math.max(0, Math.round(score));

    const efficiency = totalRiders > 0 ? Math.round((activeRiders / totalRiders) * 100) : 0;

    // Trending Logic
    const isTrending = score > 1000 && (activeRiders / (totalRiders || 1)) > 0.85 && netGrowth >= 0;

    // Gamification Badges Logic
    const badges: string[] = [];

    // 1. Top Collector (High collection amount)
    // Note: We'll set this relative to a strong benchmark since we don't have global context inside this isolated function
    if (collections >= 50000) badges.push('🏆 Top Collector');

    // 2. Zero Churn (No riders deleted in period AND has active riders)
    if (churnRiders === 0 && activeRiders > 0 && submissions === 0) badges.push('🎯 Zero Churn');

    // 3. High Conversion (Excellent lead conversion rate)
    if (conversionRate >= 60 && tlLeads.length >= 10) badges.push('🔥 Converter Elite');

    // 4. Growth Master (High net growth)
    if (netGrowth >= 5 && allotments >= 5) badges.push('📈 Growth Master');

    return {
        score,
        activeRiders,
        inactiveRiders,
        churnRiders,
        totalRiders,
        collection: collections,
        allotments,
        submissions,
        netGrowth,
        positiveWallet,
        negativeWallet,
        positiveWalletCount,
        negativeWalletCount,
        collectionPerRider,
        convertedLeads,
        leadsTotal: tlLeads.length,
        conversionRate,
        efficiency,
        avgRiderAge: Math.round(avgRiderAge),
        aiGrade: getAIGrade(score, efficiency),
        isTrending,
        badges
    };
};

