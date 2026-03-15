import React, { useMemo, useState } from 'react';
import { useRMTeamData } from '@/hooks/useRMTeamData';
import { BarChart3, Download, Search } from 'lucide-react';
import { supabase } from '@/config/supabase';

const RMTLPerformance: React.FC = () => {
    const { teamLeaders, riders, leads, loading } = useRMTeamData();
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<'collection' | 'riders' | 'leads' | 'name'>('collection');
    const [dailyCollections, setDailyCollections] = useState<Record<string, number>>({});
    const [weeklyCollections, setWeeklyCollections] = useState<Record<string, number>>({});

    React.useEffect(() => {
        if (teamLeaders.length === 0) return;
        const tlIds = teamLeaders.map(tl => tl.id);
        const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekStart = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(weekAgo);

        const fetch = async () => {
            const { data } = await supabase
                .from('daily_collections')
                .select('team_leader_id, total_collection, date')
                .in('team_leader_id', tlIds)
                .gte('date', weekStart)
                .lte('date', today);

            if (data) {
                const daily: Record<string, number> = {};
                const weekly: Record<string, number> = {};
                data.forEach((d: any) => {
                    const amt = Number(d.total_collection) || 0;
                    if (d.date === today) daily[d.team_leader_id] = (daily[d.team_leader_id] || 0) + amt;
                    weekly[d.team_leader_id] = (weekly[d.team_leader_id] || 0) + amt;
                });
                setDailyCollections(daily);
                setWeeklyCollections(weekly);
            }
        };
        fetch();
    }, [teamLeaders]);

    const performanceData = useMemo(() => {
        return teamLeaders
            .filter(tl => tl.status === 'active')
            .map(tl => {
                const tlRiders = riders.filter(r => r.teamLeaderId === tl.id);
                const activeRiders = tlRiders.filter(r => r.status === 'active').length;
                const inactiveRiders = tlRiders.filter(r => r.status === 'inactive').length;
                const tlLeads = leads.filter(l => l.createdBy === tl.id);
                const converted = tlLeads.filter(l => l.status === 'Convert').length;
                const positiveWallet = tlRiders.filter(r => r.status === 'active' && r.walletAmount > 0).reduce((s, r) => s + r.walletAmount, 0);
                const negativeWallet = tlRiders.filter(r => r.status === 'active' && r.walletAmount < 0).reduce((s, r) => s + r.walletAmount, 0);
                const criticalDebt = tlRiders.filter(r => r.status === 'active' && r.walletAmount < -3000).length;

                return {
                    id: tl.id,
                    name: tl.fullName,
                    email: tl.email,
                    activeRiders,
                    totalRiders: tlRiders.length,
                    inactiveRiders,
                    dailyCollection: dailyCollections[tl.id] || 0,
                    weeklyCollection: weeklyCollections[tl.id] || 0,
                    leadsTotal: tlLeads.length,
                    convertedLeads: converted,
                    conversionRate: tlLeads.length > 0 ? Math.round((converted / tlLeads.length) * 100) : 0,
                    positiveWallet,
                    negativeWallet,
                    criticalDebt,
                    avgCollection: activeRiders > 0 ? Math.round((dailyCollections[tl.id] || 0) / activeRiders) : 0
                };
            })
            .filter(tl => {
                if (!searchTerm) return true;
                const term = searchTerm.toLowerCase();
                return tl.name.toLowerCase().includes(term) || tl.email.toLowerCase().includes(term);
            })
            .sort((a, b) => {
                switch (sortBy) {
                    case 'collection': return b.dailyCollection - a.dailyCollection;
                    case 'riders': return b.activeRiders - a.activeRiders;
                    case 'leads': return b.leadsTotal - a.leadsTotal;
                    case 'name': return a.name.localeCompare(b.name);
                    default: return 0;
                }
            });
    }, [teamLeaders, riders, leads, dailyCollections, weeklyCollections, searchTerm, sortBy]);

    const exportCSV = () => {
        const headers = ['Name', 'Email', 'Active Riders', 'Total Riders', 'Daily Collection', 'Weekly Collection', 'Leads', 'Converted', 'Conversion %', 'Positive Wallet', 'Negative Wallet', 'Critical Debt'];
        const rows = performanceData.map(d => [d.name, d.email, d.activeRiders, d.totalRiders, d.dailyCollection, d.weeklyCollection, d.leadsTotal, d.convertedLeads, d.conversionRate + '%', d.positiveWallet, d.negativeWallet, d.criticalDebt]);
        const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tl_performance_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <BarChart3 className="text-teal-500" size={24} />
                        Team Leader Performance
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">Performance metrics for your {performanceData.length} team leaders</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                        <input
                            type="text"
                            placeholder="Search TL..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2 text-sm border rounded-lg bg-background focus:ring-2 focus:ring-teal-500/20 outline-none w-48"
                        />
                    </div>

                    <select
                        value={sortBy}
                        onChange={(e: any) => setSortBy(e.target.value)}
                        className="px-3 py-2 text-sm border rounded-lg bg-background cursor-pointer outline-none focus:ring-2 focus:ring-teal-500/20"
                    >
                        <option value="collection">Sort by Collection</option>
                        <option value="riders">Sort by Riders</option>
                        <option value="leads">Sort by Leads</option>
                        <option value="name">Sort by Name</option>
                    </select>

                    <button onClick={exportCSV} className="px-3 py-2 text-sm border rounded-lg hover:bg-accent transition-colors flex items-center gap-1.5">
                        <Download size={14} /> Export
                    </button>
                </div>
            </div>

            {/* Performance Table */}
            <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-auto max-h-[70vh]">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-card z-10 shadow-sm">
                            <tr className="text-left border-b">
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest min-w-[200px]">Team Leader</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">Riders (A/I/T)</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">Daily Collection</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">Weekly Collection</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">Avg/Rider</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">Wallet</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">Leads</th>
                            </tr>
                        </thead>
                        <tbody>
                            {performanceData.map((tl, i) => (
                                <tr key={tl.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                                    <td className="p-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-sm border border-teal-200">
                                                {i + 1}
                                            </div>
                                            <div>
                                                <p className="font-semibold">{tl.name}</p>
                                                <p className="text-[10px] text-muted-foreground">{tl.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-3">
                                        <span className="font-bold text-emerald-600">{tl.activeRiders}</span>
                                        <span className="text-muted-foreground"> / </span>
                                        <span className="text-rose-500">{tl.inactiveRiders}</span>
                                        <span className="text-muted-foreground"> / </span>
                                        <span>{tl.totalRiders}</span>
                                    </td>
                                    <td className="p-3 font-black text-emerald-600">₹{tl.dailyCollection.toLocaleString()}</td>
                                    <td className="p-3 font-bold">₹{tl.weeklyCollection.toLocaleString()}</td>
                                    <td className="p-3 font-bold text-indigo-600">₹{tl.avgCollection.toLocaleString()}</td>
                                    <td className="p-3">
                                        <div className="space-y-0.5">
                                            <div className="text-[10px] font-bold text-emerald-500">+₹{tl.positiveWallet.toLocaleString()}</div>
                                            <div className="text-[10px] font-bold text-rose-500">-₹{Math.abs(tl.negativeWallet).toLocaleString()}</div>
                                            {tl.criticalDebt > 0 && (
                                                <div className="text-[9px] font-black text-rose-600 bg-rose-50 px-1 py-0.5 rounded inline-block">
                                                    {tl.criticalDebt} CRITICAL
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-3">
                                        <div>
                                            <span className="font-bold">{tl.leadsTotal}</span>
                                            <span className="text-muted-foreground"> • </span>
                                            <span className="text-emerald-500 font-bold">{tl.convertedLeads} converted</span>
                                            <p className="text-[10px] text-indigo-500 font-bold">{tl.conversionRate}% rate</p>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {performanceData.length === 0 && (
                                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No team leaders found</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default RMTLPerformance;
