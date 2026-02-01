import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/config/supabase';
import { User, Rider, Lead } from '@/types';
import { Trophy, Users, Search, ArrowUpDown } from 'lucide-react';
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
    };
    rank: number;
}

const LeaderboardPage: React.FC = () => {
    const [teamLeaders, setTeamLeaders] = useState<User[]>([]);
    const [riders, setRiders] = useState<Rider[]>([]);
    const [leads, setLeads] = useState<Lead[]>([]);
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
            .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => { console.log('Users changed, reloading...'); fetchData(); })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'riders' }, () => { console.log('Riders changed, reloading...'); fetchData(); })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => { console.log('Leads changed, reloading...'); fetchData(); })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    // Scoring Logic
    const scoredList: ScoredTL[] = useMemo(() => {
        const list = teamLeaders.map(tl => {
            // Riders
            const tlRiders = riders.filter(r => r.teamLeaderId === tl.id);
            const activeCount = tlRiders.filter(r => r.status === 'active').length;
            const inactiveCount = tlRiders.filter(r => r.status === 'inactive').length;
            const totalWallet = tlRiders.reduce((sum, r) => sum + r.walletAmount, 0);

            // Leads
            const tlLeads = leads.filter(l => l.createdBy === tl.id);
            const convertedLeads = tlLeads.filter(l => l.status === 'Convert').length;

            // Simple Scoring Algorithm
            let score = 100; // Base

            // 1. Fleet Health
            score += activeCount * 10;
            score -= inactiveCount * 5;

            // 2. Wallet Health
            score += (totalWallet > 0 ? Math.floor(totalWallet / 1000) : 0);
            score += (totalWallet < 0 ? Math.floor(totalWallet / 1000) * 2 : 0);

            // 3. Lead Conversion
            score += convertedLeads * 20;
            score += (tlLeads.length - convertedLeads) * 2; // +2 for attempting (New/Not Convert)

            return {
                ...tl,
                score: Math.max(0, score),
                stats: {
                    active: activeCount,
                    total: tlRiders.length,
                    activePercentage: tlRiders.length > 0 ? (activeCount / tlRiders.length) * 100 : 0,
                    wallet: totalWallet,
                    avgWallet: tlRiders.length > 0 ? totalWallet / tlRiders.length : 0,
                    leads: {
                        total: tlLeads.length,
                        converted: convertedLeads,
                        conversionRate: tlLeads.length > 0 ? (convertedLeads / tlLeads.length) * 100 : 0
                    }
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
                return 0;
            };

            const valA = getVal(a, sortConfig.key);
            const valB = getVal(b, sortConfig.key);

            return sortConfig.direction === 'desc' ? valB - valA : valA - valB;
        }).map((item, index) => ({ ...item, rank: index + 1 }));
    }, [teamLeaders, riders, leads, sortConfig]);

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
        <div className="space-y-8 pb-10">
            <div>
                <h1 className="text-3xl font-extrabold bg-gradient-to-r from-yellow-500 to-amber-600 bg-clip-text text-transparent flex items-center gap-3">
                    <Trophy className="text-yellow-500" /> Live Performance Leaderboard
                </h1>
                <p className="text-muted-foreground mt-1">
                    Real-time ranking based on Active Fleet, Wallet Health, and Lead Conversions.
                </p>
            </div>

            <Leaderboard teamLeaders={teamLeaders} riders={riders} leads={leads} />

            <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 border-b bg-muted/40 flex flex-col md:flex-row gap-4 justify-between items-center">
                    <h3 className="font-semibold flex items-center gap-2">
                        <Users size={18} /> All Team Leaders ({filteredList.length})
                    </h3>
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                        <input
                            type="text"
                            placeholder="Search..."
                            className="w-full pl-9 pr-4 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 text-muted-foreground font-medium border-b">
                            <tr>
                                <th className="px-4 py-3 text-center">Rank</th>
                                <th className="px-4 py-3">Team Leader</th>
                                <th className="px-4 py-3 cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('score')}>
                                    <div className="flex items-center gap-1">AI Score <ArrowUpDown size={12} /></div>
                                </th>
                                <th className="px-4 py-3 cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('riders')}>
                                    <div className="flex items-center gap-1">Fleet Health <ArrowUpDown size={12} /></div>
                                </th>
                                <th className="px-4 py-3 cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('wallet')}>
                                    <div className="flex items-center gap-1">Wallet <ArrowUpDown size={12} /></div>
                                </th>
                                <th className="px-4 py-3 cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('leads')}>
                                    <div className="flex items-center gap-1">Lead Conv. <ArrowUpDown size={12} /></div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {filteredList.map((tl) => (
                                <tr key={tl.id} className="hover:bg-muted/20 transition-colors group">
                                    <td className="px-4 py-3 text-center font-bold text-muted-foreground">
                                        {tl.rank <= 3 ? (
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto ${tl.rank === 1 ? 'bg-yellow-100 text-yellow-700' :
                                                tl.rank === 2 ? 'bg-gray-100 text-gray-700' :
                                                    'bg-orange-100 text-orange-700'
                                                }`}>
                                                {tl.rank}
                                            </div>
                                        ) : `#${tl.rank}`}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                {(tl.fullName || '?').charAt(0)}
                                            </div>
                                            <div>
                                                <div className="font-semibold text-foreground">{tl.fullName || 'Unknown'}</div>
                                                <div className="text-xs text-muted-foreground">{tl.mobile || 'N/A'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-lg font-black bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                                            {tl.score}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold">{tl.stats.active}</span>
                                                <span className="text-muted-foreground text-xs">/ {tl.stats.total}</span>
                                            </div>
                                            {/* Progress Bar for Active % */}
                                            <div className="w-20 h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                                                <div className="h-full bg-green-500 rounded-full" style={{ width: `${tl.stats.activePercentage}%` }} />
                                            </div>
                                            <span className="text-[10px] text-green-600 font-medium mt-0.5">{Math.round(tl.stats.activePercentage)}% Active</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col">
                                            <div className={`font-bold ${tl.stats.wallet >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                ₹{tl.stats.wallet.toLocaleString('en-IN')}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                Avg: ₹{Math.round(tl.stats.avgWallet).toLocaleString('en-IN')}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold">{tl.stats.leads.converted}</span>
                                                <span className="text-muted-foreground text-xs">/ {tl.stats.leads.total}</span>
                                            </div>
                                            <div className="w-20 h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                                                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${tl.stats.leads.conversionRate}%` }} />
                                            </div>
                                            <span className="text-[10px] text-blue-600 font-medium mt-0.5">{Math.round(tl.stats.leads.conversionRate)}% Conv.</span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredList.length === 0 && (
                        <div className="p-8 text-center text-muted-foreground">
                            No Team Leaders found.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LeaderboardPage;
