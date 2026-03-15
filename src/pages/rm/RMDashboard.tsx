import React, { useMemo } from 'react';
import { useRMTeamData } from '@/hooks/useRMTeamData';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import {
    Users, TrendingUp, Wallet, Target, BarChart3,
    Trophy, ArrowRight, Activity
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/config/supabase';

const RMDashboard: React.FC = () => {
    const { userData } = useSupabaseAuth();
    const { teamLeaders, riders, leads, loading } = useRMTeamData();

    // Daily collections
    const [dailyCollections, setDailyCollections] = React.useState<Record<string, number>>({});

    React.useEffect(() => {
        if (teamLeaders.length === 0) return;
        const tlIds = teamLeaders.map(tl => tl.id);
        const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

        const fetchCollections = async () => {
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
        fetchCollections();
    }, [teamLeaders]);

    // Computed metrics
    const metrics = useMemo(() => {
        const activeTLs = teamLeaders.filter(tl => tl.status === 'active').length;
        const totalRiders = riders.length;
        const activeRiders = riders.filter(r => r.status === 'active').length;
        const inactiveRiders = riders.filter(r => r.status === 'inactive').length;

        const totalWallet = riders.filter(r => r.status === 'active').reduce((s, r) => s + (r.walletAmount || 0), 0);
        const positiveWallet = riders.filter(r => r.status === 'active' && r.walletAmount > 0).reduce((s, r) => s + r.walletAmount, 0);
        const negativeWallet = riders.filter(r => r.status === 'active' && r.walletAmount < 0).reduce((s, r) => s + r.walletAmount, 0);

        const todayCollection = Object.values(dailyCollections).reduce((s, v) => s + v, 0);

        const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
        const todayLeads = leads.filter(l => {
            const d = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(l.createdAt));
            return d === todayStr;
        }).length;

        const convertedLeads = leads.filter(l => l.status === 'Convert').length;
        const conversionRate = leads.length > 0 ? Math.round((convertedLeads / leads.length) * 100) : 0;

        const criticalDebt = riders.filter(r => r.status === 'active' && r.walletAmount < -3000).length;

        return {
            activeTLs, totalRiders, activeRiders, inactiveRiders,
            totalWallet, positiveWallet, negativeWallet,
            todayCollection, todayLeads, convertedLeads, conversionRate, criticalDebt
        };
    }, [teamLeaders, riders, leads, dailyCollections]);

    // Top 5 TL performance
    const topTLs = useMemo(() => {
        return teamLeaders
            .filter(tl => tl.status === 'active')
            .map(tl => {
                const tlRiders = riders.filter(r => r.teamLeaderId === tl.id);
                const active = tlRiders.filter(r => r.status === 'active').length;
                const collection = dailyCollections[tl.id] || 0;
                return { ...tl, activeRiders: active, totalRiders: tlRiders.length, todayCollection: collection };
            })
            .sort((a, b) => b.todayCollection - a.todayCollection)
            .slice(0, 5);
    }, [teamLeaders, riders, dailyCollections]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-3 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
                    <span className="text-sm text-muted-foreground">Loading your team data...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Welcome Header */}
            <div className="bg-gradient-to-r from-teal-600 to-teal-500 rounded-2xl p-6 text-white shadow-lg">
                <h1 className="text-2xl font-bold">Welcome back, {userData?.fullName || 'Manager'} 👋</h1>
                <p className="text-teal-100 mt-1">
                    You're managing <span className="font-bold text-white">{metrics.activeTLs} Team Leaders</span> with{' '}
                    <span className="font-bold text-white">{metrics.activeRiders} active riders</span>
                </p>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Team Leaders */}
                <div className="bg-card border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-teal-500/10 rounded-lg"><Users size={18} className="text-teal-500" /></div>
                        <span className="text-xs font-bold text-muted-foreground uppercase">Team Leaders</span>
                    </div>
                    <p className="text-2xl font-black">{metrics.activeTLs}</p>
                    <p className="text-xs text-muted-foreground">Active supervisors</p>
                </div>

                {/* Active Riders */}
                <div className="bg-card border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-indigo-500/10 rounded-lg"><Activity size={18} className="text-indigo-500" /></div>
                        <span className="text-xs font-bold text-muted-foreground uppercase">Active Fleet</span>
                    </div>
                    <p className="text-2xl font-black">{metrics.activeRiders} <span className="text-sm font-normal text-muted-foreground">/ {metrics.totalRiders}</span></p>
                    <p className="text-xs text-muted-foreground">{metrics.inactiveRiders} inactive</p>
                </div>

                {/* Today's Collection */}
                <div className="bg-card border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-emerald-500/10 rounded-lg"><TrendingUp size={18} className="text-emerald-500" /></div>
                        <span className="text-xs font-bold text-muted-foreground uppercase">Today's Collection</span>
                    </div>
                    <p className="text-2xl font-black text-emerald-600">₹{metrics.todayCollection.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Across all TLs</p>
                </div>

                {/* Wallet Health */}
                <div className="bg-card border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-orange-500/10 rounded-lg"><Wallet size={18} className="text-orange-500" /></div>
                        <span className="text-xs font-bold text-muted-foreground uppercase">Wallet Health</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-sm font-bold text-emerald-500">+₹{metrics.positiveWallet.toLocaleString()}</span>
                        <span className="text-sm font-bold text-rose-500">-₹{Math.abs(metrics.negativeWallet).toLocaleString()}</span>
                    </div>
                    {metrics.criticalDebt > 0 && (
                        <p className="text-xs text-rose-500 font-bold mt-1 animate-pulse">⚠ {metrics.criticalDebt} critical debt riders</p>
                    )}
                </div>
            </div>

            {/* Second Row */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {/* Leads */}
                <div className="bg-card border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-violet-500/10 rounded-lg"><Target size={18} className="text-violet-500" /></div>
                        <span className="text-xs font-bold text-muted-foreground uppercase">Leads</span>
                    </div>
                    <p className="text-2xl font-black">{leads.length}</p>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-bold text-indigo-500">+{metrics.todayLeads} today</span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs font-bold text-emerald-500">{metrics.conversionRate}% conversion</span>
                    </div>
                </div>

                {/* Conversion */}
                <div className="bg-card border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-emerald-500/10 rounded-lg"><BarChart3 size={18} className="text-emerald-500" /></div>
                        <span className="text-xs font-bold text-muted-foreground uppercase">Converted</span>
                    </div>
                    <p className="text-2xl font-black text-emerald-600">{metrics.convertedLeads}</p>
                    <p className="text-xs text-muted-foreground">From {leads.length} total leads</p>
                </div>

                {/* Quick Links */}
                <div className="bg-card border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow col-span-2 md:col-span-1">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 bg-teal-500/10 rounded-lg"><Trophy size={18} className="text-teal-500" /></div>
                        <span className="text-xs font-bold text-muted-foreground uppercase">Quick Links</span>
                    </div>
                    <div className="space-y-2">
                        <Link to="/rm-panel/tl-performance" className="flex items-center justify-between text-sm hover:text-teal-600 transition-colors group">
                            <span>TL Performance</span>
                            <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                        <Link to="/rm-panel/leaderboard" className="flex items-center justify-between text-sm hover:text-teal-600 transition-colors group">
                            <span>Leaderboard</span>
                            <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                        <Link to="/rm-panel/reports" className="flex items-center justify-between text-sm hover:text-teal-600 transition-colors group">
                            <span>Reports</span>
                            <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                    </div>
                </div>
            </div>

            {/* Top TLs Table */}
            <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b flex items-center justify-between">
                    <div>
                        <h3 className="font-bold text-lg flex items-center gap-2">
                            <Trophy size={18} className="text-teal-500" />
                            Top Performers Today
                        </h3>
                        <p className="text-xs text-muted-foreground">Based on today's collection</p>
                    </div>
                    <Link to="/rm-panel/tl-performance" className="text-sm font-bold text-teal-600 hover:text-teal-700 hover:bg-teal-50 px-3 py-1 rounded-full border border-teal-100 transition-all flex items-center gap-1">
                        View All <ArrowRight size={14} />
                    </Link>
                </div>
                <div className="overflow-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left border-b">
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">#</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">Team Leader</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">Active Riders</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">Today's Collection</th>
                            </tr>
                        </thead>
                        <tbody>
                            {topTLs.map((tl, i) => (
                                <tr key={tl.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                                    <td className="p-3">
                                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-100 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-muted text-muted-foreground'
                                            }`}>{i + 1}</span>
                                    </td>
                                    <td className="p-3">
                                        <div>
                                            <p className="font-semibold">{tl.fullName}</p>
                                            <p className="text-[10px] text-muted-foreground">{tl.email}</p>
                                        </div>
                                    </td>
                                    <td className="p-3 font-bold">{tl.activeRiders} <span className="text-xs font-normal text-muted-foreground">/ {tl.totalRiders}</span></td>
                                    <td className="p-3 font-black text-emerald-600">₹{tl.todayCollection.toLocaleString()}</td>
                                </tr>
                            ))}
                            {topTLs.length === 0 && (
                                <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No active team leaders found</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default RMDashboard;
