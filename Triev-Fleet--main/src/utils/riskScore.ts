import { Rider } from '@/types';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface RiskFactor {
    label: string;
    impact: number; // 0-25 contribution to score
    detail: string;
}

export interface RiderRiskResult {
    score: number;       // 0-100 (100 = highest risk)
    level: RiskLevel;
    factors: RiskFactor[];
}

/**
 * Pure function that computes a rider's risk score from existing data.
 * No DB calls, no side effects — safe to use anywhere.
 *
 * @param rider          - The rider object
 * @param lastCollectionDate - ISO date string of rider's last collection (or null)
 * @param totalCollections   - Total number of collections in last 30 days
 */
export function calculateRiderRiskScore(
    rider: Rider,
    lastCollectionDate: string | null,
    totalCollections: number
): RiderRiskResult {
    const factors: RiskFactor[] = [];
    let score = 0;

    // ─── Factor 1: Wallet Balance (0-30 points) ───
    const wallet = rider.walletAmount ?? 0;
    if (wallet < -3000) {
        score += 30;
        factors.push({ label: 'Severe Debt', impact: 30, detail: `Wallet at ₹${wallet.toLocaleString('en-IN')}` });
    } else if (wallet < -1500) {
        score += 22;
        factors.push({ label: 'High Debt', impact: 22, detail: `Wallet at ₹${wallet.toLocaleString('en-IN')}` });
    } else if (wallet < -700) {
        score += 15;
        factors.push({ label: 'Moderate Debt', impact: 15, detail: `Wallet at ₹${wallet.toLocaleString('en-IN')}` });
    } else if (wallet < 0) {
        score += 8;
        factors.push({ label: 'Minor Debt', impact: 8, detail: `Wallet at ₹${wallet.toLocaleString('en-IN')}` });
    } else if (wallet < 250) {
        score += 5;
        factors.push({ label: 'Low Balance', impact: 5, detail: `Wallet at ₹${wallet.toLocaleString('en-IN')}` });
    }

    // ─── Factor 2: Days Since Last Collection (0-30 points) ───
    if (lastCollectionDate) {
        const daysSince = Math.floor(
            (Date.now() - new Date(lastCollectionDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSince > 7) {
            score += 30;
            factors.push({ label: 'No Collection (7+ days)', impact: 30, detail: `Last collected ${daysSince} days ago` });
        } else if (daysSince > 3) {
            score += 18;
            factors.push({ label: 'Delayed Collection', impact: 18, detail: `Last collected ${daysSince} days ago` });
        } else if (daysSince > 1) {
            score += 8;
            factors.push({ label: 'Recent Gap', impact: 8, detail: `Last collected ${daysSince} days ago` });
        }
    } else {
        score += 25;
        factors.push({ label: 'Never Collected', impact: 25, detail: 'No collection record found' });
    }

    // ─── Factor 3: Collection Frequency (0-20 points) ───
    if (totalCollections === 0) {
        score += 20;
        factors.push({ label: 'Zero Collections', impact: 20, detail: '0 collections in last 30 days' });
    } else if (totalCollections < 5) {
        score += 12;
        factors.push({ label: 'Very Low Activity', impact: 12, detail: `Only ${totalCollections} collections in 30 days` });
    } else if (totalCollections < 15) {
        score += 5;
        factors.push({ label: 'Below Average Activity', impact: 5, detail: `${totalCollections} collections in 30 days` });
    }

    // ─── Factor 4: Status Instability (0-20 points) ───
    if (rider.status === 'inactive') {
        score += 15;
        factors.push({ label: 'Inactive Status', impact: 15, detail: 'Rider is currently inactive' });
    } else if (rider.inactivatedAt) {
        // Was previously deactivated and restored
        score += 8;
        factors.push({ label: 'Previously Deactivated', impact: 8, detail: 'Has history of inactivation' });
    }

    // Cap at 100
    score = Math.min(score, 100);

    // Determine level
    let level: RiskLevel = 'low';
    if (score >= 75) level = 'critical';
    else if (score >= 50) level = 'high';
    else if (score >= 25) level = 'medium';

    return { score, level, factors };
}

/** Color mapping for risk levels */
export const riskLevelColors: Record<RiskLevel, { text: string; bg: string; border: string; gradient: string }> = {
    low: {
        text: 'text-emerald-600 dark:text-emerald-400',
        bg: 'bg-emerald-50 dark:bg-emerald-950/40',
        border: 'border-emerald-200 dark:border-emerald-800',
        gradient: 'from-emerald-500 to-emerald-600',
    },
    medium: {
        text: 'text-amber-600 dark:text-amber-400',
        bg: 'bg-amber-50 dark:bg-amber-950/40',
        border: 'border-amber-200 dark:border-amber-800',
        gradient: 'from-amber-500 to-amber-600',
    },
    high: {
        text: 'text-orange-600 dark:text-orange-400',
        bg: 'bg-orange-50 dark:bg-orange-950/40',
        border: 'border-orange-200 dark:border-orange-800',
        gradient: 'from-orange-500 to-orange-600',
    },
    critical: {
        text: 'text-red-600 dark:text-red-400',
        bg: 'bg-red-50 dark:bg-red-950/40',
        border: 'border-red-200 dark:border-red-800',
        gradient: 'from-red-500 to-red-600',
    },
};
