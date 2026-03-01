import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, Wallet, Users, BarChart3, TrendingUp } from 'lucide-react';
import { supabase } from '@/config/supabase';
import { format } from 'date-fns';

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
}

interface MetricTileProps {
    label: string;
    value: string;
    icon: React.ElementType;
    color: string;
    subtitle: string;
    trend?: string;
}

const CollectionHistoryModal: React.FC<CollectionHistoryModalProps> = ({
    isOpen, onClose, teamLeaderId, teamLeaderName
}) => {
    const [history, setHistory] = useState<CollectionRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalCollection: 0,
        todayCollection: 0,
        avgActiveRiders: 0,
        avgPerRider: 0,
        bestDay: 0
    });

    useEffect(() => {
        if (isOpen && teamLeaderId) {
            fetchHistory();
        }
    }, [isOpen, teamLeaderId]);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('daily_collections')
                .select('date, total_collection, active_riders_count')
                .eq('team_leader_id', teamLeaderId)
                .order('date', { ascending: false });

            if (error) throw error;

            const records = (data || []).map(d => ({
                date: d.date,
                total_collection: Number(d.total_collection) || 0,
                active_riders_count: Number(d.active_riders_count) || 1
            }));

            setHistory(records);

            // Calculate deep stats
            const totalColl = records.reduce((sum, r) => sum + r.total_collection, 0);
            const sumRunrate = records.reduce((sum, r) => sum + (r.total_collection / r.active_riders_count), 0);
            const sumRiders = records.reduce((sum, r) => sum + r.active_riders_count, 0);

            const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
            const todayRecord = records.find(r => r.date === todayStr);

            setStats({
                totalCollection: totalColl,
                todayCollection: todayRecord ? todayRecord.total_collection : 0,
                avgActiveRiders: records.length > 0 ? Math.round(sumRiders / records.length) : 0,
                avgPerRider: records.length > 0 ? Math.round(sumRunrate / records.length) : 0,
                bestDay: records.length > 0 ? Math.max(...records.map(r => r.total_collection)) : 0
            });
        } catch (err) {
            console.error('Error fetching collection history:', err);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[999999] flex flex-col items-center justify-center bg-black/90 backdrop-blur-3xl animate-in fade-in duration-700 overflow-y-auto scrollbar-none py-4 px-4">
            <div className="bg-background/95 border w-full max-w-[95rem] rounded-[2rem] sm:rounded-[3rem] shadow-[0_0_150px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[95vh] animate-in zoom-in-95 duration-500 border-white/20 relative backdrop-saturate-[2.5]">
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 blur-[120px] -z-10 rounded-full" />
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 blur-[120px] -z-10 rounded-full" />

                {/* Header: Squeezed height */}
                <div className="px-6 sm:px-10 py-4 sm:py-5 border-b flex justify-between items-center bg-muted/20 backdrop-blur-md sticky top-0 z-20 flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-[1rem] bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-xl shadow-indigo-500/20 flex-shrink-0">
                            <BarChart3 size={20} className="sm:hidden" />
                            <BarChart3 size={24} className="hidden sm:block" />
                        </div>
                        <div>
                            <h3 className="font-black text-xl sm:text-2xl tracking-tight text-foreground leading-tight">Collection Intelligence</h3>
                            <div className="flex items-center gap-2 mt-1 sm:mt-2">
                                <span className="bg-indigo-500/10 text-indigo-500 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest border border-indigo-500/20">Supervisor</span>
                                <p className="text-xs sm:text-base text-muted-foreground font-bold">{teamLeaderName}</p>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 sm:p-4 bg-muted hover:bg-rose-500/10 hover:text-rose-500 rounded-2xl transition-all active:scale-95 border border-transparent hover:border-rose-500/20 group ml-4"
                    >
                        <X size={20} className="sm:hidden text-muted-foreground group-hover:text-rose-500 transition-colors" />
                        <X size={28} className="hidden sm:block text-muted-foreground group-hover:text-rose-500 transition-colors" />
                    </button>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                    {/* Summary Metrics Grid: High Contrast V2 Compact (5 Columns) */}
                    {!loading && history.length > 0 && (
                        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4 p-4 sm:p-6 bg-muted/5 flex-shrink-0">
                            <MetricTile
                                label="Aggregate Sourcing"
                                value={`₹${stats.totalCollection.toLocaleString()}`}
                                icon={Wallet}
                                color="indigo"
                                subtitle="Total historical volume"
                                trend="Global"
                            />
                            <MetricTile
                                label="Today Collection"
                                value={`₹${stats.todayCollection.toLocaleString()}`}
                                icon={TrendingUp}
                                color="emerald"
                                subtitle="Live daily recovery"
                                trend="Real-time"
                            />
                            <MetricTile
                                label="Fleet Force"
                                value={stats.avgActiveRiders.toString()}
                                icon={Users}
                                color="purple"
                                subtitle="Mean active riders"
                                trend="Avg."
                            />
                            <MetricTile
                                label="Efficiency rate"
                                value={`₹${stats.avgPerRider.toLocaleString()}`}
                                icon={TrendingUp}
                                color="amber"
                                subtitle="Sourcing per head"
                                trend="KPI"
                            />
                            <MetricTile
                                label="Historical Peak"
                                value={`₹${stats.bestDay.toLocaleString()}`}
                                icon={BarChart3}
                                color="indigo"
                                subtitle="Highest day recorded"
                                trend="Peak"
                            />
                        </div>
                    )}

                    {/* Enhanced Data Table V2: Compact Cinematic View */}
                    <div className="flex-grow overflow-auto p-6 sm:p-8 pt-0 scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
                        {loading ? (
                            <div className="h-[500px] flex flex-col items-center justify-center">
                                <div className="relative w-32 h-32">
                                    <div className="absolute inset-0 border-[10px] border-indigo-500/5 rounded-full" />
                                    <div className="absolute inset-0 border-[10px] border-t-indigo-500 rounded-full animate-spin shadow-[0_0_30px_rgba(99,102,241,0.4)]" />
                                </div>
                                <p className="mt-10 text-xs font-black text-muted-foreground uppercase tracking-[0.4em] animate-pulse">Synchronizing Intelligence Stream...</p>
                            </div>
                        ) : history.length === 0 ? (
                            <div className="h-[500px] flex flex-col items-center justify-center opacity-30">
                                <Calendar size={120} className="mb-8 text-muted-foreground/50" />
                                <p className="text-3xl font-black uppercase tracking-[0.5em] text-center">Historical Vacuum <br /><span className="text-sm tracking-[0.2em] font-bold opacity-60">No digital footprints detected</span></p>
                            </div>
                        ) : (
                            <div className="bg-card/40 border border-white/5 rounded-[3rem] overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.3)] backdrop-blur-2xl">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-white/[0.03] border-b border-white/5 sticky top-0 z-10 backdrop-blur-3xl">
                                            <th className="px-6 py-4 sm:px-8 sm:py-5 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-muted-foreground/50">Temporal Marker</th>
                                            <th className="px-6 py-4 sm:px-8 sm:py-5 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-muted-foreground/50">Gross Recovery</th>
                                            <th className="px-6 py-4 sm:px-8 sm:py-5 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-muted-foreground/50 text-center">Active Force</th>
                                            <th className="px-6 py-4 sm:px-8 sm:py-5 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-muted-foreground/50 text-right">Unit Efficiency</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/[0.03]">
                                        {history.map((record, idx) => (
                                            <tr key={idx} className="hover:bg-indigo-500/[0.07] transition-all group cursor-default relative overflow-hidden">
                                                <td className="px-6 py-3 sm:px-8 sm:py-4 relative">
                                                    {/* Left margin indicator */}
                                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 transition-opacity opacity-0 group-hover:opacity-100" />
                                                    <div className="flex items-center gap-4 sm:gap-6">
                                                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-muted/50 flex items-center justify-center text-muted-foreground group-hover:bg-indigo-500 group-hover:text-white group-hover:shadow-[0_0_20px_rgba(99,102,241,0.5)] transition-all duration-500 border border-white/5">
                                                            <Calendar size={18} className="group-hover:scale-110 transition-transform sm:hidden" />
                                                            <Calendar size={20} className="hidden sm:block group-hover:scale-110 transition-transform" />
                                                        </div>
                                                        <div>
                                                            <p className="font-black text-lg sm:text-xl tracking-tighter text-foreground/90 group-hover:text-indigo-400 transition-colors uppercase">
                                                                {format(new Date(record.date), 'dd MMM yyyy')}
                                                            </p>
                                                            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.15em] mt-1 opacity-50 group-hover:opacity-100 transition-opacity">
                                                                {format(new Date(record.date), 'EEEE')} Cycle
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-3 sm:px-8 sm:py-4">
                                                    <div className="flex flex-col">
                                                        <span className="font-black text-emerald-500 text-xl sm:text-2xl tracking-tighter group-hover:scale-105 transition-transform origin-left">
                                                            ₹{record.total_collection.toLocaleString()}
                                                        </span>
                                                        <span className="text-[9px] sm:text-[10px] text-muted-foreground font-black uppercase tracking-widest mt-1 opacity-50">Sourced Total</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-3 sm:px-8 sm:py-4 text-center">
                                                    <div className="inline-flex items-center gap-2 sm:gap-3 px-4 py-1.5 sm:px-5 sm:py-2 rounded-[1rem] sm:rounded-2xl bg-muted/30 border border-white/5 group-hover:border-indigo-500/30 group-hover:bg-indigo-500/10 transition-all duration-300">
                                                        <Users size={12} className="text-muted-foreground group-hover:text-indigo-400" />
                                                        <span className="text-xs sm:text-sm font-black text-foreground/80 tracking-tight">
                                                            {record.active_riders_count} Units
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-3 sm:px-8 sm:py-4 text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className="font-black text-amber-500 text-lg sm:text-xl leading-none group-hover:text-indigo-400 transition-colors">
                                                            ₹{Math.round(record.total_collection / record.active_riders_count).toLocaleString()}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground font-black uppercase tracking-tighter mt-2 opacity-50">Avg / Rider Efficiency</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Insight: Squeezed Information Rich */}
                <div className="px-8 sm:px-12 py-4 sm:py-5 bg-muted/20 border-t border-white/5 flex justify-between items-center sm:rounded-b-[2.5rem] flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <div className="absolute inset-0 bg-emerald-500 blur-md opacity-20 animate-pulse" />
                            <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.6)] relative z-10" />
                        </div>
                        <div>
                            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-foreground/80 block leading-none">Intelligence Online</span>
                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1 block opacity-60">
                                {history.length} Critical Data Points Synchronized
                            </span>
                        </div>
                    </div>
                    <div className="hidden sm:flex items-center gap-8">
                        <InsightBadge label="Recovery" color="indigo" />
                        <InsightBadge label="Deployment" color="purple" />
                        <InsightBadge label="Efficiency" color="emerald" />
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

interface MetricTileProps {
    label: string;
    value: string;
    icon: React.ElementType;
    color: string;
    subtitle: string;
    trend?: string;
}

const MetricTile: React.FC<MetricTileProps> = ({ label, value, icon: Icon, color, subtitle, trend }) => {
    return (
        <div className="bg-card/40 border border-white/5 rounded-[1.5rem] p-4 sm:p-5 shadow-xl hover:shadow-indigo-500/10 transition-all duration-500 relative overflow-hidden group hover:-translate-y-1 backdrop-blur-md">
            <div className={`absolute top-0 right-0 p-3 opacity-[0.03] scale-150 transform translate-x-1 translate-y-1 group-hover:scale-[1.8] group-hover:opacity-[0.07] transition-all duration-700 font-black`}>
                <Icon size={48} />
            </div>

            <div className="relative z-10">
                <div className="flex justify-between items-start mb-3">
                    <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] text-muted-foreground/60 leading-tight pr-1 sm:pr-2">{label}</p>
                    {trend && (
                        <span className={`text-[8px] font-black px-2 py-0.5 rounded-md self-start flex-shrink-0 ${color === 'indigo' ? 'bg-indigo-500/10 text-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.2)]' :
                            'bg-emerald-500/10 text-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                            }`}>
                            {trend}
                        </span>
                    )}
                </div>
                <p className="text-2xl sm:text-3xl font-black tracking-tighter mb-1.5">{value}</p>
                <p className="text-[9px] sm:text-[10px] font-bold text-muted-foreground/60 leading-tight pr-2 sm:pr-4">{subtitle}</p>
                <div className={`w-8 sm:w-10 h-1 sm:h-1.5 rounded-full mt-3 bg-gradient-to-r ${color === 'indigo' ? 'from-indigo-600 to-violet-600' :
                    color === 'purple' ? 'from-purple-600 to-fuchsia-600' :
                        color === 'emerald' ? 'from-emerald-600 to-teal-600' :
                            'from-amber-500 to-orange-500'
                    }`} />
            </div>
        </div>
    );
};

const InsightBadge: React.FC<{ label: string, color: string }> = ({ label, color }) => (
    <div className="flex items-center gap-2.5">
        <div className={`w-1.5 h-1.5 rounded-full bg-${color}-500 shadow-[0_0_8px_rgba(var(--${color}-500),0.4)]`} />
        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-foreground/40">{label}</span>
    </div>
);

export default CollectionHistoryModal;
