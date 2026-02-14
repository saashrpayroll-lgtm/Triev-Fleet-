import React, { useEffect, useState } from 'react';
import { supabase } from '@/config/supabase';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format, subDays } from 'date-fns';
import { Calendar } from 'lucide-react';

const WeeklyCollectionChart: React.FC = () => {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalWeekly, setTotalWeekly] = useState(0);

    const fetchWeeklyData = async () => {
        try {
            const endDate = new Date();
            const startDate = subDays(endDate, 6); // Last 7 days including today
            startDate.setHours(0, 0, 0, 0);

            // Fetch daily_collections for the last 7 days
            const { data: dailyData, error } = await supabase
                .from('daily_collections')
                .select('date, total_collection')
                .gte('date', format(startDate, 'yyyy-MM-dd'));

            if (error) throw error;

            // Initialize last 7 days structure
            const chartData = [];
            let weeklySum = 0;

            for (let i = 6; i >= 0; i--) {
                const d = subDays(new Date(), i);
                const dayStr = format(d, 'EEE'); // "Mon", "Tue"
                const dateStr = format(d, 'yyyy-MM-dd');

                // Sum from Daily Collections (Source of Truth)
                const dayEntries = (dailyData || []).filter((row: any) => row.date === dateStr);
                const total = dayEntries.reduce((acc: number, curr: any) => acc + (Number(curr.total_collection) || 0), 0);

                weeklySum += total;
                chartData.push({
                    name: dayStr,
                    fullDate: format(d, 'MMM dd'),
                    amount: total
                });
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

        // Subscribe to real-time updates from daily_collections
        const channel = supabase
            .channel('public:daily_collections_weekly')
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen to all events (INSERT/UPDATE)
                    schema: 'public',
                    table: 'daily_collections'
                },
                () => {
                    fetchWeeklyData();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-popover border border-border p-3 rounded-lg shadow-lg">
                    <p className="text-sm font-semibold mb-1">{payload[0].payload.fullDate}</p>
                    <p className="text-indigo-500 font-bold">
                        ₹{payload[0].value.toLocaleString('en-IN')}
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="bg-card rounded-xl border border-border/50 shadow-sm p-6 flex flex-col h-full">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <Calendar size={18} className="text-indigo-500" />
                        Weekly Collection History
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">Last 7 days performance</p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Total this week</p>
                    <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                        ₹{totalWeekly.toLocaleString('en-IN')}
                    </p>
                </div>
            </div>

            <div className="flex-grow w-full min-h-[200px]">
                {loading ? (
                    <div className="w-full h-full flex items-center justify-center">
                        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                            <XAxis
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 12, fill: '#64748b' }}
                                dy={10}
                            />
                            <YAxis
                                hide
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Bar
                                dataKey="amount"
                                fill="#6366f1"
                                radius={[4, 4, 0, 0]}
                                barSize={30}
                                animationDuration={1000}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
};

export default WeeklyCollectionChart;
