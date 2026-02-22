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

    // AI Scoring Algorithm (Enhanced)
    const scoredTLs = useMemo(() => {
        const result = teamLeaders.map(tl => {
            const tlRiders = riders.filter(r => r.teamLeaderId === tl.id);
            const activeCount = tlRiders.filter(r => r.status === 'active').length;
            const inactiveCount = tlRiders.filter(r => r.status === 'inactive').length;

            // Wallet Stats
            const positiveWallet = tlRiders.reduce((sum, r) => r.walletAmount > 0 ? sum + r.walletAmount : sum, 0);
            const negativeWallet = tlRiders.reduce((sum, r) => r.walletAmount < 0 ? sum + r.walletAmount : sum, 0);

            // Leads
            const tlLeads = leads.filter(l => l.createdBy === tl.id);
            const convertedLeads = tlLeads.filter(l => l.status === 'Convert').length;

            // Collection
            const collectionAmount = collections[tl.id] || 0;

            // --- WEIGHTED SCORING LOGIC ---
            let score = 0;
            score += activeCount * 12;                         // +12 per Active Rider
            score += Math.floor(collectionAmount / 1000) * 8;  // +8 per 1k Collected
            score += convertedLeads * 25;                      // +25 per Converted Lead
            score += Math.floor(positiveWallet / 1000) * 2;    // +2 per 1k Positive Wallet
            score -= inactiveCount * 10;                       // -10 per Inactive Rider
            score -= Math.abs(Math.floor(negativeWallet / 1000)) * 5; // -5 per 1k Negative Wallet

            // Normalize Score (Min 0)
            score = Math.max(0, Math.round(score));

            // Trending Logic (Simulated for UI)
            const isTrending = score > 150 && (activeCount / tlRiders.length) > 0.8;

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
                    convertedLeads,
                    leadsTotal: tlLeads.length,
                    positiveWallet,
                    negativeWallet,
                    efficiency: tlRiders.length > 0 ? Math.round((activeCount / tlRiders.length) * 100) : 0
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
        <div className="bg-transparent border-0 rounded-none p-0 relative overflow-visible mt-10 mb-6">
            <div className="flex flex-col md:flex-row items-end justify-center gap-6 md:gap-8 min-h-[420px] md:min-h-[480px] px-4 md:px-12 pb-6">
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
                        heightClass = 'h-[420px] md:h-[500px] w-full md:w-[300px] z-20';
                        glowColor = 'shadow-[0_20px_60px_-15px_rgba(255,215,0,0.4)]';
                        metallicText = 'text-[#FFD700]';
                        aiBadgeColor = 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
                    } else if (isSecond) {
                        cardBackground = 'bg-[#C0C0C0]/10 border-[#C0C0C0]/30';
                        heightClass = 'h-[380px] md:h-[440px] w-full md:w-[260px] z-10';
                        glowColor = 'shadow-[0_15px_50px_-15px_rgba(192,192,192,0.3)]';
                        metallicText = 'text-[#E5E4E2]';
                        aiBadgeColor = 'bg-slate-400/20 text-slate-300 border-slate-400/30';
                    } else {
                        cardBackground = 'bg-[#CD7F32]/10 border-[#CD7F32]/30';
                        heightClass = 'h-[360px] md:h-[420px] w-full md:w-[260px] z-0';
                        glowColor = 'shadow-[0_15px_50px_-15px_rgba(205,127,50,0.3)]';
                        metallicText = 'text-[#CD7F32]';
                        aiBadgeColor = 'bg-orange-500/20 text-orange-400 border-orange-500/30';
                    }

                    return (
                        <motion.div
                            key={tl.id}
                            initial={{ opacity: 0, y: 60, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            whileHover={{ y: -15, scale: 1.05 }}
                            transition={{ delay: positionIndex * 0.2, duration: 0.6, type: 'spring', damping: 15 }}
                            onClick={handleCardClick}
                            className={`relative rounded-[2.5rem] p-[2px] flex flex-col justify-end cursor-pointer group ${heightClass} transition-all duration-500 ${glowColor}`}
                        >
                            {/* Animated Background Border */}
                            <div className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-t from-white/20 via-white/5 to-transparent pointer-events-none" />

                            {/* Main Card Content (Glassmorphism) */}
                            <div className={`absolute inset-0 rounded-[2.4rem] backdrop-blur-2xl border-t border-white/20 overflow-hidden flex flex-col items-center pt-10 pb-6 px-5 ${cardBackground}`}>

                                {/* Inner Glow */}
                                <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />

                                {/* AI Pulse Indicator */}
                                <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/40 border border-white/10 backdrop-blur-md">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse shadow-[0_0_8px_rgba(129,140,248,0.8)]" />
                                    <span className="text-[10px] font-black tracking-widest text-indigo-200 uppercase">AI Live</span>
                                </div>

                                {/* Crown / Rank Icon */}
                                <div className="absolute -top-10 scale-125 transform transition-transform duration-700 group-hover:rotate-6">
                                    {isFirst ? (
                                        <Crown size={72} className="text-yellow-400 drop-shadow-[0_5px_15px_rgba(234,179,8,0.5)] fill-yellow-400/20" strokeWidth={1.5} />
                                    ) : (rank === 2 ? (
                                        <Trophy size={64} className="text-slate-300 drop-shadow-[0_5px_15px_rgba(229,228,226,0.3)] fill-slate-300/10" strokeWidth={1.5} />
                                    ) : (
                                        <Trophy size={56} className="text-orange-400 drop-shadow-[0_5px_15px_rgba(205,127,50,0.3)] fill-orange-400/10" strokeWidth={1.5} />
                                    ))}
                                </div>

                                {/* Avatar Section */}
                                <div className={`relative mb-6 mt-4 transition-all duration-700 group-hover:scale-110 ${isFirst ? 'scale-125' : 'scale-110'}`}>
                                    <div className={`w-24 h-24 rounded-full bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-3xl shadow-2xl flex items-center justify-center text-4xl font-black border-2 border-white/30 text-white`}>
                                        {tl.fullName ? tl.fullName.charAt(0).toUpperCase() : '?'}

                                        {/* Dynamic Pulse Ring around avatar */}
                                        <div className={`absolute inset-0 rounded-full border-2 border-white/20 animate-ping opacity-20`} />
                                    </div>

                                    <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 px-5 py-1.5 rounded-full text-[11px] font-black shadow-xl uppercase tracking-[0.15em] border border-white/20 backdrop-blur-xl ${aiBadgeColor}`}>
                                        RANK #{rank}
                                    </div>
                                </div>

                                {/* Name & Intelligence Score */}
                                <div className="text-center mt-2 mb-6 w-full z-10 px-2">
                                    <h3 className={`font-black text-2xl tracking-tighter mb-2 truncate ${metallicText} drop-shadow-lg`}>
                                        {safeRender(tl.fullName)}
                                    </h3>

                                    <div className="flex flex-col items-center gap-1">
                                        <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 backdrop-blur-2xl px-5 py-2 rounded-2xl shadow-2xl group-hover:bg-white/10 transition-colors">
                                            <Sparkles size={18} className="text-indigo-400 animate-pulse" />
                                            <span className="text-xl font-black tracking-tight text-white italic">{tl.score.toLocaleString()}</span>
                                            <span className="text-[10px] font-bold text-indigo-200/60 uppercase">Impact</span>
                                        </div>
                                        {tl.isTrending && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="flex items-center gap-1 text-[9px] font-black text-emerald-400 tracking-widest uppercase mt-1"
                                            >
                                                <TrendingUp size={10} /> Efficiency King
                                            </motion.div>
                                        )}
                                    </div>
                                </div>

                                {/* Premium Stats Module */}
                                <div className="grid grid-cols-2 gap-3 w-full mt-auto bg-black/20 backdrop-blur-3xl rounded-[1.8rem] p-4 border border-white/10 shadow-2xl z-10 box-border group-hover:border-white/20 transition-all">
                                    <TooltipProvider delayDuration={0}>
                                        <Tooltip>
                                            <TooltipTrigger className="flex flex-col items-center gap-1.5 py-1 px-2 rounded-2xl hover:bg-white/5 transition-all">
                                                <Users size={18} className="text-blue-400" strokeWidth={2.5} />
                                                <span className="text-xs font-black text-white">{tl.stats.activeRiders}</span>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="font-bold bg-slate-900/90 text-[10px] border-white/10 backdrop-blur-xl"><p>Fleet Scale (+12 pts)</p></TooltipContent>
                                        </Tooltip>

                                        <Tooltip>
                                            <TooltipTrigger className="flex flex-col items-center gap-1.5 py-1 px-2 rounded-2xl hover:bg-white/5 transition-all">
                                                <Wallet size={18} className="text-emerald-400" strokeWidth={2.5} />
                                                <span className="text-xs font-black text-white">₹{(tl.stats.collection / 1000).toFixed(1)}k</span>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="font-bold bg-slate-900/90 text-[10px] border-white/10 backdrop-blur-xl"><p>Collection Velocity (+8 pts/k)</p></TooltipContent>
                                        </Tooltip>

                                        <Tooltip>
                                            <TooltipTrigger className="flex flex-col items-center gap-1.5 py-1 px-2 rounded-2xl hover:bg-white/5 transition-all">
                                                <Zap size={18} className="text-yellow-400" strokeWidth={2.5} />
                                                <span className="text-xs font-black text-white">{tl.stats.convertedLeads}</span>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="font-bold bg-slate-900/90 text-[10px] border-white/10 backdrop-blur-xl"><p>Growth Conversion (+25 pts)</p></TooltipContent>
                                        </Tooltip>

                                        <Tooltip>
                                            <TooltipTrigger className="flex flex-col items-center gap-1.5 py-1 px-2 rounded-2xl hover:bg-white/5 transition-all">
                                                <Star size={18} className="text-indigo-400" strokeWidth={2.5} />
                                                <span className="text-xs font-black text-white">{tl.stats.efficiency}%</span>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="font-bold bg-slate-900/90 text-[10px] border-white/10 backdrop-blur-xl"><p>Fleet Health Index</p></TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* Floating Live Indicator for the Section */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 md:translate-x-0 md:left-12 z-40">
                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-xl border border-white/20 shadow-2xl">
                    <div className="relative">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <div className="absolute inset-0 w-2 h-2 rounded-full bg-red-500 animate-ping opacity-40" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Global Realtime Feed</span>
                </div>
            </div>

            {/* View Full Leaderboard Action (Refined) */}
            {action && (
                <div className="mt-8 flex justify-center scale-110">
                    {action}
                </div>
            )}

            {(!action && !disableClick && location.pathname.includes('admin')) && (
                <div onClick={handleCardClick} className="absolute bottom-8 right-8 z-30">
                    <motion.button
                        whileHover={{ scale: 1.1, x: 5 }}
                        whileTap={{ scale: 0.9 }}
                        className="bg-indigo-600/90 hover:bg-indigo-600 backdrop-blur-2xl p-4 rounded-[1.5rem] text-white shadow-[0_15px_30px_-10px_rgba(79,70,229,0.5)] border border-white/20 transition-all flex items-center gap-3 font-black tracking-tight"
                    >
                        <span>Analyze rankings</span>
                        <ArrowRight size={22} />
                    </motion.button>
                </div>
            )}

            {scoredTLs.length === 0 && (
                <div className="col-span-3 text-center p-20 text-indigo-200/40 bg-indigo-950/20 rounded-[3rem] border-2 border-dashed border-indigo-500/20 flex flex-col items-center justify-center gap-6 backdrop-blur-md">
                    <Trophy size={64} className="opacity-10 animate-pulse" />
                    <div className="space-y-1">
                        <p className="font-black text-xl tracking-tighter uppercase italic">Neural Engine Initializing</p>
                        <p className="text-xs font-bold opacity-60">Not enough synchronization data to generate AI rankings.</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Leaderboard;
