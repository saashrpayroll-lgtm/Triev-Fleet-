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
import { motion, AnimatePresence } from 'framer-motion';

// Interface matching wallet_ledger view/table
interface LedgerEntry {
    id: string;
    rider_id: string;
    amount: number;
    transaction_type: 'SYSTEM_IMPORT' | 'MANUAL_ADJUSTMENT' | 'DAILY_COLLECTION' | 'SYSTEM_RENT_CHARGE' | 'DAY_OPENING_BALANCE' | 'RENT_COLLECTION' | 'FTD_COLLECTION';
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

    // Multi-Selection for Bulk Delete & Bulk Edit
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    // Bulk Edit Date State
    const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
    const [bulkNewDate, setBulkNewDate] = useState('');
    const [isBulkUpdating, setIsBulkUpdating] = useState(false);

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
        if (!window.confirm('This will perform a "Smart Cleanup" of DAY OPENING BALANCE entries. Historical entries from ALL previous dates will be completely removed, keeping only today\'s initial balances. This reduces clutter and optimizes performance. Proceed?')) {
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

    // Bulk Update Date Handler
    const handleBulkUpdateDate = async () => {
        if (selectedIds.length === 0 || !bulkNewDate) return;

        setIsBulkUpdating(true);
        try {
            const { error } = await supabase.rpc('bulk_update_wallet_transaction_date', {
                p_transaction_ids: selectedIds,
                p_new_date: new Date(bulkNewDate).toISOString()
            });

            if (error) throw error;

            toast.success(`Successfully updated ${selectedIds.length} transaction dates`);
            setIsBulkEditModalOpen(false);
            setSelectedIds([]);
            fetchTransactions(); // Refresh list & stats
        } catch (error: any) {
            console.error('Bulk update failed:', error);
            toast.error(error.message || 'Failed to bulk update dates');
        } finally {
            setIsBulkUpdating(false);
        }
    };

    // Bulk Delete
    const handleBulkDelete = async () => {
        if (userData?.role !== 'admin') {
            toast.error('Only Admins can perform bulk deletions.');
            return;
        }
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

    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        show: { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } }
    };

    if (userData?.role === 'teamLeader' && !userData?.permissions?.wallet?.viewHistory) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center h-[50vh]">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-red-500/10 p-6 rounded-full mb-6 border border-red-500/20"
                >
                    <AlertCircle size={64} className="text-red-500" />
                </motion.div>
                <h2 className="text-3xl font-bold text-foreground tracking-tight">Access Denied</h2>
                <p className="text-muted-foreground mt-3 max-w-md text-lg">You do not have permission to view the Wallet Ledger.</p>
            </div>
        );
    }

    return (
        <motion.div
            className="space-y-6 pb-20"
            variants={containerVariants}
            initial="hidden"
            animate="show"
        >
            <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
                        <History className="text-primary" /> Wallet Ledger
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm font-medium">
                        Immutable record of all wallet transactions and daily balances.
                    </p>
                </div>
                <div className="flex gap-2">
                    {userData?.role === 'admin' && (
                        <button
                            onClick={handleCleanup}
                            disabled={isCleaning || loading}
                            className="px-4 py-2 bg-gradient-to-r from-amber-500/10 to-orange-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-xl hover:bg-amber-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 text-xs font-black uppercase tracking-widest shadow-sm"
                            title="Auto-cleanup Stale Opening Balances"
                        >
                            <ShieldAlert size={16} className={isCleaning ? "animate-pulse" : ""} /> {isCleaning ? 'Cleaning...' : 'Cleanup DB'}
                        </button>
                    )}
                    <button onClick={() => fetchTransactions()} className="p-2 bg-card border border-border hover:bg-muted rounded-xl transition-all shadow-sm hover:shadow-md active:scale-95" title="Refresh">
                        <RefreshCw size={20} className={`text-primary ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={isExporting || loading}
                        className="p-2 bg-primary/10 border border-primary/20 hover:bg-primary/20 rounded-xl transition-all shadow-sm hover:shadow-md active:scale-95 text-primary"
                        title="Export Data"
                    >
                        <Download size={20} className={isExporting ? 'animate-bounce' : ''} />
                    </button>
                </div>
            </motion.div>

            {/* Stats Cards */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <GlassCard className="p-6 flex items-center justify-between border-l-4 border-l-green-500 bg-gradient-to-br from-card to-green-500/5 hover:shadow-lg transition-all">
                    <div>
                        <p className="text-xs tracking-wider font-bold text-muted-foreground uppercase">Page Credits</p>
                        <h3 className="text-3xl font-black text-green-600 mt-1 drop-shadow-sm">+₹{pageCredits.toLocaleString()}</h3>
                    </div>
                    <div className="p-4 bg-green-500/10 dark:bg-green-500/20 rounded-2xl text-green-600 shadow-inner">
                        <ArrowUpRight size={28} strokeWidth={2.5} />
                    </div>
                </GlassCard>
                <GlassCard className="p-6 flex items-center justify-between border-l-4 border-l-red-500 bg-gradient-to-br from-card to-red-500/5 hover:shadow-lg transition-all">
                    <div>
                        <p className="text-xs tracking-wider font-bold text-muted-foreground uppercase">Page Debits</p>
                        <h3 className="text-3xl font-black text-red-600 mt-1 drop-shadow-sm">-₹{pageDebits.toLocaleString()}</h3>
                    </div>
                    <div className="p-4 bg-red-500/10 dark:bg-red-500/20 rounded-2xl text-red-600 shadow-inner">
                        <ArrowDownLeft size={28} strokeWidth={2.5} />
                    </div>
                </GlassCard>
                <GlassCard className="p-6 flex items-center justify-between border-l-4 border-l-blue-500 bg-gradient-to-br from-card to-blue-500/5 hover:shadow-lg transition-all">
                    <div>
                        <p className="text-xs tracking-wider font-bold text-muted-foreground uppercase">Page Net Change</p>
                        <h3 className={`text-3xl font-black mt-1 drop-shadow-sm ${pageCredits - pageDebits >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                            {pageCredits - pageDebits >= 0 ? '+' : ''}₹{(pageCredits - pageDebits).toLocaleString()}
                        </h3>
                    </div>
                    <div className="p-4 bg-blue-500/10 dark:bg-blue-500/20 rounded-2xl text-blue-600 shadow-inner">
                        <Wallet size={28} strokeWidth={2.5} />
                    </div>
                </GlassCard>
            </motion.div>

            {/* Filters Bar */}
            <motion.div variants={itemVariants} className="relative z-30">
                <GlassCard className="p-4" overflowVisible>
                    <div className="space-y-4">
                        <div className="flex flex-col md:flex-row gap-4 justify-between">
                            {/* Search */}
                            <div className="relative flex-1 min-w-[250px] group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={18} />
                                <input
                                    type="text"
                                    placeholder="Search description, rider name, or Triev ID..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && fetchTransactions()}
                                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-background/50 hover:bg-background/80 focus:bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-sm"
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
                                        className="px-4 py-3 text-sm font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl flex items-center gap-2 transition-all shadow-sm"
                                    >
                                        <X size={16} strokeWidth={2.5} /> Clear
                                    </button>
                                )}
                                <button
                                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                                    className={`px-5 py-3 border rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 font-bold text-sm shadow-sm ${showAdvancedFilters ? 'bg-primary/10 border-primary/50 text-primary' : 'border-border bg-card hover:bg-accent text-foreground'}`}
                                >
                                    <Filter size={18} /> Filters
                                </button>
                            </div>
                        </div>

                        {/* Advanced Filters */}
                        <AnimatePresence>
                            {showAdvancedFilters && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="pt-4 mt-2 border-t border-border/50 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                        <div>
                                            <label className="text-xs font-bold tracking-wider text-muted-foreground uppercase mb-1.5 block">Record Type</label>
                                            <SearchableSelect
                                                options={[
                                                    { value: 'all', label: 'All Types' },
                                                    { value: 'DAILY_COLLECTION', label: 'Daily Collection' },
                                                    { value: 'RENT_COLLECTION', label: 'Rent Collection' },
                                                    { value: 'FTD_COLLECTION', label: 'FTD Collection' },
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
                                            <label className="text-xs font-bold tracking-wider text-muted-foreground uppercase mb-1.5 block">Mode</label>
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
                                                <label className="text-xs font-bold tracking-wider text-muted-foreground uppercase mb-1.5 block">Team Leader</label>
                                                <SearchableSelect
                                                    options={[
                                                        { value: 'all', label: 'All Team Leaders' },
                                                        ...teamLeaders.map(tl => ({ value: tl.id, label: tl.fullName }))
                                                    ]}
                                                    value={filterTL}
                                                    onChange={(val) => setFilterTL(val)}
                                                    placeholder="Select Team Leader"
                                                    searchPlaceholder="Search TL..."
                                                />
                                            </div>
                                        )}

                                        <div className="md:col-span-1">
                                            <label className="text-xs font-bold tracking-wider text-muted-foreground uppercase mb-1.5 block">Date Range</label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="date"
                                                    className="flex-1 px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-sm"
                                                    style={{ colorScheme: 'light dark' }}
                                                    value={dateRange.start}
                                                    onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                                />
                                                <span className="text-muted-foreground font-bold">-</span>
                                                <input
                                                    type="date"
                                                    className="flex-1 px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-sm"
                                                    style={{ colorScheme: 'light dark' }}
                                                    value={dateRange.end}
                                                    onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </GlassCard>
            </motion.div>

            {/* Table */}
            <motion.div variants={itemVariants}>
                <GlassCard className="overflow-hidden shadow-md">
                    <div className="overflow-x-auto min-h-[400px]">
                        <div className="flex items-center justify-between p-4 border-b border-border/50 bg-muted/10">
                            <div className="text-sm text-muted-foreground flex items-center gap-4">
                                <span>Showing <span className="font-bold text-foreground">{transactions.length}</span> of <span className="font-bold text-foreground">{totalCount}</span> entries</span>

                                <AnimatePresence>
                                    {selectedIds.length > 0 && userData?.role === 'admin' && (
                                        <motion.div
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -10 }}
                                            className="flex items-center gap-3 bg-card p-1.5 rounded-lg ml-2 shadow-sm border border-border"
                                        >
                                            <span className="bg-primary text-primary-foreground px-2.5 py-1 rounded-md font-bold text-xs">{selectedIds.length} Selected</span>
                                            <button
                                                onClick={() => {
                                                    setBulkNewDate(''); // Clear on open
                                                    setIsBulkEditModalOpen(true);
                                                }}
                                                className="hover:bg-primary/10 text-primary px-3 py-1.5 rounded-md font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                                            >
                                                <Calendar size={14} /> Bulk Edit Date
                                            </button>
                                            <button
                                                onClick={handleBulkDelete}
                                                className="hover:bg-red-500/10 text-red-600 dark:text-red-400 px-3 py-1.5 rounded-md font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                                            >
                                                <Trash2 size={14} /> Bulk Delete
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Rows:</span>
                                <select
                                    value={pageSize}
                                    onChange={(e) => setPageSize(Number(e.target.value))}
                                    className="bg-card border border-border rounded-lg px-3 py-1.5 text-sm font-medium outline-none text-foreground focus:ring-2 focus:ring-primary/20 transition-all shadow-sm cursor-pointer"
                                >
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                            </div>
                        </div>

                        <table className="w-full text-sm text-left">
                            <thead className="text-xs uppercase bg-muted/30 text-muted-foreground font-black tracking-wider border-b border-border/50">
                                <tr>
                                    {userData?.role === 'admin' && (
                                        <th className="px-5 py-4 w-12">
                                            <button onClick={toggleSelectAll} className="p-1 hover:bg-primary/10 rounded-md transition-colors text-muted-foreground">
                                                {selectedIds.length === transactions.length && transactions.length > 0 ? (
                                                    <CheckSquare size={18} className="text-primary" />
                                                ) : (
                                                    <Square size={18} />
                                                )}
                                            </button>
                                        </th>
                                    )}
                                    <th className="px-5 py-4 whitespace-nowrap">Date / Time</th>
                                    <th className="px-5 py-4">Rider</th>
                                    <th className="px-5 py-4">Team Leader</th>
                                    <th className="px-5 py-4">Mode</th>
                                    <th className="px-5 py-4">Type</th>
                                    <th className="px-5 py-4 text-right">Amount</th>
                                    <th className="px-5 py-4">Description</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/30">
                                {loading ? (
                                    <tr>
                                        <td colSpan={userData?.role === 'admin' ? 8 : 7} className="text-center py-32">
                                            <div className="flex flex-col items-center gap-4">
                                                <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                                                <span className="text-muted-foreground text-sm font-medium animate-pulse">Loading ledger data...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : transactions.length === 0 ? (
                                    <tr>
                                        <td colSpan={userData?.role === 'admin' ? 8 : 7} className="text-center py-32 text-muted-foreground flex flex-col items-center justify-center">
                                            <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mb-4">
                                                <Search className="text-muted-foreground/50 w-8 h-8" />
                                            </div>
                                            <span className="font-medium text-lg">No entries found</span>
                                            <span className="text-sm mt-1">Try adjusting your filters</span>
                                        </td>
                                    </tr>
                                ) : (
                                    transactions.map((t, index) => {
                                        const amount = Number(t.amount) || 0;
                                        const isCredit = t.mode === 'ADD';
                                        const isDebit = t.mode === 'SUBTRACT';
                                        const isSet = t.mode === 'SET' || t.mode === 'RESET';

                                        return (
                                            <motion.tr
                                                key={t.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: Math.min(index * 0.02, 0.2) }}
                                                className={`hover:bg-muted/40 transition-colors group ${selectedIds.includes(t.id) ? 'bg-primary/5 dark:bg-primary/10' : ''}`}
                                            >
                                                {userData?.role === 'admin' && (
                                                    <td className="px-5 py-4">
                                                        <button onClick={() => toggleSelect(t.id)} className="p-1 hover:bg-primary/10 rounded-md transition-colors text-muted-foreground">
                                                            {selectedIds.includes(t.id) ? (
                                                                <CheckSquare size={18} className="text-primary" />
                                                            ) : (
                                                                <Square size={18} className="group-hover:text-foreground/50 transition-colors" />
                                                            )}
                                                        </button>
                                                    </td>
                                                )}
                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-[13px]">{format(parseISO(t.created_at), 'dd MMM yyyy')}</span>
                                                        <span className="text-[11px] font-medium text-muted-foreground bg-muted/50 w-fit px-1.5 py-0.5 rounded mt-0.5">
                                                            {format(parseISO(t.created_at), 'hh:mm a')}
                                                        </span>
                                                    </div>
                                                    {/* Edit Date Button (Only for Daily/Rent Collection & Admin) */}
                                                    {userData?.role === 'admin' && (
                                                        <div className="flex items-center gap-1 mt-1.5">
                                                            {['DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION'].includes(t.transaction_type) && (
                                                                <button
                                                                    onClick={() => {
                                                                        setEditingTransaction(t);
                                                                        const date = new Date(t.created_at);
                                                                        const localIso = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
                                                                        setNewDate(localIso);
                                                                    }}
                                                                    className="p-1 text-muted-foreground/50 hover:text-primary hover:bg-primary/10 rounded-md transition-all opacity-0 group-hover:opacity-100"
                                                                    title="Edit Date"
                                                                >
                                                                    <Edit2 size={14} />
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDeleteTransaction(t.id);
                                                                }}
                                                                className="p-1 text-muted-foreground/50 hover:text-red-500 hover:bg-red-500/10 rounded-md transition-all opacity-0 group-hover:opacity-100"
                                                                title="Delete Transaction"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-5 py-4" onClick={() => toggleSelect(t.id)}>
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-[14px]">{t.riders?.rider_name || 'Unknown'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 text-muted-foreground">
                                                    {t.riders?.users?.full_name ? (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/50 border border-border text-[12px] font-medium">
                                                            <User size={12} className="text-primary" /> {t.riders.users.full_name}
                                                        </span>
                                                    ) : '-'}
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black capitalize tracking-wider shadow-sm border ${isCredit ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20' :
                                                        isDebit ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20' :
                                                            'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20'
                                                        }`}>
                                                        {isCredit && <ArrowUpRight size={12} strokeWidth={3} />}
                                                        {isDebit && <ArrowDownLeft size={12} strokeWidth={3} />}
                                                        {isSet && <RefreshCw size={12} strokeWidth={3} />}
                                                        {t.mode}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className={`text-[11px] font-bold tracking-wider uppercase px-2 py-1 rounded-md border ${t.transaction_type === 'DAY_OPENING_BALANCE' ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20' :
                                                        'bg-muted/50 border-border/50 text-foreground/70'
                                                        }`}>
                                                        {t.transaction_type ? t.transaction_type.replace(/_/g, ' ') : 'Unknown'}
                                                    </span>
                                                </td>
                                                <td className={`px-5 py-4 text-right font-black text-[15px] ${isCredit ? 'text-green-600 dark:text-green-500' :
                                                    isDebit ? 'text-red-600 dark:text-red-500' :
                                                        'text-blue-600 dark:text-blue-500'
                                                    }`}>
                                                    {isCredit ? '+' : isDebit ? '-' : ''}₹{amount.toLocaleString()}
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className="text-[13px] text-muted-foreground line-clamp-2 max-w-[200px]" title={t.description}>
                                                        {t.description}
                                                    </span>
                                                </td>
                                            </motion.tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Controls */}
                    <div className="p-4 border-t border-border/50 bg-muted/10 flex items-center justify-between">
                        <button
                            disabled={currentPage === 1 || loading}
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            className="px-4 py-2 border border-border bg-card rounded-xl hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-bold shadow-sm transition-all active:scale-95"
                        >
                            <ChevronLeft size={16} /> Prev
                        </button>

                        <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-muted-foreground mr-2">Page</span>
                            <div className="bg-primary/10 text-primary px-3 py-1 rounded-lg font-black text-sm">
                                {currentPage}
                            </div>
                            <span className="text-sm font-medium text-muted-foreground mx-1">of</span>
                            <span className="text-sm font-bold">{Math.ceil(totalCount / pageSize) || 1}</span>
                        </div>

                        <button
                            disabled={currentPage * pageSize >= totalCount || loading}
                            onClick={() => setCurrentPage(p => p + 1)}
                            className="px-4 py-2 border border-border bg-card rounded-xl hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-bold shadow-sm transition-all active:scale-95"
                        >
                            Next <ChevronRight size={16} />
                        </button>
                    </div>
                </GlassCard>
            </motion.div>

            {/* Bulk Edit Date Modal */}
            <AnimatePresence>
                {isBulkEditModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ backdropFilter: 'blur(0px)', backgroundColor: 'rgba(0,0,0,0)' }}
                            animate={{ backdropFilter: 'blur(4px)', backgroundColor: 'rgba(0,0,0,0.5)' }}
                            exit={{ backdropFilter: 'blur(0px)', backgroundColor: 'rgba(0,0,0,0)' }}
                            className="absolute inset-0"
                            onClick={() => setIsBulkEditModalOpen(false)}
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="bg-card border border-border/50 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative z-10"
                        >
                            {/* Header */}
                            <div className="p-6 border-b border-border/50 bg-muted/20 flex justify-between items-center">
                                <h3 className="text-xl font-black flex items-center gap-2.5">
                                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                        <Calendar size={20} />
                                    </div>
                                    Bulk Edit Dates
                                </h3>
                                <button
                                    onClick={() => setIsBulkEditModalOpen(false)}
                                    className="p-2 hover:bg-foreground/5 rounded-full transition-colors text-muted-foreground"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-6 space-y-5">
                                <div className="bg-primary/5 p-4 rounded-xl border border-primary/20 flex items-center justify-between shadow-inner">
                                    <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Selected Records</span>
                                    <span className="font-black text-2xl text-primary">{selectedIds.length}</span>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">New Date & Time</label>
                                    <input
                                        type="datetime-local"
                                        value={bulkNewDate}
                                        onChange={(e) => setBulkNewDate(e.target.value)}
                                        className="w-full px-4 py-3 border border-border rounded-xl bg-background/50 focus:bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
                                        style={{ colorScheme: 'light dark' }}
                                    />
                                    <p className="text-[13px] text-muted-foreground leading-relaxed mt-2 bg-muted/30 p-3 rounded-lg border border-border/50">
                                        <AlertCircle size={14} className="inline mr-1.5 -mt-0.5 text-primary" />
                                        Changing the date will move all selected transactions and update Daily Collection reports accordingly.
                                    </p>
                                </div>
                            </div>

                            <div className="p-6 pt-4 border-t border-border/50 bg-muted/10 flex justify-end gap-3">
                                <button
                                    onClick={() => setIsBulkEditModalOpen(false)}
                                    className="px-5 py-2.5 text-sm font-bold hover:bg-muted border border-transparent rounded-xl transition-colors"
                                    disabled={isBulkUpdating}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleBulkUpdateDate}
                                    disabled={isBulkUpdating || !bulkNewDate}
                                    className="px-6 py-2.5 text-sm font-bold bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all flex items-center gap-2 shadow-lg hover:shadow-primary/25 disabled:opacity-50 active:scale-95"
                                >
                                    {isBulkUpdating ? <RefreshCw className="animate-spin" size={18} /> : 'Update Dates'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Edit Date Modal */}
            <AnimatePresence>
                {editingTransaction && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ backdropFilter: 'blur(0px)', backgroundColor: 'rgba(0,0,0,0)' }}
                            animate={{ backdropFilter: 'blur(4px)', backgroundColor: 'rgba(0,0,0,0.5)' }}
                            exit={{ backdropFilter: 'blur(0px)', backgroundColor: 'rgba(0,0,0,0)' }}
                            className="absolute inset-0"
                            onClick={() => setEditingTransaction(null)}
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="bg-card border border-border/50 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative z-10"
                        >
                            {/* Header */}
                            <div className="p-6 border-b border-border/50 bg-muted/20 flex justify-between items-center">
                                <h3 className="text-xl font-black flex items-center gap-2.5">
                                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                        <Edit2 size={20} />
                                    </div>
                                    Edit Date
                                </h3>
                                <button
                                    onClick={() => setEditingTransaction(null)}
                                    className="p-2 hover:bg-foreground/5 rounded-full transition-colors text-muted-foreground"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-6 space-y-5">
                                <div className="bg-muted/30 p-4 rounded-xl text-sm space-y-3 border border-border/50">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Rider</span>
                                        <span className="font-bold text-[15px]">{editingTransaction.riders?.rider_name}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Amount</span>
                                        <span className="font-black text-[16px] text-green-600 dark:text-green-500">₹{editingTransaction.amount}</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-2 border-t border-border/50">
                                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Current</span>
                                        <span className="font-mono text-xs font-medium bg-background px-2 py-1 rounded-md">{format(parseISO(editingTransaction.created_at), 'dd MMM yyyy, hh:mm a')}</span>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">New Date & Time</label>
                                    <input
                                        type="datetime-local"
                                        value={newDate}
                                        onChange={(e) => setNewDate(e.target.value)}
                                        className="w-full px-4 py-3 border border-border rounded-xl bg-background/50 focus:bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
                                        style={{ colorScheme: 'light dark' }}
                                    />
                                    <p className="text-[13px] text-muted-foreground leading-relaxed mt-2 bg-muted/30 p-3 rounded-lg border border-border/50">
                                        <AlertCircle size={14} className="inline mr-1.5 -mt-0.5 text-primary" />
                                        Changing the date will modify this transaction's position in the ledger and recalculate daily stats.
                                    </p>
                                </div>
                            </div>

                            <div className="p-6 pt-4 border-t border-border/50 bg-muted/10 flex justify-end gap-3">
                                <button
                                    onClick={() => setEditingTransaction(null)}
                                    className="px-5 py-2.5 text-sm font-bold hover:bg-muted border border-transparent rounded-xl transition-colors"
                                    disabled={isUpdating}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleUpdateDate}
                                    disabled={isUpdating || !newDate}
                                    className="px-6 py-2.5 text-sm font-bold bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all flex items-center gap-2 shadow-lg hover:shadow-primary/25 disabled:opacity-50 active:scale-95"
                                >
                                    {isUpdating ? <RefreshCw className="animate-spin" size={18} /> : 'Save Changes'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default WalletHistory;
