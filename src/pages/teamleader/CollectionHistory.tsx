import React, { useState, useEffect } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/config/supabase';
import { getValidHistoricalDate } from '@/utils/dateUtils';
import { Calendar, TrendingUp, ArrowLeft, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from 'recharts';
import { format, parseISO, subDays } from 'date-fns';
import { toast } from 'sonner';

interface DailyCollection {
    date: string;
    total_collection: number;
    team_leader_id: string;
    active_riders_count: number;
}

const CollectionHistory: React.FC = () => {
    const { userData } = useSupabaseAuth();
    const navigate = useNavigate();
    const [history, setHistory] = useState<DailyCollection[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<'7' | '30' | '90'>('30');

    useEffect(() => {
        if (userData?.id) {
            fetchHistory();
        }
    }, [userData?.id, dateRange]);

    const fetchHistory = async () => {
        try {
            setLoading(true);
            const days = parseInt(dateRange);
            const startDate = subDays(new Date(), days).toISOString().split('T')[0];

            const { data, error } = await supabase
                .from('daily_collections')
                .select('*')
                .eq('team_leader_id', userData!.id)
                .gte('date', startDate)
                .order('date', { ascending: true }); // Ascending for Chart

            if (error) throw error;

            let records = data || [];

            // Compute IST midnight in UTC: 00:00 IST = 18:30 UTC of the previous calendar day
            const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

            const [{ data: todayLedger }, { data: allRiders }] = await Promise.all([
                supabase
                    .from('wallet_ledger')
                    .select('amount, rider:riders!inner(team_leader_id)')
                    .eq('mode', 'ADD')
                    .in('transaction_type', ['DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION', 'COLLECTION', 'RENT', 'DAILY COLLECTION', 'RENT COLLECTION', 'FTD COLLECTION'])
                    .eq('rider.team_leader_id', userData!.id)
                    // ✅ ROBUST FIX: catch rows with transaction_date set (imports) OR NULL (legacy)
                    .or((() => {
                        const now = new Date();
                        const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
                        const [y, m, d] = todayIST.split('-').map(Number);
                        const midnight = new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - 5.5 * 60 * 60 * 1000).toISOString();
                        return `transaction_date.gte.${midnight},and(transaction_date.is.null,created_at.gte.${midnight})`;
                    })()),
                supabase
                    .from('riders')
                    .select('status, allotment_date, inactivated_at, updated_at, created_at')
                    .eq('team_leader_id', userData!.id)
            ]);

            const realTodayCollection = (todayLedger || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

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
                    return inactDate ? inactDate > ds : false;
                }).length;
            };

            const liveActiveCount = getHistoricalActiveCount(todayStr);

            // Recompute active__riders_count for all records
            records = records.map(rec => ({
                ...rec,
                active_riders_count: getHistoricalActiveCount(rec.date)
            }));

            // If we found money today but daily_collections didn't log it yet, overwrite or inject
            const existingTodayIndex = records.findIndex(r => r.date === todayStr);
            if (existingTodayIndex >= 0) {
                records[existingTodayIndex].total_collection = realTodayCollection;
                records[existingTodayIndex].active_riders_count = liveActiveCount;
            } else if (realTodayCollection > 0 || liveActiveCount > 0) {
                records = [...records, {
                    date: todayStr,
                    total_collection: realTodayCollection,
                    active_riders_count: liveActiveCount,
                    team_leader_id: userData!.id
                }];
            }

            setHistory(records);
        } catch (error) {
            console.error('Error fetching collection history:', error);
            toast.error('Failed to load history');
        } finally {
            setLoading(false);
        }
    };

    // Calculate Totals
    const totalCollected = history.reduce((sum, item) => sum + (Number(item.total_collection) || 0), 0);
    const averageDaily = history.length > 0 ? totalCollected / history.length : 0;

    // Calculate Average per Rider for the entire period
    const totalRiderWeighted = history.reduce((sum, item) => sum + (item.active_riders_count || 1), 0);
    const averagePerRider = history.length > 0 ? totalCollected / totalRiderWeighted : 0;

    const bestDay = history.length > 0
        ? Math.max(...history.map(h => Number(h.total_collection) || 0))
        : 0;

    // Chart Data Preparation
    const chartData = history.map(item => {
        const amount = Number(item.total_collection) || 0;
        const riderCount = item.active_riders_count || 1;
        const perRider = amount / riderCount;

        // Dynamic Color Logic based on deviation from average
        // Green: > 85% of average
        // Yellow: 60% to 85%
        // Red: < 60%
        let barColor = '#6366f1'; // Default Indigo
        if (averageDaily > 0) {
            const performance = (amount / averageDaily) * 100;
            if (performance > 85) barColor = '#0ac429'; // Custom Emerald/Green
            else if (performance >= 60) barColor = '#fce700'; // Custom Amber/Yellow
            else barColor = '#f50202'; // Custom Red
        }

        return {
            date: format(parseISO(item.date), 'dd MMM'),
            amount: amount,
            perRider: Math.round(perRider),
            fullDate: item.date,
            color: barColor,
            riderCount
        };
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/team-leader')}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-muted-foreground" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-500 to-teal-600 bg-clip-text text-transparent flex items-center gap-2">
                            <TrendingUp className="w-6 h-6 text-emerald-500" />
                            Collection History
                        </h1>
                        <p className="text-muted-foreground text-sm">Track your daily collection performance</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 bg-card border rounded-lg p-1">
                    {(['7', '30', '90'] as const).map((range) => (
                        <button
                            key={range}
                            onClick={() => setDateRange(range)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${dateRange === range
                                ? 'bg-emerald-500 text-white shadow-sm'
                                : 'text-muted-foreground hover:bg-muted'
                                }`}
                        >
                            Last {range} Days
                        </button>
                    ))}
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-card/50 backdrop-blur-sm border border-border/50 hover:border-border transition-colors rounded-xl p-5 shadow-sm relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Collection ({dateRange} Days)</p>
                    <h3 className="text-3xl font-bold mt-2 text-emerald-500">₹{totalCollected.toLocaleString()}</h3>
                </div>
                <div className="bg-card/50 backdrop-blur-sm border border-border/50 hover:border-border transition-colors rounded-xl p-5 shadow-sm relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Average Daily</p>
                    <h3 className="text-3xl font-bold mt-2 text-blue-500">₹{Math.round(averageDaily).toLocaleString()}</h3>
                </div>
                <div className="bg-card/50 backdrop-blur-sm border border-border/50 hover:border-border transition-colors rounded-xl p-5 shadow-sm relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Avg Per Rider</p>
                    <h3 className="text-3xl font-bold mt-2 text-indigo-500">₹{Math.round(averagePerRider).toLocaleString()}</h3>
                </div>
                <div className="bg-card/50 backdrop-blur-sm border border-border/50 hover:border-border transition-colors rounded-xl p-5 shadow-sm relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Best Day</p>
                    <h3 className="text-3xl font-bold mt-2 text-purple-500">₹{bestDay.toLocaleString()}</h3>
                </div>
            </div>

            {/* Chart Section */}
            <div className="bg-card/50 backdrop-blur-md border rounded-2xl p-6 shadow-xl h-[380px]">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-emerald-500" />
                        Daily Trend & Performance
                    </h3>
                    <div className="flex gap-4 text-[10px] font-bold uppercase tracking-wider">
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Good</div>
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Neutral</div>
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-500" /> Low</div>
                    </div>
                </div>
                {loading ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
                    </div>
                ) : history.length > 0 ? (
                    <ResponsiveContainer width="100%" height="80%">
                        <BarChart data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} stroke="hsl(var(--muted-foreground))" />
                            <XAxis
                                dataKey="date"
                                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                                axisLine={false}
                                tickLine={false}
                                tickMargin={10}
                            />
                            <YAxis
                                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(value) => `₹${value / 1000}k`}
                                tickMargin={10}
                            />
                            <Tooltip
                                cursor={{ fill: 'hsl(var(--muted)/0.2)' }}
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const data = payload[0].payload;
                                        return (
                                            <div className="bg-card border border-border p-3 rounded-lg shadow-xl text-xs space-y-1.5 min-w-[140px]">
                                                <p className="font-bold border-b pb-1 mb-1">{data.fullDate}</p>
                                                <div className="flex justify-between gap-4">
                                                    <span className="text-muted-foreground">Collected:</span>
                                                    <span className="font-bold text-emerald-500">₹{data.amount.toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between gap-4">
                                                    <span className="text-muted-foreground">Fleet Size:</span>
                                                    <span className="font-bold">{data.riderCount} Riders</span>
                                                </div>
                                                <div className="flex justify-between gap-4 border-t pt-1 mt-1">
                                                    <span className="text-muted-foreground">Avg/Rider:</span>
                                                    <span className="font-bold text-indigo-500">₹{data.perRider.toLocaleString()}</span>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Bar dataKey="amount" radius={[4, 4, 0, 0]} maxBarSize={40}>
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.8} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                        No collection data available for this period
                    </div>
                )}
            </div>

            {/* Detailed Table */}
            <div className="bg-card/50 backdrop-blur-md border rounded-2xl overflow-hidden shadow-xl">
                <div className="p-4 border-b bg-muted/20 flex justify-between items-center">
                    <h3 className="font-semibold text-sm">Detailed History & Per-Rider Metrics</h3>
                </div>
                <div className="overflow-x-auto max-h-[480px] overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20">
                    <table className="w-full text-sm text-left border-separate border-spacing-0">
                        <thead className="bg-muted/90 backdrop-blur-md text-muted-foreground font-semibold text-xs uppercase tracking-wider sticky top-0 z-20 shadow-sm">
                            <tr>
                                <th className="px-6 py-4 border-b border-border/50">Date</th>
                                <th className="px-6 py-4 border-b border-border/50">Total Collection</th>
                                <th className="px-6 py-4 border-b border-border/50">Fleet (Riders)</th>
                                <th className="px-6 py-4 border-b border-border/50">Collection / Rider</th>
                                <th className="px-6 py-4 border-b border-border/50 text-right">Trend</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {[...history].reverse().map((item, idx) => {
                                const amount = Number(item.total_collection) || 0;
                                const riderCount = item.active_riders_count || 1;
                                const avgPerRider = amount / riderCount;

                                // Performance status for row indicator
                                let statusClass = "bg-emerald-500";
                                if (averageDaily > 0) {
                                    const perf = (amount / averageDaily) * 100;
                                    if (perf < 60) statusClass = "bg-red-500";
                                    else if (perf <= 85) statusClass = "bg-amber-500";
                                }

                                return (
                                    <tr key={idx} className="hover:bg-muted/30 transition-colors group">
                                        <td className="px-6 py-4 font-medium text-foreground">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-1.5 h-6 rounded-full ${statusClass} opacity-50`} />
                                                {format(parseISO(item.date), 'dd MMM yyyy')}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-emerald-500 font-bold bg-emerald-500/5 group-hover:bg-emerald-500/10 transition-colors">
                                            ₹{amount.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 font-medium">
                                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                                <Users size={14} className="text-blue-500" />
                                                {riderCount}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-indigo-500 font-mono">₹{Math.round(avgPerRider).toLocaleString()}</span>
                                                <span className="text-[10px] text-muted-foreground uppercase font-medium">Per Rider Average</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="bg-muted px-2.5 py-1 rounded-full text-[10px] font-medium border border-border">Auto-Synced</span>
                                        </td>
                                    </tr>
                                );
                            })}
                            {history.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Calendar className="w-8 h-8 opacity-20" />
                                            <p>No collection entries found for this period.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default CollectionHistory;
