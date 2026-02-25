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
                    className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[40000] w-full max-w-3xl px-4"
                >
                    <div className="bg-slate-900/80 dark:bg-slate-900/90 backdrop-blur-2xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-full p-2 pl-6 flex items-center justify-between gap-4 group">
                        {/* Selection Info */}
                        <div className="flex items-center gap-6 overflow-hidden">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-[0_0_15px_rgba(var(--primary),0.5)]">
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

                            <div className="h-8 w-[1px] bg-white/10" />

                            <button
                                onClick={onDeselectAll}
                                className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
                            >
                                Clear
                            </button>
                        </div>

                        {/* Actions Grid */}
                        <div className="flex items-center gap-1.5">
                            {actions.map((action, index) => (
                                <button
                                    key={index}
                                    onClick={action.onClick}
                                    className={`
                                        px-4 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 active:scale-95
                                        ${action.variant === 'destructive'
                                            ? 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20'
                                            : action.variant === 'premium'
                                                ? 'bg-primary text-white shadow-[0_5px_15px_rgba(var(--primary),0.4)] hover:shadow-[0_8px_25px_rgba(var(--primary),0.5)] hover:-translate-y-0.5'
                                                : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
                                        }
                                    `}
                                >
                                    {action.icon}
                                    <span className="hidden sm:inline">{action.label}</span>
                                </button>
                            ))}

                            <div className="w-1" />

                            <button
                                onClick={onDeselectAll}
                                className="p-2.5 hover:bg-white/10 text-slate-400 hover:text-white rounded-full transition-all active:rotate-90 duration-300"
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
