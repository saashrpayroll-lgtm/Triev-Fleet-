/**
 * City Ops Dashboard — Premium Command Center v3
 * ✅ Paginated fetch (fixes 629-vs-712 accuracy bug)
 * ✅ 8 sections: Fleet, Zomato VPI, Financial, Wallet, Growth, Alerts, Leaderboard, Watchlist
 * ✅ Call / WhatsApp / Reminder action buttons
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useCityOpsScope } from '@/hooks/useCityOpsScope';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/config/supabase';
import { fetchAllRidersPaginated, fetchTablePaginated } from '@/utils/dbUtils';
import {
    Users, UserCheck, AlertTriangle, Target, Wallet, RefreshCw,
    Zap, Activity, ChevronRight, IndianRupee, BarChart3, Clock, Shield,
    Bike, Star, ChevronUp, ChevronDown, Phone, MessageCircle, Bell,
    Award, TrendingUp, UserPlus, Flame, Crown
} from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';

// ── Helpers ──
const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const fmtS = (n: number) => {
    if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
    return fmt(n);
};
const pct = (a: number, b: number) => b > 0 ? Math.round((a / b) * 100) : 0;



// ── Section header ──
const SectionHeader: React.FC<{ label: string; icon: React.ElementType; color: string }> = ({ label, icon: Icon, color }) => (
    <div className="flex items-center gap-2.5 px-1 mt-2">
        <div className="relative">
            <div className={`absolute inset-0 ${color.replace('from-', 'bg-').split(' ')[0].replace('bg-gradient-to-r', '')} blur-md opacity-40 rounded-full`} />
            <div className={`relative w-7 h-7 rounded-full bg-gradient-to-br ${color} flex items-center justify-center shadow-lg border border-white/20`}>
                <Icon size={12} className="text-white" />
            </div>
        </div>
        <span className={`text-[11px] font-black uppercase tracking-[0.2em] bg-gradient-to-r ${color} bg-clip-text text-transparent`}>{label}</span>
        <div className={`flex-1 h-px bg-gradient-to-r ${color} opacity-30`} />
    </div>
);

// ── Stat card ──
const SC: React.FC<{
    title: string; value: string | number; icon: React.ElementType; color: string;
    sub?: string; onClick?: () => void; badge?: string; alert?: boolean; progress?: number;
}> = ({ title, value, icon: Icon, color, sub, onClick, badge, alert, progress }) => (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        whileHover={onClick ? { scale: 1.03, y: -2 } : {}} onClick={onClick}
        className={`bg-card border rounded-2xl p-4 shadow-sm relative overflow-hidden transition-all
            ${alert ? 'border-rose-500/40 bg-rose-500/5' : 'border-border/60'}
            ${onClick ? 'cursor-pointer hover:shadow-md' : ''}`}>
        {badge && <span className="absolute top-2 right-2 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600 border border-amber-500/30">{badge}</span>}
        <div className="flex items-start justify-between">
            <div className="space-y-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 truncate">{title}</p>
                <p className="text-xl font-black tabular-nums truncate">{typeof value === 'number' ? value.toLocaleString('en-IN') : value}</p>
                {sub && <p className="text-[10px] text-muted-foreground truncate">{sub}</p>}
            </div>
            <div className={`p-2 rounded-xl bg-${color}-500/10 flex-shrink-0`}>
                <Icon size={16} className={`text-${color}-600`} />
            </div>
        </div>
        {progress !== undefined && (
            <div className="mt-2 w-full bg-muted/40 rounded-full h-1.5">
                <div className={`bg-${color}-500 rounded-full h-1.5 transition-all duration-700`} style={{ width: `${Math.min(progress, 100)}%` }} />
            </div>
        )}
        {onClick && <div className={`flex items-center gap-1 mt-2 text-[10px] font-semibold text-${color}-600`}>View <ChevronRight size={10} /></div>}
    </motion.div>
);

// ── Action buttons ──
const ActionBtns: React.FC<{ mobile?: string; name?: string; tlId?: string; toast: ReturnType<typeof useToast> }> = ({ mobile, name, tlId, toast: t }) => {
    if (!mobile) return null;
    const clean = mobile.replace(/\D/g, '').replace(/^0+/, '');
    const phone = clean.startsWith('91') ? clean : `91${clean}`;
    
    const handleReminder = async () => {
        t.info(`Sending reminder to ${name || 'Rider'}...`);
        try {
            if (tlId) {
                await supabase.from('notifications').insert({
                    user_id: tlId,
                    title: 'Follow-Up Required',
                    message: `Please follow up with rider ${name || mobile} regarding their wallet balance.`,
                    type: 'reminder',
                    priority: 'high',
                    is_read: false
                });
            }
            t.success(`Database reminder triggered for ${name || mobile}`);
        } catch (e) {
            console.error(e);
            t.error('Failed to send reminder');
        }
    };

    return (
        <div className="flex gap-1.5 flex-shrink-0">
            <a href={`tel:+${phone}`} className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 transition-colors" title="Call">
                <Phone size={12} />
            </a>
            <a href={`https://wa.me/${phone}?text=${encodeURIComponent(`Hi ${name || 'Rider'}, this is regarding your Triev account.`)}`}
                target="_blank" rel="noopener noreferrer"
                className="p-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-600 transition-colors" title="WhatsApp">
                <MessageCircle size={12} />
            </a>
            <button onClick={handleReminder} className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 transition-colors" title="Reminder">
                <Bell size={12} />
            </button>
        </div>
    );
};

// ── Mini bar chart ──
const WeekBars: React.FC<{ data: { label: string; value: number }[] }> = ({ data }) => {
    const max = Math.max(...data.map(d => d.value), 1);
    return (
        <div className="flex items-end gap-1 h-20">
            {data.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[8px] font-black text-muted-foreground">{d.value > 0 ? fmtS(d.value) : ''}</span>
                    <div className="w-full bg-blue-500/80 rounded-t-sm transition-all duration-700" style={{ height: `${Math.max(pct(d.value, max), 3)}%` }} />
                    <span className="text-[8px] font-bold text-muted-foreground">{d.label}</span>
                </div>
            ))}
        </div>
    );
};

// ── Types ──
interface RiderRaw { id: string; status: string; wallet_amount: number; client_name: string; team_leader_id: string; allotment_date: string; inactivated_at?: string; rider_name: string; mobile_number: string; }
interface TLEntry { id: string; full_name: string; reporting_manager: string; }
interface CollRow { team_leader_id: string; total_collection: number; date: string; }
interface LeadRow { id: string; status: string; created_by: string; }
type Section = 'fleet' | 'zomato' | 'financial' | 'wallet' | 'growth' | 'alerts' | 'leaderboard' | 'watchlist';

// ── Main Component ──
const CityOpsDashboard: React.FC = () => {
    const { userData } = useSupabaseAuth();
    const { cityOpsId, rmIds, tlIds, isLoading: scopeLoading } = useCityOpsScope();
    const navigate = useNavigate();
    const toast = useToast();

    const [riders, setRiders] = useState<RiderRaw[]>([]);
    const [leads, setLeads] = useState<LeadRow[]>([]);
    const [tlMap, setTlMap] = useState<Record<string, TLEntry>>({});
    const [collToday, setCollToday] = useState<CollRow[]>([]);
    const [collWeek, setCollWeek] = useState<CollRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastRefresh, setLastRefresh] = useState(new Date());
    const [section, setSection] = useState<Section>('fleet');
    const [negExpanded, setNegExpanded] = useState(false);
    const [leaderboard, setLeaderboard] = useState<{ name: string; active: number; coll: number; health: number; isMe?: boolean }[]>([]);
    const [lbLoading, setLbLoading] = useState(false);

    // ✅ FIX: Use paginated fetch to avoid 1000-row limit
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

            const [ridersRes, leadsRes, tlRes, collTodayRes, collWeekRes] = await Promise.all([
                fetchAllRidersPaginated(
                    'id, status, wallet_amount, client_name, team_leader_id, allotment_date, inactivated_at, rider_name, mobile_number',
                    { column: 'team_leader_id', value: tlIds, type: 'in' }
                ),
                supabase.from('leads').select('id, status, created_by').in('created_by', tlIds),
                supabase.from('users').select('id, full_name, reporting_manager').in('id', tlIds),
                fetchTablePaginated('daily_collections', 'team_leader_id, total_collection, date', [
                    { column: 'date', operator: 'eq', value: todayStr },
                    { column: 'team_leader_id', operator: 'in', value: tlIds },
                ]),
                fetchTablePaginated('daily_collections', 'team_leader_id, total_collection, date', [
                    { column: 'date', operator: 'gte', value: weekStartStr },
                    { column: 'team_leader_id', operator: 'in', value: tlIds },
                ]),
            ]);

            setRiders((ridersRes.data || []) as RiderRaw[]);
            setLeads((leadsRes.data || []) as LeadRow[]);
            const tmap: Record<string, TLEntry> = {};
            (tlRes.data || []).forEach((t: { id: string; full_name: string; reporting_manager: string }) => { tmap[t.id] = t; });
            setTlMap(tmap);
            setCollToday((collTodayRes.data || []) as CollRow[]);
            setCollWeek((collWeekRes.data || []) as CollRow[]);
            setLastRefresh(new Date());
        } catch (err) { console.error('[CityOps] fetchAll error:', err); }
        finally { setLoading(false); }
    }, [cityOpsId, tlIds]);

    useEffect(() => { if (!scopeLoading && cityOpsId && tlIds.length > 0) fetchAll(); }, [scopeLoading, cityOpsId, tlIds.length, fetchAll]);

    // Real-time
    useEffect(() => {
        if (!cityOpsId) return;
        let t: ReturnType<typeof setTimeout>;
        const ch = supabase.channel('cityops-rt')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'riders' }, () => { clearTimeout(t); t = setTimeout(fetchAll, 1500); })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_collections' }, () => { clearTimeout(t); t = setTimeout(fetchAll, 1500); })
            .subscribe();
        return () => { supabase.removeChannel(ch); clearTimeout(t); };
    }, [cityOpsId, fetchAll]);

    // Leaderboard (company-wide — fetches all Team Leaders)
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
                    name: tl.full_name, 
                    active, 
                    coll: todayColl, 
                    health: riderList.length > 0 ? pct(active, riderList.length) : 0,
                    isMe: tl.city_ops_id === cityOpsId // Highlight TLs that belong to this CityOps
                };
            }));
            setLeaderboard(lb.sort((a, b) => b.active - a.active));
        } catch (err) { console.error('[Leaderboard]', err); }
        finally { setLbLoading(false); }
    }, [cityOpsId]);

    useEffect(() => { if (section === 'leaderboard' && leaderboard.length === 0) fetchLeaderboard(); }, [section, leaderboard.length, fetchLeaderboard]);

    // ── Derived stats ──
    const stats = useMemo(() => {
        const active = riders.filter(r => r.status === 'active');
        const inactive = riders.filter(r => r.status === 'inactive');
        const deleted = riders.filter(r => r.status === 'deleted');

        const clientMap: Record<string, number> = {};
        active.forEach(r => { const c = r.client_name || 'Other'; clientMap[c] = (clientMap[c] || 0) + 1; });

        const zomato = active.filter(r => r.client_name?.trim().toLowerCase() === 'zomato');
        const zomatoNeg = zomato.filter(r => (r.wallet_amount || 0) < 0);

        const walletPos = active.filter(r => (r.wallet_amount || 0) > 0);
        const walletNeg = active.filter(r => (r.wallet_amount || 0) < 0);
        const walletZero = active.filter(r => (r.wallet_amount || 0) === 0);
        const negAmt = walletNeg.reduce((s, r) => s + Math.abs(r.wallet_amount || 0), 0);
        const posAmt = walletPos.reduce((s, r) => s + (r.wallet_amount || 0), 0);
        const highDebt = active.filter(r => (r.wallet_amount || 0) < -3000);
        const lowBal = active.filter(r => (r.wallet_amount || 0) >= 0 && (r.wallet_amount || 0) <= 250);

        const todayColl = collToday.reduce((s, c) => s + (c.total_collection || 0), 0);
        const weekColl = collWeek.reduce((s, c) => s + (c.total_collection || 0), 0);

        // Weekly chart data (per day)
        const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const weekChart: { label: string; value: number }[] = dayNames.map(() => ({ label: '', value: 0 }));
        collWeek.forEach(c => {
            const d = new Date(c.date + 'T00:00:00Z');
            const dow = d.getUTCDay();
            const idx = dow === 0 ? 6 : dow - 1;
            weekChart[idx].value += c.total_collection || 0;
        });
        weekChart.forEach((d, i) => { d.label = dayNames[i]; });

        // TL-wise bifurcation + RM grouping
        const tlBif: { id: string; name: string; rm: string; pos: number; neg: number; negAmt: number; total: number; coll: number }[] = [];
        Object.entries(tlMap).forEach(([id, tl]) => {
            const tlActive = active.filter(r => r.team_leader_id === id);
            const tlNeg = tlActive.filter(r => (r.wallet_amount || 0) < 0);
            const tlColl = collToday.filter(c => c.team_leader_id === id).reduce((s, c) => s + (c.total_collection || 0), 0);
            tlBif.push({ id, name: tl.full_name, rm: tl.reporting_manager || 'N/A', pos: tlActive.filter(r => (r.wallet_amount || 0) > 0).length, neg: tlNeg.length, negAmt: tlNeg.reduce((s, r) => s + Math.abs(r.wallet_amount || 0), 0), total: tlActive.length, coll: tlColl });
        });
        tlBif.sort((a, b) => b.negAmt - a.negAmt);

        // RM-wise aggregation
        const rmBif: Record<string, { name: string; pos: number; neg: number; negAmt: number; total: number }> = {};
        tlBif.forEach(tl => {
            if (!rmBif[tl.rm]) rmBif[tl.rm] = { name: tl.rm, pos: 0, neg: 0, negAmt: 0, total: 0 };
            rmBif[tl.rm].pos += tl.pos; rmBif[tl.rm].neg += tl.neg; rmBif[tl.rm].negAmt += tl.negAmt; rmBif[tl.rm].total += tl.total;
        });

        const leadConv = leads.filter(l => l.status === 'Convert').length;
        const leadNew = leads.filter(l => l.status === 'New').length;
        const leadNotConv = leads.filter(l => l.status === 'Not Convert').length;
        const avgWallet = active.length > 0 ? Math.round(active.reduce((s, r) => s + (r.wallet_amount || 0), 0) / active.length) : 0;

        // Performance alerts
        const alerts: { msg: string; severity: 'critical' | 'warn' | 'info' }[] = [];
        tlBif.forEach(tl => {
            if (tl.coll === 0 && tl.total > 0) alerts.push({ msg: `${tl.name} — Zero collection today (${tl.total} riders)`, severity: 'warn' });
            if (tl.total > 0 && pct(tl.neg, tl.total) > 50) alerts.push({ msg: `${tl.name} — ${pct(tl.neg, tl.total)}% negative wallets`, severity: 'critical' });
        });
        if (highDebt.length > 10) alerts.push({ msg: `${highDebt.length} riders with debt > ₹3,000`, severity: 'critical' });

        return {
            total: riders.length, active: active.length, inactive: inactive.length, deleted: deleted.length,
            clientMap, clientList: Object.entries(clientMap).sort((a, b) => b[1] - a[1]),
            zomato: zomato.length, zomatoNeg, zomatoNegAmt: zomatoNeg.reduce((s, r) => s + Math.abs(r.wallet_amount || 0), 0),
            walletPos: walletPos.length, walletNeg: walletNeg.length, walletZero: walletZero.length,
            negAmt, posAmt, negPct: pct(walletNeg.length, active.length), avgWallet,
            highDebt, lowBal, todayColl, weekColl, weekChart,
            perRiderToday: active.length > 0 ? Math.round(todayColl / active.length) : 0,
            fleetHealth: pct(active.length, riders.length),
            leadConv, leadNew, leadNotConv, leads: leads.length,
            tlBif, rmBif: Object.values(rmBif).sort((a, b) => b.negAmt - a.negAmt),
            alerts,
        };
    }, [riders, leads, collToday, collWeek, tlMap]);

    // ── Loading ──
    if (scopeLoading || (loading && riders.length === 0)) {
        return (
            <div className="space-y-4 p-4 animate-in fade-in">
                <div className="h-28 bg-gradient-to-r from-amber-500/20 to-orange-600/20 rounded-2xl animate-pulse" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-24 bg-card rounded-xl border border-border animate-pulse" />)}</div>
            </div>
        );
    }

    const tabs: { id: Section; emoji: string; label: string }[] = [
        { id: 'fleet', emoji: '🚀', label: 'Fleet & Ops' },
        { id: 'zomato', emoji: '🟥', label: 'Zomato VPI' },
        { id: 'financial', emoji: '💰', label: 'Financial' },
        { id: 'wallet', emoji: '💳', label: 'Wallet Risk' },
        { id: 'growth', emoji: '📈', label: 'Growth' },
        { id: 'alerts', emoji: '⚠️', label: 'Alerts' },
        { id: 'leaderboard', emoji: '🏆', label: 'Leaderboard' },
        { id: 'watchlist', emoji: '👀', label: 'Watchlist' },
    ];

    return (
        <div className="space-y-4 pb-12 animate-in fade-in duration-300">

            {/* ── HERO BANNER ── */}
            <div className="bg-gradient-to-br from-amber-950 via-orange-950 to-black rounded-3xl p-5 shadow-2xl relative overflow-hidden border border-white/5">
                <div className="absolute -top-16 -left-16 w-64 h-64 bg-amber-500 rounded-full blur-[120px] opacity-10" />
                <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-orange-600 rounded-full blur-[100px] opacity-10" />
                <div className="relative flex flex-col md:flex-row justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-white/10 rounded-2xl border border-white/10"><Zap className="h-5 w-5 text-amber-400" /></div>
                            <div>
                                <h1 className="text-xl font-black text-white tracking-tight">{userData?.fullName?.split(' ')[0]}'s Command Center</h1>
                                <p className="text-white/40 text-[10px]">{rmIds.length} RMs · {tlIds.length} TLs · Real-time</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {[
                                { l: 'Fleet', v: `${stats.active}/${stats.total}`, c: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/20' },
                                { l: 'Today', v: fmtS(stats.todayColl), c: 'bg-blue-500/20 text-blue-300 border-blue-400/20' },
                                { l: 'Neg', v: `${stats.walletNeg} (${stats.negPct}%)`, c: 'bg-rose-500/20 text-rose-300 border-rose-400/20' },
                                { l: 'Health', v: `${stats.fleetHealth}%`, c: 'bg-violet-500/20 text-violet-300 border-violet-400/20' },
                            ].map(({ l, v, c }, i) => <div key={i} className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase border ${c}`}>{l}: {v}</div>)}
                        </div>
                    </div>
                    <div className="flex items-start gap-2">
                        <button onClick={fetchAll} className="flex items-center gap-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-[10px] text-white font-semibold transition-all">
                            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
                        </button>
                        <div className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/20 rounded-xl text-[9px] font-black uppercase">
                            <Activity className="h-2.5 w-2.5 animate-pulse" /> Live
                        </div>
                    </div>
                </div>
                <p className="relative text-white/25 text-[9px] mt-2">Updated: {lastRefresh.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
            </div>

            {/* ── TABS ── */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 hide-scrollbar">
                {tabs.map(t => (
                    <button key={t.id} onClick={() => setSection(t.id)}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wide whitespace-nowrap transition-all
                            ${section === t.id ? 'bg-primary text-white shadow-md' : 'bg-card border border-border text-muted-foreground hover:bg-muted'}`}>
                        {t.emoji} {t.label}
                    </button>
                ))}
            </div>

            {/* ══════ SECTION 1: FLEET & OPS ══════ */}
            {section === 'fleet' && (<>
                <SectionHeader label="Fleet & Operations" icon={Activity} color="from-emerald-400 to-emerald-600" />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    <SC title="Active Fleet" value={stats.active} icon={UserCheck} color="emerald" sub={`${stats.inactive} idle · ${stats.deleted} del`} progress={stats.fleetHealth} onClick={() => navigate('/city-ops/riders')} />
                    <SC title="Team Leaders" value={tlIds.length} icon={Users} color="violet" sub={`${rmIds.length} RMs`} onClick={() => navigate('/city-ops/staff')} />
                    <SC title="Fleet Health" value={`${stats.fleetHealth}%`} icon={BarChart3} color="blue" progress={stats.fleetHealth} sub={`${stats.total} total riders`} />
                    <SC title="Lead Conversion" value={`${stats.leads > 0 ? pct(stats.leadConv, stats.leads) : 0}%`} icon={UserPlus} color="fuchsia" sub={`${stats.leadNew} new today`} progress={stats.leads > 0 ? pct(stats.leadConv, stats.leads) : 0} onClick={() => navigate('/city-ops/leads')} />
                </div>
                {/* Fleet status bars */}
                <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm">
                    <h3 className="text-xs font-black mb-3 flex items-center gap-2"><Users size={14} className="text-primary" /> Fleet Breakdown</h3>
                    {[{ l: 'Active', n: stats.active, c: 'bg-emerald-500', t: 'text-emerald-600' }, { l: 'Inactive', n: stats.inactive, c: 'bg-amber-500', t: 'text-amber-600' }, { l: 'Deleted', n: stats.deleted, c: 'bg-rose-500', t: 'text-rose-600' }].map(({ l, n, c, t }) => (
                        <div key={l} className="mb-2">
                            <div className="flex justify-between text-[10px] mb-0.5"><span className={`font-bold ${t}`}>{l}</span><span className="font-black">{n} ({pct(n, stats.total)}%)</span></div>
                            <div className="w-full bg-muted/40 rounded-full h-1.5"><div className={`${c} rounded-full h-1.5 transition-all duration-700`} style={{ width: `${pct(n, stats.total)}%` }} /></div>
                        </div>
                    ))}
                </div>
            </>)}

            {/* ══════ SECTION 2: ZOMATO VPI ══════ */}
            {section === 'zomato' && (<>
                <SectionHeader label="Zomato VPI Intelligence" icon={Flame} color="from-red-500 to-red-700" />
                <div className="bg-gradient-to-br from-red-950 via-red-900 to-black rounded-2xl p-5 border border-red-500/20 shadow-xl">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-1"><div className="w-7 h-7 bg-red-600 rounded-lg flex items-center justify-center text-white font-black text-xs">Z</div><h3 className="text-white font-black">Zomato Fleet</h3></div>
                            <div className="text-4xl font-black text-white">{stats.zomato}</div>
                            <p className="text-white/60 text-xs mt-1">{pct(stats.zomato, stats.active)}% of active fleet</p>
                        </div>
                        <div className="text-right space-y-1">
                            <div className="text-white/60 text-[9px] font-black uppercase">Negative</div>
                            <div className="text-2xl font-black text-rose-400">{stats.zomatoNeg.length}</div>
                            <div className="text-rose-300 text-xs font-bold">-{fmtS(stats.zomatoNegAmt)}</div>
                        </div>
                    </div>
                </div>
                {/* Client distribution */}
                <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm">
                    <h3 className="text-xs font-black mb-3 flex items-center gap-2"><Bike size={14} className="text-primary" /> Client-wise Fleet</h3>
                    {stats.clientList.map(([client, count]) => {
                        const colors: Record<string, string> = { 'Zomato': 'bg-red-500', 'Swiggy': 'bg-orange-500', 'Blinkit': 'bg-yellow-500', 'Zepto': 'bg-purple-500' };
                        return (<div key={client} className="mb-2">
                            <div className="flex justify-between text-[10px] mb-0.5"><span className="font-bold">{client}</span><span className="font-black">{count} ({pct(count, stats.active)}%)</span></div>
                            <div className="w-full bg-muted/40 rounded-full h-1.5"><div className={`${colors[client] || 'bg-slate-400'} rounded-full h-1.5 transition-all duration-700`} style={{ width: `${pct(count, stats.active)}%` }} /></div>
                        </div>);
                    })}
                </div>
                {/* Negative Zomato riders with action buttons */}
                {stats.zomatoNeg.length > 0 && (
                    <div className="bg-card border border-rose-500/30 rounded-2xl p-4 shadow-sm">
                        <h3 className="text-xs font-black mb-3 text-rose-600 flex items-center gap-2"><AlertTriangle size={14} /> Negative Zomato Riders ({stats.zomatoNeg.length})</h3>
                        <div className="space-y-1.5 max-h-60 overflow-y-auto">
                            {stats.zomatoNeg.slice(0, 20).map(r => (
                                <div key={r.id} className="flex items-center justify-between p-2 bg-rose-500/5 border border-rose-500/15 rounded-xl">
                                    <div className="min-w-0">
                                        <div className="text-xs font-bold truncate">{r.rider_name || r.id.slice(0, 12)}</div>
                                        <div className="text-[9px] text-muted-foreground">{tlMap[r.team_leader_id]?.full_name || '—'} · {r.mobile_number}</div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className="text-xs font-black text-rose-600">-{fmtS(Math.abs(r.wallet_amount))}</span>
                                        <ActionBtns mobile={r.mobile_number} name={r.rider_name} tlId={r.team_leader_id} toast={toast} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </>)}

            {/* ══════ SECTION 3: FINANCIAL ══════ */}
            {section === 'financial' && (<>
                <SectionHeader label="Financial Performance" icon={TrendingUp} color="from-indigo-400 to-indigo-600" />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    <SC title="Today Collection" value={fmtS(stats.todayColl)} icon={IndianRupee} color="blue" sub={`Per rider: ${fmtS(stats.perRiderToday)}`} />
                    <SC title="Week Collection" value={fmtS(stats.weekColl)} icon={BarChart3} color="indigo" />
                    <SC title="Positive Wallets" value={fmtS(stats.posAmt)} icon={Shield} color="emerald" sub={`${stats.walletPos} riders`} />
                    <SC title="Outstanding Risk" value={fmtS(stats.negAmt)} icon={AlertTriangle} color="rose" sub={`${stats.walletNeg} riders`} alert={stats.negAmt > 100000} />
                </div>
                {/* Weekly chart */}
                <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm">
                    <h3 className="text-xs font-black mb-3 flex items-center gap-2"><BarChart3 size={14} className="text-blue-500" /> Weekly Collection Chart</h3>
                    <WeekBars data={stats.weekChart} />
                </div>
                {/* TL collection ranking */}
                <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm">
                    <h3 className="text-xs font-black mb-3">TL Collection Today</h3>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {stats.tlBif.sort((a, b) => b.coll - a.coll).map(tl => (
                            <div key={tl.id} className="flex justify-between text-[10px] p-1.5 bg-muted/20 rounded-lg">
                                <span className="font-semibold truncate mr-2">{tl.name}</span>
                                <span className="font-black text-emerald-600 flex-shrink-0">{fmtS(tl.coll)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </>)}

            {/* ══════ SECTION 4: WALLET HEALTH ══════ */}
            {section === 'wallet' && (<>
                <SectionHeader label="Wallet Health & Risk" icon={Wallet} color="from-violet-400 to-violet-600" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4">
                        <div className="text-[10px] font-black uppercase text-emerald-600 mb-1">Positive Total</div>
                        <div className="text-2xl font-black text-emerald-600">{fmtS(stats.posAmt)}</div>
                        <div className="text-[10px] text-muted-foreground">{stats.walletPos} riders</div>
                    </div>
                    <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4">
                        <div className="text-[10px] font-black uppercase text-rose-600 mb-1">Negative Total</div>
                        <div className="text-2xl font-black text-rose-600">-{fmtS(stats.negAmt)}</div>
                        <div className="text-[10px] text-muted-foreground">{stats.walletNeg} riders ({stats.negPct}%)</div>
                    </div>
                    <div className="bg-card border border-border/60 rounded-2xl p-4">
                        <div className="text-[10px] font-black uppercase text-muted-foreground mb-1">High Debt (&gt;₹3K)</div>
                        <div className="text-2xl font-black text-rose-700">{stats.highDebt.length}</div>
                    </div>
                </div>
                {/* RM-wise */}
                <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm">
                    <h3 className="text-xs font-black mb-3">RM-wise Wallet Bifurcation</h3>
                    {stats.rmBif.map(rm => (
                        <div key={rm.name} className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0 text-[10px]">
                            <span className="font-bold truncate mr-2">{rm.name}</span>
                            <div className="flex gap-3 flex-shrink-0">
                                <span className="text-emerald-600 font-bold">{rm.pos}✓</span>
                                <span className="text-rose-600 font-bold">{rm.neg}✗</span>
                                <span className="text-rose-500 font-black">{fmtS(rm.negAmt)}</span>
                            </div>
                        </div>
                    ))}
                </div>
                {/* TL-wise */}
                <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm">
                    <h3 className="text-xs font-black mb-3 flex items-center justify-between">
                        <span className="flex items-center gap-2"><Wallet size={14} className="text-violet-500" /> TL-wise Bifurcation</span>
                        <span className="text-[9px] text-muted-foreground font-normal">Sorted by risk</span>
                    </h3>
                    <div className="space-y-1 max-h-60 overflow-y-auto">
                        {stats.tlBif.map(tl => (
                            <div key={tl.id} className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0 text-[10px]">
                                <div className="min-w-0"><span className="font-bold truncate block">{tl.name}</span><span className="text-[8px] text-muted-foreground">{tl.rm}</span></div>
                                <div className="flex gap-2 flex-shrink-0">
                                    <span className="text-emerald-600 font-bold">{tl.pos}✓</span>
                                    <span className="text-rose-600 font-bold">{tl.neg}✗</span>
                                    <span className="text-rose-500 font-black w-14 text-right">{fmtS(tl.negAmt)}</span>
                                    <div className="w-10 bg-muted/40 rounded-full h-1.5 self-center"><div className="bg-rose-500 rounded-full h-1.5" style={{ width: `${pct(tl.neg, tl.total)}%` }} /></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </>)}

            {/* ══════ SECTION 5: GROWTH ══════ */}
            {section === 'growth' && (<>
                <SectionHeader label="Growth & Retention" icon={TrendingUp} color="from-teal-400 to-teal-600" />
                <div className="grid grid-cols-2 gap-2">
                    <SC title="Total Leads" value={stats.leads} icon={Target} color="indigo" sub={`${stats.leadNew} new`} onClick={() => navigate('/city-ops/leads')} />
                    <SC title="Converted" value={stats.leadConv} icon={Star} color="emerald" sub={`${stats.leads > 0 ? pct(stats.leadConv, stats.leads) : 0}% rate`} />
                </div>
                <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm">
                    <h3 className="text-xs font-black mb-3"><Target size={14} className="inline text-indigo-500 mr-1" />Lead Funnel</h3>
                    {[{ l: 'New', n: stats.leadNew, c: 'bg-blue-500', t: 'text-blue-600' }, { l: 'Converted', n: stats.leadConv, c: 'bg-emerald-500', t: 'text-emerald-600' }, { l: 'Not Convert', n: stats.leadNotConv, c: 'bg-rose-500', t: 'text-rose-600' }].map(({ l, n, c, t }) => (
                        <div key={l} className="mb-2">
                            <div className="flex justify-between text-[10px] mb-0.5"><span className={`font-bold ${t}`}>{l}</span><span className="font-black">{n} ({pct(n, stats.leads)}%)</span></div>
                            <div className="w-full bg-muted/40 rounded-full h-1.5"><div className={`${c} rounded-full h-1.5 transition-all duration-700`} style={{ width: `${pct(n, stats.leads)}%` }} /></div>
                        </div>
                    ))}
                </div>
            </>)}

            {/* ══════ SECTION 6: ALERTS ══════ */}
            {section === 'alerts' && (<>
                <SectionHeader label="Performance Alerts" icon={AlertTriangle} color="from-amber-400 to-amber-600" />
                {stats.alerts.length === 0 ? (
                    <div className="bg-card border border-border/60 rounded-2xl p-8 text-center text-muted-foreground text-sm">✓ No alerts — all systems healthy</div>
                ) : (
                    <div className="space-y-2">
                        {stats.alerts.map((a, i) => (
                            <div key={i} className={`flex items-center gap-2 p-3 rounded-xl border ${a.severity === 'critical' ? 'bg-rose-500/5 border-rose-500/30 text-rose-600' : a.severity === 'warn' ? 'bg-amber-500/5 border-amber-500/30 text-amber-600' : 'bg-blue-500/5 border-blue-500/30 text-blue-600'}`}>
                                <AlertTriangle size={14} />
                                <span className="text-xs font-semibold">{a.msg}</span>
                            </div>
                        ))}
                    </div>
                )}
            </>)}

            {/* ══════ SECTION 7: LEADERBOARD ══════ */}
            {section === 'leaderboard' && (<>
                <SectionHeader label="Company Leaderboard" icon={Crown} color="from-amber-400 to-amber-600" />
                {lbLoading ? (
                    <div className="bg-card border border-border/60 rounded-2xl p-8 text-center animate-pulse text-muted-foreground text-sm">Loading company-wide data...</div>
                ) : (
                    <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm">
                        <h3 className="text-xs font-black mb-3 flex items-center gap-2"><Award size={14} className="text-amber-500" /> Team Leader Ranking (Active Fleet)</h3>
                        <div className="space-y-1.5">
                            {leaderboard.map((lb, i) => {
                                const isMe = lb.isMe;
                                return (
                                    <div key={i} className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${isMe ? 'bg-amber-500/10 border-amber-500/30 ring-1 ring-amber-400/30' : 'border-border/30'}`}>
                                        <div className="flex items-center gap-2">
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${i === 0 ? 'bg-amber-500 text-white' : i === 1 ? 'bg-slate-400 text-white' : i === 2 ? 'bg-amber-700 text-white' : 'bg-muted text-muted-foreground'}`}>{i + 1}</div>
                                            <div>
                                                <div className={`text-xs font-bold ${isMe ? 'text-amber-600' : ''}`}>{lb.name} {isMe ? '(Your Team)' : ''}</div>
                                                <div className="text-[9px] text-muted-foreground">Health: {lb.health}%</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs font-black">{lb.active} riders</div>
                                            <div className="text-[9px] text-emerald-600 font-bold">{fmtS(lb.coll)} today</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </>)}

            {/* ══════ SECTION 8: WATCHLIST ══════ */}
            {section === 'watchlist' && (<>
                <SectionHeader label="Rider Watchlist" icon={AlertTriangle} color="from-rose-400 to-rose-600" />
                <div className="bg-card border border-rose-500/30 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-black flex items-center gap-2 text-rose-600"><AlertTriangle size={14} /> High Debt (&lt;-₹3K) <span className="bg-rose-500/20 rounded-full px-1.5 py-0.5 text-[9px]">{stats.highDebt.length}</span></h3>
                        <button onClick={() => setNegExpanded(v => !v)} className="text-[10px] flex items-center gap-1 text-muted-foreground">{negExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}{negExpanded ? 'Less' : 'All'}</button>
                    </div>
                    {stats.highDebt.length === 0 ? <div className="text-center py-6 text-muted-foreground text-xs">✓ No high-debt riders</div> : (
                        <div className="space-y-1.5 max-h-72 overflow-y-auto">
                            {stats.highDebt.slice(0, negExpanded ? undefined : 10).map(r => (
                                <div key={r.id} className="flex items-center justify-between p-2 bg-rose-500/5 border border-rose-500/15 rounded-xl">
                                    <div className="min-w-0">
                                        <div className="text-xs font-bold truncate">{r.rider_name || r.id.slice(0, 12)}</div>
                                        <div className="text-[9px] text-muted-foreground">{tlMap[r.team_leader_id]?.full_name || '—'} · {r.client_name} · {r.mobile_number}</div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className="text-xs font-black text-rose-600">-{fmtS(Math.abs(r.wallet_amount))}</span>
                                        <ActionBtns mobile={r.mobile_number} name={r.rider_name} tlId={r.team_leader_id} toast={toast} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="bg-card border border-amber-500/30 rounded-2xl p-4 shadow-sm">
                    <h3 className="text-xs font-black flex items-center gap-2 text-amber-600 mb-3"><Clock size={14} /> Low Balance (₹0–₹250) <span className="bg-amber-500/20 rounded-full px-1.5 py-0.5 text-[9px]">{stats.lowBal.length}</span></h3>
                    {stats.lowBal.length === 0 ? <div className="text-center py-6 text-muted-foreground text-xs">✓ No low-balance riders</div> : (
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                            {stats.lowBal.slice(0, 15).map(r => (
                                <div key={r.id} className="flex items-center justify-between p-2 bg-amber-500/5 border border-amber-500/15 rounded-lg">
                                    <div className="min-w-0">
                                        <div className="text-xs font-bold truncate">{r.rider_name || r.id.slice(0, 10)}</div>
                                        <div className="text-[9px] text-muted-foreground">{tlMap[r.team_leader_id]?.full_name || '—'}</div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className="text-xs font-black text-amber-600">{fmt(r.wallet_amount || 0)}</span>
                                        <ActionBtns mobile={r.mobile_number} name={r.rider_name} tlId={r.team_leader_id} toast={toast} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </>)}

            {/* ── Team Footer ── */}
            <div className="bg-card border border-border/60 rounded-2xl p-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-muted/30 rounded-xl p-2"><div className="text-lg font-black">{rmIds.length}</div><div className="text-[8px] text-muted-foreground uppercase">RMs</div></div>
                    <div className="bg-muted/30 rounded-xl p-2"><div className="text-lg font-black">{tlIds.length}</div><div className="text-[8px] text-muted-foreground uppercase">TLs</div></div>
                    <div className="bg-muted/30 rounded-xl p-2"><div className="text-lg font-black">{stats.active}</div><div className="text-[8px] text-muted-foreground uppercase">Active</div></div>
                </div>
            </div>
        </div>
    );
};

export default CityOpsDashboard;
