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
                    initial={{ y: 120, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 120, opacity: 0 }}
                    transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                    className="fixed bottom-0 left-0 right-0 z-[40000]
                               sm:bottom-6 sm:left-4 sm:right-4
                               lg:left-1/2 lg:right-auto lg:-translate-x-1/2 lg:w-auto lg:max-w-5xl"
                >
                    {/* ═══ MOBILE: bottom sheet ═══ */}
                    <div className="sm:hidden bg-slate-950 border-t border-white/10 shadow-[0_-8px_40px_rgba(0,0,0,0.5)]">
                        {/* Top bar: count + close */}
                        <div className="flex items-center justify-between px-4 pt-3 pb-2">
                            <div className="flex items-center gap-2.5">
                                <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
                                    <Check size={13} className="text-white" />
                                </div>
                                <div>
                                    <p className="text-xs font-black text-white uppercase tracking-wide leading-none">
                                        {selectedCount} Selected
                                    </p>
                                    <button
                                        onClick={onSelectAll}
                                        className="text-[10px] text-indigo-400 font-semibold"
                                    >
                                        {selectedCount < totalCount ? `Select all ${totalCount}` : '✓ All selected'}
                                    </button>
                                </div>
                            </div>
                            <button
                                onClick={onDeselectAll}
                                className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-slate-400 hover:text-white transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* 2-column grid of action buttons */}
                        <div className="grid grid-cols-2 gap-2 px-4 pb-5">
                            {actions.map((action, index) => (
                                <button
                                    key={index}
                                    onClick={action.onClick}
                                    className={`
                                        flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all active:scale-95
                                        ${action.variant === 'destructive'
                                            ? 'bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500 hover:text-white'
                                            : action.variant === 'premium'
                                                ? 'bg-indigo-600 text-white shadow-lg'
                                                : 'bg-white/10 text-white border border-white/10 hover:bg-white/20'
                                        }
                                    `}
                                >
                                    {action.icon}
                                    {action.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ═══ DESKTOP/TABLET: floating pill ═══ */}
                    <div className="hidden sm:block">
                        <div className="bg-slate-900/95 backdrop-blur-2xl border border-white/20 shadow-[0_20px_60px_rgba(0,0,0,0.5)] rounded-2xl p-3 pl-5">
                            {/* Row 1: selection info + close */}
                            <div className="flex items-center justify-between mb-2.5">
                                <div className="flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-[0_0_12px_rgba(99,102,241,0.5)] flex-shrink-0">
                                        <Check size={14} className="text-white" />
                                    </div>
                                    <div>
                                        <span className="text-xs font-black text-white uppercase tracking-wider block leading-none">
                                            {selectedCount} Selected
                                        </span>
                                        <button
                                            onClick={onSelectAll}
                                            className="text-[10px] text-primary hover:text-primary/80 font-bold"
                                        >
                                            {selectedCount < totalCount ? `Select all ${totalCount}` : 'All Selected'}
                                        </button>
                                    </div>
                                </div>
                                <button
                                    onClick={onDeselectAll}
                                    className="p-2 hover:bg-white/10 text-slate-400 hover:text-white rounded-full transition-all"
                                    aria-label="Close"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            {/* Row 2: action buttons — wraps to next line if needed */}
                            <div className="flex flex-wrap gap-2">
                                {actions.map((action, index) => (
                                    <button
                                        key={index}
                                        onClick={action.onClick}
                                        className={`
                                            flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all active:scale-95 whitespace-nowrap
                                            ${action.variant === 'destructive'
                                                ? 'bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/20'
                                                : action.variant === 'premium'
                                                    ? 'bg-primary text-white shadow-[0_4px_12px_rgba(99,102,241,0.4)]'
                                                    : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
                                            }
                                        `}
                                    >
                                        {action.icon}
                                        {action.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Glow */}
                        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-2/3 h-8 bg-primary/30 blur-3xl -z-10 opacity-60" />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default BulkActionsBar;
