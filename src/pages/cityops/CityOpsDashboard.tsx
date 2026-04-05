/**
 * City Ops Dashboard — Premium Smart Metrics with Clickable Navigation
 * Data is strictly scoped to this City Ops user's hierarchy.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useCityOpsScope } from '@/hooks/useCityOpsScope';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/config/supabase';
import {
    Users, UserCheck, UserX, Trash2, TrendingUp,
    Target, Wallet,
    RefreshCw,
    Zap, Star, Activity, ChevronRight, IndianRupee, BarChart3,
    ShieldCheck, AlertTriangle, Clock
} from 'lucide-react';

// ── Animated number counter ──────────────────────────────────────────────────
const useCountUp = (target: number, duration = 800) => {
    const [count, setCount] = useState(0);
    const prev = useRef(0);
    useEffect(() => {
        const start = prev.current;
        const range = target - start;
        if (range === 0) return;
        const startTime = performance.now();
        const tick = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3);
            setCount(Math.round(start + range * ease));
            if (progress < 1) requestAnimationFrame(tick);
            else prev.current = target;
        };
        requestAnimationFrame(tick);
    }, [target, duration]);
    return count;
};

// ── Hero metric card (large, clickable) ─────────────────────────────────────
const HeroCard: React.FC<{
    label: string;
    value: number;
    prefix?: string;
    subtitle: string;
    icon: React.ElementType;
    gradient: string;
    live?: boolean;
    onClick?: () => void;
}> = ({ label, value, prefix = '', subtitle, icon: Icon, gradient, live, onClick }) => {
    const count = useCountUp(value);
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02, y: -2 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            onClick={onClick}
            className={`relative overflow-hidden rounded-2xl p-6 cursor-pointer ${gradient} shadow-lg`}
        >
            {/* Background shimmer */}
            <div className="absolute inset-0 bg-white/5 rounded-2xl" />
            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />

            <div className="relative flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <p className="text-white/80 text-xs font-bold uppercase tracking-widest">{label}</p>
                        {live && (
                            <span className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                <span className="text-white/60 text-[10px]">LIVE</span>
                            </span>
                        )}
                    </div>
                    <p className="text-4xl font-black text-white mt-1 tracking-tight">
                        {prefix}{count.toLocaleString('en-IN')}
                    </p>
                    <p className="text-white/70 text-sm mt-2">{subtitle}</p>
                </div>
                <div className="bg-white/20 backdrop-blur-sm p-3 rounded-xl">
                    <Icon size={28} className="text-white" />
                </div>
            </div>

            {onClick && (
                <div className="relative flex items-center gap-1 mt-4 text-white/70 text-xs font-semibold">
                    View Details <ChevronRight size={12} />
                </div>
            )}
        </motion.div>
    );
};

// ── Small stat card ──────────────────────────────────────────────────────────
const StatCard: React.FC<{
    label: string;
    value: number;
    icon: React.ElementType;
    color: string;
    bgColor: string;
    delay?: number;
    onClick?: () => void;
    badge?: string;
}> = ({ label, value, icon: Icon, color, bgColor, delay = 0, onClick, badge }) => {
    const count = useCountUp(value);
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay, type: 'spring', stiffness: 300 }}
            whileHover={onClick ? { scale: 1.04, y: -2 } : {}}
            onClick={onClick}
            className={`bg-card border border-border/60 rounded-xl p-4 shadow-sm relative overflow-hidden ${onClick ? 'cursor-pointer hover:border-border hover:shadow-md transition-all' : ''}`}
        >
            {badge && (
                <span className="absolute top-2 right-2 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600 border border-amber-500/30">
                    {badge}
                </span>
            )}
            <div className="flex items-start justify-between">
                <div className="space-y-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">{label}</p>
                    <p className="text-2xl font-black tabular-nums">{count.toLocaleString('en-IN')}</p>
                </div>
                <div className={`p-2.5 rounded-xl ${bgColor}`}>
                    <Icon size={18} className={color} />
                </div>
            </div>
            {onClick && (
                <div className={`flex items-center gap-1 mt-2 text-[11px] font-semibold ${color}`}>
                    View <ChevronRight size={10} />
                </div>
            )}
        </motion.div>
    );
};

// ── Main Component ────────────────────────────────────────────────────────────
const CityOpsDashboard: React.FC = () => {
    const { userData } = useSupabaseAuth();
    const { cityOpsId, rmIds, tlIds, isLoading: scopeLoading } = useCityOpsScope();
    const navigate = useNavigate();

    const [stats, setStats] = useState({
        totalRiders: 0, activeRiders: 0, inactiveRiders: 0, deletedRiders: 0,
        zomatoRiders: 0,
        totalLeads: 0, newLeads: 0, convertedLeads: 0,
        walletPositive: 0, walletNegative: 0, walletZero: 0,
        walletPositiveAmt: 0, walletNegativeAmt: 0,
        totalRMs: 0, totalTLs: 0,
        todayCollection: 0,
        lowBalanceRiders: 0,
        highDebtRiders: 0,
    });
    const [loading, setLoading] = useState(true);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

    const fetchDashboardStats = useCallback(async () => {
        if (!cityOpsId) return;
        setLoading(true);
        try {
            // Parallel fetch: riders + leads (if TLs exist) + today's wallet ledger
            const riderPromise = supabase
                .from('riders')
                .select('id, status, wallet_amount, chassis_number, team_leader_id')
                .eq('city_ops_id', cityOpsId);

            const leadsPromise = tlIds.length > 0
                ? supabase.from('leads').select('id, status').in('assigned_to', tlIds)
                : Promise.resolve({ data: [], error: null });

            // Today's collections for this City Ops' TLs
            const todayIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
            const todayStr = `${todayIST.getFullYear()}-${String(todayIST.getMonth() + 1).padStart(2, '0')}-${String(todayIST.getDate()).padStart(2, '0')}`;
            const collectionPromise = tlIds.length > 0
                ? supabase.from('wallet_ledger')
                    .select('amount, team_leader_id')
                    .eq('transaction_type', 'DAILY_COLLECTION')
                    .eq('mode', 'ADD')
                    .in('team_leader_id', tlIds)
                    .gte('transaction_date', `${todayStr}T00:00:00Z`)
                : Promise.resolve({ data: [], error: null });

            const [riderRes, leadsRes, collectionRes] = await Promise.all([
                riderPromise, leadsPromise, collectionPromise
            ]);

            const riderList = riderRes.data || [];
            const active = riderList.filter(r => r.status === 'active');
            const inactive = riderList.filter(r => r.status === 'inactive');
            const deleted = riderList.filter(r => r.status === 'deleted');

            const zomato = active.filter(r =>
                r.chassis_number?.trim().toUpperCase().startsWith('P6DSVFMSP')
            );

            const walletPos = active.filter(r => (r.wallet_amount || 0) > 0);
            const walletNeg = active.filter(r => (r.wallet_amount || 0) < 0);
            const walletZero = active.filter(r => (r.wallet_amount || 0) === 0);
            const lowBalance = active.filter(r => (r.wallet_amount || 0) >= 0 && (r.wallet_amount || 0) <= 250);
            const highDebt = riderList.filter(r => (r.wallet_amount || 0) < -3000);

            const walletPosAmt = walletPos.reduce((s, r) => s + (r.wallet_amount || 0), 0);
            const walletNegAmt = walletNeg.reduce((s, r) => s + Math.abs(r.wallet_amount || 0), 0);

            const leadList = leadsRes.data || [];
            const collectionList = collectionRes.data || [];
            const todayCollection = collectionList.reduce((s: number, c: { amount: number }) => s + (c.amount || 0), 0);

            setStats({
                totalRiders: riderList.length,
                activeRiders: active.length,
                inactiveRiders: inactive.length,
                deletedRiders: deleted.length,
                zomatoRiders: zomato.length,
                totalLeads: leadList.length,
                newLeads: leadList.filter(l => l.status === 'new').length,
                convertedLeads: leadList.filter(l => l.status === 'converted').length,
                walletPositive: walletPos.length,
                walletNegative: walletNeg.length,
                walletZero: walletZero.length,
                walletPositiveAmt: walletPosAmt,
                walletNegativeAmt: walletNegAmt,
                totalRMs: rmIds.length,
                totalTLs: tlIds.length,
                todayCollection,
                lowBalanceRiders: lowBalance.length,
                highDebtRiders: highDebt.length,
            });
            setLastRefresh(new Date());
        } catch (err) {
            console.error('[CityOps Dashboard] Error:', err);
        } finally {
            setLoading(false);
        }
    }, [cityOpsId, rmIds.length, tlIds]);

    useEffect(() => {
        if (scopeLoading || !cityOpsId) return;
        fetchDashboardStats();
    }, [scopeLoading, cityOpsId, fetchDashboardStats]);

    // Real-time live update on rider changes
    useEffect(() => {
        if (!cityOpsId) return;
        let debounce: ReturnType<typeof setTimeout>;
        const channel = supabase
            .channel('cityops-dashboard-live')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'riders' }, () => {
                clearTimeout(debounce);
                debounce = setTimeout(() => fetchDashboardStats(), 1500);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'wallet_ledger' }, () => {
                clearTimeout(debounce);
                debounce = setTimeout(() => fetchDashboardStats(), 1500);
            })
            .subscribe();
        return () => {
            supabase.removeChannel(channel);
            clearTimeout(debounce);
        };
    }, [cityOpsId, fetchDashboardStats]);

    // ── Skeleton loader ──────────────────────────────────────────────────────
    if (scopeLoading || loading) {
        return (
            <div className="space-y-6 animate-in fade-in duration-300">
                <div className="h-24 bg-gradient-to-r from-amber-500/20 to-orange-600/20 rounded-2xl animate-pulse" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[1, 2].map(i => <div key={i} className="h-36 bg-card rounded-2xl border border-border animate-pulse" />)}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="h-24 bg-card rounded-xl border border-border animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    const alertCount = stats.highDebtRiders + stats.lowBalanceRiders;

    return (
        <div className="space-y-6 animate-in fade-in duration-300">

            {/* ── Header ── */}
            <div className="flex items-center justify-between">
                <div>
                    <motion.h1
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="text-3xl font-black bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 bg-clip-text text-transparent"
                    >
                        {userData?.fullName?.split(' ')[0]}'s Command Center
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="text-muted-foreground mt-1 flex items-center gap-3 text-sm"
                    >
                        <span className="flex items-center gap-1">
                            <ShieldCheck size={13} className="text-emerald-500" />
                            {stats.totalRMs} RMs
                        </span>
                        <span className="text-border">•</span>
                        <span className="flex items-center gap-1">
                            <Users size={13} className="text-blue-500" />
                            {stats.totalTLs} TLs
                        </span>
                        <span className="text-border">•</span>
                        <span className="flex items-center gap-1 text-muted-foreground/60">
                            <Clock size={11} />
                            {lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </motion.p>
                </div>
                <motion.button
                    whileTap={{ scale: 0.95, rotate: 180 }}
                    onClick={() => fetchDashboardStats()}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-600 rounded-xl hover:bg-amber-500/20 transition-colors font-semibold text-sm border border-amber-500/20"
                >
                    <RefreshCw size={15} />
                    Refresh
                </motion.button>
            </div>

            {/* ── 2 Smart Hero Cards ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <HeroCard
                    label="Active Fleet"
                    value={stats.activeRiders}
                    subtitle={`${stats.zomatoRiders} Zomato VIP • ${stats.inactiveRiders} inactive`}
                    icon={Users}
                    gradient="bg-gradient-to-br from-blue-600 to-indigo-700"
                    live
                    onClick={() => navigate('/cityops/riders?filter=active')}
                />
                <HeroCard
                    label="Today's Collection"
                    value={stats.todayCollection}
                    prefix="₹"
                    subtitle={`Across ${stats.totalTLs} active team leaders`}
                    icon={IndianRupee}
                    gradient="bg-gradient-to-br from-emerald-600 to-teal-700"
                    live
                    onClick={() => navigate('/cityops/wallet')}
                />
            </div>

            {/* ── Alert Strip ── */}
            <AnimatePresence>
                {alertCount > 0 && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl cursor-pointer"
                        onClick={() => navigate('/cityops/riders?wallet=negative')}
                    >
                        <AlertTriangle size={16} className="text-red-500 shrink-0" />
                        <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                            <span className="font-black">{stats.highDebtRiders}</span> high-debt riders ({">"} ₹3000) •{' '}
                            <span className="font-black">{stats.lowBalanceRiders}</span> low-balance riders need attention
                        </p>
                        <ChevronRight size={14} className="text-red-500 ml-auto shrink-0" />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Stat Grid ── */}
            <div>
                <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/60 mb-3 flex items-center gap-2">
                    <BarChart3 size={14} />
                    Rider Overview
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    <StatCard label="Total Riders" value={stats.totalRiders} icon={Users} color="text-blue-600" bgColor="bg-blue-500/10" delay={0.0}
                        onClick={() => navigate('/cityops/riders')} />
                    <StatCard label="Active" value={stats.activeRiders} icon={UserCheck} color="text-emerald-600" bgColor="bg-emerald-500/10" delay={0.05}
                        onClick={() => navigate('/cityops/riders?filter=active')} />
                    <StatCard label="Inactive" value={stats.inactiveRiders} icon={UserX} color="text-orange-600" bgColor="bg-orange-500/10" delay={0.10}
                        onClick={() => navigate('/cityops/riders?filter=inactive')} />
                    <StatCard label="Deleted" value={stats.deletedRiders} icon={Trash2} color="text-red-600" bgColor="bg-red-500/10" delay={0.15}
                        onClick={() => navigate('/cityops/riders?filter=deleted')} />
                    <StatCard label="Zomato VIP" value={stats.zomatoRiders} icon={Star} color="text-amber-600" bgColor="bg-amber-500/10" delay={0.20}
                        badge="VIP"
                        onClick={() => navigate('/cityops/riders?filter=zomato')} />
                    <StatCard label="My RMs" value={stats.totalRMs} icon={TrendingUp} color="text-violet-600" bgColor="bg-violet-500/10" delay={0.25}
                        onClick={() => navigate('/cityops/staff?role=reportingManager')} />
                    <StatCard label="My TLs" value={stats.totalTLs} icon={Activity} color="text-indigo-600" bgColor="bg-indigo-500/10" delay={0.30}
                        onClick={() => navigate('/cityops/staff?role=teamLeader')} />
                    <StatCard label="Total Leads" value={stats.totalLeads} icon={Target} color="text-cyan-600" bgColor="bg-cyan-500/10" delay={0.35}
                        onClick={() => navigate('/cityops/leads')} />
                </div>
            </div>

            {/* ── Bottom row: Wallet + Leads ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Wallet Distribution */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm"
                >
                    <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                        <Wallet size={16} className="text-amber-500" />
                        Wallet Distribution
                        <span className="ml-auto text-xs text-muted-foreground">Active riders only</span>
                    </h3>
                    <div className="space-y-3">
                        <motion.div whileHover={{ x: 4 }} className="flex items-center justify-between p-3 bg-emerald-500/10 rounded-xl cursor-pointer"
                            onClick={() => navigate('/cityops/riders?wallet=positive')}>
                            <div>
                                <span className="text-sm font-semibold">Positive Balance</span>
                                <p className="text-xs text-muted-foreground mt-0.5">₹{stats.walletPositiveAmt.toLocaleString('en-IN')} total</p>
                            </div>
                            <div className="text-right">
                                <span className="text-xl font-black text-emerald-600">{stats.walletPositive}</span>
                                <ChevronRight size={14} className="text-emerald-500 inline ml-1" />
                            </div>
                        </motion.div>
                        <motion.div whileHover={{ x: 4 }} className="flex items-center justify-between p-3 bg-red-500/10 rounded-xl cursor-pointer"
                            onClick={() => navigate('/cityops/riders?wallet=negative')}>
                            <div>
                                <span className="text-sm font-semibold">Negative Balance</span>
                                <p className="text-xs text-muted-foreground mt-0.5">₹{stats.walletNegativeAmt.toLocaleString('en-IN')} total debt</p>
                            </div>
                            <div className="text-right">
                                <span className="text-xl font-black text-red-600">{stats.walletNegative}</span>
                                <ChevronRight size={14} className="text-red-500 inline ml-1" />
                            </div>
                        </motion.div>
                        <motion.div whileHover={{ x: 4 }} className="flex items-center justify-between p-3 bg-amber-500/10 rounded-xl cursor-pointer"
                            onClick={() => navigate('/cityops/riders?wallet=zero')}>
                            <span className="text-sm font-semibold">Zero Balance</span>
                            <div className="text-right">
                                <span className="text-xl font-black text-amber-600">{stats.walletZero}</span>
                                <ChevronRight size={14} className="text-amber-500 inline ml-1" />
                            </div>
                        </motion.div>
                    </div>
                </motion.div>

                {/* Leads + Team Summary */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45 }}
                    className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm"
                >
                    <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                        <Zap size={16} className="text-amber-500" />
                        Leads & Team
                    </h3>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-cyan-500/10 rounded-xl cursor-pointer"
                            onClick={() => navigate('/cityops/leads')}>
                            <span className="text-sm font-semibold">New Leads</span>
                            <span className="text-xl font-black text-cyan-600">{stats.newLeads}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-xl cursor-pointer"
                            onClick={() => navigate('/cityops/leads?status=converted')}>
                            <span className="text-sm font-semibold">Converted</span>
                            <span className="text-xl font-black text-green-600">{stats.convertedLeads}</span>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-violet-500/10 rounded-xl cursor-pointer"
                            onClick={() => navigate('/cityops/rm-performance')}>
                            <TrendingUp size={14} className="text-violet-600 shrink-0" />
                            <span className="text-sm font-semibold">RM Performance</span>
                            <div className="ml-auto flex items-center gap-1 text-violet-600">
                                <span className="text-lg font-black">{stats.totalRMs}</span>
                                <ChevronRight size={12} />
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-indigo-500/10 rounded-xl cursor-pointer"
                            onClick={() => navigate('/cityops/tl-performance')}>
                            <Activity size={14} className="text-indigo-600 shrink-0" />
                            <span className="text-sm font-semibold">TL Performance</span>
                            <div className="ml-auto flex items-center gap-1 text-indigo-600">
                                <span className="text-lg font-black">{stats.totalTLs}</span>
                                <ChevronRight size={12} />
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default CityOpsDashboard;
