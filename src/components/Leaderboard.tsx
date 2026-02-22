import React, { useMemo } from 'react';
import { User, Rider, Lead } from '@/types';
import {
    Trophy, Crown, Zap, Sparkles, Users, Wallet,
    ArrowRight, Star, TrendingUp, Target
} from 'lucide-react';
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
            const tlRiders = riders.filter(r => r.teamLeaderId === tl.id || (r as any).team_leader_id === tl.id);
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
            const tlLeads = leads.filter(l => l.createdBy === tl.id || (l as any).created_by === tl.id);
            const convertedLeadsCount = tlLeads.filter(l => l.status === 'Convert').length;
            const notConvertedCount = tlLeads.filter(l => l.status === 'Not Convert').length;
            const conversionRate = tlLeads.length > 0 ? Math.round((convertedLeadsCount / tlLeads.length) * 100) : 0;

            // Collection
            const collectionAmount = collections[tl.id] || 0;

            // --- ADVANCED WEIGHTED SCORING LOGIC ---
            let score = 0;

            // 1. Fleet Scale & Health (Baseline)
            score += activeCount * 20;
            score -= inactiveCount * 15;
            score -= churnCount * 30;

            // 2. Financial Velocity (Collections & Wallet)
            score += Math.floor(collectionAmount / 1000) * 10;
            score += Math.floor(positiveSum / 1000) * 2;
            score -= Math.abs(Math.floor(negativeSum / 1000)) * 12;
            score -= zeroWalletCount * 5;

            // 3. Growth Engine (Leads)
            score += convertedLeadsCount * 40;
            score -= notConvertedCount * 8;

            // 4. Loyalty & Stability (Rider Age)
            score += Math.floor(avgRiderAge * 0.5);

            // Normalize Score (Min 0)
            score = Math.max(0, Math.round(score));

            // Trending Logic
            const isTrending = score > 500 && tlRiders.length > 0 && (activeCount / tlRiders.length) > 0.85;

            return {
                id: tl.id,
                fullName: tl.fullName || (tl as any).full_name || 'Unknown',
                email: tl.email,
                role: tl.role,
                score,
                isTrending,
                stats: {
                    activeRiders: activeCount,
                    inactiveRiders: inactiveCount,
                    churnRiders: churnCount,
                    totalRiders: tlRiders.length,
                    collection: collectionAmount,
                    convertedLeads: convertedLeadsCount,
                    leadsTotal: tlLeads.length,
                    conversionRate,
                    positiveWallet: positiveSum,
                    negativeWallet: negativeSum,
                    efficiency: tlRiders.length > 0 ? Math.round((activeCount / tlRiders.length) * 100) : 0,
                    avgRiderAge: Math.round(avgRiderAge)
                }
            };
        }).sort((a, b) => b.score - a.score);

        return result;
    }, [teamLeaders, riders, leads, collections]);

    const top3 = scoredTLs.slice(0, 3);

    const handleCardClick = () => {
        if (!disableClick && location.pathname.includes('admin')) {
            navigate('/portal/leaderboard');
        }
    };

    // Visual order: Silver (index 1), Gold (index 0), Bronze (index 2)
    const podiumOrder = [1, 0, 2];

    const rankConfig = (rank: number) => {
        if (rank === 1) return {
            cardBg: 'bg-gradient-to-b from-yellow-500/20 via-yellow-500/10 to-black/60',
            border: 'border-yellow-400/40',
            glow: 'shadow-[0_0_80px_-10px_rgba(255,200,0,0.5),0_30px_60px_-20px_rgba(255,200,0,0.3)]',
            textColor: 'text-yellow-300',
            badgeBg: 'bg-yellow-500/20 border-yellow-400/40 text-yellow-300',
            height: 'h-[520px] md:h-[580px]',
            width: 'w-full md:w-[320px]',
            zIndex: 'z-20',
            iconColor: 'text-yellow-400',
            ringColor: 'border-yellow-400/30',
        };
        if (rank === 2) return {
            cardBg: 'bg-gradient-to-b from-slate-300/15 via-slate-300/8 to-black/60',
            border: 'border-slate-300/30',
            glow: 'shadow-[0_0_50px_-15px_rgba(200,200,220,0.4),0_20px_40px_-15px_rgba(200,200,220,0.2)]',
            textColor: 'text-slate-200',
            badgeBg: 'bg-slate-400/20 border-slate-300/30 text-slate-200',
            height: 'h-[460px] md:h-[500px]',
            width: 'w-full md:w-[280px]',
            zIndex: 'z-10',
            iconColor: 'text-slate-300',
            ringColor: 'border-slate-300/20',
        };
        return {
            cardBg: 'bg-gradient-to-b from-orange-600/15 via-orange-600/8 to-black/60',
            border: 'border-orange-500/30',
            glow: 'shadow-[0_0_50px_-15px_rgba(200,100,50,0.4),0_20px_40px_-15px_rgba(200,100,50,0.2)]',
            textColor: 'text-orange-400',
            badgeBg: 'bg-orange-500/20 border-orange-400/30 text-orange-300',
            height: 'h-[440px] md:h-[480px]',
            width: 'w-full md:w-[280px]',
            zIndex: 'z-0',
            iconColor: 'text-orange-400',
            ringColor: 'border-orange-400/20',
        };
    };

    return (
        <div className="relative overflow-visible mt-16 mb-10">
            {/* Neural Realtime Sync Indicator */}
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 md:translate-x-0 md:left-14 z-40">
                <div className="flex items-center gap-3 px-6 py-2.5 rounded-full bg-slate-950/90 backdrop-blur-2xl border border-white/20 shadow-[0_15px_30px_-5px_rgba(0,0,0,0.5)]">
                    <div className="relative">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                        <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-red-500 animate-ping opacity-50" />
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-[0.3em] text-white">Neural Realtime Sync</span>
                </div>
            </div>

            {/* Podium Cards */}
            <div className="flex flex-col md:flex-row items-end justify-center gap-4 md:gap-6 px-4 pb-10 pt-4">
                {podiumOrder.map((positionIndex) => {
                    const tl = top3[positionIndex];
                    if (!tl) return null;

                    const rank = positionIndex + 1;
                    const cfg = rankConfig(rank);
                    const isFirst = rank === 1;

                    return (
                        <motion.div
                            key={tl.id}
                            initial={{ opacity: 0, y: 60, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            whileHover={{ y: -12, scale: 1.02 }}
                            transition={{ delay: positionIndex * 0.15, duration: 0.7, type: 'spring', damping: 18 }}
                            onClick={handleCardClick}
                            className={`relative flex flex-col rounded-[2.2rem] border cursor-pointer
                                ${cfg.height} ${cfg.width} ${cfg.zIndex} ${cfg.glow} ${cfg.border}
                                transition-all duration-500 overflow-visible`}
                        >
                            {/* Card Background */}
                            <div className={`absolute inset-0 rounded-[2.2rem] ${cfg.cardBg} backdrop-blur-[30px] overflow-hidden`}>
                                {/* Inner shimmer */}
                                <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
                            </div>

                            {/* Crown/Trophy - floats above card */}
                            <div className={`absolute -top-10 left-1/2 -translate-x-1/2 ${isFirst ? 'scale-125' : 'scale-110'} transition-transform duration-500 group-hover:rotate-6`}>
                                {rank === 1 ? (
                                    <Crown size={72} className="text-yellow-400 drop-shadow-[0_0_20px_rgba(234,179,8,0.8)] fill-yellow-400/30" strokeWidth={1.5} />
                                ) : rank === 2 ? (
                                    <Trophy size={64} className="text-slate-300 drop-shadow-[0_0_15px_rgba(192,192,192,0.6)] fill-slate-300/20" strokeWidth={1.5} />
                                ) : (
                                    <Trophy size={60} className="text-orange-400 drop-shadow-[0_0_15px_rgba(205,127,50,0.6)] fill-orange-400/20" strokeWidth={1.5} />
                                )}
                            </div>

                            {/* AI Live Badge */}
                            <div className="absolute top-5 right-5 z-20 flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/50 border border-white/10 backdrop-blur-xl">
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse shadow-[0_0_8px_rgba(129,140,248,1)]" />
                                <span className="text-[9px] font-black tracking-[0.2em] text-indigo-200 uppercase">AI Live</span>
                            </div>

                            {/* Card Content */}
                            <div className="relative flex flex-col items-center w-full h-full z-10 pt-14 pb-5 px-5">

                                {/* Avatar */}
                                <div className={`relative flex-shrink-0 mb-3 ${isFirst ? 'mt-4' : 'mt-2'}`}>
                                    {/* Pulse ring */}
                                    <div className={`absolute -inset-2 rounded-full border-2 animate-ping opacity-20 ${cfg.ringColor}`} />
                                    <div className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl font-black text-white
                                        bg-gradient-to-br from-white/25 to-white/5 backdrop-blur-[30px]
                                        border-2 ${cfg.border} shadow-2xl`}>
                                        {tl.fullName ? tl.fullName.charAt(0).toUpperCase() : '?'}
                                    </div>
                                    {/* Rank badge below avatar */}
                                    <div className={`absolute -bottom-3 left-1/2 -translate-x-1/2 px-4 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${cfg.badgeBg} shadow-lg whitespace-nowrap`}>
                                        #{rank}
                                    </div>
                                </div>

                                {/* Name */}
                                <div className="text-center mt-5 mb-2 w-full">
                                    <h3 className={`font-black text-xl tracking-tight truncate px-2 ${cfg.textColor} drop-shadow-lg`}>
                                        {safeRender(tl.fullName)}
                                    </h3>
                                    <p className="text-[10px] text-white/40 font-semibold truncate">{tl.email}</p>
                                </div>

                                {/* AI Score Badge */}
                                <div className="flex items-center gap-2 bg-white/10 border border-white/20 backdrop-blur-[40px] px-5 py-2 rounded-2xl shadow-xl mb-3">
                                    <Sparkles size={16} className="text-indigo-400 animate-pulse flex-shrink-0" />
                                    <span className={`text-xl font-black tracking-tight ${cfg.textColor}`}>{tl.score.toLocaleString()}</span>
                                    <span className="text-[9px] font-black text-white/50 uppercase tracking-widest">pts</span>
                                </div>

                                {/* Trending */}
                                {tl.isTrending && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="flex items-center gap-1.5 text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-2"
                                    >
                                        <TrendingUp size={11} className="fill-emerald-400" /> Top Performer
                                    </motion.div>
                                )}

                                {/* Stats Grid */}
                                <div className="grid grid-cols-2 gap-2 w-full mt-auto bg-black/40 backdrop-blur-[40px] rounded-2xl p-3 border border-white/10">
                                    <TooltipProvider delayDuration={0}>
                                        <Tooltip>
                                            <TooltipTrigger className="flex flex-col items-center gap-1 py-2 px-1 rounded-xl hover:bg-white/10 transition-all w-full">
                                                <Users size={16} className="text-blue-400" strokeWidth={2.5} />
                                                <span className="text-xs font-black text-white">{tl.stats.activeRiders}<span className="text-white/40 text-[9px]">/{tl.stats.totalRiders}</span></span>
                                                <span className="text-[8px] text-white/40 uppercase font-bold tracking-wide">Active</span>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="font-bold bg-slate-950 text-[11px] border-white/20 p-3 rounded-xl shadow-2xl">
                                                <p>Active / Total Riders (+20 pts each)</p>
                                                <p className="text-yellow-400 mt-1">{tl.stats.efficiency}% efficiency</p>
                                            </TooltipContent>
                                        </Tooltip>

                                        <Tooltip>
                                            <TooltipTrigger className="flex flex-col items-center gap-1 py-2 px-1 rounded-xl hover:bg-white/10 transition-all w-full">
                                                <Wallet size={16} className="text-emerald-400" strokeWidth={2.5} />
                                                <span className="text-xs font-black text-white">₹{tl.stats.collection >= 1000 ? `${(tl.stats.collection / 1000).toFixed(1)}k` : tl.stats.collection}</span>
                                                <span className="text-[8px] text-white/40 uppercase font-bold tracking-wide">Collected</span>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="font-bold bg-slate-950 text-[11px] border-white/20 p-3 rounded-xl shadow-2xl">
                                                <p>Total Collection (+10 pts/₹1k)</p>
                                                <p className="text-emerald-400 mt-1">Positive Wallet: ₹{tl.stats.positiveWallet.toLocaleString()}</p>
                                                <p className="text-red-400">Negative Wallet: ₹{Math.abs(tl.stats.negativeWallet).toLocaleString()}</p>
                                            </TooltipContent>
                                        </Tooltip>

                                        <Tooltip>
                                            <TooltipTrigger className="flex flex-col items-center gap-1 py-2 px-1 rounded-xl hover:bg-white/10 transition-all w-full">
                                                <Zap size={16} className="text-yellow-400" strokeWidth={2.5} />
                                                <span className="text-xs font-black text-white">{tl.stats.convertedLeads}<span className="text-white/40 text-[9px]">/{tl.stats.leadsTotal}</span></span>
                                                <span className="text-[8px] text-white/40 uppercase font-bold tracking-wide">Converted</span>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="font-bold bg-slate-950 text-[11px] border-white/20 p-3 rounded-xl shadow-2xl">
                                                <p>Lead Conversion (+40 pts each)</p>
                                                <p className="text-yellow-400 mt-1">{tl.stats.conversionRate}% conversion rate</p>
                                            </TooltipContent>
                                        </Tooltip>

                                        <Tooltip>
                                            <TooltipTrigger className="flex flex-col items-center gap-1 py-2 px-1 rounded-xl hover:bg-white/10 transition-all w-full">
                                                <Star size={16} className="text-indigo-400" strokeWidth={2.5} />
                                                <span className="text-xs font-black text-white">{tl.stats.efficiency}%</span>
                                                <span className="text-[8px] text-white/40 uppercase font-bold tracking-wide">Fleet Health</span>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="font-bold bg-slate-950 text-[11px] border-white/20 p-3 rounded-xl shadow-2xl">
                                                <p>Fleet Efficiency Score</p>
                                                <p className="text-indigo-400 mt-1">Avg Rider Age: {tl.stats.avgRiderAge}d</p>
                                                <p className="text-red-400">Churn: {tl.stats.churnRiders} riders</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* Rest of Ranked List (4+) */}
            {scoredTLs.length > 3 && (
                <div className="mt-8 px-2 md:px-6 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 text-center mb-4">Other Rankings</p>
                    {scoredTLs.slice(3).map((tl, idx) => (
                        <motion.div
                            key={tl.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="flex items-center gap-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl px-5 py-3 transition-all cursor-default"
                        >
                            <span className="text-sm font-black text-white/30 w-6 text-center">#{idx + 4}</span>
                            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-base font-black text-white border border-white/20 flex-shrink-0">
                                {tl.fullName.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-black text-white truncate">{safeRender(tl.fullName)}</p>
                                <p className="text-[10px] text-white/40 truncate">{tl.email}</p>
                            </div>
                            <div className="flex items-center gap-4 flex-shrink-0">
                                <div className="flex items-center gap-1.5 text-xs text-white/60">
                                    <Users size={12} className="text-blue-400" />
                                    <span className="font-bold">{tl.stats.activeRiders}/{tl.stats.totalRiders}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-white/60">
                                    <Zap size={12} className="text-yellow-400" />
                                    <span className="font-bold">{tl.stats.conversionRate}%</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Sparkles size={12} className="text-indigo-400" />
                                    <span className="text-xs font-black text-white">{tl.score.toLocaleString()}</span>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Analyze Button */}
            {(!action && !disableClick && location.pathname.includes('admin')) && (
                <div onClick={handleCardClick} className="mt-10 flex justify-center">
                    <motion.button
                        whileHover={{ scale: 1.05, x: 5 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex items-center gap-3 bg-indigo-600 hover:bg-indigo-500 px-8 py-4 rounded-2xl text-white shadow-[0_20px_40px_-10px_rgba(79,70,229,0.5)] border border-indigo-400/30 transition-all font-black tracking-tight"
                    >
                        <Target size={20} />
                        <span className="text-sm uppercase tracking-widest">Analyze Intelligence</span>
                        <ArrowRight size={20} className="group-hover:translate-x-1" />
                    </motion.button>
                </div>
            )}

            {action && (
                <div className="mt-10 flex justify-center">{action}</div>
            )}

            {/* Empty State */}
            {scoredTLs.length === 0 && (
                <div className="text-center p-24 text-indigo-200/40 bg-indigo-950/30 rounded-[3rem] border-4 border-dashed border-indigo-500/30 flex flex-col items-center justify-center gap-6 backdrop-blur-2xl">
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
