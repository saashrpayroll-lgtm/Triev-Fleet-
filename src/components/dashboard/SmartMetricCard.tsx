
import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { safeRender } from '@/utils/safeRender';
// import { cn } from '@/lib/utils'; // Removed to avoid dependency issues

interface SmartMetricCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    trend?: {
        value: number; // percentage
        label: string; // e.g., "vs last month"
        direction: 'up' | 'down' | 'neutral';
    };
    color: 'blue' | 'green' | 'red' | 'orange' | 'purple' | 'indigo' | 'cyan' | 'emerald' | 'amber' | 'rose' | 'slate' | 'lime' | 'violet' | 'fuchsia';
    onClick?: () => void;
    subtitle?: string;
    aiInsight?: string; // New prop for AI insights
    loading?: boolean;
    className?: string; // For additional styling
}

const colorMap = {
    blue: 'bg-blue-500/10 text-blue-600 border-blue-500/20 hover:shadow-blue-500/20 hover:border-blue-500/40',
    green: 'bg-green-500/10 text-green-600 border-green-500/20 hover:shadow-green-500/20 hover:border-green-500/40',
    red: 'bg-red-500/10 text-red-600 border-red-500/20 hover:shadow-red-500/20 hover:border-red-500/40',
    orange: 'bg-orange-500/10 text-orange-600 border-orange-500/20 hover:shadow-orange-500/20 hover:border-orange-500/40',
    purple: 'bg-purple-500/10 text-purple-600 border-purple-500/20 hover:shadow-purple-500/20 hover:border-purple-500/40',
    indigo: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20 hover:shadow-indigo-500/20 hover:border-indigo-500/40',
    cyan: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20 hover:shadow-cyan-500/20 hover:border-cyan-500/40',
    emerald: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:shadow-emerald-500/20 hover:border-emerald-500/40',
    amber: 'bg-amber-500/10 text-amber-600 border-amber-500/20 hover:shadow-amber-500/20 hover:border-amber-500/40',
    rose: 'bg-rose-500/10 text-rose-600 border-rose-500/20 hover:shadow-rose-500/20 hover:border-rose-500/40',
    slate: 'bg-slate-500/10 text-slate-600 border-slate-500/20 hover:shadow-slate-500/20 hover:border-slate-500/40',
    lime: 'bg-lime-500/10 text-lime-600 border-lime-500/20 hover:shadow-lime-500/20 hover:border-lime-500/40',
    violet: 'bg-violet-500/10 text-violet-600 border-violet-500/20 hover:shadow-violet-500/20 hover:border-violet-500/40',
    fuchsia: 'bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/20 hover:shadow-fuchsia-500/20 hover:border-fuchsia-500/40',
};

const iconColorMap: Record<string, string> = {
    blue: 'text-blue-500',
    green: 'text-green-500',
    red: 'text-red-500',
    orange: 'text-orange-500',
    purple: 'text-purple-500',
    indigo: 'text-indigo-500',
    cyan: 'text-cyan-500',
    emerald: 'text-emerald-500',
    amber: 'text-amber-500',
    rose: 'text-rose-500',
    slate: 'text-slate-500',
    lime: 'text-lime-500',
    violet: 'text-violet-500',
    fuchsia: 'text-fuchsia-500',
};

const SmartMetricCard: React.FC<SmartMetricCardProps> = ({
    title,
    value,
    icon: Icon,
    trend,
    color,
    onClick,
    subtitle,
    aiInsight,
    loading = false,
    className,
    compact = false
}) => {
    return (
        <div
            onClick={onClick}
            className={`
                relative overflow-hidden rounded-xl border ${compact ? 'p-3' : 'p-5'}
                transition-all duration-300 hover:scale-[1.02] cursor-pointer
                backdrop-blur-md bg-white/40 dark:bg-black/20
                hover:shadow-md active:scale-95
                ${colorMap[color]}
                bg-gradient-to-br from-white/60 to-white/10 dark:from-white/5 dark:to-transparent
                shadow-sm
                group
                ${className || ''}
            `}
        >
            {/* Animated Shine Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[200%] group-hover:animate-shine z-0 pointer-events-none" />

            {/* Background Icon Decoration */}
            <div className={`absolute -right-4 -bottom-4 opacity-[0.08] transition-all duration-500 group-hover:rotate-12 group-hover:scale-125 ${iconColorMap[color]}`}>
                <Icon size={compact ? 80 : 120} />
            </div>

            <div className="relative z-10 flex flex-col justify-between h-full">
                {/* Header */}
                <div className={`flex justify-between items-start ${compact ? 'mb-2' : 'mb-4'}`}>
                    <div className={`
                        ${compact ? 'p-2 rounded-lg' : 'p-3 rounded-2xl'} 
                        bg-gradient-to-br from-white/80 to-white/20 dark:from-white/10 dark:to-transparent
                        backdrop-blur-xl border border-white/20 shadow-inner
                        ${iconColorMap[color]}
                    `}>
                        <Icon size={compact ? 18 : 24} strokeWidth={2.5} />
                    </div>

                    <div className="flex flex-col items-end gap-1">
                        {trend && (
                            <div className={`
                                flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border backdrop-blur-sm
                                ${trend.direction === 'up' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : ''}
                                ${trend.direction === 'down' ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' : ''}
                                ${trend.direction === 'neutral' ? 'bg-slate-500/10 text-slate-600 border-slate-500/20' : ''}
                            `}>
                                {trend.direction === 'up' && <TrendingUp size={10} />}
                                {trend.direction === 'down' && <TrendingDown size={10} />}
                                {trend.direction === 'neutral' && <Minus size={10} />}
                                {Math.abs(trend.value)}%
                            </div>
                        )}

                        {aiInsight && (
                            <div className="flex items-center gap-1.5 bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 px-2 py-0.5 rounded-full text-[10px] font-black animate-pulse shadow-sm shadow-indigo-500/10">
                                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" />
                                AI Insight
                            </div>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div>
                    <p className={`text-[${compact ? '9px' : '10px'}] font-bold uppercase tracking-[0.2em] text-muted-foreground/80 mb-0.5`}>
                        {title}
                    </p>
                    {loading ? (
                        <div className="h-8 w-24 bg-current/10 animate-pulse rounded-lg" />
                    ) : (
                        <h3 className={`${compact ? 'text-2xl' : 'text-3xl'} font-black tracking-tighter flex items-center gap-1 text-foreground drop-shadow-sm`}>
                            {typeof value === 'number'
                                ? `₹${value.toLocaleString('en-IN')}`
                                : safeRender(value)}
                        </h3>
                    )}

                    {!compact && aiInsight && safeRender(aiInsight) ? (
                        <div className="mt-3 p-2 rounded-xl bg-white/30 dark:bg-black/20 border border-white/40 dark:border-white/5 backdrop-blur-sm">
                            <p className="text-[10px] leading-relaxed font-bold italic text-indigo-600 dark:text-indigo-300">
                                "{safeRender(aiInsight)}"
                            </p>
                        </div>
                    ) : (
                        subtitle && (
                            <div className="flex items-center gap-1 mt-1">
                                <p className="text-[10px] font-bold opacity-70 truncate max-w-[150px]">
                                    {subtitle}
                                </p>
                            </div>
                        )
                    )}
                </div>

                {/* Decorative Gradient Line at Bottom */}
                <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-20 ${iconColorMap[color]}`} />
            </div>
        </div>
    );
};

export default SmartMetricCard;
