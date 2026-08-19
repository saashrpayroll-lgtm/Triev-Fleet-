import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Users, TrendingUp, PieChart } from 'lucide-react';
import { Rider } from '@/types';

interface FleetHealthSummaryProps {
    riders: Rider[];
    className?: string;
}

/**
 * Compact fleet health overview widget showing risk distribution,
 * wallet health breakdown, and fleet composition at a glance.
 */
const FleetHealthSummary: React.FC<FleetHealthSummaryProps> = ({ riders, className = '' }) => {
    const metrics = useMemo(() => {
        const active = riders.filter(r => r.status === 'active');
        const inactive = riders.filter(r => r.status === 'inactive');
        const total = riders.length;
        const activeCount = active.length;

        // Wallet distribution
        const positive = active.filter(r => r.walletAmount >= 250).length;
        const lowBalance = active.filter(r => r.walletAmount >= 0 && r.walletAmount < 250).length;
        const minorDebt = active.filter(r => r.walletAmount < 0 && r.walletAmount >= -699).length;
        const defaulters = active.filter(r => r.walletAmount < -699).length;

        // Health score: weighted 0-100
        const healthScore = activeCount > 0
            ? Math.round(
                ((positive / activeCount) * 50) +
                ((lowBalance / activeCount) * 20) +
                (((activeCount - defaulters) / activeCount) * 30)
            )
            : 0;

        return {
            total,
            activeCount,
            inactiveCount: inactive.length,
            positive,
            lowBalance,
            minorDebt,
            defaulters,
            healthScore,
            activePercent: total > 0 ? Math.round((activeCount / total) * 100) : 0,
        };
    }, [riders]);

    const healthColor = metrics.healthScore >= 80
        ? 'text-emerald-500'
        : metrics.healthScore >= 60
            ? 'text-amber-500'
            : 'text-red-500';

    const segments = [
        { label: 'Healthy', count: metrics.positive, color: 'bg-emerald-500', percent: metrics.activeCount > 0 ? (metrics.positive / metrics.activeCount) * 100 : 0 },
        { label: 'Low Bal', count: metrics.lowBalance, color: 'bg-amber-500', percent: metrics.activeCount > 0 ? (metrics.lowBalance / metrics.activeCount) * 100 : 0 },
        { label: 'Minor Debt', count: metrics.minorDebt, color: 'bg-orange-500', percent: metrics.activeCount > 0 ? (metrics.minorDebt / metrics.activeCount) * 100 : 0 },
        { label: 'Defaulter', count: metrics.defaulters, color: 'bg-red-500', percent: metrics.activeCount > 0 ? (metrics.defaulters / metrics.activeCount) * 100 : 0 },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden ${className}`}
        >
            {/* Header */}
            <div className="px-4 py-3 border-b border-border/20 flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-500/10">
                    <PieChart size={14} className="text-indigo-500" />
                </div>
                <div className="flex-1">
                    <h3 className="text-xs font-black uppercase tracking-wider">Fleet Health Overview</h3>
                    <p className="text-[9px] text-muted-foreground font-medium">{metrics.total} total riders in system</p>
                </div>
                <div className={`text-2xl font-black ${healthColor}`}>
                    {metrics.healthScore}
                    <span className="text-[9px] font-bold text-muted-foreground ml-0.5">/100</span>
                </div>
            </div>

            {/* Stacked bar */}
            <div className="px-4 pt-3 pb-2">
                <div className="flex gap-0.5 h-3 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                    {segments.map(seg => (
                        seg.percent > 0 && (
                            <motion.div
                                key={seg.label}
                                className={`${seg.color} rounded-full`}
                                initial={{ width: 0 }}
                                animate={{ width: `${seg.percent}%` }}
                                transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
                            />
                        )
                    ))}
                </div>
            </div>

            {/* Legend */}
            <div className="px-4 pb-3 grid grid-cols-2 gap-y-2 gap-x-4">
                {segments.map(seg => (
                    <div key={seg.label} className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${seg.color} flex-shrink-0`} />
                        <span className="text-[9px] font-bold text-muted-foreground flex-1 truncate">{seg.label}</span>
                        <span className="text-[10px] font-black tabular-nums">{seg.count}</span>
                    </div>
                ))}
            </div>

            {/* Quick stats row */}
            <div className="px-4 py-2.5 bg-slate-50/50 dark:bg-slate-900/30 border-t border-border/20 grid grid-cols-3 gap-2 text-center">
                <div>
                    <div className="flex items-center justify-center gap-1 text-emerald-500 mb-0.5">
                        <Users size={10} />
                        <span className="text-sm font-black">{metrics.activeCount}</span>
                    </div>
                    <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">Active</p>
                </div>
                <div>
                    <div className="flex items-center justify-center gap-1 text-slate-400 mb-0.5">
                        <Users size={10} />
                        <span className="text-sm font-black">{metrics.inactiveCount}</span>
                    </div>
                    <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">Inactive</p>
                </div>
                <div>
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                        <TrendingUp size={10} className="text-indigo-500" />
                        <span className="text-sm font-black">{metrics.activePercent}%</span>
                    </div>
                    <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">Retention</p>
                </div>
            </div>
        </motion.div>
    );
};

export default FleetHealthSummary;
