import React, { useEffect, useState } from 'react';
import { supabase } from '@/config/supabase';
import { Wallet, TrendingUp, History } from 'lucide-react';

interface TodaysCollectionCardProps {
    teamLeaderId?: string;
    compact?: boolean;
}

const TodaysCollectionCard: React.FC<TodaysCollectionCardProps> = ({ teamLeaderId, compact = false }) => {
    const [amount, setAmount] = useState<number>(0);
    const [transactionCount, setTransactionCount] = useState<number>(0);

    const fetchTodaysCollection = async () => {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayIso = today.toISOString();

            // Fetch logs for wallet transactions created today
            let query = supabase
                .from('wallet_transactions')
                .select('amount')
                .eq('type', 'credit')
                .gte('timestamp', todayIso);

            if (teamLeaderId) {
                query = query.eq('team_leader_id', teamLeaderId);
            }

            const { data, error } = await query;

            if (error) throw error;

            if (data) {
                const total = data.reduce((sum, txn) => sum + (Number(txn.amount) || 0), 0);
                setAmount(total);
                setTransactionCount(data.length);
            }
        } catch (err) {
            console.error('Error fetching today collection:', err);
        }
    };

    useEffect(() => {
        fetchTodaysCollection();

        // Setup real-time listener
        const channel = supabase
            .channel('today-collection-updates')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'wallet_transactions', filter: 'type=eq.credit' },
                () => {
                    fetchTodaysCollection();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [teamLeaderId]);

    return (
        <div className={`
            relative overflow-hidden rounded-xl border ${compact ? 'p-3' : 'p-5'}
            bg-gradient-to-br from-indigo-600 to-violet-700
            text-white shadow-lg shadow-indigo-500/20
            transition-all duration-300 hover:scale-[1.02]
            group cursor-pointer
        `}>
            {/* Background Decor */}
            <div className="absolute top-0 right-0 p-3 opacity-10">
                <History size={compact ? 60 : 100} />
            </div>

            <div className="relative z-10 flex flex-col justify-between h-full">
                <div className={`flex justify-between items-start ${compact ? 'mb-2' : 'mb-4'}`}>
                    <div className={`
                        ${compact ? 'p-2 rounded-lg' : 'p-3 rounded-2xl'} 
                        bg-white/10 backdrop-blur-md border border-white/20
                    `}>
                        <Wallet size={compact ? 18 : 24} className="text-white" />
                    </div>
                    <div className={`
                        flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full 
                        bg-white/20 backdrop-blur-sm border border-white/10 text-white
                    `}>
                        <TrendingUp size={10} />
                        Today
                    </div>
                </div>

                <div>
                    <p className={`text-[${compact ? '9px' : '10px'}] font-bold uppercase tracking-wider text-indigo-100 mb-0.5`}>
                        Today's Collection
                    </p>
                    <h3 className={`${compact ? 'text-2xl' : 'text-3xl'} font-black tracking-tighter text-white drop-shadow-sm`}>
                        ₹{amount.toLocaleString('en-IN')}
                    </h3>
                    {!compact && (
                        <p className="text-[10px] text-indigo-200 font-medium mt-1">
                            {transactionCount} transactions today
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TodaysCollectionCard;
