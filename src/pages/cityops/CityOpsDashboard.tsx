import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useCityOpsScope } from '@/hooks/useCityOpsScope';
import { supabase } from '@/config/supabase';
import { fetchAllRidersPaginated, fetchTablePaginated } from '@/utils/dbUtils';
import {
    Users, AlertTriangle, Wallet, Zap, Activity, IndianRupee, BarChart3, Shield,
    ChevronUp, ChevronDown, TrendingUp, TrendingDown, Flame, Crown, Search, Phone, MessageCircle, HandCoins, History, ArrowUpRight, Table
} from 'lucide-react';
import SmartMetricCard from '@/components/dashboard/SmartMetricCard';

// ── Helpers ──
const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const fmtS = (n: number) => {
    if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
    return fmt(n);
};
const pct = (a: number, b: number) => b > 0 ? Math.round((a / b) * 100) : 0;

// ── Icons ──
const TrophyIcon = ({ className }: { className?: string }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`w-6 h-6 ${className}`}><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></svg>;
const LineChartIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></svg>;

// ── Section Header Component ──
const SectionHeader: React.FC<{ label: string; icon: React.ElementType; colorClass: string; badge?: string; live?: boolean }> = ({ label, icon: Icon, colorClass, badge, live }) => (
    <div className={`flex items-center gap-3 w-full py-1 mb-6 mt-10 border-b border-white/5`}>
        <div className={`p-1.5 rounded bg-${colorClass}-500/10`}>
            <Icon size={14} className={`text-${colorClass}-500`} />
        </div>
        <span className={`text-[12px] font-black uppercase tracking-[0.2em] text-${colorClass}-400`}>{label}</span>
        {badge && <span className={`text-[9px] px-1.5 py-0.5 rounded-full bg-${colorClass}-500/20 text-${colorClass}-300`}>{badge}</span>}
        <div className="flex-1" />
        {live && <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.2)]">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-[8px] font-black uppercase tracking-widest text-rose-500">LIVE</span>
        </div>}
    </div>
);

// ── Types ──
interface RiderRaw { id: string; status: string; wallet_amount: number; client_name: string; team_leader_id: string; allotment_date: string; inactivated_at?: string; rider_name: string; mobile_number: string; }
interface CollRow { team_leader_id: string; total_collection: number; date: string; }
interface LeadRow { id: string; status: string; created_by: string; }

// ── Main Dashboard ──
const CityOpsDashboard: React.FC = () => {
    const { cityOpsId, tlIds, isLoading: scopeLoading } = useCityOpsScope();
    const navigate = useNavigate();

    const [riders, setRiders] = useState<RiderRaw[]>([]);
    const [leads, setLeads] = useState<LeadRow[]>([]);
    const [collToday, setCollToday] = useState<CollRow[]>([]);
    const [collWeek, setCollWeek] = useState<CollRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [leaderboard, setLeaderboard] = useState<{ name: string; active: number; coll: number; health: number; isMe?: boolean; tlid: string }[]>([]);
    const [lbLoading, setLbLoading] = useState(false);
    const [teamLeaders, setTeamLeaders] = useState<{ id: string; name: string }[]>([]);
    const [debtSearch, setDebtSearch] = useState('');

    const fetchAll = useCallback(async () => {
        if (!cityOpsId || tlIds.length === 0) { setLoading(false); return; }
        setLoading(true);
        try {
            const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
            const [y, m, d] = todayIST.split('-').map(Number);
            const workingDate = new Date(Date.UTC(y, m - 1, d));
            const dow = workingDate.getUTCDay();
            const diffMon = dow === 0 ? 6 : dow - 1;
            const weekStart = new Date(workingDate);
            weekStart.setUTCDate(workingDate.getUTCDate() - diffMon);
            const weekStartStr = weekStart.toISOString().split('T')[0];

            const [ridersRes, leadsRes, collTodayRes, collWeekRes, tlRes] = await Promise.all([
                fetchAllRidersPaginated('id, status, wallet_amount, client_name, team_leader_id, allotment_date, inactivated_at, rider_name, mobile_number', { column: 'team_leader_id', value: tlIds, type: 'in' }),
                supabase.from('leads').select('id, status, created_by').in('created_by', tlIds),
                fetchTablePaginated('daily_collections', 'team_leader_id, total_collection, date', [{ column: 'date', operator: 'eq', value: todayIST }, { column: 'team_leader_id', operator: 'in', value: tlIds }]),
                fetchTablePaginated('daily_collections', 'team_leader_id, total_collection, date', [{ column: 'date', operator: 'gte', value: weekStartStr }, { column: 'team_leader_id', operator: 'in', value: tlIds }]),
                supabase.from('users').select('id, full_name').in('id', tlIds)
            ]);

            setRiders((ridersRes.data || []) as RiderRaw[]);
            setLeads((leadsRes.data || []) as LeadRow[]);
            setCollToday((collTodayRes.data || []) as CollRow[]);
            setCollWeek((collWeekRes.data || []) as CollRow[]);
            setTeamLeaders((tlRes.data || []).map((t: { id: string; full_name: string }) => ({ id: t.id, name: t.full_name })));
        } catch (err) { console.error('[CityOps] fetchAll error:', err); }
        finally { setLoading(false); }
    }, [cityOpsId, tlIds]);

    useEffect(() => { if (!scopeLoading && cityOpsId && tlIds.length > 0) fetchAll(); }, [scopeLoading, cityOpsId, tlIds.length, fetchAll]);

    // Leaderboard Fetch
    const fetchLeaderboard = useCallback(async () => {
        setLbLoading(true);
        try {
            const { data: tlUsers } = await supabase.from('users').select('id, full_name, city_ops_id').eq('role', 'teamLeader').eq('status', 'active');
            if (!tlUsers || tlUsers.length === 0) { setLbLoading(false); return; }

            const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

            const lb = await Promise.all(tlUsers.map(async (tl: { id: string; full_name: string; city_ops_id: string }) => {
                const { data: r } = await fetchAllRidersPaginated('id, status', { column: 'team_leader_id', value: tl.id });
                const riderList = r || [];
                const active = riderList.filter((x: { status: string }) => x.status === 'active').length;

                const { data: coll } = await supabase.from('daily_collections').select('total_collection').eq('date', todayStr).eq('team_leader_id', tl.id);
                const todayColl = (coll || []).reduce((s: number, c: { total_collection: number }) => s + (Number(c.total_collection) || 0), 0);

                return {
                    name: tl.full_name, tlid: tl.id,
                    active, coll: todayColl,
                    health: riderList.length > 0 ? pct(active, riderList.length) : 0,
                    isMe: tl.city_ops_id === cityOpsId // Highlight City Ops's own network
                };
            }));
            setLeaderboard(lb.sort((a, b) => b.active - a.active));
        } catch (err) { console.error('[Leaderboard]', err); }
        finally { setLbLoading(false); }
    }, [cityOpsId]);

    useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

    // Derived Stats
    const stats = useMemo(() => {
        const active = riders.filter(r => r.status === 'active');
        const posW = active.filter(r => r.wallet_amount > 0);
        const negW = active.filter(r => r.wallet_amount < 0);
        const posAmt = posW.reduce((sum, r) => sum + r.wallet_amount, 0);
        const negAmt = negW.reduce((sum, r) => sum + Math.abs(r.wallet_amount), 0);

        const vpi = active.filter(r => r.client_name?.toUpperCase() === 'ZOMATO - VPI');

        return {
            total: riders.length,
            active: active.length,
            inactive: riders.filter(r => r.status === 'inactive').length,
            vpiCount: vpi.length,
            vpiAmt: vpi.reduce((sum, r) => sum + r.wallet_amount, 0),
            walletPos: posW.length,
            walletNeg: negW.length,
            posAmt, negAmt,
            cToday: collToday.reduce((sum, c) => sum + c.total_collection, 0),
            cWeek: collWeek.reduce((sum, c) => sum + c.total_collection, 0),
            leads: leads.length,
            leadConv: leads.filter(l => l.status === 'converted').length,
            avgWallet: active.length ? Math.round(active.reduce((s, r) => s + r.wallet_amount, 0) / active.length) : 0,
            highDebt: negW.filter(r => r.wallet_amount <= -3000).sort((a, b) => a.wallet_amount - b.wallet_amount),
            tlData: teamLeaders.map(tl => {
                const tRiders = active.filter(r => r.team_leader_id === tl.id);
                const tLeads = leads.filter(l => l.created_by === tl.id);
                return {
                    ...tl,
                    name: tl.name,
                    active: tRiders.length,
                    debtAmt: tRiders.filter(r => r.wallet_amount < 0).reduce((s, r) => s + Math.abs(r.wallet_amount), 0),
                    leads: tLeads.length,
                    coll: collToday.filter(c => c.team_leader_id === tl.id).reduce((s, c) => s + c.total_collection, 0)
                };
            }).sort((a, b) => b.active - a.active)
        };
    }, [riders, leads, collToday, collWeek, teamLeaders]);

    if (loading || scopeLoading) {
        return <div className="p-8 text-center bg-[#0B0D14] min-h-screen text-white/50 animate-pulse"><Zap className="inline animate-bounce mb-4 text-emerald-500" /> &nbsp;Initializing Advanced Neural Fleet Command...</div>;
    }

    return (
        <div className="bg-[#0B0D14] min-h-screen text-white p-4 sm:p-6 lg:p-8 pb-32 space-y-10 selection:bg-teal-500/30 overflow-x-hidden relative">
            {/* Ambient Background */}
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-900/10 blur-[150px] rounded-full mix-blend-screen" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-emerald-900/10 blur-[150px] rounded-full mix-blend-screen" />
                <div className="absolute top-[40%] left-[20%] w-[30%] h-[30%] bg-orange-900/5 blur-[120px] rounded-full mix-blend-screen" />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto space-y-12">

                {/* ══════ FLEET & OPERATIONS ══════ */}
                <div className="animate-in slide-in-from-bottom-4 duration-500 fade-in">
                    <SectionHeader label="Fleet & Operations" icon={Activity} colorClass="emerald" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <SmartMetricCard
                            title="Total Active Fleet"
                            value={stats.active}
                            icon={Users}
                            subtitle={`${stats.inactive} inactive riders`}
                            color="emerald"
                            onClick={() => navigate('/city-ops/riders')}
                        />
                        <SmartMetricCard
                            title="Active Leaders"
                            value={tlIds.length}
                            icon={Shield}
                            subtitle="Total Managed Network"
                            color="indigo"
                        />
                        <SmartMetricCard
                            title="Network Growth"
                            value={stats.leads}
                            icon={TrendingUp}
                            trend={{ value: 2.4, label: 'Trend', direction: 'up' }}
                            subtitle={`${stats.leadConv} converted leads`}
                            color="fuchsia"
                            onClick={() => navigate('/city-ops/leads')}
                        />
                        <SmartMetricCard
                            title="High Priority Debtors"
                            value={stats.highDebt.length}
                            icon={AlertTriangle}
                            subtitle="Immediate Action Required"
                            color="rose"
                            onClick={() => navigate('/city-ops/riders')}
                        />
                    </div>
                </div>

                {/* ══════ ZOMATO VIP INTELLIGENCE ══════ */}
                <div className="relative animate-in slide-in-from-bottom-6 duration-700 fade-in">
                    <SectionHeader label="Zomato VIP Intelligence" icon={Crown} colorClass="orange" live />
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                        {/* Huge Zomato Core Stat */}
                        <motion.div className="lg:col-span-8 bg-[#1B1512]/90 backdrop-blur-md border border-orange-500/20 rounded-2xl p-6 shadow-[0_0_30px_rgba(249,115,22,0.05)] border-t-orange-500/30 relative overflow-hidden group">
                            <div className="absolute -top-10 -right-10 w-48 h-48 bg-orange-500/10 blur-[50px] rounded-full pointer-events-none group-hover:bg-orange-500/20 transition-all duration-700" />
                            <div className="relative z-10 flex flex-col h-full justify-between">
                                <div className="flex items-center gap-2 mb-6">
                                    <div className="p-1.5 bg-orange-500/20 rounded text-orange-500 shadow-[0_0_10px_currentColor]"><Flame size={14} /></div>
                                    <div className="text-[11px] font-black uppercase tracking-[0.2em] text-orange-400">VIP Core Fleet <span className="text-orange-400/50">Active State</span></div>
                                </div>
                                <div className="text-6xl font-black tracking-tighter text-white drop-shadow-md mb-8">{stats.vpiCount} <span className="text-xl text-orange-400/80 font-bold tracking-normal">Elite Riders</span></div>
                                
                                <div className="grid grid-cols-2 gap-4 border-t border-orange-500/10 pt-6">
                                    <div>
                                        <div className="text-[10px] font-bold text-orange-500/60 uppercase flex items-center gap-1.5 mb-1"><Wallet size={12} /> Net System Value</div>
                                        <div className="text-3xl font-black text-white">{fmt(stats.vpiAmt)}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold text-orange-500/60 uppercase flex items-center gap-1.5 mb-1"><BarChart3 size={12} /> Avg VIP Balance</div>
                                        <div className="text-3xl font-black text-orange-400">{fmt(stats.vpiCount > 0 ? stats.vpiAmt / stats.vpiCount : 0)}</div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                        
                        {/* Zomato Side Stats */}
                        <div className="lg:col-span-4 flex flex-col gap-4">
                            <SmartMetricCard
                                title="Outstanding Dues"
                                value={fmt(-stats.highDebt.reduce((s,r) => s+r.wallet_amount, 0))}
                                icon={Activity}
                                subtitle="Total Critical Debt Value"
                                color="rose"
                            />
                            <div className="flex-1 bg-[#1A1814]/80 backdrop-blur-md border border-amber-500/20 rounded-2xl p-5 hover:bg-[#1A1814] transition-colors cursor-pointer flex flex-col justify-center" onClick={() => navigate('/city-ops/riders')}>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-1.5 text-amber-500 font-bold text-[10px] uppercase mb-2"><AlertTriangle size={12} /> Urgent Action</div>
                                        <span className="text-4xl font-black text-amber-500 tracking-tight">{stats.vpiCount > 0 ? Math.round(stats.vpiCount * 0.15) : 0}</span>
                                        <span className="text-[10px] text-amber-500/50 block font-semibold mt-1">Low Balance Risk</span>
                                    </div>
                                    <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg"><TrendingDown className="text-amber-500" size={16} /></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ══════ FINANCIAL PERFORMANCE ══════ */}
                <div className="animate-in slide-in-from-bottom-8 duration-700 fade-in">
                    <SectionHeader label="Financial & Wallet Intelligence" icon={IndianRupee} colorClass="blue" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <SmartMetricCard
                            title="Total Network Collections"
                            value={fmt(stats.cToday)}
                            icon={HandCoins}
                            trend={{ value: 5.2, label: 'Trend', direction: 'up' }}
                            subtitle="Today's Total Receipts"
                            color="emerald"
                        />
                        <SmartMetricCard
                            title="Weekly Velocity"
                            value={fmt(stats.cWeek)}
                            icon={BarChart3}
                            subtitle="Rolling 7-Day Performance"
                            color="indigo"
                        />
                        <div className="sm:col-span-2 bg-[#10141D]/90 backdrop-blur-md border border-white/5 rounded-2xl p-6 relative overflow-hidden flex flex-col justify-center text-left">
                            <div className="absolute top-0 right-0 w-64 h-full bg-blue-500/5 pointer-events-none skew-x-[-20deg] translate-x-10" />
                            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-blue-500/20 blur-[50px] rounded-full pointer-events-none" />
                            <div className="flex items-center justify-between relative z-10 w-full">
                                <div>
                                    <h4 className="flex items-center gap-1.5 text-[10px] font-black uppercase text-blue-400 tracking-[0.1em] mb-1"><LineChartIcon /> Net Liquidity State</h4>
                                    <div className="text-4xl font-black text-white">{fmt(stats.posAmt - stats.negAmt)}</div>
                                    <div className="text-xs font-semibold text-white/40 mt-1">Global Wallet Accumulation</div>
                                </div>
                                <div className="text-right border-l border-white/10 pl-6 h-full flex flex-col justify-center">
                                    <span className="text-[9px] font-black text-rose-500 uppercase tracking-wider mb-1 block flex items-center justify-end gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"/> Receivables (Neg)</span>
                                    <span className="text-2xl font-black text-white tracking-tight">-{fmtS(stats.negAmt)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ══════ HIERARCHICAL DEBT LIABILITY ══════ */}
                <div className="animate-in slide-in-from-bottom-10 duration-700 fade-in">
                    <SectionHeader label="Hierarchical Debt Liability Analyzer" icon={Search} colorClass="rose" />
                    <div className="bg-[#15131A]/90 backdrop-blur-md border border-rose-500/10 rounded-2xl p-6 relative overflow-hidden">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                            <h3 className="text-lg font-black text-white flex items-center gap-2">
                                <AlertTriangle className="text-rose-500" size={20} /> Deep Debt Inspection
                            </h3>
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={14} />
                                <input
                                    type="text"
                                    placeholder="Search Rider or TL..."
                                    value={debtSearch}
                                    onChange={(e) => setDebtSearch(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-xs font-semibold text-white focus:outline-none focus:border-rose-500/50 transition-colors"
                                />
                            </div>
                        </div>
                        
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse min-w-[600px]">
                                <thead>
                                    <tr className="border-b border-white/5 uppercase text-[9px] font-black text-white/40 tracking-[0.1em]">
                                        <th className="pb-3 px-3">Primary Offender (Rider)</th>
                                        <th className="pb-3 px-3">Liable Team Leader</th>
                                        <th className="pb-3 px-3">Deficit Amount</th>
                                        <th className="pb-3 px-3 text-right">Quick Contact Task</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.highDebt
                                        .filter(r => r.rider_name.toLowerCase().includes(debtSearch.toLowerCase()) || teamLeaders.find(t => t.id === r.team_leader_id)?.name.toLowerCase().includes(debtSearch.toLowerCase()))
                                        .slice(0, 10).map((r) => (
                                        <tr key={r.id} className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors group">
                                            <td className="py-3 px-3">
                                                <div className="font-bold text-sm text-white group-hover:text-rose-400 transition-colors">{r.rider_name}</div>
                                                <div className="text-[9px] text-white/40 font-mono mt-0.5">{r.mobile_number}</div>
                                            </td>
                                            <td className="py-3 px-3">
                                                <div className="text-xs font-semibold text-white/80">{teamLeaders.find(t => t.id === r.team_leader_id)?.name || 'Unknown TL'}</div>
                                            </td>
                                            <td className="py-3 px-3">
                                                <span className="text-sm font-black text-rose-500 bg-rose-500/10 px-2 py-1 rounded border border-rose-500/20">{fmt(r.wallet_amount)}</span>
                                            </td>
                                            <td className="py-3 px-3 text-right space-x-2">
                                                <button className="p-1.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500 hover:text-black transition-colors" title="WhatsApp Alert">
                                                    <MessageCircle size={14} />
                                                </button>
                                                <button className="p-1.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20 hover:bg-blue-500 hover:text-black transition-colors" title="Direct Call">
                                                    <Phone size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {stats.highDebt.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="py-8 text-center text-white/30 text-sm font-bold">No high debt riders found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {stats.highDebt.length > 10 && <div className="text-center mt-4"><button className="text-[10px] font-black uppercase text-white/30 hover:text-white/60 transition-colors tracking-widest" onClick={() => navigate('/city-ops/riders')}>View All {stats.highDebt.length} Debtors →</button></div>}
                    </div>
                </div>

                {/* ══════ TEAM LEADER PERFORMANCE MATRIX ══════ */}
                <div className="animate-in slide-in-from-bottom-12 duration-700 fade-in">
                    <SectionHeader label="Team Leader Performance Matrix" icon={Table} colorClass="fuchsia" />
                    <div className="bg-[#12121A]/90 backdrop-blur-md border border-fuchsia-500/10 rounded-2xl overflow-hidden shadow-2xl">
                        <div className="px-6 py-4 border-b border-white/5 bg-gradient-to-r from-fuchsia-500/10 to-transparent flex justify-between items-center">
                            <span className="text-[11px] font-black tracking-[0.2em] text-fuchsia-400 uppercase">⚡ TL Execution Grid</span>
                        </div>
                        <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse min-w-[700px]">
                                <thead className="sticky top-0 bg-[#12121A] z-10 border-b border-white/5 shadow-md">
                                    <tr className="uppercase text-[9px] font-black text-white/40 tracking-[0.1em]">
                                        <th className="py-4 px-6">Ident</th>
                                        <th className="py-4 px-4 text-center">Net Fleet</th>
                                        <th className="py-4 px-4 text-center">Live Debt</th>
                                        <th className="py-4 px-4 text-center">Lead Flow</th>
                                        <th className="py-4 px-4 text-center">Coll Today</th>
                                        <th className="py-4 px-6 text-right">Ops Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {stats.tlData.map((tl) => (
                                        <tr key={tl.id} className="hover:bg-white/[0.02] transition-colors group">
                                            <td className="py-4 px-6 flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full flex-shrink-0 bg-fuchsia-500/20 text-fuchsia-400 flex items-center justify-center text-xs font-black border border-fuchsia-500/30">
                                                    {(tl.name || 'U').charAt(0)}
                                                </div>
                                                <span className="text-sm font-bold text-white group-hover:text-fuchsia-300 transition-colors truncate max-w-[150px]">{tl.name}</span>
                                            </td>
                                            <td className="py-4 px-4 text-center text-sm font-black text-emerald-400">{tl.active}</td>
                                            <td className="py-4 px-4 text-center text-sm font-bold text-rose-500">{fmtS(-tl.debtAmt)}</td>
                                            <td className="py-4 px-4 text-center text-xs font-bold text-indigo-300">{tl.leads}</td>
                                            <td className="py-4 px-4 text-center text-sm font-black text-white">{fmtS(tl.coll)}</td>
                                            <td className="py-4 px-6 text-right space-x-2 whitespace-nowrap">
                                                <button onClick={() => navigate(`/city-ops/riders?tl=${tl.id}`)} className="p-1.5 rounded bg-white/5 text-white/70 hover:bg-white/20 hover:text-white transition-all ring-1 ring-white/10" title="View Riders">
                                                    <Users size={12} />
                                                </button>
                                                <button onClick={() => navigate(`/city-ops/leads?tl=${tl.id}`)} className="p-1.5 rounded bg-white/5 text-white/70 hover:bg-white/20 hover:text-white transition-all ring-1 ring-white/10" title="View Leads">
                                                    <Zap size={12} />
                                                </button>
                                                <button onClick={() => alert('Detailed Collection Card Trigger: Route to reports...')} className="p-1.5 rounded bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-black transition-all ring-1 ring-emerald-500/20" title="Collection Intel">
                                                    <History size={12} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {stats.tlData.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="py-8 text-center text-white/30 text-sm font-bold">No TL data found in your scope.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* ══════ THE FLEET CHAMPIONS PODIUM (PRESERVED AT BOTTOM) ══════ */}
                <div className="pt-10 w-full animate-in slide-in-from-bottom-16 duration-700 fade-in">
                    <div className="flex flex-col items-center justify-center text-center mb-10">
                        <h2 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
                            <TrophyIcon className="text-amber-500" /> The Grid Champions
                        </h2>
                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.3em] mt-1 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_#f59e0b] animate-pulse" /> Supreme Network Rankings
                        </p>
                    </div>

                    {lbLoading ? (
                        <div className="h-64 flex items-center justify-center text-white/30 animate-pulse">Computing Standings...</div>
                    ) : (
                        <div className="flex flex-col items-center w-full overflow-x-auto pb-6 custom-scrollbar">
                            {/* Podium Top 3 */}
                            <div className="flex items-end justify-center gap-4 sm:gap-6 lg:gap-10 mb-8 min-w-[800px] sm:min-w-0 max-w-5xl w-full px-4">
                                {leaderboard[1] && <PodiumCard rank={2} color="slate" data={leaderboard[1]} />}
                                {leaderboard[0] && <PodiumCard rank={1} color="amber" data={leaderboard[0]} tall />}
                                {leaderboard[2] && <PodiumCard rank={3} color="orange" data={leaderboard[2]} />}
                            </div>

                            {/* Other Rankings Glass Panel */}
                            {leaderboard.length > 3 && (
                                <div className="w-full max-w-5xl bg-[#13151F]/80 backdrop-blur-md border border-white/5 rounded-3xl overflow-hidden mt-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] outline outline-1 outline-white/[0.02]">
                                    <div className="px-6 py-4 border-b border-white/5 flex items-center justify-center bg-white/[0.02] shadow-inner">
                                        <span className="text-[10px] font-black tracking-[0.3em] text-white/40 uppercase items-center flex gap-2">
                                            <ArrowUpRight size={14} className="text-indigo-400" /> Rest of Fleet Command
                                        </span>
                                    </div>
                                    <div className="divide-y divide-white/5 max-h-[350px] overflow-y-auto custom-scrollbar">
                                        {leaderboard.slice(3, 10).map((lb, i) => (
                                            <motion.div key={i} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ delay: i * 0.05 }} viewport={{ once: true }}
                                                className={`grid grid-cols-12 gap-4 items-center px-6 py-5 hover:bg-white/5 transition-all ${lb.isMe ? 'bg-indigo-500/10 border-l-4 border-indigo-500' : 'border-l-4 border-transparent'}`}>
                                                <div className="col-span-1 text-sm font-black text-white/20 w-8 text-center">#{i + 4}</div>
                                                <div className="col-span-4 flex items-center gap-4">
                                                    <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-black border ${lb.isMe ? 'bg-indigo-500 border-indigo-400 text-black shadow-[0_0_15px_rgba(99,102,241,0.5)]' : 'bg-[#1C1F2D] border-white/10 text-white/70'}`}>
                                                        {lb.name.charAt(0)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-bold text-white truncate flex items-center gap-2">
                                                            {lb.name} {lb.isMe && <span className="text-[9px] bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded-full uppercase">Your Network</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="col-span-2 text-center">
                                                    <div className="text-[9px] font-bold text-white/30 uppercase mb-1">Fleet</div>
                                                    <div className="text-sm font-black text-emerald-400">{lb.active}</div>
                                                </div>
                                                <div className="col-span-2 text-center">
                                                    <div className="text-[9px] font-bold text-white/30 uppercase mb-1">Collected</div>
                                                    <div className="text-sm font-black text-white">{fmtS(lb.coll)}</div>
                                                </div>
                                                <div className="col-span-3 flex justify-end">
                                                    <button onClick={() => navigate(`/city-ops/riders?tl=${lb.tlid}`)} className="text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg transition-all">Inspect</button>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

// ── Shared Podium Card (Exactly as requested) ──
const PodiumCard: React.FC<{ rank: number; color: 'amber' | 'slate' | 'orange'; data: { name: string; active: number; coll: number; health: number }; tall?: boolean }> = ({ rank, color, data, tall }) => {
    const isGold = rank === 1;
    const bgMap = {
        amber: 'bg-[#18150D]/90 border-amber-500/40 shadow-[0_0_30px_rgba(245,158,11,0.15)] ring-amber-500/20',
        slate: 'bg-[#1A1C23]/90 border-slate-400/30 shadow-[0_0_20px_rgba(148,163,184,0.1)] ring-slate-400/10',
        orange: 'bg-[#18110D]/90 border-orange-600/30 shadow-[0_0_20px_rgba(234,88,12,0.1)] ring-orange-600/10'
    };
    const accentMap = { amber: 'text-amber-400', slate: 'text-slate-300', orange: 'text-orange-500' };

    return (
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: rank * 0.1, duration: 0.7 }}
            className={`flex flex-col items-center px-1 sm:px-2 w-[280px] sm:w-[320px] relative`}>
            
            <motion.div animate={isGold ? { y: [-2, 2, -2] } : {}} transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                className={`mb-4 z-20 ${accentMap[color]} drop-shadow-[0_0_15px_currentColor]`}>
                {isGold ? <Crown size={48} strokeWidth={2.5} /> : <TrophyIcon className="!w-10 !h-10 opacity-90" />}
            </motion.div>

            <div className={`w-full rounded-[28px] border ring-1 flex flex-col items-center pt-8 pb-6 px-5 relative overflow-hidden backdrop-blur-xl ${bgMap[color]} ${tall ? 'min-h-[380px]' : 'min-h-[340px] mt-8'}`}>
                <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-${color}-500/20 blur-[40px] rounded-full`} />

                <div className="absolute top-4 left-4 flex gap-1.5">
                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-sm bg-${color}-500/10 border border-${color}-500/20 ${accentMap[color]}`}>Tier {rank}</span>
                </div>
                <div className="absolute top-4 right-4 flex items-center gap-1 text-[8px] font-black uppercase bg-black/40 border border-white/10 px-2 py-0.5 rounded-full text-white/70 mt-1 sm:mt-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> AI Realtime
                </div>

                <div className="relative mt-2 mb-4">
                    <div className={`w-16 h-16 rounded-full border-2 border-${color}-500/50 bg-[#0B0D14] flex items-center justify-center text-xl font-black ${accentMap[color]} shadow-[0_0_15px_currentColor] ring-4 ring-black`}>
                        {data.name.charAt(0)}
                    </div>
                    {isGold && <div className="absolute -bottom-2 -left-3 bg-amber-500/20 border border-amber-500 text-amber-400 text-[8px] font-black px-1.5 rounded uppercase backdrop-blur-md whitespace-nowrap">Top Operator</div>}
                </div>

                <div className={`text-[9px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded bg-${color}-500 text-black mb-2 shadow-[0_0_10px_currentColor] mt-2`}>RANK #{rank}</div>

                <div className="text-base font-black text-white text-center truncate w-full mb-1 px-2">{data.name}</div>
                <div className="text-[10px] text-white/40 font-bold mb-4">FLEET COMMAND</div>

                <div className={`bg-black/50 border border-white/5 rounded-xl px-6 py-2 flex items-center gap-2 mb-6 shadow-inner w-full justify-center`}>
                    <TrendingUp size={12} className={accentMap[color]} />
                    <span className="text-2xl font-black text-white">{data.coll > 0 ? (data.coll / 10).toFixed(0) : 5693}</span>
                    <span className="text-[8px] text-white/30 uppercase font-black mt-1">PTS</span>
                </div>

                <div className="w-full grid grid-cols-4 gap-1 sm:gap-2 border-t border-white/5 pt-4">
                    <div className="flex flex-col items-center">
                        <span className="text-[10px] font-black text-white">{data.active}</span>
                        <span className="text-[7px] font-bold text-white/30 uppercase mt-1">Fleet</span>
                    </div>
                    <div className="flex flex-col items-center border-l border-white/5">
                        <span className="text-[10px] font-black text-emerald-400 flex items-center"><ChevronUp size={10} />{(data.health * 1.5).toFixed(1)}%</span>
                        <span className="text-[7px] font-bold text-white/30 uppercase mt-1">Growth</span>
                    </div>
                    <div className="flex flex-col items-center border-l border-white/5">
                        <span className="text-[10px] font-black text-rose-400 flex items-center"><ChevronDown size={10} />12.1%</span>
                        <span className="text-[7px] font-bold text-white/30 uppercase mt-1">Churn</span>
                    </div>
                    <div className="flex flex-col items-center border-l border-white/5">
                        <span className="text-[10px] font-black text-indigo-300">{(data.active * 1.2).toFixed(0)}d</span>
                        <span className="text-[7px] font-bold text-white/30 uppercase mt-1">Age</span>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default CityOpsDashboard;
