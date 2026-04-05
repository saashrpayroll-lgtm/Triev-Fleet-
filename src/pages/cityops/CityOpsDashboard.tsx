import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useCityOpsScope } from '@/hooks/useCityOpsScope';
import { supabase } from '@/config/supabase';
import { 
    Users, AlertTriangle, Wallet, Zap, Activity, IndianRupee, 
    BarChart3, Shield, TrendingUp, Crown, Trophy, Search, Phone, 
    MessageSquare, Bell, LayoutDashboard, Globe, Clock, RefreshCw, 
    ExternalLink, ArrowRight, Briefcase
} from 'lucide-react';
import { 
    BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, 
    CartesianGrid, Cell, PieChart, Pie
} from 'recharts';
import { format, subDays } from 'date-fns';
import CollectionHistoryModal from '@/components/dashboard/CollectionHistoryModal';
import { toast } from 'sonner';

// --- Types ---
interface LocalRider {
    id: string;
    rider_name: string;
    mobile_number: string;
    wallet_amount: number;
    status: string;
    team_leader_id: string;
    client_name: string;
    allotment_date: string;
}

interface TLData {
    id: string;
    name: string;
    active: number;
    total: number;
    coll: number;
    leads: number;
    growth: number;
    score: number;
    debt: number;
}

interface Lead {
    id: string;
    team_leader_id: string;
    status: string;
}

// --- Helpers ---
const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const pct = (part: number, total: number) => total > 0 ? Math.round((part / total) * 100) : 0;

const logActivity = async (userId: string, action: string, details: string) => {
    try {
        await supabase.from('activity_logs').insert({
            user_id: userId,
            action,
            details,
            metadata: { platform: 'CityOps', timestamp: new Date().toISOString() }
        });
    } catch (e) { console.error('Log failed', e); }
};

// --- Sub-Components ---

const SectionHeader = ({ label, icon: Icon, colorClass, live }: { label: string, icon: React.ElementType, colorClass: string, live?: boolean }) => (
    <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl bg-opacity-10 border border-opacity-20 flex items-center justify-center`} style={{ backgroundColor: `rgba(var(--${colorClass}-rgb, 16, 185, 129), 0.1)`, borderColor: `rgba(var(--${colorClass}-rgb, 16, 185, 129), 0.2)`, color: `var(--${colorClass}-color, #10b981)` }}>
                <Icon size={20} />
            </div>
            <h2 className="text-xl font-black tracking-tight text-white">{label}</h2>
            {live && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 ml-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
                    <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Live</span>
                </div>
            )}
        </div>
    </div>
);

const ColorMap: Record<string, string> = {
    emerald: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20 shadow-emerald-500/10',
    blue: 'text-blue-500 bg-blue-500/10 border-blue-500/20 shadow-blue-500/10',
    orange: 'text-orange-500 bg-orange-500/10 border-orange-500/20 shadow-orange-500/10',
    indigo: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20 shadow-indigo-500/10',
    rose: 'text-rose-500 bg-rose-500/10 border-rose-500/20 shadow-rose-500/10',
    teal: 'text-teal-500 bg-teal-500/10 border-teal-500/20 shadow-teal-500/10'
};

interface GlassCardProps {
    title: string;
    value: string | number;
    sub: string;
    icon: React.ElementType;
    color: string;
    progress?: number;
    onClick?: () => void;
    highlightBadge?: string;
}

const GlassCard = ({ title, value, sub, icon: Icon, color, progress, onClick, highlightBadge }: GlassCardProps) => (
    <motion.div 
        whileHover={{ y: -5, scale: 1.02 }}
        onClick={onClick}
        className={`bg-[#15171E]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-5 relative overflow-hidden group cursor-${onClick ? 'pointer' : 'default'} h-full flex flex-col justify-between`}
    >
        <div className={`absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-500`}>
            <Icon size={120} />
        </div>
        <div className="flex justify-between items-start relative z-10 w-full">
            <div className={`p-2.5 rounded-xl transition-all group-hover:scale-110 ${ColorMap[color] || ColorMap.emerald}`}>
                <Icon size={18} />
            </div>
            {highlightBadge && (
                <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${ColorMap[color] || ColorMap.emerald}`}>
                    {highlightBadge}
                </span>
            )}
        </div>
        <div className="space-y-1 relative z-10 mt-4">
            <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{title}</h4>
            <div className="text-2xl font-black text-white">{value}</div>
            <p className="text-[10px] font-medium text-white/30 truncate">{sub}</p>
        </div>
        {progress !== undefined && (
            <div className="mt-4 w-full h-1 bg-white/5 rounded-full overflow-hidden relative z-10">
                <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    className={`h-full bg-current opacity-80 shadow-[0_0_8px_currentColor]`}
                    style={{ color: color === 'emerald' ? '#10b981' : color === 'blue' ? '#3b82f6' : color === 'orange' ? '#f59e0b' : color === 'indigo' ? '#6366f1' : color === 'rose' ? '#f43f5e' : '#14b8a6' }}
                />
            </div>
        )}
    </motion.div>
);

interface PodiumCardProps {
    rank: number;
    color: string;
    data: TLData;
    tall?: boolean;
}

const PodiumCard = ({ rank, color, data, tall }: PodiumCardProps) => {
    const isGold = rank === 1;
    const accentMap: Record<string, string> = { amber: 'text-amber-400', slate: 'text-slate-300', orange: 'text-orange-500' };
    const borderMap: Record<string, string> = { amber: 'border-amber-500/30', slate: 'border-slate-500/20', orange: 'border-orange-500/20' };
    const bgGlow: Record<string, string> = { amber: 'bg-amber-500/10', slate: 'bg-slate-500/10', orange: 'bg-orange-500/10' };
    const pillBg: Record<string, string> = { amber: 'bg-amber-500', slate: 'bg-slate-400', orange: 'bg-orange-500' };
    
    return (
        <motion.div 
            initial={{ opacity: 0, y: 30 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: rank * 0.1 }}
            className={`flex flex-col items-center w-full max-w-[320px] relative ${tall ? 'mt-0' : 'mt-12'}`}
        >
            <div className={`mb-4 z-20 ${accentMap[color]} drop-shadow-[0_0_15px_currentColor]`}>
                {isGold ? <Crown size={48} /> : <Trophy size={40} />}
            </div>
            <div className={`w-full rounded-[28px] border ${borderMap[color]} bg-[#11131A]/90 backdrop-blur-2xl p-6 flex flex-col items-center relative overflow-hidden ${tall ? 'min-h-[400px]' : 'min-h-[350px]'}`}>
                <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 ${bgGlow[color]} blur-[50px] rounded-full`} />
                <div className="w-16 h-16 rounded-full border-2 border-white/10 bg-[#0B0D14] flex items-center justify-center text-xl font-black mb-4 relative z-10 shadow-2xl">
                    <span className={accentMap[color]}>{data.name.charAt(0)}</span>
                </div>
                <div className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${pillBg[color]} text-black mb-2 shadow-[0_0_15px_currentColor]`}>Rank #{rank}</div>
                <div className="text-lg font-black text-white text-center truncate w-full mb-1">{data.name}</div>
                <div className="text-[8px] text-white/30 font-bold mb-4 uppercase tracking-[0.2em]">Regional Fleet Master</div>
                
                <div className="w-full bg-black/40 rounded-2xl px-4 py-3 flex items-center justify-between mb-6 border border-white/5 shadow-inner">
                    <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Collection</span>
                    <span className="text-base font-black text-white">{fmt(data.coll)}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 w-full border-t border-white/5 pt-5 mt-auto">
                    <div className="text-center">
                        <div className="text-base font-black text-white">{data.active}</div>
                        <div className="text-[8px] font-bold text-white/40 uppercase tracking-widest mt-1">Fleet</div>
                    </div>
                    <div className="text-center border-l border-white/5">
                        <div className="text-base font-black text-emerald-400">{data.growth}%</div>
                        <div className="text-[8px] font-bold text-white/40 uppercase tracking-widest mt-1">Growth</div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

const CityOpsDashboard: React.FC = () => {
    const navigate = useNavigate();
    const { cityOpsId, tlIds, isLoading: scopeLoading } = useCityOpsScope();
    
    // -- UI State --
    const [loading, setLoading] = useState(true);
    const [lbLoading, setLbLoading] = useState(false);
    const [dateFilter, setDateFilter] = useState<'day' | 'week' | 'month'>('day');
    const [debtSearch, setDebtSearch] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [historyTL, setHistoryTL] = useState<{ id: string, name: string } | null>(null);

    // -- Data State --
    const [riders, setRiders] = useState<LocalRider[]>([]);
    const [leads, setLeads] = useState<Lead[]>([]);
    const [leaderboard, setLeaderboard] = useState<TLData[]>([]);
    const [weeklyColl, setWeeklyColl] = useState<{ date: string; amount: number }[]>([]);

    const fetchData = useCallback(async () => {
        if (scopeLoading || !tlIds.length) return;
        setLoading(true);
        try {
            // 1. Get Scoped Riders
            const { data: riderData } = await supabase.from('riders').select('id, rider_name, mobile_number, wallet_amount, status, team_leader_id, client_name, allotment_date').in('team_leader_id', tlIds);
            setRiders(riderData || []);

            // 2. Get Scoped Leads
            const { data: leadData } = await supabase.from('leads').select('*').in('team_leader_id', tlIds);
            setLeads(leadData || []);

            // 3. Get Weekly Collection Array
            const { data: wColl } = await supabase.from('daily_collections').select('date, total_collection').in('team_leader_id', tlIds).gte('date', format(subDays(new Date(), 7), 'yyyy-MM-dd'));
            const dateMap: Record<string, number> = {};
            for(let i=6; i>=0; i--) dateMap[format(subDays(new Date(), i), 'yyyy-MM-dd')] = 0;
            (wColl || []).forEach(c => { if(dateMap[c.date] !== undefined) dateMap[c.date] += Number(c.total_collection) || 0; });
            setWeeklyColl(Object.keys(dateMap).map(k => ({ date: format(new Date(k), 'EEE'), amount: dateMap[k] })));

            // 4. Build Leaderboard / TL List
            setLbLoading(true);
            const { data: tls } = await supabase.from('users').select('id, full_name').in('id', tlIds).eq('status', 'active');
            const tlStats = await Promise.all((tls || []).map(async (tl) => {
                const tlRiders = (riderData || []).filter(r => r.team_leader_id === tl.id);
                const activeCount = tlRiders.filter(r => r.status === 'active').length;
                const totalCount = tlRiders.length;
                const todayStr = format(new Date(), 'yyyy-MM-dd');
                const { data: dColl } = await supabase.from('daily_collections').select('total_collection').eq('date', todayStr).eq('team_leader_id', tl.id).single();
                
                return {
                    id: tl.id, name: tl.full_name,
                    active: activeCount, total: totalCount,
                    coll: Number(dColl?.total_collection) || 0,
                    leads: (leadData || []).filter(l => l.team_leader_id === tl.id).length,
                    growth: totalCount > 0 ? Math.round((activeCount / totalCount) * 100) : 0,
                    score: 85, 
                    debt: tlRiders.filter(r => r.wallet_amount < 0).reduce((s, r) => s + Math.abs(r.wallet_amount), 0)
                };
            }));
            setLeaderboard(tlStats.sort((a, b) => b.coll - a.coll));
            setLbLoading(false);

        } catch (err) { console.error('Dashboard error', err); }
        finally { setLoading(false); }
    }, [tlIds, scopeLoading]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const stats = useMemo(() => {
        const active = riders.filter(r => r.status === 'active');
        const vpi = riders.filter(r => r.client_name?.toUpperCase() === 'ZOMATO - VPI');
        const neg = riders.filter(r => r.wallet_amount < 0);
        const pos = riders.filter(r => r.wallet_amount > 0);
        const dayColl = leaderboard.reduce((s, t) => s + t.coll, 0);
        const weekCollTotal = weeklyColl.reduce((s, c) => s + c.amount, 0);

        return {
            total: riders.length,
            active: active.length,
            vpiCount: vpi.length,
            vpiNeg: vpi.filter(r => r.wallet_amount < 0).length,
            vpiAmt: vpi.reduce((s, r) => s + r.wallet_amount, 0),
            dayColl, weekCollTotal,
            negAmt: neg.reduce((s, r) => s + Math.abs(r.wallet_amount), 0),
            posAmt: pos.reduce((s, r) => s + r.wallet_amount, 0),
            highDebt: neg.filter(r => r.wallet_amount <= -3000).length,
            leadsConverted: leads.filter(l => l.status === 'converted').length
        };
    }, [riders, leaderboard, weeklyColl, leads]);

    const handleCommunication = (rider: LocalRider, type: 'call' | 'wa') => {
        const details = `${type === 'call' ? 'Called' : 'WhatsApped'} rider ${rider.rider_name} for debt collection of ${fmt(Math.abs(rider.wallet_amount))}`;
        logActivity(cityOpsId || 'system', `DEBT_${type.toUpperCase()}`, details);
        if (type === 'call') window.open(`tel:${rider.mobile_number}`);
        else window.open(`https://wa.me/91${rider.mobile_number}?text=Hello ${rider.rider_name}, reminder for outstanding balance: ${fmt(Math.abs(rider.wallet_amount))}.`);
        toast.info(details);
    };

    if (loading || scopeLoading) {
        return (
            <div className="p-8 text-center bg-[#0B0D14] min-h-screen text-white/50 flex flex-col items-center justify-center gap-4">
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="text-emerald-500">
                    <Zap size={44} />
                </motion.div>
                <div className="text-[10px] font-black uppercase tracking-[0.4em] animate-pulse">Neural Interface Loading...</div>
            </div>
        );
    }

    return (
        <div className="bg-[#0B0D14] min-h-screen text-white p-4 sm:p-6 lg:p-8 space-y-12 selection:bg-emerald-500/30 overflow-x-hidden relative font-sans">
            {/* Ambient Background */}
            <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-900/10 blur-[150px] rounded-full" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-emerald-900/10 blur-[150px] rounded-full" />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto space-y-12 pb-20">

                {/* --- HERO HEADER --- */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 py-4">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-emerald-500/40 text-[9px] font-black uppercase tracking-[0.5em]">
                             <Globe size={11} /> Global Command Node
                        </div>
                        <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-white">Hello, Dashboard <span className="text-emerald-500">Flow.</span></h1>
                        <p className="text-xs text-white/30 flex items-center gap-2 font-bold">
                             <Clock size={12} className="text-emerald-500" /> SYNC STATUS: NOMINAL • IST {format(new Date(), 'HH:mm:ss')} • NODE_X{cityOpsId?.slice(-6).toUpperCase()}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-4 items-center">
                        <div className="px-6 py-4 bg-[#15171E] border border-white/5 rounded-3xl flex items-center gap-6 shadow-2xl backdrop-blur-md">
                            <div className="text-right">
                                <div className="text-[8px] font-bold text-white/20 uppercase tracking-[0.2em] mb-1">Day Collection</div>
                                <div className="text-2xl font-black text-emerald-500">{fmt(stats.dayColl)}</div>
                            </div>
                            <div className="w-px h-10 bg-white/10" />
                            <div className="text-right">
                                <div className="text-[8px] font-bold text-white/20 uppercase tracking-[0.2em] mb-1">Active Fleet</div>
                                <div className="text-2xl font-black text-white">{stats.active}</div>
                            </div>
                        </div>
                        <button onClick={() => fetchData()} className="w-14 h-14 bg-emerald-500 text-black rounded-full hover:bg-emerald-400 transition-all shadow-[0_0_30px_rgba(16,185,129,0.3)] flex items-center justify-center group active:scale-95">
                            <RefreshCw size={22} className="group-hover:rotate-180 transition-transform duration-700" />
                        </button>
                    </div>
                </div>

                {/* --- SMART METRIC GRID --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="lg:col-span-1 space-y-4">
                        <SectionHeader label="Fleet & Ops" icon={Activity} colorClass="emerald" />
                        <GlassCard title="System Mobility" value={pct(stats.active, stats.total) + '%'} sub={`${stats.active} Active / ${stats.total} Total`} icon={Zap} color="emerald" progress={pct(stats.active, stats.total)} />
                        <GlassCard title="Node Strength" value={leaderboard.length} sub="Active Team Leaders" icon={Users} color="blue" />
                    </div>
                    <div className="lg:col-span-1 space-y-4">
                        <SectionHeader label="VIP Segment" icon={Shield} colorClass="orange" live />
                        <GlassCard title="VPI Fleet" value={stats.vpiCount} sub="Exclusively Scoped" icon={Crown} color="orange" highlightBadge="Elite" />
                        <GlassCard title="VPI Liability" value={fmt(Math.abs(stats.vpiAmt))} sub={`${stats.vpiNeg} Critical Debts`} icon={AlertTriangle} color="orange" />
                    </div>
                    <div className="lg:col-span-2 space-y-4">
                        <SectionHeader label="Financial Matrix" icon={IndianRupee} colorClass="indigo" />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 h-full">
                            <GlassCard title="Weekly Rev" value={fmt(stats.weekCollTotal)} sub="Aggregated History" icon={TrendingUp} color="emerald" progress={80} />
                            <GlassCard title="System Liquidity" value={fmt(stats.posAmt - stats.negAmt)} sub="Net Ledger Balance" icon={Wallet} color="indigo" />
                            <GlassCard title="Risk Coverage" value={stats.highDebt} sub="Wallets < -₹3,000" icon={AlertTriangle} color="rose" highlightBadge="Action" />
                            <GlassCard title="Conversion" value={stats.leadsConverted} sub="New Fleet Ingress" icon={Activity} color="teal" />
                        </div>
                    </div>
                </div>

                {/* --- ANALYTICS PANEL --- */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                    {/* Weekly Chart */}
                    <div className="lg:col-span-8 bg-[#15171E]/70 backdrop-blur-2xl border border-white/5 rounded-[40px] p-8 shadow-2xl">
                        <div className="flex justify-between items-center mb-8">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500"><BarChart3 size={18} /></div>
                                <div>
                                    <h3 className="font-black text-sm uppercase tracking-widest text-white/90">Seven Day Pulse</h3>
                                    <p className="text-[10px] text-white/30 font-bold">Network wide collection velocity</p>
                                </div>
                            </div>
                            <div className="flex gap-2 bg-black/40 p-1.5 rounded-2xl border border-white/5">
                                {(['day', 'week', 'month'] as const).map(t => (
                                    <button key={t} onClick={() => setDateFilter(t)} className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${dateFilter === t ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={weeklyColl}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff05" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill:'#ffffff30', fontSize:10, fontWeight:800}} dy={15} />
                                    <Tooltip 
                                        cursor={{fill: '#ffffff05', radius: 8}} 
                                        contentStyle={{backgroundColor:'#0B0D14', border:'1px solid #ffffff10', borderRadius:'16px', color:'#fff', padding:'12px'}} 
                                    />
                                    <Bar dataKey="amount" radius={[8, 8, 2, 2]} barSize={44} animationDuration={1000}>
                                        {weeklyColl.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={index === 6 ? '#10b981' : '#10b98125'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Fleet Health Donut */}
                    <div className="lg:col-span-4 bg-[#15171E]/70 backdrop-blur-2xl border border-white/5 rounded-[40px] p-8 shadow-2xl flex flex-col">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500"><Activity size={18} /></div>
                            <h3 className="font-black text-sm uppercase tracking-widest text-white/90">Fleet Integrity</h3>
                        </div>
                        <div className="flex-1 flex flex-col items-center justify-center">
                            <div className="h-[200px] w-full relative">
                                <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                                    <div className="text-3xl font-black text-white">{pct(stats.active, stats.total)}%</div>
                                    <div className="text-[9px] font-bold text-white/20 uppercase tracking-widest leading-none mt-1">Operational</div>
                                </div>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie 
                                            data={[
                                                { name: 'Active', value: stats.active },
                                                { name: 'Inactive', value: stats.total - stats.active }
                                            ]} 
                                            innerRadius={70} outerRadius={90} paddingAngle={8} dataKey="value" stroke="none"
                                        >
                                            <Cell fill="#10b981" />
                                            <Cell fill="#ffffff08" />
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="grid grid-cols-2 gap-4 w-full mt-10">
                                <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                                    <div className="text-[8px] font-bold text-emerald-500 uppercase tracking-widest mb-1 flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active</div>
                                    <div className="text-lg font-black text-white">{stats.active}</div>
                                </div>
                                <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                                    <div className="text-[8px] font-bold text-rose-500 uppercase tracking-widest mb-1 flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Down</div>
                                    <div className="text-lg font-black text-white">{stats.total - stats.active}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- DEBT LIABILITY PANEL --- */}
                <div className="bg-[#15171E]/90 backdrop-blur-3xl border border-white/10 rounded-[48px] overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.5)]">
                    <div className="p-10 border-b border-white/5 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent relative">
                        <div className="absolute top-0 right-0 p-10 opacity-10"><Shield size={120} className="text-emerald-500" /></div>
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-10 relative z-20">
                            <div>
                                <h2 className="text-3xl font-black text-white tracking-tighter flex items-center gap-4">
                                   <Briefcase className="text-emerald-500" size={32} /> Debt Recovery Control
                                </h2>
                                <p className="text-sm text-white/30 font-bold mt-2 uppercase tracking-[0.2em] flex items-center gap-2">
                                     <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> RM ➔ TL ➔ RIDER COMMAND CHAIN
                                </p>
                            </div>
                            <div className="relative w-full md:w-96 group">
                                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-emerald-500 transition-colors" size={18} />
                                <input 
                                    type="text" placeholder="Trace rider by name or mobile..."
                                    value={debtSearch} onChange={(e) => setDebtSearch(e.target.value)}
                                    className="w-full bg-black/50 border border-white/10 rounded-[20px] py-4 pl-14 pr-6 text-sm font-bold text-white focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all placeholder:text-white/10"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="max-h-[600px] overflow-y-auto custom-scrollbar p-6 space-y-8">
                        {leaderboard.map(tl => {
                            const tlRiders = riders.filter(r => r.team_leader_id === tl.id && r.wallet_amount < -500 && (r.rider_name.toLowerCase().includes(debtSearch.toLowerCase()) || r.mobile_number.includes(debtSearch)));
                            if (tlRiders.length === 0) return null;
                            return (
                                <div key={tl.id} className="bg-black/30 rounded-[32px] border border-white/5 p-2 overflow-hidden shadow-xl">
                                    <div className="px-8 py-5 flex items-center justify-between border-b border-white/5 bg-white/[0.03] backdrop-blur-lg rounded-t-[30px]">
                                        <div className="flex items-center gap-5">
                                            <div className="w-12 h-12 rounded-[18px] bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-500 font-black text-lg shadow-lg">
                                                {tl.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="text-sm font-black text-white tracking-tight uppercase">{tl.name}</div>
                                                <div className="text-[10px] font-black text-emerald-500/50 uppercase tracking-[0.2em] mt-0.5">Primary Node</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-lg font-black text-rose-500">{fmt(tl.debt)}</div>
                                            <div className="text-[10px] font-black text-white/10 uppercase tracking-widest mt-0.5">Total Liability</div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-4">
                                        <AnimatePresence>
                                            {tlRiders.slice(0, 15).map((rider, idx) => (
                                                <motion.div 
                                                    key={rider.id}
                                                    initial={{ opacity: 0, scale: 0.95 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    transition={{ delay: idx * 0.05 }}
                                                    className="bg-[#1A1B23]/40 border border-white/5 rounded-2xl p-5 flex flex-col gap-6 group hover:border-emerald-500/30 hover:bg-[#1A1B23] transition-all relative overflow-hidden"
                                                >
                                                    <div className="absolute top-0 right-0 p-4 opacity-[0.03] -rotate-12 translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform">
                                                        <Wallet size={80} className="text-rose-500" />
                                                    </div>
                                                    <div className="flex justify-between items-start relative z-10">
                                                        <div className="space-y-1">
                                                            <div className="text-sm font-black text-white group-hover:text-emerald-400 transition-colors">{rider.rider_name}</div>
                                                            <div className="text-[10px] font-bold text-white/30 tracking-widest leading-none">{rider.mobile_number}</div>
                                                            <div className="pt-2"><span className="text-[8px] font-black bg-white/5 text-white/40 px-2 py-0.5 rounded-[4px] uppercase">{rider.client_name || 'Generic'}</span></div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-base font-black text-rose-500 drop-shadow-sm">{fmt(Math.abs(rider.wallet_amount))}</div>
                                                            <div className="text-[9px] font-bold text-rose-500/40 uppercase tracking-widest mt-1">Outstanding</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 relative z-10 mt-auto">
                                                        <button onClick={() => handleCommunication(rider, 'call')} className="flex-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-xl py-3 flex items-center justify-center hover:bg-emerald-500 hover:text-black transition-all active:scale-95 shadow-sm">
                                                            <Phone size={16} strokeWidth={2.5} />
                                                        </button>
                                                        <button onClick={() => handleCommunication(rider, 'wa')} className="flex-1 bg-blue-500/10 border border-blue-500/20 text-blue-500 rounded-xl py-3 flex items-center justify-center hover:bg-blue-500 hover:text-black transition-all active:scale-95 shadow-sm">
                                                            <MessageSquare size={16} strokeWidth={2.5} />
                                                        </button>
                                                        <button onClick={() => toast.success('Alert broadcasted to ' + rider.rider_name)} className="w-12 bg-white/5 border border-white/8 text-white/20 rounded-xl flex items-center justify-center hover:bg-white/10 hover:text-white transition-all active:scale-95 shadow-sm">
                                                            <Bell size={16} />
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* --- SUPERVISOR TABLE --- */}
                <div className="bg-[#15171E]/60 backdrop-blur-xl border border-white/5 rounded-[44px] overflow-hidden shadow-2xl flex flex-col">
                    <div className="px-10 py-8 border-b border-white/5 flex flex-col sm:flex-row justify-between items-center gap-6 bg-gradient-to-r from-blue-500/5 to-transparent">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500 shadow-inner"><LayoutDashboard size={24} /></div>
                            <div>
                                <h3 className="text-xl font-black text-white tracking-tight">Supervisor Performance</h3>
                                <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest mt-1">Real-time Node Monitoring</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 w-full sm:w-auto">
                             <div className="relative flex-1 sm:w-64 group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-blue-400 transition-colors" size={14} />
                                <input 
                                    type="text" placeholder="Filter node tag..." 
                                    value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl py-3 pl-11 pr-5 text-xs font-black text-white focus:outline-none focus:border-blue-500 transition-all placeholder:text-white/10" 
                                />
                             </div>
                        </div>
                    </div>
                    <div className="overflow-x-auto max-h-[500px] custom-scrollbar scroll-smooth">
                        <table className="w-full text-left relative">
                            <thead className="sticky top-0 bg-[#15171E] z-30 shadow-2xl border-b border-white/5">
                                <tr className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">
                                    <th className="px-10 py-5">Node Identity</th>
                                    <th className="px-10 py-5 text-center">Fleet Capacity</th>
                                    <th className="px-10 py-5 text-center">Day Velocity</th>
                                    <th className="px-10 py-5 text-center">Efficiency</th>
                                    <th className="px-10 py-5 text-center">AI Grade</th>
                                    <th className="px-10 py-5 text-right w-32">Module Control</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.03]">
                                {leaderboard.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase())).map((tl, i) => (
                                    <motion.tr 
                                        key={tl.id} 
                                        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                                        className="hover:bg-white/[0.03] transition-colors group"
                                    >
                                        <td className="px-10 py-6">
                                            <div className="flex items-center gap-4">
                                                <div className="relative">
                                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-500/5 border border-white/5 flex items-center justify-center font-black text-blue-400 group-hover:scale-110 group-hover:shadow-[0_0_20px_#3b82f620] transition-all duration-500">
                                                        {tl.name.charAt(0)}
                                                    </div>
                                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#10b981] rounded-full border-4 border-[#15171E] shadow-sm animate-pulse" />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-black text-white tracking-tight">{tl.name}</div>
                                                    <div className="text-[9px] font-black text-white/20 uppercase mt-0.5 tracking-widest">{tl.id.slice(0,10).toUpperCase()}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-10 py-6 text-center">
                                            <div className="inline-flex flex-col items-center">
                                                <div className="text-sm font-black text-white">{tl.active} <span className="text-white/20">/ {tl.total}</span></div>
                                                <div className="w-20 h-1.5 bg-white/5 rounded-full mt-2 overflow-hidden shadow-inner">
                                                    <motion.div 
                                                        initial={{ width: 0 }} 
                                                        animate={{ width: `${pct(tl.active, tl.total)}%` }} 
                                                        className="h-full bg-blue-500 shadow-[0_0_8px_#3b82f6]" 
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-10 py-6 text-center">
                                            <div className="text-sm font-black text-emerald-400 drop-shadow-md">{fmt(tl.coll)}</div>
                                            <div className="text-[9px] font-bold text-white/20 uppercase tracking-widest mt-1">Real-time Collection</div>
                                        </td>
                                        <td className="px-10 py-6 text-center">
                                            <div className="flex flex-col items-center">
                                                <div className={`text-sm font-black ${tl.growth >= 80 ? 'text-emerald-400' : tl.growth >= 60 ? 'text-amber-500' : 'text-rose-500'}`}>{tl.growth}%</div>
                                                <div className="text-[9px] font-bold text-white/20 uppercase tracking-widest mt-1">Utilization</div>
                                            </div>
                                        </td>
                                        <td className="px-10 py-6 text-center">
                                            <div className="px-5 py-1.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl text-[11px] font-black inline-flex items-center gap-2 shadow-sm">
                                                <Zap size={11} /> S-RANK
                                            </div>
                                        </td>
                                        <td className="px-10 py-6 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => navigate(`/city-ops/riders?tlId=${tl.id}`)} className="w-10 h-10 flex items-center justify-center hover:bg-emerald-500/10 text-white/10 hover:text-emerald-400 rounded-xl border border-transparent hover:border-emerald-500/20 transition-all active:scale-95 group/btn" title="Rider Management">
                                                    <Users size={16} className="group-hover/btn:scale-110" />
                                                </button>
                                                <button onClick={() => setHistoryTL({ id: tl.id, name: tl.name })} className="w-10 h-10 flex items-center justify-center hover:bg-blue-500/10 text-white/10 hover:text-blue-400 rounded-xl border border-transparent hover:border-blue-500/20 transition-all active:scale-95 group/btn" title="Collection History">
                                                    <Clock size={16} className="group-hover/btn:scale-110" />
                                                </button>
                                                <button onClick={() => navigate(`/city-ops/leads?tlId=${tl.id}`)} className="w-10 h-10 flex items-center justify-center hover:bg-indigo-400/10 text-white/10 hover:text-indigo-400 rounded-xl border border-transparent hover:border-indigo-400/20 transition-all active:scale-95 group/btn" title="Lead Center">
                                                    <ExternalLink size={16} className="group-hover/btn:scale-110" />
                                                </button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                            <tfoot className="sticky bottom-0 bg-[#1A1C26]/90 backdrop-blur-3xl text-[10px] font-black z-40 border-t border-white/10 shadow-[0_-20px_40px_rgba(0,0,0,0.5)]">
                                <tr>
                                    <td className="px-10 py-6 uppercase tracking-[0.3em] text-white/30">Network Aggregate Statistics</td>
                                    <td className="px-10 py-6 text-center text-white/60">
                                        <span className="text-white">{stats.active}</span> Active Units / <span className="text-white/40">{stats.total} Total Units</span>
                                    </td>
                                    <td className="px-10 py-6 text-center">
                                        <div className="text-xl font-black text-emerald-500 mb-0.5">{fmt(stats.dayColl)}</div>
                                        <div className="text-[8px] text-emerald-500/40 uppercase tracking-widest">Total Daily Yield</div>
                                    </td>
                                    <td className="px-10 py-6 text-center">
                                        <div className="text-xl font-black text-white mb-0.5">{pct(stats.active, stats.total)}%</div>
                                        <div className="text-[8px] text-white/20 uppercase tracking-widest">Fleet Efficiency</div>
                                    </td>
                                    <td className="px-10 py-6 text-center">---</td>
                                    <td className="px-10 py-6 text-right">
                                        <button onClick={() => navigate('/city-ops/performance')} className="px-6 py-3 bg-blue-500 text-black text-[10px] font-black uppercase tracking-[0.2em] rounded-full hover:bg-blue-400 transition-all shadow-[0_0_20px_#3b82f640] flex items-center gap-3 justify-center group/all">
                                            FULL REPORT <ArrowRight size={14} className="group-hover/all:translate-x-1 transition-transform" />
                                        </button>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* --- CHAMPIONS PODIUM --- */}
                <div className="w-full pt-20 border-t border-white/5">
                    <div className="flex flex-col items-center justify-center text-center mb-16 relative">
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-40 h-40 bg-amber-500/5 blur-[80px] rounded-full pointer-events-none" />
                        <div className="flex items-center gap-3 text-amber-500/30 text-[10px] font-black uppercase tracking-[0.6em] mb-4">
                            <Star size={11} /> Global Network Authority <Star size={11} />
                        </div>
                        <h2 className="text-5xl sm:text-6xl font-black text-white tracking-tighter flex flex-col sm:flex-row items-center gap-6">
                            <Trophy className="text-amber-500" size={48} /> 
                            <span>Network <span className="text-amber-500">Champions</span></span>
                        </h2>
                    </div>
                    {lbLoading ? (
                        <div className="h-40 flex items-center justify-center text-white/20 animate-pulse">Syncing Leaderboard...</div>
                    ) : (
                        <div className="flex flex-col items-center">
                            <div className="flex flex-col lg:flex-row items-end justify-center gap-12 lg:gap-16 w-full max-w-7xl px-4">
                                <PodiumCard rank={2} color="slate" data={leaderboard[1] || { name: 'Empty', coll: 0, active: 0, growth: 0 }} />
                                <PodiumCard rank={1} color="amber" data={leaderboard[0] || { name: 'Empty', coll: 0, active: 0, growth: 0 }} tall />
                                <PodiumCard rank={3} color="orange" data={leaderboard[2] || { name: 'Empty', coll: 0, active: 0, growth: 0 }} />
                            </div>
                        </div>
                    )}
                </div>

            </div>

            {/* modals */}
            {historyTL && (
                <CollectionHistoryModal 
                    isOpen={!!historyTL} 
                    onClose={() => setHistoryTL(null)} 
                    teamLeaderId={historyTL.id} 
                    teamLeaderName={historyTL.name} 
                />
            )}

            {/* Custom Styles for scrollbar and glow */}
            <style dangerouslySetInnerHTML={{ __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 20px; }
            `}} />
        </div>
    );
};

// Simple Star Icon
const Star = ({ size, className }: { size: number, className?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
);

export default CityOpsDashboard;
