import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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

    if (loading) return <div className="p-4">Loading alerts...</div>;

    if (mismatches.length === 0) {
        return (
            <Card className="border-green-200 bg-green-50/50">
                <CardContent className="pt-6 flex items-center justify-center gap-2 text-green-700">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">All Wallets Reconciled</span>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-red-200 shadow-sm">
            <CardHeader className="pb-2 bg-red-50/50">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-red-800 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Wallet Reconciliation Alerts ({mismatches.length})
                    </CardTitle>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Rider</TableHead>
                            <TableHead className="text-right">System Closing</TableHead>
                            <TableHead className="text-right">Source Opening</TableHead>
                            <TableHead className="text-right">Diff</TableHead>
                            <TableHead className="w-[80px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {mismatches.map((item) => (
                            <TableRow key={item.id} className="hover:bg-red-50/10">
                                <TableCell className="font-medium">
                                    <div className="flex flex-col">
                                        <span>{item.riders?.rider_name || 'Unknown'}</span>
                                        <span className="text-xs text-muted-foreground">{item.riders?.mobile_number}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground">
                                    ₹{item.system_balance}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                    ₹{item.source_balance}
                                </TableCell>
                                <TableCell className="text-right text-red-600 font-bold">
                                    {item.difference > 0 ? '+' : ''}{item.difference}
                                </TableCell>
                                <TableCell>
                                    <Badge
                                        variant="outline"
                                        className="cursor-pointer hover:bg-slate-100"
                                        onClick={() => handleResolve(item.id)}
                                    >
                                        Dismiss
                                    </Badge>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
