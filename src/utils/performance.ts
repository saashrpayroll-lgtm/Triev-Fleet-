import { User, Rider, Lead } from '../types';

export interface PerformancePeriod {
    start: string; // ISO date string YYYY-MM-DD
    end: string;   // ISO date string YYYY-MM-DD
}

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
    convertedLeads: number;
    leadsTotal: number;
    conversionRate: number;
    efficiency: number;
    avgRiderAge: number;
    isTrending: boolean;
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

export const calculateAIScore = (
    tl: User,
    riders: Rider[],
    leads: Lead[],
    collections: number,
    period?: PerformancePeriod
): TLPerformanceMetrics => {
    const now = new Date();

    // Filter riders belonging to this TL
    const tlRiders = riders.filter(r => r.teamLeaderId === tl.id || (r as any).team_leader_id === tl.id);
    const tlLeads = leads.filter(l => l.createdBy === tl.id || (l as any).created_by === tl.id);

    // Basic Stats
    const activeRiders = tlRiders.filter(r => r.status === 'active').length;
    const inactiveRiders = tlRiders.filter(r => r.status === 'inactive').length;
    const churnRiders = tlRiders.filter(r => r.status === 'deleted').length;

    // Wallet Stats
    const positiveWallet = tlRiders.filter(r => r.walletAmount > 0).reduce((s, r) => s + r.walletAmount, 0);
    const negativeWallet = tlRiders.filter(r => r.walletAmount < 0).reduce((s, r) => s + r.walletAmount, 0);

    // Lead Stats
    const convertedLeads = tlLeads.filter(l => l.status === 'Convert').length;
    const notConvertedLeads = tlLeads.filter(l => l.status === 'Not Convert').length;
    const conversionRate = tlLeads.length > 0 ? Math.round((convertedLeads / tlLeads.length) * 100) : 0;

    // Retention/Tenure Stats
    const riderAges = tlRiders
        .filter(r => r.status === 'active' && r.allotmentDate)
        .map(r => Math.floor((now.getTime() - new Date(r.allotmentDate!).getTime()) / 86400000));
    const avgRiderAge = riderAges.length > 0 ? riderAges.reduce((a, b) => a + b, 0) / riderAges.length : 0;

    // Growth Metrics (Period-aware)
    let allotments = 0;
    let submissions = 0;

    if (period) {
        allotments = tlRiders.filter(r => {
            if (!r.allotmentDate) return false;
            const adStr = r.allotmentDate.split('T')[0];
            return adStr >= period.start && adStr <= period.end;
        }).length;

        submissions = tlRiders.filter(r => {
            if (r.status !== 'inactive' || !r.inactivatedAt) return false;
            const sdStr = r.inactivatedAt.split('T')[0];
            return sdStr >= period.start && sdStr <= period.end;
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

    // Trending Logic
    const isTrending = score > 1000 && (activeRiders / (tlRiders.length || 1)) > 0.85 && netGrowth >= 0;

    return {
        score,
        activeRiders,
        inactiveRiders,
        churnRiders,
        totalRiders: tlRiders.length,
        collection: collections,
        allotments,
        submissions,
        netGrowth,
        positiveWallet,
        negativeWallet,
        convertedLeads,
        leadsTotal: tlLeads.length,
        conversionRate,
        efficiency: tlRiders.length > 0 ? Math.round((activeRiders / tlRiders.length) * 100) : 0,
        avgRiderAge: Math.round(avgRiderAge),
        isTrending
    };
};
