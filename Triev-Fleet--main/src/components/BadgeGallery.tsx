import React from 'react';
import { motion } from 'framer-motion';
import { Trophy } from 'lucide-react';
import { AwardedBadge, rarityConfig } from '@/utils/badges';

interface BadgeGalleryProps {
    badges: AwardedBadge[];
    maxDisplay?: number;
    compact?: boolean;
    className?: string;
}

/**
 * Visual gallery of earned achievement badges.
 * Supports compact mode (inline strip) and full mode (grid).
 */
const BadgeGallery: React.FC<BadgeGalleryProps> = ({
    badges,
    maxDisplay = 8,
    compact = false,
    className = '',
}) => {
    if (badges.length === 0) {
        return compact ? null : (
            <div className={`text-center py-6 ${className}`}>
                <Trophy size={28} className="mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-xs font-bold text-muted-foreground/50">No badges earned yet</p>
                <p className="text-[9px] text-muted-foreground/40 mt-0.5">Keep performing to unlock achievements!</p>
            </div>
        );
    }

    const displayBadges = badges.slice(0, maxDisplay);
    const remaining = badges.length - maxDisplay;

    if (compact) {
        return (
            <div className={`flex items-center gap-1 ${className}`}>
                {displayBadges.map((badge, idx) => (
                    <motion.span
                        key={badge.id}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.08, type: 'spring' }}
                        className={`
                            inline-flex items-center justify-center w-7 h-7 rounded-full border
                            ${rarityConfig[badge.rarity].border} ${rarityConfig[badge.rarity].bg}
                            ${rarityConfig[badge.rarity].glow}
                            text-sm cursor-default transition-transform hover:scale-125
                        `}
                        title={`${badge.name} — ${badge.description}`}
                    >
                        {badge.icon}
                    </motion.span>
                ))}
                {remaining > 0 && (
                    <span className="text-[9px] font-bold text-muted-foreground ml-0.5">+{remaining}</span>
                )}
            </div>
        );
    }

    return (
        <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 ${className}`}>
            {displayBadges.map((badge, idx) => {
                const config = rarityConfig[badge.rarity];
                return (
                    <motion.div
                        key={badge.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.06 }}
                        className={`
                            relative overflow-hidden rounded-xl border p-3
                            ${config.border} ${config.bg} ${config.glow}
                            hover:scale-[1.03] transition-transform cursor-default
                        `}
                    >
                        {/* Rarity label */}
                        <span className={`absolute top-1.5 right-1.5 text-[7px] font-black uppercase tracking-widest ${config.text} opacity-60`}>
                            {config.label}
                        </span>

                        <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-xl">{badge.icon}</span>
                            <div className="min-w-0">
                                <p className="text-[10px] font-black truncate">{badge.name}</p>
                                <p className="text-[8px] text-muted-foreground font-medium truncate">{badge.description}</p>
                            </div>
                        </div>
                        <p className="text-[8px] text-muted-foreground/70 font-medium truncate italic">
                            {badge.reason}
                        </p>
                    </motion.div>
                );
            })}
        </div>
    );
};

export default BadgeGallery;
