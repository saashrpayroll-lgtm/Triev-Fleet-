import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, UserPlus, UserMinus, Users } from 'lucide-react';
import { Rider } from '@/types';

interface FleetGrowthIndicatorProps {
    riders: Rider[];
    className?: string;
}

/**
 * Fleet growth indicator showing monthly additions vs departures.
 * Analyzes rider creation dates and inactivation dates to show net growth.
 */
const FleetGrowthIndicator: React.FC<FleetGrowthIndicatorProps> = ({ riders, className = '' }) => {
    const growth = useMemo(() => {
        const now = new Date();
        const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

        const getMonthKey = (dateStr: string) => dateStr?.substring(0, 7) || '';

        // New riders added this month
        const addedThisMonth = riders.filter(r => getMonthKey(r.createdAt) === thisMonth).length;
        const addedLastMonth = riders.filter(r => getMonthKey(r.createdAt) === lastMonth).length;

        // Riders deactivated this month
        const deactivatedThisMonth = riders.filter(r =>
            r.status === 'inactive' && r.inactivatedAt && getMonthKey(r.inactivatedAt) === thisMonth
        ).length;
        const deactivatedLastMonth = riders.filter(r =>
            r.status === 'inactive' && r.inactivatedAt && getMonthKey(r.inactivatedAt) === lastMonth
        ).length;

        const netThisMonth = addedThisMonth - deactivatedThisMonth;
        const netLastMonth = addedLastMonth - deactivatedLastMonth;

        const totalActive = riders.filter(r => r.status === 'active').length;
        const totalInactive = riders.filter(r => r.status === 'inactive').length;

        // Growth bars: last 4 months
        const bars: { month: string; added: number; removed: number; net: number }[] = [];
        for (let i = 3; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const monthLabel = d.toLocaleString('en-IN', { month: 'short' });
            const added = riders.filter(r => getMonthKey(r.createdAt) === key).length;
            const removed = riders.filter(r => r.status === 'inactive' && r.inactivatedAt && getMonthKey(r.inactivatedAt) === key).length;
            bars.push({ month: monthLabel, added, removed, net: added - removed });
        }

        return {
            addedThisMonth,
            deactivatedThisMonth,
            netThisMonth,
            netLastMonth,
            totalActive,
            totalInactive,
            bars,
        };
    }, [riders]);

    const maxBarValue = Math.max(...growth.bars.map(b => Math.max(b.added, b.removed)), 1);

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden ${className}`}
        >
            {/* Header */}
            <div className="px-4 py-3 border-b border-border/20 flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-cyan-500/10">
                    <Users size={14} className="text-cyan-500" />
                </div>
                <div className="flex-1">
                    <h3 className="text-xs font-black uppercase tracking-wider">Fleet Growth</h3>
                    <p className="text-[9px] text-muted-foreground font-medium">Monthly additions vs departures</p>
                </div>
                <span className={`flex items-center gap-0.5 text-[10px] font-black ${growth.netThisMonth >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {growth.netThisMonth >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                    {growth.netThisMonth >= 0 ? '+' : ''}{growth.netThisMonth}
                </span>
            </div>

            {/* This Month Summary */}
            <div className="grid grid-cols-3 gap-px bg-border/20">
                <div className="bg-card/40 p-2.5 text-center">
                    <UserPlus size={12} className="text-emerald-500 mx-auto mb-1" />
                    <p className="text-sm font-black text-emerald-600">+{growth.addedThisMonth}</p>
                    <p className="text-[7px] font-bold uppercase tracking-widest text-muted-foreground">Added</p>
                </div>
                <div className="bg-card/40 p-2.5 text-center">
                    <UserMinus size={12} className="text-rose-500 mx-auto mb-1" />
                    <p className="text-sm font-black text-rose-600">-{growth.deactivatedThisMonth}</p>
                    <p className="text-[7px] font-bold uppercase tracking-widest text-muted-foreground">Departed</p>
                </div>
                <div className="bg-card/40 p-2.5 text-center">
                    <Users size={12} className="text-blue-500 mx-auto mb-1" />
                    <p className="text-sm font-black">{growth.totalActive}</p>
                    <p className="text-[7px] font-bold uppercase tracking-widest text-muted-foreground">Active</p>
                </div>
            </div>

            {/* 4-Month Bar Chart */}
            <div className="px-4 py-3">
                <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/50 mb-2">Last 4 Months</p>
                <div className="flex items-end gap-2 h-16">
                    {growth.bars.map(bar => (
                        <div key={bar.month} className="flex-1 flex flex-col items-center gap-0.5">
                            <div className="w-full flex gap-0.5 items-end justify-center h-12">
                                <motion.div
                                    className="w-2 bg-emerald-400 rounded-t"
                                    initial={{ height: 0 }}
                                    animate={{ height: `${(bar.added / maxBarValue) * 100}%` }}
                                    transition={{ duration: 0.6, ease: 'easeOut' }}
                                />
                                <motion.div
                                    className="w-2 bg-rose-400 rounded-t"
                                    initial={{ height: 0 }}
                                    animate={{ height: `${(bar.removed / maxBarValue) * 100}%` }}
                                    transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
                                />
                            </div>
                            <span className="text-[7px] font-bold text-muted-foreground">{bar.month}</span>
                        </div>
                    ))}
                </div>
                {/* Legend */}
                <div className="flex items-center justify-center gap-3 mt-2">
                    <span className="flex items-center gap-1 text-[8px] font-bold text-muted-foreground">
                        <div className="w-2 h-2 rounded-sm bg-emerald-400" /> Added
                    </span>
                    <span className="flex items-center gap-1 text-[8px] font-bold text-muted-foreground">
                        <div className="w-2 h-2 rounded-sm bg-rose-400" /> Departed
                    </span>
                </div>
            </div>
        </motion.div>
    );
};

export default FleetGrowthIndicator;
