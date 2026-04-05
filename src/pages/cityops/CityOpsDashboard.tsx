/**
 * City Ops Dashboard — Enhanced Premium Command Center
 * Accurate data, Zomato VPI, charts, fleet health, wallet bifurcation, watchlist
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useCityOpsScope } from '@/hooks/useCityOpsScope';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/config/supabase';
import {
    Users, UserCheck, AlertTriangle, TrendingDown,
    Target, Wallet, RefreshCw, Zap, Activity, ChevronRight,
    IndianRupee, BarChart3, Clock, Shield, ArrowUpRight, ArrowDownRight,
    Bike, Star, ChevronUp, ChevronDown
} from 'lucide-react';

// ───────────────────────────────────────────────
// Animated counter
// ───────────────────────────────────────────────
const useCountUp = (target: number, duration = 900) => {
    const [count, setCount] = useState(0);
    const prev = useRef(0);
    useEffect(() => {
        const start = prev.current;
        const range = target - start;
        if (range === 0) return;
        const t0 = performance.now();
        const tick = (now: number) => {
            const p = Math.min((now - t0) / duration, 1);
            const e = 1 - Math.pow(1 - p, 3);
            setCount(Math.round(start + range * e));
            if (p < 1) requestAnimationFrame(tick);
            else prev.current = target;
        };
        requestAnimationFrame(tick);
    }, [target, duration]);
    return count;
};

const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const fmtShort = (n: number) => {
    if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
    return fmt(n);
};

// ───────────────────────────────────────────────
// Hero stat card
// ───────────────────────────────────────────────
const HeroCard: React.FC<{
    label: string; value: number; prefix?: string; subtitle: string;
    icon: React.ElementType; gradient: string; live?: boolean; onClick?: () => void;
    trend?: number;
}> = ({ label, value, prefix = '', subtitle, icon: Icon, gradient, live, onClick, trend }) => {
    const count = useCountUp(value);
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02, y: -2 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            onClick={onClick}
            className={`relative overflow-hidden rounded-2xl p-6 cursor-pointer ${gradient} shadow-xl`}
        >
            <div className="absolute inset-0 bg-white/5" />
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-3xl" />
            <div className="relative flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <p className="text-white/80 text-xs font-bold uppercase tracking-widest">{label}</p>
                        {live && <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            <span className="text-white/60 text-[10px]">LIVE</span>
                        </span>}
                    </div>
                    <p className="text-4xl font-black text-white mt-1 tracking-tight">
                        {prefix}{count.toLocaleString('en-IN')}
                    </p>
                    <p className="text-white/70 text-sm mt-2">{subtitle}</p>
                    {trend !== undefined && (
                        <div className={`flex items-center gap-1 mt-1.5 text-[11px] font-bold ${trend >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                            {trend >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                            {Math.abs(trend)} today
                        </div>
                    )}
                </div>
                <div className="bg-white/20 backdrop-blur-sm p-3 rounded-xl">
                    <Icon size={28} className="text-white" />
                </div>
            </div>
            {onClick && (
                <div className="relative flex items-center gap-1 mt-3 text-white/70 text-xs font-semibold">
                    View Details <ChevronRight size={12} />
                </div>
            )}
        </motion.div>
    );
};

// ───────────────────────────────────────────────
// Metric tile (small)
// ───────────────────────────────────────────────
const MetricTile: React.FC<{
    label: string; value: number | string; icon: React.ElementType;
    iconColor: string; bgColor: string; suffix?: string; badge?: string;
    alert?: boolean; onClick?: () => void;
}> = ({ label, value, icon: Icon, iconColor, bgColor, suffix = '', badge, alert, onClick }) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        whileHover={onClick ? { scale: 1.04, y: -2 } : {}}
        onClick={onClick}
        className={`bg-card border rounded-xl p-4 shadow-sm relative overflow-hidden transition-all
            ${alert ? 'border-rose-500/40 bg-rose-500/5' : 'border-border/60'}
            ${onClick ? 'cursor-pointer hover:shadow-md hover:border-border' : ''}`}
    >
        {badge && (
            <span className="absolute top-2 right-2 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600 border border-amber-500/30">
                {badge}
            </span>
        )}
        <div className="flex items-start justify-between">
            <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">{label}</p>
                <p className="text-2xl font-black tabular-nums">
                    {typeof value === 'number' ? value.toLocaleString('en-IN') : value}{suffix}
                </p>
            </div>
            <div className={`p-2.5 rounded-xl ${bgColor}`}>
                <Icon size={16} className={iconColor} />
            </div>
        </div>
        {onClick && (
            <div className={`flex items-center gap-1 mt-2 text-[11px] font-semibold ${iconColor}`}>
                View <ChevronRight size={10} />
            </div>
        )}
    </motion.div>
);

// ───────────────────────────────────────────────
// Wallet bifurcation row
// ───────────────────────────────────────────────
const WalletBifRow: React.FC<{ name: string; pos: number; neg: number; negAmt: number; total: number }> = ({ name, pos, neg, negAmt, total }) => {
    const negPct = total > 0 ? Math.round((neg / total) * 100) : 0;
    return (
        <div className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
            <div className="flex items-center gap-2 min-w-0">
                <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                <span className="text-xs font-semibold truncate">{name}</span>
            </div>
            <div className="flex items-center gap-3 text-xs flex-shrink-0">
                <span className="text-emerald-600 font-bold">{pos}✓</span>
                <span className="text-rose-600 font-bold">{neg}✗</span>
                <span className="text-rose-500 font-black text-[11px]">{fmtShort(negAmt)}</span>
                <div className="w-12 bg-muted/40 rounded-full h-1.5">
                    <div className="bg-rose-500 rounded-full h-1.5" style={{ width: `${negPct}%` }} />
                </div>
            </div>
        </div>
    );
};

// ───────────────────────────────────────────────
// Main Component
// ───────────────────────────────────────────────
interface RiderRaw {
    id: string;
    status: string;
    wallet_amount: number;
    client_name: string;
    team_leader_id: string;
    allotment_date: string;
    inactivated_at?: string;
}

interface TLEntry { id: string; full_name: string; reporting_manager: string; }
interface CollRow { team_leader_id: string; total_collection: number; }
interface LeadRow { id: string; status: string; created_by: string; }

const CityOpsDashboard: React.FC = () => {
    const { userData } = useSupabaseAuth();
    const { cityOpsId, rmIds, tlIds, isLoading: scopeLoading } = useCityOpsScope();
    const navigate = useNavigate();

    const [riders, setRiders] = useState<RiderRaw[]>([]);
    const [leads, setLeads] = useState<LeadRow[]>([]);
    const [tlMap, setTlMap] = useState<Record<string, TLEntry>>({});
    const [collToday, setCollToday] = useState<CollRow[]>([]);
    const [collWeek, setCollWeek] = useState<CollRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastRefresh, setLastRefresh] = useState(new Date());
    const [activeSection, setActiveSection] = useState<'overview' | 'zomato' | 'wallet' | 'watchlist'>('overview');
    const [negExpanded, setNegExpanded] = useState(false);

    const fetchAll = useCallback(async () => {
        if (!cityOpsId || tlIds.length === 0) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const ist = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
            const todayStr = ist.format(new Date());
            const [y, m] = todayStr.split('-').map(Number);
            const today = new Date(Date.UTC(y, m - 1, Number(todayStr.split('-')[2])));
            const diffMon = today.getUTCDay() === 0 ? 6 : today.getUTCDay() - 1;
            const monDate = new Date(today); monDate.setUTCDate(today.getUTCDate() - diffMon);
            const weekStartStr = monDate.toISOString().split('T')[0];

            const [ridersRes, leadsRes, tlRes, collTodayRes, collWeekRes] = await Promise.all([
                // Use team_leader_id scoping (more reliable than city_ops_id on riders)
                supabase.from('riders')
                    .select('id, status, wallet_amount, client_name, team_leader_id, allotment_date, inactivated_at')
                    .in('team_leader_id', tlIds),
                supabase.from('leads').select('id, status, created_by').in('created_by', tlIds),
                supabase.from('users').select('id, full_name, reporting_manager').in('id', tlIds),
                supabase.from('daily_collections').select('team_leader_id, total_collection').eq('date', todayStr).in('team_leader_id', tlIds),
                supabase.from('daily_collections').select('team_leader_id, total_collection').gte('date', weekStartStr).in('team_leader_id', tlIds),
            ]);

            setRiders((ridersRes.data || []) as RiderRaw[]);
            setLeads((leadsRes.data || []) as LeadRow[]);

            const tmap: Record<string, TLEntry> = {};
            (tlRes.data || []).forEach((t: TLEntry) => { tmap[t.id] = t; });
            setTlMap(tmap);

            setCollToday((collTodayRes.data || []) as CollRow[]);
            setCollWeek((collWeekRes.data || []) as CollRow[]);
            setLastRefresh(new Date());
        } catch (err) {
            console.error('[CityOps] fetchAll error:', err);
        } finally {
            setLoading(false);
        }
    }, [cityOpsId, tlIds]);

    useEffect(() => {
        if (!scopeLoading && cityOpsId && tlIds.length > 0) fetchAll();
    }, [scopeLoading, cityOpsId, tlIds.length, fetchAll]);

    // Real-time
    useEffect(() => {
        if (!cityOpsId) return;
        let timer: ReturnType<typeof setTimeout>;
        const ch = supabase.channel('cityops-rt')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'riders' }, () => { clearTimeout(timer); timer = setTimeout(fetchAll, 1500); })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_collections' }, () => { clearTimeout(timer); timer = setTimeout(fetchAll, 1500); })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => { clearTimeout(timer); timer = setTimeout(fetchAll, 1500); })
            .subscribe();
        return () => { supabase.removeChannel(ch); clearTimeout(timer); };
    }, [cityOpsId, fetchAll]);

    // ── Derived stats ──────────────────────────────────────────────────────────
    const stats = useMemo(() => {
        const active = riders.filter(r => r.status === 'active');
        const inactive = riders.filter(r => r.status === 'inactive');
        const deleted = riders.filter(r => r.status === 'deleted');

        // Client-wise (active only)
        const clientMap: Record<string, number> = {};
        active.forEach(r => {
            const c = r.client_name || 'Other';
            clientMap[c] = (clientMap[c] || 0) + 1;
        });

        // Zomato VPI — by chassis prefix
        const zomatoVPI = active.filter(r => r.client_name?.trim().toLowerCase() === 'zomato');

        // Wallet
        const walletPos = active.filter(r => (r.wallet_amount || 0) > 0);
        const walletNeg = active.filter(r => (r.wallet_amount || 0) < 0);
        const walletZero = active.filter(r => (r.wallet_amount || 0) === 0);
        const negAmtTotal = walletNeg.reduce((s, r) => s + Math.abs(r.wallet_amount || 0), 0);
        const posAmtTotal = walletPos.reduce((s, r) => s + (r.wallet_amount || 0), 0);

        // Risk watch
        const highDebt = active.filter(r => (r.wallet_amount || 0) < -3000);
        const lowBal = active.filter(r => (r.wallet_amount || 0) >= 0 && (r.wallet_amount || 0) <= 250);

        // Collections
        const todayColl = collToday.reduce((s, c) => s + (c.total_collection || 0), 0);
        const weekColl = collWeek.reduce((s, c) => s + (c.total_collection || 0), 0);

        // Per TL wallet bifurcation
        const tlWallet: Record<string, { name: string; rm: string; pos: number; neg: number; negAmt: number; total: number; }> = {};
        Object.entries(tlMap).forEach(([id, tl]) => {
            const tlActive = active.filter(r => r.team_leader_id === id);
            const tlNeg = tlActive.filter(r => (r.wallet_amount || 0) < 0);
            tlWallet[id] = {
                name: tl.full_name,
                rm: tl.reporting_manager || 'N/A',
                pos: tlActive.filter(r => (r.wallet_amount || 0) > 0).length,
                neg: tlNeg.length,
                negAmt: tlNeg.reduce((s, r) => s + Math.abs(r.wallet_amount || 0), 0),
                total: tlActive.length,
            };
        });

        // Leads
        const leadConv = leads.filter(l => l.status === 'Convert').length;
        const leadNotConv = leads.filter(l => l.status === 'Not Convert').length;
        const leadNew = leads.filter(l => l.status === 'New').length;

        // Today vs week per rider avg
        const perRiderToday = active.length > 0 ? Math.round(todayColl / active.length) : 0;
        const perRiderWeek = active.length > 0 ? Math.round(weekColl / active.length) : 0;

        // Fleet health %
        const fleetHealthPct = riders.length > 0 ? Math.round((active.length / riders.length) * 100) : 0;

        // Negative % of active
        const negPct = active.length > 0 ? Math.round((walletNeg.length / active.length) * 100) : 0;

        // Avg wallet (active)
        const avgWallet = active.length > 0
            ? Math.round(active.reduce((s, r) => s + (r.wallet_amount || 0), 0) / active.length)
            : 0;

        return {
            total: riders.length, active: active.length, inactive: inactive.length, deleted: deleted.length,
            clientMap, zomatoVPI: zomatoVPI.length,
            walletPos: walletPos.length, walletNeg: walletNeg.length, walletZero: walletZero.length,
            negAmtTotal, posAmtTotal, negPct, avgWallet,
            highDebt, lowBal,
            todayColl, weekColl, perRiderToday, perRiderWeek,
            leadConv, leadNotConv, leadNew, leads: leads.length,
            tlWallet: Object.values(tlWallet).sort((a, b) => b.negAmt - a.negAmt),
            fleetHealthPct, clientList: Object.entries(clientMap).sort((a, b) => b[1] - a[1]),
            highDebtCount: highDebt.length, lowBalCount: lowBal.length,
        };
    }, [riders, leads, collToday, collWeek, tlMap]);

    const todayCollAnim = useCountUp(stats.todayColl);
    void todayCollAnim; // used in HeroCard via value prop above
    const activeAnim = useCountUp(stats.active);
    void activeAnim;

    if (scopeLoading || (loading && riders.length === 0)) {
        return (
            <div className="space-y-6 animate-in fade-in duration-300 p-4">
                <div className="h-28 bg-gradient-to-r from-amber-500/20 to-orange-600/20 rounded-2xl animate-pulse" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="h-24 bg-card rounded-xl border border-border animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    const tabs = [
        { id: 'overview', label: '📊 Overview' },
        { id: 'zomato', label: '🟥 Client Fleet' },
        { id: 'wallet', label: '💳 Wallet Bifurcation' },
        { id: 'watchlist', label: '⚠️ Watchlist' },
    ] as const;

    return (
        <div className="space-y-5 pb-12 animate-in fade-in duration-300">

            {/* ── HERO BANNER ── */}
            <div className="bg-gradient-to-br from-amber-950 via-orange-950 to-black rounded-3xl p-6 shadow-2xl relative overflow-hidden border border-white/5">
                <div className="absolute -top-16 -left-16 w-64 h-64 bg-amber-500 rounded-full blur-[120px] opacity-10" />
                <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-orange-600 rounded-full blur-[100px] opacity-10" />
                <div className="relative flex flex-col md:flex-row justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2.5 bg-white/10 rounded-2xl border border-white/10">
                                <Zap className="h-6 w-6 text-amber-400" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-black text-white tracking-tight">
                                    {userData?.fullName?.split(' ')[0]}'s Command Center
                                </h1>
                                <p className="text-white/40 text-xs">{rmIds.length} RMs · {tlIds.length} TLs · Real-time sync</p>
                            </div>
                        </div>
                        {/* Summary pills */}
                        <div className="flex flex-wrap gap-2">
                            {[
                                { label: 'Active Fleet', value: `${stats.active}`, color: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/20' },
                                { label: 'Today Coll.', value: fmtShort(stats.todayColl), color: 'bg-blue-500/20 text-blue-300 border-blue-400/20' },
                                { label: 'Neg. Wallet', value: `${stats.walletNeg} (${stats.negPct}%)`, color: 'bg-rose-500/20 text-rose-300 border-rose-400/20' },
                                { label: 'Fleet Health', value: `${stats.fleetHealthPct}%`, color: 'bg-violet-500/20 text-violet-300 border-violet-400/20' },
                                { label: 'Leads', value: `${stats.leads}`, color: 'bg-indigo-500/20 text-indigo-300 border-indigo-400/20' },
                            ].map(({ label, value, color }, i) => (
                                <div key={i} className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase border ${color}`}>
                                    {label}: {value}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-start gap-2">
                        <button onClick={fetchAll} className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-xs text-white font-semibold transition-all">
                            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
                        </button>
                        <div className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/20 text-emerald-300 border border-emerald-400/20 rounded-xl text-[10px] font-black uppercase">
                            <Activity className="h-3 w-3 animate-pulse" /> Live
                        </div>
                    </div>
                </div>
                <p className="relative text-white/30 text-[10px] mt-3">
                    Last updated: {lastRefresh.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}
                </p>
            </div>

            {/* ── HERO CARDS ROW ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <HeroCard label="Active Riders" value={stats.active} live
                    subtitle={`${stats.inactive} idle · ${stats.deleted} deleted · ${stats.total} total`}
                    icon={UserCheck} gradient="bg-gradient-to-br from-emerald-600 to-teal-700"
                    onClick={() => navigate('/city-ops/riders')} />
                <HeroCard label="Today's Collection" value={stats.todayColl} prefix="₹"
                    subtitle={`Week: ${fmtShort(stats.weekColl)} · Per rider: ${fmtShort(stats.perRiderToday)}`}
                    icon={IndianRupee} gradient="bg-gradient-to-br from-blue-600 to-indigo-700"
                    onClick={() => navigate('/city-ops/reports')} />
                <HeroCard label="Negative Wallets" value={stats.walletNeg}
                    subtitle={`Total risk: ${fmtShort(stats.negAmtTotal)} · ${stats.negPct}% of active fleet`}
                    icon={AlertTriangle} gradient="bg-gradient-to-br from-rose-600 to-red-700"
                    onClick={() => setActiveSection('wallet')} />
            </div>

            {/* ── 8-TILE QUICK METRICS ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricTile label="Positive Wallet" value={stats.walletPos}
                    icon={Shield} iconColor="text-emerald-600" bgColor="bg-emerald-500/10"
                    suffix={` (${fmtShort(stats.posAmtTotal)})`}
                    onClick={() => setActiveSection('wallet')} />
                <MetricTile label="Zero Wallet" value={stats.walletZero}
                    icon={Wallet} iconColor="text-slate-500" bgColor="bg-slate-500/10" />
                <MetricTile label="High Debt (>₹3K)" value={stats.highDebtCount}
                    icon={TrendingDown} iconColor="text-red-600" bgColor="bg-red-500/10"
                    alert={stats.highDebtCount > 0} badge={stats.highDebtCount > 0 ? 'RISK' : undefined}
                    onClick={() => setActiveSection('watchlist')} />
                <MetricTile label="Low Balance (≤₹250)" value={stats.lowBalCount}
                    icon={Clock} iconColor="text-amber-600" bgColor="bg-amber-500/10"
                    badge={stats.lowBalCount > 0 ? 'WARN' : undefined}
                    onClick={() => setActiveSection('watchlist')} />
                <MetricTile label="Fleet Health" value={`${stats.fleetHealthPct}%` as unknown as number}
                    icon={BarChart3} iconColor="text-violet-600" bgColor="bg-violet-500/10" />
                <MetricTile label="Leads (Total)" value={stats.leads}
                    icon={Target} iconColor="text-indigo-600" bgColor="bg-indigo-500/10"
                    onClick={() => navigate('/city-ops/leads')} />
                <MetricTile label="Leads Converted" value={stats.leadConv}
                    icon={Star} iconColor="text-teal-600" bgColor="bg-teal-500/10" />
                <MetricTile label="Avg Wallet/Rider" value={stats.avgWallet}
                    icon={IndianRupee} iconColor="text-blue-600" bgColor="bg-blue-500/10" />
            </div>

            {/* ── SECTION TABS ── */}
            <div className="flex gap-2 overflow-x-auto pb-1">
                {tabs.map(t => (
                    <button key={t.id} onClick={() => setActiveSection(t.id)}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide whitespace-nowrap transition-all
                            ${activeSection === t.id ? 'bg-primary text-white shadow-md' : 'bg-card border border-border text-muted-foreground hover:bg-muted'}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ── OVERVIEW SECTION ── */}
            {activeSection === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    {/* Fleet Status Donut-style */}
                    <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm">
                        <h3 className="text-sm font-black mb-4 flex items-center gap-2">
                            <Users size={16} className="text-primary" /> Fleet Status Breakdown
                        </h3>
                        <div className="space-y-3">
                            {[
                                { label: 'Active', count: stats.active, total: stats.total, color: 'bg-emerald-500', text: 'text-emerald-600' },
                                { label: 'Inactive', count: stats.inactive, total: stats.total, color: 'bg-amber-500', text: 'text-amber-600' },
                                { label: 'Deleted', count: stats.deleted, total: stats.total, color: 'bg-rose-500', text: 'text-rose-600' },
                            ].map(({ label, count, total, color, text }) => {
                                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                                return (
                                    <div key={label}>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className={`font-bold ${text}`}>{label}</span>
                                            <span className="font-black">{count} <span className="text-muted-foreground font-normal">({pct}%)</span></span>
                                        </div>
                                        <div className="w-full bg-muted/40 rounded-full h-2">
                                            <div className={`${color} rounded-full h-2 transition-all duration-700`} style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="mt-4 pt-3 border-t border-border/30 grid grid-cols-3 gap-2 text-center">
                            <div>
                                <div className="text-lg font-black text-emerald-600">{stats.active}</div>
                                <div className="text-[9px] text-muted-foreground uppercase">Active</div>
                            </div>
                            <div>
                                <div className="text-lg font-black text-amber-600">{stats.inactive}</div>
                                <div className="text-[9px] text-muted-foreground uppercase">Idle</div>
                            </div>
                            <div>
                                <div className="text-lg font-black">{stats.total}</div>
                                <div className="text-[9px] text-muted-foreground uppercase">Total</div>
                            </div>
                        </div>
                    </div>

                    {/* Collection Card */}
                    <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm">
                        <h3 className="text-sm font-black mb-4 flex items-center gap-2">
                            <IndianRupee size={16} className="text-blue-500" /> Collection Overview
                        </h3>
                        <div className="space-y-3">
                            {[
                                { label: 'Today', amount: stats.todayColl, color: 'bg-blue-500 text-blue-600' },
                                { label: 'This Week', amount: stats.weekColl, color: 'bg-indigo-500 text-indigo-600' },
                            ].map(({ label, amount, color }) => (
                                <div key={label} className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-muted-foreground">{label}</span>
                                    <span className={`font-black text-sm ${color.split(' ')[1]}`}>{fmt(amount)}</span>
                                </div>
                            ))}
                        </div>
                        <div className="mt-4 pt-3 border-t border-border/30 grid grid-cols-2 gap-3">
                            <div className="bg-muted/30 rounded-xl p-3 text-center">
                                <div className="text-sm font-black text-blue-600">{fmtShort(stats.perRiderToday)}</div>
                                <div className="text-[9px] text-muted-foreground uppercase mt-0.5">Per Rider / Today</div>
                            </div>
                            <div className="bg-muted/30 rounded-xl p-3 text-center">
                                <div className="text-sm font-black text-indigo-600">{fmtShort(stats.perRiderWeek)}</div>
                                <div className="text-[9px] text-muted-foreground uppercase mt-0.5">Per Rider / Week</div>
                            </div>
                        </div>
                        {/* TL collection breakdown */}
                        {collToday.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-border/30 space-y-1.5 max-h-28 overflow-y-auto">
                                <p className="text-[9px] font-black uppercase text-muted-foreground mb-1">TL Breakdown (Today)</p>
                                {collToday.sort((a, b) => b.total_collection - a.total_collection).map(c => (
                                    <div key={c.team_leader_id} className="flex justify-between text-[10px]">
                                        <span className="text-muted-foreground truncate">{tlMap[c.team_leader_id]?.full_name || c.team_leader_id.slice(0, 8)}</span>
                                        <span className="font-black text-emerald-600">{fmtShort(c.total_collection)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Leads panel */}
                    <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm">
                        <h3 className="text-sm font-black mb-4 flex items-center gap-2">
                            <Target size={16} className="text-indigo-500" /> Lead Funnel
                        </h3>
                        <div className="space-y-2">
                            {[
                                { label: 'New', count: stats.leadNew, color: 'bg-blue-500', text: 'text-blue-600' },
                                { label: 'Converted', count: stats.leadConv, color: 'bg-emerald-500', text: 'text-emerald-600' },
                                { label: 'Not Convert', count: stats.leadNotConv, color: 'bg-rose-500', text: 'text-rose-600' },
                            ].map(({ label, count, color, text }) => {
                                const pct = stats.leads > 0 ? Math.round((count / stats.leads) * 100) : 0;
                                return (
                                    <div key={label}>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className={`font-bold ${text}`}>{label}</span>
                                            <span className="font-black">{count} <span className="text-muted-foreground">({pct}%)</span></span>
                                        </div>
                                        <div className="w-full bg-muted/40 rounded-full h-1.5">
                                            <div className={`${color} rounded-full h-1.5 transition-all duration-700`} style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="mt-3 text-center">
                            <span className="text-[10px] text-muted-foreground">Conversion Rate: </span>
                            <span className="text-sm font-black text-emerald-600">
                                {stats.leads > 0 ? Math.round((stats.leadConv / stats.leads) * 100) : 0}%
                            </span>
                        </div>
                    </div>

                    {/* Wallet health summary */}
                    <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm">
                        <h3 className="text-sm font-black mb-4 flex items-center gap-2">
                            <Wallet size={16} className="text-violet-500" /> Wallet Health
                        </h3>
                        <div className="space-y-2">
                            {[
                                { label: 'Positive', count: stats.walletPos, amt: stats.posAmtTotal, color: 'bg-emerald-500', text: 'text-emerald-600' },
                                { label: 'Negative', count: stats.walletNeg, amt: stats.negAmtTotal, color: 'bg-rose-500', text: 'text-rose-600' },
                                { label: 'Zero', count: stats.walletZero, amt: 0, color: 'bg-slate-400', text: 'text-slate-500' },
                            ].map(({ label, count, amt, color, text }) => {
                                const pct = stats.active > 0 ? Math.round((count / stats.active) * 100) : 0;
                                return (
                                    <div key={label}>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className={`font-bold ${text}`}>{label}</span>
                                            <span className="font-black">{count} <span className="text-muted-foreground">({pct}%) {amt > 0 ? fmtShort(amt) : ''}</span></span>
                                        </div>
                                        <div className="w-full bg-muted/40 rounded-full h-1.5">
                                            <div className={`${color} rounded-full h-1.5 transition-all duration-700`} style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="mt-3 pt-3 border-t border-border/30 flex justify-between text-xs">
                            <div>
                                <div className="font-black text-rose-600">{fmtShort(stats.negAmtTotal)}</div>
                                <div className="text-[9px] text-muted-foreground">Total Risk Exposure</div>
                            </div>
                            <div className="text-right">
                                <div className="font-black">{fmt(stats.avgWallet)}</div>
                                <div className="text-[9px] text-muted-foreground">Avg Wallet / Rider</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── CLIENT FLEET (ZOMATO VPI) SECTION ── */}
            {activeSection === 'zomato' && (
                <div className="space-y-4">
                    {/* Zomato VPI Hero */}
                    <div className="bg-gradient-to-br from-red-950 via-red-900 to-black rounded-2xl p-6 border border-red-500/20 shadow-xl relative overflow-hidden">
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-red-500 rounded-full blur-3xl opacity-10" />
                        <div className="relative flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-8 h-8 bg-red-600 rounded-xl flex items-center justify-center text-white font-black text-sm">Z</div>
                                    <h3 className="text-white font-black text-lg">Zomato Fleet</h3>
                                </div>
                                <div className="text-5xl font-black text-white">{stats.zomatoVPI}</div>
                                <p className="text-white/60 text-sm mt-1">
                                    {stats.active > 0 ? Math.round((stats.zomatoVPI / stats.active) * 100) : 0}% of active fleet
                                </p>
                            </div>
                            <div className="text-right">
                                <div className="text-white/50 text-xs font-bold uppercase">VPI Partner</div>
                                <div className="text-white font-black text-2xl mt-1">{stats.zomatoVPI}</div>
                            </div>
                        </div>
                    </div>

                    {/* Client-wise grid */}
                    <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm">
                        <h3 className="text-sm font-black mb-4 flex items-center gap-2">
                            <Bike size={16} className="text-primary" /> Client-wise Fleet Distribution
                        </h3>
                        <div className="space-y-3">
                            {stats.clientList.map(([client, count]) => {
                                const pct = stats.active > 0 ? Math.round((count / stats.active) * 100) : 0;
                                const colors: Record<string, string> = {
                                    'Zomato': 'bg-red-500', 'Swiggy': 'bg-orange-500', 'Blinkit': 'bg-yellow-500',
                                    'Zepto': 'bg-purple-500', 'Uber': 'bg-black', 'Porter': 'bg-blue-500',
                                    'Rapido': 'bg-amber-500', 'FLK': 'bg-teal-500', 'Other': 'bg-slate-400'
                                };
                                const bar = colors[client] || 'bg-slate-400';
                                return (
                                    <div key={client}>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="font-bold">{client}</span>
                                            <span className="font-black">{count} <span className="text-muted-foreground">({pct}%)</span></span>
                                        </div>
                                        <div className="w-full bg-muted/40 rounded-full h-2">
                                            <div className={`${bar} rounded-full h-2 transition-all duration-700`} style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* ── WALLET BIFURCATION ── */}
            {activeSection === 'wallet' && (
                <div className="space-y-4">
                    {/* Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5">
                            <div className="text-xs font-black uppercase text-emerald-600 mb-1">Positive Wallet Total</div>
                            <div className="text-3xl font-black text-emerald-600">{fmtShort(stats.posAmtTotal)}</div>
                            <div className="text-xs text-muted-foreground mt-1">{stats.walletPos} riders</div>
                        </div>
                        <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-5">
                            <div className="text-xs font-black uppercase text-rose-600 mb-1">Negative Wallet Total</div>
                            <div className="text-3xl font-black text-rose-600">-{fmtShort(stats.negAmtTotal)}</div>
                            <div className="text-xs text-muted-foreground mt-1">{stats.walletNeg} riders ({stats.negPct}%)</div>
                        </div>
                        <div className="bg-card border border-border/60 rounded-2xl p-5">
                            <div className="text-xs font-black uppercase text-muted-foreground mb-1">High Debt (&gt;₹3K)</div>
                            <div className="text-3xl font-black text-rose-700">{stats.highDebtCount}</div>
                            <div className="text-xs text-muted-foreground mt-1">Immediate attention needed</div>
                        </div>
                    </div>

                    {/* TL-wise bifurcation table */}
                    <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm">
                        <h3 className="text-sm font-black mb-4 flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <Wallet size={16} className="text-violet-500" /> TL-wise Wallet Bifurcation
                            </span>
                            <span className="text-[10px] text-muted-foreground font-normal">Sorted by negative exposure</span>
                        </h3>
                        <div className="divide-y divide-border/30">
                            <div className="flex items-center justify-between py-1.5 text-[9px] font-black uppercase text-muted-foreground">
                                <span className="w-40">Team Leader</span>
                                <div className="flex items-center gap-3">
                                    <span>POS</span><span>NEG</span><span>Neg Amt</span><span className="w-12">Risk %</span>
                                </div>
                            </div>
                            {stats.tlWallet.map(tl => (
                                <WalletBifRow key={tl.name} name={tl.name} pos={tl.pos} neg={tl.neg} negAmt={tl.negAmt} total={tl.total} />
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ── WATCHLIST ── */}
            {activeSection === 'watchlist' && (
                <div className="space-y-4">
                    {/* High Debt Riders */}
                    <div className="bg-card border border-rose-500/30 rounded-2xl p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-black flex items-center gap-2 text-rose-600">
                                <AlertTriangle size={16} /> High Debt Riders (Wallet &lt; -₹3,000)
                                <span className="bg-rose-500/20 text-rose-600 rounded-full px-2 py-0.5 text-[10px]">{stats.highDebt.length}</span>
                            </h3>
                            <button onClick={() => setNegExpanded(v => !v)} className="text-xs flex items-center gap-1 text-muted-foreground">
                                {negExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                {negExpanded ? 'Collapse' : 'Expand all'}
                            </button>
                        </div>
                        {stats.highDebt.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground text-sm">✓ No high-debt riders</div>
                        ) : (
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {stats.highDebt.slice(0, negExpanded ? undefined : 10).map(r => (
                                    <div key={r.id} className="flex items-center justify-between p-2.5 bg-rose-500/5 border border-rose-500/20 rounded-xl">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-600">
                                                <AlertTriangle size={10} />
                                            </div>
                                            <div>
                                                <div className="text-xs font-bold">{r.id.slice(0, 12)}…</div>
                                                <div className="text-[9px] text-muted-foreground">
                                                    {tlMap[r.team_leader_id]?.full_name || 'Unknown TL'} · {r.client_name}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs font-black text-rose-600">-{fmtShort(Math.abs(r.wallet_amount || 0))}</div>
                                        </div>
                                    </div>
                                ))}
                                {!negExpanded && stats.highDebt.length > 10 && (
                                    <button onClick={() => setNegExpanded(true)} className="w-full text-center text-xs text-primary py-2 hover:underline">
                                        +{stats.highDebt.length - 10} more riders
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Low balance */}
                    <div className="bg-card border border-amber-500/30 rounded-2xl p-5 shadow-sm">
                        <h3 className="text-sm font-black flex items-center gap-2 text-amber-600 mb-4">
                            <Clock size={16} /> Low Balance Riders (₹0 – ₹250)
                            <span className="bg-amber-500/20 text-amber-600 rounded-full px-2 py-0.5 text-[10px]">{stats.lowBal.length}</span>
                        </h3>
                        {stats.lowBal.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground text-sm">✓ No low-balance riders</div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                                {stats.lowBal.slice(0, 20).map(r => (
                                    <div key={r.id} className="flex items-center justify-between p-2 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                                        <div className="text-xs">
                                            <div className="font-bold truncate">{r.id.slice(0, 10)}…</div>
                                            <div className="text-[9px] text-muted-foreground">{tlMap[r.team_leader_id]?.full_name || '—'}</div>
                                        </div>
                                        <div className="text-xs font-black text-amber-600">{fmt(r.wallet_amount || 0)}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── TEAM SUMMARY FOOTER ── */}
            <div className="bg-card border border-border/60 rounded-2xl p-4">
                <h3 className="text-xs font-black uppercase text-muted-foreground mb-3">Team Structure</h3>
                <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-muted/30 rounded-xl p-3">
                        <div className="text-2xl font-black">{rmIds.length}</div>
                        <div className="text-[9px] text-muted-foreground uppercase mt-0.5">Reporting Managers</div>
                    </div>
                    <div className="bg-muted/30 rounded-xl p-3">
                        <div className="text-2xl font-black">{tlIds.length}</div>
                        <div className="text-[9px] text-muted-foreground uppercase mt-0.5">Team Leaders</div>
                    </div>
                    <div className="bg-muted/30 rounded-xl p-3">
                        <div className="text-2xl font-black">{stats.active}</div>
                        <div className="text-[9px] text-muted-foreground uppercase mt-0.5">Active Riders</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CityOpsDashboard;
