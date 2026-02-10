import React, { useEffect, useState } from 'react';
import { supabase } from '@/config/supabase';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format, subDays, startOfDay, isSameDay, parseISO } from 'date-fns';
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

            // Fetch logs for wallet transactions in the last 7 days
            const { data: logs, error } = await supabase
                .from('activity_logs')
                .select('timestamp, metadata')
                .eq('action_type', 'wallet_transaction')
                .gte('timestamp', startDate.toISOString());

            if (error) throw error;

            // Initialize last 7 days structure
            const chartData = [];
            let weeklySum = 0;

            for (let i = 6; i >= 0; i--) {
                const d = subDays(new Date(), i);
                const dayStr = format(d, 'EEE'); // "Mon", "Tue"
                const fullDate = startOfDay(d);

                const dayLogs = logs?.filter(log => isSameDay(parseISO(log.timestamp), fullDate));

                let dayTotal = 0;
                dayLogs?.forEach((log: any) => {
                    if (log.metadata && log.metadata.type === 'credit' && typeof log.metadata.amount === 'number') {
                        dayTotal += log.metadata.amount;
                    }
                });

                weeklySum += dayTotal;
                chartData.push({
                    name: dayStr,
                    fullDate: format(d, 'MMM dd'),
                    amount: dayTotal
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
                    table: 'activity_logs',
                    filter: 'action_type=eq.wallet_transaction'
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
