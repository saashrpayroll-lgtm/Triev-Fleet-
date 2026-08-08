import React from 'react';
import { motion } from 'framer-motion';
import { Target, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface CollectionTargetCardProps {
    collected: number;
    target: number;
    daysElapsed: number;
    totalDays: number;
    className?: string;
}

/**
 * Animated circular progress card showing collection vs monthly target.
 * Purely presentational — no data mutation.
 */
const CollectionTargetCard: React.FC<CollectionTargetCardProps> = ({
    collected,
    target,
    daysElapsed,
    totalDays,
    className = '',
}) => {
    const percentage = target > 0 ? Math.min((collected / target) * 100, 100) : 0;
    const expectedPace = target > 0 && totalDays > 0
        ? (target / totalDays) * daysElapsed
        : 0;

    const paceStatus = collected >= expectedPace * 1.1
        ? 'ahead'
        : collected >= expectedPace * 0.9
            ? 'onTrack'
            : 'behind';

    const paceConfig = {
        ahead: { label: 'Ahead of Pace', icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
        onTrack: { label: 'On Track', icon: Minus, color: 'text-blue-500', bg: 'bg-blue-500/10' },
        behind: { label: 'Behind Pace', icon: TrendingDown, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    };

    const pace = paceConfig[paceStatus];
    const PaceIcon = pace.icon;

    // SVG circular progress
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;

    const formatCurrency = (val: number) => {
        if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
        if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
        return `₹${val.toLocaleString('en-IN')}`;
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`relative overflow-hidden rounded-2xl border border-border/40 bg-card/70 backdrop-blur-sm p-4 shadow-lg hover:shadow-xl transition-all ${className}`}
        >
            {/* Ambient glow */}
            <div className="absolute -top-8 -right-8 w-24 h-24 bg-violet-500/10 rounded-full blur-2xl" />

            <div className="relative z-10 flex items-center gap-4">
                {/* Circular Progress */}
                <div className="relative flex-shrink-0">
                    <svg width="88" height="88" viewBox="0 0 88 88" className="transform -rotate-90">
                        {/* Background ring */}
                        <circle
                            cx="44" cy="44" r={radius}
                            fill="none"
                            strokeWidth="6"
                            className="stroke-slate-200 dark:stroke-slate-800"
                        />
                        {/* Progress ring */}
                        <motion.circle
                            cx="44" cy="44" r={radius}
                            fill="none"
                            strokeWidth="6"
                            strokeLinecap="round"
                            className={paceStatus === 'behind' ? 'stroke-orange-500' : 'stroke-violet-500'}
                            initial={{ strokeDashoffset: circumference }}
                            animate={{ strokeDashoffset: offset }}
                            transition={{ duration: 1.5, ease: 'easeOut' }}
                            style={{ strokeDasharray: circumference }}
                        />
                    </svg>
                    {/* Center text */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-lg font-black text-foreground">{Math.round(percentage)}%</span>
                        <span className="text-[7px] font-bold uppercase tracking-widest text-muted-foreground">
                            achieved
                        </span>
                    </div>
                </div>

                {/* Text Info */}
                <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-1.5">
                        <Target size={12} className="text-violet-500 flex-shrink-0" />
                        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">
                            Monthly Target
                        </span>
                    </div>

                    <div>
                        <span className="text-base font-black text-foreground">{formatCurrency(collected)}</span>
                        <span className="text-xs text-muted-foreground font-medium"> / {formatCurrency(target)}</span>
                    </div>

                    {/* Pace Badge */}
                    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${pace.color} ${pace.bg}`}>
                        <PaceIcon size={10} />
                        {pace.label}
                    </div>

                    {/* Day progress */}
                    <div className="flex items-center gap-2">
                        <div className="flex-1 h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-slate-400 dark:bg-slate-600 rounded-full transition-all"
                                style={{ width: `${(daysElapsed / totalDays) * 100}%` }}
                            />
                        </div>
                        <span className="text-[8px] font-bold text-muted-foreground whitespace-nowrap">
                            Day {daysElapsed}/{totalDays}
                        </span>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default CollectionTargetCard;
