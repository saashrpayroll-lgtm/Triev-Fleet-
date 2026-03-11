import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, ArrowUp, ArrowDown, Calendar } from 'lucide-react';
import { Rider } from '@/types';

interface RevenueForecastProps {
    riders: Rider[];
    currentMonthCollection: number;
    className?: string;
}

/**
 * Revenue forecasting widget that projects end-of-month collection
 * based on current pace and fleet size trends.
 */
const RevenueForecast: React.FC<RevenueForecastProps> = ({
    riders,
    currentMonthCollection,
    className = '',
}) => {
    const forecast = useMemo(() => {
        const now = new Date();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const daysPassed = now.getDate();
        const daysRemaining = daysInMonth - daysPassed;

        const activeRiders = riders.filter(r => r.status === 'active').length;
        const dailyRate = daysPassed > 0 ? currentMonthCollection / daysPassed : 0;
        const projectedTotal = currentMonthCollection + (dailyRate * daysRemaining);

        // Per-rider average
        const perRiderDaily = activeRiders > 0 ? dailyRate / activeRiders : 0;

        // Pace indicator
        const monthlyTarget = dailyRate * daysInMonth; // If same pace continues
        const pacePercent = daysPassed > 0 ? Math.round((daysPassed / daysInMonth) * 100) : 0;
        const collectionPercent = monthlyTarget > 0 ? Math.round((currentMonthCollection / monthlyTarget) * 100) : 0;

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
        };
    }, [riders, currentMonthCollection]);

    const progressWidth = Math.min((forecast.daysPassed / forecast.daysInMonth) * 100, 100);

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden ${className}`}
        >
            {/* Header */}
            <div className="px-4 py-3 border-b border-border/20 flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-500/10">
                    <TrendingUp size={14} className="text-indigo-500" />
                </div>
                <div className="flex-1">
                    <h3 className="text-xs font-black uppercase tracking-wider">Revenue Forecast</h3>
                    <p className="text-[9px] text-muted-foreground font-medium">
                        {new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
                    </p>
                </div>
                <span className={`
                    flex items-center gap-0.5 text-[9px] font-black px-2 py-0.5 rounded-full border
                    ${forecast.isAheadOfPace
                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-600 border-amber-500/20'}
                `}>
                    {forecast.isAheadOfPace ? <ArrowUp size={9} /> : <ArrowDown size={9} />}
                    {forecast.isAheadOfPace ? 'On Track' : 'Behind'}
                </span>
            </div>

            {/* Main Projection */}
            <div className="px-4 py-4">
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/50 mb-0.5">Collected So Far</p>
                        <p className="text-xl font-black text-foreground">
                            ₹{forecast.current.toLocaleString('en-IN')}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/50 mb-0.5">Projected</p>
                        <p className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                            ₹{forecast.projected.toLocaleString('en-IN')}
                        </p>
                    </div>
                </div>

                {/* Month Progress Bar */}
                <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[8px] font-black text-muted-foreground/50 uppercase tracking-widest flex items-center gap-1">
                            <Calendar size={8} />
                            Day {forecast.daysPassed} of {forecast.daysInMonth}
                        </span>
                        <span className="text-[9px] font-black tabular-nums">{Math.round(progressWidth)}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-indigo-600"
                            initial={{ width: 0 }}
                            animate={{ width: `${progressWidth}%` }}
                            transition={{ duration: 1.2, ease: 'easeOut' }}
                        />
                    </div>
                </div>
            </div>

            {/* Bottom Stats */}
            <div className="px-4 py-2.5 bg-slate-50/50 dark:bg-slate-900/30 border-t border-border/20 grid grid-cols-3 gap-2 text-center">
                <div>
                    <p className="text-xs font-black text-foreground">₹{forecast.dailyRate.toLocaleString('en-IN')}</p>
                    <p className="text-[7px] font-bold text-muted-foreground uppercase tracking-wider">Daily Rate</p>
                </div>
                <div>
                    <p className="text-xs font-black text-foreground">₹{forecast.perRiderDaily.toLocaleString('en-IN')}</p>
                    <p className="text-[7px] font-bold text-muted-foreground uppercase tracking-wider">Per Rider/Day</p>
                </div>
                <div>
                    <p className="text-xs font-black text-foreground">{forecast.daysRemaining}</p>
                    <p className="text-[7px] font-bold text-muted-foreground uppercase tracking-wider">Days Left</p>
                </div>
            </div>
        </motion.div>
    );
};

export default RevenueForecast;
