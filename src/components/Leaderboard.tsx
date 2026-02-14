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
                    if (!tl) return null;

                    const rank = positionIndex + 1;
                    const isFirst = rank === 1; // Gold
                    const isSecond = rank === 2; // Silver

                    // Dynamic Styling based on Rank
                    let cardStyle = '';
                    let heightClass = '';
                    let badgeColor = '';
                    let ringColor = '';

                    if (isFirst) {
                        cardStyle = 'bg-gradient-to-br from-yellow-200 via-yellow-400 to-yellow-600 text-yellow-950 border-yellow-300 shadow-[0_0_50px_-10px_rgba(234,179,8,0.6)]';
                        heightClass = 'h-[400px] md:h-[460px] w-full md:w-[280px] z-20';
                        badgeColor = 'bg-yellow-500 text-white shadow-yellow-500/50';
                        ringColor = 'ring-yellow-400/50';
                    } else if (isSecond) {
                        cardStyle = 'bg-gradient-to-br from-slate-200 via-slate-300 to-slate-500 text-slate-900 border-slate-300 shadow-[0_0_40px_-10px_rgba(100,116,139,0.5)]';
                        heightClass = 'h-[360px] md:h-[400px] w-full md:w-[240px] z-10';
                        badgeColor = 'bg-slate-600 text-white shadow-slate-600/50';
                        ringColor = 'ring-slate-400/50';
                    } else {
                        cardStyle = 'bg-gradient-to-br from-orange-200 via-orange-300 to-orange-500 text-orange-950 border-orange-300 shadow-[0_0_40px_-10px_rgba(249,115,22,0.5)]';
                        heightClass = 'h-[340px] md:h-[380px] w-full md:w-[240px] z-0';
                        badgeColor = 'bg-orange-600 text-white shadow-orange-600/50';
                        ringColor = 'ring-orange-400/50';
                    }

                    return (
                        <motion.div
                            key={tl.id}
                            initial={{ opacity: 0, y: 50 }}
                            animate={{ opacity: 1, y: 0 }}
                            whileHover={{ y: -10, scale: 1.02 }}
                            transition={{ delay: positionIndex * 0.15, duration: 0.5, type: 'spring', stiffness: 100 }}
                            onClick={handleCardClick}
                            className={`relative rounded-[2rem] p-1 flex flex-col justify-end cursor-pointer group ${heightClass} transition-all duration-300`}
                        >
                            {/* Main Card Content */}
                            <div className={`absolute inset-0 rounded-[1.8rem] border-t-2 border-white/50 shadow-2xl overflow-hidden flex flex-col items-center pt-8 pb-4 px-4 ${cardStyle}`}>

                                {/* Shine Effect */}
                                <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

                                {/* Crown for #1 */}
                                {isFirst && (
                                    <div className="absolute -top-12 animate-[bounce_2.5s_infinite]">
                                        <Crown size={64} className="text-yellow-500 drop-shadow-2xl fill-yellow-300" strokeWidth={1.5} />
                                    </div>
                                )}

                                {/* Avatar Circle */}
                                <div className={`relative mb-4 transition-transform duration-500 group-hover:scale-110 ${isFirst ? 'scale-110 translate-y-2' : ''}`}>
                                    <div className={`w-20 h-20 rounded-full bg-white/90 backdrop-blur shadow-inner flex items-center justify-center text-3xl font-black border-4 border-white/60 text-slate-900 ${ringColor} ring-4 ring-offset-0`}>
                                        {tl.fullName ? tl.fullName.charAt(0).toUpperCase() : '?'}
                                    </div>
                                    <div className={`absolute -bottom-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-black shadow-lg uppercase tracking-wider border border-white/30 ${badgeColor}`}>
                                        Rank #{rank}
                                    </div>
                                </div>

                                {/* Name & Score */}
                                <div className="text-center mt-6 mb-4 w-full z-10">
                                    <h3 className="font-extrabold text-xl leading-tight truncate px-1 w-full drop-shadow-sm opacity-90">
                                        {safeRender(tl.fullName)}
                                    </h3>
                                    <div className="inline-flex items-center gap-1.5 bg-black/10 backdrop-blur-sm px-4 py-1.5 rounded-full mt-2 border border-black/5 shadow-inner">
                                        <Zap size={16} className="fill-current text-current" />
                                        <span className="text-base font-black tracking-wide">{tl.score.toLocaleString()} XP</span>
                                    </div>
                                </div>

                                {/* Mini Stats Grid (Podium Only) */}
                                <div className="grid grid-cols-2 gap-2 w-full mt-auto bg-white/10 backdrop-blur-md rounded-2xl p-2.5 border border-white/20 shadow-sm z-10 box-border">
                                    {/* Tooltips remain same but ensure correct imports if needed */}
                                    <TooltipProvider delayDuration={0}>
                                        <Tooltip>
                                            <TooltipTrigger className="flex flex-col items-center p-2 rounded-xl hover:bg-white/10 transition-colors">
                                                <Users size={18} className="mb-0.5 opacity-80" strokeWidth={2.5} />
                                                <span className="text-sm font-bold">{tl.stats.activeRiders}</span>
                                            </TooltipTrigger>
                                            <TooltipContent side="bottom" className="font-bold bg-slate-900 text-white border-0"><p>Active Riders (+10pts)</p></TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>

                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger className="flex flex-col items-center p-2 rounded-xl hover:bg-white/10 transition-colors">
                                                <Wallet size={18} className="mb-0.5 opacity-80" strokeWidth={2.5} />
                                                <span className="text-sm font-bold">{(tl.stats.collection / 1000).toFixed(1)}k</span>
                                            </TooltipTrigger>
                                            <TooltipContent side="bottom" className="font-bold bg-emerald-700 text-white border-0"><p>Collection (+5pts/1k)</p></TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>

                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger className="flex flex-col items-center p-2 rounded-xl hover:bg-white/10 transition-colors">
                                                <TrendingUp size={18} className="mb-0.5 opacity-80" strokeWidth={2.5} />
                                                <span className="text-sm font-bold">{tl.stats.convertedLeads}</span>
                                            </TooltipTrigger>
                                            <TooltipContent side="bottom" className="font-bold bg-blue-700 text-white border-0"><p>Converted Leads (+20pts)</p></TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>

                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger className="flex flex-col items-center p-2 rounded-xl hover:bg-white/10 transition-colors">
                                                <Star size={18} className="mb-0.5 opacity-80" strokeWidth={2.5} />
                                                <span className="text-sm font-bold">{tl.stats.efficiency}%</span>
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
