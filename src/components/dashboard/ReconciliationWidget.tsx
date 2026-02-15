import React, { useEffect, useState } from 'react';
import { supabase } from '@/config/supabase';
import { ReconciliationItem } from '@/types';
import { AlertTriangle, CheckCircle, RefreshCcw, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ReconciliationWidget: React.FC = () => {
    const [items, setItems] = useState<ReconciliationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('view_reconciliation_status')
                .select('*')
                .limit(5); // Show top 5 mismatches

            if (error) throw error;
            setItems(data as ReconciliationItem[] || []);
        } catch (err) {
            console.error('Error fetching reconciliation status:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();

        // Real-time subscription to wallet_snapshots or riders?
        // Views cannot be subscribed to directly easily without Realtime enabled on underlying tables.
        // We'll just fetch on mount.
    }, []);

    if (loading) return (
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
    );

    if (items.length === 0) {
        return (
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <CheckCircle className="text-green-600 dark:text-green-400" size={20} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-lg">System Reconciled</h3>
                        <p className="text-sm text-muted-foreground">All wallet balances match snapshots.</p>
                    </div>
                </div>
                <button onClick={fetchData} className="p-2 hover:bg-muted rounded-full">
                    <RefreshCcw size={16} className="text-muted-foreground" />
                </button>
            </div>
        );
    }

    return (
        <div className="bg-card border border-red-200 dark:border-red-900/30 rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 bg-red-50 dark:bg-red-950/20 border-b border-red-100 dark:border-red-900/10 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <AlertTriangle className="text-red-600 animate-pulse" size={20} />
                    <h3 className="font-bold text-red-700 dark:text-red-400">Reconciliation Action Required</h3>
                    <span className="bg-red-200 dark:bg-red-900 text-red-800 dark:text-red-200 text-xs px-2 py-0.5 rounded-full font-bold">
                        {items.length} Issues
                    </span>
                </div>
                <button onClick={fetchData} className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-full transition-colors">
                    <RefreshCcw size={14} className="text-red-700 dark:text-red-400" />
                </button>
            </div>

            <div className="divide-y divide-border">
                {items.map((item) => (
                    <div key={item.rider_id} className="p-3 hover:bg-muted/30 flex items-center justify-between group">
                        <div className="flex flex-col">
                            <span className="font-medium text-sm">{item.rider_name} <span className="text-muted-foreground text-xs">({item.triev_id})</span></span>
                            <div className="flex gap-2 text-xs mt-0.5">
                                <span className="text-muted-foreground">System: <span className="font-mono font-medium text-foreground">₹{item.system_balance}</span></span>
                                <span className="text-muted-foreground">Snapshot: <span className="font-mono font-medium text-foreground">₹{item.snapshot_balance}</span></span>
                            </div>
                        </div>
                        <div className="text-right flex items-center gap-3">
                            <div className="flex flex-col items-end">
                                <span className="text-xs text-muted-foreground">Difference</span>
                                <span className={`font-bold font-mono ${item.difference > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                                    {item.difference > 0 ? '+' : ''}{item.difference}
                                </span>
                            </div>
                            <button
                                onClick={() => navigate(`/portal/history/${item.rider_id}`)}
                                className="opacity-0 group-hover:opacity-100 p-2 hover:bg-muted rounded-full transition-all"
                            >
                                <ArrowRight size={16} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ReconciliationWidget;
