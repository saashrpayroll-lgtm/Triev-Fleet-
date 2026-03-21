import React, { useMemo, useState } from 'react';
import { useRMTeamData } from '@/hooks/useRMTeamData';
import { FileText, Download, TrendingUp, Users, Target, Wallet } from 'lucide-react';
import { supabase } from '@/config/supabase';

const RMReports: React.FC = () => {
    const { teamLeaders, riders, leads, loading } = useRMTeamData();
    const [period, setPeriod] = useState<'today' | 'yesterday' | 'week' | 'month' | 'total' | 'custom'>('this_month' as any); // fallback initial, but we'll use 'month'
    const [customDate, setCustomDate] = useState({ start: '', end: '' });
    const [dailyData, setDailyData] = useState<any[]>([]);

    React.useEffect(() => {
        if (teamLeaders.length === 0) return;
        const tlIds = teamLeaders.map(tl => tl.id);
        const now = new Date();
        const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
        let startDate: string;
        let endDate: string = todayStr;

        if (period === 'today') {
            startDate = todayStr;
        } else if (period === 'yesterday') {
            const d = new Date(); d.setDate(d.getDate() - 1);
            startDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
            endDate = startDate;
        } else if (period === 'week') {
            const d = new Date(); d.setDate(d.getDate() - 7);
            startDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
        } else if (period === 'month' || period as any === 'this_month') {
            const d = new Date(); d.setDate(d.getDate() - 30);
            startDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
        } else if (period === 'total') {
            startDate = '2000-01-01';
        } else if (period === 'custom' && customDate.start && customDate.end) {
            startDate = customDate.start;
            endDate = customDate.end;
        } else {
            startDate = todayStr;
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
    }, [teamLeaders, period, customDate]);

    // Date filter helper
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
        if (period === 'month' || period as any === 'this_month') return d >= monthStart && d <= today;
        if (period === 'total') return true;
        if (period === 'custom') {
            if (!customDate.start || !customDate.end) return true;
            return d >= customDate.start && d <= customDate.end;
        }
        return true;
    };

    const reportData = useMemo(() => {
        const totalCollection = dailyData.reduce((s, d) => s + (Number(d.total_collection) || 0), 0);
        const activeTLs = teamLeaders.filter(tl => tl.status === 'active').length;
        const activeRiders = riders.filter(r => r.status === 'active').length;
        
        const filteredLeads = leads.filter(l => isDateInRange(l.createdAt));
        const totalLeads = filteredLeads.length;
        const convertedLeads = filteredLeads.filter(l => l.status === 'Convert').length;
        const positiveWallet = riders.filter(r => r.status === 'active' && r.walletAmount > 0).reduce((s, r) => s + r.walletAmount, 0);
        const negativeWallet = riders.filter(r => r.status === 'active' && r.walletAmount < 0).reduce((s, r) => s + r.walletAmount, 0);

        // Per TL breakdown
        const tlBreakdown = teamLeaders
            .filter(tl => tl.status === 'active')
            .map(tl => {
                const tlCollection = dailyData.filter(d => d.team_leader_id === tl.id).reduce((s, d) => s + (Number(d.total_collection) || 0), 0);
                const tlRiders = riders.filter(r => r.teamLeaderId === tl.id);
                const tlActive = tlRiders.filter(r => r.status === 'active').length;
                const tlLeads = filteredLeads.filter(l => l.createdBy === tl.id);
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
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex flex-wrap gap-1 bg-muted rounded-lg p-0.5">
                        {(['today', 'yesterday', 'week', 'month', 'total', 'custom'] as const).map(p => (
                            <button key={p} onClick={() => setPeriod(p)}
                                className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition-all ${period === p ? 'bg-teal-500 text-white shadow' : 'hover:bg-accent'}`}>
                                {p.charAt(0).toUpperCase() + p.slice(1)}
                            </button>
                        ))}
                    </div>
                    {period === 'custom' && (
                        <div className="flex items-center gap-2 animate-in slide-in-from-right-4 duration-300">
                            <input type="date" value={customDate.start} onChange={e => setCustomDate(prev => ({ ...prev, start: e.target.value }))}
                                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-background border border-border outline-none focus:ring-2 focus:ring-teal-500/20" />
                            <span className="text-muted-foreground">-</span>
                            <input type="date" value={customDate.end} onChange={e => setCustomDate(prev => ({ ...prev, end: e.target.value }))}
                                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-background border border-border outline-none focus:ring-2 focus:ring-teal-500/20" />
                        </div>
                    )}
                    <button onClick={exportReport} className="ml-auto px-3 py-2 text-sm border rounded-lg hover:bg-accent transition-colors flex items-center gap-1.5 font-medium whitespace-nowrap">
                        <Download size={14} /> Export
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
