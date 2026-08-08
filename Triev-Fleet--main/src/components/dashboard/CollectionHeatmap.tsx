import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, TrendingUp } from 'lucide-react';

interface CollectionHeatmapProps {
    /** Map of 'YYYY-MM-DD' → collection amount */
    collections: Record<string, number>;
    /** Number of weeks to show (default 8) */
    weeks?: number;
    className?: string;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * GitHub-style contribution heatmap showing daily collection activity.
 * Color intensity represents collection amounts for each day.
 */
const CollectionHeatmap: React.FC<CollectionHeatmapProps> = ({
    collections,
    weeks = 8,
    className = '',
}) => {
    const { grid, maxAmount, totalAmount, activeDays, bestDay } = useMemo(() => {
        const today = new Date();
        const totalDays = weeks * 7;
        const cells: { date: string; amount: number; day: number; isToday: boolean }[] = [];
        let max = 0;
        let total = 0;
        let active = 0;
        let best = { date: '', amount: 0 };

        for (let i = totalDays - 1; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateKey = d.toISOString().split('T')[0];
            const amount = collections[dateKey] || 0;
            max = Math.max(max, amount);
            total += amount;
            if (amount > 0) active++;
            if (amount > best.amount) best = { date: dateKey, amount };

            cells.push({
                date: dateKey,
                amount,
                day: d.getDay() === 0 ? 6 : d.getDay() - 1, // Monday=0
                isToday: i === 0,
            });
        }

        // Group into weeks
        const weekGrid: typeof cells[] = [];
        for (let w = 0; w < weeks; w++) {
            weekGrid.push(cells.slice(w * 7, (w + 1) * 7));
        }

        return { grid: weekGrid, maxAmount: max, totalAmount: total, activeDays: active, bestDay: best };
    }, [collections, weeks]);

    const getIntensity = (amount: number): string => {
        if (amount === 0) return 'bg-slate-100 dark:bg-slate-800/50';
        const ratio = maxAmount > 0 ? amount / maxAmount : 0;
        if (ratio >= 0.75) return 'bg-emerald-500 dark:bg-emerald-400';
        if (ratio >= 0.5) return 'bg-emerald-400 dark:bg-emerald-500';
        if (ratio >= 0.25) return 'bg-emerald-300 dark:bg-emerald-600';
        return 'bg-emerald-200 dark:bg-emerald-700';
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden ${className}`}
        >
            {/* Header */}
            <div className="px-4 py-3 border-b border-border/20 flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/10">
                    <CalendarDays size={14} className="text-emerald-500" />
                </div>
                <div className="flex-1">
                    <h3 className="text-xs font-black uppercase tracking-wider">Collection Activity</h3>
                    <p className="text-[9px] text-muted-foreground font-medium">Last {weeks} weeks</p>
                </div>
                <div className="text-right">
                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                        ₹{totalAmount.toLocaleString('en-IN')}
                    </span>
                    <p className="text-[8px] text-muted-foreground font-bold">Total</p>
                </div>
            </div>

            {/* Heatmap Grid */}
            <div className="px-4 py-3">
                <div className="flex gap-1">
                    {/* Day Labels */}
                    <div className="flex flex-col gap-1 pr-1.5">
                        {DAYS.map((day, idx) => (
                            <span key={day} className={`text-[7px] font-bold text-muted-foreground/50 h-3 flex items-center ${idx % 2 === 0 ? '' : 'invisible'}`}>
                                {day}
                            </span>
                        ))}
                    </div>
                    {/* Grid */}
                    <div className="flex gap-1 overflow-x-auto hide-scrollbar">
                        {grid.map((week, wIdx) => (
                            <div key={wIdx} className="flex flex-col gap-1">
                                {week.map((cell) => (
                                    <motion.div
                                        key={cell.date}
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ delay: 0.01 * (wIdx * 7 + cell.day) }}
                                        className={`
                                            w-3 h-3 rounded-[3px] cursor-default transition-colors
                                            ${getIntensity(cell.amount)}
                                            ${cell.isToday ? 'ring-1 ring-primary ring-offset-1 ring-offset-background' : ''}
                                        `}
                                        title={`${new Date(cell.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}: ₹${cell.amount.toLocaleString('en-IN')}`}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Legend */}
                <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-border/10">
                    <div className="flex items-center gap-1.5">
                        <span className="text-[8px] font-bold text-muted-foreground/40">Less</span>
                        {['bg-slate-100 dark:bg-slate-800/50', 'bg-emerald-200 dark:bg-emerald-700', 'bg-emerald-300 dark:bg-emerald-600', 'bg-emerald-400 dark:bg-emerald-500', 'bg-emerald-500 dark:bg-emerald-400'].map((cls, i) => (
                            <div key={i} className={`w-2.5 h-2.5 rounded-sm ${cls}`} />
                        ))}
                        <span className="text-[8px] font-bold text-muted-foreground/40">More</span>
                    </div>
                    <div className="flex items-center gap-2 text-[9px] font-bold text-muted-foreground">
                        <span>{activeDays} active days</span>
                        {bestDay.amount > 0 && (
                            <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                                <TrendingUp size={9} />
                                Best: ₹{bestDay.amount.toLocaleString('en-IN')}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default CollectionHeatmap;
