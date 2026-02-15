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

            // Use wallet_ledger as source of truth
            // Query construction depends on whether we filter by TL
            let query = supabase
                .from('wallet_ledger')
                .select(`
                    amount,
                    mode,
                    created_at,
                    rider:riders!inner (
                        team_leader_id
                    )
                `)
                .eq('mode', 'ADD') // Only collections/credits
                .eq('transaction_type', 'DAILY_COLLECTION') // STRICT: Only Rent Collection Imports
                .gte('created_at', todayIso);

            if (teamLeaderId) {
                // Filter by TL via the joined riders table
                query = query.eq('riders.team_leader_id', teamLeaderId);
            }

            const { data, error } = await query;

            if (error) {
                console.error('FTD Fetch Error:', error);
                throw error;
            }

            let total = 0;
            let count = 0;

            // Type assertion for the joined data
            const transactions = data as any[];

            transactions.forEach((txn) => {
                const amt = Number(txn.amount);
                if (!isNaN(amt)) {
                    total += amt;
                    count++;
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

        // Real-time subscription to wallet_ledger
        const channel = supabase
            .channel('public:wallet_ledger_ftd')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'wallet_ledger',
                    filter: 'mode=eq.ADD' // Only listen for ADDs
                },
                async (payload) => {
                    const newLog = payload.new as any;

                    // STRICT FILTER: Ignore Auto-fixes, Manual Adjustments, etc.
                    if (newLog.transaction_type !== 'DAILY_COLLECTION') {
                        return;
                    }


                    // Check timestamp to ensure it's from today
                    const logDate = new Date(newLog.created_at);
                    const today = new Date();
                    const isToday = logDate.getDate() === today.getDate() &&
                        logDate.getMonth() === today.getMonth() &&
                        logDate.getFullYear() === today.getFullYear();

                    if (isToday) {
                        const amt = Number(newLog.amount);
                        if (isNaN(amt)) return;

                        if (teamLeaderId) {
                            // If filtering by TL, we must verify the rider belongs to this TL
                            // We need to fetch the rider's TL ID since it's not in wallet_ledger
                            const { data: riderData } = await supabase
                                .from('riders')
                                .select('team_leader_id')
                                .eq('id', newLog.rider_id)
                                .single();

                            if (riderData && riderData.team_leader_id === teamLeaderId) {
                                setAmount(prev => prev + amt);
                                setTransactionCount(prev => prev + 1);
                            }
                        } else {
                            // Global view (Admin)
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
