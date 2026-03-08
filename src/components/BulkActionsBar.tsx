import React from 'react';
import { X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface BulkActionsBarProps {
    selectedCount: number;
    totalCount: number;
    onSelectAll: () => void;
    onDeselectAll: () => void;
    actions: {
        label: string;
        onClick: () => void;
        variant?: 'default' | 'destructive' | 'premium';
        icon?: React.ReactNode;
    }[];
}

const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
    selectedCount,
    totalCount,
    onSelectAll,
    onDeselectAll,
    actions,
}) => {
    return (
        <AnimatePresence>
            {selectedCount > 0 && (
                <motion.div
                    initial={{ y: 100, opacity: 0, scale: 0.9 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: 100, opacity: 0, scale: 0.9 }}
                    className="fixed bottom-4 sm:bottom-8 left-2 right-2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-[40000] sm:w-full sm:max-w-3xl sm:px-4"
                >
                    <div className="bg-slate-900/95 dark:bg-slate-900 backdrop-blur-2xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-2xl sm:rounded-full p-3 sm:p-2 sm:pl-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        {/* ── Selection Info row ── */}
                        <div className="flex items-center justify-between sm:justify-start gap-3 sm:gap-6">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.5)] flex-shrink-0">
                                    <Check size={16} className="text-white" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xs font-black text-white uppercase tracking-wider">
                                        {selectedCount} Selected
                                    </span>
                                    <button
                                        onClick={onSelectAll}
                                        className="text-[10px] text-primary hover:text-primary/80 font-bold transition-colors text-left"
                                    >
                                        {selectedCount < totalCount ? `Select all ${totalCount}` : 'All Selected'}
                                    </button>
                                </div>
                            </div>

                            {/* Clear text — only on mobile (Close X handles it on desktop) */}
                            <button
                                onClick={onDeselectAll}
                                className="sm:hidden p-2 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl transition-all"
                                aria-label="Close"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* ── Actions scroll row ── */}
                        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-0.5 sm:pb-0">
                            {actions.map((action, index) => (
                                <button
                                    key={index}
                                    onClick={action.onClick}
                                    className={`
                                        flex-shrink-0 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-full text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 active:scale-95 whitespace-nowrap
                                        ${action.variant === 'destructive'
                                            ? 'bg-red-500/15 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/30'
                                            : action.variant === 'premium'
                                                ? 'bg-primary text-white shadow-[0_5px_15px_rgba(99,102,241,0.4)] hover:shadow-[0_8px_25px_rgba(99,102,241,0.5)] hover:-translate-y-0.5'
                                                : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
                                        }
                                    `}
                                >
                                    {action.icon}
                                    {/* Always show label (removed hidden sm:inline) */}
                                    {action.label}
                                </button>
                            ))}

                            <div className="w-1 flex-shrink-0" />

                            {/* Desktop close button */}
                            <button
                                onClick={onDeselectAll}
                                className="hidden sm:flex p-2.5 hover:bg-white/10 text-slate-400 hover:text-white rounded-full transition-all active:rotate-90 duration-300"
                                aria-label="Close bulk actions"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Bottom Glow */}
                    <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-2/3 h-8 bg-primary/20 blur-3xl -z-10 opacity-50" />
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default BulkActionsBar;
