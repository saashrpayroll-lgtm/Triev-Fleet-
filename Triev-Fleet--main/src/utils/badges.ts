import { User, Rider, Lead } from '@/types';

export interface Badge {
    id: string;
    name: string;
    description: string;
    icon: string; // emoji
    color: string; // tailwind color name
    rarity: 'bronze' | 'silver' | 'gold' | 'diamond';
}

export interface AwardedBadge extends Badge {
    awardedAt: string; // ISO date
    reason: string;
}

/** All possible badges in the system */
export const BADGE_DEFINITIONS: Badge[] = [
    // Fleet Management
    { id: 'fleet_10', name: 'Squad Leader', description: 'Manage 10+ active riders', icon: '🎖️', color: 'emerald', rarity: 'bronze' },
    { id: 'fleet_25', name: 'Fleet Commander', description: 'Manage 25+ active riders', icon: '⭐', color: 'blue', rarity: 'silver' },
    { id: 'fleet_50', name: 'Fleet Admiral', description: 'Manage 50+ active riders', icon: '👑', color: 'amber', rarity: 'gold' },

    // Collections
    { id: 'collector_streak_7', name: 'Consistent Collector', description: '7+ days consecutive collections', icon: '🔥', color: 'orange', rarity: 'bronze' },
    { id: 'top_collector', name: 'Top Collector', description: 'Highest collection in a week', icon: '💰', color: 'emerald', rarity: 'gold' },
    { id: 'target_met', name: 'Target Slayer', description: 'Monthly target achieved', icon: '🎯', color: 'violet', rarity: 'gold' },

    // Churn
    { id: 'zero_churn_week', name: 'Zero Churn Week', description: 'No riders lost in a week', icon: '🛡️', color: 'indigo', rarity: 'silver' },
    { id: 'zero_churn_month', name: 'Iron Wall', description: 'No riders lost in a month', icon: '🏰', color: 'violet', rarity: 'diamond' },

    // Leads
    { id: 'lead_machine_5', name: 'Lead Scout', description: '5+ leads created in a week', icon: '🔍', color: 'cyan', rarity: 'bronze' },
    { id: 'lead_machine_10', name: 'Lead Machine', description: '10+ leads created in a week', icon: '🚀', color: 'blue', rarity: 'silver' },
    { id: 'converter_50', name: 'Closer', description: '50%+ lead conversion rate', icon: '✅', color: 'emerald', rarity: 'silver' },
    { id: 'converter_80', name: 'Super Closer', description: '80%+ lead conversion rate', icon: '💎', color: 'fuchsia', rarity: 'diamond' },

    // Wallet Health
    { id: 'healthy_fleet', name: 'Healthy Fleet', description: '80%+ riders with positive wallet', icon: '💚', color: 'emerald', rarity: 'silver' },
    { id: 'zero_defaulters', name: 'Clean Sheet', description: 'No defaulters in fleet', icon: '🌟', color: 'amber', rarity: 'gold' },

    // Engagement
    { id: 'early_bird', name: 'Early Bird', description: 'First to log in today', icon: '🐦', color: 'sky', rarity: 'bronze' },
    { id: 'perfect_week', name: 'Perfect Week', description: 'Logged in every day for a week', icon: '📅', color: 'purple', rarity: 'silver' },
];

/** Rarity config for styling */
export const rarityConfig: Record<Badge['rarity'], { label: string; border: string; bg: string; text: string; glow: string }> = {
    bronze: {
        label: 'Bronze',
        border: 'border-amber-700/40',
        bg: 'bg-gradient-to-br from-amber-800/20 to-amber-600/10',
        text: 'text-amber-700 dark:text-amber-500',
        glow: '',
    },
    silver: {
        label: 'Silver',
        border: 'border-slate-400/40',
        bg: 'bg-gradient-to-br from-slate-300/20 to-slate-100/10 dark:from-slate-600/20 dark:to-slate-800/10',
        text: 'text-slate-600 dark:text-slate-300',
        glow: '',
    },
    gold: {
        label: 'Gold',
        border: 'border-yellow-500/40',
        bg: 'bg-gradient-to-br from-yellow-400/20 to-amber-300/10',
        text: 'text-yellow-600 dark:text-yellow-400',
        glow: 'shadow-yellow-500/20',
    },
    diamond: {
        label: 'Diamond',
        border: 'border-violet-400/40',
        bg: 'bg-gradient-to-br from-violet-400/20 to-fuchsia-400/10',
        text: 'text-violet-500 dark:text-violet-400',
        glow: 'shadow-violet-500/20 shadow-lg',
    },
};

/**
 * Auto-compute which badges a TL qualifies for based on live data.
 * Pure function — no side effects, no DB calls.
 */
export function computeEarnedBadges(
    _tl: User,
    myRiders: Rider[],
    myLeads: Lead[],
    totalCollection: number,
    monthlyTarget: number
): AwardedBadge[] {
    const awarded: AwardedBadge[] = [];
    const now = new Date().toISOString();
    const activeRiders = myRiders.filter(r => r.status === 'active');
    const activeCount = activeRiders.length;

    // Fleet size badges
    if (activeCount >= 50) {
        const badge = BADGE_DEFINITIONS.find(b => b.id === 'fleet_50')!;
        awarded.push({ ...badge, awardedAt: now, reason: `${activeCount} active riders` });
    } else if (activeCount >= 25) {
        const badge = BADGE_DEFINITIONS.find(b => b.id === 'fleet_25')!;
        awarded.push({ ...badge, awardedAt: now, reason: `${activeCount} active riders` });
    } else if (activeCount >= 10) {
        const badge = BADGE_DEFINITIONS.find(b => b.id === 'fleet_10')!;
        awarded.push({ ...badge, awardedAt: now, reason: `${activeCount} active riders` });
    }

    // Collection target
    if (monthlyTarget > 0 && totalCollection >= monthlyTarget) {
        const badge = BADGE_DEFINITIONS.find(b => b.id === 'target_met')!;
        awarded.push({ ...badge, awardedAt: now, reason: `₹${totalCollection.toLocaleString('en-IN')} collected vs ₹${monthlyTarget.toLocaleString('en-IN')} target` });
    }

    // Lead conversion
    const totalLeads = myLeads.length;
    const convertedLeads = myLeads.filter(l => l.status === 'Convert').length;
    const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;

    if (conversionRate >= 80 && totalLeads >= 5) {
        const badge = BADGE_DEFINITIONS.find(b => b.id === 'converter_80')!;
        awarded.push({ ...badge, awardedAt: now, reason: `${Math.round(conversionRate)}% conversion rate` });
    } else if (conversionRate >= 50 && totalLeads >= 5) {
        const badge = BADGE_DEFINITIONS.find(b => b.id === 'converter_50')!;
        awarded.push({ ...badge, awardedAt: now, reason: `${Math.round(conversionRate)}% conversion rate` });
    }

    // Lead volume
    if (totalLeads >= 10) {
        const badge = BADGE_DEFINITIONS.find(b => b.id === 'lead_machine_10')!;
        awarded.push({ ...badge, awardedAt: now, reason: `${totalLeads} leads created` });
    } else if (totalLeads >= 5) {
        const badge = BADGE_DEFINITIONS.find(b => b.id === 'lead_machine_5')!;
        awarded.push({ ...badge, awardedAt: now, reason: `${totalLeads} leads created` });
    }

    // Wallet health
    const positiveWallet = activeRiders.filter(r => r.walletAmount > 0).length;
    const healthPercent = activeCount > 0 ? (positiveWallet / activeCount) * 100 : 0;
    const defaulters = activeRiders.filter(r => r.walletAmount < -699).length;

    if (defaulters === 0 && activeCount >= 5) {
        const badge = BADGE_DEFINITIONS.find(b => b.id === 'zero_defaulters')!;
        awarded.push({ ...badge, awardedAt: now, reason: 'No defaulters in fleet' });
    } else if (healthPercent >= 80) {
        const badge = BADGE_DEFINITIONS.find(b => b.id === 'healthy_fleet')!;
        awarded.push({ ...badge, awardedAt: now, reason: `${Math.round(healthPercent)}% riders with positive wallet` });
    }

    // Sort by rarity (diamond first)
    const rarityOrder = { diamond: 0, gold: 1, silver: 2, bronze: 3 };
    awarded.sort((a, b) => rarityOrder[a.rarity] - rarityOrder[b.rarity]);

    return awarded;
}
