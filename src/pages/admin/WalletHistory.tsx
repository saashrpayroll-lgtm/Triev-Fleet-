import React, { useEffect, useState } from 'react';
import { supabase } from '@/config/supabase';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import GlassCard from '@/components/GlassCard';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { History, Search, ArrowUpRight, ArrowDownLeft, RefreshCw, Wallet, Download, Filter, ChevronLeft, ChevronRight, User, AlertCircle, Edit2, X, Calendar, Trash2, ShieldAlert, CheckSquare, Square } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { User as UserType } from '@/types';
import { exportToCSV } from '@/utils/exportUtils';

// Interface matching wallet_ledger view/table
interface LedgerEntry {
    id: string;
    rider_id: string;
    amount: number;
    transaction_type: 'SYSTEM_IMPORT' | 'MANUAL_ADJUSTMENT' | 'DAILY_COLLECTION' | 'SYSTEM_RENT_CHARGE';
    mode: 'ADD' | 'SUBTRACT' | 'SET' | 'RESET';
    description: string;
    metadata: any;
    created_at: string;
    riders?: {
        rider_name: string;
        team_leader_id?: string;
        users?: { full_name: string }; // Team Leader
    };
}

const WalletHistory: React.FC = () => {
    const { userData } = useSupabaseAuth();
    const [transactions, setTransactions] = useState<LedgerEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [teamLeaders, setTeamLeaders] = useState<UserType[]>([]);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [totalCount, setTotalCount] = useState(0);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<string>('all');
    const [filterMode, setFilterMode] = useState<string>('all');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [filterTL, setFilterTL] = useState<string>('all');
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

    const [isExporting, setIsExporting] = useState(false);

    // Edit Date State
    const [editingTransaction, setEditingTransaction] = useState<LedgerEntry | null>(null);
    const [newDate, setNewDate] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);
    const [isCleaning, setIsCleaning] = useState(false);

    // Multi-Selection for Bulk Delete
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    // Initial Data Load (TLs)
    useEffect(() => {
        const fetchTeamLeaders = async () => {
            if (userData?.role === 'admin') {
                const { data } = await supabase
                    .from('users')
                    .select('*')
                    .eq('role', 'teamLeader');
                if (data) {
                    const mappedData = data.map((u: any) => ({
                        ...u,
                        fullName: u.full_name || u.fullName,
                        userId: u.user_id || u.userId,
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
                setTransactions([]);
                setTotalCount(0);
                setLoading(false);
                return;
            }

            // Query wallet_ledger
            // Note: wallet_ledger is a simple table. We join riders to get name and TL info.
            let query = supabase
                .from('wallet_ledger')
                .select(`
                    *,
                    riders!inner (
                        rider_name,
                        team_leader_id,
                        users (full_name)
                    )
                `, { count: 'exact' });

            // Apply Filters
            if (filterType !== 'all') {
                query = query.eq('transaction_type', filterType);
            }

            if (searchTerm) {
                // Expanding search to Rider Name and Triev ID via joined table
                query = query.or(`description.ilike.%${searchTerm}%,riders.rider_name.ilike.%${searchTerm}%,riders.triev_id.ilike.%${searchTerm}%`);
            }

            if (filterMode !== 'all') {
                query = query.eq('mode', filterMode);
            }

            if (dateRange.start) {
                query = query.gte('created_at', new Date(dateRange.start).toISOString());
            }
            if (dateRange.end) {
                const endDate = new Date(dateRange.end);
                endDate.setHours(23, 59, 59, 999);
                query = query.lte('created_at', endDate.toISOString());
            }

            // Role-Based Access Control & TL Filter
            // Since TL ID is not in wallet_ledger, filtering by TL requires filtering on the joined 'riders' table.
            // Supabase supports filtering on joined tables with !inner
            if (userData?.role === 'teamLeader') {
                query = query.eq('riders.team_leader_id', userData.id);
            } else if (filterTL !== 'all') {
                query = query.eq('riders.team_leader_id', filterTL);
            }

            // Pagination
            const from = (currentPage - 1) * pageSize;
            const to = from + pageSize - 1;

            const { data, count, error } = await query
                .order('created_at', { ascending: false })
                .range(from, to);

            if (error) throw error;

            setTransactions(data as LedgerEntry[] || []);
            setTotalCount(count || 0);

        } catch (error) {
            console.error('Error fetching wallet ledger:', error);
            toast.error('Failed to load wallet ledger');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTransactions();
    }, [currentPage, pageSize, filterType, filterMode, dateRange, filterTL, userData]);

    // Export Functionality
    const handleExport = async () => {
        setIsExporting(true);
        const loadingToast = toast.loading('Preparing export...');
        try {
            let query = supabase
                .from('wallet_ledger')
                .select(`
                    *,
                    riders!inner (
                        rider_name,
                        team_leader_id,
                        users (full_name)
                    )
                `);

            // Apply Filters (Same as above)
            if (filterType !== 'all') query = query.eq('transaction_type', filterType);
            if (filterMode !== 'all') query = query.eq('mode', filterMode);
            if (searchTerm) {
                query = query.or(`description.ilike.%${searchTerm}%,riders.rider_name.ilike.%${searchTerm}%,riders.triev_id.ilike.%${searchTerm}%`);
            }
            if (dateRange.start) query = query.gte('created_at', new Date(dateRange.start).toISOString());
            if (dateRange.end) {
                const endDate = new Date(dateRange.end);
                endDate.setHours(23, 59, 59, 999);
                query = query.lte('created_at', endDate.toISOString());
            }
            if (userData?.role === 'teamLeader') {
                query = query.eq('riders.team_leader_id', userData.id);
            } else if (filterTL !== 'all') {
                query = query.eq('riders.team_leader_id', filterTL);
            }

            const { data, error } = await query.order('created_at', { ascending: false });
            if (error) throw error;

            if (!data || data.length === 0) {
                toast.dismiss(loadingToast);
                toast.info('No data to export');
                return;
            }

            const csvData = data.map((item: any) => ({
                Date: format(parseISO(item.created_at), 'yyyy-MM-dd HH:mm:ss'),
                Rider: item.riders?.rider_name || 'N/A',
                'Team Leader': item.riders?.users?.full_name || 'N/A',
                Type: item.transaction_type,
                Mode: item.mode,
                Amount: item.amount,
                Description: item.description,
                Source: item.metadata?.source || 'N/A'
            }));

            exportToCSV(csvData, `Wallet_Ledger_Export_${format(new Date(), 'yyyyMMdd_HHmm')}`);
            toast.success('Export successful');

        } catch (error) {
            console.error('Export failed:', error);
            toast.error('Failed to export data');
        } finally {
            toast.dismiss(loadingToast);
            setIsExporting(false);
        }
    };

    // Update Date Handler
    const handleUpdateDate = async () => {
        if (!editingTransaction || !newDate) return;

        setIsUpdating(true);
        try {
            const { error } = await supabase.rpc('update_wallet_transaction_date', {
                p_transaction_id: editingTransaction.id,
                p_new_date: new Date(newDate).toISOString()
            });

            if (error) throw error;

            toast.success('Transaction date updated successfully');
            setEditingTransaction(null);
            fetchTransactions(); // Refresh list & stats
        } catch (error: any) {
            console.error('Update failed:', error);
            toast.error(error.message || 'Failed to update date');
        } finally {
            setIsUpdating(false);
        }
    };

    // Delete Transaction Handler
    const handleDeleteTransaction = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this transaction? This will automatically update the Rider Wallet Balance and Daily Collections.')) {
            return;
        }

        try {
            const { error } = await supabase
                .from('wallet_ledger')
                .delete()
                .eq('id', id);

            if (error) throw error;

            toast.success('Transaction deleted successfully');
            fetchTransactions(); // Refresh list
        } catch (error: any) {
            console.error('Delete failed:', error);
            toast.error('Failed to delete transaction');
        }
    };

    // Maintenance Cleanup (RPC)
    const handleCleanup = async () => {
        if (!window.confirm('This will perform a "Smart Cleanup" of DAY OPENING BALANCE entries. Historical entries will be removed while carefully preserving the latest baseline for each rider. Proceed?')) {
            return;
        }

        setIsCleaning(true);
        const loadingToast = toast.loading('Performing smart cleanup...');
        try {
            const { data, error } = await supabase.rpc('cleanup_wallet_ledger');
            if (error) throw error;

            toast.success(`Smart cleanup successful: ${data.deleted_count} historical records removed.`, { id: loadingToast });
            fetchTransactions();
        } catch (error: any) {
            console.error('Cleanup failed:', error);
            toast.error('Cleanup failed: ' + error.message, { id: loadingToast });
        } finally {
            setIsCleaning(false);
        }
    };


    // Bulk Delete
    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} selected transactions? This cannot be undone and will affect rider balances.`)) {
            return;
        }

        const loadingToast = toast.loading(`Deleting ${selectedIds.length} transactions...`);
        try {
            const { error } = await supabase
                .from('wallet_ledger')
                .delete()
                .in('id', selectedIds);

            if (error) throw error;

            toast.success('Bulk deletion successful', { id: loadingToast });
            setSelectedIds([]);
            fetchTransactions();
        } catch (error: any) {
            console.error('Bulk delete failed:', error);
            toast.error('Failed to delete transactions', { id: loadingToast });
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === transactions.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(transactions.map(t => t.id));
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    // Calculate stats for CURRENT PAGE (Global stats would require separate aggregation query)
    const pageCredits = transactions.reduce((acc, t) => t.mode === 'ADD' ? acc + (Number(t.amount) || 0) : acc, 0);
    const pageDebits = transactions.reduce((acc, t) => t.mode === 'SUBTRACT' ? acc + (Number(t.amount) || 0) : acc, 0);

    if (userData?.role === 'teamLeader' && !userData?.permissions?.wallet?.viewHistory) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center h-[50vh]">
                <div className="bg-red-100 p-4 rounded-full mb-4">
                    <AlertCircle size={48} className="text-red-500" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800">Access Denied</h2>
                <p className="text-gray-500 mt-2 max-w-md">You do not have permission to view Wallet History.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-300 pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
                        <History className="text-primary" /> Wallet Ledger
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Immutable record of all wallet transactions.
                    </p>
                </div>
                <div className="flex gap-2">
                    {userData?.role === 'admin' && (
                        <button
                            onClick={handleCleanup}
                            disabled={isCleaning || loading}
                            className="px-4 py-2 bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded-lg hover:bg-amber-500/20 transition-all flex items-center gap-2 text-xs font-black uppercase tracking-widest"
                            title="Auto-cleanup Redundant Opening Balances"
                        >
                            <ShieldAlert size={16} /> Cleanup Openings
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

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <GlassCard className="p-6 flex items-center justify-between border-l-4 border-l-green-500">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Page Credits</p>
                        <h3 className="text-2xl font-bold text-green-600">+₹{pageCredits.toLocaleString()}</h3>
                    </div>
                    <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full text-green-600">
                        <ArrowUpRight size={24} />
                    </div>
                </GlassCard>
                <GlassCard className="p-6 flex items-center justify-between border-l-4 border-l-red-500">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Page Debits</p>
                        <h3 className="text-2xl font-bold text-red-600">-₹{pageDebits.toLocaleString()}</h3>
                    </div>
                    <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full text-red-600">
                        <ArrowDownLeft size={24} />
                    </div>
                </GlassCard>
                <GlassCard className="p-6 flex items-center justify-between border-l-4 border-l-blue-500">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Page Net Change</p>
                        <h3 className={`text-2xl font-bold ${pageCredits - pageDebits >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                            {pageCredits - pageDebits >= 0 ? '+' : ''}₹{(pageCredits - pageDebits).toLocaleString()}
                        </h3>
                    </div>
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600">
                        <Wallet size={24} />
                    </div>
                </GlassCard>
            </div>

            {/* Filters Bar */}
            <GlassCard className="p-4 relative z-30" overflowVisible>
                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row gap-4 justify-between">
                        {/* Search */}
                        <div className="relative flex-1 min-w-[250px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                            <input
                                type="text"
                                placeholder="Search description..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && fetchTransactions()}
                                className="w-full pl-10 pr-4 py-2.5 rounded-lg border bg-background/50 focus:ring-2 focus:ring-primary/20 outline-none"
                            />
                        </div>

                        {/* Filter Toggle */}
                        <div className="flex gap-2">
                            {(searchTerm || filterType !== 'all' || filterMode !== 'all' || filterTL !== 'all' || dateRange.start || dateRange.end) && (
                                <button
                                    onClick={() => {
                                        setSearchTerm('');
                                        setFilterType('all');
                                        setFilterMode('all');
                                        setFilterTL('all');
                                        setDateRange({ start: '', end: '' });
                                        setCurrentPage(1);
                                    }}
                                    className="px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 transition-all"
                                >
                                    <X size={16} /> Clear Filters
                                </button>
                            )}
                            <button
                                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                                className={`px-4 py-2.5 border rounded-lg hover:bg-accent transition-all flex items-center gap-2 font-medium text-sm ${showAdvancedFilters ? 'bg-primary/10 border-primary text-primary shadow-sm' : 'border-input bg-card text-foreground'}`}
                            >
                                <Filter size={18} /> Filters
                            </button>
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
                                        { value: 'DAILY_COLLECTION', label: 'Daily Collection' },
                                        { value: 'SYSTEM_RENT_CHARGE', label: 'System Rent Charge' },
                                        { value: 'DAY_OPENING_BALANCE', label: 'Day Opening Balance' },
                                        { value: 'MANUAL_ADJUSTMENT', label: 'Manual Adjustment' },
                                        { value: 'SYSTEM_IMPORT', label: 'System Import' }
                                    ]}
                                    value={filterType}
                                    onChange={(val) => setFilterType(val as any)}
                                    placeholder="Select Type"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Mode</label>
                                <SearchableSelect
                                    options={[
                                        { value: 'all', label: 'All Modes' },
                                        { value: 'ADD', label: 'ADD (Credits)' },
                                        { value: 'SUBTRACT', label: 'SUBTRACT (Debits)' },
                                        { value: 'SET', label: 'SET (Legacy)' },
                                        { value: 'RESET', label: 'RESET (New)' }
                                    ]}
                                    value={filterMode}
                                    onChange={(val) => setFilterMode(val as any)}
                                    placeholder="Select Mode"
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

                            <div className="md:col-span-1">
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
                        <div className="text-sm text-muted-foreground flex items-center gap-4">
                            <span>Showing <span className="font-medium text-foreground">{transactions.length}</span> of <span className="font-medium text-foreground">{totalCount}</span> entries</span>
                            {selectedIds.length > 0 && (
                                <div className="flex items-center gap-3 animate-in slide-in-from-left-2">
                                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-md font-bold text-xs">{selectedIds.length} Selected</span>
                                    <button
                                        onClick={handleBulkDelete}
                                        className="text-red-600 hover:text-red-700 font-black text-xs uppercase tracking-tighter flex items-center gap-1 border-b border-red-600/30"
                                    >
                                        <Trash2 size={14} /> Bulk Delete
                                    </button>
                                </div>
                            )}
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
                                <th className="px-6 py-4 w-10">
                                    <button onClick={toggleSelectAll} className="p-1 hover:bg-primary/10 rounded-md transition-colors text-muted-foreground">
                                        {selectedIds.length === transactions.length && transactions.length > 0 ? (
                                            <CheckSquare size={18} className="text-primary" />
                                        ) : (
                                            <Square size={18} />
                                        )}
                                    </button>
                                </th>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Rider</th>
                                <th className="px-6 py-4">Team Leader</th>
                                <th className="px-6 py-4">Mode</th>
                                <th className="px-6 py-4">Type</th>
                                <th className="px-6 py-4 text-right">Amount</th>
                                <th className="px-6 py-4">Description</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-24">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                                            <span className="text-muted-foreground text-sm">Loading ledger...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : transactions.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-24 text-muted-foreground">
                                        No ledger entries found.
                                    </td>
                                </tr>
                            ) : (
                                transactions.map((t) => {
                                    const amount = Number(t.amount) || 0;
                                    const isCredit = t.mode === 'ADD';
                                    const isDebit = t.mode === 'SUBTRACT';
                                    const isSet = t.mode === 'SET' || t.mode === 'RESET';

                                    return (
                                        <tr key={t.id} className={`hover:bg-muted/30 transition-colors group ${selectedIds.includes(t.id) ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}>
                                            <td className="px-6 py-4">
                                                <button onClick={() => toggleSelect(t.id)} className="p-1 hover:bg-primary/10 rounded-md transition-colors text-muted-foreground">
                                                    {selectedIds.includes(t.id) ? (
                                                        <CheckSquare size={18} className="text-primary" />
                                                    ) : (
                                                        <Square size={18} />
                                                    )}
                                                </button>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{format(parseISO(t.created_at), 'dd MMM yyyy')}</span>
                                                    <span className="text-xs text-muted-foreground">{format(parseISO(t.created_at), 'hh:mm a')}</span>
                                                </div>
                                                {/* Edit Date Button (Only for Daily Collection & Admin) */}
                                                {userData?.role === 'admin' && (
                                                    <div className="flex items-center gap-1 mt-1">
                                                        {t.transaction_type === 'DAILY_COLLECTION' && (
                                                            <button
                                                                onClick={() => {
                                                                    setEditingTransaction(t);
                                                                    // Set initial value to current transaction time (local format for input)
                                                                    const date = new Date(t.created_at);
                                                                    // Format: YYYY-MM-DDTHH:mm
                                                                    const localIso = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
                                                                    setNewDate(localIso);
                                                                }}
                                                                className="p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                                                title="Edit Date"
                                                            >
                                                                <Edit2 size={12} />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteTransaction(t.id);
                                                            }}
                                                            className="p-1 text-muted-foreground hover:text-red-600 hover:bg-red-500/10 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                                            title="Delete Transaction"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 font-medium" onClick={() => toggleSelect(t.id)}>{t.riders?.rider_name || 'Unknown'}</td>
                                            <td className="px-6 py-4 text-muted-foreground">
                                                {t.riders?.users?.full_name ? (
                                                    <span className="flex items-center gap-1">
                                                        <User size={12} /> {t.riders.users.full_name}
                                                    </span>
                                                ) : '-'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold capitalize ${isCredit ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                    isDebit ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                        'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                    }`}>
                                                    {isCredit && <ArrowUpRight size={12} />}
                                                    {isDebit && <ArrowDownLeft size={12} />}
                                                    {isSet && <RefreshCw size={12} />}
                                                    {t.mode}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-xs font-mono bg-muted px-2 py-1 rounded">
                                                    {t.transaction_type ? t.transaction_type.replace(/_/g, ' ') : 'Unknown'}
                                                </span>
                                            </td>
                                            <td className={`px-6 py-4 text-right font-bold ${isCredit ? 'text-green-600' :
                                                isDebit ? 'text-red-600' :
                                                    'text-blue-600'
                                                }`}>
                                                {isCredit ? '+' : isDebit ? '-' : '='}₹{amount.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-muted-foreground max-w-xs truncate" title={t.description}>
                                                {t.description}
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
            {/* Edit Date Modal */}
            {editingTransaction && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <Calendar className="text-primary" size={20} /> Edit Transaction Date
                            </h3>
                            <button
                                onClick={() => setEditingTransaction(null)}
                                className="p-1 hover:bg-muted rounded-full transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="bg-muted/30 p-4 rounded-lg text-sm space-y-2">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Rider:</span>
                                <span className="font-medium">{editingTransaction.riders?.rider_name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Amount:</span>
                                <span className="font-bold">₹{editingTransaction.amount}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Current Date:</span>
                                <span>{format(parseISO(editingTransaction.created_at), 'dd MMM yyyy, hh:mm a')}</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">New Date & Time</label>
                            <input
                                type="datetime-local"
                                value={newDate}
                                onChange={(e) => setNewDate(e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                                style={{ colorScheme: 'light dark' }}
                            />
                            <p className="text-xs text-muted-foreground">
                                Changing the date will move this transaction in the ledger and update Daily Collection reports accordingly.
                            </p>
                        </div>

                        <div className="flex gap-3 justify-end pt-2">
                            <button
                                onClick={() => setEditingTransaction(null)}
                                className="px-4 py-2 text-sm font-medium hover:bg-muted rounded-lg transition-colors"
                                disabled={isUpdating}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpdateDate}
                                disabled={isUpdating || !newDate}
                                className="px-4 py-2 text-sm font-bold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
                            >
                                {isUpdating ? <RefreshCw className="animate-spin" size={16} /> : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

export default WalletHistory;
