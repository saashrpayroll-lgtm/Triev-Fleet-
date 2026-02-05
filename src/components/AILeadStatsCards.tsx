import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ShieldCheck, Copy, UserCheck } from 'lucide-react';
import { Lead, Rider } from '@/types';

interface AILeadStatsCardsProps {
    leads: Lead[];
    allLeads: Lead[]; // Needed for global duplicate check
    allRiders: Rider[]; // Needed for match check
    onFilterChange: (filter: 'genuine' | 'duplicate' | 'match' | null) => void;
    activeFilter: 'genuine' | 'duplicate' | 'match' | null;
    isAdmin: boolean;
}

export const AILeadStatsCards: React.FC<AILeadStatsCardsProps> = ({
    leads,
    allLeads,
    allRiders,
    onFilterChange,
    activeFilter,
    isAdmin
}) => {

    const stats = useMemo(() => {
        let genuine = 0;
        let duplicate = 0;
        let match = 0;

        // Create Sets/Maps for faster lookups
        const riderMobileSet = new Set(allRiders.map(r => r.mobileNumber));

        // Count frequencies of mobile numbers in ALL leads
        const leadMobileCounts = new Map<string, number>();
        allLeads.forEach(l => {
            const mobile = l.mobileNumber;
            if (mobile) {
                leadMobileCounts.set(mobile, (leadMobileCounts.get(mobile) || 0) + 1);
            }
        });

        // Analyze current 'leads' (the dataset we are viewing/filtering)
        // NOTE: The user requested stats for "Whole Data", but typically stats cards on a page reflect the data context.
        // However, if the requirement is STRICTLY "Whole Data of entire system", we should iterate `allLeads`.
        // Based on the "Props should come through AI and ... redirectable", usually this filters the CURRENT list.
        // Let's analyze the `leads` passed in (which might be the full list or filtered list).
        // Safest bet for "Stats" is to show stats for the *entire* available dataset (allLeads) so the counts don't jump around confusingly,
        // OR show stats for the current list.
        // "This should work as per over all / Whole Data of riders data / lead data" -> Suggests analyzing ALL leads.

        const leadsToAnalyze = isAdmin ? allLeads : leads; // Admin usually sees all, TL sees theirs. 
        // Actually, "Whole Data" implies we should analyze `allLeads` regardless of what's currently paginated/visible, 
        // BUT for a Team Leader, do they care about duplicates in OTHER teams? Probably yes, to know if it's a wasted lead.

        leadsToAnalyze.forEach(lead => {
            const mobile = lead.mobileNumber;
            if (!mobile) return;

            const isRiderMatch = riderMobileSet.has(mobile);
            const isDuplicate = (leadMobileCounts.get(mobile) || 0) > 1;

            if (isRiderMatch) {
                match++;
            } else if (isDuplicate) {
                duplicate++;
            } else {
                genuine++;
            }
        });

        return { genuine, duplicate, match };
    }, [leads, allLeads, allRiders, isAdmin]);

    const cards = [
        {
            id: 'genuine',
            title: 'Genuine Leads',
            count: stats.genuine,
            icon: ShieldCheck,
            color: 'text-emerald-500',
            bg: 'bg-emerald-500/10',
            border: 'border-emerald-500/20',
            description: 'Unique potential riders',
            filterKey: 'genuine' as const
        },
        {
            id: 'duplicate',
            title: 'Duplicate Leads',
            count: stats.duplicate,
            icon: Copy,
            color: 'text-amber-500',
            bg: 'bg-amber-500/10',
            border: 'border-amber-500/20',
            description: 'Already in leads database',
            filterKey: 'duplicate' as const
        },
        {
            id: 'match',
            title: 'Rider Match',
            count: stats.match,
            icon: UserCheck,
            color: 'text-blue-500',
            bg: 'bg-blue-500/10',
            border: 'border-blue-500/20',
            description: 'Existing active riders',
            filterKey: 'match' as const
        }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {cards.map((card) => {
                const isActive = activeFilter === card.filterKey;
                const isClickable = isAdmin;

                return (
                    <motion.div
                        key={card.id}
                        whileHover={isClickable ? { scale: 1.02 } : {}}
                        whileTap={isClickable ? { scale: 0.98 } : {}}
                        onClick={() => isClickable && onFilterChange(isActive ? null : card.filterKey)}
                        className={`relative overflow-hidden rounded-2xl border p-4 transition-all duration-200 ${isClickable ? 'cursor-pointer hover:shadow-md' : 'cursor-default opacity-90'
                            } ${isActive
                                ? `ring-2 ring-primary ${card.bg}`
                                : 'bg-card hover:bg-muted/50'
                            } ${card.border}`}
                    >
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                                <div className="mt-2 flex items-baseline gap-2">
                                    <h3 className="text-2xl font-bold font-jakarta">{card.count}</h3>
                                    <span className="text-xs text-muted-foreground font-medium">
                                        {((card.count / (allLeads.length || 1)) * 100).toFixed(1)}%
                                    </span>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">{card.description}</p>
                            </div>
                            <div className={`rounded-xl p-2.5 ${card.bg}`}>
                                <card.icon size={20} className={card.color} />
                            </div>
                        </div>

                        {/* AI Badge */}
                        <div className="absolute bottom-0 right-0 p-2 opacity-10">
                            <Sparkles size={60} />
                        </div>
                    </motion.div>
                );
            })}
        </div>
    );
};
