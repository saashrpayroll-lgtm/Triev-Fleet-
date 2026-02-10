import React, { useEffect, useState } from 'react';
import { supabase } from '@/config/supabase';

import GlassCard from '@/components/GlassCard';
import { History, Search, ArrowUpRight, ArrowDownLeft, RefreshCw, Calendar, Wallet } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface WalletTransaction {
    id: string;
    action_type: string;
    details: string;
    metadata: {
        amount?: number;
        type?: 'credit' | 'debit';
        oldBalance?: number;
        newBalance?: number;
        riderName?: string;
        source?: string;
        [key: string]: any;
    };
    performed_by: string; // user email or name
    timestamp: string;
}

const WalletHistory: React.FC = () => {
    // const { userData } = useSupabaseAuth();
    const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'credit' | 'debit'>('all');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('activity_logs')
                .select('*')
                .eq('action_type', 'wallet_transaction')
                .order('timestamp', { ascending: false })
                .limit(200); // Initial limit

            if (filterType !== 'all') {
                // This might is tricky with JSONB. We filter in memory for now or use complex query
                // For simplified SQL, filtering JSONB is harder without specific indexes
                // We'll filter in memory for 'type' if dataset is small, or just fetch all
            }

            if (dateRange.start) {
                query = query.gte('timestamp', new Date(dateRange.start).toISOString());
            }
            if (dateRange.end) {
                const endDate = new Date(dateRange.end);
                endDate.setHours(23, 59, 59, 999);
                query = query.lte('timestamp', endDate.toISOString());
            }

            const { data, error } = await query;

            if (error) throw error;

            let filtered = (data || []) as any[];

            // In-memory filter for JSONB fields (until we index them)
            if (filterType !== 'all') {
                filtered = filtered.filter(t => t.metadata?.type === filterType);
            }

            // Search filter
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                filtered = filtered.filter(t =>
                    t.metadata?.riderName?.toLowerCase().includes(term) ||
                    t.details?.toLowerCase().includes(term) ||
                    t.performed_by?.toLowerCase().includes(term)
                );
            }

            setTransactions(filtered);
        } catch (error) {
            console.error('Error fetching wallet history:', error);
            toast.error('Failed to load wallet history');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTransactions();

        const channel = supabase
            .channel('wallet-history-updates')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'activity_logs',
                    filter: 'action_type=eq.wallet_transaction'
                },
                (payload) => {
                    const newLog = payload.new as any;
                    // Apply basic in-memory filters to new incoming data
                    if (filterType !== 'all' && newLog.metadata?.type !== filterType) return;

                    setTransactions(prev => [newLog, ...prev]);
                    toast.info('New wallet transaction received');
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [filterType, dateRange.start, dateRange.end]); // Re-fetch on filter change to get correct base set? 
    // Actually, real-time subscription might duplicate if we re-fetch. 
    // Better strategy: Fetch once, filter locally? Or re-fetch and reset sub.
    // For now, simpler: Dependency array ensures re-fetch. Sub is re-created.

    // Calculate totals for displayed data
    const totalCredit = transactions.reduce((acc, t) => t.metadata?.type === 'credit' ? acc + (Number(t.metadata.amount) || 0) : acc, 0);
    const totalDebit = transactions.reduce((acc, t) => t.metadata?.type === 'debit' ? acc + (Number(t.metadata.amount) || 0) : acc, 0);

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
                        <History className="text-primary" /> Wallet Transaction History
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Track all rider wallet credits, debits, and bulk updates in real-time.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button onClick={fetchTransactions} className="p-2 hover:bg-muted rounded-full transition-colors" title="Refresh">
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                    {/* Export could go here */}
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <GlassCard className="p-6 flex items-center justify-between border-l-4 border-l-green-500">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Total Credit (Visible)</p>
                        <h3 className="text-2xl font-bold text-green-600">+₹{totalCredit.toLocaleString()}</h3>
                    </div>
                    <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full text-green-600">
                        <ArrowUpRight size={24} />
                    </div>
                </GlassCard>
                <GlassCard className="p-6 flex items-center justify-between border-l-4 border-l-red-500">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Total Debit (Visible)</p>
                        <h3 className="text-2xl font-bold text-red-600">-₹{totalDebit.toLocaleString()}</h3>
                    </div>
                    <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full text-red-600">
                        <ArrowDownLeft size={24} />
                    </div>
                </GlassCard>
                <GlassCard className="p-6 flex items-center justify-between border-l-4 border-l-blue-500">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Net Flow (Visible)</p>
                        <h3 className={`text-2xl font-bold ${totalCredit - totalDebit >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                            {totalCredit - totalDebit >= 0 ? '+' : ''}₹{(totalCredit - totalDebit).toLocaleString()}
                        </h3>
                    </div>
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600">
                        <Wallet size={24} />
                    </div>
                </GlassCard>
            </div>

            {/* Filters */}
            <GlassCard className="p-4">
                <div className="flex flex-col md:flex-row gap-4 items-end md:items-center">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                        <input
                            type="text"
                            placeholder="Search rider, admin, or details..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && fetchTransactions()}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border bg-background/50 focus:ring-2 focus:ring-primary/20 outline-none"
                        />
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value as any)}
                            className="px-3 py-2 rounded-lg border bg-background/50 outline-none focus:ring-2 focus:ring-primary/20"
                        >
                            <option value="all">All Types</option>
                            <option value="credit">Credits Only</option>
                            <option value="debit">Debits Only</option>
                        </select>

                        <div className="flex items-center gap-2 border rounded-lg px-2 bg-background/50">
                            <Calendar size={16} className="text-muted-foreground" />
                            <input
                                type="date"
                                className="bg-transparent border-none outline-none py-2 text-sm w-32"
                                value={dateRange.start}
                                onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                            />
                            <span className="text-muted-foreground">-</span>
                            <input
                                type="date"
                                className="bg-transparent border-none outline-none py-2 text-sm w-32"
                                value={dateRange.end}
                                onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                            />
                        </div>

                        <button
                            onClick={fetchTransactions}
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
                        >
                            Apply
                        </button>
                    </div>
                </div>
            </GlassCard>

            {/* Table */}
            <GlassCard className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs uppercase bg-muted/50 text-muted-foreground font-semibold">
                            <tr>
                                <th className="px-6 py-4">Date & Time</th>
                                <th className="px-6 py-4">Rider</th>
                                <th className="px-6 py-4">Type</th>
                                <th className="px-6 py-4 text-right">Amount</th>
                                <th className="px-6 py-4">Description</th>
                                <th className="px-6 py-4">Performed By</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-12">
                                        <div className="flex justify-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div></div>
                                    </td>
                                </tr>
                            ) : transactions.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-12 text-muted-foreground">
                                        No transactions found matching your filters.
                                    </td>
                                </tr>
                            ) : (
                                transactions.map((t) => {
                                    const amount = Number(t.metadata?.amount) || 0;
                                    const isCredit = t.metadata?.type === 'credit';
                                    const riderName = t.metadata?.riderName || 'Unknown';

                                    return (
                                        <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{format(new Date(t.timestamp), 'dd MMM yyyy')}</span>
                                                    <span className="text-xs text-muted-foreground">{format(new Date(t.timestamp), 'hh:mm a')}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-medium">{riderName}</td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold capitalize ${isCredit ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                    }`}>
                                                    {isCredit ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />}
                                                    {t.metadata?.type || 'Update'}
                                                </span>
                                            </td>
                                            <td className={`px-6 py-4 text-right font-bold ${isCredit ? 'text-green-600' : 'text-red-600'}`}>
                                                {isCredit ? '+' : '-'}₹{amount.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-muted-foreground max-w-xs truncate" title={t.details}>
                                                {t.details}
                                                {t.metadata?.source === 'bulk_import' && (
                                                    <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-[10px] bg-blue-100 text-blue-700 font-semibold border border-blue-200">BULK</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-muted-foreground text-xs">
                                                {t.performed_by || 'System'}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </GlassCard>
        </div>
    );
};

export default WalletHistory;
