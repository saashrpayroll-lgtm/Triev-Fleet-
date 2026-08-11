/* eslint-disable */
// @ts-nocheck
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
import PerformanceCard from '@/components/dashboard/PerformanceCard';
import AIPerformanceInsights from '@/components/dashboard/AIPerformanceInsights';
import { exportBrandedPerformancePDF } from '@/utils/exportUtils';
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
    grandTotalMap: Record<string, number>;
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
    inactiveRiders: number;
    // Collection
    todayCollection: number;
    weeklyCollection: number;
    monthlyCollection: number;
    grandTotal: number;
    periodCollection: number;
    periodDayAvg: number;
    periodPerRider: number;
    // Wallet
    positiveCount: number;
    negativeCount: number;
    positiveAmount: number;
    negativeAmount: number;
    walletPositivePct: number;
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
        todayMap: {}, weeklyMap: {}, monthlyMap: {}, periodMap: {}, grandTotalMap: {},
        fetchedTodayStr: ''
    });

    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearch = useDebounce(searchTerm, 300);
    const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'week' | 'lastweek' | 'month' | 'lastmonth' | 'custom'>('today');
    const [customRange, setCustomRange] = useState({ start: '', end: '' });
    const [scoreFilter, setScoreFilter] = useState<'all' | 'top' | 'mid' | 'low'>('all');
    const [collFilter, setCollFilter] = useState<'all' | 'above50k' | 'above20k' | 'below20k'>('all');
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
        const lastWeekEnd = new Date(weekStart); lastWeekEnd.setUTCDate(weekStart.getUTCDate() - 1);
        const lastWeekStart = new Date(lastWeekEnd); lastWeekStart.setUTCDate(lastWeekEnd.getUTCDate() - 6);

        switch (filter) {
            case 'today': return { start: todayStr, end: todayStr, today: todayStr };
            case 'yesterday': {
                const yest = new Date(workDate); yest.setUTCDate(workDate.getUTCDate() - 1);
                const yStr = yest.toISOString().split('T')[0];
                return { start: yStr, end: yStr, today: todayStr };
            }
            case 'week': return { start: weekStart.toISOString().split('T')[0], end: todayStr, today: todayStr };
            case 'lastweek': return { start: lastWeekStart.toISOString().split('T')[0], end: lastWeekEnd.toISOString().split('T')[0], today: todayStr };
            case 'month': {
                const mStart = new Date(Date.UTC(y, m - 1, 1)).toISOString().split('T')[0];
                return { start: mStart, end: todayStr, today: todayStr };
            }
            case 'lastmonth': {
                const lmEnd = new Date(Date.UTC(y, m - 1, 0));
                const lmStart = new Date(Date.UTC(y, m - 2, 1));
                return { start: lmStart.toISOString().split('T')[0], end: lmEnd.toISOString().split('T')[0], today: todayStr };
            }
            case 'custom':
                return { start: custom.start || todayStr, end: custom.end || todayStr, today: todayStr };
            default: return { start: todayStr, end: todayStr, today: todayStr };
        }
    }, []);

    const fetchData = useCallback(async () => {
        try {
            if (scopedTlIds !== undefined && scopedTlIds.length === 0) {
                setRawData({ 
                    riders: [], leads: [], teamLeaders: [], 
                    todayMap: {}, weeklyMap: {}, monthlyMap: {}, periodMap: {}, grandTotalMap: {}, fetchedTodayStr: '' 
                });
                setLoading(false);
                return;
            }
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

            const [ridersRes, leadsRes, tlRes, todayCollRes, weekCollRes, monthCollRes, grandCollRes] = await Promise.all([
                scopedTlIds && scopedTlIds.length > 0
                    ? fetchAllRidersPaginated('*', { column: 'team_leader_id', value: scopedTlIds, type: 'in' })
                    : fetchAllRidersPaginated('*'),
                // Leads: scope to team's TLs if applicable
                scopedTlIds && scopedTlIds.length > 0
                    ? supabase.from('leads').select('*').in('created_by', scopedTlIds)
                    : supabase.from('leads').select('*'),
                tlQuery,
                // Today's collection — scoped
                scopedTlIds && scopedTlIds.length > 0
                    ? supabase.from('daily_collections').select('team_leader_id, total_collection').eq('date', todayStr).in('team_leader_id', scopedTlIds)
                    : supabase.from('daily_collections').select('team_leader_id, total_collection').eq('date', todayStr),
                // Weekly collection (Mon–today) — scoped
                scopedTlIds && scopedTlIds.length > 0
                    ? supabase.from('daily_collections').select('team_leader_id, total_collection').gte('date', weekStartStr).in('team_leader_id', scopedTlIds)
                    : supabase.from('daily_collections').select('team_leader_id, total_collection').gte('date', weekStartStr),
                // Monthly collection (1st–today) — scoped
                scopedTlIds && scopedTlIds.length > 0
                    ? supabase.from('daily_collections').select('team_leader_id, total_collection').gte('date', monthStartStr).in('team_leader_id', scopedTlIds)
                    : supabase.from('daily_collections').select('team_leader_id, total_collection').gte('date', monthStartStr),
                // Grand Total — all time — scoped
                scopedTlIds && scopedTlIds.length > 0
                    ? supabase.from('daily_collections').select('team_leader_id, total_collection').in('team_leader_id', scopedTlIds)
                    : supabase.from('daily_collections').select('team_leader_id, total_collection'),
            ]);

            if (ridersRes.error) throw ridersRes.error;
            if (leadsRes.error) throw leadsRes.error;
            if (tlRes.error) throw tlRes.error;
            if (todayCollRes.error) throw todayCollRes.error;
            if (weekCollRes.error) throw weekCollRes.error;
            if (monthCollRes.error) throw monthCollRes.error;
            if (grandCollRes.error) throw grandCollRes.error;

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
            const grandTotalMap = aggMap(grandCollRes.data || []);

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
                grandTotalMap,
                periodMap: todayMap,
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
        let periodQuery = supabase.from('daily_collections')
            .select('team_leader_id, total_collection')
            .gte('date', start).lte('date', end);
        if (scopedTlIds && scopedTlIds.length > 0) {
            periodQuery = periodQuery.in('team_leader_id', scopedTlIds);
        }
        const { data, error } = await periodQuery;
        if (error) return;
        const map: Record<string, number> = {};
        (data || []).forEach((r: { team_leader_id: string; total_collection: number }) => {
            if (r.team_leader_id) map[r.team_leader_id] = (map[r.team_leader_id] || 0) + (Number(r.total_collection) || 0);
        });
        setRawData(prev => ({ ...prev, periodMap: map }));
    }, [dateFilter, customRange, getDateRangeStr, scopedTlIds]);

    useEffect(() => { fetchData(); }, [fetchData]);
    useEffect(() => { fetchPeriodData(); }, [fetchPeriodData]);

    useEffect(() => {
        let debounceTimer: ReturnType<typeof setTimeout> | null = null;
        const debouncedFetch = () => {
            if (document.hidden) return;
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => fetchData(), 4000);
        };
        const channels = [
            supabase.channel('tlp-riders').on('postgres_changes', { event: '*', schema: 'public', table: 'riders' }, debouncedFetch).subscribe(),
            supabase.channel('tlp-leads').on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, debouncedFetch).subscribe(),
            supabase.channel('tlp-coll').on('postgres_changes', { event: '*', schema: 'public', table: 'daily_collections' }, debouncedFetch).subscribe(),
        ];
        return () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            channels.forEach(ch => supabase.removeChannel(ch));
        };
    }, [fetchData]);

    const daysInPeriod = useMemo(() => {
        if (dateFilter === 'today' || dateFilter === 'yesterday') return 1;
        if (dateFilter === 'week' || dateFilter === 'lastweek') return 7;
        if (dateFilter === 'month' || dateFilter === 'lastmonth') return 30;
        if (dateFilter === 'custom' && customRange.start && customRange.end) {
            const diff = Math.ceil((new Date(customRange.end).getTime() - new Date(customRange.start).getTime()) / 86400000) + 1;
            return Math.max(1, diff);
        }
        return 1;
    }, [dateFilter, customRange]);

    const processRows = useMemo<TLRow[]>(() => {
        const { fetchedTodayStr } = rawData;
        const { start, end } = getDateRangeStr(dateFilter, customRange);
        const period = { start, end };

        return rawData.teamLeaders.map(tl => {
            // Period collection — compute FIRST so it can feed into calculateAIScore
            const periodCol = (() => {
                if (dateFilter === 'today') return rawData.todayMap[tl.id] || 0;
                if (dateFilter === 'week') return rawData.weeklyMap[tl.id] || 0;
                if (dateFilter === 'month') return rawData.monthlyMap[tl.id] || 0;
                return rawData.periodMap[tl.id] || 0;
            })();

            // ✅ FIX: Pass periodCol (not todayMap) so AI Score uses the selected period's collection
            const metrics = calculateAIScore(tl, rawData.riders, rawData.leads, periodCol, period);

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
                inactiveRiders: metrics.inactiveRiders,
                todayCollection: rawData.todayMap[tl.id] || 0,
                weeklyCollection: rawData.weeklyMap[tl.id] || 0,
                monthlyCollection: rawData.monthlyMap[tl.id] || 0,
                grandTotal: rawData.grandTotalMap[tl.id] || 0,
                periodCollection: periodCol,
                periodDayAvg: daysInPeriod > 0 ? Math.round(periodCol / daysInPeriod) : 0,
                periodPerRider: metrics.activeRiders > 0 ? Math.round(periodCol / metrics.activeRiders) : 0,
                positiveCount: metrics.positiveWalletCount,
                negativeCount: metrics.negativeWalletCount,
                positiveAmount: metrics.positiveWallet,
                negativeAmount: metrics.negativeWallet,
                walletPositivePct: metrics.activeRiders > 0 ? Math.round((metrics.positiveWalletCount / metrics.activeRiders) * 100) : 0,
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
    }, [rawData, dateFilter, daysInPeriod, customRange, getDateRangeStr]);

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
        // Score filter
        if (scoreFilter === 'top') data = data.filter(t => t.score >= 5000);
        if (scoreFilter === 'mid') data = data.filter(t => t.score >= 1500 && t.score < 5000);
        if (scoreFilter === 'low') data = data.filter(t => t.score < 1500);
        // Collection filter
        if (collFilter === 'above50k') data = data.filter(t => t.periodCollection >= 50000);
        if (collFilter === 'above20k') data = data.filter(t => t.periodCollection >= 20000);
        if (collFilter === 'below20k') data = data.filter(t => t.periodCollection < 20000);

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
    }, [processRows, debouncedSearch, statusFilter, riskFilter, rmFilter, selectedTLs, sortConfig, scoreFilter, collFilter]);

    // Grand Totals
    const totals = useMemo(() => ({
        totalRiders: filteredData.reduce((s, t) => s + t.totalRiders, 0),
        activeRiders: filteredData.reduce((s, t) => s + t.activeRiders, 0),
        inactiveRiders: filteredData.reduce((s, t) => s + t.inactiveRiders, 0),
        positiveCount: filteredData.reduce((s, t) => s + t.positiveCount, 0),
        negativeCount: filteredData.reduce((s, t) => s + t.negativeCount, 0),
        positiveAmount: filteredData.reduce((s, t) => s + t.positiveAmount, 0),
        negativeAmount: filteredData.reduce((s, t) => s + t.negativeAmount, 0),
        todayCollection: filteredData.reduce((s, t) => s + t.todayCollection, 0),
        weeklyCollection: filteredData.reduce((s, t) => s + t.weeklyCollection, 0),
        monthlyCollection: filteredData.reduce((s, t) => s + t.monthlyCollection, 0),
        grandTotal: filteredData.reduce((s, t) => s + t.grandTotal, 0),
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
        const kpis = [
            { label: 'Active TLs', value: `${activeTLCount}/${filteredData.length}` },
            { label: 'Period Collection', value: fmtShort(totals.periodCollection) },
            { label: 'Active Fleet', value: `${totals.activeRiders}/${totals.totalRiders}` },
            { label: 'Wallet Risk', value: fmtShort(Math.abs(totals.negativeAmount)) },
            { label: 'Avg AI Score', value: `${avgScore} (${avgGrade})` }
        ];

        const cols = ['Team Leader', 'RM', 'Active/Total', 'Period Coll.', 'Per Rider', 'POS/NEG Wallets', 'Net Growth', 'A / S', 'AI Score'];
        const rows = filteredData.map(t => [
            t.name,
            t.reportingManager,
            `${t.activeRiders}/${t.totalRiders}`,
            fmt(t.periodCollection),
            fmt(t.periodPerRider),
            `${t.positiveCount} / ${t.negativeCount}`,
            t.netGrowth >= 0 ? `+${t.netGrowth}` : String(t.netGrowth),
            `+${t.allotments} / -${t.submissions}`,
            `${t.score} (${t.aiGrade})`
        ]);

        const fileName = `TL_Performance_Report_${new Date().toISOString().split('T')[0]}`;
        exportBrandedPerformancePDF("Team Leaders Operations Performance", kpis, cols, rows, fileName);
        toast.success('Branded PDF exported successfully!');
    };

    const activeTLCount = filteredData.filter(t => t.status === 'active').length;
    const topPerformer = filteredData.length > 0 ? [...filteredData].sort((a, b) => b.score - a.score)[0] : null;
    const avgScore = totals.score;
    const avgGrade = avgScore >= 70 ? 'A' : avgScore >= 50 ? 'B' : avgScore >= 30 ? 'C' : 'D';

    const dateLabel: Record<string, string> = { today: 'Today', yesterday: 'Yesterday', week: 'This Week', lastweek: 'Last Week', month: 'This Month', lastmonth: 'Last Month', custom: 'Custom' };

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
            <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-black p-6 md:p-8 rounded-b-[2.5rem] shadow-2xl relative overflow-hidden border-b border-white/5">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-[-20%] left-[-10%] w-[40%] h-[80%] bg-indigo-600 rounded-full blur-[140px] opacity-15 animate-pulse" style={{animationDuration:'6s'}} />
                    <div className="absolute bottom-[-30%] right-[-5%] w-[35%] h-[80%] bg-emerald-500 rounded-full blur-[120px] opacity-12 animate-pulse" style={{animationDuration:'8s'}} />
                    <div className="absolute top-[10%] right-[20%] w-[20%] h-[40%] bg-violet-500 rounded-full blur-[100px] opacity-8 animate-pulse" style={{animationDuration:'7s'}} />
                </div>
                <div className="relative flex flex-col md:flex-row md:items-start justify-between gap-5">
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/15 shadow-lg shadow-indigo-500/10">
                                <TrendingUp className="h-7 w-7 text-emerald-400" />
                            </div>
                            <div>
                                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Team Performance Engine</h1>
                                <p className="text-white/40 text-xs mt-0.5">Real-time TL analytics & fleet intelligence</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="px-3 py-1.5 bg-white/10 backdrop-blur text-white/80 rounded-full text-[10px] font-black uppercase tracking-wider border border-white/10">{filteredData.length} Control Units</span>
                            <span className="px-3 py-1.5 bg-emerald-500/20 text-emerald-300 rounded-full text-[10px] font-black uppercase border border-emerald-400/20">{activeTLCount} Active</span>
                            {topPerformer && <span className="px-3 py-1.5 bg-amber-500/20 text-amber-300 rounded-full text-[10px] font-black border border-amber-400/20">🏆 {topPerformer.name.split(' ')[0]} ({topPerformer.aiGrade})</span>}
                        </div>
                    </div>
                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                        <div ref={exportRef} className="relative">
                            <button onClick={() => setIsExportOpen(v => !v)} className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 hover:scale-105 border border-white/10 rounded-xl text-sm text-white font-semibold transition-all duration-200">
                                <Download className="h-4 w-4" /> Export
                            </button>
                            {isExportOpen && (
                                <div className="absolute right-0 top-full mt-2 w-48 bg-card border border-border rounded-xl shadow-2xl z-50 p-2 space-y-1">
                                    <button onClick={() => { exportToExcel(); setIsExportOpen(false); }} className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-muted rounded-lg flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Excel (.xlsx)</button>
                                    <button onClick={() => { exportToPDF(); setIsExportOpen(false); }} className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-muted rounded-lg flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-rose-500" /> PDF Document</button>
                                </div>
                            )}
                        </div>
                        <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 hover:scale-105 border border-white/10 rounded-xl text-sm text-white font-semibold transition-all duration-200">
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                        </button>
                        <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/20 rounded-xl text-[10px] font-black uppercase tracking-wider">
                            <Activity className="h-3 w-3 animate-pulse" /> Live
                        </div>
                    </div>
                </div>

                {/* ── STAT CARDS ROW V2 ── */}
                <div className="relative grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-6">
                    <PerformanceCard
                        title={`${dateLabel[dateFilter] || 'Selected'} Coll.`}
                        value={fmtShort(totals.periodCollection)}
                        subtext="for this period"
                        icon={TrendingUp}
                        colorScheme="emerald"
                    />
                    <PerformanceCard
                        title="Active Riders"
                        value={totals.activeRiders.toString()}
                        subtext={`of ${totals.totalRiders} total`}
                        icon={Users}
                        colorScheme="blue"
                    />
                    <PerformanceCard
                        title="Wallet Risk"
                        value={fmtShort(Math.abs(totals.negativeAmount))}
                        subtext={`${totals.negativeCount} riders`}
                        icon={AlertTriangle}
                        colorScheme="rose"
                    />
                    <PerformanceCard
                        title="Avg AI Score"
                        value={`${avgScore}`}
                        subtext={`Grade ${avgGrade}`}
                        icon={Star}
                        colorScheme="purple"
                    />
                    <PerformanceCard
                        title="Leads Found"
                        value={`+${totals.leadsToday}`}
                        subtext={`${totals.churnLeads} churned`}
                        icon={Target}
                        colorScheme="indigo"
                    />
                    <PerformanceCard
                        title="Net Growth"
                        value={totals.netGrowth >= 0 ? `+${totals.netGrowth}` : String(totals.netGrowth)}
                        subtext={`+${totals.allotments}A / -${totals.submissions}S`}
                        icon={ArrowUpRight}
                        colorScheme={totals.netGrowth >= 0 ? 'emerald' : 'rose'}
                    />
                </div>
            </div>

            <div className="px-4 pt-6 space-y-4">
                {/* ── AI Performance Insights Widget ── */}
                <AIPerformanceInsights
                    roleName="Team Leaders Fleet"
                    totalCollection={totals.periodCollection}
                    activeRidersCount={totals.activeRiders}
                    totalRidersCount={totals.totalRiders}
                    criticalDebtCount={totals.negativeCount}
                    avgScore={avgScore}
                    topPerformerName={topPerformer?.name}
                />
                {/* ── ANALYSIS CORE TABLE CARD ─────────────────────────────────────── */}
                <div className="bg-card border border-border/40 rounded-2xl shadow-xl overflow-hidden">
                    {/* Table Controls */}
                    <div className="p-4 md:p-5 border-b border-border/40 bg-gradient-to-r from-muted/20 to-transparent">
                        <div className="flex flex-col md:flex-row justify-between gap-3 flex-wrap mb-3">
                            <div>
                                <h2 className="text-lg font-black tracking-tight">Analysis Core</h2>
                                <p className="text-[10px] text-muted-foreground">Strategic performance monitoring and data decomposition.</p>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                <span className="px-2 py-1 bg-muted/50 rounded-lg font-bold">{filteredData.length} of {processRows.length} TLs</span>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                    placeholder="Search TL, email, RM..." className="pl-9 pr-3 py-2.5 bg-background border border-border rounded-xl text-xs w-56 focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all" />
                            </div>
                            {/* Date Filter */}
                            <div className="relative">
                                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-primary" />
                                <select value={dateFilter} onChange={e => setDateFilter(e.target.value as typeof dateFilter)}
                                    className="pl-8 pr-7 py-2.5 bg-background border border-border rounded-xl text-xs focus:ring-2 focus:ring-primary/30 appearance-none cursor-pointer font-semibold">
                                    <option value="today">Today</option>
                                    <option value="yesterday">Yesterday</option>
                                    <option value="week">This Week (Mon–Sun)</option>
                                    <option value="lastweek">Last Week</option>
                                    <option value="month">This Month</option>
                                    <option value="lastmonth">Last Month</option>
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
                                        className="pl-8 pr-7 py-2.5 bg-background border border-border rounded-xl text-xs focus:ring-2 focus:ring-teal-500/30 appearance-none cursor-pointer font-semibold">
                                        <option value="all">All Managers</option>
                                        {uniqueRMs.map(rm => <option key={rm} value={rm}>{rm}</option>)}
                                    </select>
                                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-teal-600/70 pointer-events-none" />
                                </div>
                            )}
                            {/* More Filters toggle */}
                            <button onClick={() => setIsFilterOpen(v => !v)}
                                className={`p-2.5 border rounded-xl hover:bg-muted transition-all duration-200 ${isFilterOpen ? 'bg-primary/10 border-primary/30 shadow-sm shadow-primary/20' : 'hover:scale-105'}`}>
                                <Filter className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* Expanded Filter Panel */}
                    {isFilterOpen && (
                        <div className="px-5 py-4 border-b border-border/40 bg-gradient-to-r from-primary/[0.02] to-transparent grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 animate-in slide-in-from-top-2 duration-200">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Status</label>
                                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)} className="w-full py-2 px-2.5 bg-background border border-border rounded-lg text-xs font-semibold focus:ring-2 focus:ring-primary/20">
                                    <option value="all">All</option><option value="active">Active</option><option value="inactive">Inactive</option>
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Wallet Risk</label>
                                <select value={riskFilter} onChange={e => setRiskFilter(e.target.value as typeof riskFilter)} className="w-full py-2 px-2.5 bg-background border border-border rounded-lg text-xs font-semibold focus:ring-2 focus:ring-primary/20">
                                    <option value="all">All</option><option value="high_risk">Has Negative</option><option value="low_risk">All Positive</option>
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">AI Score</label>
                                <select value={scoreFilter} onChange={e => setScoreFilter(e.target.value as typeof scoreFilter)} className="w-full py-2 px-2.5 bg-background border border-border rounded-lg text-xs font-semibold focus:ring-2 focus:ring-primary/20">
                                    <option value="all">All Scores</option>
                                    <option value="top">Top (S/A ≥ 5000)</option>
                                    <option value="mid">Mid (B/C ≥ 1500)</option>
                                    <option value="low">Low (D &lt; 1500)</option>
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">{dateLabel[dateFilter] || 'Selected'} Coll.</label>
                                <select value={collFilter} onChange={e => setCollFilter(e.target.value as typeof collFilter)} className="w-full py-2 px-2.5 bg-background border border-border rounded-lg text-xs font-semibold focus:ring-2 focus:ring-primary/20">
                                    <option value="all">All</option>
                                    <option value="above50k">≥ ₹50K</option>
                                    <option value="above20k">≥ ₹20K</option>
                                    <option value="below20k">&lt; ₹20K</option>
                                </select>
                            </div>
                            <div className="space-y-1.5 col-span-2">
                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Filter TLs ({rawData.teamLeaders.length} total)</label>
                                <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                                    {rawData.teamLeaders.map(tl => {
                                        const name = tl.fullName || (tl as unknown as Record<string, string>).full_name || tl.id;
                                        return (
                                            <button key={tl.id}
                                                onClick={() => setSelectedTLs(p => p.includes(tl.id) ? p.filter(x => x !== tl.id) : [...p, tl.id])}
                                                className={`px-2.5 py-1 text-[10px] rounded-full border font-bold transition-all duration-200 hover:scale-105 ${selectedTLs.includes(tl.id) ? 'bg-primary text-white border-primary shadow-sm shadow-primary/30' : 'bg-background border-border hover:bg-muted'}`}>
                                                {name}
                                            </button>
                                        );
                                    })}
                                    {selectedTLs.length > 0 && (
                                        <button onClick={() => setSelectedTLs([])} className="px-2.5 py-1 text-[10px] rounded-full bg-rose-100 text-rose-700 border border-rose-300 font-bold hover:scale-105 transition-all">
                                            ✕ Clear
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── DATA TABLE ──────────────────────────────────────────────────── */}
                    <div className="overflow-x-auto">
                        <div className="overflow-y-auto" style={{ maxHeight: '680px' }}>
                        <table className="w-full text-xs text-left border-collapse">
                            <thead className="bg-gradient-to-r from-slate-900 to-slate-800 text-[11px] font-black uppercase tracking-widest text-slate-300 border-b-2 border-primary/20 sticky top-0 z-10">
                                <tr>
                                    <SortTh label="Team Leader" sortKey="name" className="pl-5 pr-3 py-4 min-w-[200px]" />
                                    <SortTh label="Fleet" sortKey="activeRiders" className="text-center px-3" />
                                    <th className="px-3 py-4 min-w-[230px]">
                                        Collection <span className="text-emerald-400 normal-case font-semibold tracking-normal">▾ {dateLabel[dateFilter] || 'Selected'}</span>
                                    </th>
                                    <th className="px-3 py-4 min-w-[120px] text-amber-400">Grand Total</th>
                                    <th className="px-3 py-4">Wallet Health</th>
                                    <th className="px-3 py-4">Fleet Flow</th>
                                    <SortTh label="Leads %" sortKey="leadsConvRate" className="text-center px-3" />
                                    <SortTh label="Avg Age" sortKey="avgTenureDays" className="text-center px-3" />
                                    <SortTh label="Score" sortKey="score" className="text-center px-3" />
                                    <th className="px-3 py-4 text-right pr-6">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/15 font-medium">
                                {filteredData.length === 0 ? (
                                    <tr><td colSpan={10} className="py-20 text-center text-muted-foreground text-sm">
                                        <div className="flex flex-col items-center gap-2">
                                            <Search className="h-8 w-8 opacity-30" />
                                            <span>No data found. Try adjusting filters.</span>
                                        </div>
                                    </td></tr>
                                ) : filteredData.map((tl, idx) => (
                                    <tr key={tl.id} className={`group hover:bg-primary/[0.03] transition-all duration-200 ${idx % 2 === 0 ? 'bg-transparent' : 'bg-muted/[0.03]'}`}>
                                        {/* TL Name + RM */}
                                        <td className="pl-5 pr-3 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-xs font-black text-primary flex-shrink-0 border border-primary/10 group-hover:scale-110 transition-transform duration-200">
                                                    {(tl.name || '?').charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="font-black text-sm leading-tight group-hover:text-primary transition-colors">{tl.name}</div>
                                                    <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">{tl.email}</div>
                                                    {tl.reportingManager && tl.reportingManager !== 'N/A' && (
                                                        <div className="text-[11px] text-teal-600 font-bold leading-tight mt-0.5">↳ {tl.reportingManager}</div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        {/* Fleet */}
                                        <td className="px-3 py-4 text-center">
                                            <div className="font-black text-base text-emerald-600">{tl.activeRiders}</div>
                                            <div className="text-[11px] text-rose-500 font-bold">{tl.inactiveRiders} idle</div>
                                            <div className="text-[11px] text-muted-foreground mt-0.5">of {tl.totalRiders}</div>
                                            <div className="w-full bg-muted/40 rounded-full h-2 mt-1.5">
                                                <div className="bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full h-2 transition-all" style={{ width: `${tl.totalRiders > 0 ? Math.round((tl.activeRiders / tl.totalRiders) * 100) : 0}%` }} />
                                            </div>
                                        </td>

                                        {/* Collection */}
                                        <td className="px-3 py-4 min-w-[200px]">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[11px] font-black text-primary uppercase w-16">{dateLabel[dateFilter] || 'Selected'}</span>
                                                    <span className="font-black text-emerald-600 text-sm">{fmt(tl.periodCollection)}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[11px] font-black text-muted-foreground uppercase w-16">Weekly</span>
                                                    <span className="font-bold text-xs">{fmt(tl.weeklyCollection)}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[11px] font-black text-muted-foreground uppercase w-16">Monthly</span>
                                                    <span className="font-bold text-xs">{fmt(tl.monthlyCollection)}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/20">
                                                <span className="text-[10px] text-muted-foreground font-semibold">Day avg: <span className="font-black text-foreground">{fmt(tl.periodDayAvg)}</span></span>
                                                <span className="text-[10px] text-muted-foreground font-semibold">Per rider: <span className="font-black text-foreground">{fmt(tl.periodPerRider)}</span></span>
                                            </div>
                                        </td>

                                        {/* Grand Total */}
                                        <td className="px-3 py-4">
                                            <div className="font-black text-amber-600 text-sm">{fmt(tl.grandTotal)}</div>
                                            <div className="text-[11px] text-muted-foreground font-bold mt-0.5">All time</div>
                                        </td>
                                        {/* Wallet Health */}
                                        <td className="px-3 py-4">
                                            <div className="flex flex-col gap-1.5">
                                                <div className="flex items-center gap-1.5 whitespace-nowrap">
                                                    <span className="px-1.5 py-0.5 rounded-md font-black text-[11px] bg-emerald-500/15 text-emerald-600 border border-emerald-500/20 w-14 text-center">{tl.positiveCount} POS</span>
                                                    <span className="text-xs text-emerald-600 font-black">{fmtShort(tl.positiveAmount)}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 whitespace-nowrap">
                                                    <span className="px-1.5 py-0.5 rounded-md font-black text-[11px] bg-rose-500/15 text-rose-600 border border-rose-500/20 w-14 text-center">{tl.negativeCount} NEG</span>
                                                    <span className="text-xs text-rose-600 font-black">-{fmtShort(Math.abs(tl.negativeAmount))}</span>
                                                </div>
                                                <div className="text-[10px] text-muted-foreground mt-0.5 font-bold">
                                                    POS: {tl.walletPositivePct}% &nbsp;|&nbsp; NEG: {100 - (tl.walletPositivePct || 100)}%
                                                </div>
                                            </div>
                                        </td>

                                        {/* Fleet Flow */}
                                        <td className="px-3 py-4">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[11px] text-muted-foreground w-16 font-bold">Net Growth</span>
                                                    <span className={`font-black text-sm ${tl.netGrowth >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                        {tl.netGrowth >= 0 ? '+' : ''}{tl.netGrowth}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[11px] text-muted-foreground w-16 font-bold">Allotment</span>
                                                    <span className="font-bold text-[11px] text-emerald-500">+{tl.allotments}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[11px] text-muted-foreground w-16 font-bold">Submission</span>
                                                    <span className="font-bold text-[11px] text-rose-500">-{tl.submissions}</span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Leads % */}
                                        <td className="px-3 py-4 text-center">
                                            <div className="font-black text-sm">{tl.leadsConvRate}%</div>
                                            <div className="text-[11px] text-muted-foreground font-bold mt-0.5">{tl.leadsConverted}/{tl.leadsTotal}</div>
                                            {tl.leadsToday > 0 && <div className="text-[11px] text-indigo-500 font-black mt-0.5">+{tl.leadsToday} today</div>}
                                        </td>

                                        {/* Avg Age */}
                                        <td className="px-3 py-4 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <Clock size={12} className="text-muted-foreground" />
                                                <span className="font-black text-xs">{Math.round(tl.avgTenureDays)}d</span>
                                            </div>
                                            <div className="text-[11px] text-muted-foreground font-bold mt-0.5">{Math.round(tl.avgTenureDays / 30)}mo</div>
                                        </td>

                                        {/* Score */}
                                        <td className="px-3 py-4 text-center">
                                            <div className="font-black text-indigo-600 text-lg leading-none">{tl.score}</div>
                                            <span className={`inline-block mt-1.5 text-[10px] font-black px-2.5 py-0.5 rounded-full border ${tl.aiGrade === 'S' ? 'bg-amber-500/15 text-amber-500 border-amber-500/30' : tl.aiGrade === 'A' ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' : tl.aiGrade === 'B' ? 'bg-blue-500/15 text-blue-600 border-blue-500/30' : tl.aiGrade === 'C' ? 'bg-amber-500/15 text-amber-600 border-amber-500/30' : 'bg-rose-500/15 text-rose-600 border-rose-500/30'}`}>
                                                {tl.aiGrade}
                                            </span>
                                        </td>

                                        {/* Status */}
                                        <td className="px-3 py-4 text-right pr-6">
                                            <span className={`px-3 py-1.5 rounded-full text-[11px] font-black uppercase border ${tl.status === 'active' ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/25' : 'bg-rose-500/15 text-rose-600 border-rose-500/25'}`}>
                                                {tl.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>

                            {/* ── GRAND TOTALS FOOTER ────────────────────────────────────────── */}
                            {filteredData.length > 0 && (
                                <tfoot>
                                    <tr className="bg-gradient-to-r from-indigo-950/30 via-slate-900/20 to-transparent border-t-2 border-primary/30 font-black text-xs sticky bottom-0 z-10">
                                        <td className="pl-5 pr-3 py-5">
                                            <div className="text-xs font-black uppercase text-primary tracking-wider">Σ Totals ({filteredData.length})</div>
                                        </td>
                                        <td className="px-3 py-5 text-center">
                                            <div className="font-black text-emerald-600 text-base">{totals.activeRiders}</div>
                                            <div className="text-[11px] text-rose-500 font-bold">{totals.inactiveRiders} idle</div>
                                            <div className="text-[11px] text-muted-foreground mt-0.5">of {totals.totalRiders}</div>
                                        </td>
                                        <td className="px-3 py-5">
                                            <div className="space-y-1">
                                                <div className="text-base text-emerald-600 font-black">{fmt(totals.periodCollection)}</div>
                                                <div className="text-[11px] text-muted-foreground font-bold">{fmt(totals.weeklyCollection)} weekly</div>
                                                <div className="text-[11px] text-muted-foreground font-bold">{fmt(totals.monthlyCollection)} monthly</div>
                                            </div>
                                        </td>
                                        <td className="px-3 py-5">
                                            <div className="font-black text-amber-600 text-sm">{fmt(totals.grandTotal)}</div>
                                            <div className="text-[11px] text-muted-foreground font-bold mt-0.5">All time</div>
                                        </td>
                                        <td className="px-3 py-5">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-black text-[11px] text-emerald-600">{totals.positiveCount} POS</span>
                                                    <span className="text-xs text-emerald-600 font-black">{fmtShort(totals.positiveAmount)}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-black text-[11px] text-rose-600">{totals.negativeCount} NEG</span>
                                                    <span className="text-xs text-rose-600 font-black">-{fmtShort(Math.abs(totals.negativeAmount))}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-3 py-5">
                                            <div className={`font-black text-sm ${totals.netGrowth >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {totals.netGrowth >= 0 ? '+' : ''}{totals.netGrowth} net
                                            </div>
                                            <div className="text-[11px] text-muted-foreground font-bold mt-0.5">+{totals.allotments}A / -{totals.submissions}S</div>
                                        </td>
                                        <td className="px-3 py-5 text-center">
                                            <div className="font-black text-primary text-sm">+{totals.leadsToday}</div>
                                        </td>
                                        <td className="px-3 py-5 text-center text-muted-foreground">—</td>
                                        <td className="px-3 py-5 text-center">
                                            <div className="font-black text-indigo-600 text-base">{totals.score}</div>
                                            <span className="text-[11px] font-black text-indigo-400">({avgGrade})</span>
                                        </td>
                                        <td className="pr-6" />
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TLPerformance;
