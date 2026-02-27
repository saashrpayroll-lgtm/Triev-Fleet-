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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-xl animate-in fade-in duration-500 py-6 px-4">
            <div className="bg-background border w-full max-w-5xl rounded-[2.5rem] shadow-[0_0_50px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col h-[90vh] animate-in zoom-in-95 duration-500 border-white/10 relative">

                {/* Decorative background elements */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 blur-[120px] -z-10 rounded-full" />
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 blur-[120px] -z-10 rounded-full" />

                {/* Header */}
                <div className="px-8 py-6 border-b flex justify-between items-center bg-muted/20 backdrop-blur-md sticky top-0 z-20">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                            <BarChart3 size={28} />
                        </div>
                        <div>
                            <h3 className="font-black text-2xl tracking-tight text-foreground">Advanced Collection Intelligence</h3>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="bg-indigo-500/10 text-indigo-500 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-500/20">Supervisor</span>
                                <p className="text-sm text-muted-foreground font-bold">{teamLeaderName}</p>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 bg-muted hover:bg-rose-500/10 hover:text-rose-500 rounded-2xl transition-all active:scale-95 border border-transparent hover:border-rose-500/20 group"
                    >
                        <X size={24} className="text-muted-foreground group-hover:text-rose-500 transition-colors" />
                    </button>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col">
                    {/* Summary Metrics Row */}
                    {!loading && history.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-8 bg-muted/10">
                            <MetricTile
                                label="Aggregate Sourcing"
                                value={`₹${stats.totalCollection.toLocaleString()}`}
                                icon={Wallet}
                                color="indigo"
                                subtitle="Total all-time recovery"
                            />
                            <MetricTile
                                label="Avg Active Fleet"
                                value={stats.avgActiveRiders.toString()}
                                icon={Users}
                                color="purple"
                                subtitle="Daily mean force"
                            />
                            <MetricTile
                                label="Per Rider Runrate"
                                value={`₹${stats.avgPerRider.toLocaleString()}`}
                                icon={TrendingUp}
                                color="emerald"
                                subtitle="Efficiency per head"
                            />
                            <MetricTile
                                label="Single Day Peak"
                                value={`₹${stats.bestDay.toLocaleString()}`}
                                icon={TrendingUp}
                                color="amber"
                                subtitle="Highest record"
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

                {/* Footer Insight */}
                <div className="p-6 bg-muted/30 border-t flex justify-between items-center px-10">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        <span className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground">
                            {history.length} Data Points Analyzed • Live Dashboard Sync
                        </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground font-bold flex items-center gap-6">
                        <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Collection Volume</span>
                        <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Daily Runrate</span>
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
}

const MetricTile: React.FC<MetricTileProps> = ({ label, value, icon: Icon, color, subtitle }) => {
    return (
        <div className="bg-card border rounded-3xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className={`absolute top-0 right-0 p-3 opacity-10 scale-150 transform translate-x-1 translate-y-1 group-hover:scale-[1.7] transition-transform`}>
                <Icon size={40} />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
            <p className="text-2xl font-black mb-1">{value}</p>
            <p className="text-[9px] font-bold text-muted-foreground/60">{subtitle}</p>
            <div className={`w-8 h-1 rounded-full mt-3 ${color === 'indigo' ? 'bg-indigo-500' : color === 'purple' ? 'bg-purple-500' : color === 'emerald' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
        </div>
    );
};

export default CollectionHistoryModal;
