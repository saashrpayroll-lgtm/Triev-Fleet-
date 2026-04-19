/**
 * ─── Rider Rating Detail Modal ─────────────────────────────────
 *
 * Full-screen modal showing detailed star rating breakdown:
 *  - Overall star rating with score
 *  - Factor-by-factor breakdown with progress bars
 *  - Churn prediction with percentage gauge
 *  - Collection timeline (30-day sparkline)
 */

import React, { useEffect, useState } from 'react';
import { Star, X, TrendingDown, TrendingUp, Minus, AlertTriangle, Loader2, Sparkles, BarChart3 } from 'lucide-react';
import { Rider } from '@/types';
import { StarRatingResult, StarCount } from '@/utils/starRatingEngine';
import { RiderRatingService } from '@/services/RiderRatingService';

interface RiderRatingDetailModalProps {
    rider: Rider;
    initialRating?: StarRatingResult | null;
    isOpen: boolean;
    onClose: () => void;
}

const STAR_FILL: Record<StarCount, string> = {
    5: 'fill-emerald-400 text-emerald-400',
    4: 'fill-blue-400 text-blue-400',
    3: 'fill-amber-400 text-amber-400',
    2: 'fill-orange-400 text-orange-400',
    1: 'fill-red-400 text-red-400',
};

const FACTOR_BAR_COLORS: Record<string, string> = {
    'Wallet Status': 'bg-gradient-to-r from-violet-500 to-purple-500',
    'Collection Consistency': 'bg-gradient-to-r from-blue-500 to-cyan-500',
    'Recharge Flow': 'bg-gradient-to-r from-teal-500 to-emerald-500',
    '₹250+ Maintenance': 'bg-gradient-to-r from-amber-500 to-yellow-500',
    'Status Stability': 'bg-gradient-to-r from-rose-500 to-pink-500',
};

const CHURN_GAUGE_COLORS: Record<string, string> = {
    stable: 'text-emerald-500',
    moderate: 'text-amber-500',
    high: 'text-orange-500',
    likely_to_submit: 'text-red-500',
};

const RiderRatingDetailModal: React.FC<RiderRatingDetailModalProps> = ({
    rider,
    initialRating,
    isOpen,
    onClose,
}) => {
    const [rating, setRating] = useState<StarRatingResult | null>(initialRating || null);
    const [loading, setLoading] = useState(!initialRating);

    useEffect(() => {
        if (isOpen && !initialRating) {
            setLoading(true);
            RiderRatingService.fetchRatingForSingleRider(rider).then(result => {
                setRating(result);
                setLoading(false);
            });
        } else if (initialRating) {
            setRating(initialRating);
            setLoading(false);
        }
    }, [isOpen, rider, initialRating]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 bg-card/95 backdrop-blur-sm border-b border-border/50 px-6 py-4 flex items-center justify-between z-10 rounded-t-3xl">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Sparkles className="text-primary" size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-foreground">AI Rating</h2>
                            <p className="text-xs text-muted-foreground">{rider.riderName} • {rider.trievId}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <Loader2 className="animate-spin text-primary" size={36} />
                        <p className="text-sm text-muted-foreground font-medium">Analyzing rider data...</p>
                    </div>
                ) : rating ? (
                    <div className="px-6 py-5 space-y-6">

                        {/* ── Overall Rating Card ── */}
                        <div className={`relative rounded-2xl border p-5 text-center ${rating.bgColor} ${rating.borderColor}`}>
                            {rating.isNewRider && (
                                <span className="absolute top-3 right-3 text-[9px] font-black px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800 uppercase tracking-wider">
                                    New Rider
                                </span>
                            )}

                            <div className="flex items-center justify-center gap-1.5 mb-2">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <Star
                                        key={i}
                                        size={28}
                                        className={`transition-all duration-300 ${
                                            i <= rating.stars ? STAR_FILL[rating.stars] : 'text-muted-foreground/15'
                                        }`}
                                        strokeWidth={i <= rating.stars ? 0 : 1.5}
                                    />
                                ))}
                            </div>

                            <p className={`text-2xl font-black ${rating.color}`}>
                                {rating.totalScore}<span className="text-sm font-bold text-muted-foreground">/100</span>
                            </p>
                            <p className={`text-sm font-bold ${rating.color}`}>{rating.label}</p>
                        </div>

                        {/* ── Factor Breakdown ── */}
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <BarChart3 size={16} className="text-primary" />
                                <h3 className="text-sm font-black text-foreground">Rating Breakdown</h3>
                            </div>

                            <div className="space-y-3">
                                {rating.factors.map((factor) => (
                                    <div key={factor.name} className="group">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                                <span>{factor.icon}</span>
                                                {factor.name}
                                            </span>
                                            <span className="text-[10px] font-black text-muted-foreground">
                                                {factor.score}/{factor.weight}
                                            </span>
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-700 ease-out ${
                                                    FACTOR_BAR_COLORS[factor.name] || 'bg-primary'
                                                }`}
                                                style={{ width: `${factor.percentage}%` }}
                                            />
                                        </div>

                                        <p className="text-[10px] text-muted-foreground mt-0.5">
                                            {factor.detail}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* ── Churn Prediction ── */}
                        <div className={`rounded-2xl border p-4 ${
                            rating.churn.level === 'likely_to_submit' ? 'border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20'
                            : rating.churn.level === 'high' ? 'border-orange-300 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20'
                            : rating.churn.level === 'moderate' ? 'border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20'
                            : 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20'
                        }`}>
                            <div className="flex items-center gap-2 mb-3">
                                {rating.churn.level === 'likely_to_submit' ? <AlertTriangle size={16} className="text-red-500" />
                                    : rating.churn.level === 'high' ? <TrendingDown size={16} className="text-orange-500" />
                                    : rating.churn.level === 'moderate' ? <Minus size={16} className="text-amber-500" />
                                    : <TrendingUp size={16} className="text-emerald-500" />}
                                <h3 className="text-sm font-black text-foreground">Churn Prediction</h3>
                            </div>

                            {/* Circular Gauge */}
                            <div className="flex items-center gap-5">
                                <div className="relative w-20 h-20 flex-shrink-0">
                                    <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                                        <circle
                                            cx="18" cy="18" r="15.9"
                                            fill="none"
                                            strokeWidth="3"
                                            className="stroke-muted/30"
                                        />
                                        <circle
                                            cx="18" cy="18" r="15.9"
                                            fill="none"
                                            strokeWidth="3"
                                            strokeDasharray={`${rating.churn.percentage} ${100 - rating.churn.percentage}`}
                                            strokeLinecap="round"
                                            className={`transition-all duration-1000 ease-out ${
                                                CHURN_GAUGE_COLORS[rating.churn.level]?.replace('text-', 'stroke-') || 'stroke-primary'
                                            }`}
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className={`text-lg font-black ${CHURN_GAUGE_COLORS[rating.churn.level]}`}>
                                            {rating.churn.percentage}%
                                        </span>
                                    </div>
                                </div>

                                <div className="flex-1">
                                    <p className={`text-sm font-black ${rating.churn.color}`}>
                                        {rating.churn.label}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {rating.churn.reasoning}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* ── Footer ── */}
                        <div className="text-center pt-2 border-t border-border/50">
                            <p className="text-[9px] text-muted-foreground/50">
                                AI Score computed at {new Date(rating.computedAt).toLocaleString('en-IN')} • Last 30 days data
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-16 px-6">
                        <p className="text-muted-foreground">Could not compute rating for this rider.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RiderRatingDetailModal;
