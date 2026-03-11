import React from 'react';

interface SkeletonProps {
    className?: string;
}

/** Base shimmer skeleton block */
export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => (
    <div
        className={`animate-pulse rounded-xl bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-800 dark:via-slate-700 dark:to-slate-800 bg-[length:200%_100%] ${className}`}
        style={{ animationDuration: '1.5s' }}
    />
);

/** Skeleton for stat cards: icon + title + value */
export const SkeletonCard: React.FC<SkeletonProps> = ({ className = '' }) => (
    <div className={`p-4 rounded-2xl border border-border/40 bg-card/50 space-y-3 ${className}`}>
        <div className="flex items-center gap-2">
            <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
            <Skeleton className="h-3 w-20 rounded" />
        </div>
        <Skeleton className="h-7 w-24 rounded-lg" />
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-2.5 w-16 rounded" />
    </div>
);

/** Skeleton for table rows */
export const SkeletonTable: React.FC<{ rows?: number; cols?: number } & SkeletonProps> = ({
    rows = 5,
    cols = 5,
    className = '',
}) => (
    <div className={`space-y-2 ${className}`}>
        {/* Header */}
        <div className="flex gap-3 px-4 py-3">
            {Array.from({ length: cols }).map((_, i) => (
                <Skeleton key={`h-${i}`} className="h-3 flex-1 rounded" />
            ))}
        </div>
        {/* Rows */}
        {Array.from({ length: rows }).map((_, rowIdx) => (
            <div
                key={`r-${rowIdx}`}
                className="flex gap-3 px-4 py-3 border-t border-border/20"
                style={{ opacity: 1 - rowIdx * 0.12 }}
            >
                {Array.from({ length: cols }).map((_, colIdx) => (
                    <Skeleton
                        key={`c-${rowIdx}-${colIdx}`}
                        className={`h-4 rounded ${colIdx === 0 ? 'w-10' : 'flex-1'}`}
                    />
                ))}
            </div>
        ))}
    </div>
);

/** Skeleton for text lines */
export const SkeletonText: React.FC<{ lines?: number } & SkeletonProps> = ({
    lines = 3,
    className = '',
}) => (
    <div className={`space-y-2 ${className}`}>
        {Array.from({ length: lines }).map((_, i) => (
            <Skeleton
                key={i}
                className={`h-3 rounded ${i === lines - 1 ? 'w-3/4' : 'w-full'}`}
            />
        ))}
    </div>
);

export default Skeleton;
