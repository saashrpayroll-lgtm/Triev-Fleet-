import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon, Inbox } from 'lucide-react';

interface EmptyStateProps {
    icon?: LucideIcon;
    title: string;
    description?: string;
    actionLabel?: string;
    onAction?: () => void;
    className?: string;
}

/**
 * Premium empty state with icon, message, and optional CTA.
 * Replaces plain text placeholders throughout the app.
 */
const EmptyState: React.FC<EmptyStateProps> = ({
    icon: Icon = Inbox,
    title,
    description,
    actionLabel,
    onAction,
    className = '',
}) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex flex-col items-center justify-center py-12 px-6 text-center ${className}`}
        >
            <div className="relative mb-4">
                <div className="absolute inset-0 bg-primary/5 rounded-full blur-2xl scale-150" />
                <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 border border-border/40 flex items-center justify-center shadow-inner">
                    <Icon size={28} className="text-muted-foreground/40" strokeWidth={1.5} />
                </div>
            </div>

            <h3 className="text-sm font-black text-foreground mb-1">{title}</h3>
            {description && (
                <p className="text-[11px] text-muted-foreground/70 max-w-xs leading-relaxed font-medium">
                    {description}
                </p>
            )}

            {actionLabel && onAction && (
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onAction}
                    className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-shadow"
                >
                    {actionLabel}
                </motion.button>
            )}
        </motion.div>
    );
};

export default EmptyState;
