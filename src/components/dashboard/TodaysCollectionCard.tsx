import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
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
            const now = new Date();
            const istDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
            const [year, month, day] = istDateStr.split('-').map(Number);
            const midnightIST = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
            midnightIST.setUTCMinutes(midnightIST.getUTCMinutes() - 330);
            const todayIso = midnightIST.toISOString();

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
                .eq('mode', 'ADD')
                .in('transaction_type', [
                    'DAILY_COLLECTION', 'DAILY COLLECTION',
                    'RENT_COLLECTION', 'RENT COLLECTION',
                    'FTD_COLLECTION', 'FTD COLLECTION',
                    'COLLECTION', 'RENT'
                ])
                .gte('created_at', todayIso);

            if (teamLeaderId) {
                query = query.eq('rider.team_leader_id', teamLeaderId);
            }

            const { data, error } = await query;
            if (error) throw error;

            let total = 0;
            let count = 0;
            (data as any[]).forEach((txn) => {
                const amt = Number(txn.amount);
                if (!isNaN(amt)) { total += amt; count++; }
            });

            setAmount(total);
            setTransactionCount(count);
        } catch (error) {
            console.error('Error fetching collection:', error);
        }
    };

    useEffect(() => {
        fetchTodaysCollection();

        const channel = supabase
            .channel('public:wallet_ledger_ftd')
            .on('postgres_changes', {
                event: 'INSERT', schema: 'public', table: 'wallet_ledger', filter: 'mode=eq.ADD'
            }, async (payload) => {
                const newLog = payload.new as any;
                if (!['DAILY_COLLECTION', 'DAILY COLLECTION', 'RENT_COLLECTION', 'RENT COLLECTION', 'FTD_COLLECTION', 'FTD COLLECTION', 'COLLECTION', 'RENT'].includes(newLog.transaction_type)) return;

                const logIst = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(newLog.created_at));
                const todayIst = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
                if (logIst !== todayIst) return;

                const amt = Number(newLog.amount);
                if (isNaN(amt)) return;

                if (teamLeaderId) {
                    const { data: riderData } = await supabase
                        .from('riders').select('team_leader_id').eq('id', newLog.rider_id).single();
                    if (riderData && riderData.team_leader_id === teamLeaderId) {
                        setAmount(prev => prev + amt);
                        setTransactionCount(prev => prev + 1);
                    }
                } else {
                    setAmount(prev => prev + amt);
                    setTransactionCount(prev => prev + 1);
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [teamLeaderId]);

    return (
        <motion.div
            whileHover={{ y: -4, scale: 1.015 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="relative overflow-hidden rounded-2xl border border-emerald-400/20 bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent bg-card/70 dark:bg-black/25 backdrop-blur-md shadow-sm hover:shadow-xl hover:shadow-emerald-500/25 ring-2 ring-transparent group-hover:ring-emerald-500/20 group p-3.5 sm:p-4 cursor-default transition-shadow duration-300"
        >
            {/* Shine sweep */}
            <div className="pointer-events-none absolute inset-0 translate-x-[-120%] group-hover:translate-x-[120%] transition-transform duration-700 ease-in-out bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12 z-10" />

            {/* Ghost watermark */}
            <div className="absolute -right-5 -bottom-5 text-emerald-500 opacity-[0.07] group-hover:opacity-[0.12] group-hover:rotate-12 group-hover:scale-110 transition-all duration-500">
                <Wallet size={96} />
            </div>

            <div className="relative z-10 flex flex-col gap-2.5">

                {/* Icon + live badge */}
                <div className="flex items-start justify-between">
                    <motion.div
                        whileHover={{ rotate: [0, -8, 8, 0] }}
                        transition={{ duration: 0.4 }}
                        className="p-2 sm:p-2.5 rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20 text-emerald-500 group-hover:scale-110 transition-transform duration-300"
                    >
                        <Wallet size={18} strokeWidth={2.5} />
                    </motion.div>
                    <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                        <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                        </span>
                        <span className="text-[8px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Live</span>
                    </div>
                </div>

                {/* Value */}
                <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground/70 mb-0.5">
                        {teamLeaderId ? "Today's Collection (My Team)" : "Today's Collection (Total)"}
                    </p>
                    <motion.p
                        key={amount}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                        className="text-2xl sm:text-[1.6rem] font-black tracking-tight text-foreground tabular-nums leading-none"
                    >
                        ₹{amount.toLocaleString('en-IN')}
                    </motion.p>
                </div>

                {/* Subtitle */}
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-emerald-500 opacity-70" />
                    <p className="text-[10px] font-semibold text-muted-foreground truncate leading-tight">
                        {transactionCount} transactions today
                    </p>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-[9px] text-muted-foreground/60 pt-1 border-t border-border/30">
                    <span className="flex items-center gap-1">
                        <History size={10} /> Resets at midnight
                    </span>
                    <span className="flex items-center gap-1 text-emerald-500 font-bold">
                        <TrendingUp size={9} /> Real-time
                    </span>
                </div>
            </div>

            {/* Bottom accent line */}
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-400 to-teal-600 opacity-40 group-hover:opacity-70 transition-opacity duration-300" />
        </motion.div>
    );
};

export default TodaysCollectionCard;
