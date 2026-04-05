import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '@/config/supabase';
import {
    Download, Search, TrendingUp, Users, Activity, ArrowUpRight,
    Filter, Calendar, ChevronDown, UserCheck, RefreshCw,
    ChevronUp, AlertTriangle, Star, Target, Clock
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { calculateAIScore } from '@/utils/performance';
import { fetchAllRidersPaginated } from '@/utils/dbUtils';
import { useDebounce } from '@/hooks/useDebounce';
import { User, Rider, Lead, UserStatus } from '@/types';

interface TLPerformanceProps {
    scopedTlIds?: string[];
}

interface TLRawData {
    riders: Rider[];
    leads: Lead[];
    teamLeaders: User[];
    todayMap: Record<string, number>;
    weeklyMap: Record<string, number>;
    monthlyMap: Record<string, number>;
    periodMap: Record<string, number>;
    fetchedTodayStr: string;
}

interface TLRow {
    id: string;
    name: string;
    email: string;
    status: UserStatus;
    reportingManager: string;
    // Fleet
    totalRiders: number;
    activeRiders: number;
    // Collection
    todayCollection: number;
    weeklyCollection: number;
    monthlyCollection: number;
    periodCollection: number;
    periodDayAvg: number;
    periodPerRider: number;
    // Wallet
    positiveCount: number;
    negativeCount: number;
    positiveAmount: number;
    negativeAmount: number;
    // Flow (A/S/N)
    allotments: number;
    submissions: number;
    netGrowth: number;
    // Leads
    leadsTotal: number;
    leadsConverted: number;
    leadsConvRate: number;
    leadsToday: number;
    churnLeads: number;
    // Avg Age
    avgTenureDays: number;
    // Score
    score: number;
    aiGrade: string;
    // Churn
    churnCount: number;
}

const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const fmtShort = (n: number) => {
    if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
    return fmt(n);
};

const SortIcon: React.FC<{ active: boolean; direction: 'asc' | 'desc'; isActive: boolean }> = ({ isActive, direction }) => (
    <span className="ml-1 inline-flex flex-col opacity-50">
        <ChevronUp size={8} className={isActive && direction === 'asc' ? 'opacity-100 text-primary' : ''} />
        <ChevronDown size={8} className={isActive && direction === 'desc' ? 'opacity-100 text-primary' : ''} />
    </span>
);

const TLPerformance: React.FC<TLPerformanceProps> = ({ scopedTlIds }) => {
    const [loading, setLoading] = useState(true);
    const [rawData, setRawData] = useState<TLRawData>({
        riders: [], leads: [], teamLeaders: [],
        todayMap: {}, weeklyMap: {}, monthlyMap: {}, periodMap: {},
        fetchedTodayStr: ''
    });

    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearch = useDebounce(searchTerm, 300);
    const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom'>('today');
    const [customRange, setCustomRange] = useState({ start: '', end: '' });
    const [rmFilter, setRmFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [riskFilter, setRiskFilter] = useState<'all' | 'high_risk' | 'low_risk'>('all');
    const [selectedTLs, setSelectedTLs] = useState<string[]>([]);
    const [sortConfig, setSortConfig] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'periodCollection', dir: 'desc' });
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [isExportOpen, setIsExportOpen] = useState(false);
    const exportRef = useRef<HTMLDivElement>(null);

    const getDateRangeStr = useCallback((filter: typeof dateFilter, custom: { start: string; end: string }) => {
        const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
        const todayStr = formatter.format(new Date());
        const [y, m, d] = todayStr.split('-').map(Number);
        const workDate = new Date(Date.UTC(y, m - 1, d));
        const dow = workDate.getUTCDay();
        const diffMon = dow === 0 ? 6 : dow - 1;
        const weekStart = new Date(workDate);
        weekStart.setUTCDate(workDate.getUTCDate() - diffMon);

        switch (filter) {
            case 'today': return { start: todayStr, end: todayStr, today: todayStr };
            case 'yesterday': {
                const yest = new Date(workDate); yest.setUTCDate(workDate.getUTCDate() - 1);
                const yStr = yest.toISOString().split('T')[0];
                return { start: yStr, end: yStr, today: todayStr };
            }
            case 'week': return { start: weekStart.toISOString().split('T')[0], end: todayStr, today: todayStr };
            case 'month': {
                const mStart = new Date(Date.UTC(y, m - 1, 1)).toISOString().split('T')[0];
                return { start: mStart, end: todayStr, today: todayStr };
            }
            case 'custom':
                return { start: custom.start || todayStr, end: custom.end || todayStr, today: todayStr };
            default: return { start: todayStr, end: todayStr, today: todayStr };
        }
    }, []);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
            const todayStr = formatter.format(new Date());
            const [y, m, d] = todayStr.split('-').map(Number);
            const workDate = new Date(Date.UTC(y, m - 1, d));
            const dow = workDate.getUTCDay();
            const diffMon = dow === 0 ? 6 : dow - 1;
            const weekStart = new Date(workDate); weekStart.setUTCDate(workDate.getUTCDate() - diffMon);
            const weekStartStr = weekStart.toISOString().split('T')[0];
            const monthStartStr = new Date(Date.UTC(y, m - 1, 1)).toISOString().split('T')[0];

            let tlQuery = supabase.from('users').select('*').eq('role', 'teamLeader');
            if (scopedTlIds && scopedTlIds.length > 0) tlQuery = tlQuery.in('id', scopedTlIds);

            const [ridersRes, leadsRes, tlRes, todayCollRes, weekCollRes, monthCollRes] = await Promise.all([
                scopedTlIds && scopedTlIds.length > 0
                    ? fetchAllRidersPaginated('*', { column: 'team_leader_id', value: scopedTlIds, type: 'in' })
                    : fetchAllRidersPaginated('*'),
                supabase.from('leads').select('*'),
                tlQuery,
                // Today's collection
                supabase.from('daily_collections').select('team_leader_id, total_collection').eq('date', todayStr),
                // Weekly collection
                supabase.from('daily_collections').select('team_leader_id, total_collection').gte('date', weekStartStr),
                // Monthly collection
                supabase.from('daily_collections').select('team_leader_id, total_collection').gte('date', monthStartStr),
            ]);

            if (ridersRes.error) throw ridersRes.error;
            if (leadsRes.error) throw leadsRes.error;
            if (tlRes.error) throw tlRes.error;
            if (todayCollRes.error) throw todayCollRes.error;
            if (weekCollRes.error) throw weekCollRes.error;
            if (monthCollRes.error) throw monthCollRes.error;

            const aggMap = (rows: { team_leader_id: string; total_collection: number }[]) => {
                const map: Record<string, number> = {};
                rows.forEach(r => {
                    if (r.team_leader_id) map[r.team_leader_id] = (map[r.team_leader_id] || 0) + (Number(r.total_collection) || 0);
                });
                return map;
            };

            const todayMap = aggMap(todayCollRes.data || []);
            const weeklyMap = aggMap(weekCollRes.data || []);
            const monthlyMap = aggMap(monthCollRes.data || []);

            // Map TL data — Supabase select('*') returns snake_case, we need to map to our User type
            const teamLeaders: User[] = (tlRes.data || []).map((u: Record<string, unknown>) => ({
                ...u,
                id: u.id as string,
                userId: (u.user_id as string) || '',
                fullName: (u.full_name as string) || (u.fullName as string) || 'Unknown TL',
                email: u.email as string,
                mobile: (u.mobile as string) || '',
                username: (u.username as string) || '',
                role: u.role as string,
                jobLocation: (u.job_location as string) || '',
                status: u.status as UserStatus,
                reportingManager: (u.reporting_manager as string) || '',
                permissions: u.permissions as Record<string, unknown>,
                createdAt: (u.created_at as string) || '',
                updatedAt: (u.updated_at as string) || '',
            } as unknown as User));

            setRawData({
                riders: ridersRes.data || [],
                leads: (leadsRes.data || []) as Lead[],
                teamLeaders,
                todayMap,
                weeklyMap,
                monthlyMap,
                periodMap: todayMap, // default; recomputed in processRows
                fetchedTodayStr: todayStr
            });
        } catch (err) {
            console.error('TLPerformance fetchData:', err);
            toast.error('Failed to load performance data');
        } finally {
            setLoading(false);
        }
    }, [scopedTlIds]);

    // Re-fetch period-specific data when date filter changes (for custom/yesterday/etc)
    const fetchPeriodData = useCallback(async () => {
        const { start, end } = getDateRangeStr(dateFilter, customRange);
        if (!start || !end) return;
        const { data, error } = await supabase.from('daily_collections')
            .select('team_leader_id, total_collection')
            .gte('date', start).lte('date', end);
        if (error) return;
        const map: Record<string, number> = {};
        (data || []).forEach((r: { team_leader_id: string; total_collection: number }) => {
            if (r.team_leader_id) map[r.team_leader_id] = (map[r.team_leader_id] || 0) + (Number(r.total_collection) || 0);
        });
        setRawData(prev => ({ ...prev, periodMap: map }));
    }, [dateFilter, customRange, getDateRangeStr]);

    useEffect(() => { fetchData(); }, [fetchData]);
    useEffect(() => { fetchPeriodData(); }, [fetchPeriodData]);

    useEffect(() => {
        const channels = [
            supabase.channel('tlp-riders').on('postgres_changes', { event: '*', schema: 'public', table: 'riders' }, fetchData).subscribe(),
            supabase.channel('tlp-leads').on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, fetchData).subscribe(),
            supabase.channel('tlp-coll').on('postgres_changes', { event: '*', schema: 'public', table: 'daily_collections' }, fetchData).subscribe(),
        ];
        return () => { channels.forEach(ch => supabase.removeChannel(ch)); };
    }, [fetchData]);

    const daysInPeriod = useMemo(() => {
        if (dateFilter === 'today' || dateFilter === 'yesterday') return 1;
        if (dateFilter === 'week') return 7;
        if (dateFilter === 'month') return 30;
        if (dateFilter === 'custom' && customRange.start && customRange.end) {
            const diff = Math.ceil((new Date(customRange.end).getTime() - new Date(customRange.start).getTime()) / 86400000) + 1;
            return Math.max(1, diff);
        }
        return 1;
    }, [dateFilter, customRange]);

    const processRows = useMemo<TLRow[]>(() => {
        const { fetchedTodayStr } = rawData;

        return rawData.teamLeaders.map(tl => {
            const metrics = calculateAIScore(tl, rawData.riders, rawData.leads, rawData.todayMap[tl.id] || 0);

            // Period collection
            const periodCol = (() => {
                if (dateFilter === 'today') return rawData.todayMap[tl.id] || 0;
                if (dateFilter === 'week') return rawData.weeklyMap[tl.id] || 0;
                if (dateFilter === 'month') return rawData.monthlyMap[tl.id] || 0;
                return rawData.periodMap[tl.id] || 0;
            })();

            // Leads
            const tlLeads = rawData.leads.filter(l => l.createdBy === tl.id);
            const leadsToday = tlLeads.filter(l => l.createdAt?.startsWith(fetchedTodayStr)).length;
            const churnLeads = tlLeads.filter(l => l.status === 'Not Convert').length;

            // Churn: riders who went inactive in-period
            const churnedRiders = rawData.riders.filter(r =>
                (r.teamLeaderId === tl.id || (r as unknown as Record<string, string>).team_leader_id === tl.id) &&
                r.status === 'inactive' &&
                r.inactivatedAt?.startsWith(fetchedTodayStr)
            ).length;

            const tlName = tl.fullName || (tl as unknown as Record<string, string>).full_name || 'Unknown TL';

            return {
                id: tl.id,
                name: tlName,
                email: tl.email || '',
                status: tl.status,
                reportingManager: tl.reportingManager || (tl as unknown as Record<string, string>).reporting_manager || 'N/A',
                totalRiders: metrics.totalRiders,
                activeRiders: metrics.activeRiders,
                todayCollection: rawData.todayMap[tl.id] || 0,
                weeklyCollection: rawData.weeklyMap[tl.id] || 0,
                monthlyCollection: rawData.monthlyMap[tl.id] || 0,
                periodCollection: periodCol,
                periodDayAvg: daysInPeriod > 0 ? Math.round(periodCol / daysInPeriod) : 0,
                periodPerRider: metrics.activeRiders > 0 ? Math.round(periodCol / metrics.activeRiders) : 0,
                positiveCount: metrics.positiveWalletCount,
                negativeCount: metrics.negativeWalletCount,
                positiveAmount: metrics.positiveWallet,
                negativeAmount: metrics.negativeWallet,
                allotments: metrics.allotments,
                submissions: metrics.submissions,
                netGrowth: metrics.netGrowth,
                leadsTotal: metrics.leadsTotal,
                leadsConverted: metrics.convertedLeads,
                leadsConvRate: metrics.conversionRate,
                leadsToday,
                churnLeads,
                avgTenureDays: metrics.avgRiderAge,
                score: metrics.score,
                aiGrade: metrics.aiGrade,
                churnCount: churnedRiders,
            };
        });
    }, [rawData, dateFilter, daysInPeriod]);

    const uniqueRMs = useMemo(() => {
        const rms = [...new Set(processRows.map(t => t.reportingManager).filter(r => r && r !== 'N/A'))];
        return rms.sort();
    }, [processRows]);

    const filteredData = useMemo<TLRow[]>(() => {
        let data = [...processRows];
        if (debouncedSearch) {
            const s = debouncedSearch.toLowerCase();
            data = data.filter(t => t.name.toLowerCase().includes(s) || t.email.toLowerCase().includes(s) || t.reportingManager.toLowerCase().includes(s));
        }
        if (statusFilter !== 'all') data = data.filter(t => t.status === statusFilter);
        if (riskFilter === 'high_risk') data = data.filter(t => t.negativeCount > 0);
        if (riskFilter === 'low_risk') data = data.filter(t => t.negativeCount === 0);
        if (rmFilter !== 'all') data = data.filter(t => t.reportingManager === rmFilter);
        if (selectedTLs.length > 0) data = data.filter(t => selectedTLs.includes(t.id));

        data.sort((a, b) => {
            const av = a[sortConfig.key as keyof TLRow];
            const bv = b[sortConfig.key as keyof TLRow];
            if (typeof av === 'number' && typeof bv === 'number')
                return sortConfig.dir === 'asc' ? av - bv : bv - av;
            return sortConfig.dir === 'asc'
                ? String(av).localeCompare(String(bv))
                : String(bv).localeCompare(String(av));
        });
        return data;
    }, [processRows, debouncedSearch, statusFilter, riskFilter, rmFilter, selectedTLs, sortConfig]);

    // Grand Totals
    const totals = useMemo(() => ({
        totalRiders: filteredData.reduce((s, t) => s + t.totalRiders, 0),
        activeRiders: filteredData.reduce((s, t) => s + t.activeRiders, 0),
        positiveCount: filteredData.reduce((s, t) => s + t.positiveCount, 0),
        negativeCount: filteredData.reduce((s, t) => s + t.negativeCount, 0),
        positiveAmount: filteredData.reduce((s, t) => s + t.positiveAmount, 0),
        negativeAmount: filteredData.reduce((s, t) => s + t.negativeAmount, 0),
        todayCollection: filteredData.reduce((s, t) => s + t.todayCollection, 0),
        weeklyCollection: filteredData.reduce((s, t) => s + t.weeklyCollection, 0),
        monthlyCollection: filteredData.reduce((s, t) => s + t.monthlyCollection, 0),
        periodCollection: filteredData.reduce((s, t) => s + t.periodCollection, 0),
        allotments: filteredData.reduce((s, t) => s + t.allotments, 0),
        submissions: filteredData.reduce((s, t) => s + t.submissions, 0),
        netGrowth: filteredData.reduce((s, t) => s + t.netGrowth, 0),
        leadsToday: filteredData.reduce((s, t) => s + t.leadsToday, 0),
        churnLeads: filteredData.reduce((s, t) => s + t.churnLeads, 0),
        score: filteredData.length > 0 ? Math.round(filteredData.reduce((s, t) => s + t.score, 0) / filteredData.length) : 0,
    }), [filteredData]);

    const handleSort = (key: string) => {
        setSortConfig(prev => ({ key, dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc' }));
    };

    const SortTh: React.FC<{ label: string; sortKey: string; className?: string }> = ({ label, sortKey, className = '' }) => (
        <th className={`px-3 py-3 cursor-pointer select-none whitespace-nowrap hover:bg-muted/40 ${className}`}
            onClick={() => handleSort(sortKey)}>
            {label}
            <SortIcon active isActive={sortConfig.key === sortKey} direction={sortConfig.dir} />
        </th>
    );

    const exportToExcel = () => {
        const ws = XLSX.utils.json_to_sheet(filteredData.map(t => ({
            'Team Leader': t.name, 'Email': t.email, 'RM': t.reportingManager, 'Status': t.status,
            'Active Riders': t.activeRiders, 'Total Riders': t.totalRiders,
            'Today Collection': t.todayCollection, 'Weekly Collection': t.weeklyCollection, 'Monthly Collection': t.monthlyCollection,
            'Period Collection': t.periodCollection, 'Per Rider': t.periodPerRider, 'Day Avg': t.periodDayAvg,
            'Pos Wallet Count': t.positiveCount, 'Neg Wallet Count': t.negativeCount,
            'Pos Wallet ₹': t.positiveAmount, 'Neg Wallet ₹': t.negativeAmount,
            'Allotments': t.allotments, 'Submissions': t.submissions, 'Net Growth': t.netGrowth,
            'Leads Today': t.leadsToday, 'Churn Leads': t.churnLeads,
            'Leads Conv%': t.leadsConvRate, 'Avg Age (Days)': t.avgTenureDays,
            'AI Score': t.score, 'AI Grade': t.aiGrade
        })));
        const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'TL Performance');
        XLSX.writeFile(wb, `tl_performance_${new Date().toISOString().split('T')[0]}.xlsx`);
        toast.success('Excel exported!');
    };

    const exportToPDF = () => {
        const doc = new jsPDF('landscape');
        doc.setFontSize(14); doc.text('Team Performance Engine', 14, 15);
        autoTable(doc, {
            head: [['Team Leader', 'RM', 'Active/Total', 'Period Coll.', 'Per Rider', 'POS/NEG', 'Growth', 'A/S', 'Score']],
            body: filteredData.map(t => [
                t.name, t.reportingManager, `${t.activeRiders}/${t.totalRiders}`,
                fmt(t.periodCollection), fmt(t.periodPerRider),
                `${t.positiveCount}/${t.negativeCount}`,
                t.netGrowth >= 0 ? `+${t.netGrowth}` : String(t.netGrowth),
                `+${t.allotments} / -${t.submissions}`,
                `${t.score} (${t.aiGrade})`
            ]),
            startY: 22, styles: { fontSize: 7 }, headStyles: { fillColor: [79, 70, 229] }
        });
        doc.save(`tl_performance_${new Date().toISOString().split('T')[0]}.pdf`);
        toast.success('PDF exported!');
    };

    const activeTLCount = filteredData.filter(t => t.status === 'active').length;
    const topPerformer = filteredData.length > 0 ? [...filteredData].sort((a, b) => b.score - a.score)[0] : null;
    const avgScore = totals.score;
    const avgGrade = avgScore >= 70 ? 'A' : avgScore >= 50 ? 'B' : avgScore >= 30 ? 'C' : 'D';

    const dateLabel: Record<string, string> = { today: 'Today', yesterday: 'Yesterday', week: 'This Week', month: 'This Month', custom: 'Custom' };

    if (loading && rawData.teamLeaders.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[400px] gap-3 text-muted-foreground">
                <Activity className="h-6 w-6 animate-spin text-primary" />
                <span className="text-sm font-semibold">Loading performance data...</span>
            </div>
        );
    }

    return (
        <div className="space-y-0 pb-12">
            {/* ── HERO HEADER ─────────────────────────────────────────────────────── */}
            <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-black p-7 rounded-b-[2.5rem] shadow-2xl relative overflow-hidden border-b border-white/5">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-[-20%] left-[-10%] w-[40%] h-[80%] bg-indigo-600 rounded-full blur-[140px] opacity-10" />
                    <div className="absolute bottom-[-30%] right-[-5%] w-[35%] h-[80%] bg-emerald-500 rounded-full blur-[120px] opacity-10" />
                </div>
                <div className="relative flex flex-col md:flex-row md:items-start justify-between gap-5">
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-white/10 backdrop-blur rounded-2xl border border-white/10">
                                <TrendingUp className="h-6 w-6 text-emerald-400" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-black text-white tracking-tight">Team Performance Engine</h1>
                                <p className="text-white/40 text-xs mt-0.5">Real-time TL analytics & fleet intelligence</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="px-3 py-1 bg-white/10 text-white/70 rounded-full text-[10px] font-black uppercase tracking-wider border border-white/5">
                                {filteredData.length} Control Units
                            </span>
                            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-[10px] font-black uppercase border border-emerald-400/20">
                                {activeTLCount} Active
                            </span>
                            {topPerformer && (
                                <span className="px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full text-[10px] font-black border border-amber-400/20">
                                    🏆 {topPerformer.name.split(' ')[0]} ({topPerformer.aiGrade})
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Summary stat pills */}
                    <div className="flex flex-wrap gap-2 md:justify-end">
                        {[
                            { label: 'Today Coll.', value: fmtShort(totals.todayCollection), color: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/20', Icon: TrendingUp },
                            { label: 'Active Riders', value: totals.activeRiders.toString(), color: 'bg-blue-500/20 text-blue-300 border-blue-400/20', Icon: Users },
                            { label: 'Net Risk', value: fmtShort(totals.negativeAmount), color: 'bg-rose-500/20 text-rose-300 border-rose-400/20', Icon: AlertTriangle },
                            { label: 'Avg Score', value: `${avgScore} (${avgGrade})`, color: 'bg-violet-500/20 text-violet-300 border-violet-400/20', Icon: Star },
                            { label: 'Leads Found', value: `+${totals.leadsToday}`, color: 'bg-indigo-500/20 text-indigo-300 border-indigo-400/20', Icon: Target },
                            { label: 'Net Growth', value: totals.netGrowth >= 0 ? `+${totals.netGrowth}` : String(totals.netGrowth), color: totals.netGrowth >= 0 ? 'bg-teal-500/20 text-teal-300 border-teal-400/20' : 'bg-rose-500/20 text-rose-300 border-rose-400/20', Icon: ArrowUpRight },
                        ].map(({ label, value, color, Icon }, i) => (
                            <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-black uppercase ${color}`}>
                                <Icon size={12} />
                                <span>{label}: {value}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Action buttons */}
                <div className="relative flex items-center justify-end gap-3 mt-5">
                    <div ref={exportRef} className="relative">
                        <button
                            onClick={() => setIsExportOpen(v => !v)}
                            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-sm text-white font-semibold transition-all"
                        >
                            <Download className="h-4 w-4" /> Export
                        </button>
                        {isExportOpen && (
                            <div className="absolute right-0 top-full mt-2 w-48 bg-card border border-border rounded-xl shadow-2xl z-50 p-2 space-y-1">
                                <button onClick={() => { exportToExcel(); setIsExportOpen(false); }} className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-muted rounded-lg flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500" /> Excel (.xlsx)
                                </button>
                                <button onClick={() => { exportToPDF(); setIsExportOpen(false); }} className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-muted rounded-lg flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-rose-500" /> PDF Document
                                </button>
                            </div>
                        )}
                    </div>
                    <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-sm text-white font-semibold transition-all">
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                    </button>
                    <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/20 text-emerald-300 border border-emerald-400/20 rounded-xl text-[10px] font-black uppercase tracking-wider">
                        <Activity className="h-3 w-3 animate-pulse" /> Live Sync
                    </div>
                </div>
            </div>

            <div className="px-4 pt-5 space-y-4">
                {/* ── ANALYSIS CORE TABLE CARD ─────────────────────────────────────── */}
                <div className="bg-card border border-border/40 rounded-2xl shadow-xl overflow-hidden">
                    {/* Table Controls */}
                    <div className="p-4 border-b border-border/40 bg-muted/10 flex flex-col md:flex-row justify-between gap-3 flex-wrap">
                        <div>
                            <h2 className="text-base font-bold">Analysis Core</h2>
                            <p className="text-[10px] text-muted-foreground">Strategic performance monitoring and data decomposition.</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                    placeholder="Search TL units..." className="pl-9 pr-3 py-2 bg-background border border-border rounded-xl text-xs w-52 focus:ring-2 focus:ring-primary/20" />
                            </div>
                            {/* Date Filter */}
                            <div className="relative">
                                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-primary" />
                                <select value={dateFilter} onChange={e => setDateFilter(e.target.value as typeof dateFilter)}
                                    className="pl-8 pr-7 py-2 bg-background border border-border rounded-xl text-xs focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer">
                                    <option value="today">Today</option>
                                    <option value="yesterday">Yesterday</option>
                                    <option value="week">This Week</option>
                                    <option value="month">This Month</option>
                                    <option value="custom">Custom Range</option>
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-primary/70 pointer-events-none" />
                            </div>
                            {/* Custom date range */}
                            {dateFilter === 'custom' && (
                                <div className="flex items-center gap-1 bg-background border border-border rounded-xl px-2 py-1">
                                    <input type="date" className="text-[10px] py-0.5 px-1 bg-transparent focus:outline-none" value={customRange.start} onChange={e => setCustomRange(p => ({ ...p, start: e.target.value }))} />
                                    <span className="text-[10px] text-muted-foreground">→</span>
                                    <input type="date" className="text-[10px] py-0.5 px-1 bg-transparent focus:outline-none" value={customRange.end} onChange={e => setCustomRange(p => ({ ...p, end: e.target.value }))} />
                                </div>
                            )}
                            {/* RM Filter */}
                            {uniqueRMs.length > 0 && (
                                <div className="relative">
                                    <UserCheck className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-teal-600" />
                                    <select value={rmFilter} onChange={e => setRmFilter(e.target.value)}
                                        className="pl-8 pr-7 py-2 bg-background border border-border rounded-xl text-xs focus:ring-2 focus:ring-teal-500/20 appearance-none cursor-pointer">
                                        <option value="all">All Managers</option>
                                        {uniqueRMs.map(rm => <option key={rm} value={rm}>{rm}</option>)}
                                    </select>
                                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-teal-600/70 pointer-events-none" />
                                </div>
                            )}
                            {/* More Filters toggle */}
                            <button onClick={() => setIsFilterOpen(v => !v)}
                                className={`p-2 border rounded-xl hover:bg-muted transition-colors ${isFilterOpen ? 'bg-primary/10 border-primary/30' : ''}`}>
                                <Filter className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* Expanded Filter Panel */}
                    {isFilterOpen && (
                        <div className="px-5 py-4 border-b border-border/40 bg-muted/5 grid grid-cols-2 md:grid-cols-4 gap-4 animate-in slide-in-from-top-2 duration-200">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-muted-foreground">Status</label>
                                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)} className="w-full py-1.5 px-2 bg-background border border-border rounded-lg text-xs">
                                    <option value="all">All</option><option value="active">Active</option><option value="inactive">Inactive</option>
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-muted-foreground">Wallet Risk</label>
                                <select value={riskFilter} onChange={e => setRiskFilter(e.target.value as typeof riskFilter)} className="w-full py-1.5 px-2 bg-background border border-border rounded-lg text-xs">
                                    <option value="all">All</option><option value="high_risk">Has Negative</option><option value="low_risk">All Positive</option>
                                </select>
                            </div>
                            <div className="space-y-1.5 col-span-2">
                                <label className="text-[10px] font-black uppercase text-muted-foreground">Filter TLs ({rawData.teamLeaders.length} total)</label>
                                <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                                    {rawData.teamLeaders.map(tl => {
                                        const name = tl.fullName || (tl as unknown as Record<string, string>).full_name || tl.id;
                                        return (
                                            <button key={tl.id}
                                                onClick={() => setSelectedTLs(p => p.includes(tl.id) ? p.filter(x => x !== tl.id) : [...p, tl.id])}
                                                className={`px-2 py-0.5 text-[10px] rounded-full border font-bold transition-colors ${selectedTLs.includes(tl.id) ? 'bg-primary text-white border-primary' : 'bg-background border-border hover:bg-muted'}`}>
                                                {name}
                                            </button>
                                        );
                                    })}
                                    {selectedTLs.length > 0 && (
                                        <button onClick={() => setSelectedTLs([])} className="px-2 py-0.5 text-[10px] rounded-full bg-rose-100 text-rose-700 border border-rose-300 font-bold">
                                            ✕ Clear
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── DATA TABLE ──────────────────────────────────────────────────── */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left border-collapse">
                            <thead className="bg-muted/30 text-[9px] font-black uppercase tracking-widest text-muted-foreground border-b border-border/40 sticky top-0 z-10">
                                <tr>
                                    <SortTh label="Team Leader" sortKey="name" className="pl-4 pr-2 py-3 min-w-[200px]" />
                                    <SortTh label="Riders" sortKey="activeRiders" className="text-center px-2" />
                                    <th className="px-2 py-3 min-w-[200px]">
                                        Collection <span className="text-primary normal-case font-semibold">▾ {dateLabel[dateFilter]}</span>
                                    </th>
                                    <th className="px-2 py-3">Wallet Health</th>
                                    <th className="px-2 py-3">Fleet Flow</th>
                                    <SortTh label="Leads %" sortKey="leadsConvRate" className="text-center px-2" />
                                    <SortTh label="Avg Age" sortKey="avgTenureDays" className="text-center px-2" />
                                    <SortTh label="Score" sortKey="score" className="text-center px-2" />
                                    <th className="px-2 py-3 text-right pr-4">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/20">
                                {filteredData.length === 0 ? (
                                    <tr><td colSpan={9} className="py-16 text-center text-muted-foreground text-sm">No data found. Try adjusting filters.</td></tr>
                                ) : filteredData.map(tl => (
                                    <tr key={tl.id} className="hover:bg-muted/10 transition-colors group">
                                        {/* TL Name + RM */}
                                        <td className="pl-4 pr-2 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary flex-shrink-0">
                                                    {(tl.name || '?').charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-[11px] leading-tight">{tl.name}</div>
                                                    <div className="text-[9px] text-muted-foreground leading-tight">{tl.email}</div>
                                                    {tl.reportingManager && tl.reportingManager !== 'N/A' && (
                                                        <div className="text-[9px] text-teal-600 font-semibold leading-tight">↳ {tl.reportingManager}</div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        {/* Riders: Active / Total */}
                                        <td className="px-2 py-3 text-center">
                                            <div className="font-black text-sm">{tl.activeRiders} <span className="text-muted-foreground font-normal text-[10px]">/ {tl.totalRiders}</span></div>
                                            <div className="w-full bg-muted/40 rounded-full h-1 mt-1">
                                                <div className="bg-blue-500 rounded-full h-1 transition-all" style={{ width: `${tl.totalRiders > 0 ? Math.round((tl.activeRiders / tl.totalRiders) * 100) : 0}%` }} />
                                            </div>
                                        </td>

                                        {/* Collection: Period/Today/Weekly/Monthly + Day Avg + Per Rider */}
                                        <td className="px-2 py-3 min-w-[190px]">
                                            <div className="space-y-0.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] font-black text-primary uppercase w-12">Today</span>
                                                    <span className="font-black text-emerald-600 text-[11px]">{fmt(tl.todayCollection)}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] font-black text-muted-foreground uppercase w-12">Weekly</span>
                                                    <span className="font-semibold text-[10px]">{fmt(tl.weeklyCollection)}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] font-black text-muted-foreground uppercase w-12">Monthly</span>
                                                    <span className="font-semibold text-[10px]">{fmt(tl.monthlyCollection)}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 mt-1.5 pt-1.5 border-t border-border/20">
                                                <span className="text-[8px] text-muted-foreground">Day avg: <span className="font-black text-foreground">{fmt(tl.periodDayAvg)}</span></span>
                                                <span className="text-[8px] text-muted-foreground">Per rider: <span className="font-black text-foreground">{fmt(tl.periodPerRider)}</span></span>
                                            </div>
                                        </td>

                                        {/* Wallet Health: POS / NEG counts + amounts */}
                                        <td className="px-2 py-3">
                                            <div className="flex items-center gap-1.5">
                                                <span className="px-1.5 py-0.5 rounded font-black text-[10px] bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">{tl.positiveCount} POS</span>
                                                <span className="px-1.5 py-0.5 rounded font-black text-[10px] bg-rose-500/10 text-rose-600 border border-rose-500/20">{tl.negativeCount} NEG</span>
                                            </div>
                                            <div className="mt-1 space-y-0.5">
                                                <div className="text-[9px] text-emerald-600 font-semibold">{fmtShort(tl.positiveAmount)}</div>
                                                <div className="text-[9px] text-rose-600 font-semibold">-{fmtShort(Math.abs(tl.negativeAmount))}</div>
                                            </div>
                                        </td>

                                        {/* Fleet Flow: Allotment / Submission / Net Growth */}
                                        <td className="px-2 py-3">
                                            <div className="space-y-0.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] text-muted-foreground w-16">Net Growth</span>
                                                    <span className={`font-black text-[11px] ${tl.netGrowth >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                        {tl.netGrowth >= 0 ? '+' : ''}{tl.netGrowth}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] text-muted-foreground w-16">Allotment</span>
                                                    <span className="font-bold text-[10px] text-emerald-500">+{tl.allotments}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] text-muted-foreground w-16">Submission</span>
                                                    <span className="font-bold text-[10px] text-rose-500">-{tl.submissions}</span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Leads % */}
                                        <td className="px-2 py-3 text-center">
                                            <div className="font-black text-[11px]">{tl.leadsConvRate}%</div>
                                            <div className="text-[9px] text-muted-foreground">{tl.leadsConverted}/{tl.leadsTotal}</div>
                                            {tl.leadsToday > 0 && <div className="text-[9px] text-indigo-500 font-bold">+{tl.leadsToday} today</div>}
                                        </td>

                                        {/* Avg Age */}
                                        <td className="px-2 py-3 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <Clock size={10} className="text-muted-foreground" />
                                                <span className="font-black text-[11px]">{Math.round(tl.avgTenureDays)}d</span>
                                            </div>
                                            <div className="text-[9px] text-muted-foreground">{Math.round(tl.avgTenureDays / 30)}mo</div>
                                        </td>

                                        {/* Score */}
                                        <td className="px-2 py-3 text-center">
                                            <div className="font-black text-indigo-600 text-base leading-none">{tl.score}</div>
                                            <span className={`text-[9px] font-black px-1 rounded ${tl.aiGrade === 'A' ? 'text-emerald-600' : tl.aiGrade === 'B' ? 'text-blue-600' : tl.aiGrade === 'C' ? 'text-amber-600' : 'text-rose-600'}`}>
                                                {tl.aiGrade}
                                            </span>
                                        </td>

                                        {/* Status */}
                                        <td className="px-2 py-3 text-right pr-4">
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${tl.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 border-rose-500/20'}`}>
                                                {tl.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>

                            {/* ── GRAND TOTALS FOOTER ────────────────────────────────────────── */}
                            {filteredData.length > 0 && (
                                <tfoot>
                                    <tr className="bg-gradient-to-r from-indigo-950/30 via-slate-900/20 to-transparent border-t-2 border-primary/30 font-black text-[10px]">
                                        <td className="pl-4 pr-2 py-3">
                                            <div className="text-[10px] font-black uppercase text-primary tracking-wider">Totals ({filteredData.length} TLs)</div>
                                        </td>
                                        <td className="px-2 py-3 text-center">
                                            <div className="font-black">{totals.activeRiders} <span className="text-muted-foreground font-normal">/ {totals.totalRiders}</span></div>
                                        </td>
                                        <td className="px-2 py-3">
                                            <div className="space-y-0.5">
                                                <div className="text-[10px] text-emerald-600 font-black">{fmt(totals.todayCollection)}</div>
                                                <div className="text-[9px] text-muted-foreground">{fmt(totals.weeklyCollection)}</div>
                                                <div className="text-[9px] text-muted-foreground">{fmt(totals.monthlyCollection)}</div>
                                            </div>
                                        </td>
                                        <td className="px-2 py-3">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-black text-emerald-600">{totals.positiveCount} POS</span>
                                                <span className="font-black text-rose-600">{totals.negativeCount} NEG</span>
                                            </div>
                                        </td>
                                        <td className="px-2 py-3">
                                            <div className={`font-black ${totals.netGrowth >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {totals.netGrowth >= 0 ? '+' : ''}{totals.netGrowth} / -{totals.submissions}
                                            </div>
                                        </td>
                                        <td className="px-2 py-3 text-center">
                                            <div className="text-primary">+{totals.leadsToday}</div>
                                        </td>
                                        <td className="px-2 py-3 text-center text-muted-foreground">—</td>
                                        <td className="px-2 py-3 text-center">
                                            <div className="font-black text-indigo-600">{totals.score} ({avgGrade})</div>
                                        </td>
                                        <td className="pr-4" />
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TLPerformance;
