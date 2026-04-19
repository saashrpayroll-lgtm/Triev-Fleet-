/**
 * ─── Churn Prediction Badge ────────────────────────────────────
 *
 * Compact inline badge showing churn risk level and percentage.
 * Color-coded: 🔴 Likely to Submit | 🟠 High Risk | 🟡 Moderate | 🟢 Stable
 */

import React from 'react';
import { TrendingDown, TrendingUp, Minus, AlertTriangle } from 'lucide-react';
import { ChurnPrediction } from '@/utils/starRatingEngine';

interface ChurnPredictionBadgeProps {
    churn: ChurnPrediction | null;
    size?: 'sm' | 'md';
    showPercentage?: boolean;
    className?: string;
}

const BADGE_STYLES: Record<string, { bg: string; text: string; border: string; icon: React.ReactNode }> = {
    likely_to_submit: {
        bg: 'bg-red-100 dark:bg-red-900/30',
        text: 'text-red-700 dark:text-red-400',
        border: 'border-red-200 dark:border-red-800',
        icon: <AlertTriangle size={10} />,
    },
    high: {
        bg: 'bg-orange-100 dark:bg-orange-900/30',
        text: 'text-orange-700 dark:text-orange-400',
        border: 'border-orange-200 dark:border-orange-800',
        icon: <TrendingDown size={10} />,
    },
    moderate: {
        bg: 'bg-amber-100 dark:bg-amber-900/30',
        text: 'text-amber-700 dark:text-amber-400',
        border: 'border-amber-200 dark:border-amber-800',
        icon: <Minus size={10} />,
    },
    stable: {
        bg: 'bg-emerald-100 dark:bg-emerald-900/30',
        text: 'text-emerald-700 dark:text-emerald-400',
        border: 'border-emerald-200 dark:border-emerald-800',
        icon: <TrendingUp size={10} />,
    },
};

const ChurnPredictionBadge: React.FC<ChurnPredictionBadgeProps> = ({
    churn,
    size = 'sm',
    showPercentage = true,
    className = '',
}) => {
    if (!churn) return null;

    const style = BADGE_STYLES[churn.level] || BADGE_STYLES.stable;
    const isSm = size === 'sm';

    return (
        <span
            className={`inline-flex items-center gap-1 font-bold border whitespace-nowrap ${
                isSm
                    ? 'px-1.5 py-0.5 rounded-md text-[8px]'
                    : 'px-2 py-1 rounded-lg text-[10px]'
            } ${style.bg} ${style.text} ${style.border} ${
                churn.level === 'likely_to_submit' ? 'animate-pulse' : ''
            } ${className}`}
            title={churn.reasoning}
        >
            {style.icon}
            <span className="uppercase tracking-wider">
                {churn.label}
            </span>
            {showPercentage && (
                <span className="opacity-75">
                    {churn.percentage}%
                </span>
            )}
        </span>
    );
};

export default ChurnPredictionBadge;
