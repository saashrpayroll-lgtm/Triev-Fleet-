/**
 * ─── StarRating Component ──────────────────────────────────────
 *
 * Displays a 1-5 star rating with:
 *  - Filled/unfilled stars with gradient colors
 *  - Color-coded by rating quality
 *  - Hover tooltip with score + label
 *  - Animated pulse on 1★ (critical)
 *  - Compact (sm) and expanded (md) sizes
 *  - Click handler to open detailed modal
 */

import React, { useState } from 'react';
import { Star, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { StarRatingResult, StarCount } from '@/utils/starRatingEngine';

interface StarRatingProps {
    rating: StarRatingResult | null;
    size?: 'sm' | 'md' | 'lg';
    showLabel?: boolean;
    showScore?: boolean;
    showChurn?: boolean;
    onClick?: () => void;
    className?: string;
}


const STAR_FILL_COLORS: Record<StarCount, string> = {
    5: 'fill-emerald-400 text-emerald-400',
    4: 'fill-blue-400 text-blue-400',
    3: 'fill-amber-400 text-amber-400',
    2: 'fill-orange-400 text-orange-400',
    1: 'fill-red-400 text-red-400',
};

const UNFILLED_COLOR = 'text-muted-foreground/20';

const SIZES = {
    sm: { starSize: 12, gap: 'gap-0', labelText: 'text-[9px]', scoreText: 'text-[8px]' },
    md: { starSize: 16, gap: 'gap-0.5', labelText: 'text-xs', scoreText: 'text-[10px]' },
    lg: { starSize: 22, gap: 'gap-1', labelText: 'text-sm', scoreText: 'text-xs' },
};

const StarRating: React.FC<StarRatingProps> = ({
    rating,
    size = 'sm',
    showLabel = false,
    showScore = false,
    showChurn = false,
    onClick,
    className = '',
}) => {
    const [isHovered, setIsHovered] = useState(false);

    if (!rating) {
        return (
            <span className="text-muted-foreground/40 text-[10px] italic">—</span>
        );
    }

    const { stars, label, totalScore, churn, isNewRider, color } = rating;
    const sizeConfig = SIZES[size];
    const isCritical = stars === 1;

    const ChurnIcon = churn.level === 'stable' ? TrendingUp
        : churn.level === 'moderate' ? Minus
        : TrendingDown;

    return (
        <div
            className={`inline-flex items-center ${sizeConfig.gap} relative group cursor-pointer ${isCritical ? 'animate-pulse' : ''} ${className}`}
            onClick={onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            role="button"
            tabIndex={0}
            title={`${stars}★ ${label} (${totalScore}/100)`}
        >
            {/* Stars */}
            <div className={`flex items-center ${sizeConfig.gap}`}>
                {[1, 2, 3, 4, 5].map((i) => (
                    <Star
                        key={i}
                        size={sizeConfig.starSize}
                        className={`transition-all duration-200 ${
                            i <= stars
                                ? STAR_FILL_COLORS[stars]
                                : UNFILLED_COLOR
                        } ${onClick ? 'group-hover:scale-110' : ''}`}
                        strokeWidth={i <= stars ? 0 : 1.5}
                    />
                ))}
            </div>

            {/* Optional Labels */}
            {showLabel && (
                <span className={`${sizeConfig.labelText} font-bold ml-1.5 ${color} whitespace-nowrap`}>
                    {isNewRider ? 'New' : label}
                </span>
            )}

            {showScore && (
                <span className={`${sizeConfig.scoreText} font-bold ml-1 text-muted-foreground/50`}>
                    {totalScore}
                </span>
            )}

            {showChurn && churn.level !== 'stable' && (
                <span className={`inline-flex items-center gap-0.5 ml-1.5 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${
                    churn.level === 'likely_to_submit'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : churn.level === 'high'
                        ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                }`}>
                    <ChurnIcon size={8} />
                    {churn.percentage}%
                </span>
            )}

            {/* Hover Tooltip */}
            {isHovered && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
                    <div className="bg-popover text-popover-foreground border border-border rounded-xl shadow-xl px-3 py-2 min-w-[160px] text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <Star key={i} size={14}
                                    className={i <= stars ? STAR_FILL_COLORS[stars] : UNFILLED_COLOR}
                                    strokeWidth={i <= stars ? 0 : 1.5}
                                />
                            ))}
                        </div>
                        <p className={`text-xs font-black ${color}`}>
                            {isNewRider ? 'New Rider' : label}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-medium">
                            Score: {totalScore}/100
                        </p>
                        {churn.level !== 'stable' && (
                            <p className={`text-[9px] font-bold mt-1 ${churn.color}`}>
                                ⚠ {churn.label} ({churn.percentage}%)
                            </p>
                        )}
                        <p className="text-[8px] text-muted-foreground/50 mt-1">
                            Click for details
                        </p>
                        {/* Arrow */}
                        <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 rotate-45 bg-popover border-r border-b border-border" />
                    </div>
                </div>
            )}
        </div>
    );
};

export default StarRating;
