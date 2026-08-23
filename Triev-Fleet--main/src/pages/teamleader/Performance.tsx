import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/config/supabase';
import { getValidHistoricalDate } from '@/utils/dateUtils';
import { fetchAllRidersPaginated, fetchTablePaginated } from '@/utils/dbUtils';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import {
    Activity, Users, Wallet, Target,
    TrendingUp, TrendingDown, Clock, Info, Search, Download,
    RefreshCw, IndianRupee, Zap, BarChart3, ArrowUpRight,
    ArrowDownRight, Filter, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, subDays, startOfMonth, eachDayOfInterval } from 'date-fns';
import { jsonToExcel } from '@/utils/xlsxExport';
import PerformanceCard from '@/components/dashboard/PerformanceCard';
import AIPerformanceInsights from '@/components/dashboard/AIPerformanceInsights';
import { exportBrandedPerformancePDF } from '@/utils/exportUtils';

// ─── Types ────────────────────────────────────────────────────────────────
interface DailyRow {
    date: string;
    collections: number;
    activeRiders: number;
    allotments: number;
    submissions: number;
    netGrowth: number;
    leads: number;
    conversions: number;
    avgCollection: number; // per active rider
}

interface Summary {
    activeFleet: number;
    totalRiders: number;
    periodCollections: number;
    conversionRate: number;
    avgWallet: number;
    totalLeads: number;
    netGrowth: number;
    bestDay: string;
    bestDayAmount: number;
    totalAllotments: number;
    totalSubmissions: number;
    activeDays: number; // Days with at least one collection
}

// ─── IST Helpers ──────────────────────────────────────────────────────────
const toISTStr = (d: Date): string =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);

const todayIST = (): Date => {
    const s = toISTStr(new Date());
    const [y, m, day] = s.split('-').map(Number);
    return new Date(y, m - 1, day);
};

// ─── Main Component ───────────────────────────────────────────────────────
const TLPersonalPerformance: React.FC = () => {
    const { userData } = useSupabaseAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isExportOpen, setIsExportOpen] = useState(false);

    // Raw data
    const [riders, setRiders] = useState<any[]>([]);
    const [leads, setLeads] = useState<any[]>([]);
    const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);

    // Filters
    const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom'>('month');
    const [customStart, setCustomStart] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
    const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [showOnlyActive, setShowOnlyActive] = useState(false); // Only show days with collection

    // ─── Fetch Everything (Fast & Targeted) ─────────────────────────────────
    const isFetchingRef = React.useRef(false);

    const fetchAll = useCallback(async (isInitial = false) => {
        if (!userData?.id) return;
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;

        if (isInitial) {
            setLoading(true);
        }

        try {
            const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
            const [y, m, d] = todayStr.split('-').map(Number);
            const midnight = new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - 5.5 * 60 * 60 * 1000).toISOString();
            const endOfDay = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999) - 5.5 * 60 * 60 * 1000).toISOString();

            const [ridersResRaw, leadsResRaw, dailyResRaw, todayLedgerResRaw] = await Promise.all([
                // 1. Targeted fetch: ONLY this TL's riders directly by team_leader_id
                fetchAllRidersPaginated(
                    'id, status, allotment_date, inactivated_at, wallet_amount, created_at, updated_at, last_status_change_at, team_leader_id, team_leader_name',
                    { column: 'team_leader_id', value: userData.id }
                ),

                // 2. Leads for this TL
                fetchTablePaginated('leads', 'status, created_at', [{ column: 'created_by', value: userData.id }]),

                // 3. Daily collections snapshot for this TL
                fetchTablePaginated('daily_collections', 'date, total_collection, active_riders_count', [{ column: 'team_leader_id', value: userData.id }]),

                // 4. Wallet ledger live collections for today
                supabase
                    .from('wallet_ledger')
                    .select('amount, rider:riders!inner(team_leader_id)')
                    .eq('mode', 'ADD')
                    .in('transaction_type', [
                        'DAILY_COLLECTION', 'DAILY COLLECTION',
                        'RENT_COLLECTION', 'RENT COLLECTION',
                        'FTD_COLLECTION', 'FTD COLLECTION',
                        'COLLECTION', 'RENT'
                    ])
                    .eq('rider.team_leader_id', userData.id)
                    .or(`and(transaction_date.gte.${midnight},transaction_date.lte.${endOfDay}),and(transaction_date.is.null,created_at.gte.${midnight})`)
            ]);
            
            const ridersRes = { data: ridersResRaw.data || [], error: ridersResRaw.error };
            const leadsRes = { data: leadsResRaw.data || [], error: leadsResRaw.error };
            const dailyRes = { data: (dailyResRaw.data || []).sort((a: any, b: any) => b.date.localeCompare(a.date)), error: dailyResRaw.error };
            const todayLedgerRes = { data: todayLedgerResRaw.data || [], error: todayLedgerResRaw.error };

            if (ridersRes.error) throw ridersRes.error;
            if (dailyRes.error) throw dailyRes.error;

            const riderData = ridersRes.data || [];
            const activeNow = riderData.filter((r: any) => String(r.status || '').toLowerCase() === 'active').length;

            // ── Helper: compute historical active count for any date ──
            const getHistoricalActiveCount = (ds: string) => {
                return riderData.filter((r: any) => {
                    const adIst = getValidHistoricalDate(r.allotment_date, r.created_at);
                    if (!adIst || adIst > ds) return false;

                    if (String(r.status || '').toLowerCase() === 'active') {
                        return true;
                    }

                    const iat: string | null = r.inactivated_at;
                    const uat: string | null = r.updated_at;
                    const inactDate = iat ? getValidHistoricalDate(iat) : (uat ? getValidHistoricalDate(uat) : null);
                    return inactDate ? inactDate > ds : false;
                }).length;
            };

            // Build merged daily records: prioritize recorded snapshot if > 0
            let dailyRecords: Array<{ date: string; total_collection: number; active_riders_count: number }> =
                (dailyRes.data || []).map((r: any) => {
                    const recordedFleet = Number(r.active_riders_count) || 0;
                    return {
                        date: r.date as string,
                        total_collection: Number(r.total_collection) || 0,
                        active_riders_count: r.date === todayStr ? activeNow : (recordedFleet > 0 ? recordedFleet : (getHistoricalActiveCount(r.date) || activeNow)),
                    };
                });

            const realTodayCol = (todayLedgerRes.data || []).reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
            const existingTodayIdx = dailyRecords.findIndex(r => r.date === todayStr);
            if (existingTodayIdx >= 0) {
                dailyRecords[existingTodayIdx].total_collection = Math.max(dailyRecords[existingTodayIdx].total_collection, realTodayCol);
                dailyRecords[existingTodayIdx].active_riders_count = activeNow;
            } else if (realTodayCol > 0 || activeNow > 0) {
                dailyRecords = [{ date: todayStr, total_collection: realTodayCol, active_riders_count: activeNow }, ...dailyRecords];
            }

            setRiders(riderData);
            setLeads(leadsRes.data || []);
            setLedgerEntries(dailyRecords as any);
        } catch (err: any) {
            console.error('Performance fetch error:', err);
            toast.error('Failed to load data: ' + err.message);
        } finally {
            isFetchingRef.current = false;
            setLoading(false);
            setRefreshing(false);
        }
    }, [userData?.id]);

    useEffect(() => {
        fetchAll(true);
    }, [fetchAll]);

    // Real-time subscription with debouncing to prevent UI flashing
    useEffect(() => {
        if (!userData?.id) return;
        let timer: ReturnType<typeof setTimeout> | null = null;
        const fetchDebounced = () => {
            if (document.hidden) return;
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
                fetchAll(false);
            }, 3500);
        };

        const channelName = `tl-perf-live-${Math.random().toString(36).substring(2, 9)}`;
        const sub = supabase
            .channel(channelName)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'riders', filter: `team_leader_id=eq.${userData.id}` }, fetchDebounced)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_collections', filter: `team_leader_id=eq.${userData.id}` }, fetchDebounced)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'wallet_ledger' }, fetchDebounced)
            .subscribe();

        return () => {
            if (timer) clearTimeout(timer);
            supabase.removeChannel(sub);
        };
    }, [userData?.id, fetchAll]);

    // ─── Date Range Calculation ───────────────────────────────────────────
    const { rangeStart, rangeEnd } = useMemo(() => {
        const today = todayIST();
        switch (dateFilter) {
            case 'today': return { rangeStart: today, rangeEnd: today };
            case 'yesterday': { const y = new Date(today); y.setDate(today.getDate() - 1); return { rangeStart: y, rangeEnd: y }; }
            case 'week': { const w = new Date(today); w.setDate(today.getDate() - 6); return { rangeStart: w, rangeEnd: today }; }
            case 'month': return { rangeStart: startOfMonth(today), rangeEnd: today };
            case 'custom': {
                const [sy, sm, sd] = customStart.split('-').map(Number);
                const [ey, em, ed] = customEnd.split('-').map(Number);
                return { rangeStart: new Date(sy, sm - 1, sd), rangeEnd: new Date(ey, em - 1, ed) };
            }
            default: return { rangeStart: startOfMonth(today), rangeEnd: today };
        }
    }, [dateFilter, customStart, customEnd]);

    // ─── Main Computation ──────────────────────────────────────────────────
    const { summary, ledger } = useMemo(() => {
        // ledgerEntries now contains daily_collections records: {date, total_collection, active_riders_count}
        // Build a map from date → { collection, activeRiders }
        const dailyMap = new Map<string, { col: number; active: number }>();
        (ledgerEntries as any[]).forEach((rec: any) => {
            const d = rec.date as string;
            if (!d) return;
            dailyMap.set(d, {
                col: Number(rec.total_collection) || 0,
                active: Number(rec.active_riders_count) || 0,
            });
        });

        // Build daily ledger rows for every day in the selected range
        const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd }).reverse();
        const dailyLedger: DailyRow[] = days.map(day => {
            const ds = format(day, 'yyyy-MM-dd');
            const dayData = dailyMap.get(ds);
            const col = dayData?.col || 0;

            // Allotments: use IST date only (removed wallet_amount === 0 check to prevent history disappearing)
            const dayAllotments = riders.filter(r => {
                const adIst = getValidHistoricalDate(r.allotment_date, r.created_at);
                if (!adIst) return false;
                return adIst === ds;
            }).length;

            // Submissions: inactive or deleted riders whose inactivated_at (IST date) == ds
            const daySubmissions = riders.filter(r => {
                if (r.status !== 'inactive' && r.status !== 'deleted') return false;
                // Prefer genuine inactivated_at date, fallback to updated_at
                const iat: string | null = r.inactivated_at;
                const uat: string | null = r.updated_at;
                const inactDate = iat ? getValidHistoricalDate(iat) : (uat ? getValidHistoricalDate(uat) : null);
                return inactDate === ds;
            }).length;

            // Active fleet: Historical calculation dynamically computed using repaired dates
            // If the database has a reliable active snapshot, we use it. 
            let activeOnDay = dayData?.active || 0;

            if (activeOnDay === 0) {
                // Dynamic fallback if no snapshot exists for this day
                activeOnDay = riders.filter(r => {
                    const adIst = getValidHistoricalDate(r.allotment_date, r.created_at);
                    if (!adIst) return false;
                    if (adIst > ds) return false; // Was allotted AFTER this date

                    if (r.status === 'active') return true;

                    const iat: string | null = r.inactivated_at;
                    const uat: string | null = r.updated_at;
                    const inactDate = iat ? getValidHistoricalDate(iat) : (uat ? getValidHistoricalDate(uat) : null);

                    return inactDate ? inactDate > ds : false;
                }).length;
            }

            const dayLeads = leads.filter(l => l.created_at && toISTStr(new Date(l.created_at)) === ds);
            const dayConv = dayLeads.filter(l => l.status === 'Convert').length;

            return {
                date: ds,
                collections: col,
                activeRiders: activeOnDay,
                allotments: dayAllotments,
                submissions: daySubmissions,
                netGrowth: dayAllotments - daySubmissions,
                leads: dayLeads.length,
                conversions: dayConv,
                avgCollection: activeOnDay > 0 && col > 0 ? Math.round(col / activeOnDay) : 0,
            };
        });



        // Summary
        const totalCol = dailyLedger.reduce((s, d) => s + d.collections, 0);
        const totalAllot = dailyLedger.reduce((s, d) => s + d.allotments, 0);
        const totalSub = dailyLedger.reduce((s, d) => s + d.submissions, 0);
        const totalLeads = dailyLedger.reduce((s, d) => s + d.leads, 0);
        const totalConv = dailyLedger.reduce((s, d) => s + d.conversions, 0);
        const activeDays = dailyLedger.filter(d => d.collections > 0).length;

        const activeRiders = riders.filter(r => r.status === 'active');
        const avgWallet = activeRiders.length > 0
            ? Math.round(activeRiders.reduce((s, r) => s + (r.wallet_amount || 0), 0) / activeRiders.length)
            : 0;

        const bestDay = dailyLedger.reduce((best, d) => d.collections > best.collections ? d : best, { date: '-', collections: 0 });

        const summ: Summary = {
            activeFleet: activeRiders.length,
            totalRiders: riders.length,
            periodCollections: totalCol,
            conversionRate: totalLeads > 0 ? Math.round((totalConv / totalLeads) * 100) : 0,
            avgWallet,
            totalLeads,
            netGrowth: totalAllot - totalSub,
            bestDay: bestDay.date !== '-' ? bestDay.date : '-',
            bestDayAmount: bestDay.collections,
            totalAllotments: totalAllot,
            totalSubmissions: totalSub,
            activeDays,
        };

        return { summary: summ, ledger: dailyLedger };
    }, [riders, leads, ledgerEntries, rangeStart, rangeEnd]);

    // ─── Filtered Ledger ──────────────────────────────────────────────────
    const filteredLedger = useMemo(() => {
        let rows = ledger;
        if (showOnlyActive) rows = rows.filter(r => r.collections > 0 || r.allotments > 0 || r.submissions > 0);
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            rows = rows.filter(r =>
                r.date.includes(q) ||
                r.collections.toString().includes(q)
            );
        }
        return rows;
    }, [ledger, searchQuery, showOnlyActive]);

    // ─── Export Functions ─────────────────────────────────────────────────
    const exportExcel = async () => {
        const rowsToExport = filteredLedger.map(r => ({
            'Date': r.date,
            'Collections (₹)': r.collections,
            'Active Fleet': r.activeRiders,
            'Avg / Rider (₹)': r.avgCollection,
            'Allotments': r.allotments,
            'Submissions': r.submissions,
            'Net Growth': r.netGrowth,
            'Leads': r.leads,
            'Conversions': r.conversions,
        }));
        // Add summary row
        rowsToExport.push({
            'Date': 'TOTAL',
            'Collections (₹)': summary.periodCollections,
            'Active Fleet': summary.activeFleet,
            'Avg / Rider (₹)': Math.round(summary.periodCollections / (summary.activeDays || 1)),
            'Allotments': summary.totalAllotments,
            'Submissions': summary.totalSubmissions,
            'Net Growth': summary.netGrowth,
            'Leads': summary.totalLeads,
            'Conversions': 0
        });

        await jsonToExcel(rowsToExport, 'Performance', `my_performance_${format(new Date(), 'yyyy-MM-dd')}`);
        toast.success('Excel exported');
        setIsExportOpen(false);
    };

    const exportPDF = () => {
        const kpis = [
            { label: 'Active Fleet', value: `${summary.activeFleet}/${summary.totalRiders}` },
            { label: 'Period Collection', value: `₹${summary.periodCollections.toLocaleString('en-IN')}` },
            { label: 'Avg / Active Day', value: `₹${Math.round(summary.periodCollections / (summary.activeDays || 1)).toLocaleString('en-IN')}` },
            { label: 'Net Growth', value: `${summary.netGrowth > 0 ? '+' : ''}${summary.netGrowth}` },
            { label: 'Conversion Rate', value: `${summary.conversionRate}%` }
        ];

        const cols = ['Date', 'Collections (₹)', 'Active Fleet', 'Avg/Rider (₹)', 'Allotments', 'Submissions', 'Net Growth', 'Leads', 'Conversions'];
        const rows = filteredLedger.map(r => [
            r.date,
            `₹${r.collections.toLocaleString('en-IN')}`,
            r.activeRiders,
            `₹${r.avgCollection.toLocaleString('en-IN')}`,
            r.allotments,
            r.submissions,
            r.netGrowth,
            r.leads,
            r.conversions,
        ]);

        const fileName = `Performance_${userData?.fullName?.replace(/\s+/g, '_') || 'TL'}_${format(new Date(), 'yyyy-MM-dd')}`;
        const titleText = `Personal Performance (${format(rangeStart, 'dd MMM yyyy')} - ${format(rangeEnd, 'dd MMM yyyy')})`;

        exportBrandedPerformancePDF(titleText, kpis, cols, rows, fileName);
        toast.success('Branded PDF exported successfully');
        setIsExportOpen(false);
    };

    // ─── Preset Active Detection ──────────────────────────────────────────
    const isPresetActive = (p: string) => {
        if (dateFilter !== p) return false;
        return true;
    };

    // ─── Render ────────────────────────────────────────────────────────────
    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-muted-foreground font-bold animate-pulse text-sm">Loading performance data...</p>
            </div>
        </div>
    );



    return (
        <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto min-h-screen pb-24 bg-background">

            {/* ── Header ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-primary/20 to-indigo-500/10 rounded-xl border border-primary/20">
                        <Zap className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black bg-gradient-to-r from-primary to-indigo-500 bg-clip-text text-transparent">
                            My Performance Dashboard
                        </h1>
                        <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
                            {userData?.fullName || 'Team Leader'} · Real-time fleet, collections & growth tracker
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Preset Buttons */}
                    <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/40">
                        {(['today', 'yesterday', 'week', 'month'] as const).map(p => (
                            <button key={p} onClick={() => setDateFilter(p)}
                                className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${isPresetActive(p) ? 'bg-primary text-primary-foreground shadow-md shadow-primary/30' : 'hover:bg-muted text-muted-foreground'}`}>
                                {p === 'week' ? 'Last 7D' : p === 'month' ? 'This Month' : p.charAt(0).toUpperCase() + p.slice(1)}
                            </button>
                        ))}
                        <button onClick={() => setDateFilter('custom')}
                            className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${isPresetActive('custom') ? 'bg-primary text-primary-foreground shadow-md shadow-primary/30' : 'hover:bg-muted text-muted-foreground'}`}>
                            Custom
                        </button>
                    </div>

                    {/* Custom inputs */}
                    {dateFilter === 'custom' && (
                        <div className="flex items-center gap-1.5 bg-card border border-border/50 rounded-xl px-3 py-1.5 text-xs font-bold">
                            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                                className="bg-transparent outline-none text-xs font-bold" />
                            <span className="text-muted-foreground">→</span>
                            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                                className="bg-transparent outline-none text-xs font-bold" />
                        </div>
                    )}

                    {/* Refresh */}
                    <button onClick={() => { setRefreshing(true); fetchAll(); }}
                        disabled={refreshing}
                        className="p-2 rounded-xl bg-card border border-border/50 hover:bg-muted transition-all" title="Refresh">
                        <RefreshCw className={`h-4 w-4 text-muted-foreground ${refreshing ? 'animate-spin' : ''}`} />
                    </button>

                    {/* Export */}
                    <div className="relative">
                        <button onClick={() => setIsExportOpen(!isExportOpen)}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-indigo-500 text-white rounded-xl text-sm font-bold hover:opacity-90 hover:shadow-lg hover:shadow-primary/30 transition-all active:scale-95">
                            <Download className="h-4 w-4" />
                            Export
                        </button>
                        {isExportOpen && (
                            <div className="absolute right-0 mt-2 w-44 bg-card border border-border rounded-xl shadow-2xl z-50 p-2 animate-in fade-in slide-in-from-top-2">
                                <button onClick={exportExcel} className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-muted rounded-lg flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500" /> Excel (.xlsx)
                                </button>
                                <button onClick={exportPDF} className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-muted rounded-lg flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-rose-500" /> PDF Report (.pdf)
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── KPI Cards V2 ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <PerformanceCard
                    title="Active Fleet"
                    value={`${summary.activeFleet}`}
                    subtext={`/ ${summary.totalRiders} total fleet`}
                    icon={Users}
                    colorScheme="blue"
                    badgeText={`${summary.totalRiders > 0 ? Math.round((summary.activeFleet / summary.totalRiders) * 100) : 0}% Active`}
                    badgeVariant="blue"
                />
                <PerformanceCard
                    title="Period Collections"
                    value={`₹${summary.periodCollections.toLocaleString('en-IN')}`}
                    subtext={`${summary.activeDays} active collection days`}
                    icon={IndianRupee}
                    colorScheme="emerald"
                    badgeText="Revenue"
                    badgeVariant="emerald"
                />
                <PerformanceCard
                    title="Avg / Active Day"
                    value={`₹${Math.round(summary.periodCollections / (summary.activeDays || 1)).toLocaleString('en-IN')}`}
                    subtext={summary.bestDay !== '-' ? `Best: ${format(new Date(summary.bestDay), 'dd MMM')}` : 'No collection yet'}
                    icon={BarChart3}
                    colorScheme="purple"
                />
                <PerformanceCard
                    title="Net Fleet Growth"
                    value={`${summary.netGrowth > 0 ? '+' : ''}${summary.netGrowth}`}
                    subtext={`${summary.totalAllotments} in · ${summary.totalSubmissions} out`}
                    icon={summary.netGrowth >= 0 ? TrendingUp : TrendingDown}
                    colorScheme={summary.netGrowth >= 0 ? 'emerald' : 'rose'}
                    trend={{ value: summary.netGrowth, label: 'net' }}
                />
                <PerformanceCard
                    title="Avg Wallet Balance"
                    value={`₹${summary.avgWallet.toLocaleString('en-IN')}`}
                    subtext="Active riders balance"
                    icon={Wallet}
                    colorScheme="amber"
                />
                <PerformanceCard
                    title="Lead Conversion"
                    value={`${summary.conversionRate}%`}
                    subtext={`${summary.totalLeads} total leads`}
                    icon={Target}
                    colorScheme="orange"
                    progress={{ current: summary.conversionRate, target: 100 }}
                />
            </div>

            {/* ── AI Performance Insights Widget ── */}
            <AIPerformanceInsights
                roleName={userData?.fullName || 'My Team'}
                totalCollection={summary.periodCollections}
                activeRidersCount={summary.activeFleet}
                totalRidersCount={summary.totalRiders}
                leadConversionRate={summary.conversionRate}
            />

            {/* ── Daily Ledger Table ── */}
            <div className="bg-card border border-border/50 rounded-3xl overflow-hidden shadow-xl">
                {/* Toolbar */}
                <div className="p-4 border-b border-border/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gradient-to-r from-primary/5 via-transparent to-indigo-500/5">
                    <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-primary" />
                        <h2 className="text-base font-black tracking-tight">Daily Operations Ledger</h2>
                        <span className="text-[9px] font-black text-muted-foreground/50 uppercase tracking-widest ml-1">
                            {filteredLedger.length} rows
                        </span>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="relative flex-1 sm:flex-none">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="pl-9 pr-4 py-2 bg-background border border-border/60 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 w-full sm:w-48"
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                                    <X className="w-3 h-3 text-muted-foreground" />
                                </button>
                            )}
                        </div>

                        <button
                            onClick={() => setShowOnlyActive(!showOnlyActive)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${showOnlyActive ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-background border-border/60 hover:bg-muted text-muted-foreground'}`}>
                            <Filter className="w-3 h-3" />
                            Active Only
                        </button>

                        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black text-emerald-600 uppercase tracking-wider">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Live
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-muted/30 text-[9px] uppercase font-black tracking-widest text-muted-foreground border-b border-border/40">
                            <tr>
                                <th className="px-5 py-4 whitespace-nowrap">Date</th>
                                <th className="px-5 py-4 text-center whitespace-nowrap">Collections</th>
                                <th className="px-5 py-4 text-center whitespace-nowrap">Avg / Rider</th>
                                <th className="px-5 py-4 text-center whitespace-nowrap">Fleet</th>
                                <th className="px-5 py-4 text-center whitespace-nowrap">Allotted</th>
                                <th className="px-5 py-4 text-center whitespace-nowrap">Churn</th>
                                <th className="px-5 py-4 text-center whitespace-nowrap">Net Growth</th>
                                <th className="px-5 py-4 text-center whitespace-nowrap">Leads : Conv</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20">
                            {filteredLedger.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-5 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3 opacity-30">
                                            <Activity size={40} />
                                            <p className="text-sm font-black uppercase tracking-widest">No data found</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredLedger.map(row => {
                                const isGoodDay = row.collections > 0;
                                return (
                                    <tr key={row.date}
                                        className={`transition-colors hover:bg-primary/[0.02] ${isGoodDay ? '' : 'opacity-60'}`}>
                                        {/* Date */}
                                        <td className="px-5 py-3.5">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-black text-foreground">
                                                    {format(new Date(row.date + 'T00:00:00'), 'dd MMM yyyy')}
                                                </span>
                                                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                                                    {format(new Date(row.date + 'T00:00:00'), 'EEEE')}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Collections */}
                                        <td className="px-5 py-3.5 text-center">
                                            <span className={`text-sm font-black font-mono ${row.collections > 0 ? 'text-emerald-500' : 'text-muted-foreground/30'}`}>
                                                ₹{row.collections.toLocaleString('en-IN')}
                                            </span>
                                        </td>

                                        {/* Avg / Rider */}
                                        <td className="px-5 py-3.5 text-center">
                                            <span className={`text-xs font-bold font-mono ${row.avgCollection > 0 ? 'text-violet-500' : 'text-muted-foreground/30'}`}>
                                                ₹{row.avgCollection.toLocaleString('en-IN')}
                                            </span>
                                        </td>

                                        {/* Fleet */}
                                        <td className="px-5 py-3.5 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <span className="text-sm font-black text-blue-500">{row.activeRiders}</span>
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-400/40" />
                                            </div>
                                        </td>

                                        {/* Allotted */}
                                        <td className="px-5 py-3.5 text-center">
                                            <span className={`text-xs font-bold ${row.allotments > 0 ? 'text-indigo-500' : 'text-muted-foreground/25'}`}>
                                                {row.allotments > 0 ? <span className="flex items-center justify-center gap-0.5"><ArrowUpRight className="w-3 h-3" />+{row.allotments}</span> : '—'}
                                            </span>
                                        </td>

                                        {/* Churn */}
                                        <td className="px-5 py-3.5 text-center">
                                            <span className={`text-xs font-bold ${row.submissions > 0 ? 'text-rose-500' : 'text-muted-foreground/25'}`}>
                                                {row.submissions > 0 ? <span className="flex items-center justify-center gap-0.5"><ArrowDownRight className="w-3 h-3" />–{row.submissions}</span> : '—'}
                                            </span>
                                        </td>

                                        {/* Net Growth */}
                                        <td className="px-5 py-3.5 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                {row.netGrowth > 0 && <TrendingUp size={12} className="text-emerald-500" />}
                                                {row.netGrowth < 0 && <TrendingDown size={12} className="text-rose-500" />}
                                                <span className={`text-sm font-black ${row.netGrowth > 0 ? 'text-emerald-500' : row.netGrowth < 0 ? 'text-rose-500' : 'text-muted-foreground/30'}`}>
                                                    {row.netGrowth > 0 ? `+${row.netGrowth}` : row.netGrowth === 0 ? '0' : row.netGrowth}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Leads:Conv */}
                                        <td className="px-5 py-3.5 text-center">
                                            <div className="flex flex-col items-center gap-1">
                                                <span className="text-xs font-black">
                                                    {row.leads} : {row.conversions}
                                                </span>
                                                <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                                                    <div className="h-full bg-amber-500 transition-all"
                                                        style={{ width: `${row.leads > 0 ? (row.conversions / row.leads) * 100 : 0}%` }} />
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        {/* Totals Footer */}
                        {filteredLedger.length > 0 && (
                            <tfoot>
                                <tr className="bg-muted/30 border-t-2 border-border/40 text-[10px] font-black uppercase tracking-wider">
                                    <td className="px-5 py-3 text-muted-foreground">Period Total</td>
                                    <td className="px-5 py-3 text-center text-emerald-600">
                                        ₹{filteredLedger.reduce((s, r) => s + r.collections, 0).toLocaleString('en-IN')}
                                    </td>
                                    <td className="px-5 py-3 text-center text-violet-500">
                                        {/* Avg/Rider = total collection ÷ weighted-avg active riders across collection days */}
                                        {(() => {
                                            const activeDays = filteredLedger.filter(r => r.collections > 0);
                                            const totalCol = activeDays.reduce((s, r) => s + r.collections, 0);
                                            const weightedRiders = activeDays.reduce((s, r) => s + r.activeRiders, 0);
                                            const avgRiders = activeDays.length > 0 ? weightedRiders / activeDays.length : 1;
                                            const avgPerRider = avgRiders > 0 ? Math.round(totalCol / avgRiders) : 0;
                                            return `₹${avgPerRider.toLocaleString('en-IN')}`;
                                        })()}
                                    </td>
                                    <td className="px-5 py-3 text-center">—</td>
                                    <td className="px-5 py-3 text-center text-indigo-500">
                                        +{filteredLedger.reduce((s, r) => s + r.allotments, 0)}
                                    </td>
                                    <td className="px-5 py-3 text-center text-rose-500">
                                        –{filteredLedger.reduce((s, r) => s + r.submissions, 0)}
                                    </td>
                                    <td className="px-5 py-3 text-center">
                                        {filteredLedger.reduce((s, r) => s + r.netGrowth, 0) >= 0 ? '+' : ''}
                                        {filteredLedger.reduce((s, r) => s + r.netGrowth, 0)}
                                    </td>
                                    <td className="px-5 py-3 text-center">
                                        {filteredLedger.reduce((s, r) => s + r.leads, 0)} : {filteredLedger.reduce((s, r) => s + r.conversions, 0)}
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            {/* Footer Note */}
            <div className="flex items-start gap-3 p-4 bg-muted/20 rounded-2xl border border-border/40">
                <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p className="text-[11px] font-medium text-muted-foreground leading-relaxed">
                    Data is aggregated in real-time from <strong>wallet_ledger</strong> (collections) and <strong>riders</strong> tables.
                    Collections are date-filtered using IST timezone. Negative wallet balances shown for active riders only.
                    Real-time subscriptions update automatically on fleet or transaction changes.
                </p>
            </div>
        </div>
    );
};

export default TLPersonalPerformance;
