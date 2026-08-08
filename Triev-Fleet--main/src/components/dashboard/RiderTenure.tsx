import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Clock, Users, CalendarCheck } from 'lucide-react';
import { Rider } from '@/types';
import { getValidHistoricalDate } from '@/utils/dateUtils';
interface RiderTenureProps {
    riders: Rider[];
    className?: string;
}

interface TenureBucket {
    label: string;
    count: number;
    color: string;
    bg: string;
}

/**
 * Fleet age distribution showing how long riders have been in the system.
 * Helps identify fleet maturity and retention patterns.
 */
const RiderTenure: React.FC<RiderTenureProps> = ({ riders, className = '' }) => {
    const { buckets, avgDays, oldestDays } = useMemo(() => {
        const now = Date.now();
        const active = riders.filter(r => r.status === 'active' && r.allotmentDate);

        const tenureDays = active.map(r => {
            const validDateStr = getValidHistoricalDate(r.allotmentDate!);
            const allotment = new Date(validDateStr || r.allotmentDate!);
            return Math.floor((now - allotment.getTime()) / (1000 * 60 * 60 * 24));
        });

        const avg = tenureDays.length > 0 ? Math.round(tenureDays.reduce((a, b) => a + b, 0) / tenureDays.length) : 0;
        const oldest = tenureDays.length > 0 ? Math.max(...tenureDays) : 0;

        const b: TenureBucket[] = [
            { label: '< 1 Month', count: tenureDays.filter(d => d < 30).length, color: 'text-cyan-600', bg: 'bg-cyan-500' },
            { label: '1-3 Months', count: tenureDays.filter(d => d >= 30 && d < 90).length, color: 'text-blue-600', bg: 'bg-blue-500' },
            { label: '3-6 Months', count: tenureDays.filter(d => d >= 90 && d < 180).length, color: 'text-violet-600', bg: 'bg-violet-500' },
            { label: '6-12 Months', count: tenureDays.filter(d => d >= 180 && d < 365).length, color: 'text-amber-600', bg: 'bg-amber-500' },
            { label: '1+ Year', count: tenureDays.filter(d => d >= 365).length, color: 'text-emerald-600', bg: 'bg-emerald-500' },
        ];

        return { buckets: b, avgDays: avg, oldestDays: oldest };
    }, [riders]);

    const totalActive = buckets.reduce((a, b) => a + b.count, 0);

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden ${className}`}
        >
            {/* Header */}
            <div className="px-4 py-3 border-b border-border/20 flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-violet-500/10">
                    <Clock size={14} className="text-violet-500" />
                </div>
                <div className="flex-1">
                    <h3 className="text-xs font-black uppercase tracking-wider">Fleet Tenure</h3>
                    <p className="text-[9px] text-muted-foreground font-medium">{totalActive} active riders analyzed</p>
                </div>
            </div>

            {/* Stacked Horizontal Bar */}
            <div className="px-4 pt-3 pb-2">
                <div className="flex gap-0.5 h-4 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                    {buckets.map(bucket => {
                        const percent = totalActive > 0 ? (bucket.count / totalActive) * 100 : 0;
                        return percent > 0 ? (
                            <motion.div
                                key={bucket.label}
                                className={`${bucket.bg} rounded-full`}
                                initial={{ width: 0 }}
                                animate={{ width: `${percent}%` }}
                                transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
                                title={`${bucket.label}: ${bucket.count} riders (${Math.round(percent)}%)`}
                            />
                        ) : null;
                    })}
                </div>
            </div>

            {/* Legend Grid */}
            <div className="px-4 pb-3 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {buckets.map(bucket => (
                    <div key={bucket.label} className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                        <div className={`w-2 h-2 rounded-full ${bucket.bg} flex-shrink-0`} />
                        <span className="text-[9px] font-bold text-muted-foreground truncate">{bucket.label}</span>
                        <span className="text-[10px] font-black tabular-nums ml-auto">{bucket.count}</span>
                    </div>
                ))}
            </div>

            {/* Quick Stats */}
            <div className="px-4 py-2.5 bg-slate-50/50 dark:bg-slate-900/30 border-t border-border/20 grid grid-cols-2 gap-3 text-center">
                <div>
                    <div className="flex items-center justify-center gap-1 text-violet-500 mb-0.5">
                        <CalendarCheck size={10} />
                        <span className="text-sm font-black">{avgDays}d</span>
                    </div>
                    <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">Avg Tenure</p>
                </div>
                <div>
                    <div className="flex items-center justify-center gap-1 text-amber-500 mb-0.5">
                        <Users size={10} />
                        <span className="text-sm font-black">{oldestDays}d</span>
                    </div>
                    <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">Longest</p>
                </div>
            </div>
        </motion.div>
    );
};

export default RiderTenure;
