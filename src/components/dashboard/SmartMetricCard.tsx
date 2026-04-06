

import React, { useEffect, useRef } from 'react';
import { LucideIcon, TrendingUp, TrendingDown, Minus, Sparkles } from 'lucide-react';
import { motion, animate } from 'framer-motion';
import { safeRender } from '@/utils/safeRender';
import Sparkline from '@/components/ui/Sparkline';

const AnimatedCounter = ({ value, isCurrency = false }: { value: number; isCurrency?: boolean }) => {
    const nodeRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        const node = nodeRef.current;
        if (!node) return;

        const controls = animate(0, value, {
            duration: 1.5,
            ease: "easeOut",
            onUpdate(current) {
                if (isCurrency) {
                    node.textContent = `₹${Math.round(current).toLocaleString('en-IN')}`;
                } else {
                    node.textContent = Math.round(current).toLocaleString('en-IN');
                }
            }
        });

        return () => controls.stop();
    }, [value, isCurrency]);

    return <span ref={nodeRef}>{isCurrency ? '₹0' : '0'}</span>;
};


interface SmartMetricCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    trend?: {
        value: number;
        label: string;
        direction: 'up' | 'down' | 'neutral';
    };
    color: 'blue' | 'green' | 'red' | 'orange' | 'purple' | 'indigo' | 'cyan' | 'emerald' | 'amber' | 'rose' | 'slate' | 'lime' | 'violet' | 'fuchsia';
    onClick?: () => void;
    subtitle?: string;
    aiInsight?: string;
    loading?: boolean;
    className?: string;
    progress?: number;
    isCurrency?: boolean;
    sparklineData?: number[];
    sparklineColor?: string;
}

// Per-color design tokens
const colorTokens: Record<string, {
    card: string;
    icon: string;
    iconBg: string;
    glow: string;
    bar: string;
    badge: string;
    text: string;
    dot: string;
    ring: string;
}> = {
    blue: { card: 'from-blue-500/15 via-blue-500/5 to-transparent border-blue-400/20', icon: 'text-blue-500', iconBg: 'bg-blue-500/10 ring-blue-500/20', glow: 'hover:shadow-blue-500/25', bar: 'from-blue-400 to-blue-600', badge: 'bg-blue-500/10 text-blue-500 border-blue-500/20', text: 'text-blue-500', dot: 'bg-blue-500', ring: 'group-hover:ring-blue-500/30' },
    green: { card: 'from-green-500/15 via-green-500/5 to-transparent border-green-400/20', icon: 'text-green-500', iconBg: 'bg-green-500/10 ring-green-500/20', glow: 'hover:shadow-green-500/25', bar: 'from-green-400 to-green-600', badge: 'bg-green-500/10 text-green-500 border-green-500/20', text: 'text-green-500', dot: 'bg-green-500', ring: 'group-hover:ring-green-500/30' },
    red: { card: 'from-red-500/15 via-red-500/5 to-transparent border-red-400/20', icon: 'text-red-500', iconBg: 'bg-red-500/10 ring-red-500/20', glow: 'hover:shadow-red-500/25', bar: 'from-red-400 to-red-600', badge: 'bg-red-500/10 text-red-500 border-red-500/20', text: 'text-red-500', dot: 'bg-red-500', ring: 'group-hover:ring-red-500/30' },
    orange: { card: 'from-orange-500/15 via-orange-500/5 to-transparent border-orange-400/20', icon: 'text-orange-500', iconBg: 'bg-orange-500/10 ring-orange-500/20', glow: 'hover:shadow-orange-500/25', bar: 'from-orange-400 to-orange-600', badge: 'bg-orange-500/10 text-orange-500 border-orange-500/20', text: 'text-orange-500', dot: 'bg-orange-500', ring: 'group-hover:ring-orange-500/30' },
    purple: { card: 'from-purple-500/15 via-purple-500/5 to-transparent border-purple-400/20', icon: 'text-purple-500', iconBg: 'bg-purple-500/10 ring-purple-500/20', glow: 'hover:shadow-purple-500/25', bar: 'from-purple-400 to-purple-600', badge: 'bg-purple-500/10 text-purple-500 border-purple-500/20', text: 'text-purple-500', dot: 'bg-purple-500', ring: 'group-hover:ring-purple-500/30' },
    indigo: { card: 'from-indigo-500/15 via-indigo-500/5 to-transparent border-indigo-400/20', icon: 'text-indigo-500', iconBg: 'bg-indigo-500/10 ring-indigo-500/20', glow: 'hover:shadow-indigo-500/25', bar: 'from-indigo-400 to-indigo-600', badge: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20', text: 'text-indigo-500', dot: 'bg-indigo-500', ring: 'group-hover:ring-indigo-500/30' },
    cyan: { card: 'from-cyan-500/15 via-cyan-500/5 to-transparent border-cyan-400/20', icon: 'text-cyan-500', iconBg: 'bg-cyan-500/10 ring-cyan-500/20', glow: 'hover:shadow-cyan-500/25', bar: 'from-cyan-400 to-cyan-600', badge: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20', text: 'text-cyan-500', dot: 'bg-cyan-500', ring: 'group-hover:ring-cyan-500/30' },
    emerald: { card: 'from-emerald-500/15 via-emerald-500/5 to-transparent border-emerald-400/20', icon: 'text-emerald-500', iconBg: 'bg-emerald-500/10 ring-emerald-500/20', glow: 'hover:shadow-emerald-500/25', bar: 'from-emerald-400 to-emerald-600', badge: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', text: 'text-emerald-500', dot: 'bg-emerald-500', ring: 'group-hover:ring-emerald-500/30' },
    amber: { card: 'from-amber-500/15 via-amber-500/5 to-transparent border-amber-400/20', icon: 'text-amber-500', iconBg: 'bg-amber-500/10 ring-amber-500/20', glow: 'hover:shadow-amber-500/25', bar: 'from-amber-400 to-amber-600', badge: 'bg-amber-500/10 text-amber-500 border-amber-500/20', text: 'text-amber-500', dot: 'bg-amber-500', ring: 'group-hover:ring-amber-500/30' },
    rose: { card: 'from-rose-500/15 via-rose-500/5 to-transparent border-rose-400/20', icon: 'text-rose-500', iconBg: 'bg-rose-500/10 ring-rose-500/20', glow: 'hover:shadow-rose-500/25', bar: 'from-rose-400 to-rose-600', badge: 'bg-rose-500/10 text-rose-500 border-rose-500/20', text: 'text-rose-500', dot: 'bg-rose-500', ring: 'group-hover:ring-rose-500/30' },
    slate: { card: 'from-slate-500/15 via-slate-500/5 to-transparent border-slate-400/20', icon: 'text-slate-500', iconBg: 'bg-slate-500/10 ring-slate-500/20', glow: 'hover:shadow-slate-500/25', bar: 'from-slate-400 to-slate-600', badge: 'bg-slate-500/10 text-slate-500 border-slate-500/20', text: 'text-slate-500', dot: 'bg-slate-500', ring: 'group-hover:ring-slate-500/30' },
    lime: { card: 'from-lime-500/15 via-lime-500/5 to-transparent border-lime-400/20', icon: 'text-lime-500', iconBg: 'bg-lime-500/10 ring-lime-500/20', glow: 'hover:shadow-lime-500/25', bar: 'from-lime-400 to-lime-600', badge: 'bg-lime-500/10 text-lime-500 border-lime-500/20', text: 'text-lime-500', dot: 'bg-lime-500', ring: 'group-hover:ring-lime-500/30' },
    violet: { card: 'from-violet-500/15 via-violet-500/5 to-transparent border-violet-400/20', icon: 'text-violet-500', iconBg: 'bg-violet-500/10 ring-violet-500/20', glow: 'hover:shadow-violet-500/25', bar: 'from-violet-400 to-violet-600', badge: 'bg-violet-500/10 text-violet-500 border-violet-500/20', text: 'text-violet-500', dot: 'bg-violet-500', ring: 'group-hover:ring-violet-500/30' },
    fuchsia: { card: 'from-fuchsia-500/15 via-fuchsia-500/5 to-transparent border-fuchsia-400/20', icon: 'text-fuchsia-500', iconBg: 'bg-fuchsia-500/10 ring-fuchsia-500/20', glow: 'hover:shadow-fuchsia-500/25', bar: 'from-fuchsia-400 to-fuchsia-600', badge: 'bg-fuchsia-500/10 text-fuchsia-500 border-fuchsia-500/20', text: 'text-fuchsia-500', dot: 'bg-fuchsia-500', ring: 'group-hover:ring-fuchsia-500/30' },
};

/** Animated progress bar (replaces the SVG circle for cleaner mobile look) */
const ProgressBar = ({ value, barClass }: { value: number; barClass: string }) => (
    <div className="mt-2.5">
        <div className="flex justify-between items-center mb-1">
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Progress</span>
            <span className="text-[10px] font-black tabular-nums">{Math.round(value)}%</span>
        </div>
        <div className="w-full h-1.5 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
            <motion.div
                className={`h-full rounded-full bg-gradient-to-r ${barClass}`}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(value, 100)}%` }}
                transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
            />
        </div>
    </div>
);

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
    progress,
    isCurrency = true,
    sparklineData,
    sparklineColor,
}) => {
    const t = colorTokens[color] || colorTokens.indigo;

    const displayValue = typeof value === 'number'
        ? (isCurrency ? `₹${value.toLocaleString('en-IN')}` : value.toLocaleString('en-IN'))
        : safeRender(value);

    return (
        <motion.div
            onClick={onClick}
            whileHover={{ y: -6, scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className={`
                relative overflow-hidden rounded-3xl border p-4 sm:p-5
                cursor-pointer group
                bg-gradient-to-br ${t.card}
                bg-white/50 dark:bg-slate-950/40 backdrop-blur-xl border-white/20 dark:border-white/10
                shadow-lg hover:shadow-2xl ${t.glow}
                ring-1 ring-white/20 dark:ring-white/5 hover:ring-2 ${t.ring}
                transition-all duration-300
                ${className || ''}
            `}
        >
            {/* Soft inner glow */}
            <div className={`absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none rounded-3xl`} />

            {/* Shine sweep on hover */}
            <div className="pointer-events-none absolute inset-0 translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-1000 ease-in-out bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 z-10" />

            {/* Ghost icon watermark */}
            <div className={`absolute -right-5 -bottom-5 opacity-[0.07] group-hover:opacity-[0.12] group-hover:rotate-12 group-hover:scale-110 transition-all duration-500 ${t.icon}`}>
                <Icon size={96} />
            </div>

            <div className="relative z-10 flex flex-col gap-2.5">

                {/* ── TOP ROW: Icon + Badges ── */}
                <div className="flex items-start justify-between">
                    <motion.div
                        whileHover={{ rotate: [0, -8, 8, 0] }}
                        transition={{ duration: 0.4 }}
                        className={`
                            p-2 sm:p-2.5 rounded-xl
                            ${t.iconBg} ring-1
                            ${t.icon}
                            group-hover:scale-110 transition-transform duration-300
                        `}
                    >
                        <Icon size={18} strokeWidth={2.5} />
                    </motion.div>

                    <div className="flex flex-col items-end gap-1.5">
                        {trend && (
                            <div className={`
                                flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full border
                                ${trend.direction === 'up' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25 dark:text-emerald-400' : ''}
                                ${trend.direction === 'down' ? 'bg-rose-500/10 text-rose-600 border-rose-500/25 dark:text-rose-400' : ''}
                                ${trend.direction === 'neutral' ? 'bg-slate-500/10 text-slate-500 border-slate-500/25' : ''}
                            `}>
                                {trend.direction === 'up' && <TrendingUp size={9} />}
                                {trend.direction === 'down' && <TrendingDown size={9} />}
                                {trend.direction === 'neutral' && <Minus size={9} />}
                                <span className="tabular-nums">{Math.abs(trend.value)}%</span>
                            </div>
                        )}
                        {aiInsight && (
                            <div className="flex items-center gap-1 bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 px-2 py-0.5 rounded-full text-[8px] font-black animate-pulse">
                                <Sparkles size={8} />
                                AI
                            </div>
                        )}
                    </div>
                </div>

                {/* ── VALUE ── */}
                <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground/70 mb-0.5 truncate">
                        {title}
                    </p>
                    {loading ? (
                        <div className="h-7 w-28 bg-current/10 animate-pulse rounded-lg" />
                    ) : (
                        <motion.p
                            key={String(value)}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                            className="text-3xl sm:text-[1.8rem] font-black tracking-tight text-slate-900 dark:text-white tabular-nums leading-none drop-shadow-sm"
                        >
                            {typeof value === 'number' ? (
                                <AnimatedCounter value={value} isCurrency={isCurrency} />
                            ) : (
                                displayValue
                            )}
                        </motion.p>
                    )}
                </div>

                {/* ── SUBTITLE / AI INSIGHT ── */}
                {aiInsight && safeRender(aiInsight) ? (
                    <div className="bg-indigo-500/5 border border-indigo-500/15 rounded-xl p-2">
                        <p className="text-[10px] leading-relaxed font-semibold italic text-indigo-600 dark:text-indigo-400 line-clamp-2">
                            "{safeRender(aiInsight)}"
                        </p>
                    </div>
                ) : subtitle ? (
                    <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${t.dot} opacity-70`} />
                        <p className="text-[10px] font-semibold text-muted-foreground truncate leading-tight">
                            {subtitle}
                        </p>
                    </div>
                ) : null}

                {/* ── SPARKLINE ── */}
                {sparklineData && sparklineData.length >= 2 && (
                    <div className="mt-1">
                        <Sparkline
                            data={sparklineData}
                            color={sparklineColor || (t.dot.replace('bg-', ''))}
                            width={80}
                            height={24}
                        />
                    </div>
                )}

                {/* ── PROGRESS BAR ── */}
                {progress !== undefined && (
                    <ProgressBar value={progress} barClass={t.bar} />
                )}

                {/* Trend label below progress */}
                {trend && progress === undefined && (
                    <p className="text-[8px] font-semibold text-muted-foreground/60 tracking-wider uppercase">
                        {trend.label}
                    </p>
                )}
            </div>

            {/* Bottom accent line */}
            <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r ${t.bar} opacity-40 group-hover:opacity-70 transition-opacity duration-300`} />
        </motion.div>
    );
};

export default React.memo(SmartMetricCard);
