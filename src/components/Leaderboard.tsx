import React, { useMemo } from 'react';
import { User, Rider, Lead } from '@/types';
import { Trophy, Crown, TrendingUp, Wallet, Users, Zap, ArrowRight, Star } from 'lucide-react';
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

    // AI Scoring Algorithm
    const scoredTLs = useMemo(() => {
        const result = teamLeaders.map(tl => {
            const tlRiders = riders.filter(r => r.teamLeaderId === tl.id);
            const activeCount = tlRiders.filter(r => r.status === 'active').length;
            const inactiveCount = tlRiders.filter(r => r.status === 'inactive').length;

            // Wallet Stats
            // Wallet Stats
            const positiveWallet = tlRiders.reduce((sum, r) => r.walletAmount > 0 ? sum + r.walletAmount : sum, 0);
            const negativeWallet = tlRiders.reduce((sum, r) => r.walletAmount < 0 ? sum + r.walletAmount : sum, 0);
            // const totalWallet = positiveWallet + negativeWallet; 


            // Leads
            const tlLeads = leads.filter(l => l.createdBy === tl.id);
            const convertedLeads = tlLeads.filter(l => l.status === 'Convert').length;

            // Collection
            const collectionAmount = collections[tl.id] || 0;

            // --- WEIGHTED SCORING LOGIC ---
            let score = 0;
            score += activeCount * 10;                         // +10 per Active Rider
            score += Math.floor(collectionAmount / 1000) * 5;  // +5 per 1k Collected
            score += convertedLeads * 20;                      // +20 per Converted Lead
            score += Math.floor(positiveWallet / 1000) * 1;    // +1 per 1k Positive Wallet
            score -= inactiveCount * 5;                        // -5 per Inactive Rider
            score -= Math.abs(Math.floor(negativeWallet / 1000)) * 2; // -2 per 1k Negative Wallet

            // Normalize Score (Min 0)
            score = Math.max(0, Math.round(score));

            return {
                id: tl.id,
                fullName: tl.fullName,
                email: tl.email,
                role: tl.role,
                score,
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
            navigate('/admin/leaderboard');
        }
    };

    const podiumOrder = [1, 0, 2]; // Silver (2), Gold (1), Bronze (3) visual order

    return (
        <div className="bg-card/30 backdrop-blur-sm border-0 rounded-none p-0 relative overflow-visible mt-6">
            <div className="flex flex-col md:flex-row items-end justify-center gap-4 md:gap-6 min-h-[360px] md:min-h-[400px] px-2 md:px-8 pb-4">
                {podiumOrder.map((positionIndex) => {
                    const tl = scoredTLs[positionIndex];
                    // If less than 3 TLs, show placeholders or nothing
                    if (!tl) return null;

                    const rank = positionIndex + 1;
                    const isFirst = rank === 1; // Gold
                    const isSecond = rank === 2; // Silver
                    // const isThird = rank === 3; // Bronze

                    // Dynamic Styling based on Rank
                    let cardStyle = '';
                    let heightClass = '';
                    let badgeColor = '';
                    let glowColor = '';

                    if (isFirst) {
                        cardStyle = 'bg-gradient-to-b from-yellow-300 via-amber-200 to-yellow-500 text-yellow-950 border-yellow-400';
                        heightClass = 'h-[340px] md:h-[380px] w-full md:w-[260px] z-20';
                        badgeColor = 'bg-yellow-500 text-white shadow-yellow-500/50';
                        glowColor = 'shadow-[0_0_60px_-10px_rgba(234,179,8,0.6)]';
                    } else if (isSecond) {
                        cardStyle = 'bg-gradient-to-b from-slate-200 via-slate-300 to-slate-400 text-slate-800 border-slate-400';
                        heightClass = 'h-[300px] md:h-[320px] w-full md:w-[220px] z-10';
                        badgeColor = 'bg-slate-500 text-white shadow-slate-500/50';
                        glowColor = 'shadow-[0_0_40px_-12px_rgba(100,116,139,0.5)]';
                    } else {
                        cardStyle = 'bg-gradient-to-b from-orange-200 via-orange-300 to-orange-400 text-orange-900 border-orange-300';
                        heightClass = 'h-[270px] md:h-[280px] w-full md:w-[220px] z-10';
                        badgeColor = 'bg-orange-600 text-white shadow-orange-600/50';
                        glowColor = 'shadow-[0_0_40px_-12px_rgba(234,88,12,0.5)]';
                    }

                    return (
                        <motion.div
                            key={tl.id}
                            initial={{ opacity: 0, y: 50 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: positionIndex * 0.15, duration: 0.6, type: 'spring', stiffness: 100 }}
                            onClick={handleCardClick}
                            className={`relative rounded-3xl p-1 flex flex-col justify-end transition-all duration-300 hover:-translate-y-2 cursor-pointer group ${heightClass} ${glowColor}`}
                        >
                            {/* Main Card Content */}
                            <div className={`absolute inset-0 rounded-[22px] border-t-2 border-white/40 shadow-2xl overflow-hidden flex flex-col items-center pt-8 pb-4 px-4 ${cardStyle}`}>

                                {/* Crown for #1 */}
                                {isFirst && (
                                    <div className="absolute -top-10 animate-[bounce_2s_infinite]">
                                        <Crown size={56} className="text-yellow-500 drop-shadow-xl fill-yellow-400" strokeWidth={1.5} />
                                    </div>
                                )}

                                {/* Avatar Circle */}
                                <div className={`relative mb-3 transition-transform duration-500 group-hover:scale-105 ${isFirst ? 'scale-110 translate-y-2' : ''}`}>
                                    <div className="w-16 h-16 rounded-full bg-white/90 backdrop-blur shadow-inner flex items-center justify-center text-2xl font-black border-4 border-white/50 text-slate-900">
                                        {tl.fullName ? tl.fullName.charAt(0).toUpperCase() : '?'}
                                    </div>
                                    <div className={`absolute -bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-black shadow-lg uppercase tracking-wider border border-white/20 ${badgeColor}`}>
                                        Rank #{rank}
                                    </div>
                                </div>

                                {/* Name & Score */}
                                <div className="text-center mt-6 mb-2 w-full">
                                    <h3 className="font-extrabold text-lg leading-tight truncate px-1 w-full drop-shadow-sm">
                                        {safeRender(tl.fullName)}
                                    </h3>
                                    <div className="inline-flex items-center gap-1.5 bg-black/10 px-3 py-1 rounded-full mt-2 border border-black/5 shadow-inner">
                                        <Zap size={14} className="fill-current text-current" />
                                        <span className="text-sm font-black tracking-wide">{tl.score.toLocaleString()} XP</span>
                                    </div>
                                </div>

                                {/* Mini Stats Grid (Podium Only) */}
                                <div className="grid grid-cols-2 gap-2 w-full mt-auto bg-black/5 rounded-2xl p-2.5 border border-white/10 shadow-sm">
                                    <TooltipProvider delayDuration={0}>
                                        <Tooltip>
                                            <TooltipTrigger className="flex flex-col items-center p-1.5 rounded-lg hover:bg-black/5 transition-colors">
                                                <Users size={16} className="mb-0.5 opacity-80" strokeWidth={2.5} />
                                                <span className="text-xs font-bold">{tl.stats.activeRiders}</span>
                                            </TooltipTrigger>
                                            <TooltipContent side="bottom" className="font-bold bg-slate-900 text-white border-0"><p>Active Riders (+10pts)</p></TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>

                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger className="flex flex-col items-center p-1.5 rounded-lg hover:bg-black/5 transition-colors">
                                                <Wallet size={16} className="mb-0.5 opacity-80" strokeWidth={2.5} />
                                                <span className="text-xs font-bold">{(tl.stats.collection / 1000).toFixed(1)}k</span>
                                            </TooltipTrigger>
                                            <TooltipContent side="bottom" className="font-bold bg-emerald-700 text-white border-0"><p>Collection (+5pts/1k)</p></TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>

                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger className="flex flex-col items-center p-1.5 rounded-lg hover:bg-black/5 transition-colors">
                                                <TrendingUp size={16} className="mb-0.5 opacity-80" strokeWidth={2.5} />
                                                <span className="text-xs font-bold">{tl.stats.convertedLeads}</span>
                                            </TooltipTrigger>
                                            <TooltipContent side="bottom" className="font-bold bg-blue-700 text-white border-0"><p>Converted Leads (+20pts)</p></TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>

                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger className="flex flex-col items-center p-1.5 rounded-lg hover:bg-black/5 transition-colors">
                                                <Star size={16} className="mb-0.5 opacity-80" strokeWidth={2.5} />
                                                <span className="text-xs font-bold">{tl.stats.efficiency}%</span>
                                            </TooltipTrigger>
                                            <TooltipContent side="bottom" className="font-bold bg-indigo-700 text-white border-0"><p>Fleet Efficiency</p></TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* View Full Leaderboard Action */}
            {action}
            {(!action && !disableClick && location.pathname.includes('admin')) && (
                <div onClick={handleCardClick} className="absolute top-2 right-2 p-2 cursor-pointer group/arrow z-30">
                    <div className="bg-white/20 hover:bg-white/40 backdrop-blur-md p-2 rounded-full text-foreground transition-all duration-300 shadow-lg border border-white/20 group-hover/arrow:scale-110">
                        <ArrowRight size={20} className="group-hover/arrow:translate-x-0.5 transition-transform" />
                    </div>
                </div>
            )}

            {scoredTLs.length === 0 && (
                <div className="col-span-3 text-center p-12 text-muted-foreground bg-muted/20 rounded-xl border border-dashed flex flex-col items-center justify-center gap-4">
                    <Trophy size={48} className="text-muted opacity-20" />
                    <p className="font-medium">Not enough data to generate rankings yet.</p>
                </div>
            )}
        </div>
    );
};

export default Leaderboard;
