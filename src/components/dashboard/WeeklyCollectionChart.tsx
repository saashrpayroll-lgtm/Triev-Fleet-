import React, { useEffect, useState } from 'react';
import { supabase } from '@/config/supabase';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format, subDays, parseISO } from 'date-fns';
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

            // Fetch logs for wallet transactions in the last 7 days (Active/Recent)
            const logsPromise = supabase
                .from('wallet_transactions')
                .select('timestamp, amount, type')
                .eq('type', 'credit')
                .gte('timestamp', startDate.toISOString());

            // Fetch daily_collections for the same period (Archived)
            const dailyPromise = supabase
                .from('daily_collections')
                .select('date, total_collection')
                .gte('date', format(startDate, 'yyyy-MM-dd'));

            const [logsRes, dailyRes] = await Promise.all([logsPromise, dailyPromise]);

            if (logsRes.error) throw logsRes.error;
            if (dailyRes.error) throw dailyRes.error;

            const logs = logsRes.data || [];
            const dailyData = dailyRes.data || [];

            // Initialize last 7 days structure
            const chartData = [];
            let weeklySum = 0;

            for (let i = 6; i >= 0; i--) {
                const d = subDays(new Date(), i);
                const dayStr = format(d, 'EEE'); // "Mon", "Tue"
                const dateStr = format(d, 'yyyy-MM-dd');

                // 1. Sum from Wallet Transactions (Recent)
                const dayLogs = logs.filter((log: any) => format(parseISO(log.timestamp), 'yyyy-MM-dd') === dateStr);
                let logsTotal = 0;
                dayLogs.forEach((log: any) => {
                    if (typeof log.amount === 'number') {
                        logsTotal += log.amount;
                    }
                });

                // 2. Sum from Daily Collections (Archived)
                // Note: daily_collections rows are per TL per day. So we sum all rows for this date.
                const dayDaily = dailyData.filter((row: any) => row.date === dateStr);
                const dailyTotal = dayDaily.reduce((acc: number, curr: any) => acc + (Number(curr.total_collection) || 0), 0);

                // Total
                const total = logsTotal + dailyTotal;

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

        // Subscribe to real-time updates to refresh chart
        const channel = supabase
            .channel('public:activity_logs_weekly')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'wallet_transactions',
                    filter: 'type=eq.credit'
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
