import React from 'react';
import { Trash2, Lock, X } from 'lucide-react';

interface BulkActionsBarProps {
    selectedCount: number;
    onClearSelection: () => void;
    onDelete: () => void;
    onSuspend: () => void;
    onToggleStatus: () => void;
}

const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
    selectedCount,
    onClearSelection,
    onDelete,
    onSuspend,
    onToggleStatus
}) => {
    if (selectedCount === 0) return null;

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
            <div className="bg-gray-900/90 backdrop-blur-md text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-6 border border-white/10">
                <div className="flex items-center gap-3 border-r border-white/20 pr-6">
                    <span className="bg-white/20 px-2 py-0.5 rounded text-sm font-bold">{selectedCount}</span>
                    <span className="text-sm font-medium">Selected</span>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={onToggleStatus}
                        className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/10 rounded-lg transition-colors text-sm font-medium text-blue-300"
                    >
                        <Lock size={16} /> {/* Reusing icon or cleaner one? RefreshCw is better */}
                        Toggle Status
                    </button>
                    <button
                        onClick={onSuspend}
                        className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/10 rounded-lg transition-colors text-sm font-medium text-amber-300"
                    >
                        <Lock size={16} />
                        Suspend
                    </button>
                    <button
                        onClick={onDelete}
                        className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/10 rounded-lg transition-colors text-sm font-medium text-rose-300"
                    >
                        <Trash2 size={16} />
                        Delete
                    </button>
                </div>

                <button
                    onClick={onClearSelection}
                    className="ml-2 p-1 hover:bg-white/20 rounded-full transition-colors"
                >
                    <X size={16} />
                </button>
            </div>
        </div>
    );
};

export default BulkActionsBar;
