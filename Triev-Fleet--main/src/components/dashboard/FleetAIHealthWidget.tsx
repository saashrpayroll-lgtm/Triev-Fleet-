/**
 * Fleet AI Health Widget — Dashboard component showing star rating distribution
 * and churn risk summary for a fleet of riders.
 */
import React, { useEffect, useState } from 'react';
import { Rider } from '@/types';
import { RiderRatingService } from '@/services/RiderRatingService';
import { StarRatingResult, StarCount } from '@/utils/starRatingEngine';
import { Star, AlertTriangle, TrendingUp, ShieldCheck, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface FleetAIHealthWidgetProps {
    riders: Rider[];
    title?: string;
    compact?: boolean;
}

const STAR_CONFIG: Record<StarCount, { label: string; color: string; bg: string; border: string }> = {
    5: { label: 'Excellent', color: 'text-emerald-500', bg: 'bg-emerald-500', border: 'border-emerald-400' },
    4: { label: 'Good', color: 'text-blue-500', bg: 'bg-blue-500', border: 'border-blue-400' },
    3: { label: 'Average', color: 'text-amber-500', bg: 'bg-amber-500', border: 'border-amber-400' },
    2: { label: 'At Risk', color: 'text-orange-500', bg: 'bg-orange-500', border: 'border-orange-400' },
    1: { label: 'Critical', color: 'text-red-500', bg: 'bg-red-500', border: 'border-red-400' },
};

const FleetAIHealthWidget: React.FC<FleetAIHealthWidgetProps> = ({ riders, title = 'Fleet AI Health' }) => {
    const [ratings, setRatings] = useState<Map<string, StarRatingResult>>(new Map());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!riders.length) { setLoading(false); return; }
        const activeRiders = riders.filter(r => r.status === 'active');
        if (!activeRiders.length) { setLoading(false); return; }

        // ✅ EGRESS OPTIMIZED: Calculate fleet health distribution instantly in memory
        // using getQuickRating (based on wallet status, tenure, & balance thresholds).
        // This eliminates 20+ parallel chunked wallet_ledger DB queries for 1000+ riders.
        const quickMap = new Map<string, StarRatingResult>();
        for (const r of activeRiders) {
            quickMap.set(r.id, RiderRatingService.getQuickRating(r));
        }
        setRatings(quickMap);
        setLoading(false);
    }, [riders]);

    const ratingValues = Array.from(ratings.values());
    const total = ratingValues.length;

    // Distribution
    const distribution: Record<StarCount, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let churnHighCount = 0;
    let churnLikelyCount = 0;
    let avgScore = 0;

    for (const r of ratingValues) {
        distribution[r.stars]++;
        avgScore += r.totalScore;
        if (r.churn.level === 'high') churnHighCount++;
        if (r.churn.level === 'likely_to_submit') churnLikelyCount++;
    }
    avgScore = total > 0 ? Math.round(avgScore / total) : 0;

    const avgStars = total > 0 ? (ratingValues.reduce((s, r) => s + r.stars, 0) / total) : 0;

    if (loading) {
        return (
            <div className="bg-card border border-border/40 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-violet-500/10 rounded-lg"><Star size={14} className="text-violet-500" /></div>
                    <h3 className="font-black text-sm text-foreground/90">{title}</h3>
                </div>
                <div className="flex items-center justify-center py-8">
                    <Loader2 size={20} className="animate-spin text-muted-foreground" />
                    <span className="ml-2 text-xs text-muted-foreground">Computing AI ratings...</span>
                </div>
            </div>
        );
    }

    if (total === 0) {
        return (
            <div className="bg-card border border-border/40 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-violet-500/10 rounded-lg"><Star size={14} className="text-violet-500" /></div>
                    <h3 className="font-black text-sm text-foreground/90">{title}</h3>
                </div>
                <p className="text-xs text-muted-foreground text-center py-4">No active riders to analyze</p>
            </div>
        );
    }

    const healthScore = Math.round(((distribution[4] + distribution[5]) / total) * 100);

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border/40 rounded-2xl p-4 shadow-sm"
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-violet-500/10 rounded-lg"><Star size={14} className="text-violet-500" /></div>
                    <h3 className="font-black text-sm text-foreground/90">{title}</h3>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-violet-500/10 rounded-full">
                    <ShieldCheck size={12} className="text-violet-500" />
                    <span className="text-[10px] font-black text-violet-600 dark:text-violet-400">{healthScore}% Healthy</span>
                </div>
            </div>

            {/* Score Summary */}
            <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-background/50 border border-border/30 rounded-xl p-2.5 text-center">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Avg Score</p>
                    <p className="text-lg font-black text-foreground">{avgScore}<span className="text-xs text-muted-foreground">/100</span></p>
                </div>
                <div className="bg-background/50 border border-border/30 rounded-xl p-2.5 text-center">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Avg Stars</p>
                    <div className="flex items-center justify-center gap-0.5">
                        <p className="text-lg font-black text-amber-500">{avgStars.toFixed(1)}</p>
                        <Star size={14} className="fill-amber-400 text-amber-400" />
                    </div>
                </div>
                <div className="bg-background/50 border border-border/30 rounded-xl p-2.5 text-center">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Analyzed</p>
                    <p className="text-lg font-black text-foreground">{total}</p>
                </div>
            </div>

            {/* Star Distribution Bars */}
            <div className="space-y-1.5 mb-4">
                {([5, 4, 3, 2, 1] as StarCount[]).map(star => {
                    const count = distribution[star];
                    const pct = total > 0 ? (count / total) * 100 : 0;
                    const cfg = STAR_CONFIG[star];
                    return (
                        <div key={star} className="flex items-center gap-2">
                            <div className="flex items-center gap-0.5 w-14 justify-end">
                                <span className="text-[10px] font-bold text-muted-foreground">{star}</span>
                                <Star size={10} className={`fill-current ${cfg.color}`} />
                            </div>
                            <div className="flex-1 h-4 bg-muted/30 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${pct}%` }}
                                    transition={{ delay: (5 - star) * 0.1, duration: 0.5 }}
                                    className={`h-full ${cfg.bg} rounded-full`}
                                />
                            </div>
                            <span className="text-[10px] font-black text-muted-foreground w-10 text-right tabular-nums">
                                {count} <span className="text-muted-foreground/50">({Math.round(pct)}%)</span>
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Churn Alerts */}
            {(churnHighCount > 0 || churnLikelyCount > 0) && (
                <div className="flex items-center gap-2 p-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-xl">
                    <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                    <div className="flex-1">
                        <p className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-wider">Churn Alert</p>
                        <p className="text-[11px] text-red-700 dark:text-red-300">
                            {churnLikelyCount > 0 && <span className="font-bold">{churnLikelyCount} likely to submit</span>}
                            {churnLikelyCount > 0 && churnHighCount > 0 && ' · '}
                            {churnHighCount > 0 && <span>{churnHighCount} high risk</span>}
                        </p>
                    </div>
                    <div className="px-2 py-0.5 bg-red-500 text-white rounded-full text-[9px] font-black">
                        {churnLikelyCount + churnHighCount}
                    </div>
                </div>
            )}

            {/* All stable */}
            {churnHighCount === 0 && churnLikelyCount === 0 && (
                <div className="flex items-center gap-2 p-2.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 rounded-xl">
                    <TrendingUp size={14} className="text-emerald-500 flex-shrink-0" />
                    <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Fleet is healthy — no high-risk churn detected</p>
                </div>
            )}
        </motion.div>
    );
};

export default FleetAIHealthWidget;
