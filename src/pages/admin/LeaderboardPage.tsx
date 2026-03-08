import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { supabase } from '@/config/supabase';
import { User, Rider, Lead } from '@/types';
import {
    Trophy, Users, Search, ArrowUpDown, TrendingUp, Wallet, Zap, Target,
    BarChart3, Clock, Calendar, PlusCircle, ChevronUp, ChevronDown, Minus, Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Leaderboard from '@/components/Leaderboard';
import { calculateAIScore } from '@/utils/performance';
import { resolvePerformancePeriod, DateFilterType } from '@/utils/dateUtils';

interface ScoredTL extends User {
    score: number;
    rank: number;
    isTrending: boolean;
    aiGrade: 'S' | 'A' | 'B' | 'C' | 'D';
    stats: {
        active: number;
        inactive: number;
        churn: number;
        total: number;
        activePercentage: number;
        wallet: number;
        avgWallet: number;
        positiveWallet: number;
        negativeWallet: number;
        positiveWalletCount: number;
        negativeWalletCount: number;
        collectionPerRider: number;
        leads: { total: number; converted: number; notConverted: number; conversionRate: number };
        collection: number;
        avgRiderAge: number;
        allotments: number;
        submissions: number;
        netGrowth: number;
    };
}

const RANK_STORAGE_KEY = 'lb_prev_ranks_v2';
const getPreviousRanks = (): Record<string, number> => {
    try { return JSON.parse(sessionStorage.getItem(RANK_STORAGE_KEY) || '{}'); } catch { return {}; }
};

const gradeConfig: Record<string, { bg: string; text: string; border: string }> = {
    S: { bg: 'bg-yellow-400/15', text: 'text-yellow-500', border: 'border-yellow-400/30' },
    A: { bg: 'bg-emerald-400/15', text: 'text-emerald-500', border: 'border-emerald-400/30' },
    B: { bg: 'bg-blue-400/15', text: 'text-blue-500', border: 'border-blue-400/30' },
    C: { bg: 'bg-slate-400/15', text: 'text-slate-400', border: 'border-slate-400/30' },
    D: { bg: 'bg-rose-400/10', text: 'text-rose-400', border: 'border-rose-400/20' },
};

const LeaderboardPage: React.FC = () => {
    const [teamLeaders, setTeamLeaders] = useState<User[]>([]);
    const [riders, setRiders] = useState<Rider[]>([]);
    const [leads, setLeads] = useState<Lead[]>([]);
    const [collections, setCollections] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'score', direction: 'desc' });
    const [dateFilter, setDateFilter] = useState<DateFilterType>('all');
    const prevRanksRef = useRef<Record<string, number>>(getPreviousRanks());
    const ledgerDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const period = useMemo(() => resolvePerformancePeriod(dateFilter), [dateFilter]);

    const fetchData = useCallback(async () => {
        try {
            const [usersRes, ridersRes, leadsRes] = await Promise.all([
                supabase.from('users').select('id, full_name, mobile, email, status, role, profile_pic_url').eq('role', 'teamLeader'),
                supabase.from('riders')
                    .select('id, triev_id, rider_name, status, wallet_amount, team_leader_id, allotment_date, inactivated_at')
                    .limit(50000),
                supabase.from('leads').select('id, status, created_by, created_at'),
            ]);

            if (usersRes.data) {
                setTeamLeaders(usersRes.data.map((u: any) => ({
                    id: u.id, fullName: u.full_name, mobile: u.mobile,
                    email: u.email, status: u.status, role: u.role,
                    profilePicUrl: u.profile_pic_url || undefined
                })) as User[]);
            }
            if (ridersRes.data) {
                setRiders(ridersRes.data.map((r: any) => ({
                    id: r.id, trievId: r.triev_id, riderName: r.rider_name,
                    status: r.status, walletAmount: r.wallet_amount ?? 0,
                    teamLeaderId: r.team_leader_id, allotmentDate: r.allotment_date,
                    inactivatedAt: r.inactivated_at
                })) as Rider[]);
            }
            if (leadsRes.data) {
                setLeads(leadsRes.data.map((l: any) => ({
                    id: l.id, status: l.status, createdBy: l.created_by, createdAt: l.created_at
                })) as Lead[]);
            }

            // Collections — daily_collections.date is authoritative for all periods
            let colQuery = supabase.from('daily_collections').select('team_leader_id, total_collection, date');
            if (period) { colQuery = colQuery.gte('date', period.start).lte('date', period.end); }
            const { data: dailyRes } = await colQuery;
            const colMap: Record<string, number> = {};
            // Track TLs with today's snapshot (to avoid double-counting with live ledger)
            const tlsWithTodaySnap = new Set<string>();
            const now = new Date();
            const istDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
            if (dailyRes) {
                dailyRes.forEach((d: any) => {
                    const dDate = d.date && typeof d.date === 'string' ? d.date.split('T')[0].split(' ')[0] : d.date;
                    colMap[d.team_leader_id] = (colMap[d.team_leader_id] || 0) + (Number(d.total_collection) || 0);
                    if (dDate === istDateStr) tlsWithTodaySnap.add(d.team_leader_id);
                });
            }

            // ✅ ROBUST FIX: catch rows where transaction_date is set (imports) OR NULL (legacy)
            const [yr3, mo3, dy3] = istDateStr.split('-').map(Number);
            const midnightISTStr = new Date(Date.UTC(yr3, mo3 - 1, dy3, 0, 0, 0) - 5.5 * 60 * 60 * 1000).toISOString();
            const endOfDayISTStr = new Date(Date.UTC(yr3, mo3 - 1, dy3, 23, 59, 59, 999) - 5.5 * 60 * 60 * 1000).toISOString();

            const { data: ledgerRes } = await supabase
                .from('wallet_ledger')
                .select('amount, transaction_type, transaction_date, created_at, rider:riders!inner(team_leader_id)')
                .eq('mode', 'ADD')
                .in('transaction_type', [
                    'DAILY_COLLECTION', 'DAILY COLLECTION',
                    'RENT_COLLECTION', 'RENT COLLECTION',
                    'FTD_COLLECTION', 'FTD COLLECTION',
                    'COLLECTION', 'RENT'
                ])
                .or(`and(transaction_date.gte.${midnightISTStr},transaction_date.lte.${endOfDayISTStr}),and(transaction_date.is.null,created_at.gte.${midnightISTStr})`);

            if (ledgerRes && (!period || period.end >= istDateStr)) {
                (ledgerRes as any[]).forEach(txn => {
                    if (txn.rider?.team_leader_id) {
                        const tlId = txn.rider.team_leader_id;
                        // Only add live amount if no daily_collections snapshot exists for today
                        if (!tlsWithTodaySnap.has(tlId)) {
                            colMap[tlId] = (colMap[tlId] || 0) + (Number(txn.amount) || 0);
                        }
                    }
                });
            }

            setCollections(colMap);
        } catch (error) {
            console.error('Leaderboard data error:', error);
        } finally {
            setLoading(false);
        }
    }, [period]);

    useEffect(() => {
        fetchData();

        const fetchDebounced = () => {
            if (ledgerDebounceRef.current) clearTimeout(ledgerDebounceRef.current);
            ledgerDebounceRef.current = setTimeout(() => fetchData(), 1200);
        };

        const subscription = supabase
            .channel('leaderboard-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetchData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'riders' }, fetchData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, fetchData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_collections' }, fetchData)
            // ✅ Live wallet_ledger updates (both NEW and UPDATED transactions)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wallet_ledger' }, fetchDebounced)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'wallet_ledger' }, fetchDebounced)
            .subscribe();

        return () => { subscription.unsubscribe(); if (ledgerDebounceRef.current) clearTimeout(ledgerDebounceRef.current); };
    }, [fetchData]);

    const scoredList: ScoredTL[] = useMemo(() => {
        const list = teamLeaders.map(tl => {
            const tlCollection = collections[tl.id] || 0;
            const metrics = calculateAIScore(tl, riders, leads, tlCollection, period);
            return {
                ...tl,
                score: metrics.score,
                isTrending: metrics.isTrending,
                aiGrade: metrics.aiGrade,
                stats: {
                    active: metrics.activeRiders,
                    inactive: metrics.inactiveRiders,
                    churn: metrics.churnRiders,
                    total: metrics.totalRiders,
                    activePercentage: metrics.efficiency,
                    wallet: metrics.positiveWallet + metrics.negativeWallet,
                    avgWallet: metrics.totalRiders > 0 ? (metrics.positiveWallet + metrics.negativeWallet) / metrics.totalRiders : 0,
                    positiveWallet: metrics.positiveWallet,
                    negativeWallet: metrics.negativeWallet,
                    positiveWalletCount: metrics.positiveWalletCount,
                    negativeWalletCount: metrics.negativeWalletCount,
                    collectionPerRider: metrics.collectionPerRider,
                    leads: {
                        total: metrics.leadsTotal, converted: metrics.convertedLeads,
                        notConverted: metrics.leadsTotal - metrics.convertedLeads,
                        conversionRate: metrics.conversionRate
                    },
                    collection: metrics.collection,
                    avgRiderAge: metrics.avgRiderAge,
                    allotments: metrics.allotments,
                    submissions: metrics.submissions,
                    netGrowth: metrics.netGrowth,
                }
            } as any;
        });

        const sorted = list.sort((a: any, b: any) => {
            const getVal = (item: any, key: string) => {
                const keyMap: Record<string, any> = {
                    score: item.score, wallet: item.stats.wallet, riders: item.stats.active,
                    leads: item.stats.leads.conversionRate, collection: item.stats.collection,
                    churn: item.stats.churn, netGrowth: item.stats.netGrowth,
                    perRider: item.stats.collectionPerRider, positiveWalletPct: item.stats.total > 0 ? item.stats.positiveWalletCount / item.stats.total : 0,
                    avgRiderAge: item.stats.avgRiderAge,
                };
                return keyMap[key] ?? 0;
            };
            const valA = getVal(a, sortConfig.key);
            const valB = getVal(b, sortConfig.key);
            return sortConfig.direction === 'desc' ? valB - valA : valA - valB;
        });

        return sorted.map((item: any, index: number) => ({ ...item, rank: index + 1 })) as ScoredTL[];
    }, [teamLeaders, riders, leads, collections, sortConfig, period]);

    const filteredList = scoredList.filter(tl =>
        (tl.fullName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (tl.email || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSort = (key: string) => {
        setSortConfig(current => ({
            key, direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const getRankChange = (tlId: string, currentRank: number) => {
        const prev = prevRanksRef.current[tlId];
        if (!prev) return 0;
        return prev - currentRank;
    };

    const RankChangeBadge = ({ tlId, currentRank }: { tlId: string; currentRank: number }) => {
        const change = getRankChange(tlId, currentRank);
        if (change > 0) return (
            <span className="flex items-center gap-0.5 text-[9px] font-black text-emerald-500">
                <ChevronUp size={9} />{change}
            </span>
        );
        if (change < 0) return (
            <span className="flex items-center gap-0.5 text-[9px] font-black text-rose-400">
                <ChevronDown size={9} />{Math.abs(change)}
            </span>
        );
        return <Minus size={9} className="text-slate-400 dark:text-white/20" />;
    };

    const SortTh = ({ label, sortKey, icon }: { label: string; sortKey: string; icon?: React.ReactNode }) => (
        <th className="px-3 py-4 cursor-pointer hover:text-primary transition-colors whitespace-nowrap text-left" onClick={() => handleSort(sortKey)}>
            <div className="flex items-center gap-1.5">
                {icon}{label}
                <ArrowUpDown size={11} className={sortConfig.key === sortKey ? 'text-primary' : 'opacity-30'} />
            </div>
        </th>
    );

    // Summary stats
    const totalCollection = Object.values(collections).reduce((a, b) => a + b, 0);
    const totalActiveRiders = riders.filter(r => r.status === 'active').length;
    const avgCollectionPerRider = totalActiveRiders > 0 ? Math.round(totalCollection / totalActiveRiders) : 0;

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="flex flex-col items-center gap-4">
                <Trophy size={48} className="text-yellow-500 animate-pulse" />
                <p className="font-black uppercase tracking-widest text-sm text-muted-foreground">Synchronizing Neural Engine...</p>
            </div>
        </div>
    );

    return (
        <div className="space-y-6 pb-12 max-w-[1440px] mx-auto px-4 md:px-8 font-jakarta flex flex-col min-h-[calc(100vh-64px)]">
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
                className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-slate-900/5 backdrop-blur-3xl p-6 rounded-[2rem] border border-slate-200/50 dark:border-white/5 shadow-inner">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Trophy className="text-yellow-500 w-10 h-10 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]" strokeWidth={1.5} />
                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                                className="absolute -inset-1 border-2 border-dashed border-yellow-500/20 rounded-full" />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black tracking-tighter bg-gradient-to-br from-slate-900 to-slate-500 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
                                Live Performance Leaderboard
                            </h1>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/80">Neural Engine: Active</p>
                                </div>
                                {period && (
                                    <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 text-indigo-500 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-500/20">
                                        <Calendar size={12} />{period.start} — {period.end}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
                    <div className="flex items-center bg-white/40 dark:bg-slate-900/40 backdrop-blur-2xl border border-white/20 p-1.5 rounded-2xl shadow-xl">
                        {(['all', 'day', 'week', 'month'] as const).map((filter) => (
                            <button key={filter} onClick={() => setDateFilter(filter)}
                                className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${dateFilter === filter
                                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-lg scale-105'
                                    : 'text-muted-foreground hover:bg-white/20'}`}>
                                {filter}
                            </button>
                        ))}
                    </div>
                    <div className="relative flex-grow md:w-80 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={18} />
                        <input type="text" placeholder="Filter by name or identity..."
                            className="w-full pl-12 pr-6 py-3.5 text-sm bg-white/60 dark:bg-slate-900/40 backdrop-blur-2xl border-2 border-transparent focus:border-primary/20 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all shadow-xl font-medium"
                            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                </div>
            </motion.div>

            {/* Summary Stats Bar — 5 cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                    { label: 'Total Leaders', value: scoredList.length, icon: <Users size={18} className="text-blue-400" />, color: 'from-blue-500/10' },
                    { label: 'Total Riders', value: riders.length, icon: <Target size={18} className="text-emerald-400" />, color: 'from-emerald-500/10' },
                    { label: 'Total Leads', value: leads.length, icon: <Zap size={18} className="text-yellow-400" />, color: 'from-yellow-500/10' },
                    { label: 'Total Collections', value: `₹${(totalCollection / 1000).toFixed(1)}k`, icon: <Wallet size={18} className="text-purple-400" />, color: 'from-purple-500/10' },
                    { label: 'Avg / Rider', value: `₹${avgCollectionPerRider.toLocaleString()}`, icon: <TrendingUp size={18} className="text-rose-400" />, color: 'from-rose-500/10' },
                ].map(stat => (
                    <div key={stat.label} className={`bg-gradient-to-br ${stat.color} to-transparent border border-white/10 dark:border-white/5 rounded-2xl p-4 flex items-center gap-3 backdrop-blur-xl`}>
                        <div className="p-2 bg-white/10 rounded-xl">{stat.icon}</div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{stat.label}</p>
                            <p className="text-lg font-black text-slate-800 dark:text-white">{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Podium Component */}
            <div className="animate-in fade-in slide-in-from-bottom duration-1000 delay-200 mt-12 mb-8">
                <Leaderboard teamLeaders={teamLeaders} riders={riders} leads={leads}
                    collections={collections} disableClick={true} period={period || undefined} />
            </div>

            {/* Full Rankings Table */}
            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                className="flex-grow flex flex-col bg-white/40 dark:bg-slate-950/40 backdrop-blur-3xl border border-white/20 dark:border-white/5 rounded-[2.5rem] shadow-2xl overflow-hidden min-h-[500px]">

                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/20 dark:bg-slate-900/40">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-primary/10 rounded-xl"><BarChart3 size={20} className="text-primary" /></div>
                        <div>
                            <h3 className="text-lg font-black tracking-tight text-slate-800 dark:text-white">Full Rankings</h3>
                            <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">{filteredList.length} Leaders • All Metrics</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest">
                        <span className="flex items-center gap-1"><ChevronUp size={10} className="text-emerald-500" /> Rising</span>
                        <span className="flex items-center gap-1"><ChevronDown size={10} className="text-rose-400" /> Dropping</span>
                    </div>
                </div>

                <div className="overflow-x-auto relative flex-grow scrollbar-hide">
                    <table className="w-full text-sm text-left border-separate border-spacing-y-2 px-4 pb-6">
                        <thead className="bg-transparent text-muted-foreground/60 font-black uppercase tracking-[0.12em] text-[9px] sticky top-0 z-10 backdrop-blur-md">
                            <tr>
                                <th className="px-4 py-4 text-center">Rank</th>
                                <th className="px-4 py-4">Leader</th>
                                <SortTh label="AI Score" sortKey="score" icon={<Zap size={11} className="text-indigo-400" />} />
                                <SortTh label="Fleet" sortKey="riders" icon={<Users size={11} className="text-blue-400" />} />
                                <SortTh label="Flow (A/S/N)" sortKey="netGrowth" icon={<PlusCircle size={11} className="text-indigo-400" />} />
                                <SortTh label="Leads %" sortKey="leads" icon={<Target size={11} className="text-yellow-400" />} />
                                <SortTh label="Wallet" sortKey="wallet" icon={<Wallet size={11} className="text-emerald-400" />} />
                                <SortTh label="Collected" sortKey="collection" icon={<TrendingUp size={11} className="text-purple-400" />} />
                                <SortTh label="Per Rider" sortKey="perRider" icon={<Target size={11} className="text-rose-400" />} />
                                <SortTh label="Churn" sortKey="churn" icon={<BarChart3 size={11} className="text-rose-400" />} />
                                <SortTh label="Avg Age" sortKey="avgRiderAge" icon={<Clock size={11} className="text-sky-400" />} />
                            </tr>
                        </thead>
                        <tbody>
                            <AnimatePresence mode="popLayout">
                                {filteredList.map((tl, idx) => {
                                    const rankChange = getRankChange(tl.id, tl.rank);
                                    const grade = gradeConfig[tl.aiGrade] || gradeConfig.C;
                                    const positiveWalletPct = tl.stats.total > 0 ? Math.round((tl.stats.positiveWalletCount / tl.stats.total) * 100) : 0;

                                    return (
                                        <motion.tr
                                            key={tl.id}
                                            layoutId={`full-row-${tl.id}`}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ delay: 0.03 * idx }}
                                            className="group hover:scale-[1.003] transition-all duration-300"
                                        >
                                            {/* Rank */}
                                            <td className="px-4 py-3 text-center whitespace-nowrap bg-white/60 dark:bg-slate-900/40 rounded-l-2xl border-y border-l border-white/20 dark:border-white/5"
                                                style={{ borderLeft: rankChange > 0 ? '3px solid #10b981' : rankChange < 0 ? '3px solid #f43f5e' : '3px solid transparent' }}>
                                                <div className="flex flex-col items-center gap-0.5">
                                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shadow-inner
                                                        ${tl.rank === 1 ? 'bg-yellow-400/20 text-yellow-600 border border-yellow-400/30' :
                                                            tl.rank === 2 ? 'bg-slate-200/40 text-slate-500 border border-slate-300/30' :
                                                                tl.rank === 3 ? 'bg-orange-400/20 text-orange-600 border border-orange-400/30' :
                                                                    'bg-slate-100/30 text-slate-400 border border-slate-200/20 dark:text-slate-500'}`}>
                                                        {tl.rank}
                                                    </div>
                                                    <RankChangeBadge tlId={tl.id} currentRank={tl.rank} />
                                                </div>
                                            </td>

                                            {/* Leader Info */}
                                            <td className="px-4 py-3 bg-white/60 dark:bg-slate-900/40 border-y border-white/20 dark:border-white/5">
                                                <div className="flex items-center gap-3">
                                                    <div className="relative">
                                                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary/20 to-violet-600/20 flex items-center justify-center text-primary font-black text-lg border border-primary/20 shadow-inner flex-shrink-0">
                                                            {(tl.fullName || '?').charAt(0).toUpperCase()}
                                                        </div>
                                                        {/* Grade badge */}
                                                        <div className={`absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full border text-[7px] font-black ${grade.bg} ${grade.text} ${grade.border} flex items-center gap-0.5`}>
                                                            <Star size={5} />{tl.aiGrade}
                                                        </div>
                                                        {tl.isTrending && (
                                                            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900 shadow-sm" />
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="font-black text-slate-800 dark:text-white tracking-tight truncate max-w-[120px]">{tl.fullName || 'Unknown'}</div>
                                                        <div className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest truncate max-w-[120px]">{tl.mobile || tl.email || '—'}</div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* AI Score */}
                                            <td className="px-4 py-3 bg-white/60 dark:bg-slate-900/40 border-y border-white/20 dark:border-white/5">
                                                <div className="flex flex-col">
                                                    <span className="text-lg font-black bg-gradient-to-r from-indigo-500 to-violet-600 bg-clip-text text-transparent italic">{tl.score.toLocaleString()}</span>
                                                    <span className="text-[8px] font-black text-indigo-400/60 uppercase tracking-widest">Impact pts</span>
                                                </div>
                                            </td>

                                            {/* Fleet */}
                                            <td className="px-4 py-3 bg-white/60 dark:bg-slate-900/40 border-y border-white/20 dark:border-white/5">
                                                <div className="space-y-1 min-w-[90px]">
                                                    <div className="flex justify-between items-end">
                                                        <div className="flex items-baseline gap-1">
                                                            <span className="text-sm font-black text-slate-800 dark:text-white">{tl.stats.active}</span>
                                                            <span className="text-[10px] font-bold text-muted-foreground">/ {tl.stats.total}</span>
                                                        </div>
                                                        <span className="text-[10px] font-black text-emerald-500">{Math.round(tl.stats.activePercentage)}%</span>
                                                    </div>
                                                    <div className="h-1.5 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                                                        <motion.div initial={{ width: 0 }} animate={{ width: `${tl.stats.activePercentage}%` }}
                                                            className="h-full bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Fleet Flow */}
                                            <td className="px-4 py-3 bg-white/60 dark:bg-slate-900/40 border-y border-white/20 dark:border-white/5">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-sm font-black ${tl.stats.netGrowth >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                            {tl.stats.netGrowth > 0 ? '+' : ''}{tl.stats.netGrowth}
                                                        </span>
                                                        <PlusCircle size={10} className="text-indigo-400" />
                                                    </div>
                                                    <span className="text-[8px] font-bold text-muted-foreground tracking-tighter">+{tl.stats.allotments} / -{tl.stats.submissions}</span>
                                                </div>
                                            </td>

                                            {/* Leads */}
                                            <td className="px-4 py-3 bg-white/60 dark:bg-slate-900/40 border-y border-white/20 dark:border-white/5">
                                                <div className="space-y-1 min-w-[80px]">
                                                    <div className="flex justify-between items-end">
                                                        <div className="flex items-baseline gap-1">
                                                            <span className="text-sm font-black text-yellow-500">{tl.stats.leads.converted}</span>
                                                            <span className="text-[10px] font-bold text-muted-foreground">/ {tl.stats.leads.total}</span>
                                                        </div>
                                                        <span className="text-[10px] font-black text-yellow-500">{Math.round(tl.stats.leads.conversionRate)}%</span>
                                                    </div>
                                                    <div className="h-1.5 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                                                        <motion.div initial={{ width: 0 }} animate={{ width: `${tl.stats.leads.conversionRate}%` }}
                                                            className="h-full bg-yellow-400 rounded-full" />
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Wallet */}
                                            <td className="px-4 py-3 bg-white/60 dark:bg-slate-900/40 border-y border-white/20 dark:border-white/5">
                                                <div className="flex flex-col gap-0.5">
                                                    <div className="flex gap-2 text-[9px] font-bold">
                                                        <span className="text-emerald-500">+{(tl.stats.positiveWallet / 1000).toFixed(1)}k</span>
                                                        <span className="text-rose-400">-{(Math.abs(tl.stats.negativeWallet) / 1000).toFixed(1)}k</span>
                                                    </div>
                                                    <span className="text-[8px] font-bold text-slate-400">{positiveWalletPct}% positive</span>
                                                </div>
                                            </td>

                                            {/* Collection */}
                                            <td className="px-4 py-3 bg-white/60 dark:bg-slate-900/40 border-y border-white/20 dark:border-white/5">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex flex-col">
                                                        <div className="text-sm font-black text-slate-800 dark:text-white">₹{(tl.stats.collection || 0).toLocaleString('en-IN')}</div>
                                                        <div className="text-[8px] font-black text-emerald-500/80 uppercase tracking-tight">Rent Collected</div>
                                                    </div>
                                                    <div className="p-1.5 bg-emerald-500/10 rounded-lg flex-shrink-0">
                                                        <TrendingUp size={14} className="text-emerald-500" />
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Per Rider (NEW) */}
                                            <td className="px-4 py-3 bg-white/60 dark:bg-slate-900/40 border-y border-white/20 dark:border-white/5">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-sm font-black text-purple-600 dark:text-purple-300">
                                                        ₹{tl.stats.collectionPerRider >= 1000 ? `${(tl.stats.collectionPerRider / 1000).toFixed(1)}k` : tl.stats.collectionPerRider.toLocaleString()}
                                                    </span>
                                                    <span className="text-[8px] font-bold text-slate-400 dark:text-white/30 uppercase">/ rider</span>
                                                </div>
                                            </td>

                                            {/* Churn */}
                                            <td className="px-4 py-3 bg-white/60 dark:bg-slate-900/40 border-y border-white/20 dark:border-white/5">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className={`text-sm font-black ${tl.stats.churn > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{tl.stats.churn}</span>
                                                    <span className="text-[8px] font-bold text-slate-400 dark:text-white/30">{tl.stats.inactive} Inactive</span>
                                                </div>
                                            </td>

                                            {/* Avg Rider Age */}
                                            <td className="px-4 py-3 bg-white/60 dark:bg-slate-900/40 rounded-r-2xl border-y border-r border-white/20 dark:border-white/5">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-sm font-black text-sky-600 dark:text-sky-300">
                                                        {tl.stats.avgRiderAge > 0 ? `${tl.stats.avgRiderAge}d` : '—'}
                                                    </span>
                                                    <span className="text-[8px] font-bold text-indigo-400/70 uppercase tracking-wide">Avg Tenure</span>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    );
                                })}
                            </AnimatePresence>
                        </tbody>
                    </table>

                    {filteredList.length === 0 && (
                        <div className="py-32 text-center overflow-hidden relative">
                            <div className="absolute inset-0 opacity-5 -z-10 flex items-center justify-center"><Search size={300} /></div>
                            <h2 className="text-2xl font-black text-slate-400 tracking-tighter uppercase italic">No Matches Detected</h2>
                            <p className="text-sm font-bold text-slate-500/60 mt-1">Refine your search parameters to identify leaders.</p>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default LeaderboardPage;
