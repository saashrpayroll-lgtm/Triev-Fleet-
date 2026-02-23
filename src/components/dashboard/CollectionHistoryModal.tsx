import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, Wallet } from 'lucide-react';
import { supabase } from '@/config/supabase';
import { format } from 'date-fns';

interface CollectionHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    teamLeaderId: string;
    teamLeaderName: string;
}

interface CollectionRecord {
    date: string;
    total_collection: number;
}

const CollectionHistoryModal: React.FC<CollectionHistoryModalProps> = ({
    isOpen, onClose, teamLeaderId, teamLeaderName
}) => {
    const [history, setHistory] = useState<CollectionRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);

    useEffect(() => {
        if (isOpen && teamLeaderId) {
            fetchHistory();
        }
    }, [isOpen, teamLeaderId]);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('daily_collections')
                .select('date, total_collection')
                .eq('team_leader_id', teamLeaderId)
                .order('date', { ascending: false });

            if (error) throw error;

            const records = (data || []).map(d => ({
                date: d.date,
                total_collection: Number(d.total_collection) || 0
            }));

            setHistory(records);
            setTotal(records.reduce((sum, r) => sum + r.total_collection, 0));
        } catch (err) {
            console.error('Error fetching collection history:', err);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-300 p-4">
            <div className="bg-card border w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border-border/40 ring-1 ring-white/10">

                {/* Header */}
                <div className="p-5 border-b flex justify-between items-center bg-muted/30">
                    <div>
                        <h3 className="font-black text-xl tracking-tight">Collection History</h3>
                        <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5">{teamLeaderName}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl transition-all active:scale-90 border border-transparent hover:border-border/50">
                        <X size={18} className="text-muted-foreground" />
                    </button>
                </div>

                {/* Summary Card - High Contrast */}
                <div className="p-5 bg-gradient-to-br from-primary/10 via-background to-background border-b border-border/40">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary text-primary-foreground rounded-2xl shadow-lg shadow-primary/20">
                            <Wallet size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em]">Aggregate Sourcing</p>
                            <p className="text-2xl font-black text-foreground">₹{total.toLocaleString()}</p>
                        </div>
                    </div>
                </div>

                {/* List Container - Scrollable (Sized for ~7-8 entries) */}
                <div className="max-h-[460px] overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/10 hover:scrollbar-thumb-muted-foreground/20 transition-all bg-card/50">
                    {loading ? (
                        <div className="p-12 text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
                            <p className="text-xs font-bold text-muted-foreground animate-pulse">Fetching records...</p>
                        </div>
                    ) : history.length === 0 ? (
                        <div className="p-12 text-center text-muted-foreground">
                            <Calendar size={32} className="mx-auto mb-3 opacity-10" />
                            <p className="text-sm font-bold opacity-30">No recovery data found.</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm text-left border-separate border-spacing-0">
                            <thead className="bg-muted/80 backdrop-blur-sm sticky top-0 z-10">
                                <tr>
                                    <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border/30">Date</th>
                                    <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border/30 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/10">
                                {history.map((record, idx) => (
                                    <tr key={idx} className="hover:bg-primary/5 transition-all group">
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-1.5 rounded-lg bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                                    <Calendar size={12} />
                                                </div>
                                                <span className="font-black text-foreground text-[13px] tracking-tight">{format(new Date(record.date), 'dd MMM, yyyy')}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            <span className="font-black text-xs text-emerald-600 bg-emerald-500/5 px-2 py-1 rounded-lg border border-emerald-500/10 inline-block">
                                                ₹{record.total_collection.toLocaleString()}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="p-4 border-t bg-muted/30 flex justify-center items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground/60">
                        Showing {history.length} Daily Entry Points
                    </span>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default CollectionHistoryModal;
