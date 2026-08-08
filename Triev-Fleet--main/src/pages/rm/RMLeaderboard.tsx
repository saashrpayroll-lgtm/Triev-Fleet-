import React, { useMemo, useState } from 'react';
import { useRMTeamData } from '@/hooks/useRMTeamData';
import { Trophy, Medal, TrendingUp, Star, Target } from 'lucide-react';
import { supabase } from '@/config/supabase';

const RMLeaderboard: React.FC = () => {
    const { teamLeaders, riders, leads, loading } = useRMTeamData();
    const [metric, setMetric] = useState<'collection' | 'riders' | 'leads' | 'conversion'>('collection');
    const [dailyCollections, setDailyCollections] = useState<Record<string, number>>({});

    React.useEffect(() => {
        if (teamLeaders.length === 0) return;
        const tlIds = teamLeaders.map(tl => tl.id);
        const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

        const fetch = async () => {
            const { data } = await supabase
                .from('daily_collections')
                .select('team_leader_id, total_collection')
                .in('team_leader_id', tlIds)
                .eq('date', today);
            if (data) {
                const map: Record<string, number> = {};
                data.forEach((d: any) => { map[d.team_leader_id] = Number(d.total_collection) || 0; });
                setDailyCollections(map);
            }
        };
        fetch();
    }, [teamLeaders]);

    const leaderboardData = useMemo(() => {
        return teamLeaders
            .filter(tl => tl.status === 'active')
            .map(tl => {
                const tlRiders = riders.filter(r => r.teamLeaderId === tl.id);
                const activeRiders = tlRiders.filter(r => r.status === 'active').length;
                const tlLeads = leads.filter(l => l.createdBy === tl.id);
                const converted = tlLeads.filter(l => l.status === 'Convert').length;
                const conversionRate = tlLeads.length > 0 ? Math.round((converted / tlLeads.length) * 100) : 0;
                const collection = dailyCollections[tl.id] || 0;

                return {
                    id: tl.id, name: tl.fullName, email: tl.email,
                    activeRiders, totalRiders: tlRiders.length,
                    collection, leads: tlLeads.length, converted, conversionRate,
                    profilePicUrl: tl.profilePicUrl
                };
            })
            .sort((a, b) => {
                switch (metric) {
                    case 'collection': return b.collection - a.collection;
                    case 'riders': return b.activeRiders - a.activeRiders;
                    case 'leads': return b.leads - a.leads;
                    case 'conversion': return b.conversionRate - a.conversionRate;
                    default: return 0;
                }
            });
    }, [teamLeaders, riders, leads, dailyCollections, metric]);

    const getMetricValue = (tl: typeof leaderboardData[0]) => {
        switch (metric) {
            case 'collection': return `₹${tl.collection.toLocaleString()}`;
            case 'riders': return `${tl.activeRiders} active`;
            case 'leads': return `${tl.leads} leads`;
            case 'conversion': return `${tl.conversionRate}%`;
        }
    };

    const getRankIcon = (rank: number) => {
        if (rank === 0) return <span className="text-2xl">🥇</span>;
        if (rank === 1) return <span className="text-2xl">🥈</span>;
        if (rank === 2) return <span className="text-2xl">🥉</span>;
        return <span className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-black">{rank + 1}</span>;
    };

    const getBadges = (tl: typeof leaderboardData[0], rank: number) => {
        const badges = [];
        if (rank === 0) badges.push({ label: 'Top Performer', color: 'bg-amber-100 text-amber-700', icon: Trophy });
        if (tl.collection > 5000) badges.push({ label: 'High Collector', color: 'bg-emerald-100 text-emerald-700', icon: TrendingUp });
        if (tl.conversionRate >= 50) badges.push({ label: 'Best Converter', color: 'bg-violet-100 text-violet-700', icon: Target });
        if (tl.activeRiders >= 30) badges.push({ label: 'Fleet Master', color: 'bg-blue-100 text-blue-700', icon: Star });
        return badges;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-10 h-10 border-3 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Trophy className="text-amber-500" size={24} />
                        Team Leaderboard
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">Compete, compare, and celebrate your team's achievements</p>
                </div>
                <div className="flex gap-2">
                    {(['collection', 'riders', 'leads', 'conversion'] as const).map(m => (
                        <button
                            key={m}
                            onClick={() => setMetric(m)}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${metric === m ? 'bg-teal-500 text-white shadow-md' : 'bg-muted hover:bg-accent'}`}
                        >
                            {m === 'collection' ? '💰 Collection' : m === 'riders' ? '🏍️ Riders' : m === 'leads' ? '🎯 Leads' : '📈 Conversion'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Top 3 Podium */}
            {leaderboardData.length >= 3 && (
                <div className="grid grid-cols-3 gap-4">
                    {[1, 0, 2].map(rank => {
                        const tl = leaderboardData[rank];
                        if (!tl) return null;
                        const isFirst = rank === 0;
                        return (
                            <div key={tl.id} className={`bg-card border rounded-2xl p-4 text-center shadow-sm ${isFirst ? 'md:-mt-4 border-amber-200 bg-gradient-to-b from-amber-50/50 to-card' : ''}`}>
                                <div className="flex justify-center mb-2">{getRankIcon(rank)}</div>
                                <div className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center font-bold text-lg border-2 ${isFirst ? 'border-amber-400 bg-amber-100 text-amber-700' : rank === 1 ? 'border-slate-300 bg-slate-100 text-slate-600' : 'border-orange-300 bg-orange-100 text-orange-600'}`}>
                                    {tl.name.charAt(0)}
                                </div>
                                <p className="font-bold mt-2 truncate">{tl.name}</p>
                                <p className="text-lg font-black text-teal-600 mt-1">{getMetricValue(tl)}</p>
                                <div className="flex flex-wrap gap-1 justify-center mt-2">
                                    {getBadges(tl, rank).map((badge, i) => (
                                        <span key={i} className={`text-[8px] font-black px-1.5 py-0.5 rounded ${badge.color}`}>
                                            {badge.label}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Full Ranking */}
            <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b">
                    <h3 className="font-bold flex items-center gap-2">
                        <Medal size={18} className="text-teal-500" />
                        Full Rankings
                    </h3>
                </div>
                <div className="divide-y">
                    {leaderboardData.map((tl, i) => (
                        <div key={tl.id} className={`flex items-center gap-4 p-4 hover:bg-muted/20 transition-colors ${i < 3 ? 'bg-amber-50/30' : ''}`}>
                            <div className="w-8 flex-shrink-0">{getRankIcon(i)}</div>
                            <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold border border-teal-200 flex-shrink-0">
                                {tl.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold truncate">{tl.name}</p>
                                <p className="text-[10px] text-muted-foreground">{tl.email}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="text-right">
                                    <p className="font-black text-teal-600">{getMetricValue(tl)}</p>
                                    <p className="text-[9px] text-muted-foreground">{tl.activeRiders} riders • {tl.leads} leads</p>
                                </div>
                                <div className="flex flex-wrap gap-1 max-w-[120px]">
                                    {getBadges(tl, i).slice(0, 2).map((badge, j) => (
                                        <span key={j} className={`text-[7px] font-black px-1 py-0.5 rounded ${badge.color} whitespace-nowrap`}>
                                            {badge.label}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                    {leaderboardData.length === 0 && (
                        <div className="p-8 text-center text-muted-foreground">No team leaders found</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RMLeaderboard;
