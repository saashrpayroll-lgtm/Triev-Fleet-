import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/config/supabase';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import SearchableSelect from '@/components/ui/SearchableSelect';
import {
    History, Search, ArrowUpRight, ArrowDownLeft, RefreshCw, Wallet,
    Download, Filter, ChevronLeft, ChevronRight, User, AlertCircle,
    Edit2, X, Calendar, Trash2, ShieldAlert, CheckSquare, Square,
    Sparkles, RotateCcw, TrendingUp
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { User as UserType } from '@/types';
import { exportToCSV } from '@/utils/exportUtils';

interface LedgerEntry {
    id: string;
    rider_id: string;
    amount: number;
    transaction_type: string;
    mode: 'ADD' | 'SUBTRACT' | 'SET' | 'RESET';
    description: string;
    metadata: any;
    created_at: string;
    riders?: { rider_name: string; team_leader_id?: string; users?: { full_name: string } };
}

/* ── colour config per mode ──────────────────────────────────────────── */
const MODE_CFG = {
    ADD: { label: 'ADD', Icon: ArrowUpRight, rowBg: '', badgeBg: 'bg-emerald-500', amtCls: 'text-emerald-600 dark:text-emerald-400', prefix: '+' },
    SUBTRACT: { label: 'DEBIT', Icon: ArrowDownLeft, rowBg: '', badgeBg: 'bg-red-500', amtCls: 'text-red-600 dark:text-red-400', prefix: '-' },
    SET: { label: 'SET', Icon: RefreshCw, rowBg: '', badgeBg: 'bg-blue-500', amtCls: 'text-blue-600 dark:text-blue-400', prefix: '=' },
    RESET: { label: 'RESET', Icon: RotateCcw, rowBg: 'bg-yellow-50/60 dark:bg-yellow-900/10', badgeBg: 'bg-orange-500', amtCls: 'text-orange-600 dark:text-orange-400', prefix: '⊙' },
} as const;

const TYPE_COLOURS: Record<string, string> = {
    DAILY_COLLECTION: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    RENT_COLLECTION: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    FTD_COLLECTION: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    DAY_OPENING_BALANCE: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    SYSTEM_RENT_CHARGE: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    MANUAL_ADJUSTMENT: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
    SYSTEM_IMPORT: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
};

const StatCard = ({ label, value, Icon, color }: { label: string; value: string; Icon: any; color: string }) => (
    <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4 bg-card rounded-2xl border border-border/60 px-5 py-4 shadow-sm"
    >
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
            <Icon size={22} className="text-white" />
        </div>
        <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">{label}</p>
            <p className="text-xl font-black text-foreground mt-0.5">{value}</p>
        </div>
    </motion.div>
);

const WalletHistory: React.FC = () => {
    const { userData } = useSupabaseAuth();
    const [transactions, setTransactions] = useState<LedgerEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [teamLeaders, setTeamLeaders] = useState<UserType[]>([]);

    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [totalCount, setTotalCount] = useState(0);

    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [filterMode, setFilterMode] = useState('all');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [filterTL, setFilterTL] = useState('all');
    const [showFilters, setShowFilters] = useState(false);

    const [isExporting, setIsExporting] = useState(false);
    const [editingTxn, setEditingTxn] = useState<LedgerEntry | null>(null);
    const [newDate, setNewDate] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);
    const [isCleaning, setIsCleaning] = useState(false);

    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [bulkModal, setBulkModal] = useState(false);
    const [bulkDate, setBulkDate] = useState('');
    const [isBulkUpdating, setIsBulkUpdating] = useState(false);

    const isAdmin = userData?.role === 'admin';

    /* fetch TLs */
    useEffect(() => {
        if (isAdmin) {
            supabase.from('users').select('*').eq('role', 'teamLeader').then(({ data }) => {
                if (data) setTeamLeaders(data.map((u: any) => ({ ...u, fullName: u.full_name || u.fullName })) as UserType[]);
            });
        }
    }, [isAdmin]);

    /* fetch transactions */
    const fetchTransactions = async () => {
        setLoading(true);
        try {
            if (userData?.role === 'teamLeader' && !userData?.permissions?.wallet?.viewHistory) {
                setTransactions([]); setTotalCount(0); return;
            }
            let q = supabase.from('wallet_ledger')
                .select('*, riders!inner(rider_name, team_leader_id, users(full_name))', { count: 'exact' });

            if (filterType !== 'all') q = q.eq('transaction_type', filterType);
            if (filterMode !== 'all') q = q.eq('mode', filterMode);
            if (searchTerm) q = q.or(`description.ilike.%${searchTerm}%,riders.rider_name.ilike.%${searchTerm}%`);
            if (dateRange.start) q = q.gte('created_at', new Date(dateRange.start).toISOString());
            if (dateRange.end) { const e = new Date(dateRange.end); e.setHours(23, 59, 59, 999); q = q.lte('created_at', e.toISOString()); }
            if (userData?.role === 'teamLeader') q = q.eq('riders.team_leader_id', userData.id);
            else if (filterTL !== 'all') q = q.eq('riders.team_leader_id', filterTL);

            const from = (currentPage - 1) * pageSize;
            const { data, count, error } = await q.order('created_at', { ascending: false }).range(from, from + pageSize - 1);
            if (error) throw error;
            setTransactions((data as LedgerEntry[]) || []);
            setTotalCount(count || 0);
        } catch { toast.error('Failed to load ledger'); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchTransactions(); }, [currentPage, pageSize, filterType, filterMode, dateRange, filterTL, userData]);

    /* export */
    const handleExport = async () => {
        setIsExporting(true);
        const tid = toast.loading('Preparing export...');
        try {
            let q = supabase.from('wallet_ledger').select('*, riders!inner(rider_name, team_leader_id, users(full_name))');
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
            })), `Wallet_Ledger_${format(new Date(), 'yyyyMMdd_HHmm')}`);
            toast.success('Exported!', { id: tid });
        } catch { toast.error('Export failed', { id: tid }); }
        finally { setIsExporting(false); }
    };

    const handleUpdateDate = async () => {
        if (!editingTxn || !newDate) return;
        setIsUpdating(true);
        try {
            const { error } = await supabase.rpc('update_wallet_transaction_date', { p_transaction_id: editingTxn.id, p_new_date: new Date(newDate).toISOString() });
            if (error) throw error;
            toast.success('Date updated'); setEditingTxn(null); fetchTransactions();
        } catch (e: any) { toast.error(e.message || 'Failed'); } finally { setIsUpdating(false); }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Delete this transaction?')) return;
        try {
            const { error } = await supabase.from('wallet_ledger').delete().eq('id', id);
            if (error) throw error;
            toast.success('Deleted'); fetchTransactions();
        } catch { toast.error('Delete failed'); }
    };

    const handleCleanup = async () => {
        if (!window.confirm('Remove all old-date DAY OPENING BALANCE entries?')) return;
        setIsCleaning(true);
        const tid = toast.loading('Cleaning...');
        try {
            const { data, error } = await supabase.rpc('cleanup_wallet_ledger');
            if (error) throw error;
            toast.success(`Done: ${data?.deleted_count ?? 0} entries removed.`, { id: tid });
            fetchTransactions();
        } catch (e: any) { toast.error('Cleanup failed: ' + e.message, { id: tid }); } finally { setIsCleaning(false); }
    };

    const handleBulkUpdateDate = async () => {
        if (!selectedIds.length || !bulkDate) return;
        setIsBulkUpdating(true);
        try {
            const { error } = await supabase.rpc('bulk_update_wallet_transaction_date', { p_transaction_ids: selectedIds, p_new_date: new Date(bulkDate).toISOString() });
            if (error) throw error;
            toast.success(`Updated ${selectedIds.length} transactions`);
            setBulkModal(false); setSelectedIds([]); fetchTransactions();
        } catch (e: any) { toast.error(e.message || 'Failed'); } finally { setIsBulkUpdating(false); }
    };

    const handleBulkDelete = async () => {
        if (!isAdmin || !selectedIds.length) return;
        if (!window.confirm(`Delete ${selectedIds.length} transactions?`)) return;
        const tid = toast.loading('Deleting...');
        try {
            const { error } = await supabase.from('wallet_ledger').delete().in('id', selectedIds);
            if (error) throw error;
            toast.success('Deleted!', { id: tid }); setSelectedIds([]); fetchTransactions();
        } catch { toast.error('Failed', { id: tid }); }
    };

    const clearFilters = () => { setSearchTerm(''); setFilterType('all'); setFilterMode('all'); setFilterTL('all'); setDateRange({ start: '', end: '' }); setCurrentPage(1); };
    const hasFilters = searchTerm || filterType !== 'all' || filterMode !== 'all' || filterTL !== 'all' || dateRange.start || dateRange.end;
    const toggleAll = () => setSelectedIds(selectedIds.length === transactions.length ? [] : transactions.map(t => t.id));
    const toggleRow = (id: string) => setSelectedIds(p => p.includes(id) ? p.filter(i => i !== id) : [...p, id]);

    const pageCredits = transactions.reduce((a, t) => t.mode === 'ADD' ? a + Number(t.amount) : a, 0);
    const pageDebits = transactions.reduce((a, t) => t.mode === 'SUBTRACT' ? a + Number(t.amount) : a, 0);
    const totalPages = Math.ceil(totalCount / pageSize) || 1;

    if (userData?.role === 'teamLeader' && !userData?.permissions?.wallet?.viewHistory) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
                <AlertCircle size={48} className="text-red-500" />
                <p className="text-xl font-bold">Access Denied</p>
            </div>
        );
    }

    /* ── render ────────────────────────────────────────────────────────────── */
    return (
        <div className="space-y-5 pb-24">

            {/* ── HEADER ─────────────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border/60 rounded-2xl px-6 py-4 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center shadow-lg">
                        <History size={22} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-foreground">Wallet Ledger</h1>
                        <p className="text-sm text-muted-foreground">Complete transaction history</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {isAdmin && (
                        <button onClick={handleCleanup} disabled={isCleaning}
                            className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl border border-orange-400/40 bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 transition-all disabled:opacity-50">
                            <ShieldAlert size={16} /> {isCleaning ? 'Cleaning…' : 'Clean Openings'}
                        </button>
                    )}
                    <button onClick={fetchTransactions} className="p-2.5 rounded-xl border border-border hover:bg-muted transition-colors" title="Refresh">
                        <RefreshCw size={18} className={loading ? 'animate-spin text-primary' : 'text-muted-foreground'} />
                    </button>
                    <button onClick={handleExport} disabled={isExporting} className="p-2.5 rounded-xl border border-border hover:bg-muted transition-colors text-blue-600 disabled:opacity-50" title="Export CSV">
                        <Download size={18} className={isExporting ? 'animate-bounce' : ''} />
                    </button>
                </div>
            </div>

            {/* ── STAT CARDS ─────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard label="Total Entries" value={totalCount.toLocaleString()} Icon={Sparkles} color="bg-violet-600" />
                <StatCard label="Page Credits" value={`+₹${pageCredits.toLocaleString()}`} Icon={ArrowUpRight} color="bg-emerald-600" />
                <StatCard label="Page Debits" value={`-₹${pageDebits.toLocaleString()}`} Icon={ArrowDownLeft} color="bg-red-600" />
                <StatCard label="Net Change" value={`${pageCredits - pageDebits >= 0 ? '+' : ''}₹${(pageCredits - pageDebits).toLocaleString()}`} Icon={TrendingUp} color={pageCredits - pageDebits >= 0 ? 'bg-blue-600' : 'bg-orange-600'} />
            </div>

            {/* ── SEARCH + FILTER BAR ─────────────────────────────────────────── */}
            <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row gap-3">
                    {/* Search */}
                    <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={18} />
                        <input
                            type="text"
                            placeholder="Search rider name or description…"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && fetchTransactions()}
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-input bg-background text-sm font-medium focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all"
                        />
                    </div>
                    <div className="flex gap-2 shrink-0">
                        {hasFilters && (
                            <button onClick={clearFilters}
                                className="px-4 py-3 rounded-xl border border-red-400/40 text-red-600 bg-red-500/8 text-sm font-bold hover:bg-red-500/15 transition-all flex items-center gap-2">
                                <X size={15} /> Clear
                            </button>
                        )}
                        <button onClick={() => setShowFilters(v => !v)}
                            className={`px-5 py-3 rounded-xl border text-sm font-bold flex items-center gap-2 transition-all ${showFilters ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'border-border text-foreground hover:bg-muted'}`}>
                            <Filter size={16} /> Filters
                            {hasFilters && <span className="w-2 h-2 rounded-full bg-orange-400" />}
                        </button>
                        <button onClick={fetchTransactions}
                            className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold flex items-center gap-2 transition-all shadow-md shadow-blue-500/20">
                            <Search size={16} /> Search
                        </button>
                    </div>
                </div>

                {/* Advanced Filters — NO overflow:hidden so portal dropdowns are visible */}
                {showFilters && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-border/50">
                            {/* Type */}
                            <div>
                                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 mb-1.5 block">Transaction Type</label>
                                <SearchableSelect
                                    options={[
                                        { value: 'all', label: 'All Types' },
                                        { value: 'DAILY_COLLECTION', label: '🟢 Daily Collection' },
                                        { value: 'RENT_COLLECTION', label: '🔵 Rent Collection' },
                                        { value: 'FTD_COLLECTION', label: '🟣 FTD Collection' },
                                        { value: 'DAY_OPENING_BALANCE', label: '🟠 Day Opening Balance' },
                                        { value: 'SYSTEM_RENT_CHARGE', label: '🔴 System Rent Charge' },
                                        { value: 'MANUAL_ADJUSTMENT', label: '🔷 Manual Adjustment' },
                                        { value: 'SYSTEM_IMPORT', label: '⬜ System Import' },
                                    ]}
                                    value={filterType} onChange={v => setFilterType(v as string)} placeholder="All Types" />
                            </div>
                            {/* Mode */}
                            <div>
                                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 mb-1.5 block">Mode</label>
                                <SearchableSelect
                                    options={[
                                        { value: 'all', label: 'All Modes' },
                                        { value: 'ADD', label: '🟢 ADD – Credits' },
                                        { value: 'SUBTRACT', label: '🔴 SUBTRACT – Debits' },
                                        { value: 'SET', label: '🔵 SET' },
                                        { value: 'RESET', label: '🟡 RESET – Opening' },
                                    ]}
                                    value={filterMode} onChange={v => setFilterMode(v as string)} placeholder="All Modes" />
                            </div>
                            {/* TL (admin only) */}
                            {isAdmin && (
                                <div>
                                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 mb-1.5 block">Team Leader</label>
                                    <SearchableSelect
                                        options={[{ value: 'all', label: 'All Team Leaders' }, ...teamLeaders.map(tl => ({ value: tl.id, label: tl.fullName }))]}
                                        value={filterTL} onChange={v => setFilterTL(v)} placeholder="All TLs" searchPlaceholder="Search TL…" />
                                </div>
                            )}
                            {/* Date Range */}
                            <div>
                                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 mb-1.5 block">Date Range</label>
                                <div className="flex items-center gap-2">
                                    <input type="date" value={dateRange.start}
                                        onChange={e => setDateRange(p => ({ ...p, start: e.target.value }))}
                                        style={{ colorScheme: 'light dark' }}
                                        className="flex-1 px-2.5 py-2.5 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-blue-500/30" />
                                    <span className="text-muted-foreground/50 font-bold">—</span>
                                    <input type="date" value={dateRange.end}
                                        onChange={e => setDateRange(p => ({ ...p, end: e.target.value }))}
                                        style={{ colorScheme: 'light dark' }}
                                        className="flex-1 px-2.5 py-2.5 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-blue-500/30" />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </div>

            {/* ── TABLE ──────────────────────────────────────────────────────── */}
            <div className="bg-card border border-border/60 rounded-2xl shadow-sm overflow-hidden">

                {/* table toolbar */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-border/50 bg-muted/10 flex-wrap gap-2">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Showing <strong className="text-foreground">{transactions.length}</strong> of <strong className="text-foreground">{totalCount.toLocaleString()}</strong></span>
                        <AnimatePresence>
                            {selectedIds.length > 0 && isAdmin && (
                                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3">
                                    <span className="bg-blue-500/15 text-blue-600 font-black text-xs px-2.5 py-1 rounded-full border border-blue-500/25">{selectedIds.length} selected</span>
                                    <button onClick={() => { setBulkDate(''); setBulkModal(true); }} className="text-blue-600 font-black text-xs hover:underline flex items-center gap-1"><Calendar size={12} /> Edit Dates</button>
                                    <button onClick={handleBulkDelete} className="text-red-600 font-black text-xs hover:underline flex items-center gap-1"><Trash2 size={12} /> Delete</button>
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground/60">Rows per page:</span>
                        <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))}
                            className="bg-background border border-input rounded-lg px-3 py-1.5 text-sm font-semibold outline-none text-foreground">
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                    </div>
                </div>

                {/* scrollable table wrapper */}
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-sm">
                        {/* ── THEAD ── */}
                        <thead>
                            <tr className="bg-gradient-to-r from-blue-600/10 via-violet-600/8 to-transparent border-b border-border/60">
                                {isAdmin && (
                                    <th className="w-12 px-4 py-4 text-left">
                                        <button onClick={toggleAll} className="p-1 rounded-md hover:bg-primary/10 transition-colors">
                                            {selectedIds.length === transactions.length && transactions.length > 0
                                                ? <CheckSquare size={18} className="text-blue-600" />
                                                : <Square size={18} className="text-muted-foreground/50" />}
                                        </button>
                                    </th>
                                )}
                                <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-widest text-blue-700 dark:text-blue-400 whitespace-nowrap">Date / Time</th>
                                <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-widest text-blue-700 dark:text-blue-400">Rider</th>
                                <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-widest text-blue-700 dark:text-blue-400 whitespace-nowrap">Team Leader</th>
                                <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-widest text-blue-700 dark:text-blue-400">Mode</th>
                                <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-widest text-blue-700 dark:text-blue-400">Type</th>
                                <th className="px-5 py-4 text-right text-xs font-black uppercase tracking-widest text-blue-700 dark:text-blue-400">Amount</th>
                                <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-widest text-blue-700 dark:text-blue-400">Description</th>
                            </tr>
                        </thead>

                        {/* ── TBODY ── */}
                        <tbody className="divide-y divide-border/40">
                            {loading ? (
                                <tr>
                                    <td colSpan={isAdmin ? 8 : 7} className="py-24 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-10 h-10 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                                            <span className="text-muted-foreground font-medium">Loading ledger…</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : transactions.length === 0 ? (
                                <tr>
                                    <td colSpan={isAdmin ? 8 : 7} className="py-24 text-center">
                                        <div className="flex flex-col items-center gap-3 text-muted-foreground/40">
                                            <Wallet size={48} />
                                            <p className="font-bold text-base">No transactions found</p>
                                            <p className="text-sm">Try adjusting your filters</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                transactions.map((t, idx) => {
                                    const amount = Number(t.amount) || 0;
                                    const cfg = MODE_CFG[t.mode] ?? MODE_CFG.SET;
                                    const MIcon = cfg.Icon;
                                    const isReset = t.mode === 'RESET';
                                    const typeCls = TYPE_COLOURS[t.transaction_type] ?? 'bg-gray-100 text-gray-600';
                                    const isSel = selectedIds.includes(t.id);

                                    return (
                                        <motion.tr
                                            key={t.id}
                                            initial={{ opacity: 0, y: 4 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.018, duration: 0.2 }}
                                            className={`group transition-colors ${isSel ? 'bg-blue-500/8 border-l-4 border-l-blue-500' : isReset ? 'bg-yellow-50/70 dark:bg-yellow-900/10' : 'hover:bg-muted/30'}`}
                                        >
                                            {/* checkbox */}
                                            {isAdmin && (
                                                <td className="w-12 px-4 py-4">
                                                    <button onClick={() => toggleRow(t.id)} className="p-1 hover:bg-primary/10 rounded-md transition-colors">
                                                        {isSel ? <CheckSquare size={18} className="text-blue-600" /> : <Square size={18} className="text-muted-foreground/30" />}
                                                    </button>
                                                </td>
                                            )}

                                            {/* date */}
                                            <td className="px-5 py-4">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="font-bold text-sm text-foreground whitespace-nowrap">{format(parseISO(t.created_at), 'dd MMM yyyy')}</span>
                                                    <span className="text-xs text-muted-foreground/60 font-medium">{format(parseISO(t.created_at), 'hh:mm a')}</span>
                                                </div>
                                                {isAdmin && (
                                                    <div className="flex gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {['DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION'].includes(t.transaction_type) && (
                                                            <button onClick={() => { setEditingTxn(t); const d = new Date(t.created_at); setNewDate(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)); }}
                                                                className="p-1.5 text-muted-foreground hover:text-blue-600 hover:bg-blue-500/10 rounded-lg transition-colors" title="Edit Date">
                                                                <Edit2 size={12} />
                                                            </button>
                                                        )}
                                                        <button onClick={e => { e.stopPropagation(); handleDelete(t.id); }}
                                                            className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-500/10 rounded-lg transition-colors" title="Delete">
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>

                                            {/* rider */}
                                            <td className="px-5 py-4" onClick={() => toggleRow(t.id)}>
                                                <span className="font-bold text-sm text-foreground cursor-pointer">{t.riders?.rider_name || 'Unknown'}</span>
                                            </td>

                                            {/* TL */}
                                            <td className="px-5 py-4">
                                                {t.riders?.users?.full_name
                                                    ? <span className="flex items-center gap-1.5 text-sm text-muted-foreground font-medium whitespace-nowrap"><User size={13} />{t.riders.users.full_name}</span>
                                                    : <span className="text-muted-foreground/30">—</span>}
                                            </td>

                                            {/* mode badge */}
                                            <td className="px-5 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black text-white uppercase tracking-wider shadow-sm ${cfg.badgeBg}`}>
                                                    <MIcon size={11} /> {cfg.label}
                                                </span>
                                            </td>

                                            {/* type badge */}
                                            <td className="px-5 py-4">
                                                <span className={`inline-block px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${typeCls}`}>
                                                    {t.transaction_type?.replace(/_/g, ' ') || '—'}
                                                </span>
                                            </td>

                                            {/* amount */}
                                            <td className={`px-5 py-4 text-right font-black text-base whitespace-nowrap ${cfg.amtCls}`}>
                                                {cfg.prefix}₹{amount.toLocaleString()}
                                            </td>

                                            {/* description */}
                                            <td className="px-5 py-4 max-w-[200px]">
                                                <span className="text-sm text-muted-foreground line-clamp-2" title={t.description}>{t.description || '—'}</span>
                                            </td>
                                        </motion.tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* ── PAGINATION ─────────────────────────────────────────────── */}
                <div className="px-5 py-4 border-t border-border/50 flex items-center justify-between gap-3 flex-wrap bg-muted/10">
                    <button disabled={currentPage === 1 || loading} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border font-bold text-sm hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                        <ChevronLeft size={16} /> Previous
                    </button>

                    <div className="flex items-center gap-1.5">
                        {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                            let page: number;
                            if (totalPages <= 7) { page = i + 1; }
                            else if (currentPage <= 4) { page = i + 1; }
                            else if (currentPage >= totalPages - 3) { page = totalPages - 6 + i; }
                            else { page = currentPage - 3 + i; }
                            if (page < 1 || page > totalPages) return null;
                            return (
                                <button key={page} onClick={() => setCurrentPage(page)}
                                    className={`w-9 h-9 rounded-xl text-sm font-bold transition-all ${page === currentPage ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25' : 'text-muted-foreground hover:bg-muted'}`}>
                                    {page}
                                </button>
                            );
                        })}
                    </div>

                    <button disabled={currentPage >= totalPages || loading} onClick={() => setCurrentPage(p => p + 1)}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border font-bold text-sm hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                        Next <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            {/* ── BULK DATE MODAL ─────────────────────────────────────────────── */}
            <AnimatePresence>
                {bulkModal && (
                    <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setBulkModal(false)} />
                        <motion.div className="relative bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
                            initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}>
                            <div className="h-1.5 bg-gradient-to-r from-blue-600 to-violet-600" />
                            <div className="p-6 space-y-5">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-black flex items-center gap-2"><Calendar size={18} className="text-blue-600" /> Bulk Edit Dates</h3>
                                    <button onClick={() => setBulkModal(false)} className="p-1.5 rounded-xl hover:bg-muted transition-colors"><X size={18} /></button>
                                </div>
                                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex justify-between text-sm">
                                    <span className="text-muted-foreground">Selected</span>
                                    <span className="font-black text-blue-600">{selectedIds.length} transactions</span>
                                </div>
                                <div>
                                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 mb-2 block">New Date &amp; Time</label>
                                    <input type="datetime-local" value={bulkDate} onChange={e => setBulkDate(e.target.value)}
                                        style={{ colorScheme: 'light dark' }}
                                        className="w-full px-4 py-3 border border-input rounded-xl bg-background text-sm focus:ring-2 focus:ring-blue-500/30 outline-none" />
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={() => setBulkModal(false)} className="flex-1 py-3 rounded-xl bg-muted font-bold text-sm hover:bg-muted/80 transition-colors">Cancel</button>
                                    <button onClick={handleBulkUpdateDate} disabled={isBulkUpdating || !bulkDate}
                                        className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                                        {isBulkUpdating ? <RefreshCw size={16} className="animate-spin" /> : <><Calendar size={14} /> Update All</>}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── SINGLE DATE EDIT MODAL ──────────────────────────────────────── */}
            <AnimatePresence>
                {editingTxn && (
                    <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setEditingTxn(null)} />
                        <motion.div className="relative bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
                            initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}>
                            <div className="h-1.5 bg-gradient-to-r from-emerald-500 to-blue-600" />
                            <div className="p-6 space-y-5">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-black flex items-center gap-2"><Edit2 size={18} className="text-emerald-600" /> Edit Transaction Date</h3>
                                    <button onClick={() => setEditingTxn(null)} className="p-1.5 rounded-xl hover:bg-muted transition-colors"><X size={18} /></button>
                                </div>
                                <div className="bg-muted/30 rounded-xl p-4 grid grid-cols-2 gap-y-2 text-sm">
                                    <span className="text-muted-foreground font-medium">Rider</span>
                                    <span className="font-black text-right">{editingTxn.riders?.rider_name}</span>
                                    <span className="text-muted-foreground font-medium">Amount</span>
                                    <span className="font-black text-right text-emerald-600">₹{editingTxn.amount}</span>
                                    <span className="text-muted-foreground font-medium">Current</span>
                                    <span className="font-medium text-right text-xs">{format(parseISO(editingTxn.created_at), 'dd MMM yyyy, hh:mm a')}</span>
                                </div>
                                <div>
                                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 mb-2 block">New Date &amp; Time</label>
                                    <input type="datetime-local" value={newDate} onChange={e => setNewDate(e.target.value)}
                                        style={{ colorScheme: 'light dark' }}
                                        className="w-full px-4 py-3 border border-input rounded-xl bg-background text-sm focus:ring-2 focus:ring-emerald-500/30 outline-none" />
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={() => setEditingTxn(null)} className="flex-1 py-3 rounded-xl bg-muted font-bold text-sm hover:bg-muted/80 transition-colors">Cancel</button>
                                    <button onClick={handleUpdateDate} disabled={isUpdating || !newDate}
                                        className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                                        {isUpdating ? <RefreshCw size={16} className="animate-spin" /> : 'Save Changes'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
};

export default WalletHistory;
