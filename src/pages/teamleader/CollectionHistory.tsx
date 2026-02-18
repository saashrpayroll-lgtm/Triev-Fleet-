import React, { useState, useEffect } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/config/supabase';
import { Calendar, TrendingUp, ArrowLeft } from 'lucide-react';
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

            setHistory(data || []);
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

    // Chart Data Preparation
    const chartData = history.map(item => ({
        date: format(parseISO(item.date), 'dd MMM'),
        amount: Number(item.total_collection) || 0,
        fullDate: item.date
    }));

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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-card/50 backdrop-blur-sm border rounded-xl p-5 shadow-sm">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Collection ({dateRange} Days)</p>
                    <h3 className="text-2xl font-bold mt-1 text-emerald-500">₹{totalCollected.toLocaleString()}</h3>
                </div>
                <div className="bg-card/50 backdrop-blur-sm border rounded-xl p-5 shadow-sm">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Average Daily</p>
                    <h3 className="text-2xl font-bold mt-1 text-blue-500">₹{Math.round(averageDaily).toLocaleString()}</h3>
                </div>
                <div className="bg-card/50 backdrop-blur-sm border rounded-xl p-5 shadow-sm">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Best Day</p>
                    <h3 className="text-2xl font-bold mt-1 text-purple-500">
                        {history.length > 0
                            ? `₹${Math.max(...history.map(h => Number(h.total_collection) || 0)).toLocaleString()}`
                            : '₹0'}
                    </h3>
                </div>
            </div>

            {/* Chart Section */}
            <div className="bg-card/50 backdrop-blur-md border rounded-2xl p-6 shadow-xl h-[350px]">
                <h3 className="text-sm font-semibold mb-6 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-500" />
                    Daily Trend
                </h3>
                {loading ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
                    </div>
                ) : history.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                            <XAxis
                                dataKey="date"
                                tick={{ fontSize: 10, fill: '#888' }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                tick={{ fontSize: 10, fill: '#888' }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(value) => `₹${value / 1000}k`}
                            />
                            <Tooltip
                                cursor={{ fill: 'transparent' }}
                                contentStyle={{
                                    backgroundColor: 'rgba(0,0,0,0.8)',
                                    borderRadius: '8px',
                                    border: 'none',
                                    color: '#fff'
                                }}
                                formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, 'Collected']}
                            />
                            <Bar dataKey="amount" radius={[4, 4, 0, 0]} maxBarSize={50}>
                                {chartData.map((_entry, index) => (
                                    <Cell key={`cell-${index}`} fill="url(#colorGradient)" />
                                ))}
                            </Bar>
                            <defs>
                                <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.3} />
                                </linearGradient>
                            </defs>
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
                    <h3 className="font-semibold text-sm">Detailed History</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 text-muted-foreground font-medium">
                            <tr>
                                <th className="px-6 py-3">Date</th>
                                <th className="px-6 py-3">Collection Amount</th>
                                <th className="px-6 py-3">Reference</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {[...history].reverse().map((item, idx) => (
                                <tr key={idx} className="hover:bg-muted/30 transition-colors">
                                    <td className="px-6 py-3 font-medium">
                                        {format(parseISO(item.date), 'PPP')}
                                    </td>
                                    <td className="px-6 py-3 font-mono text-emerald-500 font-semibold">
                                        ₹{Number(item.total_collection).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-3 text-muted-foreground text-xs">
                                        Auto-Synced
                                    </td>
                                </tr>
                            ))}
                            {history.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={3} className="px-6 py-8 text-center text-muted-foreground">
                                        No entries found
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
