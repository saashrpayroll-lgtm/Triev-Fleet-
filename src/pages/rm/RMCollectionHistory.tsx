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
        const groups: Record<string, { total: number; tls: { name: string; collection: number; riders: number }[] }> = {};
        const tlMap = new Map(teamLeaders.map(tl => [tl.id, tl.fullName]));

        collections.forEach(c => {
            const date = c.date;
            if (!groups[date]) groups[date] = { total: 0, tls: [] };
            const amt = Number(c.total_collection) || 0;
            groups[date].total += amt;
            
            // Recompute active count from riders to fix any stale db cache mismatches
            const tlRiders = riders.filter(r => r.teamLeaderId === c.team_leader_id);
            const liveCount = getHistoricalActiveCount(tlRiders, date);

            groups[date].tls.push({
                name: tlMap.get(c.team_leader_id) || 'Unknown',
                collection: amt,
                riders: liveCount > 0 ? liveCount : (Number(c.active_riders_count) || 0)
            });
        });

        // Sort TLs within each date
        Object.values(groups).forEach(g => g.tls.sort((a, b) => b.collection - a.collection));

        return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
    }, [collections, teamLeaders]);

    const grandTotal = useMemo(() => dateGroups.reduce((s, [, g]) => s + g.total, 0), [dateGroups]);

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
        return <div className="flex items-center justify-center min-h-[60vh]"><div className="w-10 h-10 border-3 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" /></div>;
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2"><Wallet className="text-teal-500" size={24} /> Collection History</h1>
                    <p className="text-sm text-muted-foreground mt-1">Date-wise collection tracking for your team</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex gap-1 bg-muted rounded-lg p-0.5">
                        {[7, 14, 30].map(d => (
                            <button key={d} onClick={() => setDays(d)}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${days === d ? 'bg-teal-500 text-white shadow' : 'hover:bg-accent'}`}>
                                {d} Days
                            </button>
                        ))}
                    </div>
                    <button onClick={exportCSV} className="px-3 py-2 text-sm border rounded-lg hover:bg-accent transition-colors flex items-center gap-1.5">
                        <Download size={14} /> Export
                    </button>
                </div>
            </div>

            {/* Grand Total */}
            <div className="bg-gradient-to-r from-teal-600 to-teal-500 rounded-xl p-4 text-white shadow-lg flex items-center justify-between">
                <div>
                    <p className="text-teal-100 text-xs font-bold uppercase">Total Collection ({days} days)</p>
                    <p className="text-3xl font-black">₹{grandTotal.toLocaleString()}</p>
                </div>
                <Calendar size={32} className="text-teal-200" />
            </div>

            {/* Date Groups */}
            <div className="space-y-4">
                {dateGroups.map(([date, group]) => (
                    <div key={date} className="bg-card border rounded-xl shadow-sm overflow-hidden">
                        <div className="p-3 border-b bg-muted/30 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Calendar size={14} className="text-muted-foreground" />
                                <span className="font-bold text-sm">{new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                            </div>
                            <span className="font-black text-emerald-600">₹{group.total.toLocaleString()}</span>
                        </div>
                        <div className="divide-y">
                            {group.tls.map((tl, i) => (
                                <div key={i} className="flex items-center justify-between p-3 hover:bg-muted/10 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-xs border border-teal-200">
                                            {tl.name.charAt(0)}
                                        </div>
                                        <span className="text-sm font-medium">{tl.name}</span>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm">
                                        <span className="text-muted-foreground text-xs">{tl.riders} riders</span>
                                        <span className="font-bold text-emerald-600">₹{tl.collection.toLocaleString()}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
                {dateGroups.length === 0 && (
                    <div className="bg-card border rounded-xl p-8 text-center text-muted-foreground">No collection data found for this period</div>
                )}
            </div>
        </div>
    );
};

export default RMCollectionHistory;
