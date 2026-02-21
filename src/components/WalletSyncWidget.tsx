import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle } from "lucide-react";
import { LedgerAPI } from "@/api/ledger";
import { toast } from "sonner";
import { supabase } from "@/config/supabase";

export function WalletSyncWidget() {
    const [mismatches, setMismatches] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchMismatches = async () => {
        try {
            setLoading(true);
            const data = await LedgerAPI.getMismatches();
            setMismatches(data || []);
        } catch (error) {
            console.error("Failed to fetch mismatches", error);
        } finally {
            setLoading(false);
        }
    };

    const handleResolve = async (id: string) => {
        try {
            const { error } = await supabase
                .from('wallet_mismatches')
                .update({ status: 'resolved' })
                .eq('id', id);

            if (error) throw error;
            toast.success("Alert resolved");
            fetchMismatches();
        } catch (error) {
            toast.error("Failed to resolve alert");
        }
    };

    useEffect(() => {
        fetchMismatches();

        // Real-time subscription
        const subscription = supabase
            .channel('mismatch_updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'wallet_mismatches' }, () => {
                fetchMismatches();
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const handleResolveAll = async () => {
        try {
            setLoading(true);
            const { error } = await supabase.rpc('resolve_all_wallet_mismatches');

            if (error) throw error;
            toast.success("All alerts resolved");
            fetchMismatches();
        } catch (error) {
            toast.error("Failed to resolve all alerts");
        } finally {
            setLoading(false);
        }
    };

    const [showSuccess, setShowSuccess] = useState(false);

    useEffect(() => {
        if (!loading && mismatches.length === 0) {
            setShowSuccess(true);
            const timer = setTimeout(() => setShowSuccess(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [loading, mismatches.length]);

    if (loading) return null; // Or keep loading indicator if preferred, but usually silent is better for dashboard

    if (mismatches.length === 0) {
        if (!showSuccess) return null; // Hide completely after timeout

        return (
            <div className="rounded-lg border border-green-200 bg-green-50/50 p-4 transition-all duration-500 fade-in-out">
                <div className="flex items-center justify-center gap-2 text-green-700">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">All Wallets Reconciled</span>
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-lg border border-red-200 bg-white shadow-sm overflow-hidden flex flex-col max-h-[400px]">
            <div className="px-6 py-4 bg-red-50/50 border-b border-red-100 flex items-center justify-between shrink-0">
                <h3 className="text-sm font-medium text-red-800 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Wallet Reconciliation Alerts ({mismatches.length})
                </h3>
                <button
                    onClick={handleResolveAll}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 rounded hover:bg-red-700 focus:outline-none shadow-sm transition-colors"
                >
                    Dismiss All
                </button>
            </div>
            <div className="overflow-auto">
                <table className="w-full text-sm text-left relative">
                    <thead className="bg-gray-50 text-gray-500 font-medium sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="px-6 py-3 bg-gray-50">Rider</th>
                            <th className="px-6 py-3 text-right bg-gray-50">System Closing</th>
                            <th className="px-6 py-3 text-right bg-gray-50">Source Opening</th>
                            <th className="px-6 py-3 text-right bg-gray-50">Diff</th>
                            <th className="px-6 py-3 w-[100px] bg-gray-50"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {mismatches.map((item) => (
                            <tr key={item.id} className="hover:bg-red-50/10">
                                <td className="px-6 py-4 font-medium">
                                    <div className="flex flex-col">
                                        <span className="text-gray-900 font-semibold">{item.riders?.rider_name || 'Unknown'}</span>
                                        <span className="text-xs text-gray-500">{item.riders?.mobile_number}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right text-gray-500">
                                    ₹{item.system_balance}
                                </td>
                                <td className="px-6 py-4 text-right font-medium text-gray-900">
                                    ₹{item.source_balance}
                                </td>
                                <td className="px-6 py-4 text-right font-bold text-red-600">
                                    {item.difference > 0 ? '+' : ''}{item.difference}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button
                                        className="px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-sm"
                                        onClick={() => handleResolve(item.id)}
                                    >
                                        Dismiss
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
