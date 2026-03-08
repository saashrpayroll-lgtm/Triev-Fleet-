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
                    // Full-width on mobile, centered pill on desktop
                    className="fixed bottom-0 left-0 right-0 sm:bottom-6 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:max-w-3xl z-[40000]"
                >
                    {/* ── Mobile Layout ── */}
                    <div className="sm:hidden bg-slate-900 border-t border-white/10 shadow-[0_-8px_30px_rgba(0,0,0,0.4)] px-4 pt-3 pb-5">
                        {/* Top row: badge + close */}
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                                    <Check size={14} className="text-white" />
                                </div>
                                <div>
                                    <p className="text-xs font-black text-white uppercase tracking-wider leading-none">
                                        {selectedCount} Selected
                                    </p>
                                    <button onClick={onSelectAll} className="text-[10px] text-indigo-400 font-bold mt-0.5">
                                        {selectedCount < totalCount ? `Select all ${totalCount}` : '✓ All selected'}
                                    </button>
                                </div>
                            </div>
                            <button
                                onClick={onDeselectAll}
                                className="p-2 bg-white/10 rounded-xl text-slate-400 hover:text-white transition-colors active:scale-90"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Actions — 2-column grid so nothing is cut off */}
                        <div className="grid grid-cols-2 gap-2">
                            {actions.map((action, index) => (
                                <button
                                    key={index}
                                    onClick={action.onClick}
                                    className={`
                                        flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wide transition-all active:scale-95
                                        ${action.variant === 'destructive'
                                            ? 'bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500 hover:text-white'
                                            : action.variant === 'premium'
                                                ? 'bg-indigo-600 text-white'
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

                    {/* ── Desktop pill layout ── */}
                    <div className="hidden sm:flex sm:px-4">
                        <div className="w-full bg-slate-900/90 backdrop-blur-2xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-full p-2 pl-6 flex items-center justify-between gap-4">
                            {/* Left: selection info */}
                            <div className="flex items-center gap-4">
                                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.5)]">
                                    <Check size={16} className="text-white" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xs font-black text-white uppercase tracking-wider">
                                        {selectedCount} Selected
                                    </span>
                                    <button onClick={onSelectAll} className="text-[10px] text-primary hover:text-primary/80 font-bold text-left">
                                        {selectedCount < totalCount ? `Select all ${totalCount}` : 'All Selected'}
                                    </button>
                                </div>
                            </div>

                            {/* Right: action buttons + close */}
                            <div className="flex items-center gap-1.5">
                                {actions.map((action, index) => (
                                    <button
                                        key={index}
                                        onClick={action.onClick}
                                        className={`
                                            px-4 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 active:scale-95 whitespace-nowrap
                                            ${action.variant === 'destructive'
                                                ? 'bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/20'
                                                : action.variant === 'premium'
                                                    ? 'bg-primary text-white shadow-[0_5px_15px_rgba(99,102,241,0.4)] hover:shadow-[0_8px_25px_rgba(99,102,241,0.5)]'
                                                    : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
                                            }
                                        `}
                                    >
                                        {action.icon}
                                        {action.label}
                                    </button>
                                ))}
                                <button
                                    onClick={onDeselectAll}
                                    className="p-2.5 hover:bg-white/10 text-slate-400 hover:text-white rounded-full transition-all"
                                    aria-label="Close"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Glow */}
                    <div className="hidden sm:block absolute -bottom-4 left-1/2 -translate-x-1/2 w-2/3 h-8 bg-primary/20 blur-3xl -z-10 opacity-50" />
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default BulkActionsBar;
