import React, { useMemo, useState } from 'react';
import { useRMTeamData } from '@/hooks/useRMTeamData';
import { FileText, Download, TrendingUp, Users, Target, Wallet } from 'lucide-react';
import { supabase } from '@/config/supabase';

const RMReports: React.FC = () => {
    const { teamLeaders, riders, leads, loading } = useRMTeamData();
    const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week');
    const [dailyData, setDailyData] = useState<any[]>([]);

    React.useEffect(() => {
        if (teamLeaders.length === 0) return;
        const tlIds = teamLeaders.map(tl => tl.id);
        const now = new Date();
        let startDate: string;
        const endDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);

        if (period === 'today') {
            startDate = endDate;
        } else if (period === 'week') {
            const d = new Date(); d.setDate(d.getDate() - 7);
            startDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
        } else {
            const d = new Date(); d.setDate(d.getDate() - 30);
            startDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
        }

        const fetch = async () => {
            const { data } = await supabase
                .from('daily_collections')
                .select('team_leader_id, total_collection, date, active_riders_count')
                .in('team_leader_id', tlIds)
                .gte('date', startDate)
                .lte('date', endDate)
                .order('date', { ascending: false });
            setDailyData(data || []);
        };
        fetch();
    }, [teamLeaders, period]);

    const reportData = useMemo(() => {
        const totalCollection = dailyData.reduce((s, d) => s + (Number(d.total_collection) || 0), 0);
        const activeTLs = teamLeaders.filter(tl => tl.status === 'active').length;
        const activeRiders = riders.filter(r => r.status === 'active').length;
        const totalLeads = leads.length;
        const convertedLeads = leads.filter(l => l.status === 'Convert').length;
        const positiveWallet = riders.filter(r => r.status === 'active' && r.walletAmount > 0).reduce((s, r) => s + r.walletAmount, 0);
        const negativeWallet = riders.filter(r => r.status === 'active' && r.walletAmount < 0).reduce((s, r) => s + r.walletAmount, 0);

        // Per TL breakdown
        const tlBreakdown = teamLeaders
            .filter(tl => tl.status === 'active')
            .map(tl => {
                const tlCollection = dailyData.filter(d => d.team_leader_id === tl.id).reduce((s, d) => s + (Number(d.total_collection) || 0), 0);
                const tlRiders = riders.filter(r => r.teamLeaderId === tl.id);
                const tlActive = tlRiders.filter(r => r.status === 'active').length;
                const tlLeads = leads.filter(l => l.createdBy === tl.id);
                const tlConverted = tlLeads.filter(l => l.status === 'Convert').length;
                return {
                    name: tl.fullName, collection: tlCollection, activeRiders: tlActive,
                    totalRiders: tlRiders.length, leads: tlLeads.length, converted: tlConverted
                };
            })
            .sort((a, b) => b.collection - a.collection);

        return { totalCollection, activeTLs, activeRiders, totalLeads, convertedLeads, positiveWallet, negativeWallet, tlBreakdown };
    }, [dailyData, teamLeaders, riders, leads]);

    const exportReport = () => {
        const lines = [
            `RM Team Report — ${period === 'today' ? 'Today' : period === 'week' ? 'Last 7 Days' : 'Last 30 Days'}`,
            `Generated: ${new Date().toLocaleString('en-IN')}`,
            '',
            `Total Collection: ₹${reportData.totalCollection.toLocaleString()}`,
            `Active TLs: ${reportData.activeTLs}`,
            `Active Riders: ${reportData.activeRiders}`,
            `Total Leads: ${reportData.totalLeads}`,
            `Converted: ${reportData.convertedLeads}`,
            `Wallet Positive: ₹${reportData.positiveWallet.toLocaleString()}`,
            `Wallet Negative: ₹${Math.abs(reportData.negativeWallet).toLocaleString()}`,
            '',
            'TL Breakdown:',
            'Name,Collection,Active Riders,Total Riders,Leads,Converted',
            ...reportData.tlBreakdown.map(tl => `${tl.name},${tl.collection},${tl.activeRiders},${tl.totalRiders},${tl.leads},${tl.converted}`)
        ];
        const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rm_report_${period}_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    if (loading) {
        return <div className="flex items-center justify-center min-h-[60vh]"><div className="w-10 h-10 border-3 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" /></div>;
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="text-teal-500" size={24} /> Reports</h1>
                    <p className="text-sm text-muted-foreground mt-1">Team performance summary and analytics</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex gap-1 bg-muted rounded-lg p-0.5">
                        {(['today', 'week', 'month'] as const).map(p => (
                            <button key={p} onClick={() => setPeriod(p)}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${period === p ? 'bg-teal-500 text-white shadow' : 'hover:bg-accent'}`}>
                                {p === 'today' ? 'Today' : p === 'week' ? '7 Days' : '30 Days'}
                            </button>
                        ))}
                    </div>
                    <button onClick={exportReport} className="px-3 py-2 text-sm border rounded-lg hover:bg-accent transition-colors flex items-center gap-1.5 font-medium">
                        <Download size={14} /> Download Report
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-card border rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2"><TrendingUp size={16} className="text-emerald-500" /><span className="text-[10px] font-bold text-muted-foreground uppercase">Collection</span></div>
                    <p className="text-2xl font-black text-emerald-600">₹{reportData.totalCollection.toLocaleString()}</p>
                </div>
                <div className="bg-card border rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2"><Users size={16} className="text-indigo-500" /><span className="text-[10px] font-bold text-muted-foreground uppercase">Active Fleet</span></div>
                    <p className="text-2xl font-black">{reportData.activeRiders}</p>
                </div>
                <div className="bg-card border rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2"><Target size={16} className="text-violet-500" /><span className="text-[10px] font-bold text-muted-foreground uppercase">Leads</span></div>
                    <p className="text-2xl font-black">{reportData.totalLeads} <span className="text-sm text-emerald-500">(+{reportData.convertedLeads})</span></p>
                </div>
                <div className="bg-card border rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2"><Wallet size={16} className="text-orange-500" /><span className="text-[10px] font-bold text-muted-foreground uppercase">Net Wallet</span></div>
                    <p className={`text-2xl font-black ${(reportData.positiveWallet + reportData.negativeWallet) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        ₹{(reportData.positiveWallet + reportData.negativeWallet).toLocaleString()}
                    </p>
                </div>
            </div>

            {/* TL Breakdown Table */}
            <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b"><h3 className="font-bold">Team Leader Breakdown</h3></div>
                <div className="overflow-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left border-b">
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">#</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">Team Leader</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">Collection</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">Active Riders</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">Leads</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">Converted</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reportData.tlBreakdown.map((tl, i) => (
                                <tr key={i} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                                    <td className="p-3 font-bold text-muted-foreground">{i + 1}</td>
                                    <td className="p-3 font-semibold">{tl.name}</td>
                                    <td className="p-3 font-black text-emerald-600">₹{tl.collection.toLocaleString()}</td>
                                    <td className="p-3">{tl.activeRiders} <span className="text-muted-foreground">/ {tl.totalRiders}</span></td>
                                    <td className="p-3">{tl.leads}</td>
                                    <td className="p-3 font-bold text-emerald-600">{tl.converted}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default RMReports;
