import React, { useMemo } from 'react';
import { User, Rider, Lead } from '@/types';
import { Trophy, Crown, TrendingUp, Wallet, Users, Zap, ArrowRight, Star, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { safeRender } from '@/utils/safeRender';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/CustomTooltip';

// Leaderboard Component
interface LeaderboardProps {
    teamLeaders: User[];
    riders: Rider[];
    leads?: Lead[];
    collections?: Record<string, number>; // Map of TL ID -> Collection Amount
    action?: React.ReactNode;
    disableClick?: boolean;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ teamLeaders, riders, leads = [], collections = {}, action, disableClick = false }) => {
    const navigate = useNavigate();
    const location = useLocation();

    // AI Scoring Algorithm (Deeply Enhanced)
    const scoredTLs = useMemo(() => {
        const now = new Date();

        const result = teamLeaders.map(tl => {
            const tlRiders = riders.filter(r => r.teamLeaderId === tl.id);
            const activeCount = tlRiders.filter(r => r.status === 'active').length;
            const inactiveCount = tlRiders.filter(r => r.status === 'inactive').length;
            const churnCount = tlRiders.filter(r => r.status === 'deleted').length;

            // Rider Age (Loyalty) - Mean days since allotment for ACTIVE riders
            const riderAges = tlRiders
                .filter(r => r.status === 'active' && r.allotmentDate)
                .map(r => {
                    const start = new Date(r.allotmentDate!);
                    return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                });
            const avgRiderAge = riderAges.length > 0 ? riderAges.reduce((a, b) => a + b, 0) / riderAges.length : 0;

            // Wallet Stats
            const positiveWallet = tlRiders.filter(r => r.walletAmount > 0);
            const negativeWallet = tlRiders.filter(r => r.walletAmount < 0);
            const zeroWalletCount = tlRiders.filter(r => r.walletAmount === 0).length;

            const positiveSum = positiveWallet.reduce((sum, r) => sum + r.walletAmount, 0);
            const negativeSum = negativeWallet.reduce((sum, r) => sum + r.walletAmount, 0);

            // Leads
            const tlLeads = leads.filter(l => l.createdBy === tl.id);
            const convertedLeadsCount = tlLeads.filter(l => l.status === 'Convert').length;
            const notConvertedCount = tlLeads.filter(l => l.status === 'Not Convert').length;

            // Collection
            const collectionAmount = collections[tl.id] || 0;

            // --- ADVANCED WEIGHTED SCORING LOGIC ---
            let score = 0;

            // 1. Fleet Scale & Health (Baseline)
            score += activeCount * 20;                        // +20 per Active
            score -= inactiveCount * 15;                       // -15 per Inactive
            score -= churnCount * 30;                         // -30 per Deleted/Churn

            // 2. Financial Velocity (Collections & Wallet)
            score += Math.floor(collectionAmount / 1000) * 10; // +10 per 1k Coll.
            score += Math.floor(positiveSum / 1000) * 2;       // +2 per 1k Pos.
            score -= Math.abs(Math.floor(negativeSum / 1000)) * 12; // -12 per 1k Neg. (Higher Penalty)
            score -= zeroWalletCount * 5;                     // -5 per Zero balance (Inactivity)

            // 3. Growth Engine (Leads)
            score += convertedLeadsCount * 40;                // +40 per successful convert
            score -= notConvertedCount * 8;                   // -8 per failed convert

            // 4. Loyalty & Stability (Rider Age)
            score += Math.floor(avgRiderAge * 0.5);           // 0.5 pts per day of retention

            // Normalize Score (Min 0)
            score = Math.max(0, Math.round(score));

            // Trending Logic (Simulated for UI)
            const isTrending = score > 500 && (activeCount / tlRiders.length) > 0.85;

            return {
                id: tl.id,
                fullName: tl.fullName,
                email: tl.email,
                role: tl.role,
                score,
                isTrending,
                stats: {
                    activeRiders: activeCount,
                    totalRiders: tlRiders.length,
                    collection: collectionAmount,
                    convertedLeads: convertedLeadsCount,
                    leadsTotal: tlLeads.length,
                    positiveWallet: positiveSum,
                    negativeWallet: negativeSum,
                    efficiency: tlRiders.length > 0 ? Math.round((activeCount / tlRiders.length) * 100) : 0,
                    avgRiderAge: Math.round(avgRiderAge)
                }
            };
        }).sort((a, b) => b.score - a.score).slice(0, 3); // Get Top 3

        return result;
    }, [teamLeaders, riders, leads, collections]);

    const handleCardClick = () => {
        if (!disableClick && location.pathname.includes('admin')) {
            navigate('/portal/leaderboard');
        }
    };

    const podiumOrder = [1, 0, 2]; // Silver (2), Gold (1), Bronze (3) visual order

    return (
        <div className="bg-transparent border-0 rounded-none p-0 relative overflow-visible mt-16 mb-10">
            <div className="flex flex-col md:flex-row items-end justify-center gap-6 md:gap-10 min-h-[500px] md:min-h-[580px] px-4 md:px-12 pb-10">
                {podiumOrder.map((positionIndex) => {
                    const tl = scoredTLs[positionIndex];
                    if (!tl) return null;

                    const rank = positionIndex + 1;
                    const isFirst = rank === 1; // Gold
                    const isSecond = rank === 2; // Silver

                    // Premium Styling based on Rank
                    let cardBackground = '';
                    let heightClass = '';
                    let glowColor = '';
                    let metallicText = '';
                    let aiBadgeColor = '';

                    if (isFirst) {
                        cardBackground = 'bg-[#FFD700]/10 border-[#FFD700]/30';
                        heightClass = 'h-[460px] md:h-[560px] w-full md:w-[320px] z-20';
                        glowColor = 'shadow-[0_30px_80px_-15px_rgba(255,215,0,0.5)]';
                        metallicText = 'text-[#FFD700]';
                        aiBadgeColor = 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
                    } else if (isSecond) {
                        cardBackground = 'bg-[#C0C0C0]/10 border-[#C0C0C0]/30';
                        heightClass = 'h-[400px] md:h-[480px] w-full md:w-[280px] z-10';
                        glowColor = 'shadow-[0_20px_60px_-15px_rgba(192,192,192,0.4)]';
                        metallicText = 'text-[#E5E4E2]';
                        aiBadgeColor = 'bg-slate-400/20 text-slate-300 border-slate-400/30';
                    } else {
                        cardBackground = 'bg-[#CD7F32]/10 border-[#CD7F32]/30';
                        heightClass = 'h-[380px] md:h-[440px] w-full md:w-[280px] z-0';
                        glowColor = 'shadow-[0_20px_60px_-15px_rgba(205,127,50,0.4)]';
                        metallicText = 'text-[#CD7F32]';
                        aiBadgeColor = 'bg-orange-500/20 text-orange-400 border-orange-500/30';
                    }

                    return (
                        <motion.div
                            key={tl.id}
                            initial={{ opacity: 0, y: 80, scale: 0.85 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            whileHover={{ y: -20, scale: 1.05 }}
                            transition={{ delay: positionIndex * 0.2, duration: 0.8, type: 'spring', damping: 15 }}
                            onClick={handleCardClick}
                            className={`relative rounded-[2.8rem] p-[2px] flex flex-col justify-end cursor-pointer group ${heightClass} transition-all duration-500 ${glowColor}`}
                        >
                            {/* Animated Background Border */}
                            <div className="absolute inset-0 rounded-[2.8rem] bg-gradient-to-t from-white/25 via-white/5 to-transparent pointer-events-none" />

                            {/* Main Card Content (Glassmorphism) */}
                            <div className={`absolute inset-0 rounded-[2.7rem] backdrop-blur-[40px] border-t border-white/30 overflow-hidden flex flex-col items-center pt-14 pb-8 px-6 ${cardBackground}`}>

                                {/* Inner Glow */}
                                <div className="absolute top-0 inset-x-0 h-56 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />

                                {/* AI Pulse Indicator */}
                                <div className="absolute top-6 right-6 flex items-center gap-2 px-3 py-1 rounded-full bg-black/50 border border-white/10 backdrop-blur-xl">
                                    <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse shadow-[0_0_12px_rgba(129,140,248,1)]" />
                                    <span className="text-[10px] font-black tracking-[0.2em] text-indigo-100 uppercase">AI Live</span>
                                </div>

                                {/* Crown / Rank Icon - Raised to prevent clipping */}
                                <div className="absolute -top-14 scale-[1.4] transform transition-transform duration-700 group-hover:rotate-12 group-hover:scale-[1.5]">
                                    {isFirst ? (
                                        <Crown size={80} className="text-yellow-400 drop-shadow-[0_8px_25px_rgba(234,179,8,0.6)] fill-yellow-400/30" strokeWidth={1.5} />
                                    ) : (rank === 2 ? (
                                        <Trophy size={70} className="text-slate-300 drop-shadow-[0_8px_25px_rgba(229,228,226,0.4)] fill-slate-300/20" strokeWidth={1.5} />
                                    ) : (
                                        <Trophy size={64} className="text-orange-400 drop-shadow-[0_8px_25px_rgba(205,127,50,0.4)] fill-orange-400/20" strokeWidth={1.5} />
                                    ))}
                                </div>

                                {/* Avatar Section */}
                                <div className={`relative mb-8 mt-6 transition-all duration-700 group-hover:scale-115 ${isFirst ? 'scale-135' : 'scale-115'}`}>
                                    <div className={`w-28 h-28 rounded-full bg-gradient-to-br from-white/30 to-white/10 backdrop-blur-[60px] shadow-2xl flex items-center justify-center text-5xl font-black border-2 border-white/40 text-white`}>
                                        {tl.fullName ? tl.fullName.charAt(0).toUpperCase() : '?'}

                                        {/* Dynamic Pulse Ring around avatar */}
                                        <div className={`absolute inset-0 rounded-full border-4 border-white/20 animate-ping opacity-30`} />
                                    </div>

                                    <div className={`absolute -bottom-3 left-1/2 -translate-x-1/2 px-6 py-2 rounded-full text-[12px] font-black shadow-2xl uppercase tracking-[0.2em] border border-white/30 backdrop-blur-2xl ${aiBadgeColor}`}>
                                        RANK #{rank}
                                    </div>
                                </div>

                                {/* Name & Intelligence Score */}
                                <div className="text-center mt-4 mb-8 w-full z-10 px-2">
                                    <h3 className={`font-black text-3xl tracking-tighter mb-3 truncate px-2 ${metallicText} drop-shadow-2xl`}>
                                        {safeRender(tl.fullName)}
                                    </h3>

                                    <div className="flex flex-col items-center gap-2">
                                        <div className="inline-flex items-center gap-3 bg-white/10 border border-white/20 backdrop-blur-[40px] px-7 py-3 rounded-[1.5rem] shadow-2xl group-hover:bg-white/15 transition-all">
                                            <Sparkles size={22} className="text-indigo-400 animate-pulse" />
                                            <span className="text-2xl font-black tracking-tighter text-white italic">{tl.score.toLocaleString()}</span>
                                            <span className="text-[11px] font-black text-indigo-200/80 uppercase tracking-widest">Impact</span>
                                        </div>
                                        {tl.isTrending && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="flex items-center gap-2 text-[10px] font-black text-emerald-400 tracking-[0.25em] uppercase mt-2 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                                            >
                                                <Zap size={12} className="fill-emerald-400" /> Efficiency King
                                            </motion.div>
                                        )}
                                    </div>
                                </div>

                                {/* Premium Stats Module */}
                                <div className="grid grid-cols-2 gap-4 w-full mt-auto bg-black/30 backdrop-blur-[50px] rounded-[2rem] p-5 border border-white/15 shadow-2xl z-10 box-border group-hover:border-white/30 transition-all">
                                    <TooltipProvider delayDuration={0}>
                                        <Tooltip>
                                            <TooltipTrigger className="flex flex-col items-center gap-2 py-2 px-1 rounded-2xl hover:bg-white/10 transition-all w-full">
                                                <Users size={20} className="text-blue-400" strokeWidth={3} />
                                                <span className="text-sm font-black text-white">{tl.stats.activeRiders}</span>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="font-bold bg-slate-950 text-[11px] border-white/20 p-3 rounded-xl backdrop-blur-3xl shadow-2xl"><p>Fleet Scale (+20 pts/Active)</p></TooltipContent>
                                        </Tooltip>

                                        <Tooltip>
                                            <TooltipTrigger className="flex flex-col items-center gap-2 py-2 px-1 rounded-2xl hover:bg-white/10 transition-all w-full">
                                                <Wallet size={20} className="text-emerald-400" strokeWidth={3} />
                                                <span className="text-sm font-black text-white">₹{(tl.stats.collection / 1000).toFixed(1)}k</span>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="font-bold bg-slate-950 text-[11px] border-white/20 p-3 rounded-xl backdrop-blur-3xl shadow-2xl"><p>Collection Growth (+10 pts/k)</p></TooltipContent>
                                        </Tooltip>

                                        <Tooltip>
                                            <TooltipTrigger className="flex flex-col items-center gap-2 py-2 px-1 rounded-2xl hover:bg-white/10 transition-all w-full">
                                                <Zap size={20} className="text-yellow-400" strokeWidth={3} />
                                                <span className="text-sm font-black text-white">{tl.stats.convertedLeads}</span>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="font-bold bg-slate-950 text-[11px] border-white/20 p-3 rounded-xl backdrop-blur-3xl shadow-2xl"><p>Conversion Engine (+40 pts)</p></TooltipContent>
                                        </Tooltip>

                                        <Tooltip>
                                            <TooltipTrigger className="flex flex-col items-center gap-2 py-2 px-1 rounded-2xl hover:bg-white/10 transition-all w-full">
                                                <Star size={20} className="text-indigo-400" strokeWidth={3} />
                                                <span className="text-sm font-black text-white">{tl.stats.efficiency}%</span>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="font-bold bg-slate-950 text-[11px] border-white/20 p-3 rounded-xl backdrop-blur-3xl shadow-2xl"><p>Rider Age & Efficiency Rank</p></TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* Floating Live Indicator for the Section */}
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 md:translate-x-0 md:left-14 z-40">
                <div className="flex items-center gap-3 px-6 py-2.5 rounded-full bg-slate-950/90 backdrop-blur-2xl border border-white/20 shadow-[0_15px_30px_-5px_rgba(0,0,0,0.5)]">
                    <div className="relative">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                        <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-red-500 animate-ping opacity-50" />
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-[0.3em] text-white">Neural Realtime Sync</span>
                </div>
            </div>

            {/* View Full Leaderboard Action (Refined) */}
            {action && (
                <div className="mt-12 flex justify-center scale-110">
                    {action}
                </div>
            )}

            {(!action && !disableClick && location.pathname.includes('admin')) && (
                <div onClick={handleCardClick} className="absolute bottom-10 right-10 z-30">
                    <motion.button
                        whileHover={{ scale: 1.1, x: 5 }}
                        whileTap={{ scale: 0.95 }}
                        className="bg-indigo-600 hover:bg-indigo-500 backdrop-blur-3xl p-5 rounded-[2rem] text-white shadow-[0_20px_40px_-10px_rgba(79,70,229,0.5)] border border-white/30 transition-all flex items-center gap-4 font-black tracking-tight"
                    >
                        <span className="text-sm uppercase tracking-widest">Analyze Intelligence</span>
                        <ArrowRight size={24} />
                    </motion.button>
                </div>
            )}

            {scoredTLs.length === 0 && (
                <div className="col-span-3 text-center p-28 text-indigo-200/40 bg-indigo-950/30 rounded-[4rem] border-4 border-dashed border-indigo-500/30 flex flex-col items-center justify-center gap-8 backdrop-blur-2xl">
                    <Trophy size={80} className="opacity-10 animate-pulse text-indigo-400" />
                    <div className="space-y-2">
                        <p className="font-black text-2xl tracking-tighter uppercase italic">Neural Network Synchronizing</p>
                        <p className="text-xs font-bold opacity-70 tracking-widest text-indigo-300">Awaiting multi-agent synchronization data.</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Leaderboard;
