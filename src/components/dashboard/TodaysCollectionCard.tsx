import React, { useEffect, useState } from 'react';
import { supabase } from '@/config/supabase';
import { Wallet, TrendingUp, History } from 'lucide-react';

const TodaysCollectionCard: React.FC = () => {
    const [amount, setAmount] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);
    const [transactionCount, setTransactionCount] = useState<number>(0);

    const fetchTodaysCollection = async () => {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayIso = today.toISOString();

            // Fetch logs for wallet transactions created today
            const { data, error } = await supabase
                .from('activity_logs')
                .select('metadata')
                .eq('action_type', 'wallet_transaction')
                .gte('timestamp', todayIso);

            if (error) throw error;

            let total = 0;
            let count = 0;

            data?.forEach((log: any) => {
                // Filter for 'credit' transactions (money coming IN)
                if (log.metadata && log.metadata.type === 'credit' && typeof log.metadata.amount === 'number') {
                    total += log.metadata.amount;
                    count++;
                }
            });

            setAmount(total);
            setTransactionCount(count);
        } catch (error) {
            console.error('Error fetching collection:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTodaysCollection();

        // Real-time subscription
        const channel = supabase
            .channel('public:activity_logs_ftd')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'activity_logs',
                    filter: 'action_type=eq.wallet_transaction'
                },
                (payload) => {
                    const newLog = payload.new as any;
                    // Check timestamp to ensure it's from today (simulating fresh start if app stays open across midnight)
                    const logDate = new Date(newLog.timestamp);
                    const today = new Date();
                    const isToday = logDate.getDate() === today.getDate() &&
                        logDate.getMonth() === today.getMonth() &&
                        logDate.getFullYear() === today.getFullYear();

                    if (isToday && newLog.metadata && newLog.metadata.type === 'credit' && typeof newLog.metadata.amount === 'number') {
                        setAmount(prev => prev + newLog.metadata.amount);
                        setTransactionCount(prev => prev + 1);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    return (
        <div className="bg-card rounded-xl border border-border/50 shadow-sm p-6 flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-all duration-300">
            {/* Background Decoration */}
            <div className="absolute right-0 top-0 w-32 h-32 bg-green-500/10 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-green-500/20" />

            <div>
                <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg text-green-600 dark:text-green-400">
                        <Wallet size={24} />
                    </div>
                    {/* Badge */}
                    <div className="flex items-center gap-1 px-2 py-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-xs font-bold rounded-full border border-green-200 dark:border-green-800">
                        <TrendingUp size={12} />
                        <span>Today (FTD)</span>
                    </div>
                </div>

                <h3 className="text-muted-foreground font-medium text-sm uppercase tracking-wide">
                    Today's Collection
                </h3>

                <div className="mt-2 flex items-baseline gap-2">
                    {loading ? (
                        <div className="h-9 w-32 bg-muted animate-pulse rounded" />
                    ) : (
                        <span className="text-3xl font-bold text-foreground">
                            ₹{amount.toLocaleString('en-IN')}
                        </span>
                    )}
                </div>
            </div>

            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground border-t border-border/50 pt-3">
                <History size={12} />
                <span>{transactionCount} transactions today</span>
            </div>
        </div>
    );
};

export default TodaysCollectionCard;
