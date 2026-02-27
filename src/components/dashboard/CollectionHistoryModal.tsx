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

const CollectionHistoryModal: React.FC<CollectionHistoryModalProps> = ({
    isOpen, onClose, teamLeaderId, teamLeaderName
}) => {
    const [history, setHistory] = useState<CollectionRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalCollection: 0,
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

            setStats({
                totalCollection: totalColl,
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
        <div className="fixed inset-0 z-[99999] flex flex-col items-center overflow-y-auto bg-black/80 backdrop-blur-2xl animate-in fade-in duration-700 py-6 sm:py-20 px-4 scrollbar-none">
            <div className="my-auto bg-background/95 border w-full max-w-5xl rounded-[2.5rem] sm:rounded-[3.5rem] shadow-[0_0_100px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col min-h-[650px] h-fit max-h-[95vh] animate-in zoom-in-95 duration-500 border-white/20 relative backdrop-saturate-150">

                {/* Decorative background energy pulses */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/20 blur-[150px] -z-10 rounded-full animate-pulse" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-600/20 blur-[150px] -z-10 rounded-full animate-pulse" style={{ animationDelay: '2s' }} />

                {/* Header Section: Extreme Premium */}
                <div className="px-8 sm:px-12 py-8 sm:py-10 border-b border-white/10 flex justify-between items-center bg-gradient-to-b from-muted/40 to-muted/10 backdrop-blur-3xl sticky top-0 z-30">
                    <div className="flex items-center gap-6 sm:gap-8">
                        <div className="relative group">
                            <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-20 group-hover:opacity-40 transition-opacity" />
                            <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-[1.5rem] sm:rounded-[2rem] bg-gradient-to-tr from-indigo-500 via-purple-500 to-violet-600 flex items-center justify-center text-white shadow-2xl relative z-10">
                                <BarChart3 size={32} className="sm:hidden" />
                                <BarChart3 size={40} className="hidden sm:block" />
                            </div>
                        </div>
                        <div>
                            <h3 className="font-black text-2xl sm:text-4xl tracking-tighter text-foreground leading-[1.1]">
                                Recovery <span className="text-indigo-500">Intelligence</span>
                            </h3>
                            <div className="flex items-center gap-3 mt-2 sm:mt-3">
                                <span className="bg-indigo-500/10 text-indigo-500 px-3 py-1 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] border border-indigo-500/20 shadow-sm">
                                    Operational Audit
                                </span>
                                <div className="h-4 w-[1px] bg-border/50" />
                                <p className="text-sm sm:text-lg text-muted-foreground font-bold tracking-tight">{teamLeaderName}</p>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 sm:p-5 bg-muted/50 hover:bg-rose-500/10 hover:text-rose-500 rounded-3xl transition-all active:scale-90 border border-transparent hover:border-rose-500/20 group relative overflow-hidden"
                    >
                        <X size={24} className="sm:hidden text-muted-foreground group-hover:text-rose-500 transition-colors" />
                        <X size={32} className="hidden sm:block text-muted-foreground group-hover:text-rose-500 transition-colors" />
                    </button>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col">
                    {/* Summary Metrics Grid: High Contrast */}
                    {!loading && history.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 p-8 sm:p-12 bg-muted/5">
                            <MetricTile
                                label="Total Recovery"
                                value={`₹${stats.totalCollection.toLocaleString()}`}
                                icon={Wallet}
                                color="indigo"
                                subtitle="Aggregate Fleet Collection"
                                trend="+Active"
                            />
                            <MetricTile
                                label="Fleet Strength"
                                value={stats.avgActiveRiders.toString()}
                                icon={Users}
                                color="purple"
                                subtitle="Mean Daily Deployment"
                                trend="Avg."
                            />
                            <MetricTile
                                label="Daily Runrate"
                                value={`₹${stats.avgPerRider.toLocaleString()}`}
                                icon={TrendingUp}
                                color="emerald"
                                subtitle="Average Efficiency/Head"
                                trend="KPI"
                            />
                            <MetricTile
                                label="Performance Peak"
                                value={`₹${stats.bestDay.toLocaleString()}`}
                                icon={TrendingUp}
                                color="amber"
                                subtitle="Highest Recorded Day"
                                trend="Record"
                            />
                        </div>
                    )}

                    {/* Table Section */}
                    <div className="flex-grow overflow-auto p-8 pt-0">
                        {loading ? (
                            <div className="h-full flex flex-col items-center justify-center py-20">
                                <div className="relative w-20 h-20">
                                    <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-full" />
                                    <div className="absolute inset-0 border-4 border-t-indigo-500 rounded-full animate-spin" />
                                </div>
                                <p className="mt-6 text-sm font-black text-muted-foreground uppercase tracking-widest animate-pulse">Syncing Intelligence Network...</p>
                            </div>
                        ) : history.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center py-20 opacity-30">
                                <Calendar size={80} className="mb-4 text-muted-foreground" />
                                <p className="text-lg font-black uppercase tracking-widest">No Historical footprint found</p>
                            </div>
                        ) : (
                            <div className="bg-card/50 border rounded-[2rem] overflow-hidden shadow-inner">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-muted/50 border-b">
                                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Historical Date</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Total Sourcing</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-center">Active Fleet</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-right font-jakarta">Efficiency Avg/Rider</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/50">
                                        {history.map((record, idx) => (
                                            <tr key={idx} className="hover:bg-indigo-500/5 transition-colors group">
                                                <td className="px-6 py-5 font-bold text-sm">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center group-hover:bg-indigo-500/10 group-hover:text-indigo-500 transition-colors">
                                                            <Calendar size={14} />
                                                        </div>
                                                        {format(new Date(record.date), 'EEEE, dd MMM yyyy')}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <span className="font-black text-emerald-500 text-lg">
                                                        ₹{record.total_collection.toLocaleString()}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5 text-center">
                                                    <span className="bg-muted px-3 py-1 rounded-full text-sm font-black border border-border group-hover:border-indigo-500/30 transition-colors">
                                                        {record.active_riders_count} Riders
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5 text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className="font-black text-indigo-500 text-base">
                                                            ₹{Math.round(record.total_collection / record.active_riders_count).toLocaleString()}
                                                        </span>
                                                        <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-tighter">Per Head runrate</span>
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

                {/* Footer Insight: Information Rich */}
                <div className="px-12 py-8 bg-muted/20 border-t border-white/5 flex justify-between items-center sm:rounded-b-[3.5rem]">
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
        <div className="bg-card border border-white/5 rounded-[2.5rem] p-6 shadow-xl hover:shadow-2xl transition-all duration-300 relative overflow-hidden group hover:-translate-y-1">
            <div className={`absolute top-0 right-0 p-4 opacity-[0.03] scale-150 transform translate-x-1 translate-y-1 group-hover:scale-[1.8] group-hover:opacity-[0.08] transition-all duration-500`}>
                <Icon size={60} />
            </div>

            <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">{label}</p>
                    {trend && (
                        <span className={`text-[8px] font-black px-2 py-0.5 rounded-md ${color === 'indigo' ? 'bg-indigo-500/10 text-indigo-500' :
                            color === 'purple' ? 'bg-purple-500/10 text-purple-500' :
                                'bg-emerald-500/10 text-emerald-500'
                            }`}>
                            {trend}
                        </span>
                    )}
                </div>
                <p className="text-3xl font-black tracking-tighter mb-1 select-none">{value}</p>
                <p className="text-[10px] font-bold text-muted-foreground opacity-60 leading-tight">{subtitle}</p>
                <div className={`w-10 h-1 rounded-full mt-4 bg-gradient-to-r ${color === 'indigo' ? 'from-indigo-500 to-blue-500' :
                    color === 'purple' ? 'from-purple-500 to-violet-500' :
                        color === 'emerald' ? 'from-emerald-500 to-teal-500' :
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
