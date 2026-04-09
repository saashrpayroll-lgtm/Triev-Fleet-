import React, { useMemo, useState, useEffect } from 'react';
import { useRMTeamData } from '@/hooks/useRMTeamData';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users, TrendingUp, Target, BarChart3,
    Trophy, ArrowRight, Activity, Shield, AlertTriangle,
    Zap, Calendar, X, ExternalLink, UserCheck, Sparkles
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/config/supabase';
import SmartMetricCard from '@/components/dashboard/SmartMetricCard';
import ZomatoNegativeAlertModal from '@/components/ZomatoNegativeAlertModal';

const RMDashboard: React.FC = () => {
    const { userData } = useSupabaseAuth();
    const { teamLeaders, riders, leads, loading } = useRMTeamData();

    // Progressive rendering: defer heavy sections to avoid blocking sidebar/header
    const [renderPhase, setRenderPhase] = useState(0);

    
    // Heavy Defaulters & Recovery Form
    const [recoveryFormUrl, setRecoveryFormUrl] = React.useState<string | null>(null);
    const [showRecoveryPopup, setShowRecoveryPopup] = React.useState(false);
    const [hasDismissedPopup, setHasDismissedPopup] = React.useState(false);

    // TL Risk Modal State
    const [selectedRiskTl, setSelectedRiskTl] = React.useState<any | null>(null);
    const [showRiskModal, setShowRiskModal] = React.useState(false);

    // Fleet Bifurcation Clickable State
    const [selectedBracket, setSelectedBracket] = React.useState<string | null>(null);
    const [bifurcationTlFilter, setBifurcationTlFilter] = React.useState<string>('all');

    const navigate = useNavigate();

    // Zomato Alert State
    const [showZomatoAlert, setShowZomatoAlert] = React.useState(false);
    const [hasShownZomatoAlert, setHasShownZomatoAlert] = React.useState(false);

    React.useEffect(() => {
        const fetchHRForm = async () => {
            const { data } = await supabase.from('external_forms')
                .select('url').ilike('title', '%recovery%').eq('is_active', true).limit(1).maybeSingle();
            if (data) setRecoveryFormUrl(data.url);
        };
        fetchHRForm();
    }, []);

    // Progressive rendering: stagger heavy sections so sidebar stays responsive
    useEffect(() => {
        if (loading) return;
        const t1 = setTimeout(() => setRenderPhase(1), 50);
        const t2 = setTimeout(() => setRenderPhase(2), 200);
        const t3 = setTimeout(() => setRenderPhase(3), 400);
        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }, [loading]);

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

    const rmWalletBifurcation = useMemo(() => {
        let b100 = 0, b200 = 0, b500 = 0, b1000 = 0, bMax = 0;
        let filteredRiders = riders.filter(r => r.status === 'active');
        if (bifurcationTlFilter !== 'all') {
            filteredRiders = filteredRiders.filter(r => r.teamLeaderId === bifurcationTlFilter);
        }
        filteredRiders.forEach(r => {
            const w = r.walletAmount;
            if (w < 0 && w >= -100) b100++;
            else if (w < -100 && w >= -200) b200++;
            else if (w < -200 && w >= -500) b500++;
            else if (w < -500 && w >= -1000) b1000++;
            else if (w < -1000) bMax++;
        });
        return { b100, b200, b500, b1000, bMax };
    }, [riders, bifurcationTlFilter]);

    const bracketRiders = useMemo(() => {
        if (!selectedBracket) return [];
        let filteredRiders = riders.filter(r => r.status === 'active');
        if (bifurcationTlFilter !== 'all') {
            filteredRiders = filteredRiders.filter(r => r.teamLeaderId === bifurcationTlFilter);
        }
        return filteredRiders.filter(r => {
            const w = r.walletAmount;
            if (selectedBracket === 'b100') return w < 0 && w >= -100;
            if (selectedBracket === 'b200') return w < -100 && w >= -200;
            if (selectedBracket === 'b500') return w < -200 && w >= -500;
            if (selectedBracket === 'b1000') return w < -500 && w >= -1000;
            if (selectedBracket === 'bMax') return w < -1000;
            return false;
        }).sort((a,b) => a.walletAmount - b.walletAmount);
    }, [selectedBracket, riders, bifurcationTlFilter]);

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

        const zomatoRiders = riders.filter(r => r.status === 'active' && (r.chassisNumber?.trim().toUpperCase().startsWith('P6DSVFMSP') || (r as any).chassis_number?.trim().toUpperCase().startsWith('P6DSVFMSP')));
        const zomatoTotal = zomatoRiders.length;
        const zomatoPosCount = zomatoRiders.filter(r => r.walletAmount >= 0).length;
        const zomatoNegCount = zomatoRiders.filter(r => r.walletAmount < 0).length;

        return {
            activeTLs, totalRiders, activeRiders, inactiveRiders,
            positiveWallet, negativeWallet,
            todayCollection, todayLeads, convertedLeads, conversionRate, criticalDebt,
            fleetHealth,
            zomatoTotal, zomatoPosCount, zomatoNegCount
        };
    }, [teamLeaders, riders, leads, dailyCollections]);

    // Zomato Auto Pop-up Effect
    React.useEffect(() => {
        if (!loading && metrics.zomatoNegCount > 0 && !hasShownZomatoAlert) {
            setShowZomatoAlert(true);
            setHasShownZomatoAlert(true);
        }
    }, [loading, metrics.zomatoNegCount, hasShownZomatoAlert]);

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
            <div className="space-y-4 animate-in fade-in duration-500">
                {/* Skeleton Header */}
                <div className="bg-card/60 backdrop-blur-2xl p-5 rounded-2xl border border-white/20 dark:border-white/5">
                    <div className="flex items-center gap-4">
                        <div className="hidden sm:block w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-200 to-slate-100 dark:from-slate-800 dark:to-slate-700 animate-pulse" />
                        <div className="space-y-2 flex-1">
                            <div className="h-7 w-56 rounded-lg bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-800 dark:via-slate-700 dark:to-slate-800 animate-pulse" />
                            <div className="h-3 w-36 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
                        </div>
                    </div>
                </div>
                {/* Skeleton Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="p-4 rounded-2xl border border-border/40 bg-card/50 space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
                                <div className="h-3 w-20 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
                            </div>
                            <div className="h-7 w-24 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
                            <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse" />
                        </div>
                    ))}
                </div>
                {/* Skeleton Tables */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <div className="h-52 rounded-2xl bg-card/50 border border-border/40 animate-pulse" />
                    <div className="h-52 rounded-2xl bg-card/50 border border-border/40 animate-pulse" />
                </div>
                <p className="text-center text-muted-foreground text-xs font-medium animate-pulse">Loading RM Command Center...</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-in fade-in duration-500">
            {/* ── ZOMATO VIP NEGATIVE WALLET POP-UP ── */}
            <ZomatoNegativeAlertModal
                isOpen={showZomatoAlert}
                onClose={() => setShowZomatoAlert(false)}
                negativeRiders={riders.filter(r => r.status === 'active' && r.walletAmount < 0 && (r.chassisNumber?.trim().toUpperCase().startsWith('P6DSVFMSP') || (r as any).chassis_number?.trim().toUpperCase().startsWith('P6DSVFMSP')))}
            />

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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }} className="space-y-3">
                <div className="flex items-center gap-2.5 px-1 mt-3">
                    <div className="relative">
                        <div className="absolute inset-0 bg-teal-500 blur-md opacity-40 rounded-full" />
                        <div className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-teal-500/30 border border-white/20">
                            <Activity size={12} className="text-white sm:w-4 sm:h-4" />
                        </div>
                    </div>
                    <span className="text-[11px] sm:text-xs font-black uppercase tracking-[0.25em] bg-gradient-to-r from-teal-600 to-teal-400 bg-clip-text text-transparent dark:from-teal-400 dark:to-teal-200">Fleet Overview</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-teal-500/40 via-teal-500/10 to-transparent" />
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                    <SmartMetricCard
                        title="Zomato VIP"
                        value={String(metrics.zomatoTotal)}
                        icon={Sparkles}
                        color="orange"
                        trend={{ value: 100, label: 'Active', direction: 'up' }}
                        subtitle={`${metrics.zomatoPosCount} healthy • ${metrics.zomatoNegCount} neg`}
                        isCurrency={false}
                        onClick={() => navigate('/rm-panel/riders', { state: { filter: 'zomato' } })}
                    />
                    <SmartMetricCard
                        title="Team Leaders"
                        value={String(metrics.activeTLs)}
                        icon={Users}
                        color="cyan"
                        subtitle="Active supervisors"
                        isCurrency={false}
                    />
                    <SmartMetricCard
                        title="Active Fleet"
                        value={`${metrics.activeRiders}/${metrics.totalRiders}`}
                        icon={UserCheck}
                        color="indigo"
                        trend={{ value: metrics.totalRiders > 0 ? Math.round((metrics.activeRiders / metrics.totalRiders) * 100) : 0, label: 'utilization', direction: 'up' }}
                        subtitle={`${metrics.inactiveRiders} inactive`}
                        progress={metrics.totalRiders > 0 ? (metrics.activeRiders / metrics.totalRiders) * 100 : 0}
                        isCurrency={false}
                    />
                    <SmartMetricCard
                        title="Today's Collection"
                        value={metrics.todayCollection}
                        icon={TrendingUp}
                        color="emerald"
                        subtitle="Across all TLs"
                        isCurrency={true}
                    />
                    <SmartMetricCard
                        title="Outstanding Risk"
                        value={Math.abs(metrics.negativeWallet)}
                        icon={AlertTriangle}
                        color="rose"
                        aiInsight={metrics.criticalDebt > 0 ? `${metrics.criticalDebt} critical debt riders` : undefined}
                        subtitle={`+₹${metrics.positiveWallet.toLocaleString()} positive`}
                        isCurrency={true}
                    />
                </div>
            </motion.div>

            {/* ── SECOND ROW METRICS ── */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="space-y-3">
                <div className="flex items-center gap-2.5 px-1 mt-3">
                    <div className="relative">
                        <div className="absolute inset-0 bg-violet-500 blur-md opacity-40 rounded-full" />
                        <div className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-violet-500/30 border border-white/20">
                            <Target size={12} className="text-white sm:w-4 sm:h-4" />
                        </div>
                    </div>
                    <span className="text-[11px] sm:text-xs font-black uppercase tracking-[0.25em] bg-gradient-to-r from-violet-600 to-violet-400 bg-clip-text text-transparent dark:from-violet-400 dark:to-violet-200">Leads & Quick Access</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-violet-500/40 via-violet-500/10 to-transparent" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
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
                            { to: '/rm-panel/riders', label: 'Rider Overview', icon: Users },
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
            </motion.div>

            {/* ── RM WALLET RISK BIFURCATION ── */}
            {renderPhase >= 1 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="space-y-3">
                <div className="flex items-center gap-2.5 px-1 mt-3">
                    <div className="relative">
                        <div className="absolute inset-0 bg-rose-500 blur-md opacity-40 rounded-full" />
                        <div className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-rose-400 to-rose-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-rose-500/30 border border-white/20">
                            <Activity size={12} className="text-white sm:w-4 sm:h-4" />
                        </div>
                    </div>
                    <span className="text-[11px] sm:text-xs font-black uppercase tracking-[0.25em] bg-gradient-to-r from-rose-600 to-rose-400 bg-clip-text text-transparent dark:from-rose-400 dark:to-rose-200">Wallet Risk Bifurcation</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-rose-500/40 via-rose-500/10 to-transparent" />
                </div>
            <div className="bg-card border border-border/40 rounded-2xl p-4 sm:p-5 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-rose-500/10 rounded-lg"><Activity size={16} className="text-rose-500" /></div>
                        <h3 className="font-black text-sm text-foreground/90">RM Fleet Wallet Bifurcation</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <select
                            value={bifurcationTlFilter}
                            onChange={(e) => setBifurcationTlFilter(e.target.value)}
                            className="bg-transparent text-[11px] font-bold border border-border/60 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-rose-500/50 cursor-pointer text-muted-foreground"
                        >
                            <option value="all">All Team Leaders</option>
                            {teamLeaders.map(tl => (
                                <option key={tl.id} value={tl.id}>{tl.fullName}</option>
                            ))}
                        </select>
                        <span className="text-[9px] hidden sm:inline-block font-black px-2 py-1 bg-muted rounded-full text-muted-foreground uppercase tracking-widest">Active Riders</span>
                    </div>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                    <motion.div whileHover={{ y: -3, scale: 1.03 }} whileTap={{ scale: 0.97 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }} onClick={() => rmWalletBifurcation.b100 > 0 && setSelectedBracket('b100')} className={`bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center ${rmWalletBifurcation.b100 > 0 ? 'cursor-pointer hover:ring-2 hover:ring-slate-400 shadow-sm' : 'opacity-80'}`}>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">₹-1 to ₹-100</span>
                        <span className="text-2xl font-black text-slate-700 dark:text-slate-300">{rmWalletBifurcation.b100}</span>
                    </motion.div>
                    <motion.div whileHover={{ y: -3, scale: 1.03 }} whileTap={{ scale: 0.97 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }} onClick={() => rmWalletBifurcation.b200 > 0 && setSelectedBracket('b200')} className={`bg-orange-50 dark:bg-orange-900/20 p-4 rounded-xl border border-orange-200 dark:border-orange-900/30 flex flex-col items-center justify-center text-center ${rmWalletBifurcation.b200 > 0 ? 'cursor-pointer hover:ring-2 hover:ring-orange-400 shadow-sm' : 'opacity-80'}`}>
                        <span className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-1">₹-101 to ₹-200</span>
                        <span className="text-2xl font-black text-orange-600 dark:text-orange-400">{rmWalletBifurcation.b200}</span>
                    </motion.div>
                    <motion.div whileHover={{ y: -3, scale: 1.03 }} whileTap={{ scale: 0.97 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }} onClick={() => rmWalletBifurcation.b500 > 0 && setSelectedBracket('b500')} className={`bg-rose-50 dark:bg-rose-900/20 p-4 rounded-xl border border-rose-200 dark:border-rose-900/30 flex flex-col items-center justify-center text-center ${rmWalletBifurcation.b500 > 0 ? 'cursor-pointer hover:ring-2 hover:ring-rose-400 shadow-sm' : 'opacity-80'}`}>
                        <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mb-1">₹-201 to ₹-500</span>
                        <span className="text-2xl font-black text-rose-600 dark:text-rose-400">{rmWalletBifurcation.b500}</span>
                    </motion.div>
                    <motion.div whileHover={{ y: -3, scale: 1.03 }} whileTap={{ scale: 0.97 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }} onClick={() => rmWalletBifurcation.b1000 > 0 && setSelectedBracket('b1000')} className={`bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-200 dark:border-red-900/30 flex flex-col items-center justify-center text-center relative overflow-hidden ${rmWalletBifurcation.b1000 > 0 ? 'cursor-pointer hover:ring-2 hover:ring-red-500 shadow-sm' : 'opacity-80'}`}>
                        <div className="absolute top-0 right-0 w-12 h-12 bg-red-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                        <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-1">₹-501 to ₹-1000</span>
                        <span className="text-2xl font-black text-red-600 dark:text-red-400 relative z-10">{rmWalletBifurcation.b1000}</span>
                    </motion.div>
                    <motion.div whileHover={{ y: -3, scale: 1.03 }} whileTap={{ scale: 0.97 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }} onClick={() => rmWalletBifurcation.bMax > 0 && setSelectedBracket('bMax')} className={`bg-rose-100 dark:bg-rose-950/40 p-4 rounded-xl border border-rose-300 dark:border-rose-900/50 flex flex-col items-center justify-center text-center relative overflow-hidden lg:col-span-1 col-span-2 shadow-[inset_0_2px_15px_rgba(0,0,0,0.02)] ${rmWalletBifurcation.bMax > 0 ? 'cursor-pointer hover:ring-2 hover:ring-rose-500' : 'opacity-80'}`}>
                        <div className="absolute -top-4 -right-4 w-16 h-16 bg-rose-500/20 rounded-full blur-md" />
                        <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest mb-1 flex items-center gap-1"><AlertTriangle size={12} /> &lt; ₹-1000</span>
                        <span className="text-3xl font-black text-rose-700 dark:text-rose-300 relative z-10 drop-shadow-sm">{rmWalletBifurcation.bMax}</span>
                    </motion.div>
                </div>
            </div>
            </motion.div>
            )}

            {/* ── TABLES GRID ── */}
            {renderPhase >= 2 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="space-y-3">
                <div className="flex items-center gap-2.5 px-1 mt-3">
                    <div className="relative">
                        <div className="absolute inset-0 bg-amber-500 blur-md opacity-40 rounded-full" />
                        <div className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-500/30 border border-white/20">
                            <Trophy size={12} className="text-white sm:w-4 sm:h-4" />
                        </div>
                    </div>
                    <span className="text-[11px] sm:text-xs font-black uppercase tracking-[0.25em] bg-gradient-to-r from-amber-600 to-amber-400 bg-clip-text text-transparent dark:from-amber-400 dark:to-amber-200">Performance & Risk Tables</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-amber-500/40 via-amber-500/10 to-transparent" />
                </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
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
                        <thead className="sticky top-0 bg-card z-10 shadow-[0_4px_10px_-4px_rgba(0,0,0,0.08)]">
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
                            <thead className="sticky top-0 bg-card z-10 shadow-[0_4px_10px_-4px_rgba(0,0,0,0.08)]">
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
            </motion.div>
            )}
            {/* ── FLEET BIFURCATION RIDER MODAL ── */}
            <AnimatePresence>
                {selectedBracket && (
                    <motion.div
                        className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
                            onClick={() => setSelectedBracket(null)}
                        />
                        <motion.div
                            className="relative w-full max-w-3xl bg-card border border-border shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[85vh]"
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        >
                            <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-muted/30">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-rose-500/10 rounded-lg">
                                        <AlertTriangle size={18} className="text-rose-500" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-base md:text-lg text-foreground leading-tight">
                                            Fleet Defaulters Bracket
                                        </h3>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            Range: {selectedBracket === 'b100' ? '-1 to -100' : selectedBracket === 'b200' ? '-101 to -200' : selectedBracket === 'b500' ? '-201 to -500' : selectedBracket === 'b1000' ? '-501 to -1000' : '< -1000'} &nbsp; • &nbsp; {bracketRiders.length} Riders Total
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedBracket(null)} className="p-2 hover:bg-muted rounded-full transition-colors">
                                    <X size={20} className="text-muted-foreground" />
                                </button>
                            </div>

                            <div className="overflow-y-auto p-4 sm:p-5 custom-scrollbar bg-slate-50/50 dark:bg-slate-900/20">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {bracketRiders.map((rider) => (
                                        <div key={rider.id} className="bg-background border border-border rounded-xl p-3 flex flex-col justify-between hover:shadow-md hover:border-primary/30 transition-all group">
                                            <div className="overflow-hidden flex items-start justify-between">
                                                <div>
                                                    <h4 className="font-bold text-sm text-foreground truncate">{rider.riderName}</h4>
                                                    <div className="flex flex-col mt-0.5">
                                                        <span className="text-[10px] text-muted-foreground font-mono">{rider.trievId} • {rider.clientName}</span>
                                                        <span className="text-[11px] text-muted-foreground mt-0.5 font-medium">{rider.teamLeaderName}</span>
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0 ml-2">
                                                    <span className="inline-block px-2.5 py-1 bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 rounded-lg font-black text-[13px]">
                                                        ₹{rider.walletAmount.toLocaleString('en-IN')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default RMDashboard;
