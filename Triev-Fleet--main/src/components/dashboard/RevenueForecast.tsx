import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, ArrowUp, ArrowDown, Calendar, ChevronLeft, ChevronRight, BarChart3, Target, Zap, Users, Clock } from 'lucide-react';
import { Rider } from '@/types';

interface MonthlyRecord {
    month: string; // 'YYYY-MM'
    label: string; // 'Jan 2026'
    total: number;
    days: number;
    avgDaily: number;
}

interface RevenueForecastProps {
    riders: Rider[];
    currentMonthCollection: number;
    dailyCollectionsRaw?: any[]; // daily_collections rows for history
    className?: string;
}

/**
 * Enhanced Revenue Forecasting widget with month-by-month tracking,
 * visual bar chart, growth indicators, and projection accuracy.
 */
const RevenueForecast: React.FC<RevenueForecastProps> = ({
    riders,
    currentMonthCollection,
    dailyCollectionsRaw = [],
    className = '',
}) => {
    const [selectedMonthIdx, setSelectedMonthIdx] = useState<number | null>(null);

    // Build month-by-month history from daily_collections
    const monthlyHistory = useMemo(() => {
        const monthMap: Record<string, { total: number; days: Set<string> }> = {};

        dailyCollectionsRaw.forEach((d: any) => {
            const dateStr = d.date && typeof d.date === 'string' ? d.date.split('T')[0].split(' ')[0] : d.date;
            if (!dateStr) return;
            const monthKey = dateStr.substring(0, 7); // 'YYYY-MM'
            if (!monthMap[monthKey]) monthMap[monthKey] = { total: 0, days: new Set() };
            monthMap[monthKey].total += Number(d.total_collection) || 0;
            monthMap[monthKey].days.add(dateStr);
        });

        // Convert to sorted array (oldest first)
        const months = Object.entries(monthMap)
            .map(([key, val]) => {
                const [y, m] = key.split('-').map(Number);
                const monthName = new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'short', year: 'numeric' });
                return {
                    month: key,
                    label: monthName,
                    total: Math.round(val.total),
                    days: val.days.size,
                    avgDaily: val.days.size > 0 ? Math.round(val.total / val.days.size) : 0,
                } as MonthlyRecord;
            })
            .sort((a, b) => a.month.localeCompare(b.month));

        return months;
    }, [dailyCollectionsRaw]);

    // Current month forecast computation
    const forecast = useMemo(() => {
        const now = new Date();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const daysPassed = now.getDate();
        const daysRemaining = daysInMonth - daysPassed;

        const activeRiders = riders.filter(r => r.status === 'active').length;
        const dailyRate = daysPassed > 0 ? currentMonthCollection / daysPassed : 0;
        const projectedTotal = currentMonthCollection + (dailyRate * daysRemaining);

        const perRiderDaily = activeRiders > 0 ? dailyRate / activeRiders : 0;

        const monthlyTarget = dailyRate * daysInMonth;
        const pacePercent = daysPassed > 0 ? Math.round((daysPassed / daysInMonth) * 100) : 0;
        const collectionPercent = monthlyTarget > 0 ? Math.round((currentMonthCollection / monthlyTarget) * 100) : 0;

        // Month-over-month growth
        const prevMonth = monthlyHistory.length >= 1 ? monthlyHistory[monthlyHistory.length - 1] : null;
        const growthVsPrev = prevMonth && prevMonth.total > 0
            ? Math.round(((projectedTotal - prevMonth.total) / prevMonth.total) * 100)
            : 0;

        // 3-month average
        const last3 = monthlyHistory.slice(-3);
        const avg3Month = last3.length > 0 ? Math.round(last3.reduce((s, m) => s + m.total, 0) / last3.length) : 0;

        return {
            current: currentMonthCollection,
            projected: Math.round(projectedTotal),
            dailyRate: Math.round(dailyRate),
            perRiderDaily: Math.round(perRiderDaily),
            activeRiders,
            daysPassed,
            daysRemaining,
            daysInMonth,
            pacePercent,
            collectionPercent,
            isAheadOfPace: collectionPercent >= pacePercent,
            growthVsPrev,
            avg3Month,
            prevMonthTotal: prevMonth?.total ?? 0,
            prevMonthLabel: prevMonth?.label ?? '',
        };
    }, [riders, currentMonthCollection, monthlyHistory]);

    const progressWidth = Math.min((forecast.daysPassed / forecast.daysInMonth) * 100, 100);

    // Max value for bar chart scaling
    const allValues = [...monthlyHistory.map(m => m.total), forecast.projected];
    const maxBarValue = Math.max(...allValues, 1);

    const selectedMonth = selectedMonthIdx !== null ? monthlyHistory[selectedMonthIdx] : null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl sm:rounded-3xl border border-border/40 bg-gradient-to-br from-card/80 via-card/60 to-indigo-500/[0.02] backdrop-blur-sm overflow-hidden shadow-xl shadow-indigo-500/5 ${className}`}
        >
            {/* ── Header ── */}
            <div className="px-4 py-3 border-b border-border/20 flex items-center gap-2">
                <div className="relative">
                    <div className="absolute inset-0 bg-indigo-500 blur-md opacity-30 rounded-full" />
                    <div className="relative p-2 rounded-xl bg-gradient-to-br from-indigo-500/15 to-violet-500/15 ring-1 ring-indigo-500/20">
                        <TrendingUp size={14} className="text-indigo-500" />
                    </div>
                </div>
                <div className="flex-1">
                    <h3 className="text-xs font-black uppercase tracking-wider">Revenue Forecast</h3>
                    <p className="text-[9px] text-muted-foreground font-medium">
                        {new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
                    </p>
                </div>
                <span className={`
                    flex items-center gap-0.5 text-[9px] font-black px-2.5 py-1 rounded-full border transition-all
                    ${forecast.isAheadOfPace
                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-600 border-amber-500/20'}
                `}>
                    {forecast.isAheadOfPace ? <ArrowUp size={9} /> : <ArrowDown size={9} />}
                    {forecast.isAheadOfPace ? 'On Track' : 'Behind'}
                </span>
            </div>

            {/* ── Current Month Hero ── */}
            <div className="px-4 pt-4 pb-3">
                <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                        <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/50 mb-0.5">Collected</p>
                        <p className="text-xl sm:text-2xl font-black text-foreground tabular-nums leading-none">
                            ₹{forecast.current.toLocaleString('en-IN')}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/50 mb-0.5">Projected EOM</p>
                        <p className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums leading-none">
                            ₹{forecast.projected.toLocaleString('en-IN')}
                        </p>
                    </div>
                </div>

                {/* Month Progress Bar */}
                <div className="mb-2">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[8px] font-black text-muted-foreground/50 uppercase tracking-widest flex items-center gap-1">
                            <Calendar size={8} />
                            Day {forecast.daysPassed} of {forecast.daysInMonth}
                        </span>
                        <span className="text-[9px] font-black tabular-nums">{Math.round(progressWidth)}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full rounded-full bg-gradient-to-r from-indigo-400 via-indigo-500 to-violet-500 relative"
                            initial={{ width: 0 }}
                            animate={{ width: `${progressWidth}%` }}
                            transition={{ duration: 1.2, ease: 'easeOut' }}
                        >
                            <div className="absolute right-0 top-0 w-2 h-full bg-white/30 rounded-full" />
                        </motion.div>
                    </div>
                </div>

                {/* Growth Badges */}
                <div className="flex items-center gap-2 flex-wrap">
                    {forecast.growthVsPrev !== 0 && (
                        <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className={`inline-flex items-center gap-1 text-[8px] font-black px-2 py-0.5 rounded-full border ${
                                forecast.growthVsPrev > 0
                                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                    : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                            }`}
                        >
                            {forecast.growthVsPrev > 0 ? <ArrowUp size={8} /> : <ArrowDown size={8} />}
                            {forecast.growthVsPrev > 0 ? '+' : ''}{forecast.growthVsPrev}% vs {forecast.prevMonthLabel}
                        </motion.span>
                    )}
                    {forecast.avg3Month > 0 && (
                        <span className="inline-flex items-center gap-1 text-[8px] font-black px-2 py-0.5 rounded-full bg-indigo-500/8 text-indigo-600 dark:text-indigo-400 border border-indigo-500/15">
                            <BarChart3 size={8} />
                            3M Avg: ₹{forecast.avg3Month.toLocaleString('en-IN')}
                        </span>
                    )}
                </div>
            </div>

            {/* ── Month-by-Month Visual Chart ── */}
            {monthlyHistory.length > 0 && (
                <div className="px-4 pb-3">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/50 flex items-center gap-1">
                            <BarChart3 size={8} />
                            Monthly Revenue Trend
                        </span>
                    </div>
                    <div className="flex items-end gap-[3px] h-[72px]">
                        {monthlyHistory.map((m, i) => {
                            const height = maxBarValue > 0 ? (m.total / maxBarValue) * 100 : 0;
                            const isSelected = selectedMonthIdx === i;
                            const isCurrentMonth = m.month === new Date().toISOString().substring(0, 7);
                            return (
                                <motion.div
                                    key={m.month}
                                    className="flex-1 flex flex-col items-center gap-1 cursor-pointer group"
                                    onClick={() => setSelectedMonthIdx(isSelected ? null : i)}
                                    whileHover={{ scale: 1.08 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    <motion.div
                                        className={`w-full rounded-t-md transition-all duration-200 min-h-[4px] relative overflow-hidden ${
                                            isSelected
                                                ? 'bg-gradient-to-t from-indigo-600 to-violet-500 ring-2 ring-indigo-400/50 shadow-lg shadow-indigo-500/30'
                                                : isCurrentMonth
                                                    ? 'bg-gradient-to-t from-indigo-500/60 to-indigo-400/40 ring-1 ring-indigo-400/30'
                                                    : 'bg-gradient-to-t from-slate-300 to-slate-200 dark:from-slate-700 dark:to-slate-600 group-hover:from-indigo-400/50 group-hover:to-indigo-300/30'
                                        }`}
                                        initial={{ height: 0 }}
                                        animate={{ height: `${Math.max(height, 5)}%` }}
                                        transition={{ delay: i * 0.05, duration: 0.6, ease: 'easeOut' }}
                                    >
                                        {isSelected && (
                                            <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/20" />
                                        )}
                                    </motion.div>
                                    <span className={`text-[6px] sm:text-[7px] font-black uppercase tracking-wider leading-none ${
                                        isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-muted-foreground/40'
                                    }`}>
                                        {m.label.split(' ')[0].substring(0, 3)}
                                    </span>
                                </motion.div>
                            );
                        })}
                        {/* Projected bar for current month */}
                        <motion.div
                            className="flex-1 flex flex-col items-center gap-1"
                            whileHover={{ scale: 1.08 }}
                        >
                            <motion.div
                                className="w-full rounded-t-md bg-gradient-to-t from-indigo-500/30 to-violet-400/20 border border-dashed border-indigo-400/40 min-h-[4px]"
                                initial={{ height: 0 }}
                                animate={{ height: `${Math.max((forecast.projected / maxBarValue) * 100, 5)}%` }}
                                transition={{ delay: monthlyHistory.length * 0.05, duration: 0.6, ease: 'easeOut' }}
                            />
                            <span className="text-[6px] sm:text-[7px] font-black text-indigo-500 uppercase tracking-wider leading-none flex items-center gap-0.5">
                                <Target size={6} />
                                Est
                            </span>
                        </motion.div>
                    </div>
                </div>
            )}

            {/* ── Selected Month Detail Popover ── */}
            <AnimatePresence>
                {selectedMonth && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                    >
                        <div className="px-4 pb-3">
                            <div className="bg-indigo-500/5 dark:bg-indigo-900/15 border border-indigo-500/15 rounded-xl p-3">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setSelectedMonthIdx(prev => prev !== null && prev > 0 ? prev - 1 : prev)}
                                            className="p-1 rounded-md hover:bg-indigo-500/10 transition-colors disabled:opacity-30"
                                            disabled={selectedMonthIdx === 0}
                                        >
                                            <ChevronLeft size={12} className="text-indigo-500" />
                                        </button>
                                        <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">{selectedMonth.label}</span>
                                        <button
                                            onClick={() => setSelectedMonthIdx(prev => prev !== null && prev < monthlyHistory.length - 1 ? prev + 1 : prev)}
                                            className="p-1 rounded-md hover:bg-indigo-500/10 transition-colors disabled:opacity-30"
                                            disabled={selectedMonthIdx === monthlyHistory.length - 1}
                                        >
                                            <ChevronRight size={12} className="text-indigo-500" />
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => setSelectedMonthIdx(null)}
                                        className="text-[8px] font-black text-muted-foreground hover:text-foreground uppercase tracking-wider"
                                    >
                                        Close
                                    </button>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="bg-white/60 dark:bg-slate-800/40 rounded-lg p-2 text-center">
                                        <p className="text-sm font-black text-foreground tabular-nums">₹{selectedMonth.total.toLocaleString('en-IN')}</p>
                                        <p className="text-[7px] font-bold text-muted-foreground uppercase tracking-wider">Total Collected</p>
                                    </div>
                                    <div className="bg-white/60 dark:bg-slate-800/40 rounded-lg p-2 text-center">
                                        <p className="text-sm font-black text-foreground tabular-nums">₹{selectedMonth.avgDaily.toLocaleString('en-IN')}</p>
                                        <p className="text-[7px] font-bold text-muted-foreground uppercase tracking-wider">Avg/Day</p>
                                    </div>
                                    <div className="bg-white/60 dark:bg-slate-800/40 rounded-lg p-2 text-center">
                                        <p className="text-sm font-black text-foreground tabular-nums">{selectedMonth.days}</p>
                                        <p className="text-[7px] font-bold text-muted-foreground uppercase tracking-wider">Active Days</p>
                                    </div>
                                </div>
                                {/* MoM comparison */}
                                {selectedMonthIdx !== null && selectedMonthIdx > 0 && (() => {
                                    const prev = monthlyHistory[selectedMonthIdx - 1];
                                    const diff = prev.total > 0 ? Math.round(((selectedMonth.total - prev.total) / prev.total) * 100) : 0;
                                    return (
                                        <div className="mt-2 flex items-center gap-1.5">
                                            <span className={`inline-flex items-center gap-0.5 text-[8px] font-black ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {diff >= 0 ? <ArrowUp size={8} /> : <ArrowDown size={8} />}
                                                {diff >= 0 ? '+' : ''}{diff}%
                                            </span>
                                            <span className="text-[8px] text-muted-foreground font-bold">vs {prev.label}</span>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Bottom Stats Grid ── */}
            <div className="px-4 py-2.5 bg-slate-50/50 dark:bg-slate-900/30 border-t border-border/20 grid grid-cols-4 gap-1.5 text-center">
                <div className="bg-white/50 dark:bg-slate-800/30 rounded-lg p-1.5">
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                        <Zap size={8} className="text-amber-500" />
                    </div>
                    <p className="text-[10px] font-black text-foreground tabular-nums">₹{forecast.dailyRate.toLocaleString('en-IN')}</p>
                    <p className="text-[6px] font-bold text-muted-foreground uppercase tracking-wider">Daily Rate</p>
                </div>
                <div className="bg-white/50 dark:bg-slate-800/30 rounded-lg p-1.5">
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                        <Users size={8} className="text-indigo-500" />
                    </div>
                    <p className="text-[10px] font-black text-foreground tabular-nums">₹{forecast.perRiderDaily.toLocaleString('en-IN')}</p>
                    <p className="text-[6px] font-bold text-muted-foreground uppercase tracking-wider">Per Rider/Day</p>
                </div>
                <div className="bg-white/50 dark:bg-slate-800/30 rounded-lg p-1.5">
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                        <Clock size={8} className="text-violet-500" />
                    </div>
                    <p className="text-[10px] font-black text-foreground tabular-nums">{forecast.daysRemaining}</p>
                    <p className="text-[6px] font-bold text-muted-foreground uppercase tracking-wider">Days Left</p>
                </div>
                <div className="bg-white/50 dark:bg-slate-800/30 rounded-lg p-1.5">
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                        <Users size={8} className="text-emerald-500" />
                    </div>
                    <p className="text-[10px] font-black text-foreground tabular-nums">{forecast.activeRiders}</p>
                    <p className="text-[6px] font-bold text-muted-foreground uppercase tracking-wider">Active Fleet</p>
                </div>
            </div>
        </motion.div>
    );
};

export default RevenueForecast;
