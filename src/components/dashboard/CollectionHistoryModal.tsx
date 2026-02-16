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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-card border w-full max-w-md rounded-xl shadow-2xl overflow-hidden animate-in scale-95 duration-200">

                {/* Header */}
                <div className="p-4 border-b flex justify-between items-center bg-muted/40">
                    <div>
                        <h3 className="font-semibold text-lg">Collection History</h3>
                        <p className="text-sm text-muted-foreground">{teamLeaderName}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Summary Card */}
                <div className="p-4 bg-primary/5 border-b border-primary/10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-full text-primary">
                                <Wallet size={20} />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Collection</p>
                                <p className="text-xl font-bold text-primary">₹{total.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* List */}
                <div className="max-h-[400px] overflow-y-auto custom-scrollbar p-0">
                    {loading ? (
                        <div className="p-8 text-center text-muted-foreground">Loading history...</div>
                    ) : history.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">No collection records found.</div>
                    ) : (
                        <table className="w-full text-sm text-left">
                            <thead className="bg-muted/50 text-muted-foreground font-medium sticky top-0">
                                <tr>
                                    <th className="px-4 py-3 font-medium">Date</th>
                                    <th className="px-4 py-3 font-medium text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {history.map((record, idx) => (
                                    <tr key={idx} className="hover:bg-muted/20 transition-colors">
                                        <td className="px-4 py-3 flex items-center gap-2">
                                            <Calendar size={14} className="text-muted-foreground" />
                                            {format(new Date(record.date), 'dd MMM yyyy')}
                                        </td>
                                        <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                                            ₹{record.total_collection.toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="p-3 border-t bg-muted/20 text-xs text-center text-muted-foreground">
                    Showing last {history.length} records
                </div>
            </div>
        </div>,
        document.body
    );
};

export default CollectionHistoryModal;
