import React, { useMemo } from 'react';
import { useRMTeamData } from '@/hooks/useRMTeamData';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import {
    Users, TrendingUp, Wallet, Target, BarChart3,
    Trophy, ArrowRight, Activity, Shield, AlertTriangle,
    Zap, Calendar
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

        const activeRidersList = riders.filter(r => r.status === 'active');
        const positiveWallet = activeRidersList.filter(r => r.walletAmount > 0).reduce((s, r) => s + r.walletAmount, 0);
        const negativeWallet = activeRidersList.filter(r => r.walletAmount < 0).reduce((s, r) => s + r.walletAmount, 0);
        const positiveCount = activeRidersList.filter(r => r.walletAmount > 0).length;

        const todayCollection = Object.values(dailyCollections).reduce((s, v) => s + v, 0);

        const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
        const todayLeads = leads.filter(l => {
            const d = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(l.createdAt));
            return d === todayStr;
        }).length;

        const convertedLeads = leads.filter(l => l.status === 'Convert').length;
        const conversionRate = leads.length > 0 ? Math.round((convertedLeads / leads.length) * 100) : 0;
        const criticalDebt = activeRidersList.filter(r => r.walletAmount < -3000).length;
        const fleetHealth = activeRiders > 0 ? Math.round((positiveCount / activeRiders) * 100) : 0;

        return {
            activeTLs, totalRiders, activeRiders, inactiveRiders,
            positiveWallet, negativeWallet,
            todayCollection, todayLeads, convertedLeads, conversionRate, criticalDebt,
            fleetHealth
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
                const avgPerRider = active > 0 ? Math.round(collection / active) : 0;
                return { ...tl, activeRiders: active, totalRiders: tlRiders.length, todayCollection: collection, avgPerRider };
            })
            .sort((a, b) => b.todayCollection - a.todayCollection)
            .slice(0, 5);
    }, [teamLeaders, riders, dailyCollections]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 border-3 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
                    <span className="text-sm text-muted-foreground font-medium">Loading your team data...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5 animate-in fade-in duration-500">
            {/* ── PREMIUM WELCOME HEADER ── */}
            <div className="relative overflow-hidden bg-gradient-to-br from-teal-600 via-teal-500 to-emerald-500 rounded-2xl p-6 text-white shadow-xl">
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-white/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/4 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-[250px] h-[250px] bg-emerald-300/20 rounded-full blur-[70px] translate-y-1/3 -translate-x-1/4 pointer-events-none" />
                <div className="absolute top-1/2 right-1/4 w-[150px] h-[150px] bg-teal-300/15 rounded-full blur-[40px] pointer-events-none" />
                
                <div className="relative z-10">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-teal-100 text-xs font-bold uppercase tracking-widest mb-1">Reporting Manager Panel</p>
                            <h1 className="text-2xl md:text-3xl font-black leading-tight">
                                Welcome back, {userData?.fullName || 'Manager'} 👋
                            </h1>
                            <p className="text-teal-100/90 mt-2 text-sm flex items-center gap-4 flex-wrap">
                                <span className="flex items-center gap-1.5">
                                    <Users size={14} /> <span className="font-bold text-white">{metrics.activeTLs}</span> Team Leaders
                                </span>
                                <span className="text-teal-200/40">•</span>
                                <span className="flex items-center gap-1.5">
                                    <Activity size={14} /> <span className="font-bold text-white">{metrics.activeRiders}</span> Active Riders
                                </span>
                                <span className="text-teal-200/40">•</span>
                                <span className="flex items-center gap-1.5">
                                    <Calendar size={14} /> {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                            </p>
                        </div>
                        {/* Fleet Health Badge */}
                        <div className="hidden md:flex flex-col items-center bg-white/15 backdrop-blur-sm rounded-2xl px-4 py-3 border border-white/20">
                            <p className="text-[9px] font-black uppercase tracking-widest text-teal-100 mb-1">Fleet Health</p>
                            <p className={`text-3xl font-black ${metrics.fleetHealth >= 70 ? 'text-white' : metrics.fleetHealth >= 40 ? 'text-amber-200' : 'text-rose-200'}`}>
                                {metrics.fleetHealth}%
                            </p>
                            <p className="text-[10px] text-teal-200">+ve wallet riders</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── KEY METRICS ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Team Leaders */}
                <div className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-teal-500/30 transition-all duration-300 group relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/5 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
                    <div className="relative">
                        <div className="flex items-center gap-2 mb-2.5">
                            <div className="p-2 bg-teal-500/10 rounded-xl group-hover:scale-110 group-hover:bg-teal-500/20 transition-all duration-300"><Users size={17} className="text-teal-500" /></div>
                            <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Team Leaders</span>
                        </div>
                        <p className="text-2xl font-black">{metrics.activeTLs}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Active supervisors</p>
                    </div>
                </div>

                {/* Active Fleet */}
                <div className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-indigo-500/30 transition-all duration-300 group relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
                    <div className="relative">
                        <div className="flex items-center gap-2 mb-2.5">
                            <div className="p-2 bg-indigo-500/10 rounded-xl group-hover:scale-110 group-hover:bg-indigo-500/20 transition-all duration-300"><Activity size={17} className="text-indigo-500" /></div>
                            <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Active Fleet</span>
                        </div>
                        <p className="text-2xl font-black">{metrics.activeRiders} <span className="text-sm font-normal text-muted-foreground">/ {metrics.totalRiders}</span></p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{metrics.inactiveRiders} inactive</p>
                    </div>
                </div>

                {/* Today's Collection */}
                <div className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-emerald-500/30 transition-all duration-300 group relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
                    <div className="relative">
                        <div className="flex items-center gap-2 mb-2.5">
                            <div className="p-2 bg-emerald-500/10 rounded-xl group-hover:scale-110 group-hover:bg-emerald-500/20 transition-all duration-300"><TrendingUp size={17} className="text-emerald-500" /></div>
                            <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Today's Collection</span>
                        </div>
                        <p className="text-2xl font-black text-emerald-600">₹{metrics.todayCollection.toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Across all TLs</p>
                    </div>
                </div>

                {/* Wallet Health */}
                <div className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-orange-500/30 transition-all duration-300 group relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
                    <div className="relative">
                        <div className="flex items-center gap-2 mb-2.5">
                            <div className="p-2 bg-orange-500/10 rounded-xl group-hover:scale-110 group-hover:bg-orange-500/20 transition-all duration-300"><Wallet size={17} className="text-orange-500" /></div>
                            <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Wallet Balance</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-sm font-black text-emerald-500">+₹{metrics.positiveWallet.toLocaleString()}</span>
                            <span className="text-sm font-black text-rose-500">-₹{Math.abs(metrics.negativeWallet).toLocaleString()}</span>
                        </div>
                        {metrics.criticalDebt > 0 && (
                            <p className="text-[10px] text-rose-500 font-black mt-1 animate-pulse flex items-center gap-1">
                                <AlertTriangle size={10} /> {metrics.criticalDebt} critical debt riders
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* ── SECOND ROW METRICS ── */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {/* Leads */}
                <div className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all group">
                    <div className="flex items-center gap-2 mb-2.5">
                        <div className="p-2 bg-violet-500/10 rounded-xl group-hover:scale-110 transition-transform"><Target size={17} className="text-violet-500" /></div>
                        <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Leads</span>
                    </div>
                    <p className="text-2xl font-black">{leads.length}</p>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold text-indigo-500">+{metrics.todayLeads} today</span>
                        <span className="text-muted-foreground text-[10px]">•</span>
                        <span className="text-[10px] font-bold text-emerald-500">{metrics.conversionRate}% conversion</span>
                    </div>
                </div>

                {/* Conversion */}
                <div className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all group">
                    <div className="flex items-center gap-2 mb-2.5">
                        <div className="p-2 bg-emerald-500/10 rounded-xl group-hover:scale-110 transition-transform"><BarChart3 size={17} className="text-emerald-500" /></div>
                        <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Converted</span>
                    </div>
                    <p className="text-2xl font-black text-emerald-600">{metrics.convertedLeads}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">From {leads.length} total leads</p>
                </div>

                {/* Quick Links */}
                <div className="col-span-2 md:col-span-1 bg-card border border-border/50 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 bg-teal-500/10 rounded-xl"><Zap size={17} className="text-teal-500" /></div>
                        <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Quick Links</span>
                    </div>
                    <div className="space-y-2">
                        {[
                            { to: '/rm-panel/rider-overview', label: 'Rider Overview', icon: Users },
                            { to: '/rm-panel/tl-performance', label: 'TL Performance', icon: BarChart3 },
                            { to: '/rm-panel/leaderboard', label: 'Leaderboard', icon: Trophy },
                            { to: '/rm-panel/reports', label: 'Reports', icon: Shield },
                        ].map(({ to, label, icon: Icon }) => (
                            <Link key={to} to={to} className="flex items-center justify-between text-sm hover:text-teal-600 transition-colors group/link py-1">
                                <span className="flex items-center gap-2">
                                    <Icon size={13} className="text-muted-foreground group-hover/link:text-teal-500 transition-colors" />
                                    {label}
                                </span>
                                <ArrowRight size={14} className="opacity-0 group-hover/link:opacity-100 transition-opacity" />
                            </Link>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── TOP PERFORMERS TABLE ── */}
            <div className="bg-card border border-border/40 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-border/40 flex items-center justify-between bg-gradient-to-r from-amber-500/5 via-transparent to-teal-500/5">
                    <div>
                        <h3 className="font-black text-lg flex items-center gap-2">
                            <div className="p-1.5 bg-amber-500/10 rounded-lg"><Trophy size={16} className="text-amber-500" /></div>
                            Top Performers Today
                        </h3>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Ranked by today's collection</p>
                    </div>
                    <Link to="/rm-panel/tl-performance" className="text-sm font-bold text-teal-600 hover:text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-950/30 px-4 py-2 rounded-xl border border-teal-100 dark:border-teal-900/30 transition-all flex items-center gap-1.5">
                        View All <ArrowRight size={14} />
                    </Link>
                </div>
                <div className="overflow-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left border-b">
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest w-10">#</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">Team Leader</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">Active Riders</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">Avg/Rider</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest text-right">Today's Collection</th>
                            </tr>
                        </thead>
                        <tbody>
                            {topTLs.map((tl, i) => (
                                <tr key={tl.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                                    <td className="p-3">
                                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black ${
                                            i === 0 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 ring-2 ring-amber-300/50'
                                            : i === 1 ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                            : i === 2 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
                                            : 'bg-muted text-muted-foreground'
                                        }`}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</span>
                                    </td>
                                    <td className="p-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-700 dark:text-teal-400 font-bold text-sm border border-teal-200 dark:border-teal-800/30">
                                                {tl.fullName.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-semibold">{tl.fullName}</p>
                                                <p className="text-[10px] text-muted-foreground">{tl.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-3">
                                        <span className="font-bold">{tl.activeRiders}</span>
                                        <span className="text-xs font-normal text-muted-foreground"> / {tl.totalRiders}</span>
                                    </td>
                                    <td className="p-3 font-bold text-indigo-600 dark:text-indigo-400">₹{tl.avgPerRider.toLocaleString()}</td>
                                    <td className="p-3 text-right font-black text-emerald-600 dark:text-emerald-400">₹{tl.todayCollection.toLocaleString()}</td>
                                </tr>
                            ))}
                            {topTLs.length === 0 && (
                                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No active team leaders found</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default RMDashboard;
