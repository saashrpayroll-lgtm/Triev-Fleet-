import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, LucideIcon } from 'lucide-react';

export interface PerformanceCardProps {
    title: string;
    value: string | number;
    subtext?: string;
    icon: LucideIcon;
    trend?: {
        value: number; // e.g. +12 or -5
        label?: string; // e.g. "vs last period"
        isPositiveGood?: boolean; // default true
    };
    progress?: {
        current: number;
        target: number;
        unit?: string;
    };
    sparklineData?: number[];
    badgeText?: string;
    badgeVariant?: 'emerald' | 'amber' | 'rose' | 'blue' | 'purple' | 'indigo';
    colorScheme?: 'emerald' | 'amber' | 'rose' | 'blue' | 'purple' | 'indigo' | 'orange';
    onClick?: () => void;
}

const colorMap = {
    emerald: {
        bg: 'from-emerald-500/10 via-emerald-500/5 to-transparent',
        border: 'border-emerald-500/20 hover:border-emerald-500/40',
        iconBg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
        badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        progress: 'bg-emerald-500',
        spark: '#10b981',
    },
    blue: {
        bg: 'from-blue-500/10 via-blue-500/5 to-transparent',
        border: 'border-blue-500/20 hover:border-blue-500/40',
        iconBg: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
        badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
        progress: 'bg-blue-500',
        spark: '#3b82f6',
    },
    purple: {
        bg: 'from-purple-500/10 via-purple-500/5 to-transparent',
        border: 'border-purple-500/20 hover:border-purple-500/40',
        iconBg: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
        badge: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
        progress: 'bg-purple-500',
        spark: '#a855f7',
    },
    indigo: {
        bg: 'from-indigo-500/10 via-indigo-500/5 to-transparent',
        border: 'border-indigo-500/20 hover:border-indigo-500/40',
        iconBg: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
        badge: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
        progress: 'bg-indigo-500',
        spark: '#6366f1',
    },
    amber: {
        bg: 'from-amber-500/10 via-amber-500/5 to-transparent',
        border: 'border-amber-500/20 hover:border-amber-500/40',
        iconBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
        badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
        progress: 'bg-amber-500',
        spark: '#f59e0b',
    },
    orange: {
        bg: 'from-orange-500/10 via-orange-500/5 to-transparent',
        border: 'border-orange-500/20 hover:border-orange-500/40',
        iconBg: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
        badge: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
        progress: 'bg-orange-500',
        spark: '#f97316',
    },
    rose: {
        bg: 'from-rose-500/10 via-rose-500/5 to-transparent',
        border: 'border-rose-500/20 hover:border-rose-500/40',
        iconBg: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
        badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
        progress: 'bg-rose-500',
        spark: '#f43f5e',
    },
};

const MiniSparkline: React.FC<{ data: number[]; color: string }> = ({ data, color }) => {
    if (!data || data.length < 2) return null;
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    const width = 80;
    const height = 24;
    const pad = 2;
    const pts = data.map((v, i) => ({
        x: pad + (i / (data.length - 1)) * (width - pad * 2),
        y: pad + (1 - (v - min) / range) * (height - pad * 2)
    }));
    const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

    return (
        <svg width={width} height={height} className="overflow-visible">
            <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="3" fill={color} />
        </svg>
    );
};

const PerformanceCard: React.FC<PerformanceCardProps> = ({
    title,
    value,
    subtext,
    icon: Icon,
    trend,
    progress,
    sparklineData,
    badgeText,
    badgeVariant = 'indigo',
    colorScheme = 'indigo',
    onClick
}) => {
    const theme = colorMap[colorScheme] || colorMap.indigo;
    const badgeTheme = colorMap[badgeVariant] || colorMap.indigo;

    const isPositiveGood = trend?.isPositiveGood ?? true;
    const isUp = (trend?.value ?? 0) > 0;
    const isGood = isUp ? isPositiveGood : !isPositiveGood;

    const progressPct = progress ? Math.min(100, Math.round((progress.current / Math.max(1, progress.target)) * 100)) : 0;

    return (
        <motion.div
            whileHover={{ y: -3, scale: 1.01 }}
            transition={{ duration: 0.2 }}
            onClick={onClick}
            className={`
                relative overflow-hidden p-5 rounded-2xl bg-card border backdrop-blur-xl shadow-sm transition-all duration-300
                bg-gradient-to-br ${theme.bg} ${theme.border} ${onClick ? 'cursor-pointer' : ''}
            `}
        >
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-xl ${theme.iconBg} shadow-inner`}>
                        <Icon className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="text-xs font-bold text-muted-foreground tracking-wide uppercase">{title}</h4>
                        {subtext && <p className="text-[11px] text-muted-foreground/80 mt-0.5">{subtext}</p>}
                    </div>
                </div>

                {badgeText && (
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${badgeTheme.badge}`}>
                        {badgeText}
                    </span>
                )}
            </div>

            <div className="flex items-baseline justify-between gap-2 mt-2">
                <div className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                    {value}
                </div>

                {sparklineData && sparklineData.length > 1 ? (
                    <MiniSparkline data={sparklineData} color={theme.spark} />
                ) : trend ? (
                    <div className={`flex items-center gap-1 text-xs font-black px-2 py-0.5 rounded-lg border ${
                        isGood
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                    }`}>
                        {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : (trend.value < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />)}
                        <span>{Math.abs(trend.value)}%</span>
                        {trend.label && <span className="text-[10px] font-medium opacity-80">{trend.label}</span>}
                    </div>
                ) : null}
            </div>

            {progress && (
                <div className="mt-3.5 pt-3 border-t border-border/40">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground mb-1.5">
                        <span>Target Progress</span>
                        <span className="font-bold text-foreground">{progressPct}%</span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden p-0.5">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${theme.progress}`}
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>
                </div>
            )}
        </motion.div>
    );
};

export default PerformanceCard;
