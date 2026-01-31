
import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
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
    color: 'blue' | 'green' | 'red' | 'orange' | 'purple' | 'indigo' | 'cyan' | 'emerald' | 'amber' | 'rose' | 'slate' | 'lime';
    onClick?: () => void;
    subtitle?: string;
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
};

const SmartMetricCard: React.FC<SmartMetricCardProps> = ({
    title,
    value,
    icon: Icon,
    trend,
    color,
    onClick,
    subtitle,
    loading = false,
    className
}) => {
    return (
        <div
            onClick={onClick}
            className={`
                relative overflow-hidden rounded-2xl border p-5 
                transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 cursor-pointer
                backdrop-blur-md bg-white/40 dark:bg-black/20
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
            <div className={`absolute -right-6 -bottom-6 opacity-[0.08] transition-all duration-500 group-hover:rotate-12 group-hover:scale-125 ${iconColorMap[color]}`}>
                <Icon size={120} />
            </div>

            <div className="relative z-10 flex flex-col justify-between h-full">
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                    <div className={`
                        p-3 rounded-2xl bg-gradient-to-br from-white/80 to-white/20 dark:from-white/10 dark:to-transparent
                        backdrop-blur-xl border border-white/20 shadow-inner
                        ${iconColorMap[color]}
                    `}>
                        <Icon size={24} strokeWidth={2.5} />
                    </div>

                    {trend && (
                        <div className={`
                            flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border backdrop-blur-sm
                            ${trend.direction === 'up' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : ''}
                            ${trend.direction === 'down' ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' : ''}
                            ${trend.direction === 'neutral' ? 'bg-slate-500/10 text-slate-600 border-slate-500/20' : ''}
                        `}>
                            {trend.direction === 'up' && <TrendingUp size={14} />}
                            {trend.direction === 'down' && <TrendingDown size={14} />}
                            {trend.direction === 'neutral' && <Minus size={14} />}
                            {Math.abs(trend.value)}%
                        </div>
                    )}
                </div>

                {/* Content */}
                <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/80 mb-1">
                        {title}
                    </p>
                    {loading ? (
                        <div className="h-10 w-32 bg-current/10 animate-pulse rounded-lg" />
                    ) : (
                        <h3 className="text-3xl font-black tracking-tight flex items-baseline gap-1 text-foreground drop-shadow-sm">
                            {value}
                        </h3>
                    )}

                    {subtitle && (
                        <div className="flex items-center gap-1 mt-2">
                            <div className={`w-1 h-1 rounded-full ${trend?.direction === 'up' ? 'bg-green-500' : 'bg-amber-500'}`} />
                            <p className="text-xs font-medium opacity-70 truncate max-w-[180px]">
                                {subtitle}
                            </p>
                        </div>
                    )}
                </div>

                {/* Decorative Gradient Line at Bottom */}
                <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-20 ${iconColorMap[color]}`} />
            </div>
        </div>
    );
};

export default SmartMetricCard;
