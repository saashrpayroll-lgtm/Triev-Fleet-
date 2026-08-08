import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users, ChevronRight, MoreHorizontal, ChevronDown
} from 'lucide-react';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '../ui/dropdown-menu';
import { useDebounce } from '@/hooks/useDebounce';

import CollectionHistoryModal from './CollectionHistoryModal';

export interface TLSnapshot {
    id: string;
    name: string;
    email: string;
    totalRiders: number;
    activeRiders: number;
    wallet: {
        total: number;
        positiveCount: number;
        positiveAmount: number;
        negativeCount: number;
        negativeAmount: number;
    };
    leads: {
        total: number;
        converted: number;
        conversionRate: number;
    };
    status: string;
    totalCollection: number;
    dailyCollection: number;
    weeklyCollection: number;
    monthlyCollection: number;
    leadsToday: number;
    churnLeads: number;
    criticalDebtCount: number;
    allotments: number;
    submissions: number;
    netGrowth: number;
    avgRiderCollection: number;
    perDayAverageCollection: number;
    activeDays: number;
    lastActivity?: string;
    reportingManager?: string;
    score?: number;
    aiGrade?: string;
}

interface TeamLeaderPerformanceTableProps {
    data: TLSnapshot[];
}

const TeamLeaderPerformanceTable: React.FC<TeamLeaderPerformanceTableProps> = ({ data }) => {
    const navigate = useNavigate();
    const [sortConfig, setSortConfig] = useState<{ key: keyof TLSnapshot | 'walletDiff', direction: 'asc' | 'desc' } | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
    const [filterRM, setFilterRM] = useState<string>('all');
    const [historyModalData, setHistoryModalData] = useState<{ id: string, name: string } | null>(null);

    const filteredData = React.useMemo(() => {
        let processed = [...data];

        // 1. Filter by Status
        if (filterStatus !== 'all') {
            processed = processed.filter(tl => tl.status === filterStatus);
        }

        // 2. Filter by Search Term
        if (debouncedSearchTerm) {
            const lowerTerm = debouncedSearchTerm.toLowerCase();
            processed = processed.filter(tl =>
                tl.name.toLowerCase().includes(lowerTerm) ||
                tl.email.toLowerCase().includes(lowerTerm)
            );
        }

        // 3. Filter by Reporting Manager
        if (filterRM !== 'all') {
            processed = processed.filter(tl => (tl.reportingManager || '') === filterRM);
        }

        return processed;
    }, [data, filterStatus, debouncedSearchTerm, filterRM]);

    const sortedData = React.useMemo(() => {
        let sortable = [...filteredData];
        if (sortConfig !== null) {
            sortable.sort((a, b) => {
                let aValue: any = a[sortConfig.key as keyof TLSnapshot];
                let bValue: any = b[sortConfig.key as keyof TLSnapshot];

                if (sortConfig.key === 'walletDiff' as any) {
                    aValue = a.wallet.total;
                    bValue = b.wallet.total;
                } else {
                    aValue = a[sortConfig.key as keyof TLSnapshot];
                    bValue = b[sortConfig.key as keyof TLSnapshot];
                }

                if (aValue < bValue) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        } else {
            // Default sort by Active Riders desc
            sortable.sort((a, b) => b.activeRiders - a.activeRiders);
        }
        return sortable;
    }, [filteredData, sortConfig]);

    const handleSort = (key: any) => {
        let direction: 'asc' | 'desc' = 'desc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    // Sort indicator
    const SortIcon = ({ col }: { col: string }) => {
        if (sortConfig?.key !== col) return null;
        return <ChevronDown className={`h-3 w-3 inline-block ml-0.5 transition-transform ${sortConfig.direction === 'asc' ? 'rotate-180' : ''}`} />;
    };

    return (
        <div className="bg-card border border-border/40 rounded-2xl shadow-xl overflow-hidden animate-in fade-in duration-700 flex flex-col h-full max-h-[640px]">
            {/* ── PREMIUM HEADER ── */}
            <div className="p-4 border-b border-border/40 bg-gradient-to-r from-indigo-500/5 via-transparent to-transparent">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                            <Users className="text-indigo-500" size={18} />
                        </div>
                        <div>
                            <h3 className="font-black text-base flex items-center gap-2">
                                Team Leader Performance
                                <span className="text-[10px] font-black bg-indigo-500/10 text-indigo-600 px-2 py-0.5 rounded-full border border-indigo-500/20">
                                    {data.length} TLs
                                </span>
                            </h3>
                            <p className="text-[10px] text-muted-foreground font-medium">Real-time metrics per supervisor</p>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate('/portal/tl-performance')}
                        className="group text-xs font-black text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-500/30 transition-all flex items-center gap-1"
                    >
                        View All <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                    </button>
                </div>

                {/* Filter Toolbar */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-3">
                    <div className="relative flex-1 max-w-sm">
                        <input
                            type="text"
                            placeholder="Search Team Leader..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-1.5 text-xs border border-border/60 rounded-lg bg-background focus:bg-background transition-colors outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                        <div className="absolute left-3 top-2 text-muted-foreground">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                        </div>
                    </div>

                    <select
                        value={filterStatus}
                        onChange={(e: any) => setFilterStatus(e.target.value)}
                        className="px-3 py-1.5 text-xs border border-border/60 rounded-lg bg-background outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                    >
                        <option value="all">All Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>

                    {/* Reporting Manager Filter */}
                    {(() => {
                        const uniqueRMs = Array.from(new Set(data.map(tl => tl.reportingManager).filter(Boolean))).sort() as string[];
                        if (uniqueRMs.length === 0) return null;
                        return (
                            <select
                                value={filterRM}
                                onChange={(e: any) => setFilterRM(e.target.value)}
                                className={`px-3 py-1.5 text-xs border rounded-lg outline-none focus:ring-2 focus:ring-teal-500/20 cursor-pointer transition-colors ${filterRM !== 'all' ? 'bg-teal-50 dark:bg-teal-900/20 border-teal-500 text-teal-700 dark:text-teal-400 ring-1 ring-teal-500/20' : 'bg-background border-border/60'}`}
                            >
                                <option value="all">All Managers</option>
                                {uniqueRMs.map(rm => (
                                    <option key={rm} value={rm}>{rm}</option>
                                ))}
                            </select>
                        );
                    })()}

                    <div className="text-[10px] text-muted-foreground ml-auto font-bold">
                        {sortedData.length} of {data.length}
                    </div>
                </div>
            </div>

            <div className="overflow-auto flex-1 custom-scrollbar">
                <table className="w-full min-w-[1100px] text-sm relative">
                    <thead className="sticky top-0 z-10 bg-slate-50/90 dark:bg-slate-900/80 backdrop-blur-sm shadow-sm">
                        <tr className="text-left border-b border-border/30">
                            <th className="p-3 font-black text-[9px] text-muted-foreground uppercase tracking-widest min-w-[170px]">Team Leader</th>
                            <th className="p-3 font-black text-[9px] text-muted-foreground uppercase tracking-widest min-w-[90px] cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('activeRiders')}>
                                Riders <SortIcon col="activeRiders" />
                            </th>
                            <th className="p-3 font-black text-[9px] text-muted-foreground uppercase tracking-widest min-w-[150px] cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('criticalDebtCount')}>
                                Risk & Dues <SortIcon col="criticalDebtCount" />
                            </th>
                            <th className="p-3 font-black text-[9px] text-muted-foreground uppercase tracking-widest min-w-[120px] cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('avgRiderCollection')}>
                                Avg Metrics <SortIcon col="avgRiderCollection" />
                            </th>
                            <th className="p-3 font-black text-[9px] text-muted-foreground uppercase tracking-widest min-w-[200px] cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('dailyCollection')}>
                                Collections (D/W/M/T) <SortIcon col="dailyCollection" />
                            </th>
                            <th className="p-3 font-black text-[9px] text-muted-foreground uppercase tracking-widest min-w-[110px] cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('netGrowth')}>
                                Fleet Flow <SortIcon col="netGrowth" />
                            </th>
                            <th className="p-3 font-black text-[9px] text-muted-foreground uppercase tracking-widest min-w-[100px] cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('leadsToday')}>
                                Leads <SortIcon col="leadsToday" />
                            </th>
                            <th className="p-3 font-black text-[9px] text-indigo-500 uppercase tracking-widest min-w-[70px] cursor-pointer hover:text-indigo-700 transition-colors text-center" onClick={() => handleSort('score' as any)}>
                                AI Score <SortIcon col="score" />
                            </th>
                            <th className="p-3 font-black text-[9px] text-muted-foreground uppercase tracking-widest min-w-[60px] text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/10">
                        {sortedData.map((tl) => (
                            <tr key={tl.id} className="group hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors">
                                {/* 1. Team Leader */}
                                <td className="p-3">
                                    <div className="flex items-center gap-2.5">
                                        <div className="relative shrink-0">
                                            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 font-black text-sm">
                                                {tl.name.charAt(0)}
                                            </div>
                                            {tl.lastActivity && (new Date().getTime() - new Date(tl.lastActivity).getTime() < 30 * 60 * 1000) && (
                                                <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border-2 border-background"></span>
                                                </span>
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-xs flex items-center gap-1 truncate">
                                                {tl.name}
                                                {tl.leadsToday > 2 && <span className="shrink-0 bg-orange-500 text-white text-[7px] px-1 py-0.5 rounded font-black">HOT</span>}
                                            </p>
                                            <p className="text-[9px] text-muted-foreground truncate">{tl.email}</p>
                                            {tl.reportingManager && (
                                                <p className="text-[8px] text-teal-600 dark:text-teal-400 font-bold truncate">↳ {tl.reportingManager}</p>
                                            )}
                                        </div>
                                    </div>
                                </td>

                                {/* 2. Riders */}
                                <td className="p-3">
                                    <div className="flex flex-col gap-1">
                                        <span className="font-black text-sm">{tl.activeRiders} <span className="text-[10px] font-medium text-muted-foreground">/ {tl.totalRiders}</span></span>
                                        <div className="w-14 h-1 bg-muted/50 rounded-full overflow-hidden">
                                            <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000"
                                                style={{ width: `${tl.totalRiders > 0 ? (tl.activeRiders / tl.totalRiders) * 100 : 0}%` }} />
                                        </div>
                                    </div>
                                </td>

                                {/* 3. Risk & Dues */}
                                <td className="p-3">
                                    <div className="space-y-1">
                                        <div className="flex flex-wrap items-center gap-1">
                                            <span className="text-[9px] font-black bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                                {tl.wallet.positiveCount} POS
                                            </span>
                                            <span className="text-[9px] font-black bg-rose-500/10 text-rose-600 px-1.5 py-0.5 rounded border border-rose-500/20">
                                                {tl.wallet.negativeCount} NEG
                                            </span>
                                            {tl.criticalDebtCount > 0 && (
                                                <span className="bg-rose-600 text-white text-[8px] font-black px-1 py-0.5 rounded animate-pulse">
                                                    {tl.criticalDebtCount} CRIT
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] font-bold">
                                            <span className="text-emerald-600 whitespace-nowrap">₹{tl.wallet.positiveAmount >= 10000 ? `${(tl.wallet.positiveAmount / 1000).toFixed(1)}k` : tl.wallet.positiveAmount.toLocaleString()}</span>
                                            <span className="text-rose-600 whitespace-nowrap">₹{Math.abs(tl.wallet.negativeAmount) >= 10000 ? `${(Math.abs(tl.wallet.negativeAmount) / 1000).toFixed(1)}k` : Math.abs(tl.wallet.negativeAmount).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </td>

                                {/* 4. Avg Metrics */}
                                <td className="p-3">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-[8px] text-muted-foreground font-bold uppercase">Avg/Rider</span>
                                            <span className="text-xs font-black text-indigo-600 whitespace-nowrap">₹{tl.avgRiderCollection.toLocaleString()}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-2 border-t border-border/30 pt-0.5">
                                            <span className="text-[8px] text-muted-foreground font-bold uppercase">Per Day</span>
                                            <span className="text-[10px] font-black text-emerald-600 whitespace-nowrap">₹{tl.perDayAverageCollection.toLocaleString()}</span>
                                        </div>
                                        <span className="text-[7px] text-muted-foreground italic text-right">{tl.activeDays || 1}d basis</span>
                                    </div>
                                </td>

                                {/* 5. Collections D/W/M/T */}
                                <td className="p-3 min-w-[200px]">
                                    <div className="space-y-1">
                                        <div className="flex flex-col">
                                            <span className="text-[8px] text-muted-foreground font-bold uppercase">Today</span>
                                            <span className="text-sm font-black text-emerald-600 whitespace-nowrap">₹{tl.dailyCollection.toLocaleString()}</span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-3 border-t border-border/30 pt-1">
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-[7px] text-muted-foreground font-bold uppercase">Week</span>
                                                <span className="text-[10px] font-bold whitespace-nowrap">₹{tl.weeklyCollection >= 100000 ? `${(tl.weeklyCollection / 1000).toFixed(0)}k` : tl.weeklyCollection.toLocaleString()}</span>
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-[7px] text-violet-500 font-bold uppercase">Month</span>
                                                <span className="text-[10px] font-bold text-violet-600 whitespace-nowrap">₹{(tl.monthlyCollection || 0) >= 100000 ? `${((tl.monthlyCollection || 0) / 1000).toFixed(0)}k` : (tl.monthlyCollection || 0).toLocaleString()}</span>
                                            </div>
                                            <div className="flex flex-col text-right min-w-0">
                                                <span className="text-[7px] text-muted-foreground font-bold uppercase">Total</span>
                                                <span className="text-[10px] font-bold text-muted-foreground whitespace-nowrap">₹{tl.totalCollection >= 100000 ? `${(tl.totalCollection / 1000).toFixed(0)}k` : tl.totalCollection.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                </td>

                                {/* 6. Fleet Flow */}
                                <td className="p-3">
                                    <div className="space-y-1">
                                        <div className="flex flex-col">
                                            <span className="text-[8px] text-muted-foreground font-bold uppercase">Net Growth</span>
                                            <span className={`text-sm font-black ${tl.netGrowth >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {tl.netGrowth > 0 ? '+' : ''}{tl.netGrowth}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center gap-3 border-t border-border/30 pt-0.5">
                                            <div className="flex flex-col">
                                                <span className="text-[7px] text-muted-foreground font-bold uppercase">Allot</span>
                                                <span className="text-[10px] font-bold text-indigo-600">+{tl.allotments}</span>
                                            </div>
                                            <div className="flex flex-col text-right">
                                                <span className="text-[7px] text-muted-foreground font-bold uppercase">Sub</span>
                                                <span className="text-[10px] font-bold text-rose-500">-{tl.submissions}</span>
                                            </div>
                                        </div>
                                    </div>
                                </td>

                                {/* 7. Leads */}
                                <td className="p-3">
                                    <div className="flex items-center gap-2">
                                        <div className="relative w-8 h-8 flex-shrink-0">
                                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                                <circle cx="18" cy="18" r="14" stroke="currentColor" strokeWidth="3" fill="transparent" className="text-muted/20" />
                                                <circle
                                                    cx="18" cy="18" r="14"
                                                    stroke="currentColor" strokeWidth="3" fill="transparent"
                                                    strokeDasharray={88} strokeDashoffset={88 - (88 * tl.leads.conversionRate) / 100}
                                                    className="text-indigo-500 transition-all duration-1000"
                                                />
                                            </svg>
                                            <span className="absolute inset-0 flex items-center justify-center text-[8px] font-black">
                                                {tl.leads.conversionRate}%
                                            </span>
                                        </div>
                                        <div className="text-[9px] space-y-0.5">
                                            <p className="flex justify-between gap-2">
                                                <span className="text-muted-foreground">Today</span>
                                                <span className="font-black text-indigo-600">+{tl.leadsToday}</span>
                                            </p>
                                            <p className="flex justify-between gap-2">
                                                <span className="text-muted-foreground">Churn</span>
                                                <span className="font-bold text-rose-500">{tl.churnLeads}</span>
                                            </p>
                                        </div>
                                    </div>
                                </td>

                                {/* 8. AI Score */}
                                <td className="p-3 text-center">
                                    {tl.score != null ? (
                                        <div className="flex flex-col items-center gap-0.5">
                                            <span className={`text-sm font-black ${(tl.score || 0) >= 70 ? 'text-emerald-600' : (tl.score || 0) >= 40 ? 'text-amber-600' : 'text-rose-600'}`}>
                                                {tl.score}
                                            </span>
                                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${
                                                tl.aiGrade === 'S' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                : tl.aiGrade === 'A' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                : tl.aiGrade === 'B' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                : tl.aiGrade === 'C' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                                            }`}>{tl.aiGrade}</span>
                                        </div>
                                    ) : (
                                        <span className="text-[10px] text-muted-foreground">–</span>
                                    )}
                                </td>

                                {/* 9. Actions */}
                                <td className="p-3 text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger className="p-1.5 hover:bg-muted rounded-lg transition-colors">
                                            <MoreHorizontal size={14} />
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => navigate('/portal/riders', { state: { filter: 'teamLeader', value: tl.id } })}>
                                                View Riders
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => navigate('/portal/leads', { state: { filter: 'teamLeader', value: tl.id } })}>
                                                View Leads
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => setHistoryModalData({ id: tl.id, name: tl.name })}>
                                                Collection History
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </td>
                            </tr>
                        ))}
                    </tbody>

                    {/* ── GRAND TOTALS FOOTER ── */}
                    {sortedData.length > 0 && (
                        <tfoot className="sticky bottom-0 bg-slate-100/90 dark:bg-slate-900/80 backdrop-blur-sm border-t-2 border-indigo-500/30">
                            <tr className="text-[10px] font-black">
                                <td className="p-3 uppercase tracking-wider text-indigo-600">Totals ({sortedData.length})</td>
                                <td className="p-3">
                                    {sortedData.reduce((s, t) => s + t.activeRiders, 0)} / {sortedData.reduce((s, t) => s + t.totalRiders, 0)}
                                </td>
                                <td className="p-3">
                                    <span className="text-emerald-600">{sortedData.reduce((s, t) => s + t.wallet.positiveCount, 0)} POS</span>
                                    {' '}
                                    <span className="text-rose-600">{sortedData.reduce((s, t) => s + t.wallet.negativeCount, 0)} NEG</span>
                                </td>
                                <td className="p-3">–</td>
                                <td className="p-3 text-emerald-600">₹{sortedData.reduce((s, t) => s + t.dailyCollection, 0).toLocaleString()}</td>
                                <td className="p-3">
                                    <span className="text-emerald-600">+{sortedData.reduce((s, t) => s + t.allotments, 0)}</span>
                                    {' / '}
                                    <span className="text-rose-600">-{sortedData.reduce((s, t) => s + t.submissions, 0)}</span>
                                    {' / '}
                                    <span className={sortedData.reduce((s, t) => s + t.netGrowth, 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                                        {sortedData.reduce((s, t) => s + t.netGrowth, 0)}
                                    </span>
                                </td>
                                <td className="p-3">
                                    {sortedData.reduce((s, t) => s + t.leads.converted, 0)} / {sortedData.reduce((s, t) => s + t.leadsToday, 0)}
                                </td>
                                <td className="p-3 text-center">–</td>
                                <td className="p-3">–</td>
                            </tr>
                        </tfoot>
                    )}
                </table>
                {sortedData.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground">
                        {searchTerm ? 'No matches found.' : 'No active Team Leaders found.'}
                    </div>
                )}
            </div>

            {/* Collection History Modal */}
            {
                historyModalData && <CollectionHistoryModal
                    isOpen={!!historyModalData}
                    onClose={() => setHistoryModalData(null)}
                    teamLeaderId={historyModalData.id}
                    teamLeaderName={historyModalData.name}
                />
            }
        </div>
    );
};

export default TeamLeaderPerformanceTable;
