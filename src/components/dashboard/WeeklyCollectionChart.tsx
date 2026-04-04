import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/config/supabase';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    CartesianGrid, Cell
} from 'recharts';
import { format, subDays } from 'date-fns';
import { BarChart2, TrendingUp } from 'lucide-react';

interface DailyCollectionRow {
    date: string;
    total_collection: number | string;
}

interface ChartDataPoint {
    name: string;
    fullDate: string;
    amount: number;
    isToday: boolean;
}

interface TooltipProps {
    active?: boolean;
    payload?: { value: number; payload: ChartDataPoint }[];
}

const CustomTooltip = ({ active, payload }: TooltipProps): React.ReactElement | null => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-popover/95 backdrop-blur-md border border-border/60 rounded-2xl shadow-2xl p-3">
                <p className="text-xs font-black text-foreground mb-0.5">{payload[0].payload.fullDate}</p>
                <p className="text-indigo-500 dark:text-indigo-400 font-black text-sm tabular-nums">
                    ₹{payload[0].value.toLocaleString('en-IN')}
                </p>
            </div>
        );
    }
    return null;
};

const WeeklyCollectionChart: React.FC = () => {
    const [data, setData] = useState<ChartDataPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalWeekly, setTotalWeekly] = useState(0);

    const fetchWeeklyData = async () => {
        try {
            const endDate = new Date();
            const startDate = subDays(endDate, 6);
            startDate.setHours(0, 0, 0, 0);

            const { data: dailyData, error } = await supabase
                .from('daily_collections')
                .select('date, total_collection')
                .gte('date', format(startDate, 'yyyy-MM-dd'));

            if (error) throw error;

            const chartData = [];
            let weeklySum = 0;
            const today = format(new Date(), 'yyyy-MM-dd');

            for (let i = 6; i >= 0; i--) {
                const d = subDays(new Date(), i);
                const dayStr = format(d, 'EEE');
                const dateStr = format(d, 'yyyy-MM-dd');
                const dayEntries = (dailyData || []).filter((row: DailyCollectionRow) => row.date === dateStr);
                const total = dayEntries.reduce((acc: number, curr: DailyCollectionRow) => acc + (Number(curr.total_collection) || 0), 0);
                weeklySum += total;
                chartData.push({ name: dayStr, fullDate: format(d, 'MMM dd'), amount: total, isToday: dateStr === today });
            }

            setData(chartData);
            setTotalWeekly(weeklySum);
        } catch (error) {
            console.error('Error fetching weekly collection:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWeeklyData();
        const channel = supabase
            .channel('public:daily_collections_weekly')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_collections' }, fetchWeeklyData)
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, []);

    const maxAmount = Math.max(...data.map(d => d.amount), 1);

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-card/60 dark:bg-black/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-sm p-5 flex flex-col h-full hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-500 group"
        >
            <div className="flex justify-between items-start mb-5">
                <div className="flex items-center gap-2">
                    <div className="w-1 h-6 rounded-full bg-gradient-to-b from-indigo-400 to-violet-600 group-hover:scale-y-110 transition-transform" />
                    <div>
                        <h3 className="text-base font-black tracking-tight text-foreground flex items-center gap-1.5">
                            <BarChart2 size={14} className="text-indigo-500" />
                            Weekly History
                        </h3>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Last 7 days</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-[8px] text-muted-foreground uppercase tracking-widest font-bold">Week Total</p>
                    <p className="text-lg font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
                        ₹{totalWeekly.toLocaleString('en-IN')}
                    </p>
                    <p className="text-[8px] text-emerald-500 font-bold flex items-center gap-0.5 justify-end mt-0.5">
                        <TrendingUp size={8} /> Live
                    </p>
                </div>
            </div>

            <div className="flex-grow w-full min-h-[180px]">
                {loading ? (
                    <div className="w-full h-full flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="barWeek" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#818cf8" />
                                    <stop offset="100%" stopColor="#6366f1" />
                                </linearGradient>
                                <linearGradient id="barToday" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#a78bfa" />
                                    <stop offset="100%" stopColor="#7c3aed" />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.12} />
                            <XAxis
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 10, fontWeight: 700, fill: 'hsl(var(--muted-foreground))' }}
                                dy={8}
                            />
                            <YAxis hide />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.06)', radius: 8 }} />
                            <Bar dataKey="amount" radius={[6, 6, 2, 2]} barSize={28} animationDuration={900}>
                                {data.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={entry.isToday ? 'url(#barToday)' : entry.amount === maxAmount ? 'url(#barToday)' : 'url(#barWeek)'}
                                        opacity={entry.amount === 0 ? 0.3 : 1}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>
        </motion.div>
    );
};

export default WeeklyCollectionChart;
