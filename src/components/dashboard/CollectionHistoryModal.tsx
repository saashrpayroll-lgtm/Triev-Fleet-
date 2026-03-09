import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
    X, TrendingUp, Users, Zap, Award, Calendar,
    RefreshCw, BarChart2, Flame, Target, ArrowUp, ArrowDown, Minus
} from 'lucide-react';
import { supabase } from '@/config/supabase';
import { getValidHistoricalDate } from '@/utils/dateUtils';
import { format, parseISO } from 'date-fns';

interface CollectionHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    teamLeaderId: string;
    teamLeaderName: string;
}

interface CollectionRecord {
    date: string;
    total_collection: number;
    active_riders_count: number;
    runrate?: number;
}

// ── IST Helpers ────────────────────────────────────────────────────────────
const getISTMidnightUTC = () => {
    const now = new Date();
    const istDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
    const [y, m, d] = istDateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - 5.5 * 60 * 60 * 1000).toISOString();
};

const getTodayIST = () =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

// ── Mini Sparkline ─────────────────────────────────────────────────────────
const Sparkline: React.FC<{ data: number[]; color: string }> = ({ data, color }) => {
    if (data.length < 2) return null;
    const max = Math.max(...data, 1);
    const w = 80, h = 28;
    const step = w / (data.length - 1);
    const pts = data.map((v, i) => `${i * step},${h - (v / max) * h}`).join(' ');
    return (
        <svg width={w} height={h} className="opacity-80">
            <polyline
                points={pts}
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* End dot */}
            <circle
                cx={(data.length - 1) * step}
                cy={h - (data[data.length - 1] / max) * h}
                r="2.5"
                fill={color}
            />
        </svg>
    );
};

const CollectionHistoryModal: React.FC<CollectionHistoryModalProps> = ({
    isOpen, onClose, teamLeaderId, teamLeaderName
}) => {
    const [history, setHistory] = useState<CollectionRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const fetchHistory = useCallback(async () => {
        if (!teamLeaderId) return;
        try {
            const todayStr = getTodayIST();
            const istMidnightUTC = getISTMidnightUTC();

            const [{ data }, { data: todayLedger }, { data: allRiders }] = await Promise.all([
                supabase
                    .from('daily_collections')
                    .select('date, total_collection, active_riders_count, runrate')
                    .eq('team_leader_id', teamLeaderId)
                    .lte('date', todayStr)            // ← never show future dates
                    .order('date', { ascending: false })
                    .limit(60),
                supabase
                    .from('wallet_ledger')
                    .select('amount, transaction_date, created_at, rider:riders!inner(team_leader_id)')
                    .eq('mode', 'ADD')
                    .in('transaction_type', [
                        'DAILY_COLLECTION', 'DAILY COLLECTION',
                        'RENT_COLLECTION', 'RENT COLLECTION',
                        'FTD_COLLECTION', 'FTD COLLECTION',
                        'COLLECTION', 'RENT'
                    ])
                    .eq('rider.team_leader_id', teamLeaderId)
                    .gte('transaction_date', istMidnightUTC),
                supabase
                    .from('riders')
                    .select('status, allotment_date, inactivated_at, updated_at, created_at')
                    .eq('team_leader_id', teamLeaderId)
            ]);

            const realToday = (todayLedger || []).reduce((s, t) => s + (Number(t.amount) || 0), 0);

            // Helper to compute historical active count safely handling imported dates
            const getHistoricalActiveCount = (ds: string) => {
                return (allRiders || []).filter(r => {
                    const adIst = getValidHistoricalDate(r.allotment_date, r.created_at);
                    if (!adIst) return false;
                    if (adIst > ds) return false;

                    if (r.status === 'active') return true;
                    const iat: string | null = r.inactivated_at;
                    const uat: string | null = r.updated_at;
                    const inactDate = iat ? getValidHistoricalDate(iat) : (uat ? getValidHistoricalDate(uat) : null);
                    return inactDate ? inactDate >= ds : false;
                }).length;
            };

            let records: CollectionRecord[] = (data || [])
                .filter(d => d.date <= todayStr)   // double-guard: strip future
                .map(d => ({
                    date: d.date,
                    total_collection: Number(d.total_collection) || 0,
                    active_riders_count: getHistoricalActiveCount(d.date),
                    runrate: Number(d.runrate) || 0,
                }));

            // ── Inject / replace today's live amount ─────────────────────
            const todayIdx = records.findIndex(r => r.date === todayStr);
            const liveCount = getHistoricalActiveCount(todayStr);
            const todayRec: CollectionRecord = {
                date: todayStr,
                total_collection: realToday,
                active_riders_count: liveCount,
                runrate: 0,
            };
            todayRec.runrate = todayRec.active_riders_count > 0
                ? Math.round(todayRec.total_collection / todayRec.active_riders_count) : 0;

            if (todayIdx >= 0) records[todayIdx] = todayRec;
            else records = [todayRec, ...records];

            setHistory(records);
            setLastUpdated(new Date());
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    }, [teamLeaderId]);

    // Initial fetch + real-time subscription
    useEffect(() => {
        if (!isOpen || !teamLeaderId) return;
        setLoading(true);
        fetchHistory();

        const channel = supabase
            .channel(`col-intel-${teamLeaderId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'wallet_ledger' }, fetchHistory)
            .on('postgres_changes', {
                event: '*', schema: 'public', table: 'daily_collections',
                filter: `team_leader_id=eq.${teamLeaderId}`
            }, fetchHistory)
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [isOpen, teamLeaderId, fetchHistory]);

    if (!isOpen) return null;

    // ── Derived Stats ──────────────────────────────────────────────────────
    const todayStr = getTodayIST();
    const todayRec = history.find(r => r.date === todayStr);
    const pastRecs = history.filter(r => r.date !== todayStr && r.total_collection > 0);

    const totalAll = history.reduce((s, r) => s + r.total_collection, 0);
    const avgPerDay = pastRecs.length > 0
        ? Math.round(pastRecs.reduce((s, r) => s + r.total_collection, 0) / pastRecs.length) : 0;
    const bestDay = history.reduce((m, r) => Math.max(m, r.total_collection), 0);

    // Week-over-week comparison
    const last7 = pastRecs.slice(0, 7).reduce((s, r) => s + r.total_collection, 0);
    const prev7 = pastRecs.slice(7, 14).reduce((s, r) => s + r.total_collection, 0);
    const wowPct = prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 100) : null;

    // Streak — consecutive days with collection > 0
    let streak = 0;
    for (const r of pastRecs) {
        if (r.total_collection > 0) streak++; else break;
    }

    // Sparkline data — last 10 past days (ascending order)
    const sparkData = [...pastRecs].slice(0, 10).reverse().map(r => r.total_collection);
    const maxAmt = Math.max(...history.map(r => r.total_collection), 1);

    // Avg per rider (weighted average across all days)
    const totalRiderDays = history.reduce((s, r) => s + r.active_riders_count, 0);
    const avgPerRider = totalRiderDays > 0 ? Math.round(totalAll / totalRiderDays) : 0;

    // Today vs. avg
    const todayVsAvg = avgPerDay > 0
        ? Math.round(((todayRec?.total_collection ?? 0) - avgPerDay) / avgPerDay * 100) : 0;

    return createPortal(
        <div
            className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose} />

            {/* Modal */}
            <div className="relative z-10 w-full max-w-4xl max-h-[92vh] flex flex-col
                bg-[#0a0f1e] border border-white/10 rounded-t-3xl sm:rounded-2xl
                shadow-[0_-20px_80px_-10px_rgba(99,102,241,0.3)]
                overflow-hidden
                animate-in slide-in-from-bottom-6 sm:zoom-in-95 sm:fade-in duration-300">

                {/* Top glow stripe */}
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent" />
                {/* Ambient bg glows */}
                <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/8 blur-[80px] pointer-events-none rounded-full" />
                <div className="absolute bottom-0 left-0 w-72 h-72 bg-violet-600/8 blur-[80px] pointer-events-none rounded-full" />

                {/* ── Header ──────────────────────────────────────────── */}
                <div className="relative flex items-center justify-between px-5 py-4 border-b border-white/8 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600
                            flex items-center justify-center shadow-lg shadow-indigo-500/40 flex-shrink-0">
                            <BarChart2 size={17} className="text-white" />
                        </div>
                        <div>
                            <h3 className="font-black text-sm text-white leading-tight tracking-tight">Collection Intelligence</h3>
                            <p className="text-[10px] text-white/40 font-medium">{teamLeaderName}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Streak badge */}
                        {streak >= 3 && (
                            <div className="flex items-center gap-1 px-2.5 py-1 bg-orange-500/15 border border-orange-500/30 rounded-lg">
                                <Flame size={10} className="text-orange-400" />
                                <span className="text-[9px] font-black text-orange-400 uppercase tracking-wide">{streak}d streak</span>
                            </div>
                        )}
                        {/* WoW badge */}
                        {wowPct !== null && (
                            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[9px] font-black uppercase tracking-wide
                                ${wowPct >= 0
                                    ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                                    : 'bg-rose-500/10 border-rose-500/25 text-rose-400'}`}>
                                {wowPct >= 0 ? <ArrowUp size={9} /> : <ArrowDown size={9} />}
                                {Math.abs(wowPct)}% vs last 7d
                            </div>
                        )}
                        {/* Live badge */}
                        {lastUpdated && (
                            <div className="flex items-center gap-1 px-2 py-1 bg-emerald-500/10 border border-emerald-500/25 rounded-lg">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="text-[9px] font-black text-emerald-400 uppercase">LIVE</span>
                            </div>
                        )}
                        <button onClick={fetchHistory}
                            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors group" title="Refresh">
                            <RefreshCw size={13} className="text-white/40 group-hover:text-white group-hover:rotate-180 transition-all duration-500" />
                        </button>
                        <button onClick={onClose}
                            className="p-1.5 hover:bg-rose-500/15 rounded-lg transition-colors group">
                            <X size={15} className="text-white/40 group-hover:text-rose-400 transition-colors" />
                        </button>
                    </div>
                </div>

                {/* ── Hero Stat Cards ───────────────────────────────────── */}
                {!loading && (
                    <div className="flex-shrink-0 px-5 pt-4 pb-3 border-b border-white/8">
                        {/* Top row — 4 cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                            {/* Today */}
                            <div className="relative p-3.5 rounded-xl bg-gradient-to-br from-emerald-500/15 to-emerald-600/5
                                border border-emerald-500/25 overflow-hidden">
                                <div className="absolute top-0 right-0 w-12 h-12 bg-emerald-500/10 blur-xl rounded-full" />
                                <div className="flex items-center justify-between mb-0.5">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-emerald-400/80">Today</p>
                                    <Zap size={11} className="text-emerald-400" />
                                </div>
                                <p className="text-xl font-black text-white leading-none">
                                    ₹{(todayRec?.total_collection || 0).toLocaleString()}
                                </p>
                                <div className="flex items-center gap-1 mt-1">
                                    {todayVsAvg !== 0 && (
                                        <span className={`flex items-center gap-0.5 text-[8px] font-black
                                            ${todayVsAvg > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {todayVsAvg > 0 ? <ArrowUp size={7} /> : <ArrowDown size={7} />}
                                            {Math.abs(todayVsAvg)}% vs avg
                                        </span>
                                    )}
                                    <span className="text-[8px] text-white/30">
                                        {todayRec?.active_riders_count || 0} riders
                                    </span>
                                </div>
                            </div>

                            {/* Total Collection */}
                            <div className="relative p-3.5 rounded-xl bg-gradient-to-br from-indigo-500/15 to-violet-600/5
                                border border-indigo-500/25 overflow-hidden">
                                <div className="absolute top-0 right-0 w-12 h-12 bg-indigo-500/10 blur-xl rounded-full" />
                                <div className="flex items-center justify-between mb-0.5">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400/80">Total</p>
                                    <TrendingUp size={11} className="text-indigo-400" />
                                </div>
                                <p className="text-xl font-black text-white leading-none">
                                    ₹{totalAll >= 100000
                                        ? `${(totalAll / 100000).toFixed(1)}L`
                                        : totalAll >= 1000
                                            ? `${(totalAll / 1000).toFixed(1)}k`
                                            : totalAll.toLocaleString()}
                                </p>
                                <p className="text-[8px] text-white/30 mt-1">{pastRecs.length} past days tracked</p>
                            </div>

                            {/* Day Avg */}
                            <div className="relative p-3.5 rounded-xl bg-gradient-to-br from-blue-500/15 to-blue-600/5
                                border border-blue-500/25 overflow-hidden">
                                <div className="absolute top-0 right-0 w-12 h-12 bg-blue-500/10 blur-xl rounded-full" />
                                <div className="flex items-center justify-between mb-0.5">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-blue-400/80">Day Avg</p>
                                    <Calendar size={11} className="text-blue-400" />
                                </div>
                                <p className="text-xl font-black text-white leading-none">
                                    ₹{avgPerDay.toLocaleString()}
                                </p>
                                {/* Mini sparkline */}
                                <div className="mt-1.5">
                                    <Sparkline data={sparkData} color="#60a5fa" />
                                </div>
                            </div>

                            {/* Peak Day */}
                            <div className="relative p-3.5 rounded-xl bg-gradient-to-br from-amber-500/15 to-orange-600/5
                                border border-amber-500/25 overflow-hidden">
                                <div className="absolute top-0 right-0 w-12 h-12 bg-amber-500/10 blur-xl rounded-full" />
                                <div className="flex items-center justify-between mb-0.5">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-amber-400/80">Peak Day</p>
                                    <Award size={11} className="text-amber-400" />
                                </div>
                                <p className="text-xl font-black text-white leading-none">
                                    ₹{bestDay.toLocaleString()}
                                </p>
                                <p className="text-[8px] text-white/30 mt-1">All-time high</p>
                            </div>
                        </div>

                        {/* Bottom row — 2 secondary stats */}
                        <div className="grid grid-cols-2 gap-3">
                            {/* Avg/Rider */}
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/4 border border-white/8">
                                <div className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                                    <Users size={13} className="text-violet-400" />
                                </div>
                                <div>
                                    <p className="text-[8px] font-black uppercase tracking-widest text-white/30">Avg Per Rider</p>
                                    <p className="text-sm font-black text-white">₹{avgPerRider.toLocaleString()}</p>
                                </div>
                            </div>
                            {/* Last 7d vs prev 7d */}
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/4 border border-white/8">
                                <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                                    <Target size={13} className="text-indigo-400" />
                                </div>
                                <div>
                                    <p className="text-[8px] font-black uppercase tracking-widest text-white/30">Last 7 Days</p>
                                    <p className="text-sm font-black text-white">₹{last7.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Table ──────────────────────────────────────────────── */}
                <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-56 gap-3">
                            <div className="w-8 h-8 border-2 border-t-indigo-500 border-indigo-500/20 rounded-full animate-spin" />
                            <p className="text-[10px] font-black text-white/30 uppercase tracking-widest animate-pulse">Syncing…</p>
                        </div>
                    ) : history.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 gap-2 opacity-30">
                            <Calendar size={36} className="text-white/30" />
                            <p className="text-xs font-black uppercase tracking-widest text-white/30">No data found</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm text-left">
                            <thead className="sticky top-0 z-10 bg-[#0a0f1e]/95 backdrop-blur-md border-b border-white/8">
                                <tr>
                                    <th className="px-5 py-3 text-[9px] font-black uppercase tracking-widest text-white/30">Date</th>
                                    <th className="px-5 py-3 text-[9px] font-black uppercase tracking-widest text-white/30">Collection</th>
                                    <th className="px-5 py-3 text-[9px] font-black uppercase tracking-widest text-white/30 text-center">Riders</th>
                                    <th className="px-5 py-3 text-[9px] font-black uppercase tracking-widest text-white/30 text-right">Avg/Rider</th>
                                    <th className="px-5 py-3 text-[9px] font-black uppercase tracking-widest text-white/30 w-32">Pace</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((rec, idx) => {
                                    const isToday = rec.date === todayStr;
                                    const isBest = rec.total_collection === bestDay && bestDay > 0;
                                    const avgRider = rec.active_riders_count > 0
                                        ? Math.round(rec.total_collection / rec.active_riders_count) : 0;
                                    const pct = maxAmt > 0 ? (rec.total_collection / maxAmt) * 100 : 0;
                                    const prevRec = history[idx + 1];
                                    const dayChange = prevRec && prevRec.total_collection > 0
                                        ? Math.round(((rec.total_collection - prevRec.total_collection) / prevRec.total_collection) * 100)
                                        : null;

                                    return (
                                        <tr
                                            key={idx}
                                            className={`group border-b border-white/5 last:border-0 transition-all duration-150 cursor-default
                                                ${isToday
                                                    ? 'bg-emerald-500/5 hover:bg-emerald-500/8'
                                                    : 'hover:bg-white/4'}`}
                                        >
                                            {/* Date */}
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-2.5">
                                                    <div className={`w-[3px] h-9 rounded-full flex-shrink-0 transition-all
                                                        ${isToday ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]'
                                                            : isBest ? 'bg-amber-400'
                                                                : 'bg-white/15 group-hover:bg-indigo-400/50'}`} />
                                                    <div>
                                                        <p className={`text-xs font-black ${isToday ? 'text-emerald-400' : 'text-white'}`}>
                                                            {isToday ? 'Today' : format(parseISO(rec.date), 'dd MMM')}
                                                        </p>
                                                        <p className="text-[9px] text-white/30 font-medium">
                                                            {format(parseISO(rec.date), isToday ? 'dd MMM yyyy' : 'EEE')}
                                                        </p>
                                                    </div>
                                                    {isBest && (
                                                        <span className="px-1.5 py-0.5 bg-amber-500/15 text-amber-400 border border-amber-500/25 rounded text-[7px] font-black">PEAK</span>
                                                    )}
                                                    {isToday && (
                                                        <span className="px-1.5 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 rounded text-[7px] font-black animate-pulse">LIVE</span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Collection */}
                                            <td className="px-5 py-3.5">
                                                <div>
                                                    <p className={`text-sm font-black ${isToday ? 'text-emerald-400' : 'text-white group-hover:text-indigo-300 transition-colors'}`}>
                                                        ₹{rec.total_collection.toLocaleString()}
                                                    </p>
                                                    {dayChange !== null && (
                                                        <span className={`flex items-center gap-0.5 text-[8px] font-black mt-0.5
                                                            ${dayChange > 0 ? 'text-emerald-400' : dayChange < 0 ? 'text-rose-400' : 'text-white/25'}`}>
                                                            {dayChange > 0 ? <ArrowUp size={7} /> : dayChange < 0 ? <ArrowDown size={7} /> : <Minus size={7} />}
                                                            {dayChange !== 0 ? `${Math.abs(dayChange)}%` : 'same'}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Riders */}
                                            <td className="px-5 py-3.5 text-center">
                                                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md
                                                    bg-white/5 border border-white/8 group-hover:border-indigo-500/30 group-hover:bg-indigo-500/5 transition-all">
                                                    <Users size={9} className="text-white/30" />
                                                    <span className="text-xs font-black text-white">{rec.active_riders_count}</span>
                                                </div>
                                            </td>

                                            {/* Avg/Rider */}
                                            <td className="px-5 py-3.5 text-right">
                                                <p className="text-xs font-black text-indigo-300">₹{avgRider.toLocaleString()}</p>
                                                <p className="text-[8px] text-white/25">per head</p>
                                            </td>

                                            {/* Pace bar */}
                                            <td className="px-5 py-3.5 w-32">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-1.5 bg-white/8 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-700
                                                                ${isToday ? 'bg-emerald-400' : isBest ? 'bg-amber-400' : 'bg-indigo-500/60 group-hover:bg-indigo-400'}`}
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-[9px] font-black text-white/30 w-7 text-right">{Math.round(pct)}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* ── Footer ───────────────────────────────────────────── */}
                <div className="px-5 py-3 bg-white/2 border-t border-white/8 flex items-center justify-between flex-shrink-0">
                    <p className="text-[9px] font-bold text-white/25 uppercase tracking-wider">
                        {history.length} records · Auto-synced · IST
                    </p>
                    {lastUpdated && (
                        <p className="text-[9px] text-white/25">
                            Updated {format(lastUpdated, 'HH:mm:ss')}
                        </p>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default CollectionHistoryModal;
