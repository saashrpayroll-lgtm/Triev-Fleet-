import React, { useMemo, useState } from 'react';
import { useRMTeamData } from '@/hooks/useRMTeamData';
import { Wallet, Download, Calendar } from 'lucide-react';
import { supabase } from '@/config/supabase';
import { getHistoricalActiveCount } from '@/utils/performance';

const RMCollectionHistory: React.FC = () => {
    const { teamLeaders, riders, loading: teamLoading } = useRMTeamData();
    const [collections, setCollections] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [days, setDays] = useState(7);
    const [filterTL, setFilterTL] = useState('all');
    const [searchTL] = useState('');

    React.useEffect(() => {
        if (teamLeaders.length === 0) return;
        const tlIds = teamLeaders.map(tl => tl.id);
        const endDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
        const startD = new Date();
        startD.setDate(startD.getDate() - days);
        const startDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(startD);

        const fetch = async () => {
            setLoading(true);
            const { data } = await supabase
                .from('daily_collections')
                .select('team_leader_id, total_collection, date, active_riders_count')
                .in('team_leader_id', tlIds)
                .gte('date', startDate)
                .lte('date', endDate)
                .order('date', { ascending: false });
            setCollections(data || []);
            setLoading(false);
        };
        fetch();
    }, [teamLeaders, days]);

    // Group by date
    const dateGroups = useMemo(() => {
        const groups: Record<string, { total: number; tls: { id: string; name: string; collection: number; riders: number }[] }> = {};
        const tlMap = new Map(teamLeaders.map(tl => [tl.id, tl.fullName]));

        let filteredCollections = collections;
        if (filterTL !== 'all') {
            filteredCollections = collections.filter(c => c.team_leader_id === filterTL);
        }

        filteredCollections.forEach(c => {
            const date = c.date;
            if (!groups[date]) groups[date] = { total: 0, tls: [] };
            const amt = Number(c.total_collection) || 0;
            groups[date].total += amt;

            const tlRiders = riders.filter(r => r.teamLeaderId === c.team_leader_id);
            const liveCount = getHistoricalActiveCount(tlRiders, date);
            const tlName = tlMap.get(c.team_leader_id) || 'Unknown';

            if (searchTL && !tlName.toLowerCase().includes(searchTL.toLowerCase())) return;

            groups[date].tls.push({
                id: c.team_leader_id,
                name: tlName,
                collection: amt,
                riders: liveCount > 0 ? liveCount : (Number(c.active_riders_count) || 0)
            });
        });

        Object.values(groups).forEach(g => g.tls.sort((a, b) => b.collection - a.collection));

        return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
    }, [collections, teamLeaders, riders, filterTL, searchTL]);

    const grandTotal = useMemo(() => dateGroups.reduce((s, [, g]) => s + g.total, 0), [dateGroups]);
    const avgDaily = useMemo(() => dateGroups.length > 0 ? Math.round(grandTotal / dateGroups.length) : 0, [grandTotal, dateGroups]);

    const exportCSV = () => {
        const rows = [['Date', 'Team Leader', 'Collection', 'Active Riders']];
        dateGroups.forEach(([date, g]) => {
            g.tls.forEach(tl => rows.push([date, tl.name, tl.collection.toString(), tl.riders.toString()]));
        });
        const csv = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `collection_history_${days}d_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    if (teamLoading || loading) {
        return <div className="flex items-center justify-center min-h-[60vh]"><div className="text-center space-y-3"><div className="w-12 h-12 border-3 border-teal-500/30 border-t-teal-500 rounded-full animate-spin mx-auto" /><p className="text-sm text-muted-foreground">Loading collections...</p></div></div>;
    }

    return (
        <div className="space-y-5 animate-in fade-in duration-500">
            {/* Header */}
            <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 rounded-2xl p-5 text-white shadow-xl">
                <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-white/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/4 pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-black flex items-center gap-2.5">
                            <div className="p-2 bg-white/15 rounded-xl backdrop-blur-sm"><Wallet size={22} /></div>
                            Collection History
                        </h1>
                        <p className="text-emerald-100 mt-1 text-sm">Date-wise collection tracking for your team</p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/20">
                            <p className="text-[8px] font-black uppercase tracking-wider text-emerald-200">Total ({days}d)</p>
                            <p className="text-xl font-black">₹{grandTotal.toLocaleString()}</p>
                        </div>
                        <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/20">
                            <p className="text-[8px] font-black uppercase tracking-wider text-emerald-200">Avg/Day</p>
                            <p className="text-xl font-black">₹{avgDaily.toLocaleString()}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex gap-1 bg-muted rounded-xl p-0.5">
                    {[7, 14, 30].map(d => (
                        <button key={d} onClick={() => setDays(d)}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${days === d ? 'bg-emerald-500 text-white shadow-md' : 'hover:bg-accent'}`}>
                            {d} Days
                        </button>
                    ))}
                </div>
                <select value={filterTL} onChange={(e) => setFilterTL(e.target.value)}
                    className="px-3 py-2.5 rounded-2xl text-sm font-bold bg-background border border-border/60 cursor-pointer outline-none">
                    <option value="all">All TLs</option>
                    {teamLeaders.filter(tl => tl.status === 'active').map(tl => <option key={tl.id} value={tl.id}>{tl.fullName}</option>)}
                </select>
                <button onClick={exportCSV} className="px-4 py-2.5 text-sm border border-border/60 rounded-2xl hover:bg-accent transition-colors flex items-center gap-2 font-bold ml-auto">
                    <Download size={15} /> Export
                </button>
            </div>

            {/* Date Groups */}
            <div className="space-y-3">
                {dateGroups.map(([date, group]) => (
                    <div key={date} className="bg-card border border-border/40 rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-all">
                        <div className="p-3 border-b border-border/30 bg-gradient-to-r from-emerald-500/5 via-transparent to-teal-500/5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-emerald-500/10 rounded-lg"><Calendar size={13} className="text-emerald-600" /></div>
                                <span className="font-bold text-sm">
                                    {new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                                <span className="text-[10px] text-muted-foreground">({group.tls.length} TLs)</span>
                            </div>
                            <span className="font-black text-emerald-600 text-lg">₹{group.total.toLocaleString()}</span>
                        </div>
                        <div className="divide-y divide-border/30">
                            {group.tls.map((tl, i) => (
                                <div key={`${tl.id}-${i}`} className="flex items-center justify-between p-3 hover:bg-muted/10 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400 font-bold text-xs border border-emerald-200 dark:border-emerald-800/30">
                                            {tl.name.charAt(0)}
                                        </div>
                                        <span className="text-sm font-medium">{tl.name}</span>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm">
                                        <span className="text-muted-foreground text-xs">{tl.riders} riders</span>
                                        <span className="font-bold text-emerald-600 min-w-[80px] text-right">₹{tl.collection.toLocaleString()}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
                {dateGroups.length === 0 && (
                    <div className="bg-card border rounded-2xl p-12 text-center text-muted-foreground">
                        <Calendar size={32} className="mx-auto mb-3 opacity-20" />
                        <p className="font-medium">No collection data found</p>
                        <p className="text-xs mt-1">Try selecting a different period or TL filter</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RMCollectionHistory;
