import React, { useState } from 'react';
import { Trash2, Lock, X, RefreshCw, ToggleRight, CheckCircle, AlertTriangle } from 'lucide-react';

interface BulkActionsBarProps {
    selectedCount: number;
    onClearSelection: () => void;
    onDelete: () => Promise<void> | void;
    onSuspend: () => Promise<void> | void;
    onToggleStatus: () => Promise<void> | void;
    onSelectAll?: () => void;
    totalCount?: number;
    isProcessing?: boolean;
}

const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
    selectedCount,
    onClearSelection,
    onDelete,
    onSuspend,
    onToggleStatus,
    onSelectAll,
    totalCount,
    isProcessing = false
}) => {
    const [activeAction, setActiveAction] = useState<string | null>(null);
    const [confirmAction, setConfirmAction] = useState<{ key: string; label: string; handler: () => Promise<void> | void } | null>(null);

    if (selectedCount === 0) return null;

    const handleAction = async (key: string, label: string, handler: () => Promise<void> | void) => {
        setConfirmAction({ key, label, handler });
    };

    const executeAction = async () => {
        if (!confirmAction) return;
        setActiveAction(confirmAction.key);
        try {
            await confirmAction.handler();
        } finally {
            setActiveAction(null);
            setConfirmAction(null);
        }
    };

    const actions = [
        {
            key: 'toggleStatus',
            label: 'Toggle Status',
            icon: ToggleRight,
            color: 'text-blue-400 hover:text-blue-300',
            bgHover: 'hover:bg-blue-500/20',
            handler: onToggleStatus
        },
        {
            key: 'suspend',
            label: 'Suspend',
            icon: Lock,
            color: 'text-amber-400 hover:text-amber-300',
            bgHover: 'hover:bg-amber-500/20',
            handler: onSuspend
        },
        {
            key: 'delete',
            label: 'Delete',
            icon: Trash2,
            color: 'text-rose-400 hover:text-rose-300',
            bgHover: 'hover:bg-rose-500/20',
            handler: onDelete
        }
    ];

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
            <div className={`bg-gray-900/95 backdrop-blur-xl text-white rounded-2xl shadow-2xl border border-white/10 transition-all ${isProcessing || activeAction ? 'opacity-80' : ''}`}>
                {/* Confirmation Overlay */}
                {confirmAction && !activeAction && (
                    <div className="px-6 py-3 bg-amber-900/30 border-b border-amber-500/20 rounded-t-2xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-1 duration-200">
                        <AlertTriangle size={16} className="text-amber-400 flex-shrink-0" />
                        <span className="text-sm flex-1">
                            <strong>{confirmAction.label}</strong> {selectedCount} user{selectedCount > 1 ? 's' : ''}?
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setConfirmAction(null)}
                                className="px-3 py-1.5 text-xs font-bold rounded-lg border border-white/20 hover:bg-white/10 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={executeAction}
                                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-500 transition-colors"
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                )}

                {/* Active Processing Indicator */}
                {activeAction && (
                    <div className="px-6 py-2 bg-primary/20 border-b border-primary/30 rounded-t-2xl flex items-center gap-3 animate-in fade-in duration-200">
                        <RefreshCw size={14} className="animate-spin text-primary" />
                        <span className="text-xs font-medium text-primary/90">
                            Processing {selectedCount} user{selectedCount > 1 ? 's' : ''}...
                        </span>
                    </div>
                )}

                <div className="px-6 py-3 flex items-center gap-5">
                    {/* Selection Count */}
                    <div className="flex items-center gap-3 border-r border-white/20 pr-5">
                        <div className="relative">
                            <CheckCircle size={18} className="text-primary" />
                            {(isProcessing || activeAction) && (
                                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full animate-ping" />
                            )}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-bold leading-tight">{selectedCount}</span>
                            <span className="text-[10px] text-white/50 leading-tight">
                                {totalCount ? `of ${totalCount}` : 'selected'}
                            </span>
                        </div>
                        {onSelectAll && totalCount && selectedCount < totalCount && (
                            <button
                                onClick={onSelectAll}
                                className="text-[10px] text-primary hover:text-primary/80 font-semibold underline underline-offset-2 whitespace-nowrap"
                            >
                                Select All
                            </button>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1">
                        {actions.map(act => (
                            <button
                                key={act.key}
                                onClick={() => handleAction(act.key, act.label, act.handler)}
                                disabled={isProcessing || !!activeAction}
                                className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-sm font-medium ${act.color} ${act.bgHover} disabled:opacity-40 disabled:cursor-not-allowed`}
                            >
                                {activeAction === act.key ? (
                                    <RefreshCw size={16} className="animate-spin" />
                                ) : (
                                    <act.icon size={16} />
                                )}
                                <span className="hidden sm:inline">{act.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Close */}
                    <button
                        onClick={onClearSelection}
                        disabled={!!activeAction}
                        className="ml-1 p-1.5 hover:bg-white/15 rounded-full transition-colors disabled:opacity-40"
                        title="Clear Selection"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BulkActionsBar;
