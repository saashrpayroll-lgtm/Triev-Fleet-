import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/config/supabase';
import { getValidHistoricalDate } from '@/utils/dateUtils';
import { fetchAllRidersPaginated, fetchTablePaginated } from '@/utils/dbUtils';
import {
    Download,
    Search,
    Calendar,
    Users,
    ArrowUpRight,
    ArrowDownRight,
    SearchX,
    TrendingUp,
    Filter,
    ChevronDown,
    RefreshCw,
    Wallet,
    BarChart3,
    ShieldCheck,
    Activity,
    IndianRupee,
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { format, startOfMonth } from 'date-fns';

interface TLMetric {
    team_leader_id: string;
    tl_name: string;
    tl_email: string;
    reporting_manager: string;
    active_rider_count: number;
    inactive_rider_count: number;
    positive_wallet_count: number;
    positive_wallet_total: number;
    negative_wallet_count: number;
    negative_wallet_total: number;
    allotment_count: number;
    submission_count: number;
    rent_collection_total: number;
}

// Helper: Get IST date string for a JS Date
const toISTDateStr = (d: Date): string => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
};

const toISTDate = (): Date => {
    const str = toISTDateStr(new Date());
    const [y, m, day] = str.split('-').map(Number);
    return new Date(y, m - 1, day);
};

interface TLAllotmentProps {
    scopedTlIds?: string[];
}

const TLAllotment: React.FC<TLAllotmentProps> = ({ scopedTlIds }) => {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [data, setData] = useState<TLMetric[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isExportOpen, setIsExportOpen] = useState(false);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [filterRisk, setFilterRisk] = useState<'all' | 'high_risk' | 'low_risk'>('all');
    const [filterPerformers, setFilterPerformers] = useState<'all' | 'growing' | 'shrinking'>('all');
    const [rmList, setRmList] = useState<string[]>([]);
    const [filterRM, setFilterRM] = useState<string>('all');
    const [sortConfig, setSortConfig] = useState<{ key: keyof TLMetric | 'net_growth'; direction: 'asc' | 'desc' }>({
        key: 'active_rider_count',
        direction: 'desc',
    });

    const todayIST = toISTDate();
    const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([todayIST, todayIST]);
    const [startDate, endDate] = dateRange;

    const setPreset = (preset: 'today' | 'yesterday' | 'week' | 'month') => {
        const today = toISTDate();
        switch (preset) {
            case 'today': setDateRange([today, today]); break;
            case 'yesterday': { const y = new Date(today); y.setDate(today.getDate() - 1); setDateRange([y, y]); break; }
            case 'week': { const w = new Date(today); w.setDate(today.getDate() - 6); setDateRange([w, today]); break; }
            case 'month': setDateRange([startOfMonth(today), today]); break;
        }
    };

    const fetchMetrics = useCallback(async () => {
        setLoading(true);
        try {
            const pStart = startDate ? format(startDate, 'yyyy-MM-dd') : '1970-01-01';
            const pEnd = endDate ? format(endDate, 'yyyy-MM-dd') : '9999-12-31';
            const todayStr = toISTDateStr(new Date());

            // ✅ ROBUST FIX: Capture today's collections using BOTH date fields:
            // - transaction_date = todayStr  → correctly set by rent import (covers AM/PM)
            // - transaction_date IS NULL AND created_at >= midnight → legacy/manual rows
            // IST midnight/end of day in UTC bounds
            const [yr, mo, dy] = todayStr.split('-').map(Number);
            const midnightIST = new Date(Date.UTC(yr, mo - 1, dy, 0, 0, 0) - 5.5 * 60 * 60 * 1000).toISOString();
            const endOfDayIST = new Date(Date.UTC(yr, mo - 1, dy, 23, 59, 59, 999) - 5.5 * 60 * 60 * 1000).toISOString();

            // Fetch all data in parallel
            // Build the TL query server-side so scopedTlIds is applied at DB level
            let tlBaseQuery = supabase
                .from('users')
                .select('id, full_name, email, reporting_manager')
                .eq('role', 'teamLeader')
                .eq('status', 'active');
            if (scopedTlIds && scopedTlIds.length > 0) {
                tlBaseQuery = tlBaseQuery.in('id', scopedTlIds);
            }

            const [tlsRes, ridersRes, dailyColRes, todayLedgerRes] = await Promise.all([
                // Step 1: Active TLs — server-side scoped to City Ops if applicable
                tlBaseQuery,

                // Step 2: Riders — scope to team's TLs if applicable
                scopedTlIds && scopedTlIds.length > 0
                    ? fetchAllRidersPaginated('id, team_leader_id, status, wallet_amount, allotment_date, created_at, updated_at, inactivated_at', { column: 'team_leader_id', value: scopedTlIds, type: 'in' })
                    : fetchAllRidersPaginated('id, team_leader_id, status, wallet_amount, allotment_date, created_at, updated_at, inactivated_at'),

                // Step 3: ✅ daily_collections — scoped to team's TLs if applicable
                fetchTablePaginated('daily_collections', 'team_leader_id, total_collection, date, active_riders_count', [
                    { column: 'date', operator: 'gte', value: pStart },
                    { column: 'date', operator: 'lte', value: pEnd },
                    ...(scopedTlIds && scopedTlIds.length > 0 ? [{ column: 'team_leader_id', operator: 'in' as const, value: scopedTlIds }] : [])
                ]),

                // Step 4: ✅ Today's live override via wallet_ledger with !inner JOIN
                fetchTablePaginated('wallet_ledger', 'amount, rider:riders!inner(team_leader_id)', [
                    { column: 'mode', operator: 'eq', value: 'ADD' },
                    { column: 'transaction_type', operator: 'in', value: [
                        'DAILY_COLLECTION', 'DAILY COLLECTION',
                        'RENT_COLLECTION', 'RENT COLLECTION',
                        'FTD_COLLECTION', 'FTD COLLECTION',
                        'COLLECTION', 'RENT'
                    ]},
                    { operator: 'or', value: `and(transaction_date.gte.${midnightIST},transaction_date.lte.${endOfDayIST}),and(transaction_date.is.null,created_at.gte.${midnightIST})` }
                ]),
            ]);

            if (tlsRes.error) throw tlsRes.error;
            if (ridersRes.error) throw ridersRes.error;
            if (dailyColRes.error) throw dailyColRes.error;

            // TLs are already pre-filtered server-side via the .in() scope in the query above
            const tls = tlsRes.data || [];
            const riders = ridersRes.data || [];

            // Build unique RM names list for dropdown from TLs' reporting_manager field
            const uniqueRMs = [...new Set(
                tls.map((tl: any) => (tl.reporting_manager || '').trim()).filter((rm: string) => rm.length > 0)
            )].sort();
            setRmList(uniqueRMs as string[]);

            if (tls.length === 0) { setData([]); return; }

            // Track TLs that already have a today snapshot in daily_collections
            const tlsWithTodaySnapshot = new Set<string>();

            // Build collection per TL from daily_collections (historical)
            const collectionByTL = new Map<string, number>();
            const latestActiveFleetByTL = new Map<string, { date: string, count: number }>();
            (dailyColRes.data || []).forEach((row: any) => {
                const tlId = row.team_leader_id as string;
                if (!tlId) return;

                const amt = Number(row.total_collection || 0);
                collectionByTL.set(tlId, (collectionByTL.get(tlId) || 0) + amt);

                // Check if this is today's snapshot
                if (row.date === todayStr) {
                    tlsWithTodaySnapshot.add(tlId);
                }

                // Track historical active fleet
                const currentLatest = latestActiveFleetByTL.get(tlId);
                if (!currentLatest || row.date > currentLatest.date) {
                    latestActiveFleetByTL.set(tlId, { date: row.date, count: Number(row.active_riders_count || 0) });
                }
            });

            // Add today's live collection from wallet_ledger ONLY if snapshot doesn't exist
            if (todayStr >= pStart && todayStr <= pEnd) {
                (todayLedgerRes.data || []).forEach((e: any) => {
                    const tlId = (e.rider as any)?.team_leader_id as string | undefined;
                    if (!tlId || tlsWithTodaySnapshot.has(tlId)) return;

                    collectionByTL.set(tlId, (collectionByTL.get(tlId) || 0) + Number(e.amount || 0));
                });
            }

            // Riders grouped by TL
            const ridersByTL = new Map<string, typeof riders>();
            riders.forEach(r => {
                if (!r.team_leader_id) return;
                const arr = ridersByTL.get(r.team_leader_id) || [];
                arr.push(r);
                ridersByTL.set(r.team_leader_id, arr);
            });

            // Allotments and submissions by TL within date range
            const allotmentsByTL = new Map<string, number>();
            const submissionsByTL = new Map<string, number>();
            riders.forEach(r => {
                if (!r.team_leader_id) return;

                const adIst = getValidHistoricalDate(r.allotment_date, r.created_at);
                if (adIst && adIst >= pStart && adIst <= pEnd) {
                    allotmentsByTL.set(r.team_leader_id, (allotmentsByTL.get(r.team_leader_id) || 0) + 1);
                }

                // Submission: inactivated_at in range
                if (r.status === 'inactive' || r.status === 'deleted') {
                    const iat: string | null = r.inactivated_at;
                    const uat: string | null = r.updated_at;
                    const inactDate = iat ? getValidHistoricalDate(iat) : (uat ? getValidHistoricalDate(uat) : null);
                    if (inactDate && inactDate >= pStart && inactDate <= pEnd) {
                        submissionsByTL.set(r.team_leader_id, (submissionsByTL.get(r.team_leader_id) || 0) + 1);
                    }
                }
            });

            // Build final TL metrics
            const metrics: TLMetric[] = tls.map(tl => {
                const tlRiders = ridersByTL.get(tl.id) || [];
                const posRiders = tlRiders.filter(r => (r.wallet_amount || 0) > 0);
                const negRiders = tlRiders.filter(r => r.status === 'active' && (r.wallet_amount || 0) < 0);

                let activeRiderCount = 0;
                const inactiveRiderCount = tlRiders.filter(r => r.status === 'inactive').length; // Keep live inactive for consistency

                if (todayStr >= pStart && todayStr <= pEnd) {
                    // Includes today, use live active count
                    activeRiderCount = tlRiders.filter(r => r.status === 'active').length;
                } else {
                    // Past date range
                    const snapshot = latestActiveFleetByTL.get(tl.id);
                    if (snapshot && snapshot.count > 0) {
                        activeRiderCount = snapshot.count;
                    } else {
                        // Dynamic fallback calculation for pEnd
                        activeRiderCount = tlRiders.filter(r => {
                            const adIst = getValidHistoricalDate(r.allotment_date, r.created_at);
                            if (!adIst || adIst > pEnd) return false;
                            if (r.status === 'active') return true;

                            const iat: string | null = r.inactivated_at;
                            const uat: string | null = r.updated_at;
                            const inactDate = iat ? getValidHistoricalDate(iat) : (uat ? getValidHistoricalDate(uat) : null);
                            return inactDate ? inactDate > pEnd : false;
                        }).length;
                    }
                }

                return {
                    team_leader_id: tl.id,
                    tl_name: tl.full_name || 'Unknown',
                    tl_email: tl.email || '',
                    reporting_manager: tl.reporting_manager || '',
                    active_rider_count: activeRiderCount,
                    inactive_rider_count: inactiveRiderCount,
                    positive_wallet_count: posRiders.length,
                    positive_wallet_total: posRiders.reduce((s, r) => s + (r.wallet_amount || 0), 0),
                    negative_wallet_count: negRiders.length,
                    negative_wallet_total: negRiders.reduce((s, r) => s + (r.wallet_amount || 0), 0),
                    allotment_count: allotmentsByTL.get(tl.id) || 0,
                    submission_count: submissionsByTL.get(tl.id) || 0,
                    rent_collection_total: collectionByTL.get(tl.id) || 0,
                };
            });

            setData(metrics);
        } catch (err: any) {
            console.error('TLAllotment fetch error:', err);
            toast.error('Failed to load metrics: ' + (err.message || 'Unknown error'));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [startDate, endDate, scopedTlIds]);

    useEffect(() => { fetchMetrics(); }, [fetchMetrics]);

    // ── Real-time auto-refresh ──────────────────────────────────────────────
    useEffect(() => {
        const channel = supabase
            .channel('tl-allotment-live')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_collections' }, () => fetchMetrics())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'riders' }, () => fetchMetrics())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'wallet_ledger' }, () => fetchMetrics())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [fetchMetrics]);


    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchMetrics();
        toast.success('Data refreshed');
    };

    const filteredData = useMemo(() => {
        let result = data.filter(item =>
            item.tl_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.tl_email.toLowerCase().includes(searchTerm.toLowerCase())
        );
        // RM Filter
        if (filterRM !== 'all') {
            result = result.filter(i => i.reporting_manager.toLowerCase() === filterRM.toLowerCase());
        }
        if (filterRisk === 'high_risk') result = result.filter(i => Math.abs(i.negative_wallet_total) > i.positive_wallet_total);
        else if (filterRisk === 'low_risk') result = result.filter(i => Math.abs(i.negative_wallet_total) <= i.positive_wallet_total);
        if (filterPerformers === 'growing') result = result.filter(i => i.allotment_count - i.submission_count > 0);
        else if (filterPerformers === 'shrinking') result = result.filter(i => i.allotment_count - i.submission_count < 0);

        result = [...result].sort((a, b) => {
            let aVal: number | string, bVal: number | string;
            if (sortConfig.key === 'net_growth') {
                aVal = a.allotment_count - a.submission_count;
                bVal = b.allotment_count - b.submission_count;
            } else {
                aVal = a[sortConfig.key] as number | string;
                bVal = b[sortConfig.key] as number | string;
                if (!isNaN(Number(aVal))) aVal = Number(aVal);
                if (!isNaN(Number(bVal))) bVal = Number(bVal);
            }
            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
        return result;
    }, [data, searchTerm, filterRisk, filterPerformers, filterRM, sortConfig]);

    const handleSort = (key: keyof TLMetric | 'net_growth') => {
        setSortConfig(prev => ({
            key,
            direction: prev?.key === key && prev?.direction === 'desc' ? 'asc' : 'desc',
        }));
    };

    const stats = useMemo(() => filteredData.reduce((acc, curr) => ({
        totalAllotments: acc.totalAllotments + curr.allotment_count,
        totalSubmissions: acc.totalSubmissions + curr.submission_count,
        totalActive: acc.totalActive + curr.active_rider_count,
        totalInactive: acc.totalInactive + curr.inactive_rider_count,
        totalCollection: acc.totalCollection + curr.rent_collection_total,
        totalNetGrowth: acc.totalNetGrowth + (curr.allotment_count - curr.submission_count),
    }), { totalAllotments: 0, totalSubmissions: 0, totalActive: 0, totalInactive: 0, totalCollection: 0, totalNetGrowth: 0 }), [filteredData]);

    const exportToExcel = () => {
        const ws = XLSX.utils.json_to_sheet(filteredData.map(item => ({
            'Team Leader': item.tl_name,
            'Email': item.tl_email,
            'Active Riders': item.active_rider_count,
            'Inactive Riders': item.inactive_rider_count,
            'Allotments (Period)': item.allotment_count,
            'Submissions (Period)': item.submission_count,
            'Net Growth': item.allotment_count - item.submission_count,
            'Rent Collection (Period)': item.rent_collection_total,
            'Positive Wallet Count': item.positive_wallet_count,
            'Positive Wallet Total': item.positive_wallet_total,
            'Negative Wallet Count (Active)': item.negative_wallet_count,
            'Negative Wallet Total': item.negative_wallet_total,
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'TL Allotments');
        XLSX.writeFile(wb, `tl_allotments_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
        toast.success('Excel exported');
        setIsExportOpen(false);
    };

    const exportToPDF = () => {
        const doc = new jsPDF('l', 'mm', 'a4');
        doc.setFontSize(18);
        doc.setTextColor(79, 70, 229);
        doc.text('TL Allotment & Rent Recovery Report', 14, 20);
        doc.setFontSize(9);
        doc.setTextColor(120);
        doc.text(`Period: ${startDate ? format(startDate, 'PP') : '—'} → ${endDate ? format(endDate, 'PP') : '—'}`, 14, 28);
        (doc as any).autoTable({
            head: [['TL Name', 'Active', 'Inactive', 'Allotments', 'Submissions', 'Net Growth', 'Rent Recovery (₹)', 'Risk Vol (₹)']],
            body: filteredData.map(item => [
                item.tl_name,
                item.active_rider_count,
                item.inactive_rider_count,
                item.allotment_count,
                item.submission_count,
                item.allotment_count - item.submission_count,
                `₹${Number(item.rent_collection_total).toLocaleString('en-IN')}`,
                `₹${Math.abs(item.negative_wallet_total).toLocaleString('en-IN')}`,
            ]),
            startY: 35,
            theme: 'striped',
            headStyles: { fillColor: [79, 70, 229], fontSize: 8 },
            styles: { fontSize: 7.5 },
        });
        doc.save(`tl_allotments_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
        toast.success('PDF exported');
        setIsExportOpen(false);
    };

    const SortIcon = ({ colKey }: { colKey: keyof TLMetric | 'net_growth' }) =>
        sortConfig.key === colKey
            ? <ChevronDown className={`w-3 h-3 transition-transform text-primary ${sortConfig.direction === 'asc' ? 'rotate-180' : ''}`} />
            : <ChevronDown className="w-3 h-3 opacity-20 group-hover:opacity-50 transition-opacity" />;

    const isActivePreset = (preset: 'today' | 'yesterday' | 'week' | 'month') => {
        if (!startDate || !endDate) return false;
        const today = toISTDate();
        if (preset === 'today') return format(startDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd') && format(endDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
        if (preset === 'yesterday') { const y = new Date(today); y.setDate(today.getDate() - 1); return format(startDate, 'yyyy-MM-dd') === format(y, 'yyyy-MM-dd') && format(endDate, 'yyyy-MM-dd') === format(y, 'yyyy-MM-dd'); }
        if (preset === 'week') { const w = new Date(today); w.setDate(today.getDate() - 6); return format(startDate, 'yyyy-MM-dd') === format(w, 'yyyy-MM-dd'); }
        if (preset === 'month') return format(startDate, 'yyyy-MM-dd') === format(startOfMonth(today), 'yyyy-MM-dd');
        return false;
    };

    return (
        <div className="p-6 space-y-6 bg-background min-h-screen pb-20">
            {/* ─── Header ─── */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/10 border border-violet-500/20">
                            <BarChart3 className="h-6 w-6 text-violet-500" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-violet-600 to-indigo-500 bg-clip-text text-transparent">
                                TL Allotment System
                            </h1>
                            <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
                                Live tracking · Allotments · Submissions · Rent Recovery
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {/* Presets */}
                    <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/40">
                        {(['today', 'yesterday', 'week', 'month'] as const).map(p => (
                            <button key={p} onClick={() => setPreset(p)}
                                className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${isActivePreset(p) ? 'bg-primary text-primary-foreground shadow-md shadow-primary/30' : 'hover:bg-muted text-muted-foreground'}`}>
                                {p === 'week' ? 'Last 7D' : p === 'month' ? 'This Month' : p.charAt(0).toUpperCase() + p.slice(1)}
                            </button>
                        ))}
                    </div>

                    {/* Date Picker */}
                    <div className="flex items-center bg-card border border-border/50 rounded-xl px-3 py-1.5 shadow-sm gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <DatePicker
                            selectsRange
                            startDate={startDate}
                            endDate={endDate}
                            onChange={(update) => setDateRange(update)}
                            className="bg-transparent text-xs font-bold w-40 outline-none"
                            placeholderText="Custom Range"
                        />
                    </div>

                    {/* Refresh */}
                    <button onClick={handleRefresh} disabled={refreshing}
                        className="p-2 rounded-xl bg-card border border-border/50 hover:bg-muted transition-all"
                        title="Refresh data">
                        <RefreshCw className={`h-4 w-4 text-muted-foreground ${refreshing ? 'animate-spin' : ''}`} />
                    </button>

                    {/* Export */}
                    <div className="relative">
                        <button onClick={() => setIsExportOpen(!isExportOpen)}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-500 text-white rounded-xl text-sm font-bold hover:opacity-90 hover:shadow-lg hover:shadow-violet-500/30 transition-all active:scale-95">
                            <Download className="h-4 w-4" />
                            Export
                        </button>
                        {isExportOpen && (
                            <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-xl shadow-2xl z-50 p-2 animate-in fade-in slide-in-from-top-2">
                                <button onClick={exportToExcel} className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-muted rounded-lg flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500" /> Excel (.xlsx)
                                </button>
                                <button onClick={exportToPDF} className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-muted rounded-lg flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-rose-500" /> PDF Report (.pdf)
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ─── Stats Cards ─── */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                    { label: 'Allotments', value: stats.totalAllotments, icon: ArrowUpRight, color: 'text-emerald-500', bg: 'from-emerald-500/10 to-transparent', border: 'border-emerald-500/20' },
                    { label: 'Submissions', value: stats.totalSubmissions, icon: ArrowDownRight, color: 'text-rose-500', bg: 'from-rose-500/10 to-transparent', border: 'border-rose-500/20' },
                    { label: 'Net Growth', value: (stats.totalNetGrowth > 0 ? '+' : '') + stats.totalNetGrowth, icon: TrendingUp, color: stats.totalNetGrowth >= 0 ? 'text-indigo-500' : 'text-rose-500', bg: 'from-indigo-500/10 to-transparent', border: 'border-indigo-500/20' },
                    { label: 'Active Fleet', value: stats.totalActive, icon: Users, color: 'text-sky-500', bg: 'from-sky-500/10 to-transparent', border: 'border-sky-500/20' },
                    { label: 'Inactive', value: stats.totalInactive, icon: Activity, color: 'text-amber-500', bg: 'from-amber-500/10 to-transparent', border: 'border-amber-500/20' },
                    { label: 'Rent Recovery', value: `₹${stats.totalCollection.toLocaleString('en-IN')}`, icon: IndianRupee, color: 'text-violet-500', bg: 'from-violet-500/10 to-transparent', border: 'border-violet-500/20' },
                ].map((s, i) => (
                    <div key={i} className={`p-4 rounded-2xl border bg-gradient-to-br ${s.bg} ${s.border} flex flex-col gap-2 shadow-sm`}>
                        <div className="flex items-center justify-between">
                            <p className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-widest">{s.label}</p>
                            <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
                        </div>
                        <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* ─── Table Container ─── */}
            <div className="bg-card border border-border/40 rounded-3xl shadow-2xl overflow-hidden">
                {/* Table Toolbar */}
                <div className="p-4 border-b border-border/40 flex flex-col md:flex-row justify-between items-center gap-3 bg-gradient-to-r from-violet-500/5 via-transparent to-indigo-500/5">
                    <div className="flex items-center gap-3 w-full md:w-auto flex-1">
                        <div className="relative w-full md:w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search Team Leader..."
                                className="w-full pl-10 pr-4 py-2.5 bg-background border border-border/60 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* RM Filter Dropdown */}
                        {rmList.length > 0 && (
                            <select
                                value={filterRM}
                                onChange={e => setFilterRM(e.target.value)}
                                className={`px-3 py-2.5 rounded-2xl text-sm font-bold border transition-all outline-none cursor-pointer ${
                                    filterRM !== 'all'
                                        ? 'bg-teal-500/10 border-teal-500/30 text-teal-700 dark:text-teal-300'
                                        : 'bg-background border-border/60 hover:bg-muted text-foreground'
                                }`}
                            >
                                <option value="all">All RMs</option>
                                {rmList.map(rm => (
                                    <option key={rm} value={rm}>{rm}</option>
                                ))}
                            </select>
                        )}

                        <div className="relative">
                            <button
                                onClick={() => setIsFilterOpen(!isFilterOpen)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold border transition-all ${isFilterOpen || filterRisk !== 'all' || filterPerformers !== 'all'
                                    ? 'bg-primary/10 border-primary/30 text-primary'
                                    : 'bg-background border-border/60 hover:bg-muted'}`}
                            >
                                <Filter className="w-4 h-4" />
                                Filters
                                {(filterRisk !== 'all' || filterPerformers !== 'all') && (
                                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                )}
                            </button>
                            {isFilterOpen && (
                                <div className="absolute top-full left-0 mt-2 w-64 bg-card border border-border rounded-2xl shadow-2xl z-50 p-4 animate-in fade-in slide-in-from-top-2">
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-[9px] font-black uppercase text-muted-foreground mb-2 tracking-wider">Risk Profile</p>
                                            <div className="grid grid-cols-3 gap-2">
                                                {['all', 'high_risk', 'low_risk'].map(v => (
                                                    <button key={v} onClick={() => setFilterRisk(v as any)}
                                                        className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all capitalize ${filterRisk === v ? (v === 'high_risk' ? 'bg-rose-500 text-white' : v === 'low_risk' ? 'bg-emerald-500 text-white' : 'bg-primary text-primary-foreground') : 'bg-muted hover:bg-muted/80'}`}>
                                                        {v === 'high_risk' ? 'High' : v === 'low_risk' ? 'Low' : 'All'}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black uppercase text-muted-foreground mb-2 tracking-wider">Growth</p>
                                            <div className="grid grid-cols-3 gap-2">
                                                {['all', 'growing', 'shrinking'].map(v => (
                                                    <button key={v} onClick={() => setFilterPerformers(v as any)}
                                                        className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all ${filterPerformers === v ? (v === 'growing' ? 'bg-emerald-500 text-white' : v === 'shrinking' ? 'bg-rose-500 text-white' : 'bg-primary text-primary-foreground') : 'bg-muted hover:bg-muted/80'}`}>
                                                        {v === 'growing' ? '▲ Up' : v === 'shrinking' ? '▼ Down' : 'All'}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-border/40">
                                        <button onClick={() => { setFilterRisk('all'); setFilterPerformers('all'); setFilterRM('all'); setIsFilterOpen(false); }}
                                            className="w-full py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
                                            Clear All Filters
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 bg-background/80 px-3 py-1.5 rounded-xl border border-emerald-500/20 shadow-sm">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">Live · Direct Query</span>
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-muted/30 text-[9px] uppercase font-black tracking-widest text-muted-foreground border-b border-border/40">
                            <tr>
                                {[
                                    { label: 'Team Leader', key: 'tl_name', align: 'left' },
                                    { label: 'Active Riders', key: 'active_rider_count', align: 'center' },
                                    { label: 'Wallet Status', key: 'positive_wallet_total', align: 'center' },
                                    { label: 'Allotments', key: 'allotment_count', align: 'center' },
                                    { label: 'Submissions', key: 'submission_count', align: 'center' },
                                    { label: 'Rent Recovery', key: 'rent_collection_total', align: 'center' },
                                    { label: 'Net Growth', key: 'net_growth', align: 'center' },
                                ].map(col => (
                                    <th key={col.key}
                                        className={`px-5 py-4 cursor-pointer hover:bg-muted/60 transition-colors group whitespace-nowrap ${col.align === 'center' ? 'text-center' : ''}`}
                                        onClick={() => handleSort(col.key as any)}>
                                        <div className={`flex items-center gap-1.5 ${col.align === 'center' ? 'justify-center' : ''}`}>
                                            {col.label}
                                            <SortIcon colKey={col.key as any} />
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20">
                            {loading ? (
                                Array(6).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={7} className="px-5 py-6">
                                            <div className="h-10 bg-muted/40 rounded-xl w-full" />
                                        </td>
                                    </tr>
                                ))
                            ) : filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-5 py-24 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <SearchX className="h-14 w-14 text-muted-foreground/20" />
                                            <p className="text-lg font-bold text-muted-foreground">No data found for this period.</p>
                                            <button onClick={handleRefresh} className="text-xs text-primary font-bold hover:underline">Try refreshing</button>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredData.map((tl) => {
                                const netGrowth = tl.allotment_count - tl.submission_count;
                                const isHighRisk = Math.abs(tl.negative_wallet_total) > tl.positive_wallet_total;

                                return (
                                    <tr key={tl.team_leader_id}
                                        className="group hover:bg-violet-500/3 transition-all duration-200 border-b border-border/10 last:border-0">
                                        {/* TL Name */}
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center font-black text-violet-600 border border-violet-500/20 text-sm shadow-sm">
                                                        {tl.tl_name.charAt(0).toUpperCase()}
                                                    </div>
                                                    {isHighRisk && (
                                                        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-rose-500 border-2 border-background" title="High Risk" />
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-black text-foreground text-sm leading-tight">{tl.tl_name}</p>
                                                    <p className="text-[10px] text-muted-foreground truncate max-w-[140px]">{tl.tl_email}</p>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Active Riders */}
                                        <td className="px-5 py-4 text-center">
                                            <div className="flex flex-col items-center gap-0.5">
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-base font-black text-emerald-500">{tl.active_rider_count}</span>
                                                    <span className="text-muted-foreground/30 font-bold text-sm">|</span>
                                                    <span className="text-sm font-bold text-rose-400">{tl.inactive_rider_count}</span>
                                                </div>
                                                <div className="flex gap-1.5 text-[7px] font-black tracking-widest uppercase">
                                                    <span className="text-emerald-500/70">ACT</span>
                                                    <span className="text-rose-400/70">INACT</span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Wallet Status */}
                                        <td className="px-5 py-4 text-center">
                                            <div className="flex flex-col items-center gap-1">
                                                <div className="flex gap-1.5">
                                                    <span className="text-[9px] font-black bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-md border border-emerald-500/15">
                                                        {tl.positive_wallet_count} POS
                                                    </span>
                                                    <span className="text-[9px] font-black bg-rose-500/10 text-rose-600 px-2 py-0.5 rounded-md border border-rose-500/15">
                                                        {tl.negative_wallet_count} NEG
                                                    </span>
                                                </div>
                                                <div className="flex gap-2 text-[9px] font-bold">
                                                    <span className="text-emerald-600">₹{Number(tl.positive_wallet_total).toLocaleString('en-IN')}</span>
                                                    <span className="text-rose-500">₹{Math.abs(tl.negative_wallet_total).toLocaleString('en-IN')}</span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Allotments */}
                                        <td className="px-5 py-4 text-center">
                                            <div className="inline-flex flex-col items-center px-3 py-1.5 rounded-xl bg-emerald-500/8 border border-emerald-500/15">
                                                <span className="text-base font-black text-emerald-600">+{tl.allotment_count}</span>
                                                <ArrowUpRight className="h-3 w-3 text-emerald-400" />
                                            </div>
                                        </td>

                                        {/* Submissions */}
                                        <td className="px-5 py-4 text-center">
                                            <div className="inline-flex flex-col items-center px-3 py-1.5 rounded-xl bg-rose-500/8 border border-rose-500/15">
                                                <span className="text-base font-black text-rose-600">–{tl.submission_count}</span>
                                                <ArrowDownRight className="h-3 w-3 text-rose-400" />
                                            </div>
                                        </td>

                                        {/* Rent Recovery — THE KEY COLUMN */}
                                        <td className="px-5 py-4 text-center">
                                            <div className="inline-flex flex-col items-center px-3 py-2 rounded-xl bg-violet-500/8 border border-violet-500/20">
                                                <div className="flex items-center gap-1">
                                                    <IndianRupee className="h-3 w-3 text-violet-500" />
                                                    <span className="text-base font-black text-violet-600 font-mono">
                                                        {Number(tl.rent_collection_total).toLocaleString('en-IN')}
                                                    </span>
                                                </div>
                                                <span className="text-[8px] font-black uppercase tracking-widest text-violet-400 mt-0.5">Collected</span>
                                            </div>
                                        </td>

                                        {/* Net Growth */}
                                        <td className="px-5 py-4 text-center">
                                            <div className={`inline-flex flex-col items-center px-4 py-2 rounded-2xl border transition-all group-hover:scale-105 ${netGrowth >= 0
                                                ? 'bg-emerald-500/8 border-emerald-500/20 text-emerald-600'
                                                : 'bg-rose-500/8 border-rose-500/20 text-rose-600'}`}>
                                                <span className="text-base font-black">
                                                    {netGrowth > 0 ? '+' : ''}{netGrowth}
                                                </span>
                                                <span className="text-[7px] font-black uppercase tracking-widest opacity-70">Net Growth</span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Table Footer */}
                {!loading && filteredData.length > 0 && (
                    <div className="px-5 py-3 border-t border-border/30 bg-muted/10 flex items-center justify-between">
                        <p className="text-[10px] font-bold text-muted-foreground">
                            Showing <span className="text-foreground">{filteredData.length}</span> of <span className="text-foreground">{data.length}</span> Team Leaders
                        </p>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-bold">
                            <Wallet className="h-3 w-3 text-violet-500" />
                            Total Rent Recovery:
                            <span className="text-violet-600 font-black">₹{stats.totalCollection.toLocaleString('en-IN')}</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TLAllotment;
