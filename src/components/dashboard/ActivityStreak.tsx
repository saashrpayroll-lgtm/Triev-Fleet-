import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Flame, Zap, Calendar, Award } from 'lucide-react';
import { Rider } from '@/types';

interface ActivityStreakProps {
    riders: Rider[];
    todayCollections: Record<string, number>;
    className?: string;
}

interface StreakRider {
    name: string;
    mobile: string;
    amount: number;
}

/**
 * Compact activity streak widget showing today's top collectors
 * and active riders to motivate TLs.
 */
const ActivityStreak: React.FC<ActivityStreakProps> = ({
    riders,
    todayCollections,
    className = '',
}) => {
    const { topCollectors, activeToday, totalToday } = useMemo(() => {
        const active = riders.filter(r => r.status === 'active');
        const collectorsToday: StreakRider[] = [];
        let total = 0;

        active.forEach(rider => {
            const amt = todayCollections[rider.id] || 0;
            if (amt > 0) {
                collectorsToday.push({
                    name: rider.riderName || 'Unknown',
                    mobile: rider.mobileNumber || '',
                    amount: amt,
                });
                total += amt;
            }
        });

        collectorsToday.sort((a, b) => b.amount - a.amount);

        return {
            topCollectors: collectorsToday.slice(0, 5),
            activeToday: collectorsToday.length,
            totalToday: total,
        };
    }, [riders, todayCollections]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden ${className}`}
        >
            {/* Header */}
            <div className="px-4 py-3 border-b border-border/20 flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-orange-500/10">
                    <Flame size={14} className="text-orange-500" />
                </div>
                <div className="flex-1">
                    <h3 className="text-xs font-black uppercase tracking-wider">Today's Activity</h3>
                    <p className="text-[9px] text-muted-foreground font-medium">
                        {activeToday} riders collected today
                    </p>
                </div>
                <div className="text-right">
                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                        ₹{totalToday.toLocaleString('en-IN')}
                    </span>
                    <p className="text-[8px] text-muted-foreground font-bold">Total</p>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-px bg-border/20">
                {[
                    { icon: Zap, label: 'Collectors', value: activeToday, color: 'text-blue-500' },
                    { icon: Calendar, label: 'Avg/Rider', value: activeToday > 0 ? `₹${Math.round(totalToday / activeToday).toLocaleString('en-IN')}` : '₹0', color: 'text-violet-500' },
                    { icon: Award, label: 'Top', value: topCollectors[0] ? `₹${topCollectors[0].amount.toLocaleString('en-IN')}` : '—', color: 'text-amber-500' },
                ].map(stat => (
                    <div key={stat.label} className="bg-card/40 p-2.5 text-center">
                        <stat.icon size={12} className={`${stat.color} mx-auto mb-1`} />
                        <p className="text-xs font-black">{stat.value}</p>
                        <p className="text-[7px] font-bold uppercase tracking-widest text-muted-foreground">{stat.label}</p>
                    </div>
                ))}
            </div>

            {/* Top Collectors */}
            {topCollectors.length > 0 && (
                <div className="px-3 py-2">
                    <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1.5 px-1">
                        Top Collectors
                    </p>
                    <div className="space-y-1">
                        {topCollectors.map((collector, idx) => (
                            <div
                                key={collector.mobile}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors"
                            >
                                <span className={`
                                    w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0
                                    ${idx === 0 ? 'bg-amber-500/20 text-amber-600' : 'bg-slate-100 dark:bg-slate-800 text-muted-foreground'}
                                `}>
                                    {idx + 1}
                                </span>
                                <span className="text-[10px] font-bold truncate flex-1">{collector.name}</span>
                                <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                                    ₹{collector.amount.toLocaleString('en-IN')}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </motion.div>
    );
};

export default ActivityStreak;
