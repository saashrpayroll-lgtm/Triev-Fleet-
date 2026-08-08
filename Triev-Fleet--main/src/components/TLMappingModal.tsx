import React, { useState } from 'react';
import { User } from '@/types';
import { X } from 'lucide-react';

interface TLMappingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (newTLId: string) => Promise<void>;
    currentTLId?: string; // Optional for bulk
    teamLeaders: User[];
    riderName?: string; // Optional for bulk
    count?: number; // Added for bulk
}

const TLMappingModal: React.FC<TLMappingModalProps> = ({
    isOpen,
    onClose,
    onSave,
    currentTLId,
    teamLeaders,
    riderName,
    count
}) => {
    const [selectedTL, setSelectedTL] = useState(currentTLId || '');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        if (!selectedTL || (currentTLId && selectedTL === currentTLId)) {
            onClose();
            return;
        }
        setIsSubmitting(true);
        await onSave(selectedTL);
        setIsSubmitting(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
            <div className="bg-card w-full max-w-md rounded-xl shadow-2xl border border-border/50 ring-1 ring-white/10">
                <div className="flex items-center justify-between p-5 border-b border-border/50">
                    <h3 className="text-xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                        {count ? 'Bulk Reassignment' : 'Reassign Rider'}
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <p className="text-muted-foreground text-sm leading-relaxed">
                        {count ? (
                            <span>Selecting a new Team Leader for <strong className="text-foreground">{count} selected riders</strong>.</span>
                        ) : (
                            <span>Select a new Team Leader for <strong className="text-foreground">{riderName}</strong>.</span>
                        )}
                        <br />
                        This will transfer management responsibilities immediately.
                    </p>

                    <div>
                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                            Assign To
                        </label>
                        <select
                            value={selectedTL}
                            onChange={(e) => setSelectedTL(e.target.value)}
                            className="w-full px-4 py-3 border border-border rounded-lg bg-background/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                        >
                            {!selectedTL && <option value="">Select Team Leader...</option>}
                            {teamLeaders.map((tl) => (
                                <option key={tl.id} value={tl.id}>
                                    {tl.fullName}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex justify-end gap-3 p-5 border-t border-border/50 bg-muted/20">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 border border-border rounded-lg hover:bg-muted font-medium transition-all text-sm"
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 font-medium text-sm disabled:opacity-50 disabled:shadow-none"
                        disabled={isSubmitting || (!!currentTLId && selectedTL === currentTLId) || !selectedTL}
                    >
                        {isSubmitting ? 'Saving changes...' : count ? `Reassign ${count} Riders` : 'Confirm Reassignment'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TLMappingModal;
