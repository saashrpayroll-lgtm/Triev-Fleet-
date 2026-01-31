import React from 'react';
import { X, Check } from 'lucide-react';

interface BulkActionsBarProps {
    selectedCount: number;
    totalCount: number;
    onSelectAll: () => void;
    onDeselectAll: () => void;
    actions: {
        label: string;
        onClick: () => void;
        variant?: 'default' | 'destructive';
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
    if (selectedCount === 0) return null;

    return (
        <div className="bg-primary text-primary-foreground rounded-lg p-4 shadow-lg flex items-center justify-between animate-in slide-in-from-bottom-5 duration-200">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <Check size={20} />
                    <span className="font-semibold">
                        {selectedCount} {selectedCount === 1 ? 'item' : 'items'} selected
                    </span>
                </div>

                {selectedCount < totalCount && (
                    <button
                        onClick={onSelectAll}
                        className="text-sm text-primary-foreground/80 hover:text-primary-foreground underline transition-colors"
                    >
                        Select all {totalCount}
                    </button>
                )}

                <button
                    onClick={onDeselectAll}
                    className="text-sm text-primary-foreground/80 hover:text-primary-foreground underline transition-colors"
                >
                    Deselect all
                </button>
            </div>

            <div className="flex items-center gap-2">
                {actions.map((action, index) => (
                    <button
                        key={index}
                        onClick={action.onClick}
                        className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${action.variant === 'destructive'
                                ? 'bg-red-600 text-white hover:bg-red-700'
                                : 'bg-white text-primary hover:bg-white/90'
                            }`}
                    >
                        {action.icon}
                        {action.label}
                    </button>
                ))}

                <button
                    onClick={onDeselectAll}
                    className="p-2 hover:bg-primary-foreground/10 rounded-lg transition-colors ml-2"
                    aria-label="Close bulk actions"
                >
                    <X size={20} />
                </button>
            </div>
        </div>
    );
};

export default BulkActionsBar;
