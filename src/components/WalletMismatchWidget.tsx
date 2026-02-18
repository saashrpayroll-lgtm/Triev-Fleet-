import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle } from "lucide-react";
import { LedgerAPI } from "@/api/ledger";
import { toast } from "sonner";
import { supabase } from "@/config/supabase";

export function WalletMismatchWidget() {
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

    if (loading) return <div className="p-4 text-sm text-gray-500">Loading alerts...</div>;

    if (mismatches.length === 0) {
        return (
            <div className="rounded-lg border border-green-200 bg-green-50/50 p-6">
                <div className="flex items-center justify-center gap-2 text-green-700">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">All Wallets Reconciled</span>
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-lg border border-red-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-red-50/50 border-b border-red-100 flex items-center justify-between">
                <h3 className="text-sm font-medium text-red-800 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Wallet Reconciliation Alerts ({mismatches.length})
                </h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500 font-medium">
                        <tr>
                            <th className="px-6 py-3">Rider</th>
                            <th className="px-6 py-3 text-right">System Closing</th>
                            <th className="px-6 py-3 text-right">Source Opening</th>
                            <th className="px-6 py-3 text-right">Diff</th>
                            <th className="px-6 py-3 w-[100px]"></th>
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
