import React, { useMemo } from 'react';
import { User, Rider, Lead } from '@/types';
import { Trophy, Sparkles, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { safeRender } from '@/utils/safeRender';


interface LeaderboardProps {
    teamLeaders: User[];
    riders: Rider[];
    leads?: Lead[];
    collections?: Record<string, number>; // Map of TL ID -> Collection Amount
    action?: React.ReactNode;
    disableClick?: boolean;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ teamLeaders, riders, leads = [], collections = {}, action, disableClick = false }) => {
    // DEBUG: Log incoming data - REMOVED for Security
    // console.log('🎯 LEADERBOARD: Received teamLeaders:', teamLeaders.length);

    const navigate = useNavigate();
    const location = useLocation();
    const isDashboard = location.pathname.includes('dashboard') || location.pathname === '/admin' || location.pathname === '/team-leader';

    // AI Scoring Algorithm (Same logic, enhanced display)
    const scoredTLs = useMemo(() => {
        // console.log('🎯 LEADERBOARD useMemo: Starting calculation');

        const result = teamLeaders.map(tl => {
            const tlRiders = riders.filter(r => r.teamLeaderId === tl.id);
            const activeCount = tlRiders.filter(r => r.status === 'active').length;
            const inactiveCount = tlRiders.filter(r => r.status === 'inactive').length;
            const totalWallet = tlRiders.reduce((sum, r) => sum + r.walletAmount, 0);

            // Detailed Wallet Stats
            const positiveWallet = tlRiders.reduce((sum, r) => r.walletAmount > 0 ? sum + r.walletAmount : sum, 0);
            const negativeWallet = tlRiders.reduce((sum, r) => r.walletAmount < 0 ? sum + r.walletAmount : sum, 0);
            const avgWallet = tlRiders.length > 0 ? Math.round(totalWallet / tlRiders.length) : 0;

            // Leads
            const tlLeads = leads.filter(l => l.createdBy === tl.id);
            const convertedLeads = tlLeads.filter(l => l.status === 'Convert').length;

            // Activity (Mock calculation based on recent timeline events or just sum of actions)
            // Ideally this would come from an Activity Log, but we used derived stats for now
            const collectionAmount = collections[tl.id] || 0;
            const activityScore = activeCount + convertedLeads + (tlLeads.length > 0 ? 1 : 0);

            // Scoring Logic
            let score = 100;
            score += activeCount * 10;
            score -= inactiveCount * 5;
            score += (totalWallet > 0 ? Math.floor(totalWallet / 1000) : 0);
            score += (totalWallet < 0 ? Math.floor(totalWallet / 1000) * 2 : 0);
            score += convertedLeads * 20;
            score += Math.floor(collectionAmount / 1000) * 5; // 5 points per 1k collected

            // CRITICAL FIX: Only include primitive fields, not the entire object
            // This prevents any JSONB or object fields from causing React Error #310
            const tlData = {
                id: tl.id,
                fullName: tl.fullName,
                email: tl.email,
                role: tl.role,
                score: Math.max(0, score),
                stats: {
                    activeRiders: activeCount,
                    totalRiders: tlRiders.length,
                    wallet: totalWallet,
                    positiveWallet,
                    negativeWallet,
                    avgWallet,
                    leads: tlLeads.length,
                    converted: convertedLeads,
                    conversionRate: tlLeads.length > 0 ? Math.round((convertedLeads / tlLeads.length) * 100) : 0,
                    activity: activityScore,
                    collection: collectionAmount
                }
            };
            return tlData;
        }).sort((a, b) => b.score - a.score).slice(0, 3);

        return result;
    }, [teamLeaders, riders, leads, collections]);

    const getRankStyles = (index: number) => {
        switch (index) {
            case 0: return {
                bg: 'bg-gradient-to-br from-yellow-50 to-amber-100 dark:from-yellow-900/20 dark:to-amber-900/10',
                border: 'border-yellow-200 dark:border-yellow-700/50',
                text: 'text-yellow-700 dark:text-yellow-500',
                badge: 'bg-yellow-500',
                shadow: 'shadow-yellow-500/10'
            };
            case 1: return {
                bg: 'bg-gradient-to-br from-slate-50 to-gray-100 dark:from-slate-800/20 dark:to-gray-800/10',
                border: 'border-slate-200 dark:border-slate-700/50',
                text: 'text-slate-700 dark:text-slate-400',
                badge: 'bg-slate-400',
                shadow: 'shadow-slate-500/10'
            };
            case 2: return {
                bg: 'bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/10',
                border: 'border-orange-200 dark:border-orange-700/50',
                text: 'text-orange-700 dark:text-orange-500',
                badge: 'bg-orange-500',
                shadow: 'shadow-orange-500/10'
            };
            default: return { bg: '', border: '', text: '', badge: '', shadow: '' };
        }
    };

    if (scoredTLs.length === 0) return null;

    // Podium Order: 2nd, 1st, 3rd
    const podiumOrder = [scoredTLs[1], scoredTLs[0], scoredTLs[2]].filter(Boolean);

    return (
        <div className="w-full">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-yellow-100 text-yellow-600 rounded-xl">
                        <Trophy size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg flex items-center gap-2 text-foreground">
                            Top Performers Leaderboard
                            <Sparkles size={16} className="text-yellow-500 fill-yellow-500 animate-pulse" />
                        </h3>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 font-bold uppercase tracking-widest">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            Live Sync: {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </p>
                    </div>
                </div>
                {action}
            </div>

            {/* Podium Layout */}
            <div className="flex flex-col md:flex-row items-end justify-center gap-4 md:gap-8 h-auto md:h-[450px] pt-10">
                {podiumOrder.map((tl, idx) => {
                    // Determine actual rank based on sorted list
                    const actualRank = scoredTLs.indexOf(tl);
                    const isFirst = actualRank === 0;
                    const isSecond = actualRank === 1;


                    const styles = getRankStyles(actualRank);

                    // Podium Visual Height adjustments
                    let podiumHeightClass = '';
                    let orderClass = '';
                    let scaleClass = '';

                    if (isFirst) {
                        orderClass = 'order-1 md:order-2'; // Center on desktop
                        podiumHeightClass = 'min-h-[380px]';
                        scaleClass = 'md:scale-110 z-20';
                    } else if (isSecond) {
                        orderClass = 'order-2 md:order-1'; // Left on desktop
                        podiumHeightClass = 'min-h-[320px]';
                        scaleClass = 'z-10 mt-8';
                    } else { // Third
                        orderClass = 'order-3 md:order-3'; // Right on desktop
                        podiumHeightClass = 'min-h-[290px]';
                        scaleClass = 'z-0 mt-16';
                    }

                    return (
                        <motion.div
                            key={tl.id}
                            initial={{ opacity: 0, y: 50 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: idx * 0.1 }}
                            className={`w-full md:w-1/3 relative flex flex-col ${orderClass} ${scaleClass}`}
                        >
                            {/* Crown for 1st Place */}
                            {isFirst && (
                                <div className="absolute -top-12 left-1/2 -translate-x-1/2 text-yellow-500 animate-bounce">
                                    <Trophy size={48} className="drop-shadow-lg fill-yellow-400" />
                                </div>
                            )}

                            <div
                                className={`
                                    relative flex-1 rounded-t-3xl border-x border-t border-b-0 p-3 
                                    ${styles.bg} ${styles.border} ${styles.shadow} 
                                    backdrop-blur-md hover:shadow-xl transition-all 
                                    ${disableClick ? 'cursor-default' : 'cursor-pointer'} 
                                    flex flex-col
                                    ${podiumHeightClass}
                                `}
                                onClick={() => {
                                    if (disableClick) return;
                                    if (isDashboard) {
                                        navigate('/portal/leaderboard');
                                    } else {
                                        navigate(`/portal/users?highlightUserId=${tl.id}`);
                                    }
                                }}
                            >
                                {/* Rank Badge (Floating) */}
                                <div className={`self-center -mt-8 w-10 h-10 rounded-full ${styles.badge} text-white flex items-center justify-center font-black text-lg shadow-lg border-4 border-white dark:border-slate-900 z-50`}>
                                    #{actualRank + 1}
                                </div>

                                {/* User Info */}
                                <div className="text-center mt-2 mb-3">
                                    <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center text-xl font-bold bg-white dark:bg-black/20 shadow-inner ${styles.text} mb-1`}>
                                        {safeRender(tl.fullName || tl.email || '?').charAt(0).toUpperCase()}
                                    </div>
                                    <div className="font-extrabold text-sm truncate px-1">
                                        {safeRender(tl.fullName || 'Unknown')}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground opacity-80 uppercase tracking-wider font-bold">
                                        {Math.round(tl.score)} Pts
                                    </div>
                                </div>

                                {/* Detailed Stats Grid */}
                                <div className="space-y-2 flex-1">
                                    {/* 1. Riders & Leads */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-white/40 dark:bg-black/10 rounded-lg p-1.5 text-center">
                                            <div className="text-[9px] uppercase font-bold text-muted-foreground">Riders</div>
                                            <div className="font-black text-blue-600 text-sm">
                                                {tl.stats.activeRiders}<span className="text-[10px] text-muted-foreground">/{tl.stats.totalRiders}</span>
                                            </div>
                                        </div>
                                        <div className="bg-white/40 dark:bg-black/10 rounded-lg p-1.5 text-center">
                                            <div className="text-[9px] uppercase font-bold text-muted-foreground">Leads</div>
                                            <div className="font-black text-orange-600 text-sm">
                                                {tl.stats.leads}<span className="text-[10px] text-muted-foreground"> ({tl.stats.conversionRate}%)</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Collection Badge */}
                                    <div className="bg-green-50 dark:bg-green-900/10 rounded-lg p-1.5 text-center border border-green-100 dark:border-green-900/20">
                                        <div className="text-[9px] uppercase font-bold text-green-700 dark:text-green-400">Collection</div>
                                        <div className="font-black text-green-600 text-sm">
                                            ₹{(tl.stats.collection || 0).toLocaleString()}
                                        </div>
                                    </div>
                                </div>

                                {/* 2. Wallet Net */}
                                <div className="bg-white/40 dark:bg-black/10 rounded-lg p-2 flex justify-between items-center">
                                    <div className="text-[9px] uppercase font-bold text-muted-foreground text-left leading-tight">
                                        Net<br />Wallet
                                    </div>
                                    <div className="text-sm font-black text-right">
                                        <span className={`${tl.stats.wallet < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                                            {tl.stats.wallet >= 1000 || tl.stats.wallet <= -1000
                                                ? `${(tl.stats.wallet / 1000).toFixed(1)}k`
                                                : tl.stats.wallet}
                                        </span>
                                        <div className="text-[9px] font-medium opacity-70 text-foreground">
                                            Avg: ₹{tl.stats.avgWallet}
                                        </div>
                                    </div>
                                </div>

                                {/* 3. Wallet Split Visual */}
                                <div className="bg-white/40 dark:bg-black/10 rounded-lg p-2 space-y-1">
                                    <div className="flex justify-between text-[8px] font-bold uppercase text-muted-foreground">
                                        <span className="text-emerald-600">Pos: {(tl.stats.positiveWallet / 1000).toFixed(1)}k</span>
                                        <span className="text-red-500">Neg: {(Math.abs(tl.stats.negativeWallet) / 1000).toFixed(1)}k</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
                                        <div
                                            className="h-full bg-emerald-500"
                                            style={{ width: `${(tl.stats.positiveWallet / (tl.stats.positiveWallet + Math.abs(tl.stats.negativeWallet) || 1)) * 100}%` }}
                                        />
                                        <div
                                            className="h-full bg-red-500"
                                            style={{ width: `${(Math.abs(tl.stats.negativeWallet) / (tl.stats.positiveWallet + Math.abs(tl.stats.negativeWallet) || 1)) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Footer / Base Decoration */}
                            <div className="mt-2 border-t border-black/5 dark:border-white/5 pt-2">
                                <div className="flex justify-center text-[9px] text-muted-foreground font-bold uppercase">
                                    <span className="flex items-center gap-1">
                                        <Activity size={10} /> Activity Score: {tl.stats.activity}
                                    </span>
                                </div>
                            </div>

                            {/* Shine Effect */}
                            <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none rounded-t-3xl" />
                        </motion.div>
                    );
                })}
            </div>

            {/* Micro-animations for score updates - visual indicator */}
            <div className="mt-8 flex justify-center overflow-hidden h-1">
                <motion.div
                    initial={{ x: '-100%' }}
                    animate={{ x: '100%' }}
                    transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
                    className="w-1/3 h-full bg-gradient-to-r from-transparent via-primary/30 to-transparent"
                />
            </div>

            <p className="text-center text-[10px] text-muted-foreground mt-4 opacity-0 animate-in fade-in duration-1000 delay-500">
                Performance score based on active riders, lead conversions, wallet health, allotments & activity
            </p>
        </div>
    );
};

export default Leaderboard;
