import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, Wallet, Search, ArrowUpRight, Loader2 } from 'lucide-react';
import { Rider } from '@/types';
import { supabase } from '@/config/supabase';
import { logActivity } from '@/utils/activityLog';
import { toast } from 'sonner';

interface BulkCollectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    riders: Rider[];
    currentUserId?: string;
    currentUserEmail?: string;
    onSuccess: () => void;
}

export const BulkCollectionModal: React.FC<BulkCollectionModalProps> = ({
    isOpen,
    onClose,
    riders,
    currentUserId,
    currentUserEmail,
    onSuccess
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedAmounts, setSelectedAmounts] = useState<Record<string, number>>({});
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [defaultAmount, setDefaultAmount] = useState<number>(300); // Standard daily rent amount
    const [submitting, setSubmitting] = useState(false);

    if (!isOpen) return null;

    const activeRiders = riders.filter(r => r.status === 'active');
    const filteredRiders = activeRiders.filter(r =>
        r.riderName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.trievId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.mobileNumber.includes(searchTerm)
    );

    const handleToggleRider = (riderId: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(riderId)) {
            newSet.delete(riderId);
        } else {
            newSet.add(riderId);
            if (!selectedAmounts[riderId]) {
                setSelectedAmounts(prev => ({ ...prev, [riderId]: defaultAmount }));
            }
        }
        setSelectedIds(newSet);
    };

    const handleSelectAll = () => {
        if (selectedIds.size === filteredRiders.length) {
            setSelectedIds(new Set());
        } else {
            const allIds = new Set(filteredRiders.map(r => r.id));
            const newAmounts: Record<string, number> = { ...selectedAmounts };
            filteredRiders.forEach(r => {
                if (!newAmounts[r.id]) newAmounts[r.id] = defaultAmount;
            });
            setSelectedAmounts(newAmounts);
            setSelectedIds(allIds);
        }
    };

    const handleAmountChange = (riderId: string, val: number) => {
        setSelectedAmounts(prev => ({ ...prev, [riderId]: val }));
    };

    const handleSubmitCollections = async () => {
        if (selectedIds.size === 0) {
            toast.error('Please select at least one rider.');
            return;
        }

        setSubmitting(true);
        const tid = toast.loading(`Processing ${selectedIds.size} collection entries...`);

        try {
            const timestamp = new Date().toISOString();
            const riderIds = Array.from(selectedIds);

            for (const id of riderIds) {
                const amount = Number(selectedAmounts[id]) || defaultAmount;
                const targetRider = riders.find(r => r.id === id);
                if (!targetRider || amount <= 0) continue;

                const newBalance = targetRider.walletAmount + amount;

                // 1. Insert Ledger Entry
                await supabase.from('wallet_ledger').insert({
                    rider_id: id,
                    amount: amount,
                    transaction_type: 'DAILY_COLLECTION',
                    mode: 'ADD',
                    description: `Daily collection recorded by Team Leader (${currentUserEmail || 'TL'})`,
                    created_at: timestamp,
                    transaction_date: timestamp,
                    metadata: {
                        recorded_by: currentUserId,
                        bulk_batch: true
                    }
                });

                // 2. Update Rider Wallet Balance
                await supabase.from('riders').update({
                    wallet_amount: newBalance,
                    updated_at: timestamp
                }).eq('id', id);
            }

            await logActivity({
                actionType: 'walletUpdated',
                targetType: 'rider',
                targetId: 'multiple',
                details: `Bulk recorded daily collection for ${selectedIds.size} riders`,
                performedBy: currentUserEmail || 'Team Leader'
            });

            toast.success(`Successfully recorded collection for ${selectedIds.size} riders!`, { id: tid });
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Bulk collection error:', error);
            toast.error('Failed to submit collections: ' + (error.message || 'Unknown error'), { id: tid });
        } finally {
            setSubmitting(false);
        }
    };

    const totalCollection = Array.from(selectedIds).reduce((sum, id) => sum + (selectedAmounts[id] || defaultAmount), 0);

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="w-full max-w-2xl bg-card border border-border/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
                >
                    {/* Header */}
                    <div className="p-6 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                                <Wallet className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-extrabold tracking-tight">Bulk Daily Collection Helper</h2>
                                <p className="text-xs text-white/80">Quickly record evening cash & digital rent payments</p>
                            </div>
                        </div>

                        <button onClick={onClose} className="p-2 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Toolbar */}
                    <div className="p-4 border-b border-border/50 bg-muted/20 flex flex-col sm:flex-row gap-3 justify-between items-center">
                        <div className="relative w-full sm:w-64">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search rider name or ID..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 border border-input rounded-xl text-xs bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                            />
                        </div>

                        <div className="flex items-center gap-3 w-full sm:w-auto justify-between">
                            <div className="flex items-center gap-2 text-xs font-semibold">
                                <span>Default Daily Rent:</span>
                                <input
                                    type="number"
                                    value={defaultAmount}
                                    onChange={(e) => setDefaultAmount(Number(e.target.value))}
                                    className="w-20 px-2 py-1 border border-input rounded-lg text-xs bg-background font-bold text-center"
                                />
                            </div>

                            <button
                                type="button"
                                onClick={handleSelectAll}
                                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
                            >
                                {selectedIds.size === filteredRiders.length ? 'Deselect All' : 'Select All'}
                            </button>
                        </div>
                    </div>

                    {/* List of Riders */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[400px]">
                        {filteredRiders.map((r) => {
                            const isSelected = selectedIds.has(r.id);
                            const amount = selectedAmounts[r.id] ?? defaultAmount;

                            return (
                                <div
                                    key={r.id}
                                    onClick={() => handleToggleRider(r.id)}
                                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                                        isSelected
                                            ? 'border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/20'
                                            : 'border-border bg-card hover:bg-muted/30'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                                            isSelected ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-input bg-background'
                                        }`}>
                                            {isSelected && <CheckCircle2 size={14} />}
                                        </div>
                                        <div>
                                            <span className="font-bold text-sm text-foreground block">{r.riderName}</span>
                                            <span className="text-[10px] text-muted-foreground font-mono">ID: {r.trievId} · Mobile: {r.mobileNumber}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                                        <div className="text-right">
                                            <span className="text-[10px] text-muted-foreground block font-medium">Current Balance</span>
                                            <span className={`text-xs font-extrabold ${r.walletAmount < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                                                ₹{r.walletAmount.toLocaleString('en-IN')}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-1 bg-background border border-input rounded-xl px-2 py-1">
                                            <span className="text-xs font-bold text-muted-foreground">+₹</span>
                                            <input
                                                type="number"
                                                value={amount}
                                                onChange={(e) => handleAmountChange(r.id, Number(e.target.value))}
                                                className="w-16 text-xs font-bold bg-transparent outline-none text-right"
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Footer */}
                    <div className="p-6 bg-muted/20 border-t border-border flex items-center justify-between">
                        <div>
                            <span className="text-xs text-muted-foreground font-medium block">Selected: {selectedIds.size} Riders</span>
                            <span className="text-lg font-black text-foreground">Total Collection: ₹{totalCollection.toLocaleString('en-IN')}</span>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2.5 border border-input rounded-xl text-xs font-semibold text-muted-foreground hover:bg-accent"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmitCollections}
                                disabled={submitting || selectedIds.size === 0}
                                className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-extrabold hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition-all flex items-center gap-2"
                            >
                                {submitting ? <Loader2 size={16} className="animate-spin" /> : <ArrowUpRight size={16} />}
                                Confirm & Record Collections
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default BulkCollectionModal;
