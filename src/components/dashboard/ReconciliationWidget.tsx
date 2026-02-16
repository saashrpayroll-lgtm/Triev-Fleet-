import React, { useEffect, useState } from 'react';
import { supabase } from '@/config/supabase';
import { ReconciliationItem } from '@/types';
import { AlertTriangle, CheckCircle, RefreshCcw, ArrowRight, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { LedgerAPI } from '@/api/ledger';
import { toast } from 'sonner';

const ReconciliationWidget: React.FC = () => {
    const [items, setItems] = useState<ReconciliationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [reconciling, setReconciling] = useState<string | null>(null);
    const [reconcilingAll, setReconcilingAll] = useState(false);
    const navigate = useNavigate();

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('view_reconciliation_status')
                .select('*')
                .limit(50); // Increased limit to find more issues

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
    }, []);

    const handleReconcile = async (riderId: string) => {
        setReconciling(riderId);
        try {
            await LedgerAPI.reconcileRider(riderId);
            toast.success('Wallet reconciled successfully');
            // Refresh data to show updated status
            await fetchData();
        } catch (err: any) {
            toast.error(err.message || 'Failed to reconcile');
        } finally {
            setReconciling(null);
        }
    };

    const handleAcceptSystem = async (riderId: string, systemBalance: number) => {
        if (!confirm("Are you sure the System Balance is correct? This will update the Snapshot to match.")) return;

        setReconciling(riderId);
        try {
            // Update Snapshot to match System Balance
            await LedgerAPI.processSnapshot({
                riderId: riderId,
                balance: systemBalance,
                date: new Date().toISOString(),
                source: 'MANUAL_SNAPSHOT'
            });
            toast.success('Snapshot updated to match System Balance');
            fetchData();
        } catch (err: any) {
            toast.error(err.message || 'Failed to update snapshot');
        } finally {
            setReconciling(null);
        }
    };

    const handleReconcileAll = async () => {
        if (!confirm(`Are you sure you want to auto-fix ${items.length} wallet discrepancies? This will add correcting transactions.`)) {
            return;
        }

        setReconcilingAll(true);
        try {
            // Process in batches or sequential to avoid overwhelming
            let successCount = 0;
            for (const item of items) {
                try {
                    await LedgerAPI.reconcileRider(item.rider_id);
                    successCount++;
                } catch (e) {
                    console.error(`Failed to reconcile ${item.rider_name}`, e);
                }
            }
            toast.success(`Successfully reconciled ${successCount} wallets`);
            fetchData();
        } catch (err: any) {
            toast.error('Bulk reconciliation failed');
        } finally {
            setReconcilingAll(false);
        }
    };

    const handleTrustAll = async () => {
        if (!confirm(`Are you sure you want to trust the System Balance for all ${items.length} riders? This will update their snapshots.`)) {
            return;
        }

        setReconcilingAll(true);
        try {
            let successCount = 0;
            for (const item of items) {
                try {
                    await LedgerAPI.processSnapshot({
                        riderId: item.rider_id,
                        balance: item.system_balance,
                        date: new Date().toISOString(),
                        source: 'MANUAL_SNAPSHOT' // Bulk Trust
                    });
                    successCount++;
                } catch (e) {
                    console.error(`Failed to update snapshot for ${item.rider_name}`, e);
                }
            }
            toast.success(`Successfully updated snapshots for ${successCount} riders`);
            fetchData();
        } catch (err: any) {
            toast.error('Bulk snapshot update failed');
        } finally {
            setReconcilingAll(false);
        }
    };

    if (loading && items.length === 0) {
        return (
            <div className="p-6 text-center space-y-3 animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mx-auto"></div>
                <div className="h-4 bg-muted rounded w-1/2 mx-auto"></div>
            </div>
        );
    }

    if (items.length === 0) return null;

    return (
        <div className="bg-card border-l-4 border-l-amber-500 rounded-r-xl shadow-sm overflow-hidden mb-6 animate-in slide-in-from-top-2 duration-500">
            <div className="p-4 bg-amber-50/50 dark:bg-amber-950/10 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-start gap-3">
                    <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-full text-amber-600 mt-1">
                        <AlertTriangle size={20} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-amber-900 dark:text-amber-100 flex items-center gap-2">
                            {items.length} Wallet Discrepancies Detected
                        </h3>
                        <p className="text-sm text-amber-700 dark:text-amber-300/80 mt-1">
                            Calculated Ledger Balance does not match the imported Snapshot.
                            <br />
                            <span className="text-xs opacity-80">This usually happens after manual edits or missing history.</span>
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleTrustAll}
                        disabled={reconcilingAll}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        {reconcilingAll ? <RefreshCcw size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                        Trust System (All)
                    </button>
                    <button
                        onClick={handleReconcileAll}
                        disabled={reconcilingAll}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        {reconcilingAll ? <RefreshCcw size={16} className="animate-spin" /> : <Zap size={16} />}
                        Fix All
                    </button>
                    <button onClick={fetchData} className="p-2 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded-full transition-colors text-amber-700">
                        <RefreshCcw size={16} />
                    </button>
                </div>
            </div>

            <div className="divide-y divide-border max-h-[300px] overflow-y-auto">
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

                            <div className="flex gap-1.5">
                                <button
                                    onClick={() => handleAcceptSystem(item.rider_id, item.system_balance)}
                                    disabled={reconciling === item.rider_id || reconcilingAll}
                                    className="px-3 py-1 bg-green-100 hover:bg-green-200 text-green-700 text-xs font-semibold rounded-md transition-colors disabled:opacity-50"
                                    title="Update Snapshot to match System Balance (Trust System)"
                                >
                                    {reconciling === item.rider_id ? (
                                        <RefreshCcw size={14} className="animate-spin" />
                                    ) : (
                                        'Trust System'
                                    )}
                                </button>

                                <button
                                    onClick={() => handleReconcile(item.rider_id)}
                                    disabled={reconciling === item.rider_id || reconcilingAll}
                                    className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-semibold rounded-md transition-colors disabled:opacity-50"
                                    title="Auto-Fix Balance (Trust Snapshot)"
                                >
                                    {reconciling === item.rider_id ? (
                                        <RefreshCcw size={14} className="animate-spin" />
                                    ) : (
                                        'Fix'
                                    )}
                                </button>
                            </div>

                            <button
                                onClick={() => navigate(`/portal/history/${item.rider_id}`)}
                                className="opacity-0 group-hover:opacity-100 p-2 hover:bg-muted rounded-full transition-all text-muted-foreground"
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
