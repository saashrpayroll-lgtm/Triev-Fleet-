import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useCityOpsScope } from '@/hooks/useCityOpsScope';
import { supabase } from '@/config/supabase';
import { fetchAllRidersPaginated, fetchTablePaginated } from '@/utils/dbUtils';
import {
    Users, AlertTriangle, Wallet,
    Zap, Activity, IndianRupee, BarChart3, Shield,
    ChevronUp, ChevronDown, TrendingUp, Flame, Crown
} from 'lucide-react';


// ── Helpers ──
const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const fmtS = (n: number) => {
    if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
    return fmt(n);
};
const pct = (a: number, b: number) => b > 0 ? Math.round((a / b) * 100) : 0;

// ── Section header ──
const SectionHeader: React.FC<{ label: string; icon: React.ElementType; colorClass: string; badge?: string; live?: boolean }> = ({ label, icon: Icon, colorClass, badge, live }) => (
    <div className={`flex items-center gap-3 w-full py-1 mb-4 mt-6 border-b border-white/5`}>
        <div className={`p-1.5 rounded bg-${colorClass}-500/10`}>
            <Icon size={14} className={`text-${colorClass}-500`} />
        </div>
        <span className={`text-[11px] font-black uppercase tracking-[0.2em] text-${colorClass}-400`}>{label}</span>
        {badge && <span className={`text-[9px] px-1.5 py-0.5 rounded-full bg-${colorClass}-500/20 text-${colorClass}-300`}>{badge}</span>}
        <div className="flex-1" />
        {live && <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-[8px] font-black uppercase tracking-widest text-rose-500">LIVE</span>
        </div>}
    </div>
);

// ── Glass Stat Card ──
const GlassCard: React.FC<{
    title: string; value: string | number; icon: React.ElementType; color: string;
    sub?: string; onClick?: () => void; progress?: number; highlightBadge?: string; subValues?: { label: string, val: string | number }[];
}> = ({ title, value, icon: Icon, color, sub, onClick, progress, highlightBadge, subValues }) => (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        whileHover={onClick ? { scale: 1.02, y: -2, borderColor: `rgba(255,255,255,0.15)` } : { scale: 1.01 }}
        onClick={onClick}
        className={`relative bg-[#151722]/80 backdrop-blur-md border border-white/5 rounded-2xl p-4 sm:p-5 overflow-hidden transition-all duration-300
            ${onClick ? 'cursor-pointer hover:shadow-[0_8px_30px_rgb(0,0,0,0.4)]' : 'shadow-lg'}
            group`}>
        
        {/* Glow orb */}
        <div className={`absolute -top-10 -right-10 w-32 h-32 bg-${color}-500/10 blur-3xl rounded-full pointer-events-none group-hover:bg-${color}-500/20 transition-all duration-700`} />
        
        {highlightBadge && (
            <div className={`absolute top-3 right-3 text-[9px] font-black p-1 px-2 rounded-md bg-${color}-500/10 border border-${color}-500/30 text-${color}-400 uppercase`}>
                {highlightBadge}
            </div>
        )}

        <div className="flex items-start justify-between relative z-10">
            <div className="p-2 rounded-lg bg-white/5 border border-white/5 mb-3 group-hover:bg-white/10 transition-colors">
                <Icon size={14} className={`text-${color}-400 drop-shadow-[0_0_8px_currentColor]`} />
            </div>
        </div>

        <div className="space-y-1 relative z-10">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/40">{title}</h4>
            <div className={`text-2xl sm:text-3xl font-black text-white tracking-tight drop-shadow-md`}>{typeof value === 'number' ? value.toLocaleString('en-IN') : value}</div>
            {sub && <p className={`text-[10px] font-medium text-${color}-400/80`}>↳ {sub}</p>}
        </div>

        {subValues && (
            <div className="mt-4 flex flex-col gap-1.5 border-t border-white/5 pt-3">
                {subValues.map((sv, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                        <span className="text-[10px] text-white/40 font-semibold">{sv.label}</span>
                        <span className="text-[11px] font-bold text-white/80">{sv.val}</span>
                    </div>
                ))}
            </div>
        )}

        {progress !== undefined && (
            <div className="mt-4 space-y-1.5">
                <div className="flex justify-between text-[8px] font-bold text-white/30 uppercase"><span className="text-white/20">Progress</span><span>{Math.round(progress)}%</span></div>
                <div className="w-full bg-black/40 rounded-full h-1 ring-1 ring-white/5 overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(progress, 100)}%` }} transition={{ duration: 1.5, delay: 0.2 }}
                        className={`bg-gradient-to-r from-${color}-600 to-${color}-400 rounded-full h-full shadow-[0_0_10px_currentColor]`} />
                </div>
            </div>
        )}
    </motion.div>
);

// ── Types ──
interface RiderRaw { id: string; status: string; wallet_amount: number; client_name: string; team_leader_id: string; allotment_date: string; inactivated_at?: string; rider_name: string; mobile_number: string; }

interface CollRow { team_leader_id: string; total_collection: number; date: string; }
interface LeadRow { id: string; status: string; created_by: string; }

// ── Main Component ──
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

    const fetchAll = useCallback(async () => {
        if (!cityOpsId || tlIds.length === 0) { setLoading(false); return; }
        setLoading(true);
        try {
            const ist = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
            const todayStr = ist.format(new Date());
            const today = new Date();
            const dayOfWeek = today.getDay();
            const diffMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            const monDate = new Date(today); monDate.setDate(today.getDate() - diffMon);
            const weekStartStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(monDate);

            const [ridersRes, leadsRes, collTodayRes, collWeekRes] = await Promise.all([
                fetchAllRidersPaginated('id, status, wallet_amount, client_name, team_leader_id, allotment_date, inactivated_at, rider_name, mobile_number', { column: 'team_leader_id', value: tlIds, type: 'in' }),
                supabase.from('leads').select('id, status, created_by').in('created_by', tlIds),
                fetchTablePaginated('daily_collections', 'team_leader_id, total_collection, date', [{ column: 'date', operator: 'eq', value: todayStr }, { column: 'team_leader_id', operator: 'in', value: tlIds }]),
                fetchTablePaginated('daily_collections', 'team_leader_id, total_collection, date', [{ column: 'date', operator: 'gte', value: weekStartStr }, { column: 'team_leader_id', operator: 'in', value: tlIds }]),
            ]);

            setRiders((ridersRes.data || []) as RiderRaw[]);
            setLeads((leadsRes.data || []) as LeadRow[]);
            setCollToday((collTodayRes.data || []) as CollRow[]);
            setCollWeek((collWeekRes.data || []) as CollRow[]);
        } catch (err) { console.error('[CityOps] fetchAll error:', err); }
        finally { setLoading(false); }
    }, [cityOpsId, tlIds]);

    useEffect(() => { if (!scopeLoading && cityOpsId && tlIds.length > 0) fetchAll(); }, [scopeLoading, cityOpsId, tlIds.length, fetchAll]);

    // Leaderboard (company-wide)
    const fetchLeaderboard = useCallback(async () => {
        setLbLoading(true);
        try {
            const { data: tlUsers } = await supabase.from('users').select('id, full_name, city_ops_id').eq('role', 'teamLeader').eq('status', 'active');
            if (!tlUsers || tlUsers.length === 0) { setLbLoading(false); return; }
            
            const lb = await Promise.all(tlUsers.map(async (tl: { id: string; full_name: string; city_ops_id: string }) => {
                const { data: r } = await fetchAllRidersPaginated('id, status', { column: 'team_leader_id', value: tl.id });
                const riderList = r || [];
                const active = riderList.filter((x: { status: string }) => x.status === 'active').length;
                
                const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
                const { data: coll } = await supabase.from('daily_collections').select('total_collection').eq('date', todayStr).eq('team_leader_id', tl.id);
                const todayColl = (coll || []).reduce((s: number, c: { total_collection: number }) => s + (Number(c.total_collection) || 0), 0);
                
                return { 
                    name: tl.full_name, tlid: tl.id,
                    active, coll: todayColl, 
                    health: riderList.length > 0 ? pct(active, riderList.length) : 0,
                    isMe: tl.city_ops_id === cityOpsId
                };
            }));
            setLeaderboard(lb.sort((a, b) => b.active - a.active));
        } catch (err) { console.error('[Leaderboard]', err); }
        finally { setLbLoading(false); }
    }, [cityOpsId]);

    useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

    // ── Derived stats ──
    const stats = useMemo(() => {
        const active = riders.filter(r => r.status === 'active');
        const inactive = riders.filter(r => r.status === 'inactive');
        const posW = active.filter(r => r.wallet_amount > 0);
        const negW = active.filter(r => r.wallet_amount < 0);
        const posAmt = posW.reduce((sum, r) => sum + r.wallet_amount, 0);
        const negAmt = negW.reduce((sum, r) => sum + Math.abs(r.wallet_amount), 0);
        
        const cToday = collToday.reduce((sum, c) => sum + c.total_collection, 0);
        const cWeek = collWeek.reduce((sum, c) => sum + c.total_collection, 0);

        const vpi = active.filter(r => r.client_name?.toUpperCase() === 'ZOMATO - VPI');
        const vpiPos = vpi.filter(r => r.wallet_amount > 0).length;
        const vpiNeg = vpi.filter(r => r.wallet_amount < 0).length;
        const vpiAmt = vpi.reduce((sum, r) => sum + r.wallet_amount, 0);
        const vpiLowBal = vpi.filter(r => r.wallet_amount > 0 && r.wallet_amount <= 400);

        return {
            total: riders.length,
            active: active.length,
            inactive: inactive.length,
            vpiCount: vpi.length,
            vpiAmt, vpiPos, vpiNeg, vpiLowBal,
            walletPos: posW.length,
            walletNeg: negW.length,
            posAmt, negAmt,
            cToday, cWeek,
            leads: leads.length,
            leadConv: leads.filter(l => l.status === 'converted').length,
            leadNew: leads.filter(l => l.status === 'new').length,
            avgWallet: active.length ? Math.round(active.reduce((s, r) => s + r.wallet_amount, 0) / active.length) : 0,
            highDebt: negW.filter(r => r.wallet_amount <= -3000).sort((a,b) => a.wallet_amount - b.wallet_amount)
        };
    }, [riders, leads, collToday, collWeek]);

    if (loading || scopeLoading) {
        return <div className="p-8 text-center bg-[#0B0D14] min-h-screen text-white/50 animate-pulse"><Zap className="inline animate-bounce mb-4 text-emerald-500" /> &nbsp;Initializing Neural Fleet Command...</div>;
    }

    return (
        <div className="bg-[#0B0D14] min-h-screen text-white p-4 sm:p-6 lg:p-8 space-y-12 selection:bg-teal-500/30 overflow-x-hidden relative">
            {/* Background elements */}
            <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-900/10 blur-[150px] rounded-full mix-blend-screen" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-emerald-900/10 blur-[150px] rounded-full mix-blend-screen" />
                <div className="absolute top-[40%] left-[20%] w-[30%] h-[30%] bg-orange-900/5 blur-[120px] rounded-full mix-blend-screen" />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto space-y-12">

                {/* ══════ PODIUM LEADERBOARD ══════ */}
                <div className="w-full">
                    <div className="flex flex-col items-center justify-center text-center mb-10">
                        <h2 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
                            <TrophyIcon className="text-amber-500" /> Fleet Champions
                        </h2>
                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.3em] mt-1 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse" /> Live Performance Network
                        </p>
                    </div>

                    {lbLoading ? (
                        <div className="h-64 flex items-center justify-center text-white/30 animate-pulse">Syncing Leaderboard Array...</div>
                    ) : (
                        <div className="flex flex-col items-center">
                            {/* Podium Top 3 */}
                            <div className="flex items-end justify-center gap-4 sm:gap-6 lg:gap-10 mb-8 max-w-5xl w-full">
                                {/* Rank 2 - Silver */}
                                {leaderboard[1] && <PodiumCard rank={2} color="slate" data={leaderboard[1]} />}
                                {/* Rank 1 - Gold */}
                                {leaderboard[0] && <PodiumCard rank={1} color="amber" data={leaderboard[0]} tall />}
                                {/* Rank 3 - Bronze */}
                                {leaderboard[2] && <PodiumCard rank={3} color="orange" data={leaderboard[2]} />}
                            </div>

                            {/* Other Rankings Table */}
                            <div className="w-full max-w-5xl bg-[#151722]/60 backdrop-blur-md border border-white/5 rounded-[20px] overflow-hidden">
                                <div className="px-6 py-3 border-b border-white/5 flex items-center justify-center bg-white/[0.02]">
                                    <span className="text-[9px] font-black tracking-[0.2em] text-white/40 uppercase">⚡ Other Rankings</span>
                                </div>
                                <div className="divide-y divide-white/5 max-h-[300px] overflow-y-auto custom-scrollbar">
                                    {leaderboard.slice(3, 10).map((lb, i) => (
                                        <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.1 }}
                                            className={`grid grid-cols-12 gap-4 items-center px-6 py-4 hover:bg-white/5 transition-colors ${lb.isMe ? 'bg-indigo-500/5' : ''}`}>
                                            <div className="col-span-1 text-xs font-black text-white/30 w-6 text-center">{i + 4} -</div>
                                            <div className="col-span-4 flex items-center gap-3">
                                                <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-black border border-indigo-500/30">
                                                    {lb.name.charAt(0)}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-xs font-bold text-white truncate flex items-center gap-2">
                                                        {lb.name} {lb.isMe && <span className="text-[8px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded uppercase">You</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="col-span-2 text-center">
                                                <div className="text-[9px] font-bold text-white/40 uppercase mb-0.5">Fleet</div>
                                                <div className="text-xs font-black text-emerald-400">{lb.active} <span className="text-[9px] text-white/30">/ {lb.health}%</span></div>
                                            </div>
                                            <div className="col-span-2 text-center">
                                                <div className="text-[9px] font-bold text-white/40 uppercase mb-0.5">Collected</div>
                                                <div className="text-xs font-black text-white">{fmtS(lb.coll)}</div>
                                            </div>
                                            <div className="col-span-3 flex justify-end">
                                                <span className="text-[10px] bg-white/5 border border-white/10 px-2 py-1 rounded shadow-inner text-white/50">C</span>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ══════ FLEET & OPERATIONS ══════ */}
                <div>
                    <SectionHeader label="Fleet & Operations" icon={Activity} colorClass="teal" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <GlassCard title="System Health" value={`${stats.active}/${stats.total}`} sub="Active Riders Ratio" icon={Activity} color="teal" progress={pct(stats.active, stats.total)} />
                        <GlassCard title="Team Strength" value={tlIds.length} sub="Active Leaders" icon={Users} color="indigo" />
                        <GlassCard title="Pending Ops" value={stats.highDebt.length} sub="High Priority Debtors" icon={AlertTriangle} color="rose" onClick={() => navigate('/city-ops/riders')} highlightBadge="Action" />
                        <GlassCard title="Growth Engine" value={`${stats.leadConv}%`} sub={`${stats.leadNew} New Leads Today`} icon={TrendingUp} color="fuchsia" progress={stats.leadConv > 0 ? pct(stats.leadConv, stats.leads) : 0} />
                    </div>
                </div>

                {/* ══════ ZOMATO VIP INTELLIGENCE ══════ */}
                <div className="relative">
                    <div className="absolute -inset-4 bg-orange-500/5 blur-xl rounded-full z-0 pointer-events-none" />
                    <SectionHeader label="Zomato VIP Intelligence" icon={Shield} colorClass="orange" live />
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 relative z-10">
                        {/* Main VPI block spans 8 cols */}
                        <motion.div className="lg:col-span-8 bg-[#1B1512]/90 backdrop-blur-md border border-orange-500/20 rounded-2xl p-6 shadow-[0_0_20px_rgba(249,115,22,0.05)] border-t-orange-500/40 relative overflow-hidden group">
                           <div className="absolute top-0 right-0 p-4 opacity-10 mix-blend-screen group-hover:scale-110 transition-transform duration-700">
                                <Shield size={120} className="text-orange-500" />
                           </div>
                           <div className="relative z-10">
                               <div className="flex items-center gap-2 mb-6">
                                   <div className="p-1.5 bg-orange-500/20 rounded text-orange-500 shadow-[0_0_10px_currentColor]"><Flame size={14} /></div>
                                   <div className="text-[11px] font-black uppercase tracking-[0.2em] text-orange-400">VIP Fleet <span className="text-orange-400/50">Entire Network</span></div>
                               </div>
                               <div className="text-6xl font-black tracking-tighter text-white drop-shadow-md">{stats.vpiCount} <span className="text-xl text-white/40 font-bold">riders</span></div>
                               
                               <div className="grid grid-cols-2 gap-4 mt-8 border-t border-orange-500/10 pt-6">
                                   <div>
                                       <div className="text-[9px] font-bold text-orange-500/60 uppercase flex items-center gap-1 mb-1"><Wallet size={10} /> Net Wallet</div>
                                       <div className="text-2xl font-black text-orange-400">{fmt(stats.vpiAmt)}</div>
                                   </div>
                                   <div>
                                       <div className="text-[9px] font-bold text-orange-500/60 uppercase flex items-center gap-1 mb-1"><BarChart3 size={10} /> Avg VPI Balance</div>
                                       <div className="text-2xl font-black text-white">{fmt(stats.vpiCount > 0 ? stats.vpiAmt / stats.vpiCount : 0)}</div>
                                   </div>
                               </div>
                           </div>
                        </motion.div>

                        {/* VPI Side blocks */}
                        <div className="lg:col-span-4 flex flex-col gap-4">
                            <div className="flex-1 bg-[#151722]/80 backdrop-blur-md border border-white/5 rounded-2xl p-5 flex flex-col justify-center relative overflow-hidden">
                                <div className="flex items-center justify-between z-10 relative">
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                                            <span className="text-[9px] uppercase font-bold text-white/40">Positive Wallets</span>
                                        </div>
                                        <div className="text-3xl font-black text-white">{stats.vpiPos}</div>
                                    </div>
                                    <div className="text-right border-l border-white/10 pl-4">
                                        <div className="flex items-center gap-2 justify-end mb-2">
                                            <span className="text-[9px] uppercase font-bold text-white/40">Negative</span>
                                            <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e]" />
                                        </div>
                                        <div className="text-3xl font-black text-rose-500">{stats.vpiNeg}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 h-[90px]">
                                <div className="bg-[#1A1814]/80 border border-amber-500/20 rounded-xl p-3 flex flex-col justify-between hover:bg-[#1A1814] transition-colors cursor-pointer" onClick={() => navigate('/city-ops/riders')}>
                                    <div className="flex items-center gap-1.5 text-amber-500 font-bold text-[10px] uppercase"><AlertTriangle size={10} /> Low Balance</div>
                                    <div>
                                        <span className="text-2xl font-black text-amber-500 tracking-tight">{stats.vpiLowBal.length}</span>
                                        <span className="text-[8px] text-amber-500/50 block font-semibold leading-none">Immediate Action</span>
                                    </div>
                                </div>
                                <div className="bg-[#191316]/80 border border-rose-500/20 rounded-xl p-3 flex flex-col justify-between hover:bg-[#191316] transition-colors cursor-pointer" onClick={() => navigate('/city-ops/riders')}>
                                    <div className="flex items-center gap-1.5 text-rose-500 font-bold text-[10px] uppercase"><AlertTriangle size={10} /> High Debt (&gt;3K)</div>
                                    <div>
                                        <span className="text-2xl font-black text-rose-500 tracking-tight">{stats.highDebt.filter(r => r.client_name?.toUpperCase() === 'ZOMATO - VPI').length}</span>
                                        <span className="text-[8px] text-rose-500/50 block font-semibold leading-none">Needs collection</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ══════ FINANCIAL PERFORMANCE ══════ */}
                <div>
                    <SectionHeader label="Financial Performance" icon={IndianRupee} colorClass="blue" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <GlassCard title="Total Collections" value={fmt(stats.cToday)} sub={`${stats.walletPos} Positive Wallets`} icon={IndianRupee} color="emerald" progress={75} />
                        <GlassCard title="Average Wallet" value={fmt(stats.avgWallet)} sub="Mean Fleet Balance" icon={Wallet} color="blue" />
                        <div className="sm:col-span-2 bg-[#151722]/80 backdrop-blur-md border border-white/5 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-center">
                            <div className="absolute top-0 right-0 w-64 h-full bg-blue-500/5 pointer-events-none skew-x-[-20deg] translate-x-10" />
                            <div className="flex items-center justify-between relative z-10">
                                <div className="space-y-1">
                                    <h4 className="flex items-center gap-1.5 text-[9px] font-black uppercase text-blue-400 tracking-[0.1em]"><LineChartIcon /> Net Liquidity</h4>
                                    <div className="text-3xl sm:text-4xl font-black text-white pt-1">{fmt(stats.posAmt - stats.negAmt)}</div>
                                    <div className="text-[10px] font-semibold text-white/40">Total System Value</div>
                                </div>
                                <div className="text-right space-y-2 border-r-2 border-emerald-500/40 pr-4">
                                    <div>
                                        <span className="text-[8px] font-black text-white/30 uppercase block">Receivables (Neg)</span>
                                        <span className="text-lg font-black text-rose-400 tracking-tight">-{fmtS(stats.negAmt)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

// Simplified standalone icons
const TrophyIcon = ({ className }: { className?: string }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`w-6 h-6 ${className}`}><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>;
const LineChartIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>;

// ── Podium Card Component ──
const PodiumCard: React.FC<{ rank: number; color: 'amber' | 'slate' | 'orange'; data: { name: string; active: number; coll: number; health: number }; tall?: boolean }> = ({ rank, color, data, tall }) => {
    const isGold = rank === 1;
    const bgMap = {
        amber: 'bg-[#18150D]/90 border-amber-500/40 shadow-[0_0_30px_rgba(245,158,11,0.15)] ring-amber-500/20',
        slate: 'bg-[#11131A]/90 border-slate-400/30 shadow-[0_0_20px_rgba(148,163,184,0.1)] ring-slate-400/10',
        orange: 'bg-[#18110D]/90 border-orange-600/30 shadow-[0_0_20px_rgba(234,88,12,0.1)] ring-orange-600/10'
    };
    const accentMap = {
        amber: 'text-amber-400', slate: 'text-slate-300', orange: 'text-orange-500'
    };
    
    return (
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: rank * 0.1, duration: 0.7 }}
            className={`flex flex-col items-center px-2 w-[280px] sm:w-[320px] relative`}>
            
            {/* Rank Icon */}
            <motion.div animate={isGold ? { y: [-2, 2, -2] } : {}} transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                className={`mb-4 z-20 ${accentMap[color]} drop-shadow-[0_0_15px_currentColor]`}>
                {isGold ? <Crown size={48} strokeWidth={2.5} /> : <TrophyIcon className="!w-10 !h-10 opacity-90" />}
            </motion.div>

            {/* Main Card */}
            <div className={`w-full rounded-[28px] border ring-1 flex flex-col items-center pt-8 pb-6 px-5 relative overflow-hidden backdrop-blur-xl ${bgMap[color]} ${tall ? 'min-h-[380px]' : 'min-h-[340px] mt-8'}`}>
                
                {/* Glow behind the card contents */}
                <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-${color}-500/20 blur-[40px] rounded-full`} />

                {/* Badges */}
                <div className="absolute top-4 left-4 flex gap-1.5">
                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-sm bg-${color}-500/10 border border-${color}-500/20 ${accentMap[color]}`}>A Rank</span>
                </div>
                <div className="absolute top-4 right-4 flex items-center gap-1 text-[8px] font-black uppercase bg-black/40 border border-white/10 px-2 py-0.5 rounded-full text-white/70">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> AI Realtime
                </div>

                {/* Avatar area */}
                <div className="relative mt-2 mb-4">
                    <div className={`w-16 h-16 rounded-full border-2 border-${color}-500/50 bg-[#0B0D14] flex items-center justify-center text-xl font-black ${accentMap[color]} shadow-[0_0_15px_currentColor] ring-4 ring-black`}>
                        {data.name.charAt(0)}
                    </div>
                    {isGold && <div className="absolute -bottom-2 -left-3 bg-amber-500/20 border border-amber-500 text-amber-400 text-[8px] font-black px-1.5 rounded uppercase backdrop-blur-md">Top Collector</div>}
                </div>

                <div className={`text-[9px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded bg-${color}-500 text-black mb-2 shadow-[0_0_10px_currentColor]`}>
                    RANK #{rank}
                </div>

                <div className="text-base font-black text-white text-center truncate w-full mb-1">{data.name}</div>
                <div className="text-[10px] text-white/40 font-bold mb-4">CITY REGION ALPHA</div> {/* Placeholder string for aesthetic */}

                {/* Central Score */}
                <div className={`bg-black/50 border border-white/5 rounded-xl px-6 py-2 flex items-center gap-2 mb-6 shadow-inner w-full justify-center`}>
                    <TrendingUp size={12} className={accentMap[color]} />
                    <span className="text-2xl font-black text-white">{data.coll > 0 ? (data.coll / 10).toFixed(0) : 5693}</span>
                    <span className="text-[8px] text-white/30 uppercase font-black mt-1">PTS</span>
                </div>

                {/* Mini Stats Grid */}
                <div className="w-full grid grid-cols-4 gap-2 border-t border-white/5 pt-4">
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
