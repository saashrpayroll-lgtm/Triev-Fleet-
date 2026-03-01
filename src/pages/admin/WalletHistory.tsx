import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/config/supabase';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import GlassCard from '@/components/GlassCard';
import SearchableSelect from '@/components/ui/SearchableSelect';
import {
    History, Search, ArrowUpRight, ArrowDownLeft, RefreshCw, Wallet,
    Download, Filter, ChevronLeft, ChevronRight, User, AlertCircle,
    Edit2, X, Calendar, Trash2, ShieldAlert, CheckSquare, Square, Sparkles, RotateCcw
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { User as UserType } from '@/types';
import { exportToCSV } from '@/utils/exportUtils';

interface LedgerEntry {
    id: string;
    rider_id: string;
    amount: number;
    transaction_type: 'SYSTEM_IMPORT' | 'MANUAL_ADJUSTMENT' | 'DAILY_COLLECTION' | 'SYSTEM_RENT_CHARGE' | 'DAY_OPENING_BALANCE' | string;
    mode: 'ADD' | 'SUBTRACT' | 'SET' | 'RESET';
    description: string;
    metadata: any;
    created_at: string;
    riders?: {
        rider_name: string;
        team_leader_id?: string;
        users?: { full_name: string };
    };
}

const MODE_CONFIG = {
    ADD: { label: 'ADD', icon: ArrowUpRight, cls: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25', amtCls: 'text-emerald-600 dark:text-emerald-400', prefix: '+' },
    SUBTRACT: { label: 'DEBIT', icon: ArrowDownLeft, cls: 'bg-red-500/10 text-red-500 border-red-500/25', amtCls: 'text-red-600 dark:text-red-400', prefix: '-' },
    SET: { label: 'SET', icon: RefreshCw, cls: 'bg-blue-500/10 text-blue-500 border-blue-500/25', amtCls: 'text-blue-600 dark:text-blue-400', prefix: '=' },
    RESET: { label: 'RESET', icon: RotateCcw, cls: 'bg-amber-500/10 text-amber-500 border-amber-500/25', amtCls: 'text-amber-600 dark:text-amber-400', prefix: '⊙' },
};

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.04 } } };
const rowVariants = { hidden: { opacity: 0, x: -6 }, visible: { opacity: 1, x: 0, transition: { duration: 0.25 } } };

const WalletHistory: React.FC = () => {
    const { userData } = useSupabaseAuth();
    const [transactions, setTransactions] = useState<LedgerEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [teamLeaders, setTeamLeaders] = useState<UserType[]>([]);

    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [totalCount, setTotalCount] = useState(0);

    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<string>('all');
    const [filterMode, setFilterMode] = useState<string>('all');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [filterTL, setFilterTL] = useState<string>('all');
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

    const [isExporting, setIsExporting] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<LedgerEntry | null>(null);
    const [newDate, setNewDate] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);
    const [isCleaning, setIsCleaning] = useState(false);

    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
    const [bulkNewDate, setBulkNewDate] = useState('');
    const [isBulkUpdating, setIsBulkUpdating] = useState(false);

    useEffect(() => {
        if (userData?.role === 'admin') {
            supabase.from('users').select('*').eq('role', 'teamLeader').then(({ data }) => {
                if (data) setTeamLeaders(data.map((u: any) => ({ ...u, fullName: u.full_name || u.fullName, userId: u.user_id || u.userId })) as UserType[]);
            });
        }
    }, [userData?.role]);

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            if (userData?.role === 'teamLeader' && !userData?.permissions?.wallet?.viewHistory) {
                setTransactions([]); setTotalCount(0); setLoading(false); return;
            }

            let query = supabase.from('wallet_ledger').select(`*, riders!inner(rider_name, team_leader_id, users(full_name))`, { count: 'exact' });

            if (filterType !== 'all') query = query.eq('transaction_type', filterType);
            if (filterMode !== 'all') query = query.eq('mode', filterMode);
            if (searchTerm) query = query.or(`description.ilike.%${searchTerm}%,riders.rider_name.ilike.%${searchTerm}%`);
            if (dateRange.start) query = query.gte('created_at', new Date(dateRange.start).toISOString());
            if (dateRange.end) { const e = new Date(dateRange.end); e.setHours(23, 59, 59, 999); query = query.lte('created_at', e.toISOString()); }
            if (userData?.role === 'teamLeader') query = query.eq('riders.team_leader_id', userData.id);
            else if (filterTL !== 'all') query = query.eq('riders.team_leader_id', filterTL);

            const from = (currentPage - 1) * pageSize;
            const { data, count, error } = await query.order('created_at', { ascending: false }).range(from, from + pageSize - 1);
            if (error) throw error;
            setTransactions(data as LedgerEntry[] || []);
            setTotalCount(count || 0);
        } catch (error) {
            console.error('Error fetching wallet ledger:', error);
            toast.error('Failed to load wallet ledger');
        } finally { setLoading(false); }
    };

    useEffect(() => { fetchTransactions(); }, [currentPage, pageSize, filterType, filterMode, dateRange, filterTL, userData]);

    const handleExport = async () => {
        setIsExporting(true);
        const tid = toast.loading('Preparing export...');
        try {
            let q = supabase.from('wallet_ledger').select(`*, riders!inner(rider_name, team_leader_id, users(full_name))`);
            if (filterType !== 'all') q = q.eq('transaction_type', filterType);
            if (filterMode !== 'all') q = q.eq('mode', filterMode);
            if (searchTerm) q = q.or(`description.ilike.%${searchTerm}%,riders.rider_name.ilike.%${searchTerm}%`);
            if (dateRange.start) q = q.gte('created_at', new Date(dateRange.start).toISOString());
            if (dateRange.end) { const e = new Date(dateRange.end); e.setHours(23, 59, 59, 999); q = q.lte('created_at', e.toISOString()); }
            if (userData?.role === 'teamLeader') q = q.eq('riders.team_leader_id', userData.id);
            else if (filterTL !== 'all') q = q.eq('riders.team_leader_id', filterTL);

            const { data, error } = await q.order('created_at', { ascending: false });
            if (error) throw error;
            if (!data?.length) { toast.dismiss(tid); toast.info('No data to export'); return; }

            exportToCSV(data.map((item: any) => ({
                Date: format(parseISO(item.created_at), 'yyyy-MM-dd HH:mm:ss'),
                Rider: item.riders?.rider_name || 'N/A',
                'Team Leader': item.riders?.users?.full_name || 'N/A',
                Type: item.transaction_type, Mode: item.mode,
                Amount: item.amount, Description: item.description,
                Source: item.metadata?.source || 'N/A'
            })), `Wallet_Ledger_${format(new Date(), 'yyyyMMdd_HHmm')}`);
            toast.success('Export successful', { id: tid });
        } catch { toast.error('Export failed', { id: tid }); } finally { setIsExporting(false); }
    };

    const handleUpdateDate = async () => {
        if (!editingTransaction || !newDate) return;
        setIsUpdating(true);
        try {
            const { error } = await supabase.rpc('update_wallet_transaction_date', {
                p_transaction_id: editingTransaction.id, p_new_date: new Date(newDate).toISOString()
            });
            if (error) throw error;
            toast.success('Transaction date updated');
            setEditingTransaction(null); fetchTransactions();
        } catch (error: any) { toast.error(error.message || 'Failed to update date'); } finally { setIsUpdating(false); }
    };

    const handleDeleteTransaction = async (id: string) => {
        if (!window.confirm('Delete this transaction? This will update Rider Wallet Balance and Daily Collections.')) return;
        try {
            const { error } = await supabase.from('wallet_ledger').delete().eq('id', id);
            if (error) throw error;
            toast.success('Transaction deleted');
            fetchTransactions();
        } catch (error: any) { toast.error('Failed to delete transaction'); }
    };

    const handleCleanup = async () => {
        if (!window.confirm('This removes all old-date DAY OPENING BALANCE (RESET) entries, keeping only the latest for each rider. Proceed?')) return;
        setIsCleaning(true);
        const tid = toast.loading('Running smart cleanup...');
        try {
            const { data, error } = await supabase.rpc('cleanup_wallet_ledger');
            if (error) throw error;
            toast.success(`Cleanup done: ${data?.deleted_count ?? 0} old entries removed.`, { id: tid });
            fetchTransactions();
        } catch (error: any) { toast.error('Cleanup failed: ' + error.message, { id: tid }); } finally { setIsCleaning(false); }
    };

    const handleBulkUpdateDate = async () => {
        if (!selectedIds.length || !bulkNewDate) return;
        setIsBulkUpdating(true);
        try {
            const { error } = await supabase.rpc('bulk_update_wallet_transaction_date', {
                p_transaction_ids: selectedIds, p_new_date: new Date(bulkNewDate).toISOString()
            });
            if (error) throw error;
            toast.success(`Updated ${selectedIds.length} transaction dates`);
            setIsBulkEditModalOpen(false); setSelectedIds([]); fetchTransactions();
        } catch (error: any) { toast.error(error.message || 'Failed to bulk update dates'); } finally { setIsBulkUpdating(false); }
    };

    const handleBulkDelete = async () => {
        if (userData?.role !== 'admin' || !selectedIds.length) return;
        if (!window.confirm(`Delete ${selectedIds.length} selected transactions? This cannot be undone.`)) return;
        const tid = toast.loading(`Deleting ${selectedIds.length} transactions...`);
        try {
            const { error } = await supabase.from('wallet_ledger').delete().in('id', selectedIds);
            if (error) throw error;
            toast.success('Bulk deletion successful', { id: tid });
            setSelectedIds([]); fetchTransactions();
        } catch (error: any) { toast.error('Failed to delete transactions', { id: tid }); }
    };

    const toggleSelectAll = () =>
        setSelectedIds(selectedIds.length === transactions.length ? [] : transactions.map(t => t.id));
    const toggleSelect = (id: string) =>
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

    const pageCredits = transactions.reduce((acc, t) => t.mode === 'ADD' ? acc + (Number(t.amount) || 0) : acc, 0);
    const pageDebits = transactions.reduce((acc, t) => t.mode === 'SUBTRACT' ? acc + (Number(t.amount) || 0) : acc, 0);
    const totalPages = Math.ceil(totalCount / pageSize) || 1;
    const hasActiveFilters = searchTerm || filterType !== 'all' || filterMode !== 'all' || filterTL !== 'all' || dateRange.start || dateRange.end;

    if (userData?.role === 'teamLeader' && !userData?.permissions?.wallet?.viewHistory) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center h-[50vh]">
                <div className="bg-red-500/10 p-5 rounded-2xl mb-4 border border-red-500/20">
                    <AlertCircle size={48} className="text-red-500" />
                </div>
                <h2 className="text-2xl font-black text-foreground">Access Denied</h2>
                <p className="text-muted-foreground mt-2 max-w-md text-sm">You do not have permission to view Wallet History.</p>
            </div>
        );
    }

    return (
        <div className="space-y-5 pb-20 max-w-[1400px] mx-auto">
            {/* ── Header ───────────────────────────────────────────────── */}
            <motion.div
                initial={{ opacity: 0, y: -14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card/80 backdrop-blur border border-border/60 rounded-2xl p-5 shadow-sm"
            >
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                        <History size={22} className="text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">Wallet Ledger</h1>
                        <p className="text-muted-foreground text-xs font-medium">Immutable record of all wallet transactions</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {userData?.role === 'admin' && (
                        <motion.button
                            onClick={handleCleanup}
                            disabled={isCleaning || loading}
                            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                            className="flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-widest rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition-all disabled:opacity-50"
                        >
                            <ShieldAlert size={15} />
                            {isCleaning ? 'Cleaning...' : 'Clean Openings'}
                        </motion.button>
                    )}
                    <motion.button
                        onClick={() => fetchTransactions()}
                        whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                        className="p-2.5 rounded-xl border border-border/60 hover:bg-muted transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin text-primary' : 'text-muted-foreground'} />
                    </motion.button>
                    <motion.button
                        onClick={handleExport}
                        disabled={isExporting || loading}
                        whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                        className="p-2.5 rounded-xl border border-border/60 hover:bg-muted transition-colors text-primary disabled:opacity-50"
                        title="Export CSV"
                    >
                        <Download size={18} className={isExporting ? 'animate-bounce' : ''} />
                    </motion.button>
                </div>
            </motion.div>

            {/* ── Stats Cards ───────────────────────────────────────────── */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="grid grid-cols-2 lg:grid-cols-4 gap-3"
            >
                {[
                    { label: 'Total Entries', value: totalCount.toLocaleString(), icon: Sparkles, cls: 'text-violet-500', bg: 'bg-violet-500/10 border-violet-500/20' },
                    { label: 'Page Credits', value: `+₹${pageCredits.toLocaleString()}`, icon: ArrowUpRight, cls: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20' },
                    { label: 'Page Debits', value: `-₹${pageDebits.toLocaleString()}`, icon: ArrowDownLeft, cls: 'text-red-500', bg: 'bg-red-500/10 border-red-500/20' },
                    {
                        label: 'Net Change',
                        value: `${pageCredits - pageDebits >= 0 ? '+' : ''}₹${(pageCredits - pageDebits).toLocaleString()}`,
                        icon: Wallet,
                        cls: pageCredits - pageDebits >= 0 ? 'text-blue-500' : 'text-orange-500',
                        bg: pageCredits - pageDebits >= 0 ? 'bg-blue-500/10 border-blue-500/20' : 'bg-orange-500/10 border-orange-500/20'
                    },
                ].map((s, i) => (
                    <motion.div
                        key={s.label}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.07 * i }}
                        className="bg-card/60 backdrop-blur border border-border/60 rounded-2xl p-4 flex items-center gap-3"
                    >
                        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${s.bg}`}>
                            <s.icon size={18} className={s.cls} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/60">{s.label}</p>
                            <p className={`text-lg font-black truncate ${s.cls}`}>{s.value}</p>
                        </div>
                    </motion.div>
                ))}
            </motion.div>

            {/* ── Filter Bar ────────────────────────────────────────────── */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="bg-card/80 backdrop-blur border border-border/60 rounded-2xl p-4 relative z-30"
            >
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={16} />
                        <input
                            type="text"
                            placeholder="Search by rider, description..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && fetchTransactions()}
                            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-input bg-background/60 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                        />
                    </div>
                    <div className="flex gap-2">
                        {hasActiveFilters && (
                            <button
                                onClick={() => { setSearchTerm(''); setFilterType('all'); setFilterMode('all'); setFilterTL('all'); setDateRange({ start: '', end: '' }); setCurrentPage(1); }}
                                className="px-3 py-2.5 text-xs font-bold rounded-xl border border-red-500/30 text-red-500 hover:bg-red-500/10 flex items-center gap-1.5 transition-all"
                            >
                                <X size={13} /> Clear
                            </button>
                        )}
                        <button
                            onClick={() => setShowAdvancedFilters(v => !v)}
                            className={`px-4 py-2.5 text-sm font-bold rounded-xl border flex items-center gap-2 transition-all ${showAdvancedFilters ? 'border-primary bg-primary/10 text-primary' : 'border-border text-foreground hover:bg-muted'}`}
                        >
                            <Filter size={15} /> Filters
                            {hasActiveFilters && <span className="flex h-2 w-2 rounded-full bg-primary" />}
                        </button>
                    </div>
                </div>

                <AnimatePresence>
                    {showAdvancedFilters && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="overflow-hidden"
                        >
                            <div className="pt-4 mt-4 border-t border-border/50 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1.5 block">Type</label>
                                    <SearchableSelect
                                        options={[
                                            { value: 'all', label: 'All Types' },
                                            { value: 'DAILY_COLLECTION', label: 'Daily Collection' },
                                            { value: 'RENT_COLLECTION', label: 'Rent Collection' },
                                            { value: 'FTD_COLLECTION', label: 'FTD Collection' },
                                            { value: 'DAY_OPENING_BALANCE', label: 'Day Opening Balance' },
                                            { value: 'SYSTEM_RENT_CHARGE', label: 'System Rent Charge' },
                                            { value: 'MANUAL_ADJUSTMENT', label: 'Manual Adjustment' },
                                            { value: 'SYSTEM_IMPORT', label: 'System Import' },
                                        ]}
                                        value={filterType}
                                        onChange={val => setFilterType(val as any)}
                                        placeholder="Select Type"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1.5 block">Mode</label>
                                    <SearchableSelect
                                        options={[
                                            { value: 'all', label: 'All Modes' },
                                            { value: 'ADD', label: 'ADD (Credits)' },
                                            { value: 'SUBTRACT', label: 'SUBTRACT (Debits)' },
                                            { value: 'SET', label: 'SET' },
                                            { value: 'RESET', label: 'RESET (Opening)' },
                                        ]}
                                        value={filterMode}
                                        onChange={val => setFilterMode(val as any)}
                                        placeholder="Select Mode"
                                    />
                                </div>
                                {userData?.role === 'admin' && (
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1.5 block">Team Leader</label>
                                        <SearchableSelect
                                            options={[{ value: 'all', label: 'All Team Leaders' }, ...teamLeaders.map(tl => ({ value: tl.id, label: tl.fullName }))]}
                                            value={filterTL}
                                            onChange={val => setFilterTL(val)}
                                            placeholder="Select TL"
                                            searchPlaceholder="Search TL..."
                                        />
                                    </div>
                                )}
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1.5 block">Date Range</label>
                                    <div className="flex items-center gap-2">
                                        <input type="date"
                                            className="flex-1 px-2.5 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20"
                                            style={{ colorScheme: 'light dark' }}
                                            value={dateRange.start}
                                            onChange={e => setDateRange(p => ({ ...p, start: e.target.value }))}
                                        />
                                        <span className="text-muted-foreground text-xs">—</span>
                                        <input type="date"
                                            className="flex-1 px-2.5 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20"
                                            style={{ colorScheme: 'light dark' }}
                                            value={dateRange.end}
                                            onChange={e => setDateRange(p => ({ ...p, end: e.target.value }))}
                                        />
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

            {/* ── Table ─────────────────────────────────────────────────── */}
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 }}
                className="bg-card/80 backdrop-blur border border-border/60 rounded-2xl overflow-hidden shadow-sm"
            >
                {/* Table Header Bar */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-border/50 bg-muted/20">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                        <span>
                            Showing <span className="font-bold text-foreground">{transactions.length}</span> of{' '}
                            <span className="font-bold text-foreground">{totalCount.toLocaleString()}</span> entries
                        </span>

                        <AnimatePresence>
                            {selectedIds.length > 0 && userData?.role === 'admin' && (
                                <motion.div
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -10 }}
                                    className="flex items-center gap-3"
                                >
                                    <span className="bg-primary/10 text-primary px-2.5 py-0.5 rounded-full font-black text-xs border border-primary/20">{selectedIds.length} selected</span>
                                    <button onClick={() => { setBulkNewDate(''); setIsBulkEditModalOpen(true); }}
                                        className="text-primary hover:text-primary/80 font-black text-xs flex items-center gap-1 hover:underline">
                                        <Calendar size={12} /> Edit Dates
                                    </button>
                                    <button onClick={handleBulkDelete} className="text-red-500 hover:text-red-400 font-black text-xs flex items-center gap-1 hover:underline">
                                        <Trash2 size={12} /> Delete
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground/60">Rows:</span>
                        <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))}
                            className="bg-background border border-input rounded-lg px-2 py-1 text-xs outline-none text-foreground">
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                    </div>
                </div>

                {/* Scrollable Table */}
                <div className="overflow-x-auto min-h-[400px]">
                    <table className="w-full text-sm text-left">
                        <thead className="text-[10px] uppercase font-black tracking-widest bg-muted/40 text-muted-foreground/70 sticky top-0 z-10">
                            <tr>
                                {userData?.role === 'admin' && (
                                    <th className="px-4 py-3 w-10">
                                        <button onClick={toggleSelectAll} className="p-1 hover:bg-primary/10 rounded-lg transition-colors">
                                            {selectedIds.length === transactions.length && transactions.length > 0
                                                ? <CheckSquare size={16} className="text-primary" />
                                                : <Square size={16} />}
                                        </button>
                                    </th>
                                )}
                                <th className="px-4 py-3 whitespace-nowrap">Date / Time</th>
                                <th className="px-4 py-3">Rider</th>
                                <th className="px-4 py-3">Team Leader</th>
                                <th className="px-4 py-3">Mode</th>
                                <th className="px-4 py-3">Type</th>
                                <th className="px-4 py-3 text-right">Amount</th>
                                <th className="px-4 py-3">Description</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                            {loading ? (
                                <tr>
                                    <td colSpan={userData?.role === 'admin' ? 8 : 7} className="text-center py-24">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-9 h-9 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                                            <span className="text-muted-foreground text-sm font-medium">Loading ledger...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : transactions.length === 0 ? (
                                <tr>
                                    <td colSpan={userData?.role === 'admin' ? 8 : 7} className="text-center py-24">
                                        <div className="flex flex-col items-center gap-3 text-muted-foreground/50">
                                            <History size={40} className="opacity-30" />
                                            <p className="font-semibold">No ledger entries found</p>
                                            <p className="text-sm">Try adjusting your filters</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                <motion.tbody variants={containerVariants} initial="hidden" animate="visible" className="divide-y divide-border/40">
                                    {transactions.map(t => {
                                        const amount = Number(t.amount) || 0;
                                        const cfg = MODE_CONFIG[t.mode] || MODE_CONFIG.SET;
                                        const ModeIcon = cfg.icon;
                                        const isReset = t.mode === 'RESET' && t.transaction_type === 'DAY_OPENING_BALANCE';
                                        const isSelected = selectedIds.includes(t.id);

                                        return (
                                            <motion.tr
                                                key={t.id}
                                                variants={rowVariants}
                                                className={`group transition-colors ${isSelected ? 'bg-primary/5' : isReset ? 'bg-amber-500/3 hover:bg-amber-500/8' : 'hover:bg-muted/20'}`}
                                            >
                                                {userData?.role === 'admin' && (
                                                    <td className="px-4 py-3">
                                                        <button onClick={() => toggleSelect(t.id)} className="p-1 hover:bg-primary/10 rounded-lg transition-colors">
                                                            {isSelected ? <CheckSquare size={16} className="text-primary" /> : <Square size={16} className="text-muted-foreground/40" />}
                                                        </button>
                                                    </td>
                                                )}

                                                {/* Date */}
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-xs text-foreground">{format(parseISO(t.created_at), 'dd MMM yyyy')}</span>
                                                        <span className="text-[10px] text-muted-foreground/60">{format(parseISO(t.created_at), 'hh:mm a')}</span>
                                                    </div>
                                                    {userData?.role === 'admin' && (
                                                        <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            {['DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION'].includes(t.transaction_type) && (
                                                                <button
                                                                    onClick={() => {
                                                                        setEditingTransaction(t);
                                                                        const d = new Date(t.created_at);
                                                                        setNewDate(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
                                                                    }}
                                                                    className="p-1 text-muted-foreground/50 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                                                    title="Edit Date"
                                                                >
                                                                    <Edit2 size={11} />
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={e => { e.stopPropagation(); handleDeleteTransaction(t.id); }}
                                                                className="p-1 text-muted-foreground/50 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                                                title="Delete"
                                                            >
                                                                <Trash2 size={11} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Rider */}
                                                <td className="px-4 py-3 cursor-pointer" onClick={() => toggleSelect(t.id)}>
                                                    <span className="font-semibold text-sm text-foreground">{t.riders?.rider_name || 'Unknown'}</span>
                                                </td>

                                                {/* TL */}
                                                <td className="px-4 py-3">
                                                    {t.riders?.users?.full_name
                                                        ? <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><User size={11} />{t.riders.users.full_name}</span>
                                                        : <span className="text-muted-foreground/30 text-xs">—</span>}
                                                </td>

                                                {/* Mode Badge */}
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${cfg.cls}`}>
                                                        <ModeIcon size={10} />
                                                        {cfg.label}
                                                    </span>
                                                </td>

                                                {/* Type */}
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md ${isReset ? 'bg-amber-500/10 text-amber-500' : 'bg-muted text-muted-foreground'}`}>
                                                            {t.transaction_type?.replace(/_/g, ' ') || 'Unknown'}
                                                        </span>
                                                        {isReset && (
                                                            <span className="text-[9px] font-black text-amber-500/70 uppercase tracking-widest">Opening</span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Amount */}
                                                <td className={`px-4 py-3 text-right font-black text-sm ${cfg.amtCls}`}>
                                                    {cfg.prefix}₹{amount.toLocaleString()}
                                                </td>

                                                {/* Description */}
                                                <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate" title={t.description}>
                                                    {t.description || '—'}
                                                </td>
                                            </motion.tr>
                                        );
                                    })}
                                </motion.tbody>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-5 py-3 border-t border-border/50 bg-muted/10 flex items-center justify-between">
                    <button
                        disabled={currentPage === 1 || loading}
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-sm font-semibold hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        <ChevronLeft size={15} /> Previous
                    </button>
                    <div className="flex items-center gap-1.5">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            const page = currentPage <= 3 ? i + 1 : currentPage + i - 2;
                            if (page > totalPages) return null;
                            return (
                                <button key={page} onClick={() => setCurrentPage(page)}
                                    className={`w-8 h-8 rounded-lg text-sm font-bold transition-colors ${page === currentPage ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}>
                                    {page}
                                </button>
                            );
                        })}
                    </div>
                    <button
                        disabled={currentPage * pageSize >= totalCount || loading}
                        onClick={() => setCurrentPage(p => p + 1)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-sm font-semibold hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        Next <ChevronRight size={15} />
                    </button>
                </div>
            </motion.div>

            {/* ── Bulk Edit Date Modal ──────────────────────────────────── */}
            <AnimatePresence>
                {isBulkEditModalOpen && (
                    <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <motion.div className="absolute inset-0 bg-background/70 backdrop-blur-md" onClick={() => setIsBulkEditModalOpen(false)} />
                        <motion.div className="relative bg-card border border-border/60 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
                            initial={{ opacity: 0, scale: 0.93, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.93, y: 16 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] as const }}>
                            <div className="h-1 bg-gradient-to-r from-primary via-violet-500 to-primary/40" />
                            <div className="p-6 space-y-5">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-black flex items-center gap-2"><Calendar size={18} className="text-primary" /> Bulk Edit Dates</h3>
                                    <button onClick={() => setIsBulkEditModalOpen(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X size={16} /></button>
                                </div>
                                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Selected</span>
                                    <span className="font-black text-primary">{selectedIds.length} transactions</span>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-foreground">New Date &amp; Time</label>
                                    <input type="datetime-local" value={bulkNewDate} onChange={e => setBulkNewDate(e.target.value)}
                                        className="w-full px-4 py-2.5 border border-input rounded-xl bg-background text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                        style={{ colorScheme: 'light dark' }} />
                                    <p className="text-[11px] text-muted-foreground">Moving dates will update Daily Collection reports accordingly.</p>
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button onClick={() => setIsBulkEditModalOpen(false)} disabled={isBulkUpdating}
                                        className="flex-1 px-4 py-2.5 rounded-xl bg-muted text-foreground font-bold text-sm hover:bg-muted/80 transition-colors">Cancel</button>
                                    <motion.button onClick={handleBulkUpdateDate} disabled={isBulkUpdating || !bulkNewDate}
                                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                                        className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                                        {isBulkUpdating ? <RefreshCw size={15} className="animate-spin" /> : <><Calendar size={14} /> Update All</>}
                                    </motion.button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Edit Single Date Modal ────────────────────────────────── */}
            <AnimatePresence>
                {editingTransaction && (
                    <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <motion.div className="absolute inset-0 bg-background/70 backdrop-blur-md" onClick={() => setEditingTransaction(null)} />
                        <motion.div className="relative bg-card border border-border/60 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
                            initial={{ opacity: 0, scale: 0.93, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.93, y: 16 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] as const }}>
                            <div className="h-1 bg-gradient-to-r from-emerald-500 via-primary to-violet-500" />
                            <div className="p-6 space-y-5">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-black flex items-center gap-2"><Edit2 size={18} className="text-primary" /> Edit Transaction Date</h3>
                                    <button onClick={() => setEditingTransaction(null)} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X size={16} /></button>
                                </div>
                                <div className="bg-muted/30 rounded-xl p-4 grid grid-cols-2 gap-2 text-sm">
                                    <span className="text-muted-foreground">Rider</span><span className="font-bold text-right">{editingTransaction.riders?.rider_name}</span>
                                    <span className="text-muted-foreground">Amount</span><span className="font-black text-right text-primary">₹{editingTransaction.amount}</span>
                                    <span className="text-muted-foreground">Current Date</span><span className="font-medium text-right text-xs">{format(parseISO(editingTransaction.created_at), 'dd MMM yyyy, hh:mm a')}</span>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold">New Date &amp; Time</label>
                                    <input type="datetime-local" value={newDate} onChange={e => setNewDate(e.target.value)}
                                        className="w-full px-4 py-2.5 border border-input rounded-xl bg-background text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                        style={{ colorScheme: 'light dark' }} />
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button onClick={() => setEditingTransaction(null)} disabled={isUpdating}
                                        className="flex-1 px-4 py-2.5 rounded-xl bg-muted font-bold text-sm hover:bg-muted/80 transition-colors">Cancel</button>
                                    <motion.button onClick={handleUpdateDate} disabled={isUpdating || !newDate}
                                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                                        className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                                        {isUpdating ? <RefreshCw size={15} className="animate-spin" /> : 'Save Changes'}
                                    </motion.button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default WalletHistory;
