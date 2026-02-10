import React, { useEffect, useState } from 'react';
import { supabase } from '@/config/supabase';
import { Wallet, TrendingUp, History } from 'lucide-react';

interface TodaysCollectionCardProps {
    teamLeaderId?: string;
}

const TodaysCollectionCard: React.FC<TodaysCollectionCardProps> = ({ teamLeaderId }) => {
    const [amount, setAmount] = useState<number>(0);
    const [transactionCount, setTransactionCount] = useState<number>(0);

    const fetchTodaysCollection = async () => {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayIso = today.toISOString();

            // Fetch logs for wallet transactions created today
            let query = supabase
                .from('activity_logs')
                .select('metadata')
                .eq('action_type', 'wallet_transaction')
                .gte('timestamp', todayIso);

            if (teamLeaderId) {
                // Filter by teamLeaderId in metadata is done in memory below for simplicity/performance 
                // unless we add a specific index. 
            }

            const { data, error } = await query;

            if (error) {
                console.error('FTD Fetch Error:', error);
                throw error;
            }

            let total = 0;
            let count = 0;

            data?.forEach((log: any) => {
                // Filter for 'credit' transactions (money coming IN)
                if (log.metadata && log.metadata.type === 'credit') {
                    // Filter by TL if prop provided
                    if (teamLeaderId && log.metadata.teamLeaderId !== teamLeaderId) return;

                    const amt = Number(log.metadata.amount);
                    if (!isNaN(amt)) {
                        total += amt;
                        count++;
                    }
                }
            });

            setAmount(total);
            setTransactionCount(count);
        } catch (error) {
            console.error('Error fetching collection:', error);
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

                    if (isToday && newLog.metadata && newLog.metadata.type === 'credit') {
                        // Filter for TL if prop is present
                        if (teamLeaderId && newLog.metadata.teamLeaderId !== teamLeaderId) return;

                        const amt = Number(newLog.metadata.amount);
                        if (!isNaN(amt)) {
                            setAmount(prev => prev + amt);
                            setTransactionCount(prev => prev + 1);
                        }
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [teamLeaderId]);

    return (
        <div className="bg-card rounded-xl border border-border/50 shadow-sm p-6 flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-all duration-300">
            {/* Background Decoration */}
            <div className="absolute right-0 top-0 w-32 h-32 bg-green-500/10 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-green-500/20" />

            <div>
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Today's Collection {teamLeaderId ? '(My Team)' : '(Total)'}</p>
                        <h3 className="text-3xl font-bold mt-1">₹{amount.toLocaleString()}</h3>
                    </div>
                    <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg text-green-600 dark:text-green-400">
                        <Wallet size={24} />
                    </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <TrendingUp size={14} className="text-green-500" />
                    <span className="font-medium text-green-600">Live Updates</span>
                    <span>• {transactionCount} transactions today</span>
                </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border/50 flex justify-between items-center text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                    <History size={12} /> Resets at midnight
                </span>
            </div>
        </div>
    );
};

export default TodaysCollectionCard;
