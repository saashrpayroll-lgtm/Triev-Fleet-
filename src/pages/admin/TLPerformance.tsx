import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/config/supabase';
import {
    Download,
    Search,
    TrendingUp,
    Users,
    Activity,
    ArrowUpRight,
    Filter,
    Wallet,
    Calendar,
    ChevronDown,
    UserCheck,
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
    dailyCollectionsMap: Record<string, number>;
    weeklyCollectionsMap: Record<string, number>;
    fetchedTodayStr?: string;
}

interface TLProcessedRow {
    id: string;
    name: string;
    email: string;
    status: UserStatus;
    totalRiders: number;
    activeRiders: number;
    wallet: {
        positiveCount: number;
        negativeCount: number;
        positiveAmount: number;
        negativeAmount: number;
    };
    leads: {
        total: number;
        converted: number;
        conversionRate: number;
    };
    allotments: number;
    submissions: number;
    netGrowth: number;
    score: number;
    aiGrade: string;
    avgTenureDays: number;
    reportingManager: string;
    todayCollection: number;
    weeklyCollection: number;
    monthlyCollection: number;
    totalCollection: number;
    rangeCollection: number;
    periodCollection: number;
    periodDayAvg: number;
    periodPerRiderAvg: number;
    leadsToday: number;
    churnLeads: number;
    lastActivity: string | null;
    daysInPeriod: number;
}

const TLPerformance: React.FC<TLPerformanceProps> = ({ scopedTlIds }) => {
    const [loading, setLoading] = useState(true);
    const [rawData, setRawData] = useState<TLRawData>({ 
        riders: [], 
        leads: [], 
        teamLeaders: [], 
        dailyCollectionsMap: {},
        weeklyCollectionsMap: {}
    });

    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
    const [riskFilter, setRiskFilter] = useState<'all' | 'high_risk' | 'low_risk'>('all');
    const [perfFilter, setPerfFilter] = useState<'all' | 'top_performers' | 'low_conversion'>('all');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [isExportOpen, setIsExportOpen] = useState(false);

    // Date Filter States
    const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom'>('today');
    const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });

    // Reporting Manager Filter
    const [rmFilter, setRmFilter] = useState<string>('all');

    // Sorting & Multi-TL Filter States
    const [selectedTLs, setSelectedTLs] = useState<string[]>([]);
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'totalCollection', direction: 'desc' });

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
            const now = new Date();
            const todayStr = formatter.format(now);
            
            // Weekly Reset Logic (Monday 00:00 IST)
            const [year, month, day] = todayStr.split('-').map(Number);
            const workingDate = new Date(Date.UTC(year, month - 1, day));
            const dayOfWeek = workingDate.getUTCDay();
            const diffFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            const weekStart = new Date(workingDate);
            weekStart.setUTCDate(workingDate.getUTCDate() - diffFromMonday);
            const weekStartStr = weekStart.toISOString().split('T')[0];

            let tlQuery = supabase.from('users').select('*').eq('role', 'teamLeader');
            if (scopedTlIds && scopedTlIds.length > 0) {
                tlQuery = tlQuery.in('id', scopedTlIds);
            }

            const [ridersRes, leadsRes, usersRes, dailyCollectionsRes, todayCollRes, weekCollRes] = await Promise.all([
                // Scope riders to this City Ops' TLs only
                scopedTlIds && scopedTlIds.length > 0
                    ? fetchAllRidersPaginated('*', { column: 'team_leader_id', value: scopedTlIds, type: 'in' })
                    : fetchAllRidersPaginated('*'),
                supabase.from('leads').select('*'),
                tlQuery,
                // daily_collections has team_leader_id — use for today's and weekly collections
                supabase.from('daily_collections').select('*').eq('date', todayStr),
                // For TODAY: filter daily_collections by today's date
                supabase.from('daily_collections').select('team_leader_id, total_collection').eq('date', todayStr),
                // For WEEK: filter daily_collections from weekStart
                supabase.from('daily_collections').select('team_leader_id, total_collection').gte('date', weekStartStr)
            ]);

            if (ridersRes.error) throw ridersRes.error;
            if (leadsRes.error) throw leadsRes.error;
            if (usersRes.error) throw usersRes.error;
            if (dailyCollectionsRes.error) throw dailyCollectionsRes.error;
            if (todayCollRes.error) throw todayCollRes.error;
            if (weekCollRes.error) throw weekCollRes.error;

            const riders = ridersRes.data || [];
            const leads = leadsRes.data || [];
            const teamLeaders = usersRes.data || [];

            // Aggregate current day collection from daily_collections (has team_leader_id)
            const dailyMap: Record<string, number> = {};
            (todayCollRes.data || []).forEach((row: { team_leader_id: string; total_collection: number }) => {
                if (row.team_leader_id) {
                    dailyMap[row.team_leader_id] = (dailyMap[row.team_leader_id] || 0) + (Number(row.total_collection) || 0);
                }
            });

            // Aggregate weekly collection from daily_collections
            const weeklyMap: Record<string, number> = {};
            (weekCollRes.data || []).forEach((row: { team_leader_id: string; total_collection: number }) => {
                if (row.team_leader_id) {
                    weeklyMap[row.team_leader_id] = (weeklyMap[row.team_leader_id] || 0) + (Number(row.total_collection) || 0);
                }
            });

            setRawData({
                riders,
                leads,
                teamLeaders,
                dailyCollectionsMap: dailyMap,
                weeklyCollectionsMap: weeklyMap,
                fetchedTodayStr: todayStr
            });
        } catch (error) {
            console.error('Fetch error:', error);
            toast.error('Failed to load performance data');
        } finally {
            setLoading(false);
        }
    }, [scopedTlIds]);

    useEffect(() => {
        fetchData();
        
        // Real-time channels
        const channels = [
            supabase.channel('tl-perf-riders').on('postgres_changes', { event: '*', schema: 'public', table: 'riders' }, () => fetchData()).subscribe(),
            supabase.channel('tl-perf-leads').on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchData()).subscribe(),
            supabase.channel('tl-perf-ledger').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wallet_ledger' }, () => fetchData()).subscribe()
        ];

        return () => {
            channels.forEach(ch => supabase.removeChannel(ch));
        };
    }, [fetchData]);

    const performanceData = useMemo<TLProcessedRow[]>(() => {
        const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
        const todayStr = formatter.format(new Date());

        return rawData.teamLeaders.map(tl => {
            const metrics = calculateAIScore(
                tl,
                rawData.riders,
                rawData.leads,
                rawData.dailyCollectionsMap[tl.id] || 0
            );

            // Filter leads for this TL
            const tlLeads = rawData.leads.filter(l => l.createdBy === tl.id);
            const todayLeads = tlLeads.filter(l => l.createdAt?.startsWith(todayStr)).length;
            const churnLeadsCount = tlLeads.filter(l => l.status === 'Not Convert' && l.createdAt?.startsWith(todayStr)).length;

            const daysInPeriod = dateFilter === 'today' ? 1 
                : dateFilter === 'yesterday' ? 1 
                : dateFilter === 'week' ? 7 
                : dateFilter === 'month' ? 30 
                : 30;

            const periodCol = dateFilter === 'week' ? (rawData.weeklyCollectionsMap[tl.id] || 0) : (rawData.dailyCollectionsMap[tl.id] || 0);

            return {
                id: tl.id,
                name: tl.fullName || 'Unknown TL',
                email: tl.email,
                status: tl.status,
                totalRiders: metrics.totalRiders,
                activeRiders: metrics.activeRiders,
                wallet: {
                    positiveCount: metrics.positiveWalletCount,
                    negativeCount: metrics.negativeWalletCount,
                    positiveAmount: metrics.positiveWallet,
                    negativeAmount: metrics.negativeWallet
                },
                leads: {
                    total: metrics.leadsTotal,
                    converted: metrics.convertedLeads,
                    conversionRate: metrics.conversionRate
                },
                allotments: metrics.allotments,
                submissions: metrics.submissions,
                netGrowth: metrics.netGrowth,
                score: metrics.score,
                aiGrade: metrics.aiGrade,
                avgTenureDays: metrics.avgRiderAge,
                reportingManager: tl.reportingManager || 'N/A',
                todayCollection: rawData.dailyCollectionsMap[tl.id] || 0,
                weeklyCollection: rawData.weeklyCollectionsMap[tl.id] || 0,
                monthlyCollection: 0,
                totalCollection: metrics.collection,
                rangeCollection: periodCol,
                periodCollection: periodCol,
                periodDayAvg: Math.round(periodCol / daysInPeriod),
                periodPerRiderAvg: metrics.collectionPerRider,
                leadsToday: todayLeads,
                churnLeads: churnLeadsCount,
                lastActivity: tl.updatedAt,
                daysInPeriod
            };
        });
    }, [rawData, dateFilter]);

    const uniqueReportingManagers = useMemo(() => {
        const managers = rawData.teamLeaders
            .map(tl => tl.reportingManager)
            .filter((m): m is string => !!m);
        const unique = Array.from(new Set(managers));
        return unique.map(name => ({
            name,
            count: managers.filter(m => m === name).length
        })).sort((a, b) => a.name.localeCompare(b.name));
    }, [rawData.teamLeaders]);

    const filteredData = useMemo<TLProcessedRow[]>(() => {
        const data = performanceData.filter(tl => {
            const matchesSearch = tl.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                tl.email.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
            const matchesStatus = filterStatus === 'all' || tl.status === filterStatus;
            const matchesRisk = riskFilter === 'all' || 
                (riskFilter === 'high_risk' && tl.wallet.negativeCount > 0) ||
                (riskFilter === 'low_risk' && tl.wallet.negativeCount === 0);
            const matchesPerf = perfFilter === 'all' ||
                (perfFilter === 'top_performers' && tl.leads.conversionRate >= 50) ||
                (perfFilter === 'low_conversion' && tl.leads.conversionRate < 10);
            const matchesRM = rmFilter === 'all' || tl.reportingManager === rmFilter;
            const matchesSelected = selectedTLs.length === 0 || selectedTLs.includes(tl.id);

            return matchesSearch && matchesStatus && matchesRisk && matchesPerf && matchesRM && matchesSelected;
        });

        if (sortConfig) {
            data.sort((a, b) => {
                const aValue = a[sortConfig.key as keyof TLProcessedRow];
                const bValue = b[sortConfig.key as keyof TLProcessedRow];
                
                // Handle different value types (string, number) safely
                if (typeof aValue === 'number' && typeof bValue === 'number') {
                    return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
                }
                
                const strA = String(aValue || '');
                const strB = String(bValue || '');
                return sortConfig.direction === 'asc' 
                    ? strA.localeCompare(strB) 
                    : strB.localeCompare(strA);
            });
        }
        return data;
    }, [performanceData, debouncedSearchTerm, filterStatus, riskFilter, perfFilter, rmFilter, selectedTLs, sortConfig]);

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'desc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const exportToExcel = () => {
        const data = filteredData.map(tl => ({
            'Name': tl.name,
            'Email': tl.email,
            'Status': tl.status,
            'Active Riders': tl.activeRiders,
            'Total Riders': tl.totalRiders,
            'Today Collection': tl.todayCollection,
            'Weekly Collection': tl.weeklyCollection,
            'Total Collection': tl.totalCollection,
            'Positive Wallet': tl.wallet.positiveAmount,
            'Negative Wallet': tl.wallet.negativeAmount,
            'Net Growth': tl.netGrowth,
            'Leads Conversion %': tl.leads.conversionRate,
            'AI Score': tl.score,
            'AI Grade': tl.aiGrade,
            'Avg Tenure': tl.avgTenureDays
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Performance');
        XLSX.writeFile(wb, `tl_performance_${new Date().toISOString().split('T')[0]}.xlsx`);
        toast.success('Excel exported');
    };

    const exportToPDF = () => {
        const doc = new jsPDF('landscape');
        const rows = filteredData.map(tl => [
            tl.name,
            `${tl.activeRiders}/${tl.totalRiders}`,
            `₹${tl.totalCollection.toLocaleString()}`,
            `₹${tl.wallet.positiveAmount - Math.abs(tl.wallet.negativeAmount)}`,
            tl.netGrowth,
            `${tl.leads.conversionRate}%`,
            tl.score,
            tl.aiGrade
        ]);
        autoTable(doc, {
            head: [["Team Leader", "Riders", "Collection", "Wallet Health", "Growth", "Leads %", "Score", "Grade"]],
            body: rows,
        });
        doc.save(`tl_performance_${new Date().toISOString().split('T')[0]}.pdf`);
        toast.success('PDF exported');
    };

    const exportToCSV = () => {
        const headers = ["Name", "Email", "Status", "Active Riders", "Total Riders", "Score", "Grade"];
        const rows = filteredData.map(tl => [tl.name, tl.email, tl.status, tl.activeRiders, tl.totalRiders, tl.score, tl.aiGrade]);
        const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "tl_performance.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const avgAIScore = filteredData.length > 0 ? Math.round(filteredData.reduce((s, t) => s + t.score, 0) / filteredData.length) : 0;
    const avgGrade = avgAIScore >= 50 ? 'A' : avgAIScore >= 30 ? 'B' : 'C';
    const activeTLCount = filteredData.filter(tl => tl.status === 'active').length;
    const topPerformer = filteredData.length > 0 ? [...filteredData].sort((a, b) => b.score - a.score)[0] : null;

    if (loading && rawData.teamLeaders.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Activity className="h-8 w-8 text-primary animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-12">
            <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-black p-8 rounded-b-[3rem] shadow-2xl relative overflow-hidden border-b border-white/5">
                <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500 rounded-full blur-[120px]" />
                    <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500 rounded-full blur-[120px]" />
                </div>

                <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 shadow-inner">
                                <TrendingUp className="h-6 w-6 text-emerald-400" />
                            </div>
                            <h1 className="text-3xl font-black text-white tracking-tight">Team Performance Engine</h1>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="px-3 py-1 bg-white/10 text-white/70 rounded-full text-[10px] font-black uppercase tracking-wider border border-white/5">
                                {filteredData.length} Control Units
                            </span>
                            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-[10px] font-black uppercase tracking-wider border border-emerald-400/20">
                                {activeTLCount} Active
                            </span>
                            {topPerformer && (
                                <span className="px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full text-[10px] font-black uppercase tracking-wider border border-amber-400/20">
                                    🏆 {topPerformer.name.split(' ')[0]} ({topPerformer.aiGrade})
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsExportOpen(!isExportOpen)}
                            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-sm text-white font-medium transition-colors"
                        >
                            <Download className="h-4 w-4" />
                            Export
                        </button>
                        {isExportOpen && (
                            <div className="absolute right-0 top-full mt-2 w-52 bg-card text-foreground border border-border rounded-xl shadow-2xl z-50 p-2 space-y-1">
                                <button onClick={exportToExcel} className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-muted rounded-lg flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500" /> Excel Spreadsheet
                                </button>
                                <button onClick={exportToPDF} className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-muted rounded-lg flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-rose-500" /> PDF Document
                                </button>
                                <button onClick={exportToCSV} className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-muted rounded-lg flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-slate-400" /> CSV Export
                                </button>
                            </div>
                        )}
                        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/20 text-emerald-300 border border-emerald-400/20 rounded-xl text-[10px] font-black uppercase tracking-wider">
                            <Activity className="h-3 w-3 animate-pulse" /> Live Sync
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-6 space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {[
                        { label: 'Today Coll.', value: `₹${performanceData.reduce((s, t) => s + t.todayCollection, 0).toLocaleString()}`, icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/5' },
                        { label: 'Active Riders', value: performanceData.reduce((s, t) => s + t.activeRiders, 0).toLocaleString(), icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/5' },
                        { label: 'Leads Found', value: `+${performanceData.reduce((s, t) => s + t.leadsToday, 0)}`, icon: ArrowUpRight, color: 'text-indigo-500', bg: 'bg-indigo-500/5' },
                        { label: 'Market Risk', value: `₹${Math.abs(performanceData.reduce((s, t) => s + t.wallet.negativeAmount, 0)).toLocaleString()}`, icon: Wallet, color: 'text-rose-500', bg: 'bg-rose-500/5' },
                        { label: 'Avg AI Score', value: avgAIScore, icon: Activity, color: 'text-amber-500', bg: 'bg-amber-500/5', badge: avgGrade },
                        { label: 'Weekly Total', value: `₹${performanceData.reduce((s, t) => s + t.weeklyCollection, 0).toLocaleString()}`, icon: Calendar, color: 'text-violet-500', bg: 'bg-violet-500/5' }
                    ].map((card, i) => (
                        <div key={i} className={`p-4 rounded-2xl border border-border/40 ${card.bg} space-y-1`}>
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase text-muted-foreground">{card.label}</span>
                                <card.icon className={`h-4 w-4 ${card.color}`} />
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-xl font-black">{card.value}</span>
                                {card.badge && (
                                    <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] font-black rounded-full">{card.badge}</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="bg-card border border-border/40 rounded-2xl shadow-xl overflow-hidden">
                    <div className="p-6 border-b border-border/40 bg-muted/20 flex flex-col md:flex-row justify-between gap-4">
                        <div className="space-y-1">
                            <h2 className="text-lg font-bold">Analysis Core</h2>
                            <p className="text-xs text-muted-foreground">Strategic performance monitoring and data decomposition.</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search TL units..."
                                    className="pl-9 pr-4 py-2 bg-background border border-border rounded-xl text-sm w-full md:w-64 focus:ring-2 focus:ring-primary/20"
                                />
                            </div>

                            <div className="relative">
                                <select
                                    value={dateFilter}
                                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDateFilter(e.target.value as 'today' | 'yesterday' | 'week' | 'month' | 'custom')}
                                    className="pl-9 pr-8 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
                                >
                                    <option value="today">Today</option>
                                    <option value="yesterday">Yesterday</option>
                                    <option value="week">Week</option>
                                    <option value="month">Month</option>
                                    <option value="custom">Custom</option>
                                </select>
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/70" />
                            </div>

                            {dateFilter === 'custom' && (
                                <div className="flex items-center gap-2 bg-background border border-border rounded-xl p-1">
                                    <input
                                        type="date"
                                        className="text-xs py-1 px-2 focus:outline-none bg-transparent"
                                        value={customDateRange.start}
                                        onChange={(e) => setCustomDateRange({ ...customDateRange, start: e.target.value })}
                                    />
                                    <input
                                        type="date"
                                        className="text-xs py-1 px-2 focus:outline-none bg-transparent"
                                        value={customDateRange.end}
                                        onChange={(e) => setCustomDateRange({ ...customDateRange, end: e.target.value })}
                                    />
                                </div>
                            )}

                            {uniqueReportingManagers.length > 0 && (
                                <div className="relative">
                                    <select
                                        value={rmFilter}
                                        onChange={(e) => setRmFilter(e.target.value)}
                                        className="pl-9 pr-8 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-teal-500/20 appearance-none cursor-pointer"
                                    >
                                        <option value="all">All Managers</option>
                                        {uniqueReportingManagers.map(rm => (
                                            <option key={rm.name} value={rm.name}>{rm.name}</option>
                                        ))}
                                    </select>
                                    <UserCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-teal-600" />
                                </div>
                            )}

                            <button onClick={() => setIsFilterOpen(!isFilterOpen)} className="p-2 border rounded-xl hover:bg-muted transition-colors">
                                <Filter className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    {isFilterOpen && (
                        <div className="p-6 border-b border-border/40 bg-muted/5 animate-in slide-in-from-top-2">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground">Status</label>
                                    <select 
                                        value={filterStatus} 
                                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')} 
                                        className="w-full p-2 bg-background border border-border rounded-lg text-sm"
                                    >
                                        <option value="all">All</option>
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground">Risk Level</label>
                                    <select 
                                        value={riskFilter} 
                                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRiskFilter(e.target.value as 'all' | 'high_risk' | 'low_risk')} 
                                        className="w-full p-2 bg-background border border-border rounded-lg text-sm"
                                    >
                                        <option value="all">All Masks</option>
                                        <option value="high_risk">Critical Debt</option>
                                        <option value="low_risk">Safe Balance</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground">Performance</label>
                                    <select 
                                        value={perfFilter} 
                                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPerfFilter(e.target.value as 'all' | 'top_performers' | 'low_conversion')} 
                                        className="w-full p-2 bg-background border border-border rounded-lg text-sm"
                                    >
                                        <option value="all">All Tiers</option>
                                        <option value="top_performers">{"Top (50%+ Conver.)"}</option>
                                        <option value="low_conversion">{"Laggards (<10%)"}</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground">Select TLs</label>
                                    <div className="max-h-20 overflow-y-auto border rounded-lg p-2 bg-background">
                                        {rawData.teamLeaders.map(tl => (
                                            <div key={tl.id} className="flex items-center gap-2 text-xs">
                                                <input type="checkbox" checked={selectedTLs.includes(tl.id)} 
                                                    onChange={(e) => {
                                                        if (e.target.checked) setSelectedTLs([...selectedTLs, tl.id]);
                                                        else setSelectedTLs(selectedTLs.filter(id => id !== tl.id));
                                                    }}
                                                />
                                                <span className="truncate">{tl.fullName}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left border-collapse">
                            <thead className="bg-muted/30 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border/40">
                                <tr>
                                    <th className="px-6 py-4 cursor-pointer" onClick={() => handleSort('name')}>Team Leader</th>
                                    <th className="px-6 py-4 text-center cursor-pointer" onClick={() => handleSort('activeRiders')}>Riders</th>
                                    <th className="px-6 py-4 cursor-pointer" onClick={() => handleSort('rangeCollection')}>Collection</th>
                                    <th className="px-6 py-4">Wallet Health</th>
                                    <th className="px-6 py-4 cursor-pointer" onClick={() => handleSort('netGrowth')}>Growth</th>
                                    <th className="px-6 py-4 text-center">Score</th>
                                    <th className="px-6 py-4 text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/20">
                                {filteredData.map(tl => (
                                    <tr key={tl.id} className="hover:bg-muted/10 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-bold">{tl.name}</div>
                                            <div className="text-[10px] text-muted-foreground">{tl.email}</div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="font-black text-base">{tl.activeRiders} <span className="text-[10px] text-muted-foreground">/ {tl.totalRiders}</span></div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-black text-emerald-600">₹{tl.periodCollection.toLocaleString()}</div>
                                            <div className="text-[9px] text-muted-foreground">Avg: ₹{tl.periodDayAvg}/day</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex gap-2 text-[10px] font-bold">
                                                <span className="text-emerald-600">{tl.wallet.positiveCount} POS</span>
                                                <span className="text-rose-600">{tl.wallet.negativeCount} NEG</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className={`font-black ${tl.netGrowth >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {tl.netGrowth > 0 ? '+' : ''}{tl.netGrowth}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="font-black text-indigo-600">{tl.score}</div>
                                            <div className="text-[9px] font-black uppercase text-indigo-400">{tl.aiGrade}</div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${tl.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 border-rose-500/20'}`}>
                                                {tl.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TLPerformance;
