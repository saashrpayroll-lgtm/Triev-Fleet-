import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/config/supabase';
import { User, Rider, Lead } from '@/types';
import { Trophy, Users, Search, ArrowUpDown, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import Leaderboard from '@/components/Leaderboard';

interface ScoredTL extends User {
    score: number;
    stats: {
        active: number;
        total: number;
        activePercentage: number;
        wallet: number;
        avgWallet: number;
        leads: {
            total: number;
            converted: number;
            conversionRate: number;
        };
        collection: number;
    };
    rank: number;
}

const LeaderboardPage: React.FC = () => {
    const [teamLeaders, setTeamLeaders] = useState<User[]>([]);
    const [riders, setRiders] = useState<Rider[]>([]);
    const [leads, setLeads] = useState<Lead[]>([]);
    const [collections, setCollections] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'score', direction: 'desc' });

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch TLs
                const { data: usersData } = await supabase.from('users').select(`
                    id,
                    fullName:full_name,
                    mobile,
                    email,
                    status
                `).eq('role', 'teamLeader');
                if (usersData) {
                    setTeamLeaders(usersData as User[]);
                }

                // Fetch Riders
                const { data: ridersData } = await supabase.from('riders').select(`
                    id,
                    trievId:triev_id,
                    riderName:rider_name,
                    status,
                    walletAmount:wallet_amount,
                    teamLeaderId:team_leader_id
                `);
                if (ridersData) {
                    setRiders(ridersData as Rider[]);
                }

                // Fetch Leads
                const { data: leadsData } = await supabase.from('leads').select(`
                    id,
                    status,
                    createdBy:created_by
                `);
                if (leadsData) {
                    setLeads(leadsData as Lead[]);
                }

                // Fetch Collections
                const { data: dailyRes } = await supabase.from('daily_collections').select('team_leader_id, total_collection');
                const colMap: Record<string, number> = {};
                if (dailyRes) {
                    dailyRes.forEach((d: any) => {
                        const tlId = d.team_leader_id;
                        const amt = Number(d.total_collection) || 0;
                        colMap[tlId] = (colMap[tlId] || 0) + amt;
                    });
                    setCollections(colMap);
                }

            } catch (error) {
                console.error('Error loading leaderboard data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        // Realtime Subscription
        const subscription = supabase
            .channel('leaderboard-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'riders' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_collections' }, () => fetchData())
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    // Scoring Logic (standardized with Leaderboard component)
    const scoredList: ScoredTL[] = useMemo(() => {
        const now = new Date();
        const list = teamLeaders.map(tl => {
            const tlRiders = riders.filter(r => r.teamLeaderId === tl.id);
            const activeCount = tlRiders.filter(r => r.status === 'active').length;
            const inactiveCount = tlRiders.filter(r => r.status === 'inactive').length;
            const churnCount = tlRiders.filter(r => r.status === 'deleted').length;

            // Rider Age (Loyalty)
            const riderAges = tlRiders
                .filter(r => r.status === 'active' && r.allotmentDate)
                .map(r => {
                    const start = new Date(r.allotmentDate!);
                    return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                });
            const avgRiderAge = riderAges.length > 0 ? riderAges.reduce((a, b) => a + b, 0) / riderAges.length : 0;

            // Wallet Stats
            const positiveSum = tlRiders.filter(r => r.walletAmount > 0).reduce((sum, r) => sum + r.walletAmount, 0);
            const negativeSum = tlRiders.filter(r => r.walletAmount < 0).reduce((sum, r) => sum + r.walletAmount, 0);
            const zeroWalletCount = tlRiders.filter(r => r.walletAmount === 0).length;

            // Leads
            const tlLeads = leads.filter(l => l.createdBy === tl.id);
            const convertedLeads = tlLeads.filter(l => l.status === 'Convert').length;
            const notConvertedLeads = tlLeads.filter(l => l.status === 'Not Convert').length;

            // Collection
            const collectionAmount = collections[tl.id] || 0;

            // --- ADVANCED WEIGHTED SCORING LOGIC ---
            let score = 0;
            score += activeCount * 20;
            score -= inactiveCount * 15;
            score -= churnCount * 30;
            score += Math.floor(collectionAmount / 1000) * 10;
            score += Math.floor(positiveSum / 1000) * 2;
            score -= Math.abs(Math.floor(negativeSum / 1000)) * 12;
            score -= zeroWalletCount * 5;
            score += convertedLeads * 40;
            score -= notConvertedLeads * 8;
            score += Math.floor(avgRiderAge * 0.5);

            score = Math.max(0, Math.round(score));

            return {
                ...tl,
                score,
                stats: {
                    active: activeCount,
                    total: tlRiders.length,
                    activePercentage: tlRiders.length > 0 ? (activeCount / tlRiders.length) * 100 : 0,
                    wallet: positiveSum + negativeSum,
                    avgWallet: tlRiders.length > 0 ? (positiveSum + negativeSum) / tlRiders.length : 0,
                    leads: {
                        total: tlLeads.length,
                        converted: convertedLeads,
                        conversionRate: tlLeads.length > 0 ? (convertedLeads / tlLeads.length) * 100 : 0
                    },
                    collection: collectionAmount,
                    avgRiderAge: Math.round(avgRiderAge),
                    churn: churnCount
                }
            } as ScoredTL;
        });

        // Sorting
        return list.sort((a, b) => {
            const getVal = (item: ScoredTL, key: string) => {
                if (key === 'score') return item.score;
                if (key === 'wallet') return item.stats.wallet;
                if (key === 'riders') return item.stats.active;
                if (key === 'leads') return item.stats.leads.conversionRate;
                if (key === 'collection') return item.stats.collection;
                return 0;
            };

            const valA = getVal(a, sortConfig.key);
            const valB = getVal(b, sortConfig.key);

            return sortConfig.direction === 'desc' ? valB - valA : valA - valB;
        }).map((item, index) => ({ ...item, rank: index + 1 }));
    }, [teamLeaders, riders, leads, collections, sortConfig]);

    const filteredList = scoredList.filter(tl =>
        (tl.fullName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (tl.email || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSort = (key: string) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    if (loading) return <div className="p-10 text-center">Loading Leaderboard...</div>;

    return (
        <div className="space-y-6 pb-12 max-w-[1440px] mx-auto px-4 md:px-8 font-jakarta flex flex-col min-h-[calc(100vh-64px)]">
            {/* Real-time Header Module */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-slate-900/5 backdrop-blur-3xl p-6 rounded-[2rem] border border-slate-200/50 dark:border-white/5 shadow-inner"
            >
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Trophy className="text-yellow-500 w-10 h-10 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]" strokeWidth={1.5} />
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                                className="absolute -inset-1 border-2 border-dashed border-yellow-500/20 rounded-full"
                            />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black tracking-tighter bg-gradient-to-br from-slate-900 to-slate-500 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
                                Live Performance Leaderboard
                            </h1>
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/80">
                                    Neural Engine Synchronization: Active
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="relative flex-grow md:w-80 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Filter by name or identity..."
                            className="w-full pl-12 pr-6 py-3.5 text-sm bg-white/60 dark:bg-slate-900/40 backdrop-blur-2xl border-2 border-transparent focus:border-primary/20 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all shadow-xl font-medium"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </motion.div>

            {/* Premium Podium Component */}
            <div className="animate-in fade-in slide-in-from-bottom duration-1000 delay-200">
                <Leaderboard teamLeaders={teamLeaders} riders={riders} leads={leads} collections={collections} disableClick={true} />
            </div>

            {/* rankings Table Container (Scrollable) */}
            <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="flex-grow flex flex-col bg-white/40 dark:bg-slate-950/40 backdrop-blur-3xl border border-white/20 dark:border-white/5 rounded-[2.5rem] shadow-2xl overflow-hidden min-h-[500px]"
            >
                <div className="p-8 border-b border-white/10 flex justify-between items-center bg-white/20 dark:bg-slate-900/40">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-primary/10 rounded-xl">
                            <Users size={20} className="text-primary" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black tracking-tight text-slate-800 dark:text-white">Full Rankings</h3>
                            <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">{filteredList.length} Leaders Identified</p>
                        </div>
                    </div>

                    <button className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl active:scale-95">
                        Export Intelligence
                    </button>
                </div>

                <div className="overflow-auto relative flex-grow scrollbar-hide">
                    <table className="w-full text-sm text-left border-separate border-spacing-y-2 px-6 pb-6">
                        <thead className="bg-transparent text-muted-foreground/60 font-black uppercase tracking-[0.15em] text-[10px] sticky top-0 z-10 backdrop-blur-md">
                            <tr>
                                <th className="px-6 py-4 text-center first:rounded-l-2xl">Rank</th>
                                <th className="px-6 py-4">Intelligence Operator</th>
                                <th className="px-6 py-4 cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('score')}>
                                    <div className="flex items-center gap-1.5">AI Impact <ArrowUpDown size={14} /></div>
                                </th>
                                <th className="px-6 py-4 cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('riders')}>
                                    <div className="flex items-center gap-1.5">Fleet Efficiency <ArrowUpDown size={14} /></div>
                                </th>
                                <th className="px-6 py-4 cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('wallet')}>
                                    <div className="flex items-center gap-1.5">Revenue Health <ArrowUpDown size={14} /></div>
                                </th>
                                <th className="px-6 py-4 last:rounded-r-2xl">Collection Velocity</th>
                            </tr>
                        </thead>
                        <tbody className="space-y-4">
                            {filteredList.map((tl, idx) => (
                                <motion.tr
                                    key={tl.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.1 * idx }}
                                    className="group hover:scale-[1.005] transition-all duration-300"
                                >
                                    <td className="px-6 py-4 text-center whitespace-nowrap bg-white/60 dark:bg-slate-900/40 rounded-l-[1.5rem] border-y border-l border-white/20 dark:border-white/5">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto text-sm font-black shadow-inner
                                            ${tl.rank === 1 ? 'bg-yellow-400/20 text-yellow-600 border border-yellow-400/30' :
                                                tl.rank === 2 ? 'bg-slate-200/40 text-slate-500 border border-slate-300/30' :
                                                    tl.rank === 3 ? 'bg-orange-400/20 text-orange-600 border border-orange-400/30' :
                                                        'bg-slate-100/40 text-slate-400 border border-slate-200/20'}
                                        `}>
                                            {tl.rank}
                                        </div>
                                    </td>

                                    <td className="px-6 py-4 bg-white/60 dark:bg-slate-900/40 border-y border-white/20 dark:border-white/5">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-violet-600/20 flex items-center justify-center text-primary font-black text-lg border border-primary/20 shadow-inner">
                                                {(tl.fullName || '?').charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="font-black text-slate-800 dark:text-white tracking-tight">{tl.fullName || 'Unknown Operator'}</div>
                                                <div className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">{tl.mobile || 'Confidential'}</div>
                                            </div>
                                        </div>
                                    </td>

                                    <td className="px-6 py-4 bg-white/60 dark:bg-slate-900/40 border-y border-white/20 dark:border-white/5">
                                        <div className="flex flex-col">
                                            <span className="text-xl font-black bg-gradient-to-r from-primary to-violet-600 bg-clip-text text-transparent italic">
                                                {tl.score.toLocaleString()}
                                            </span>
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                                <span className="text-[9px] font-black text-primary/60 uppercase tracking-tighter">Impact Score</span>
                                            </div>
                                        </div>
                                    </td>

                                    <td className="px-6 py-4 bg-white/60 dark:bg-slate-900/40 border-y border-white/20 dark:border-white/5">
                                        <div className="space-y-2 min-w-[120px]">
                                            <div className="flex justify-between items-end">
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-sm font-black text-slate-800 dark:text-white">{tl.stats.active}</span>
                                                    <span className="text-[10px] font-bold text-muted-foreground">/ {tl.stats.total}</span>
                                                </div>
                                                <span className="text-[10px] font-black text-emerald-500">{Math.round(tl.stats.activePercentage)}%</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-slate-200 dark:bg-white/5 rounded-full overflow-hidden">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${tl.stats.activePercentage}%` }}
                                                    className="h-full bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                                                />
                                            </div>
                                        </div>
                                    </td>

                                    <td className="px-6 py-4 bg-white/60 dark:bg-slate-900/40 border-y border-white/20 dark:border-white/5">
                                        <div className="flex flex-col">
                                            <div className={`text-sm font-black ${tl.stats.wallet >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                ₹{tl.stats.wallet.toLocaleString('en-IN')}
                                            </div>
                                            <div className="text-[10px] font-bold text-muted-foreground/60 flex items-center gap-1">
                                                AVG: ₹{Math.round(tl.stats.avgWallet).toLocaleString('en-IN')}
                                            </div>
                                        </div>
                                    </td>

                                    <td className="px-6 py-4 bg-white/60 dark:bg-slate-900/40 rounded-r-[1.5rem] border-y border-r border-white/20 dark:border-white/5">
                                        <div className="flex items-center gap-3">
                                            <div className="flex flex-col flex-grow">
                                                <div className="text-sm font-black text-slate-800 dark:text-white">₹{(tl.stats.collection || 0).toLocaleString('en-IN')}</div>
                                                <div className="text-[9px] font-black text-emerald-500/80 uppercase tracking-tighter">Total Inbound</div>
                                            </div>
                                            <div className="p-2 bg-emerald-500/10 rounded-lg">
                                                <TrendingUp size={16} className="text-emerald-500" />
                                            </div>
                                        </div>
                                    </td>
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>

                    {filteredList.length === 0 && (
                        <div className="py-32 text-center overflow-hidden relative">
                            <div className="absolute inset-0 opacity-5 -z-10 flex items-center justify-center">
                                <Search size={400} />
                            </div>
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
