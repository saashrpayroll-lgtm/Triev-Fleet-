import React, { useEffect, useState } from 'react';
import { supabase } from '@/config/supabase';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import GlassCard from '@/components/GlassCard';
import { History, Search, ArrowUpRight, ArrowDownLeft, RefreshCw, Wallet, Trash2, Filter, ChevronLeft, ChevronRight, User, AlertCircle, CheckSquare } from 'lucide-react';
import { format, subDays, endOfDay, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { User as UserType } from '@/types';

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
        teamLeaderId?: string;
        source?: string;
        [key: string]: any;
    };
    performed_by: string;
    timestamp: string;
}

const WalletHistory: React.FC = () => {
    const { userData } = useSupabaseAuth();
    const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [teamLeaders, setTeamLeaders] = useState<UserType[]>([]);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [totalCount, setTotalCount] = useState(0);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'credit' | 'debit'>('all');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [filterTL, setFilterTL] = useState<string>('all');
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

    // Bulk Actions
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isDeleting, setIsDeleting] = useState(false);

    // Initial Data Load (TLs)
    useEffect(() => {
        const fetchTeamLeaders = async () => {
            if (userData?.role === 'admin') {
                const { data } = await supabase
                    .from('users')
                    .select('*')
                    .eq('role', 'teamLeader');
                if (data) setTeamLeaders(data as UserType[]);
            }
        };
        fetchTeamLeaders();
    }, [userData?.role]);

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            // Permission Check
            if (userData?.role === 'teamLeader' && !userData?.permissions?.wallet?.viewHistory) {
                // Access Denied (Silent or UI handled)
                setTransactions([]);
                setTotalCount(0);
                setLoading(false);
                return;
            }

            let query = supabase
                .from('activity_logs')
                .select('*', { count: 'exact' })
                .eq('action_type', 'wallet_transaction');

            // Apply Filters
            if (filterType !== 'all') {
                // JSONB Filtering
                query = query.contains('metadata', { type: filterType });
            }

            if (searchTerm) {
                // Approximate search (Supabase text search is limited on JSONB without extra setup)
                // We'll search 'details' or 'performed_by'
                query = query.or(`details.ilike.%${searchTerm}%,performed_by.ilike.%${searchTerm}%`);
            }

            if (dateRange.start) {
                query = query.gte('timestamp', new Date(dateRange.start).toISOString());
            }
            if (dateRange.end) {
                const endDate = new Date(dateRange.end);
                endDate.setHours(23, 59, 59, 999);
                query = query.lte('timestamp', endDate.toISOString());
            }

            // Role-Based Access Control
            if (userData?.role === 'teamLeader') {
                // FORCE Filter by TL ID
                // Note: This relies on 'teamLeaderId' being present in metadata
                query = query.filter('metadata->>teamLeaderId', 'eq', userData.id);
            } else if (filterTL !== 'all') {
                // Admin Filter
                query = query.filter('metadata->>teamLeaderId', 'eq', filterTL);
            }

            // Pagination
            const from = (currentPage - 1) * pageSize;
            const to = from + pageSize - 1;

            const { data, count, error } = await query
                .order('timestamp', { ascending: false })
                .range(from, to);

            if (error) throw error;

            setTransactions(data as WalletTransaction[] || []);
            setTotalCount(count || 0);

        } catch (error) {
            console.error('Error fetching wallet history:', error);
            toast.error('Failed to load wallet history');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTransactions();
    }, [currentPage, pageSize, filterType, dateRange, filterTL, userData]); // Removed real-time sub for now to simplify pagination logic

    // Bulk Actions
    const toggleSelectAll = () => {
        if (selectedIds.length === transactions.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(transactions.map(t => t.id));
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handleBulkDelete = async () => {
        if (!confirm(`Are you sure you want to delete ${selectedIds.length} transactions? This is irreversible.`)) return;

        setIsDeleting(true);
        try {
            const { error } = await supabase
                .from('activity_logs')
                .delete()
                .in('id', selectedIds);

            if (error) throw error;

            toast.success(`Deleted ${selectedIds.length} records`);
            setSelectedIds([]);
            fetchTransactions();
        } catch (e) {
            console.error(e);
            toast.error('Failed to delete records');
        } finally {
            setIsDeleting(false);
        }
    };

    // Auto-Cleanup / Persistence Logic
    const handleCleanHistory = async () => {
        if (userData?.role !== 'admin') return;
        if (!confirm("This will aggregate transactions older than 3 days into 'Daily Collections' and DELETE the detailed logs. Continue?")) return;

        const loadingToast = toast.loading('Cleaning old history...');
        try {
            const threeDaysAgo = subDays(new Date(), 3);
            const cutoffDate = endOfDay(threeDaysAgo).toISOString();

            // 1. Fetch Old Logs (Batching might be needed for huge datasets, simple here)
            // We fetch ALL matching logs to aggregate. 
            // Warning: Limit to 1000 for safety in this version.
            const { data: oldLogs, error: fetchError } = await supabase
                .from('activity_logs')
                .select('*')
                .eq('action_type', 'wallet_transaction')
                .lte('timestamp', cutoffDate)
                .limit(1000);

            if (fetchError) throw fetchError;
            if (!oldLogs || oldLogs.length === 0) {
                toast.dismiss(loadingToast);
                toast.info('No old records to clean.');
                return;
            }

            // 2. Aggregate Data
            const aggregation = new Map<string, number>(); // Key: "TL_ID|DATE" -> Total Amount

            oldLogs.forEach((log: any) => {
                const tlId = log.metadata?.teamLeaderId;
                if (!tlId) return; // Skip logs without TL (System actions?)

                const dateStr = format(parseISO(log.timestamp), 'yyyy-MM-dd');
                const key = `${tlId}|${dateStr}`;

                const amount = Number(log.metadata?.amount) || 0;
                const type = log.metadata?.type;

                // Credit = Positive, Debit = Negative? 
                // Or "Collection" usually means Credits. 
                // Let's assume Daily Collection = Sum of Credits. Debits are separate?
                // Request says "Collection history". Usually implies Money In.
                if (type === 'credit') {
                    aggregation.set(key, (aggregation.get(key) || 0) + amount);
                }
            });

            // 3. Insert into daily_collections
            for (const [key, total] of aggregation.entries()) {
                const [tlId, date] = key.split('|');

                // Upsert logic (Atomic ideally, loop acceptable for Admin tool)
                // Check existing
                const { data: existing } = await supabase
                    .from('daily_collections')
                    .select('total_collection, id')
                    .eq('team_leader_id', tlId)
                    .eq('date', date)
                    .single();

                if (existing) {
                    await supabase.from('daily_collections').update({
                        total_collection: existing.total_collection + total,
                        updated_at: new Date().toISOString()
                    }).eq('id', existing.id);
                } else {
                    await supabase.from('daily_collections').insert({
                        team_leader_id: tlId,
                        date: date,
                        total_collection: total
                    });
                }
            }

            // 4. Delete Logs
            const idsToDelete = oldLogs.map((l: any) => l.id);
            const { error: delError } = await supabase
                .from('activity_logs')
                .delete()
                .in('id', idsToDelete);

            if (delError) throw delError;

            toast.dismiss(loadingToast);
            toast.success(`Archived & Deleted ${idsToDelete.length} records.`);
            fetchTransactions();

        } catch (error) {
            console.error(error);
            toast.dismiss(loadingToast);
            toast.error('Cleanup failed');
        }
    };

    // Calculate totals for displayed data
    const totalCredit = transactions.reduce((acc, t) => t.metadata?.type === 'credit' ? acc + (Number(t.metadata.amount) || 0) : acc, 0);
    const totalDebit = transactions.reduce((acc, t) => t.metadata?.type === 'debit' ? acc + (Number(t.metadata.amount) || 0) : acc, 0);

    // Permission Guard Return
    if (userData?.role === 'teamLeader' && !userData?.permissions?.wallet?.viewHistory) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center h-[50vh]">
                <div className="bg-red-100 p-4 rounded-full mb-4">
                    <AlertCircle size={48} className="text-red-500" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800">Access Denied</h2>
                <p className="text-gray-500 mt-2 max-w-md">You do not have permission to view Wallet History. Please contact your administrator.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-300 pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
                        <History className="text-primary" /> Wallet Transaction History
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Track rider wallet credits, debits, and bulk updates.
                    </p>
                </div>
                <div className="flex gap-2">
                    {userData?.role === 'admin' && (
                        <button
                            onClick={handleCleanHistory}
                            className="bg-orange-100 text-orange-700 hover:bg-orange-200 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                        >
                            <Trash2 size={16} /> Clean Old History
                        </button>
                    )}
                    <button onClick={() => fetchTransactions()} className="p-2 hover:bg-muted rounded-full transition-colors" title="Refresh">
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Stats Cards (Same as before) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <GlassCard className="p-6 flex items-center justify-between border-l-4 border-l-green-500">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Page Credit</p>
                        <h3 className="text-2xl font-bold text-green-600">+₹{totalCredit.toLocaleString()}</h3>
                    </div>
                    <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full text-green-600">
                        <ArrowUpRight size={24} />
                    </div>
                </GlassCard>
                <GlassCard className="p-6 flex items-center justify-between border-l-4 border-l-red-500">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Page Debit</p>
                        <h3 className="text-2xl font-bold text-red-600">-₹{totalDebit.toLocaleString()}</h3>
                    </div>
                    <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full text-red-600">
                        <ArrowDownLeft size={24} />
                    </div>
                </GlassCard>
                <GlassCard className="p-6 flex items-center justify-between border-l-4 border-l-blue-500">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Page Net Flow</p>
                        <h3 className={`text-2xl font-bold ${totalCredit - totalDebit >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                            {totalCredit - totalDebit >= 0 ? '+' : ''}₹{(totalCredit - totalDebit).toLocaleString()}
                        </h3>
                    </div>
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600">
                        <Wallet size={24} />
                    </div>
                </GlassCard>
            </div>

            {/* Filters Bar */}
            <GlassCard className="p-4">
                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row gap-4 justify-between">
                        {/* Search */}
                        <div className="relative flex-1 min-w-[250px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                            <input
                                type="text"
                                placeholder="Search details or performed by..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && fetchTransactions()}
                                className="w-full pl-10 pr-4 py-2.5 rounded-lg border bg-background/50 focus:ring-2 focus:ring-primary/20 outline-none"
                            />
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                                className={`px-4 py-2.5 border rounded-lg hover:bg-accent transition-all flex items-center gap-2 font-medium text-sm ${showAdvancedFilters ? 'bg-primary/5 border-primary text-primary shadow-sm' : 'border-input bg-background/50'}`}
                            >
                                <Filter size={18} /> Filters
                            </button>
                            {selectedIds.length > 0 && (
                                <button
                                    onClick={handleBulkDelete}
                                    disabled={isDeleting}
                                    className="px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all flex items-center gap-2 font-medium text-sm shadow-md"
                                >
                                    <Trash2 size={18} /> Delete ({selectedIds.length})
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Advanced Filters */}
                    {showAdvancedFilters && (
                        <div className="pt-4 border-t border-border/50 grid grid-cols-1 md:grid-cols-4 gap-4 animate-in slide-in-from-top-2">
                            <div>
                                <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Type</label>
                                <select
                                    value={filterType}
                                    onChange={(e) => setFilterType(e.target.value as any)}
                                    className="w-full px-3 py-2 rounded-lg border bg-background/50 outline-none focus:ring-2 focus:ring-primary/20"
                                >
                                    <option value="all">All Types</option>
                                    <option value="credit">Credits Only</option>
                                    <option value="debit">Debits Only</option>
                                </select>
                            </div>

                            {/* TL Filter (Admin Only) */}
                            {userData?.role === 'admin' && (
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Team Leader</label>
                                    <select
                                        value={filterTL}
                                        onChange={(e) => setFilterTL(e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border bg-background/50 outline-none focus:ring-2 focus:ring-primary/20"
                                    >
                                        <option value="all">All Team Leaders</option>
                                        {teamLeaders.map(tl => (
                                            <option key={tl.id} value={tl.id}>{tl.fullName}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="md:col-span-2">
                                <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Date Range</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="date"
                                        className="flex-1 px-3 py-2 rounded-lg border bg-background/50 outline-none text-sm"
                                        value={dateRange.start}
                                        onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                    />
                                    <span className="text-muted-foreground">-</span>
                                    <input
                                        type="date"
                                        className="flex-1 px-3 py-2 rounded-lg border bg-background/50 outline-none text-sm"
                                        value={dateRange.end}
                                        onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </GlassCard>

            {/* Table */}
            <GlassCard className="overflow-hidden">
                <div className="overflow-x-auto min-h-[400px]">
                    <div className="flex items-center justify-between p-4 border-b bg-muted/20">
                        <div className="text-sm text-muted-foreground">
                            Showing <span className="font-medium text-foreground">{transactions.length}</span> of <span className="font-medium text-foreground">{totalCount}</span> transactions
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Rows:</span>
                            <select
                                value={pageSize}
                                onChange={(e) => setPageSize(Number(e.target.value))}
                                className="bg-transparent border border-input rounded px-2 py-1 text-xs outline-none"
                            >
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>
                    </div>

                    <table className="w-full text-sm text-left">
                        <thead className="text-xs uppercase bg-muted/50 text-muted-foreground font-semibold">
                            <tr>
                                <th className="w-10 px-6 py-4">
                                    <button onClick={toggleSelectAll} className="hover:text-primary">
                                        {selectedIds.length > 0 && selectedIds.length === transactions.length ? <CheckSquare size={16} /> : <div className="w-4 h-4 border-2 border-muted-foreground rounded-sm" />}
                                    </button>
                                </th>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Rider</th>
                                <th className="px-6 py-4">Team Leader</th>
                                <th className="px-6 py-4">Type</th>
                                <th className="px-6 py-4 text-right">Amount</th>
                                <th className="px-6 py-4">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-24">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                                            <span className="text-muted-foreground text-sm">Loading transactions...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : transactions.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-24 text-muted-foreground">
                                        No transactions found matching your filters.
                                    </td>
                                </tr>
                            ) : (
                                transactions.map((t) => {
                                    const amount = Number(t.metadata?.amount) || 0;
                                    const isCredit = t.metadata?.type === 'credit';
                                    const riderName = t.metadata?.riderName || 'Unknown';
                                    const tlId = t.metadata?.teamLeaderId;
                                    // Map TL ID to Name if possible, else show ID or 'N/A'
                                    const tlName = teamLeaders.find(u => u.id === tlId)?.fullName || (userData?.role === 'teamLeader' ? userData.fullName : 'N/A');

                                    const isSelected = selectedIds.includes(t.id);

                                    return (
                                        <tr key={t.id} className={`hover:bg-muted/30 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}>
                                            <td className="px-6 py-4">
                                                <button onClick={() => toggleSelect(t.id)} className="text-muted-foreground hover:text-primary">
                                                    {isSelected ? <CheckSquare size={16} className="text-primary" /> : <div className="w-4 h-4 border-2 border-muted-foreground rounded-sm" />}
                                                </button>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{format(parseISO(t.timestamp), 'dd MMM yyyy')}</span>
                                                    <span className="text-xs text-muted-foreground">{format(parseISO(t.timestamp), 'hh:mm a')}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-medium">{riderName}</td>
                                            <td className="px-6 py-4 text-muted-foreground">
                                                {tlName !== 'N/A' ? (
                                                    <span className="flex items-center gap-1">
                                                        <User size={12} /> {tlName}
                                                    </span>
                                                ) : '-'}
                                            </td>
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
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                <div className="p-4 border-t bg-muted/20 flex items-center justify-between">
                    <button
                        disabled={currentPage === 1 || loading}
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        className="px-4 py-2 border rounded-lg hover:bg-background disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
                    >
                        <ChevronLeft size={16} /> Previous
                    </button>

                    <span className="text-sm font-medium">
                        Page {currentPage} of {Math.ceil(totalCount / pageSize) || 1}
                    </span>

                    <button
                        disabled={currentPage * pageSize >= totalCount || loading}
                        onClick={() => setCurrentPage(p => p + 1)}
                        className="px-4 py-2 border rounded-lg hover:bg-background disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
                    >
                        Next <ChevronRight size={16} />
                    </button>
                </div>
            </GlassCard>
        </div>
    );
};

export default WalletHistory;
