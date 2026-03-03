import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, TrendingUp, Users, Zap, Award, Calendar, RefreshCw } from 'lucide-react';
import { supabase } from '@/config/supabase';
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

const CollectionHistoryModal: React.FC<CollectionHistoryModalProps> = ({
    isOpen, onClose, teamLeaderId, teamLeaderName
}) => {
    const [history, setHistory] = useState<CollectionRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    // ── Correct IST midnight UTC ────────────────────────────────────────────
    const getISTMidnightUTC = () => {
        const now = new Date();
        const istDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
        const [y, m, d] = istDateStr.split('-').map(Number);
        return new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - 5.5 * 60 * 60 * 1000).toISOString();
    };

    const getTodayIST = () =>
        new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

    const fetchHistory = useCallback(async () => {
        if (!teamLeaderId) return;
        try {
            const todayStr = getTodayIST();
            const istMidnightUTC = getISTMidnightUTC();

            const [{ data }, { data: todayLedger }, { count: liveCount }] = await Promise.all([
                supabase
                    .from('daily_collections')
                    .select('date, total_collection, active_riders_count, runrate')
                    .eq('team_leader_id', teamLeaderId)
                    .order('date', { ascending: false })
                    .limit(30),
                supabase
                    .from('wallet_ledger')
                    .select('amount, rider:riders!inner(team_leader_id)')
                    .eq('mode', 'ADD')
                    .in('transaction_type', [
                        'DAILY_COLLECTION', 'DAILY COLLECTION',
                        'RENT_COLLECTION', 'RENT COLLECTION',
                        'FTD_COLLECTION', 'FTD COLLECTION',
                        'COLLECTION', 'RENT'
                    ])
                    .eq('rider.team_leader_id', teamLeaderId)
                    .gte('created_at', istMidnightUTC),
                supabase
                    .from('riders')
                    .select('*', { count: 'exact', head: true })
                    .eq('team_leader_id', teamLeaderId)
                    .eq('status', 'active'),
            ]);

            const realToday = (todayLedger || []).reduce((s, t) => s + (Number(t.amount) || 0), 0);

            let records: CollectionRecord[] = (data || []).map(d => ({
                date: d.date,
                total_collection: Number(d.total_collection) || 0,
                active_riders_count: Number(d.active_riders_count) || 1,
                runrate: Number(d.runrate) || 0,
            }));

            const todayIdx = records.findIndex(r => r.date === todayStr);
            const todayRec: CollectionRecord = {
                date: todayStr,
                total_collection: realToday,
                active_riders_count: liveCount ?? (todayIdx >= 0 ? records[todayIdx].active_riders_count : 1),
                runrate: 0,
            };
            todayRec.runrate = todayRec.active_riders_count > 0
                ? Math.round(todayRec.total_collection / todayRec.active_riders_count) : 0;

            if (todayIdx >= 0) records[todayIdx] = todayRec;
            else records = [todayRec, ...records];

            setHistory(records);
            setLastUpdated(new Date());
        } catch (err) {
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
            .on('postgres_changes', {
                event: '*', schema: 'public', table: 'wallet_ledger'
            }, fetchHistory)
            .on('postgres_changes', {
                event: '*', schema: 'public', table: 'daily_collections',
                filter: `team_leader_id=eq.${teamLeaderId}`
            }, fetchHistory)
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [isOpen, teamLeaderId, fetchHistory]);

    if (!isOpen) return null;

    // ── Derived stats ─────────────────────────────────────────────────────
    const todayStr = getTodayIST();
    const todayRec = history.find(r => r.date === todayStr);
    const pastRecords = history.filter(r => r.date !== todayStr && r.total_collection > 0);

    const totalAll = history.reduce((s, r) => s + r.total_collection, 0);
    const avgPerDay = pastRecords.length > 0
        ? Math.round(pastRecords.reduce((s, r) => s + r.total_collection, 0) / pastRecords.length) : 0;
    const bestDay = history.reduce((m, r) => Math.max(m, r.total_collection), 0);
    const avgPerRider = history.length > 0 && history[0]?.active_riders_count > 0
        ? Math.round(totalAll / (history.reduce((s, r) => s + r.active_riders_count, 0) / history.length)) : 0;

    const statCards = [
        { label: 'Today', value: `₹${(todayRec?.total_collection || 0).toLocaleString()}`, sub: `${todayRec?.active_riders_count || 0} riders`, color: 'emerald', icon: Zap },
        { label: 'Total', value: `₹${totalAll.toLocaleString()}`, sub: `${history.length} days`, color: 'indigo', icon: TrendingUp },
        { label: 'Day Avg', value: `₹${avgPerDay.toLocaleString()}`, sub: 'Historical', color: 'blue', icon: Calendar },
        { label: 'Rider Avg', value: `₹${avgPerRider.toLocaleString()}`, sub: 'Per head', color: 'violet', icon: Users },
        { label: 'Peak Day', value: `₹${bestDay.toLocaleString()}`, sub: 'All-time high', color: 'amber', icon: Award },
    ];

    const colorMap: Record<string, string> = {
        emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600',
        indigo: 'bg-indigo-500/10  border-indigo-500/20  text-indigo-600',
        blue: 'bg-blue-500/10    border-blue-500/20    text-blue-600',
        violet: 'bg-violet-500/10  border-violet-500/20  text-violet-600',
        amber: 'bg-amber-500/10   border-amber-500/20   text-amber-600',
    };
    const iconColorMap: Record<string, string> = {
        emerald: 'text-emerald-500', indigo: 'text-indigo-500',
        blue: 'text-blue-500', violet: 'text-violet-500', amber: 'text-amber-500'
    };

    const maxAmt = Math.max(...history.map(r => r.total_collection), 1);

    return createPortal(
        <div
            className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />

            {/* Modal */}
            <div className="relative z-10 w-full max-w-4xl max-h-[88vh] flex flex-col bg-background border border-border/60 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden animate-in zoom-in-95 fade-in duration-200">

                {/* Ambient glows */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-violet-500/5 blur-3xl pointer-events-none" />

                {/* ── Header ─────────────────────────────────────────────── */}
                <div className="relative flex items-center justify-between px-5 py-3.5 border-b border-border/50 bg-muted/30 backdrop-blur-sm flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 flex-shrink-0">
                            <TrendingUp size={15} className="text-white" />
                        </div>
                        <div>
                            <h3 className="font-black text-sm leading-tight text-foreground">Collection Intelligence</h3>
                            <p className="text-[10px] text-muted-foreground font-medium">{teamLeaderName}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {lastUpdated && (
                            <div className="flex items-center gap-1 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wide">Live</span>
                            </div>
                        )}
                        <button onClick={fetchHistory} className="p-1.5 hover:bg-muted rounded-lg transition-colors group" title="Refresh">
                            <RefreshCw size={13} className="text-muted-foreground group-hover:text-foreground group-hover:rotate-180 transition-all duration-500" />
                        </button>
                        <button onClick={onClose} className="p-1.5 hover:bg-rose-500/10 hover:text-rose-500 rounded-lg transition-colors group">
                            <X size={15} className="text-muted-foreground group-hover:text-rose-500 transition-colors" />
                        </button>
                    </div>
                </div>

                {/* ── Stat Cards ─────────────────────────────────────────── */}
                {!loading && (
                    <div className="grid grid-cols-5 gap-2 p-3 flex-shrink-0 border-b border-border/30">
                        {statCards.map((s) => {
                            const Icon = s.icon;
                            return (
                                <div
                                    key={s.label}
                                    className={`group relative p-3 rounded-xl border cursor-default transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${colorMap[s.color]}`}
                                >
                                    <div className="flex items-start justify-between mb-1.5">
                                        <p className="text-[9px] font-black uppercase tracking-wider opacity-70">{s.label}</p>
                                        <Icon size={12} className={`${iconColorMap[s.color]} opacity-60 group-hover:opacity-100 transition-opacity`} />
                                    </div>
                                    <p className="text-base font-black leading-none">{s.value}</p>
                                    <p className="text-[9px] mt-1 opacity-60 font-medium">{s.sub}</p>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* ── Table ──────────────────────────────────────────────── */}
                <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-border/50">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-48 gap-3">
                            <div className="w-8 h-8 border-2 border-t-indigo-500 border-indigo-500/20 rounded-full animate-spin" />
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest animate-pulse">Syncing…</p>
                        </div>
                    ) : history.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 gap-2 opacity-30">
                            <Calendar size={36} className="text-muted-foreground" />
                            <p className="text-xs font-black uppercase tracking-widest">No data found</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm text-left">
                            <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-md border-b border-border/40">
                                <tr>
                                    <th className="px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground">Date</th>
                                    <th className="px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground">Collection</th>
                                    <th className="px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground text-center">Riders</th>
                                    <th className="px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground text-right">Avg/Rider</th>
                                    <th className="px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground w-28">Pace</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((rec, idx) => {
                                    const isToday = rec.date === todayStr;
                                    const avgRider = rec.active_riders_count > 0
                                        ? Math.round(rec.total_collection / rec.active_riders_count) : 0;
                                    const pct = maxAmt > 0 ? (rec.total_collection / maxAmt) * 100 : 0;
                                    const isBest = rec.total_collection === bestDay && bestDay > 0;

                                    return (
                                        <tr
                                            key={idx}
                                            className={`group border-b border-border/20 last:border-0 transition-all duration-150 cursor-default
                                                ${isToday
                                                    ? 'bg-emerald-500/5 hover:bg-emerald-500/10'
                                                    : 'hover:bg-muted/40'}`}
                                        >
                                            {/* Date */}
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2.5">
                                                    <div className={`w-1 h-8 rounded-full transition-all ${isToday ? 'bg-emerald-500' : isBest ? 'bg-amber-500' : 'bg-border/40 group-hover:bg-indigo-500/40'}`} />
                                                    <div>
                                                        <p className={`text-xs font-black ${isToday ? 'text-emerald-600' : 'text-foreground'}`}>
                                                            {isToday ? 'Today' : format(parseISO(rec.date), 'dd MMM')}
                                                        </p>
                                                        <p className="text-[9px] text-muted-foreground font-medium">
                                                            {format(parseISO(rec.date), isToday ? 'dd MMM yyyy' : 'EEE')}
                                                        </p>
                                                    </div>
                                                    {isBest && <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded text-[8px] font-black">PEAK</span>}
                                                    {isToday && <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 rounded text-[8px] font-black animate-pulse">LIVE</span>}
                                                </div>
                                            </td>

                                            {/* Collection */}
                                            <td className="px-4 py-3">
                                                <p className={`text-sm font-black ${isToday ? 'text-emerald-600' : 'text-foreground group-hover:text-indigo-600 transition-colors'}`}>
                                                    ₹{rec.total_collection.toLocaleString()}
                                                </p>
                                                <p className="text-[9px] text-muted-foreground font-medium">gross</p>
                                            </td>

                                            {/* Riders */}
                                            <td className="px-4 py-3 text-center">
                                                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/60 border border-border/30 group-hover:border-indigo-500/30 group-hover:bg-indigo-500/5 transition-all">
                                                    <Users size={10} className="text-muted-foreground" />
                                                    <span className="text-xs font-black">{rec.active_riders_count}</span>
                                                </div>
                                            </td>

                                            {/* Avg/Rider */}
                                            <td className="px-4 py-3 text-right">
                                                <p className="text-xs font-black text-indigo-600">₹{avgRider.toLocaleString()}</p>
                                                <p className="text-[9px] text-muted-foreground">per head</p>
                                            </td>

                                            {/* Pace bar */}
                                            <td className="px-4 py-3 w-28">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-1.5 bg-muted/50 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-700 ${isToday ? 'bg-emerald-500' : isBest ? 'bg-amber-500' : 'bg-indigo-500/70'}`}
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-[9px] font-black text-muted-foreground w-7 text-right">{Math.round(pct)}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* ── Footer ─────────────────────────────────────────────── */}
                <div className="px-5 py-2.5 bg-muted/20 border-t border-border/30 flex items-center justify-between flex-shrink-0">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                        {history.length} records · Auto-synced
                    </p>
                    {lastUpdated && (
                        <p className="text-[9px] text-muted-foreground">
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
