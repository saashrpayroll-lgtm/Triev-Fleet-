import React, { useMemo, useState } from 'react';
import { useRMTeamData } from '@/hooks/useRMTeamData';
import { BarChart3, Download, Search, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { supabase } from '@/config/supabase';

const RMTLPerformance: React.FC = () => {
    const { teamLeaders, riders, leads, loading } = useRMTeamData();
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<'collection' | 'riders' | 'leads' | 'name'>('collection');
    const [period, setPeriod] = useState<'today' | 'yesterday' | 'week' | 'month' | 'total' | 'custom'>('today');
    const [customDate, setCustomDate] = useState({ start: '', end: '' });
    const [expandedTL, setExpandedTL] = useState<string | null>(null);
    const [inlineFilter, setInlineFilter] = useState<'all' | 'positive' | 'negative' | 'active' | 'inactive'>('all');
    const [collectionData, setCollectionData] = useState<Record<string, number>>({});
    const [fleetSnapshotData, setFleetSnapshotData] = useState<Record<string, number>>({});
    const [loadingCollections, setLoadingCollections] = useState(false);

    React.useEffect(() => {
        if (teamLeaders.length === 0) return;
        
        const fetch = async () => {
            setLoadingCollections(true);
            const tlIds = teamLeaders.map(tl => tl.id);
            const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
            
            const yesterdayDate = new Date(); yesterdayDate.setDate(yesterdayDate.getDate() - 1);
            const yesterdayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(yesterdayDate);
            
            const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
            const weekStart = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(weekAgo);
            
            const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 30);
            const monthStart = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(monthAgo);

            let startDate = todayStr;
            let endDate = todayStr;

            if (period === 'yesterday') { startDate = yesterdayStr; endDate = yesterdayStr; }
            else if (period === 'week') { startDate = weekStart; endDate = todayStr; }
            else if (period === 'month') { startDate = monthStart; endDate = todayStr; }
            else if (period === 'total') { startDate = '2020-01-01'; endDate = todayStr; }
            else if (period === 'custom') {
                if (!customDate.start || !customDate.end) {
                    setCollectionData({});
                    setFleetSnapshotData({});
                    setLoadingCollections(false);
                    return;
                }
                startDate = customDate.start;
                endDate = customDate.end;
            }

            // ✅ FIX: Fetch active_riders_count alongside total_collection for fleet snapshots
            const { data } = await supabase
                .from('daily_collections')
                .select('team_leader_id, total_collection, date, active_riders_count')
                .in('team_leader_id', tlIds)
                .gte('date', startDate)
                .lte('date', endDate);

            if (data) {
                const collMap: Record<string, number> = {};
                // ✅ FIX: Build fleet snapshot — use the LATEST active_riders_count per TL within the period
                const fleetMap: Record<string, number> = {};
                const latestDatePerTL: Record<string, string> = {};

                data.forEach((d: any) => {
                    const amt = Number(d.total_collection) || 0;
                    const fleetCount = Number(d.active_riders_count) || 0;
                    const dDate = d.date && typeof d.date === 'string' ? d.date.split('T')[0].split(' ')[0] : d.date;
                    collMap[d.team_leader_id] = (collMap[d.team_leader_id] || 0) + amt;
                    // Keep the latest snapshot (most recent date wins)
                    if (fleetCount > 0 && (!latestDatePerTL[d.team_leader_id] || dDate > latestDatePerTL[d.team_leader_id])) {
                        latestDatePerTL[d.team_leader_id] = dDate;
                        fleetMap[d.team_leader_id] = fleetCount;
                    }
                });
                setCollectionData(collMap);
                setFleetSnapshotData(fleetMap);
            }
            setLoadingCollections(false);
        };
        fetch();
    }, [teamLeaders, period, customDate]);

    // Helper to check if a date string falls inside the selected period
    const isDateInRange = (dateString: string | null | undefined) => {
        if (!dateString) return false;
        const d = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(dateString));
        
        const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
        const yesterdayDate = new Date(); yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(yesterdayDate);
        const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
        const weekStart = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(weekAgo);
        const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 30);
        const monthStart = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(monthAgo);

        if (period === 'today') return d === today;
        if (period === 'yesterday') return d === yesterday;
        if (period === 'week') return d >= weekStart && d <= today;
        if (period === 'month') return d >= monthStart && d <= today;
        if (period === 'total') return true;
        if (period === 'custom' && customDate.start && customDate.end) {
            return d >= customDate.start && d <= customDate.end;
        }
        return false;
    };

    const performanceData = useMemo(() => {
        // ✅ FIX: Determine if we're viewing a historical period (not "today" or "total")
        const isHistorical = period !== 'today' && period !== 'total';

        return teamLeaders
            .filter(tl => tl.status === 'active')
            .map(tl => {
                const tlRiders = riders.filter(r => r.teamLeaderId === tl.id);
                const liveActiveRiders = tlRiders.filter(r => r.status === 'active').length;
                const liveInactiveRiders = tlRiders.filter(r => r.status === 'inactive').length;

                // ✅ FIX: For historical periods, use fleet snapshot from daily_collections
                // This gives us the actual active_riders_count recorded on that date
                const activeRiders = (isHistorical && fleetSnapshotData[tl.id] !== undefined)
                    ? fleetSnapshotData[tl.id]
                    : liveActiveRiders;
                const inactiveRiders = liveInactiveRiders;
                
                // Date specific leads filtering
                const tlLeads = leads.filter(l => l.createdBy === tl.id && isDateInRange(l.createdAt));
                const converted = tlLeads.filter(l => l.status === 'Convert').length;
                
                const positiveRiders = tlRiders.filter(r => r.status === 'active' && r.walletAmount > 0);
                const negativeRiders = tlRiders.filter(r => r.status === 'active' && r.walletAmount < 0);
                const positiveWallet = positiveRiders.reduce((s, r) => s + r.walletAmount, 0);
                const negativeWallet = negativeRiders.reduce((s, r) => s + r.walletAmount, 0);
                const positiveRidersCount = positiveRiders.length;
                const negativeRidersCount = negativeRiders.length;
                
                const criticalDebt = tlRiders.filter(r => r.status === 'active' && r.walletAmount < -3000).length;
                const collection = collectionData[tl.id] || 0;
                
                // ✅ FIX: A/S/N — Only count allotments where allotment_date is within range
                // Submission — only count riders inactivated within the range
                const allotment = tlRiders.filter(r => {
                    const allotDate = r.allotmentDate || r.createdAt;
                    return allotDate && isDateInRange(allotDate);
                }).length;
                const submission = tlRiders.filter(r => {
                    // Must actually be inactive AND inactivated within the period
                    if (r.status !== 'inactive' && r.status !== 'deleted') return false;
                    const inactDate = r.inactivatedAt;
                    return inactDate && isDateInRange(inactDate);
                }).length;
                const netGrowth = allotment - submission;

                let totalActiveAgeDays = 0;
                let activeRidersCount = 0;
                const now = new Date();
                tlRiders.forEach(r => {
                    if (r.status === 'active' && r.allotmentDate) {
                        const ageDiff = now.getTime() - new Date(r.allotmentDate).getTime();
                        totalActiveAgeDays += Math.floor(ageDiff / (1000 * 3600 * 24));
                        activeRidersCount++;
                    }
                });
                const avgAge = activeRidersCount > 0 ? Math.round(totalActiveAgeDays / activeRidersCount) : 0;

                const avgCollection = activeRiders > 0 ? Math.round(collection / activeRiders) : 0;
                const performanceScore = Math.min(100, Math.round(
                    (activeRiders > 0 ? 25 : 0) +
                    (collection > 0 ? Math.min(25, (collection / 5000) * 25) : 0) +
                    (tlLeads.length > 0 ? Math.min(25, (converted / Math.max(1, tlLeads.length)) * 50) : 0) +
                    (criticalDebt === 0 ? 25 : Math.max(0, 25 - criticalDebt * 5))
                ));

                return {
                    id: tl.id, name: tl.fullName, email: tl.email,
                    activeRiders, totalRiders: tlRiders.length, inactiveRiders,
                    collection, avgCollection,
                    allotment, submission, netGrowth, avgAge,
                    leadsTotal: tlLeads.length, convertedLeads: converted,
                    conversionRate: tlLeads.length > 0 ? Math.round((converted / tlLeads.length) * 100) : 0,
                    positiveWallet, negativeWallet, positiveRidersCount, negativeRidersCount, criticalDebt, performanceScore,
                    ridersList: tlRiders,
                };
            })
            .filter(tl => {
                if (!searchTerm) return true;
                const term = searchTerm.toLowerCase();
                return tl.name.toLowerCase().includes(term) || tl.email.toLowerCase().includes(term);
            })
            .sort((a, b) => {
                switch (sortBy) {
                    case 'collection': return b.collection - a.collection;
                    case 'riders': return b.activeRiders - a.activeRiders;
                    case 'leads': return b.leadsTotal - a.leadsTotal;
                    case 'name': return a.name.localeCompare(b.name);
                    default: return 0;
                }
            });
    }, [teamLeaders, riders, leads, collectionData, fleetSnapshotData, searchTerm, sortBy, period, customDate]);

    // Summary
    const summary = useMemo(() => ({
        totalCollection: performanceData.reduce((s, t) => s + t.collection, 0),
        totalActiveRiders: performanceData.reduce((s, t) => s + t.activeRiders, 0),
        totalLeads: performanceData.reduce((s, t) => s + t.leadsTotal, 0),
        totalConverted: performanceData.reduce((s, t) => s + t.convertedLeads, 0),
    }), [performanceData]);

    // Footers
    const filteredTotals = useMemo(() => {
        return performanceData.reduce((acc, tl) => {
            acc.allotment += tl.allotment;
            acc.submission += tl.submission;
            acc.netGrowth += tl.netGrowth;
            acc.activeRiders += tl.activeRiders;
            acc.totalRiders += tl.totalRiders;
            acc.collection += tl.collection;
            acc.positiveWallet += tl.positiveWallet;
            acc.negativeWallet += tl.negativeWallet;
            acc.positiveRidersCount += tl.positiveRidersCount;
            acc.negativeRidersCount += tl.negativeRidersCount;
            acc.criticalDebt += tl.criticalDebt;
            acc.leadsTotal += tl.leadsTotal;
            acc.convertedLeads += tl.convertedLeads;
            return acc;
        }, {
            allotment: 0, submission: 0, netGrowth: 0,
            activeRiders: 0, totalRiders: 0, collection: 0,
            positiveWallet: 0, negativeWallet: 0, 
            positiveRidersCount: 0, negativeRidersCount: 0, criticalDebt: 0,
            leadsTotal: 0, convertedLeads: 0
        });
    }, [performanceData]);

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-emerald-600 bg-emerald-500';
        if (score >= 60) return 'text-blue-600 bg-blue-500';
        if (score >= 40) return 'text-amber-600 bg-amber-500';
        return 'text-rose-600 bg-rose-500';
    };

    const exportCSV = () => {
        const headers = ['Name', 'Email', 'Active Riders', 'Total Riders', 'Allotment(A)', 'Submission(S)', 'Net Growth(N)', 'Avg Age (Days)', 'Collection', 'Avg/Rider', 'Leads', 'Converted', 'Conversion %', 'Score', '+ve Wallet', '-ve Wallet', 'Critical Debt'];
        const rows = performanceData.map(d => [d.name, d.email, d.activeRiders, d.totalRiders, d.allotment, d.submission, d.netGrowth, d.avgAge, d.collection, d.avgCollection, d.leadsTotal, d.convertedLeads, d.conversionRate + '%', d.performanceScore, d.positiveWallet, d.negativeWallet, d.criticalDebt]);
        const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tl_performance_${period}_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center space-y-3">
                    <div className="w-12 h-12 border-3 border-teal-500/30 border-t-teal-500 rounded-full animate-spin mx-auto" />
                    <p className="text-sm text-muted-foreground font-medium">Loading performance data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5 animate-in fade-in duration-500">
            {/* ── HEADER ── */}
            <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-500 rounded-2xl p-5 text-white shadow-xl">
                <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-white/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/4 pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-black flex items-center gap-2.5">
                            <div className="p-2 bg-white/15 rounded-xl backdrop-blur-sm"><BarChart3 size={22} /></div>
                            TL Performance
                        </h1>
                        <p className="text-indigo-100 mt-1 text-sm">{performanceData.length} team leaders performance metrics</p>
                    </div>
                    {/* Summary stats */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/20">
                            <p className="text-[8px] font-black uppercase tracking-wider text-indigo-200">Collection</p>
                            <p className="text-lg font-black">₹{summary.totalCollection.toLocaleString()}</p>
                        </div>
                        <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/20">
                            <p className="text-[8px] font-black uppercase tracking-wider text-indigo-200">Riders</p>
                            <p className="text-lg font-black">{summary.totalActiveRiders}</p>
                        </div>
                        <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/20">
                            <p className="text-[8px] font-black uppercase tracking-wider text-indigo-200">Leads</p>
                            <p className="text-lg font-black">{summary.totalLeads}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── TOOLBAR ── */}
            <div className="bg-card border border-border/40 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-border/40 flex flex-col md:flex-row justify-between items-center gap-3 bg-gradient-to-r from-indigo-500/5 via-transparent to-violet-500/5">
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative w-full md:w-56">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input type="text" placeholder="Search TL..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-background border border-border/60 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" />
                        </div>

                        {/* Period toggle */}
                        <div className="flex flex-wrap items-center gap-1.5 bg-muted/60 rounded-xl p-1 border border-border/40">
                            {(['today', 'yesterday', 'week', 'month', 'total', 'custom'] as const).map(p => (
                                <button key={p} onClick={() => setPeriod(p)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm flex-1 sm:flex-none whitespace-nowrap ${period === p ? 'bg-indigo-500 text-white shadow-indigo-500/30' : 'bg-card text-muted-foreground hover:bg-accent/80 hover:text-foreground border border-border/40'}`}>
                                    {p === 'today' ? 'Today' : p === 'yesterday' ? 'Yesterday' : p === 'week' ? '7 Days' : p === 'month' ? '30 Days' : p === 'total' ? 'Total' : 'Custom'}
                                </button>
                            ))}
                            
                            {period === 'custom' && (
                                <div className="flex items-center gap-1.5 px-1 animate-in slide-in-from-left-2 fade-in">
                                    <input 
                                        type="date" 
                                        value={customDate.start} 
                                        onChange={(e) => setCustomDate(prev => ({ ...prev, start: e.target.value }))}
                                        className="h-8 px-2 text-xs rounded-md bg-background border border-border outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                    <span className="text-muted-foreground text-xs leading-none">-</span>
                                    <input 
                                        type="date" 
                                        value={customDate.end} 
                                        onChange={(e) => setCustomDate(prev => ({ ...prev, end: e.target.value }))}
                                        className="h-8 px-2 text-xs rounded-md bg-background border border-border outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Sort */}
                        <select value={sortBy} onChange={(e: any) => setSortBy(e.target.value)}
                            className="hidden md:block px-3 py-2.5 rounded-2xl text-sm font-bold bg-background border border-border/60 cursor-pointer outline-none">
                            <option value="collection">Sort: Collection</option>
                            <option value="riders">Sort: Riders</option>
                            <option value="leads">Sort: Leads</option>
                            <option value="name">Sort: Name</option>
                        </select>
                    </div>
                    <button onClick={exportCSV} className="px-4 py-2.5 text-sm border border-border/60 rounded-2xl hover:bg-accent transition-colors flex items-center gap-2 font-bold">
                        <Download size={15} /> Export
                    </button>
                </div>

                {/* Table */}
                <div className="overflow-auto max-h-[65vh]">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-card z-10 shadow-sm">
                            <tr className="text-left border-b">
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest w-10">#</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest min-w-[200px]">Team Leader</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest text-center">Score</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">A/S/N (Growth)</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">Riders</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">Collection & Avg</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">Wallet (-/+)</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">Leads</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest w-10"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {performanceData.map((tl, i) => (
                                <React.Fragment key={tl.id}>
                                    <tr className={`border-b hover:bg-muted/20 transition-colors ${expandedTL === tl.id ? 'bg-indigo-500/5' : ''}`}>
                                        <td className="p-3">
                                            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black ${
                                                i === 0 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 ring-2 ring-amber-300/50'
                                                : i === 1 ? 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                                                : i === 2 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600'
                                                : 'bg-muted text-muted-foreground'
                                            }`}>{i + 1}</span>
                                        </td>
                                        <td className="p-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-700 dark:text-indigo-400 font-bold text-sm border border-indigo-200 dark:border-indigo-800/30">
                                                    {tl.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-semibold">{tl.name}</p>
                                                    <p className="text-[10px] text-muted-foreground">{tl.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-10 h-10 rounded-full relative">
                                                    <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                                                        <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/30" />
                                                        <circle cx="18" cy="18" r="14" fill="none" strokeWidth="3"
                                                            className={getScoreColor(tl.performanceScore).split(' ')[1]}
                                                            strokeDasharray={`${tl.performanceScore * 0.88} 100`}
                                                            strokeLinecap="round" />
                                                    </svg>
                                                    <span className={`absolute inset-0 flex items-center justify-center text-[10px] font-black ${getScoreColor(tl.performanceScore).split(' ')[0]}`}>
                                                        {tl.performanceScore}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-emerald-500 font-black">{tl.allotment}</span>
                                                <span className="text-muted-foreground text-[10px]">-</span>
                                                <span className="text-rose-500 font-bold">{tl.submission}</span>
                                                <span className="text-muted-foreground text-[10px]">=</span>
                                                <span className={`font-black ${tl.netGrowth > 0 ? 'text-emerald-600' : tl.netGrowth < 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                                                    {tl.netGrowth > 0 && '+'}{tl.netGrowth}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <div className="flex items-baseline gap-1">
                                                <span className="font-bold text-emerald-600">{tl.activeRiders}</span>
                                                <span className="text-[10px] text-muted-foreground">/{tl.totalRiders}</span>
                                            </div>
                                            <div className="text-[10px] text-muted-foreground mt-0.5">Avg Age: <span className="font-bold text-foreground">{tl.avgAge}d</span></div>
                                        </td>
                                        <td className="p-3">
                                            <p className="font-black text-emerald-600 text-[13px]">
                                                {loadingCollections ? <span className="text-muted-foreground/30 animate-pulse text-[10px]">loading...</span> : `₹${tl.collection.toLocaleString()}`}
                                            </p>
                                            <p className="text-[10px] text-indigo-500 font-bold mt-0.5" title="Avg per active rider">
                                                avg: ₹{tl.avgCollection.toLocaleString()}
                                            </p>
                                        </td>
                                        <td className="p-3">
                                            <div className="space-y-0.5">
                                                <div className="text-[10px] font-bold text-emerald-500" title={`${tl.positiveRidersCount} positive riders`}>+₹{tl.positiveWallet.toLocaleString()} <span className="opacity-70 font-normal">({tl.positiveRidersCount})</span></div>
                                                <div className="text-[10px] font-bold text-rose-500" title={`${tl.negativeRidersCount} negative riders`}>-₹{Math.abs(tl.negativeWallet).toLocaleString()} <span className="opacity-70 font-normal">({tl.negativeRidersCount})</span></div>
                                                {tl.criticalDebt > 0 && (
                                                    <div className="text-[9px] font-black text-rose-600 bg-rose-50 dark:bg-rose-900/20 px-1 py-0.5 rounded inline-flex items-center gap-0.5">
                                                        <AlertTriangle size={8} /> {tl.criticalDebt}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <div>
                                                <span className="font-bold">{tl.leadsTotal}</span>
                                                <span className="text-muted-foreground"> • </span>
                                                <span className="text-emerald-500 font-bold">{tl.convertedLeads}</span>
                                                <p className="text-[10px] text-indigo-500 font-bold">{tl.conversionRate}%</p>
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <button
                                                onClick={() => {
                                                    setExpandedTL(expandedTL === tl.id ? null : tl.id);
                                                    setInlineFilter('all');
                                                }}
                                                className="p-1.5 rounded-lg hover:bg-accent transition-colors"
                                            >
                                                {expandedTL === tl.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                            </button>
                                        </td>
                                    </tr>
                                    {/* Expandable rider summary */}
                                    {expandedTL === tl.id && (
                                        <tr>
                                            <td colSpan={9}>
                                                <div className="bg-indigo-50/50 dark:bg-indigo-950/20 p-4 border-b animate-in fade-in slide-in-from-top-2 duration-200">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <p className="text-xs font-black uppercase text-muted-foreground tracking-wider">
                                                            {tl.name}'s Riders ({tl.totalRiders})
                                                        </p>
                                                        <div className="flex items-center gap-1 bg-background rounded-lg p-1 border border-border/50">
                                                            {(['all', 'positive', 'negative', 'active', 'inactive'] as const).map(f => (
                                                                <button key={f} onClick={() => setInlineFilter(f)}
                                                                    className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-all ${inlineFilter === f ? 'bg-indigo-500 text-white shadow' : 'hover:bg-accent text-muted-foreground'}`}>
                                                                    {f}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    {tl.ridersList.length > 0 ? (
                                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-auto">
                                                            {tl.ridersList.filter(r => {
                                                                if (inlineFilter === 'active') return r.status === 'active';
                                                                if (inlineFilter === 'inactive') return r.status === 'inactive';
                                                                if (inlineFilter === 'positive') return r.status === 'active' && r.walletAmount > 0;
                                                                if (inlineFilter === 'negative') return r.status === 'active' && r.walletAmount < 0;
                                                                return true;
                                                            }).map(r => (
                                                                <div key={r.id} className="bg-card border border-border/40 rounded-xl p-2.5 flex items-center justify-between text-xs">
                                                                    <div className="min-w-0">
                                                                        <p className="font-semibold truncate">{r.riderName}</p>
                                                                        <p className="text-muted-foreground font-mono text-[10px]">{r.trievId}</p>
                                                                    </div>
                                                                    <div className="flex items-center gap-2 flex-shrink-0">
                                                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide ${r.status === 'active' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700'}`}>
                                                                            {r.status}
                                                                        </span>
                                                                        <span className={`font-bold tabular-nums text-[11px] ${r.status === 'inactive' ? 'text-muted-foreground' : r.walletAmount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                                            ₹{r.status === 'inactive' ? '0' : r.walletAmount.toLocaleString()}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                            {tl.ridersList.filter(r => {
                                                                if (inlineFilter === 'active') return r.status === 'active';
                                                                if (inlineFilter === 'inactive') return r.status === 'inactive';
                                                                if (inlineFilter === 'positive') return r.status === 'active' && r.walletAmount > 0;
                                                                if (inlineFilter === 'negative') return r.status === 'active' && r.walletAmount < 0;
                                                                return true;
                                                            }).length === 0 && (
                                                                <p className="text-xs text-muted-foreground col-span-full">No riders match this filter.</p>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-muted-foreground">No riders assigned</p>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                            {performanceData.length === 0 && (
                                <tr><td colSpan={9} className="p-12 text-center text-muted-foreground">No team leaders found</td></tr>
                            )}
                        </tbody>
                        {performanceData.length > 0 && (
                            <tfoot className="sticky bottom-0 bg-indigo-50/95 dark:bg-indigo-950/95 border-t border-indigo-200 dark:border-indigo-800 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20 backdrop-blur-md">
                                <tr className="border-t-2 border-indigo-500/20">
                                    <td colSpan={3} className="p-3 text-right font-black text-indigo-700 dark:text-indigo-300 uppercase tracking-widest text-xs">
                                        Grand Totals
                                    </td>
                                    <td className="p-3">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-emerald-500 font-black">{filteredTotals.allotment}</span>
                                            <span className="text-muted-foreground text-[10px]">-</span>
                                            <span className="text-rose-500 font-bold">{filteredTotals.submission}</span>
                                            <span className="text-muted-foreground text-[10px]">=</span>
                                            <span className={`font-black ${filteredTotals.netGrowth > 0 ? 'text-emerald-600' : filteredTotals.netGrowth < 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                                                {filteredTotals.netGrowth > 0 && '+'}{filteredTotals.netGrowth}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-3">
                                        <div className="flex items-baseline gap-1">
                                            <span className="font-bold text-emerald-600">{filteredTotals.activeRiders}</span>
                                            <span className="text-[10px] text-muted-foreground">/{filteredTotals.totalRiders}</span>
                                        </div>
                                    </td>
                                    <td className="p-3">
                                        <p className="font-black text-emerald-600 text-[13px]">
                                            {loadingCollections ? <span className="text-muted-foreground/30 animate-pulse text-[10px]">loading...</span> : `₹${filteredTotals.collection.toLocaleString()}`}
                                        </p>
                                        <p className="text-[10px] text-indigo-500 font-bold mt-0.5" title="Overall Avg per active rider">
                                            avg: ₹{(filteredTotals.activeRiders > 0 ? Math.round(filteredTotals.collection / filteredTotals.activeRiders) : 0).toLocaleString()}
                                        </p>
                                    </td>
                                    <td className="p-3">
                                        <div className="space-y-0.5">
                                            <div className="text-[10px] font-bold text-emerald-500">+₹{filteredTotals.positiveWallet.toLocaleString()} <span className="opacity-70 font-normal">({filteredTotals.positiveRidersCount})</span></div>
                                            <div className="text-[10px] font-bold text-rose-500">-₹{Math.abs(filteredTotals.negativeWallet).toLocaleString()} <span className="opacity-70 font-normal">({filteredTotals.negativeRidersCount})</span></div>
                                            {filteredTotals.criticalDebt > 0 && (
                                                <div className="text-[9px] font-black text-rose-600 bg-rose-50 dark:bg-rose-900/20 px-1 py-0.5 rounded inline-flex items-center gap-0.5">
                                                    <AlertTriangle size={8} /> {filteredTotals.criticalDebt}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-3">
                                        <div>
                                            <span className="font-bold">{filteredTotals.leadsTotal}</span>
                                            <span className="text-muted-foreground"> • </span>
                                            <span className="text-emerald-500 font-bold">{filteredTotals.convertedLeads}</span>
                                            <p className="text-[10px] text-indigo-500 font-bold">
                                                {filteredTotals.leadsTotal > 0 ? Math.round((filteredTotals.convertedLeads / filteredTotals.leadsTotal) * 100) : 0}%
                                            </p>
                                        </div>
                                    </td>
                                    <td className="p-3"></td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
};

export default RMTLPerformance;
