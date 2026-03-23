import React, { useMemo } from 'react';
import { useRMTeamData } from '@/hooks/useRMTeamData';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users, TrendingUp, Wallet, Target, BarChart3,
    Trophy, ArrowRight, Activity, Shield, AlertTriangle,
    Zap, Calendar, X, ExternalLink
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/config/supabase';

const RMDashboard: React.FC = () => {
    const { userData } = useSupabaseAuth();
    const { teamLeaders, riders, leads, loading } = useRMTeamData();

    
    // Heavy Defaulters & Recovery Form
    const [recoveryFormUrl, setRecoveryFormUrl] = React.useState<string | null>(null);
    const [showRecoveryPopup, setShowRecoveryPopup] = React.useState(false);
    const [hasDismissedPopup, setHasDismissedPopup] = React.useState(false);

    // TL Risk Modal State
    const [selectedRiskTl, setSelectedRiskTl] = React.useState<any | null>(null);
    const [showRiskModal, setShowRiskModal] = React.useState(false);

    React.useEffect(() => {
        const fetchHRForm = async () => {
            const { data } = await supabase.from('external_forms')
                .select('url').ilike('title', '%recovery%').eq('is_active', true).limit(1).maybeSingle();
            if (data) setRecoveryFormUrl(data.url);
        };
        fetchHRForm();
    }, []);

    const heavyDefaulters = useMemo(() => {
        return riders.filter(r => r.status === 'active' && r.walletAmount <= -1500);
    }, [riders]);

    React.useEffect(() => {
        if (heavyDefaulters.length > 0 && !hasDismissedPopup) {
            setShowRecoveryPopup(true);
        }
    }, [heavyDefaulters, hasDismissedPopup]);

    const tlRiskOverview = useMemo(() => {
        return teamLeaders
            .filter(tl => tl.status === 'active')
            .map(tl => {
                const tlRiders = riders.filter(r => r.teamLeaderId === tl.id && r.status === 'active');
                const negativeRiders = tlRiders.filter(r => r.walletAmount < 0);
                const criticalRiders = tlRiders.filter(r => r.walletAmount <= -1500);
                const totalNegative = negativeRiders.reduce((sum, r) => sum + r.walletAmount, 0);
                return { ...tl, negativeCount: negativeRiders.length, criticalCount: criticalRiders.length, totalNegative };
            })
            .sort((a, b) => a.totalNegative - b.totalNegative)
            .slice(0, 5);
    }, [teamLeaders, riders]);

    const selectedTlNegativeRiders = useMemo(() => {
        if (!selectedRiskTl) return [];
        return riders
            .filter(r => r.teamLeaderId === selectedRiskTl.id && r.status === 'active' && r.walletAmount < 0)
            .sort((a, b) => a.walletAmount - b.walletAmount);
    }, [selectedRiskTl, riders]);

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
            {/* ── HEAVY DEFAULTERS MODAL ── */}
            <AnimatePresence>
                {showRecoveryPopup && heavyDefaulters.length > 0 && (
                    <motion.div
                        className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
                            onClick={() => { setShowRecoveryPopup(false); setHasDismissedPopup(true); }}
                        />
                        <motion.div
                            className="relative bg-card border border-rose-500/30 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        >
                            <div className="bg-gradient-to-r from-rose-500 to-red-600 p-5 text-white flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white/20 rounded-xl"><AlertTriangle size={20} className="animate-pulse" /></div>
                                    <div>
                                        <h2 className="text-lg font-black tracking-tight">Heavy Defaulters Alert</h2>
                                        <p className="text-white/80 text-xs font-medium">{heavyDefaulters.length} riders with critical debt (-₹1500+)</p>
                                    </div>
                                </div>
                                <button onClick={() => { setShowRecoveryPopup(false); setHasDismissedPopup(true); }} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
                                    <X size={18} />
                                </button>
                            </div>
                            <div className="p-5">
                                <div className="max-h-60 overflow-y-auto mb-5 space-y-2 pr-2 custom-scrollbar">
                                    {heavyDefaulters.map(rider => (
                                        <div key={rider.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/50">
                                            <div>
                                                <p className="font-bold text-sm text-foreground">{rider.riderName}</p>
                                                <p className="text-xs text-muted-foreground">{rider.trievId}</p>
                                            </div>
                                            <span className="font-black text-rose-500 text-base">-₹{Math.abs(rider.walletAmount).toLocaleString()}</span>
                                        </div>
                                    ))}
                                </div>
                                {recoveryFormUrl ? (
                                    <a
                                        href={recoveryFormUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={() => { setShowRecoveryPopup(false); setHasDismissedPopup(true); }}
                                        className="w-full flex items-center justify-center gap-2 bg-rose-500 hover:bg-rose-600 text-white font-bold py-3.5 rounded-xl shadow-[0_0_15px_rgba(244,63,94,0.4)] transition-all"
                                    >
                                        <ExternalLink size={16} /> Fill Hard Recovery Form
                                    </a>
                                ) : (
                                    <p className="text-xs text-center text-muted-foreground italic">No Hard Recovery form link active in Company Forms.</p>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── TL RISK DETAILS MODAL ── */}
            <AnimatePresence>
                {showRiskModal && selectedRiskTl && (
                    <motion.div
                        className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
                            onClick={() => setShowRiskModal(false)}
                        />
                        <motion.div
                            className="relative bg-card border border-border/50 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] md:max-h-[80vh]"
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        >
                            <div className="bg-gradient-to-r from-rose-500/10 to-transparent p-4 md:p-5 border-b border-border/50 flex items-start md:items-center justify-between shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-500 font-bold border border-rose-500/30 shrink-0">
                                        {selectedRiskTl.fullName.charAt(0)}
                                    </div>
                                    <div>
                                        <h2 className="text-base md:text-lg font-black tracking-tight flex items-center gap-2">
                                            {selectedRiskTl.fullName}'s Risk Overview
                                        </h2>
                                        <p className="text-muted-foreground text-[10px] md:text-xs font-medium">
                                            {selectedTlNegativeRiders.length} Defaulters <span className="mx-1 opacity-50">•</span> Total Debit: <span className="text-rose-500 font-bold">-₹{Math.abs(selectedRiskTl.totalNegative).toLocaleString()}</span>
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => setShowRiskModal(false)} className="p-2 hover:bg-muted rounded-xl transition-colors shrink-0">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="overflow-auto p-0 md:p-5 relative flex-1 custom-scrollbar">
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 bg-card z-10 shadow-[0_4px_10px_-4px_rgba(0,0,0,0.1)]">
                                        <tr className="text-left">
                                            <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest border-b border-border/50">Rider Info</th>
                                            <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest border-b border-border/50">Status</th>
                                            <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest text-right border-b border-border/50">Wallet</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedTlNegativeRiders.map(rider => (
                                            <tr key={rider.id} className="border-b border-border/20 last:border-0 hover:bg-muted/10 transition-colors">
                                                <td className="p-3">
                                                    <p className="font-bold text-foreground text-xs md:text-sm">{rider.riderName}</p>
                                                    <p className="text-[10px] font-mono text-muted-foreground">{rider.trievId} <span className="opacity-50">•</span> {rider.mobileNumber}</p>
                                                </td>
                                                <td className="p-3">
                                                    {rider.walletAmount <= -1500 ? (
                                                        <span className="inline-flex items-center gap-1 text-[9px] md:text-[10px] font-black text-rose-500 bg-rose-500/10 px-2 py-1 rounded-full border border-rose-500/20">
                                                            <AlertTriangle size={10} /> CRITICAL
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 text-[9px] md:text-[10px] font-black text-orange-500 bg-orange-500/10 px-2 py-1 rounded-full border border-orange-500/20">
                                                            NEGATIVE
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-right font-black text-rose-500 md:text-base">
                                                    -₹{Math.abs(rider.walletAmount).toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                        {selectedTlNegativeRiders.length === 0 && (
                                            <tr>
                                                <td colSpan={3} className="p-8 text-center text-muted-foreground">No negative riders found for this Team Leader.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

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

            {/* ── TABLES GRID ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* ── TOP PERFORMERS TABLE ── */}
                <div className="bg-card border border-border/40 rounded-2xl shadow-sm overflow-hidden h-full flex flex-col">
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

                {/* ── TL WALLET RISK ALERTS ── */}
                <div className="bg-card border border-rose-500/20 rounded-2xl shadow-sm overflow-hidden h-full flex flex-col">
                    <div className="p-4 border-b border-border/40 flex items-center justify-between bg-gradient-to-r from-rose-500/5 via-transparent to-transparent">
                        <div>
                            <h3 className="font-black text-lg flex items-center gap-2 text-rose-500">
                                <div className="p-1.5 bg-rose-500/10 rounded-lg"><AlertTriangle size={16} /></div>
                                TL Wallet Risk
                            </h3>
                            <p className="text-[10px] text-muted-foreground mt-0.5">Ranked by maximum negative wallet exposure</p>
                        </div>
                    </div>
                    <div className="overflow-auto flex-1">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left border-b">
                                    <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">Team Leader</th>
                                    <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest text-center">Defaulters</th>
                                    <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest text-right">Total Debit</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tlRiskOverview.map((tl) => (
                                    <tr 
                                        key={tl.id} 
                                        className="border-b last:border-0 hover:bg-muted/30 transition-all cursor-pointer group"
                                        onClick={() => { setSelectedRiskTl(tl); setShowRiskModal(true); }}
                                    >
                                        <td className="p-3">
                                            <p className="font-semibold group-hover:text-teal-500 transition-colors flex items-center gap-1.5">
                                                {tl.fullName}
                                                <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-teal-500" />
                                            </p>
                                            <p className="text-[10px] text-muted-foreground">{tl.email}</p>
                                        </td>
                                        <td className="p-3 text-center">
                                            <span className="font-bold text-rose-500">{tl.negativeCount}</span>
                                            {tl.criticalCount > 0 && <span className="ml-2 text-[9px] font-black text-white bg-rose-500 px-1.5 py-0.5 rounded-full">{tl.criticalCount} severe</span>}
                                        </td>
                                        <td className="p-3 text-right font-black text-rose-500">-₹{Math.abs(tl.totalNegative).toLocaleString()}</td>
                                    </tr>
                                ))}
                                {tlRiskOverview.length === 0 && (
                                    <tr><td colSpan={3} className="p-8 text-center text-muted-foreground">No wallet risks identified</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RMDashboard;
