import React, { useEffect, useState } from 'react';
import { supabase } from '@/config/supabase';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import GlassCard from '@/components/GlassCard';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { History, Search, ArrowUpRight, ArrowDownLeft, RefreshCw, Wallet, Trash2, Filter, ChevronLeft, ChevronRight, User, AlertCircle, CheckSquare, Download } from 'lucide-react';
import { format, subDays, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { User as UserType } from '@/types';

interface WalletTransaction {
    id: string;
    rider_id: string;
    team_leader_id: string;
    amount: number;
    type: 'credit' | 'debit';
    description: string;
    metadata: any;
    performed_by: string;
    timestamp: string;
    riders?: { rider_name: string };
    users?: { full_name: string };
}

import { exportToCSV } from '@/utils/exportUtils';

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
    // Bulk Actions
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    // Initial Data Load (TLs)
    useEffect(() => {
        const fetchTeamLeaders = async () => {
            if (userData?.role === 'admin') {
                const { data } = await supabase
                    .from('users')
                    .select('*')
                    .eq('role', 'teamLeader');
                if (data) {
                    // Map DB snake_case to CamelCase for UserType
                    const mappedData = data.map((u: any) => ({
                        ...u,
                        fullName: u.full_name || u.fullName,
                        userId: u.user_id || u.userId,
                        // Add other mappings if needed, but fullName is critical for the dropdown
                    }));
                    setTeamLeaders(mappedData as UserType[]);
                }
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
                .from('wallet_transactions')
                .select(`
                    *,
                    riders (rider_name),
                    users (full_name)
                `, { count: 'exact' });

            // Apply Filters
            if (filterType !== 'all') {
                query = query.eq('type', filterType);
            }

            if (searchTerm) {
                // Approximate search
                query = query.or(`description.ilike.%${searchTerm}%,performed_by.ilike.%${searchTerm}%`);
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
                query = query.eq('team_leader_id', userData.id);
            } else if (filterTL !== 'all') {
                query = query.eq('team_leader_id', filterTL);
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

    // Export Functionality
    const handleExport = async () => {
        setIsExporting(true);
        const loadingToast = toast.loading('Preparing export...');
        try {
            // Replicate query logic for FULL dataset (no pagination)
            let query = supabase
                .from('wallet_transactions')
                .select(`*, riders(rider_name), users(full_name)`);

            // Apply Filters
            if (filterType !== 'all') {
                query = query.eq('type', filterType);
            }
            if (searchTerm) {
                query = query.or(`description.ilike.%${searchTerm}%,performed_by.ilike.%${searchTerm}%`);
            }
            if (dateRange.start) {
                query = query.gte('timestamp', new Date(dateRange.start).toISOString());
            }
            if (dateRange.end) {
                const endDate = new Date(dateRange.end);
                endDate.setHours(23, 59, 59, 999);
                query = query.lte('timestamp', endDate.toISOString());
            }

            // RBAC
            if (userData?.role === 'teamLeader') {
                query = query.eq('team_leader_id', userData.id);
            } else if (filterTL !== 'all') {
                query = query.eq('team_leader_id', filterTL);
            }

            const { data, error } = await query.order('timestamp', { ascending: false });
            if (error) throw error;

            if (!data || data.length === 0) {
                toast.info('No data to export');
                toast.dismiss(loadingToast);
                setIsExporting(false);
                return;
            }

            // Flatten Data for CSV
            const csvData = data.map((item: any) => ({
                Date: format(parseISO(item.timestamp), 'yyyy-MM-dd HH:mm:ss'),
                Rider: item.riders?.rider_name || 'N/A',
                'Team Leader': item.users?.full_name || 'N/A',
                Type: item.type || 'N/A',
                Amount: item.amount || 0,
                Details: item.description,
                Source: item.metadata?.source || 'Manual',
                'Performed By': item.performed_by
            }));

            // Export
            exportToCSV(csvData, `Wallet_History_Export_${format(new Date(), 'yyyyMMdd_HHmm')}`);
            toast.success('Export successful');
            toast.dismiss(loadingToast);

        } catch (error) {
            console.error('Export failed:', error);
            toast.error('Failed to export data');
            toast.dismiss(loadingToast);
        } finally {
            setIsExporting(false);
        }
    };

    // Safe Archive & Delete
    const handleCleanHistory = async () => {
        if (userData?.role !== 'admin') return;
        if (!confirm('This will ARCHIVE transactions older than 3 days to Daily Collections and then delete them from this list. Continue?')) return;

        const loadingToast = toast.loading('Archiving & Cleaning...');
        try {
            const threeDaysAgo = subDays(new Date(), 3);
            const cutoffDate = threeDaysAgo.toISOString();

            // Step 1: Fetch transactions to be archived
            const { data: oldData, error: fetchError } = await supabase
                .from('wallet_transactions')
                .select('*')
                .lt('timestamp', cutoffDate)
                .eq('type', 'credit'); // Only aggregate credits for collection

            if (fetchError) throw fetchError;

            if (!oldData || oldData.length === 0) {
                toast.dismiss(loadingToast);
                toast.info('No old records to clean.');
                return;
            }

            // Step 2: Aggregate by Date and Team Leader
            const aggregator: Record<string, number> = {}; // "TL_ID|DATE" -> Total

            oldData.forEach(tx => {
                const date = tx.timestamp.split('T')[0];
                const tlId = tx.team_leader_id;
                if (!tlId) return;

                const key = `${tlId}|${date}`;
                aggregator[key] = (aggregator[key] || 0) + Number(tx.amount);
            });

            // Step 3: Update Daily Collections (Upsert)
            const upsertPromises = Object.entries(aggregator).map(async ([key, total]) => {
                const [tlId, date] = key.split('|');

                const { data: existing } = await supabase
                    .from('daily_collections')
                    .select('total_collection')
                    .eq('team_leader_id', tlId)
                    .eq('date', date)
                    .single();

                const newTotal = (existing?.total_collection || 0) + total;

                return supabase
                    .from('daily_collections')
                    .upsert({
                        team_leader_id: tlId,
                        date: date,
                        total_collection: newTotal,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'team_leader_id,date' });
            });

            await Promise.all(upsertPromises);

            // Step 4: Delete from wallet_transactions
            const { error: delError } = await supabase
                .from('wallet_transactions')
                .delete()
                .lt('timestamp', cutoffDate);

            if (delError) throw delError;

            toast.dismiss(loadingToast);
            toast.success(`Archived & Cleaned successfully.`);
            fetchTransactions();

        } catch (error) {
            console.error(error);
            toast.dismiss(loadingToast);
            toast.error('Cleanup failed');
        }
    };

    // Calculate totals for displayed data
    const totalCredit = transactions.reduce((acc, t) => t.type === 'credit' ? acc + (Number(t.amount) || 0) : acc, 0);
    const totalDebit = transactions.reduce((acc, t) => t.type === 'debit' ? acc + (Number(t.amount) || 0) : acc, 0);

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
                    <button
                        onClick={handleExport}
                        disabled={isExporting || loading}
                        className="p-2 hover:bg-muted rounded-full transition-colors text-primary"
                        title="Export Data"
                    >
                        <Download size={20} className={isExporting ? 'animate-bounce' : ''} />
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
                                className={`px-4 py-2.5 border rounded-lg hover:bg-accent transition-all flex items-center gap-2 font-medium text-sm ${showAdvancedFilters ? 'bg-primary/10 border-primary text-primary shadow-sm' : 'border-input bg-card text-foreground'}`}
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
                                <SearchableSelect
                                    options={[
                                        { value: 'all', label: 'All Types' },
                                        { value: 'credit', label: 'Credits Only' },
                                        { value: 'debit', label: 'Debits Only' }
                                    ]}
                                    value={filterType}
                                    onChange={(val) => setFilterType(val as any)}
                                    placeholder="Select Type"
                                />
                            </div>

                            {/* TL Filter (Admin Only) */}
                            {userData?.role === 'admin' && (
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Team Leader</label>
                                    <SearchableSelect
                                        options={[
                                            { value: 'all', label: 'All Team Leaders' },
                                            ...teamLeaders.map(tl => ({ value: tl.id, label: tl.fullName }))
                                        ]}
                                        value={filterTL}
                                        onChange={(val) => setFilterTL(val)}
                                        placeholder="Select Team Leader"
                                        searchPlaceholder="Search Team Leader..."
                                    />
                                </div>
                            )}

                            <div className="md:col-span-2">
                                <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Date Range</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="date"
                                        className="flex-1 px-3 py-2 rounded-lg border border-input bg-white text-black dark:bg-slate-950 dark:text-white shadow-sm outline-none text-sm focus:ring-2 focus:ring-primary/20"
                                        style={{ colorScheme: 'light dark' }}
                                        value={dateRange.start}
                                        onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                    />
                                    <span className="text-muted-foreground font-bold">-</span>
                                    <input
                                        type="date"
                                        className="flex-1 px-3 py-2 rounded-lg border border-input bg-white text-black dark:bg-slate-950 dark:text-white shadow-sm outline-none text-sm focus:ring-2 focus:ring-primary/20"
                                        style={{ colorScheme: 'light dark' }}
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
                                className="bg-white dark:bg-slate-950 border border-input rounded px-2 py-1 text-xs outline-none text-slate-900 dark:text-slate-100"
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
                                    const amount = Number(t.amount) || 0;
                                    const isCredit = t.type === 'credit';
                                    const riderName = t.riders?.rider_name || 'Unknown';

                                    // Use joined data from query
                                    const tlName = t.users?.full_name || 'N/A';

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
                                                    {t.type}
                                                </span>
                                            </td>
                                            <td className={`px-6 py-4 text-right font-bold ${isCredit ? 'text-green-600' : 'text-red-600'}`}>
                                                {isCredit ? '+' : '-'}₹{amount.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-muted-foreground max-w-xs truncate" title={t.description}>
                                                {t.description}
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
