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

interface LeaderboardProps {
    teamLeaders: User[];
    riders: Rider[];
    leads?: Lead[];
    collections?: Record<string, number>;
    action?: React.ReactNode;
    disableClick?: boolean;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ teamLeaders, riders, leads = [], collections = {}, action, disableClick = false }) => {
    const navigate = useNavigate();
    const location = useLocation();

    const scoredTLs = useMemo(() => {
        const now = new Date();

        return teamLeaders.map(tl => {
            const tlRiders = riders.filter(r => r.teamLeaderId === tl.id || (r as any).team_leader_id === tl.id);
            const activeCount = tlRiders.filter(r => r.status === 'active').length;
            const inactiveCount = tlRiders.filter(r => r.status === 'inactive').length;
            const churnCount = tlRiders.filter(r => r.status === 'deleted').length;

            const riderAges = tlRiders
                .filter(r => r.status === 'active' && r.allotmentDate)
                .map(r => Math.floor((now.getTime() - new Date(r.allotmentDate!).getTime()) / 86400000));
            const avgRiderAge = riderAges.length > 0 ? riderAges.reduce((a, b) => a + b, 0) / riderAges.length : 0;

            const positiveWallet = tlRiders.filter(r => r.walletAmount > 0);
            const negativeWallet = tlRiders.filter(r => r.walletAmount < 0);
            const zeroWalletCount = tlRiders.filter(r => r.walletAmount === 0).length;
            const positiveSum = positiveWallet.reduce((s, r) => s + r.walletAmount, 0);
            const negativeSum = negativeWallet.reduce((s, r) => s + r.walletAmount, 0);

            const tlLeads = leads.filter(l => l.createdBy === tl.id || (l as any).created_by === tl.id);
            const convertedLeadsCount = tlLeads.filter(l => l.status === 'Convert').length;
            const notConvertedCount = tlLeads.filter(l => l.status === 'Not Convert').length;
            const conversionRate = tlLeads.length > 0 ? Math.round((convertedLeadsCount / tlLeads.length) * 100) : 0;

            const collectionAmount = collections[tl.id] || 0;

            let score = 0;
            score += activeCount * 20;
            score -= inactiveCount * 15;
            score -= churnCount * 30;
            score += Math.floor(collectionAmount / 1000) * 10;
            score += Math.floor(positiveSum / 1000) * 2;
            score -= Math.abs(Math.floor(negativeSum / 1000)) * 12;
            score -= zeroWalletCount * 5;
            score += convertedLeadsCount * 40;
            score -= notConvertedCount * 8;
            score += Math.floor(avgRiderAge * 0.5);
            score = Math.max(0, Math.round(score));

            const isTrending = score > 500 && tlRiders.length > 0 && (activeCount / tlRiders.length) > 0.85;

            return {
                id: tl.id,
                fullName: tl.fullName || (tl as any).full_name || 'Unknown',
                email: tl.email,
                role: tl.role,
                profilePicUrl: tl.profilePicUrl || (tl as any).profile_pic_url || null,
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
    }, [teamLeaders, riders, leads, collections]);

    const top3 = scoredTLs.slice(0, 3);

    const handleCardClick = () => {
        if (!disableClick && location.pathname.includes('admin')) {
            navigate('/portal/leaderboard');
        }
    };

    // Visual order: Silver (index 1) left, Gold (index 0) center, Bronze (index 2) right
    const podiumOrder = [1, 0, 2];

    const rankConfig = (rank: number) => {
        if (rank === 1) return {
            cardBg: 'bg-gradient-to-b from-yellow-500/25 via-yellow-900/20 to-slate-950/95',
            border: 'border-yellow-400/50',
            glow: 'shadow-[0_0_80px_-10px_rgba(255,200,0,0.5),0_30px_60px_-20px_rgba(255,200,0,0.3)]',
            nameColor: 'text-yellow-300',
            badgeBg: 'bg-yellow-500/30 border-yellow-400/50 text-yellow-200',
            height: 'min-h-[480px] md:min-h-[540px]',
            width: 'w-full md:w-[300px]',
            zIndex: 'z-20',
            ringColor: 'border-yellow-400/30',
            statsBg: 'bg-black/50 border-yellow-500/20',
        };
        if (rank === 2) return {
            cardBg: 'bg-gradient-to-b from-slate-400/20 via-slate-800/20 to-slate-950/95',
            border: 'border-slate-300/40',
            glow: 'shadow-[0_0_50px_-15px_rgba(200,200,220,0.4)]',
            nameColor: 'text-slate-200',
            badgeBg: 'bg-slate-400/25 border-slate-300/40 text-slate-200',
            height: 'min-h-[430px] md:min-h-[480px]',
            width: 'w-full md:w-[270px]',
            zIndex: 'z-10',
            ringColor: 'border-slate-300/20',
            statsBg: 'bg-black/50 border-slate-400/15',
        };
        return {
            cardBg: 'bg-gradient-to-b from-orange-600/20 via-orange-900/15 to-slate-950/95',
            border: 'border-orange-500/40',
            glow: 'shadow-[0_0_50px_-15px_rgba(200,100,50,0.4)]',
            nameColor: 'text-orange-300',
            badgeBg: 'bg-orange-500/25 border-orange-400/40 text-orange-200',
            height: 'min-h-[410px] md:min-h-[460px]',
            width: 'w-full md:w-[270px]',
            zIndex: 'z-0',
            ringColor: 'border-orange-400/20',
            statsBg: 'bg-black/50 border-orange-500/15',
        };
    };

    return (
        <div className="relative overflow-visible mt-16 mb-10">
            {/* Neural Realtime Sync Indicator */}
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 md:translate-x-0 md:left-14 z-40">
                <div className="flex items-center gap-3 px-5 py-2 rounded-full bg-slate-900 dark:bg-slate-950/90 backdrop-blur-2xl border border-white/20 shadow-lg">
                    <div className="relative">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <div className="absolute inset-0 w-2 h-2 rounded-full bg-red-500 animate-ping opacity-50" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white">Neural Realtime Sync</span>
                </div>
            </div>

            {/* Podium Cards — always dark background regardless of theme */}
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
                            whileHover={{ y: -10, scale: 1.02 }}
                            transition={{ delay: positionIndex * 0.15, duration: 0.7, type: 'spring', damping: 18 }}
                            onClick={handleCardClick}
                            // Force dark card background using explicit dark colors so text is ALWAYS visible regardless of app theme
                            className={`relative flex flex-col rounded-[2rem] border cursor-pointer
                                ${cfg.height} ${cfg.width} ${cfg.zIndex} ${cfg.glow} ${cfg.border}
                                transition-all duration-500`}
                        >
                            {/* Dark solid base — ensures card is always dark regardless of system theme */}
                            <div className="absolute inset-0 rounded-[2rem] bg-slate-950" />

                            {/* Card gradient overlay */}
                            <div className={`absolute inset-0 rounded-[2rem] ${cfg.cardBg}`} />

                            {/* Inner shimmer */}
                            <div className="absolute inset-x-0 top-0 h-28 rounded-t-[2rem] bg-gradient-to-b from-white/8 to-transparent pointer-events-none" />

                            {/* Crown/Trophy — floats above card */}
                            <div className={`absolute -top-10 left-1/2 -translate-x-1/2 z-20 ${isFirst ? 'scale-125' : 'scale-110'}`}>
                                {rank === 1 ? (
                                    <Crown size={68} className="text-yellow-400 drop-shadow-[0_0_20px_rgba(234,179,8,0.9)] fill-yellow-400/40" strokeWidth={1.5} />
                                ) : rank === 2 ? (
                                    <Trophy size={60} className="text-slate-300 drop-shadow-[0_0_15px_rgba(192,192,192,0.7)] fill-slate-300/20" strokeWidth={1.5} />
                                ) : (
                                    <Trophy size={56} className="text-orange-400 drop-shadow-[0_0_15px_rgba(205,127,50,0.7)] fill-orange-400/25" strokeWidth={1.5} />
                                )}
                            </div>

                            {/* AI Live Badge */}
                            <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 border border-white/10">
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse shadow-[0_0_8px_rgba(129,140,248,1)]" />
                                <span className="text-[9px] font-black tracking-[0.2em] text-indigo-200 uppercase">AI Live</span>
                            </div>

                            {/* Card Content — using fixed layout instead of mt-auto to keep stats grid consistent */}
                            <div className="relative z-10 flex flex-col items-center w-full h-full pt-12 pb-4 px-4">

                                {/* Avatar */}
                                <div className={`relative flex-shrink-0 ${isFirst ? 'mt-5' : 'mt-3'} mb-2`}>
                                    <div className={`absolute -inset-2 rounded-full border-2 animate-ping opacity-20 ${cfg.ringColor}`} />
                                    <div className="w-[72px] h-[72px] rounded-full overflow-hidden
                                        bg-gradient-to-br from-white/25 to-white/5 backdrop-blur-sm
                                        border-2 border-white/30 shadow-xl flex-shrink-0 flex items-center justify-center">
                                        {tl.profilePicUrl ? (
                                            <img
                                                src={tl.profilePicUrl}
                                                alt={tl.fullName}
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    // On broken image, fall back to initial letter
                                                    const target = e.currentTarget;
                                                    target.style.display = 'none';
                                                    const parent = target.parentElement;
                                                    if (parent) {
                                                        parent.innerHTML = `<span class="text-2xl font-black text-white">${tl.fullName ? tl.fullName.charAt(0).toUpperCase() : '?'}</span>`;
                                                    }
                                                }}
                                            />
                                        ) : (
                                            <span className="text-2xl font-black text-white">
                                                {tl.fullName ? tl.fullName.charAt(0).toUpperCase() : '?'}
                                            </span>
                                        )}
                                    </div>
                                    {/* Rank badge */}
                                    <div className={`absolute -bottom-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${cfg.badgeBg} shadow-lg whitespace-nowrap`}>
                                        #{rank}
                                    </div>
                                </div>

                                {/* Name & Email */}
                                <div className="text-center mt-5 mb-2 w-full flex-shrink-0">
                                    <h3 className={`font-black text-lg tracking-tight truncate px-1 ${cfg.nameColor} drop-shadow-lg`}>
                                        {safeRender(tl.fullName)}
                                    </h3>
                                    <p className="text-[9px] text-white/40 font-medium truncate">{tl.email}</p>
                                </div>

                                {/* AI Score */}
                                <div className="flex-shrink-0 flex items-center gap-2 bg-white/10 border border-white/15 px-4 py-2 rounded-2xl shadow-lg mb-2">
                                    <Sparkles size={14} className="text-indigo-400 animate-pulse flex-shrink-0" />
                                    <span className={`text-lg font-black tracking-tight ${cfg.nameColor}`}>{tl.score.toLocaleString()}</span>
                                    <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">pts</span>
                                </div>

                                {/* Trending badge */}
                                {tl.isTrending && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="flex-shrink-0 flex items-center gap-1.5 text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-2"
                                    >
                                        <TrendingUp size={10} className="fill-emerald-400 flex-shrink-0" /> Top Performer
                                    </motion.div>
                                )}

                                {/* Spacer to push stats grid consistently to bottom */}
                                <div className="flex-1" />

                                {/* Stats Grid — fixed height, always at bottom */}
                                <div className={`w-full flex-shrink-0 rounded-2xl p-3 border ${cfg.statsBg}`}>
                                    <TooltipProvider delayDuration={0}>
                                        <div className="grid grid-cols-2 gap-2">
                                            <Tooltip>
                                                <TooltipTrigger className="flex flex-col items-center gap-1 py-2 px-1 rounded-xl hover:bg-white/10 transition-all w-full">
                                                    <Users size={15} className="text-blue-400 flex-shrink-0" strokeWidth={2.5} />
                                                    <span className="text-xs font-black text-white leading-none">
                                                        {tl.stats.activeRiders}<span className="text-white/40 text-[9px]">/{tl.stats.totalRiders}</span>
                                                    </span>
                                                    <span className="text-[8px] text-white/50 uppercase font-bold tracking-wide">Active</span>
                                                </TooltipTrigger>
                                                <TooltipContent side="top" className="font-bold bg-slate-950 text-[11px] border-white/20 p-3 rounded-xl shadow-2xl">
                                                    <p>Active / Total Riders (+20 pts each)</p>
                                                    <p className="text-yellow-400 mt-1">{tl.stats.efficiency}% efficiency</p>
                                                </TooltipContent>
                                            </Tooltip>

                                            <Tooltip>
                                                <TooltipTrigger className="flex flex-col items-center gap-1 py-2 px-1 rounded-xl hover:bg-white/10 transition-all w-full">
                                                    <Wallet size={15} className="text-emerald-400 flex-shrink-0" strokeWidth={2.5} />
                                                    <span className="text-xs font-black text-white leading-none">
                                                        ₹{tl.stats.collection >= 1000 ? `${(tl.stats.collection / 1000).toFixed(1)}k` : tl.stats.collection}
                                                    </span>
                                                    <span className="text-[8px] text-white/50 uppercase font-bold tracking-wide">Collected</span>
                                                </TooltipTrigger>
                                                <TooltipContent side="top" className="font-bold bg-slate-950 text-[11px] border-white/20 p-3 rounded-xl shadow-2xl">
                                                    <p>Total Collection (+10 pts/₹1k)</p>
                                                    <p className="text-emerald-400 mt-1">Positive: ₹{tl.stats.positiveWallet.toLocaleString()}</p>
                                                    <p className="text-red-400">Negative: ₹{Math.abs(tl.stats.negativeWallet).toLocaleString()}</p>
                                                </TooltipContent>
                                            </Tooltip>

                                            <Tooltip>
                                                <TooltipTrigger className="flex flex-col items-center gap-1 py-2 px-1 rounded-xl hover:bg-white/10 transition-all w-full">
                                                    <Zap size={15} className="text-yellow-400 flex-shrink-0" strokeWidth={2.5} />
                                                    <span className="text-xs font-black text-white leading-none">
                                                        {tl.stats.convertedLeads}<span className="text-white/40 text-[9px]">/{tl.stats.leadsTotal}</span>
                                                    </span>
                                                    <span className="text-[8px] text-white/50 uppercase font-bold tracking-wide">Converted</span>
                                                </TooltipTrigger>
                                                <TooltipContent side="top" className="font-bold bg-slate-950 text-[11px] border-white/20 p-3 rounded-xl shadow-2xl">
                                                    <p>Lead Conversion (+40 pts each)</p>
                                                    <p className="text-yellow-400 mt-1">{tl.stats.conversionRate}% conversion rate</p>
                                                </TooltipContent>
                                            </Tooltip>

                                            <Tooltip>
                                                <TooltipTrigger className="flex flex-col items-center gap-1 py-2 px-1 rounded-xl hover:bg-white/10 transition-all w-full">
                                                    <Star size={15} className="text-indigo-400 flex-shrink-0" strokeWidth={2.5} />
                                                    <span className="text-xs font-black text-white leading-none">{tl.stats.efficiency}%</span>
                                                    <span className="text-[8px] text-white/50 uppercase font-bold tracking-wide">Fleet Health</span>
                                                </TooltipTrigger>
                                                <TooltipContent side="top" className="font-bold bg-slate-950 text-[11px] border-white/20 p-3 rounded-xl shadow-2xl">
                                                    <p>Fleet Efficiency Score</p>
                                                    <p className="text-indigo-400 mt-1">Avg Rider Age: {tl.stats.avgRiderAge}d</p>
                                                    <p className="text-red-400">Churn: {tl.stats.churnRiders} riders</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </div>
                                    </TooltipProvider>
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* Ranked List (4th place onwards) — theme-aware styling */}
            {scoredTLs.length > 3 && (
                <div className="mt-6 px-2 md:px-6 space-y-1.5">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 dark:text-white/30 text-center mb-3">Other Rankings</p>
                    {scoredTLs.slice(3).map((tl, idx) => (
                        <motion.div
                            key={tl.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="flex items-center gap-4
                                bg-white/80 hover:bg-white dark:bg-white/5 dark:hover:bg-white/10
                                border border-slate-200 dark:border-white/10
                                rounded-2xl px-5 py-3 transition-all cursor-default shadow-sm"
                        >
                            <span className="text-sm font-black text-slate-400 dark:text-white/30 w-6 text-center">{idx + 4}</span>
                            <div className="w-9 h-9 rounded-full overflow-hidden bg-slate-100 dark:bg-white/10 flex items-center justify-center text-sm font-black text-slate-700 dark:text-white border border-slate-200 dark:border-white/20 flex-shrink-0">
                                {tl.profilePicUrl ? (
                                    <img
                                        src={tl.profilePicUrl}
                                        alt={tl.fullName}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            const t = e.currentTarget;
                                            t.style.display = 'none';
                                            const p = t.parentElement;
                                            if (p) p.innerHTML = `<span class="text-sm font-black">${tl.fullName.charAt(0).toUpperCase()}</span>`;
                                        }}
                                    />
                                ) : (
                                    tl.fullName.charAt(0).toUpperCase()
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-black text-slate-800 dark:text-white truncate">{safeRender(tl.fullName)}</p>
                                <p className="text-[10px] text-slate-500 dark:text-white/40 truncate">{tl.email}</p>
                            </div>
                            <div className="flex items-center gap-4 flex-shrink-0">
                                <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-white/60">
                                    <Users size={12} className="text-blue-500 dark:text-blue-400" />
                                    <span className="font-bold">{tl.stats.activeRiders}/{tl.stats.totalRiders}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-white/60">
                                    <Zap size={12} className="text-yellow-500 dark:text-yellow-400" />
                                    <span className="font-bold">{tl.stats.conversionRate}%</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Sparkles size={12} className="text-indigo-500 dark:text-indigo-400" />
                                    <span className="text-xs font-black text-slate-800 dark:text-white">{tl.score.toLocaleString()}</span>
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
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex items-center gap-3 bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 px-8 py-4 rounded-2xl text-white shadow-xl border border-slate-700 dark:border-indigo-400/30 transition-all font-black tracking-tight"
                    >
                        <Target size={18} />
                        <span className="text-sm uppercase tracking-widest">Analyze Intelligence</span>
                        <ArrowRight size={18} />
                    </motion.button>
                </div>
            )}

            {action && <div className="mt-10 flex justify-center">{action}</div>}

            {/* Empty State */}
            {scoredTLs.length === 0 && (
                <div className="text-center p-20 bg-slate-100 dark:bg-indigo-950/30 rounded-[3rem] border-4 border-dashed border-slate-300 dark:border-indigo-500/30 flex flex-col items-center justify-center gap-6">
                    <Trophy size={64} className="opacity-20 animate-pulse text-slate-400 dark:text-indigo-400" />
                    <div className="space-y-2">
                        <p className="font-black text-xl tracking-tighter uppercase italic text-slate-600 dark:text-indigo-200/40">Neural Network Synchronizing</p>
                        <p className="text-xs font-bold text-slate-500 dark:text-indigo-300/70 tracking-widest">Awaiting multi-agent synchronization data.</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Leaderboard;
