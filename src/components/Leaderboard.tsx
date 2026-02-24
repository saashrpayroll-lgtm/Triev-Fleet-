import React, { useMemo } from 'react';
import { User, Rider, Lead } from '../types';
import {
    Trophy, Crown, Zap, Sparkles, Users, Wallet,
    ArrowRight, TrendingUp, Target, TrendingDown, PlusCircle, Activity, AlertTriangle
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { safeRender } from '../utils/safeRender';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/CustomTooltip';
import { calculateAIScore, PerformancePeriod } from '../utils/performance';

interface LeaderboardProps {
    teamLeaders: User[];
    riders: Rider[];
    leads?: Lead[];
    collections?: Record<string, number>;
    action?: React.ReactNode;
    disableClick?: boolean;
    period?: PerformancePeriod;
}

const Leaderboard: React.FC<LeaderboardProps> = ({
    teamLeaders,
    riders,
    leads = [],
    collections = {},
    action,
    disableClick = false,
    period
}) => {
    const navigate = useNavigate();
    const location = useLocation();

    const scoredTLs = useMemo(() => {
        return teamLeaders.map(tl => {
            const tlCollection = collections[tl.id] || 0;
            const metrics = calculateAIScore(tl, riders, leads, tlCollection, period);

            return {
                ...tl,
                fullName: tl.fullName || (tl as any).full_name || 'Unknown',
                email: tl.email,
                score: metrics.score,
                isTrending: metrics.isTrending,
                stats: metrics
            };
        }).sort((a, b) => b.score - a.score);
    }, [teamLeaders, riders, leads, collections, period]);

    const top3 = scoredTLs.slice(0, 3);

    const handleCardClick = () => {
        if (!disableClick && location.pathname.includes('admin')) {
            navigate('/portal/leaderboard');
        }
    };


    const rankConfig = (rank: number) => {
        const bronzeHeight = 'min-h-[550px] h-auto pb-2';
        const silverHeight = 'min-h-[590px] h-auto pb-2';
        const goldHeight = 'min-h-[640px] h-auto pb-2';
        const uniformWidth = 'md:w-[320px] w-full';

        if (rank === 1) return {
            cardBg: 'bg-gradient-to-b from-yellow-500/35 via-yellow-900/25 to-slate-950/98',
            border: 'border-yellow-400/70 shadow-[0_0_20px_rgba(234,179,8,0.4)]',
            glow: 'shadow-[0_0_120px_-30px_rgba(255,200,0,0.5),0_40px_80px_-30px_rgba(255,200,0,0.25)]',
            nameColor: 'text-yellow-200 font-extrabold',
            badgeBg: 'bg-yellow-500 border-yellow-400 text-black',
            height: goldHeight,
            width: uniformWidth,
            zIndex: 'z-30',
            ringColor: 'border-yellow-400/50',
            statsBg: 'bg-black/40 border-yellow-500/20 backdrop-blur-xl',
        };
        if (rank === 2) return {
            cardBg: 'bg-gradient-to-b from-slate-400/30 via-slate-800/25 to-slate-950/98',
            border: 'border-slate-300/60 shadow-[0_0_20px_rgba(200,200,220,0.25)]',
            glow: 'shadow-[0_0_80px_-30px_rgba(200,200,220,0.4)]',
            nameColor: 'text-white font-extrabold',
            badgeBg: 'bg-slate-500 border-slate-400 text-white',
            height: silverHeight,
            width: uniformWidth,
            zIndex: 'z-20',
            ringColor: 'border-slate-300/40',
            statsBg: 'bg-black/40 border-slate-400/15 backdrop-blur-xl',
        };
        return {
            cardBg: 'bg-gradient-to-b from-orange-600/30 via-orange-900/20 to-slate-950/98',
            border: 'border-orange-500/60 shadow-[0_0_20px_rgba(205,127,50,0.25)]',
            glow: 'shadow-[0_0_80px_-30px_rgba(205,127,50,0.4)]',
            nameColor: 'text-orange-100 font-extrabold',
            badgeBg: 'bg-orange-600 border-orange-500 text-white',
            height: bronzeHeight,
            width: uniformWidth,
            zIndex: 'z-10',
            ringColor: 'border-orange-400/40',
            statsBg: 'bg-black/40 border-orange-500/15 backdrop-blur-xl',
        };
    };

    const RadialProgress = ({ value, color, size = 32 }: { value: number; color: string; size?: number }) => {
        const radius = size / 2 - 2;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (value / 100) * circumference;

        return (
            <div className="relative" style={{ width: size, height: size }}>
                <svg className="transform -rotate-90" width={size} height={size}>
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke="currentColor"
                        strokeWidth="2"
                        fill="transparent"
                        className="text-white/5"
                    />
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke={color}
                        strokeWidth="2"
                        fill="transparent"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-out"
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[7px] font-black text-white">{value}%</span>
                </div>
            </div>
        );
    };

    return (
        <div className="relative overflow-visible pb-2 mt-4">
            {/* Podium Cards: stacked on mobile (Gold first), side-by-side on desktop (Silver|Gold|Bronze) */}
            <div className="flex flex-col md:flex-row md:items-end justify-center gap-4 md:gap-6 px-2 md:px-4 pt-16 pb-4">
                {/* Mobile order: show #1 first, then #2, then #3 */}
                {[0, 1, 2].map((mobileIdx) => {
                    // On desktop the visual order is [1,0,2]; we handle that with md:order-* below
                    const tl = top3[mobileIdx];
                    if (!tl) return null;
                    const rank = mobileIdx + 1;
                    const cfg = rankConfig(rank);
                    const isFirst = rank === 1;
                    // Desktop visual re-ordering
                    const desktopOrder = mobileIdx === 0 ? 'md:order-2' : mobileIdx === 1 ? 'md:order-1' : 'md:order-3';

                    return (
                        <motion.div
                            key={tl.id}
                            initial={{ opacity: 0, y: 40, scale: 0.95 }}
                            animate={{
                                opacity: 1,
                                y: [0, -8, 0], // Subtle floating effect
                                scale: 1
                            }}
                            whileHover={{
                                y: -25, // Lifting off screen
                                scale: 1.04,
                                zIndex: 50,
                                transition: { duration: 0.3, ease: "easeOut" }
                            }}
                            transition={{
                                delay: mobileIdx * 0.1,
                                duration: 1,
                                type: 'spring',
                                damping: 20
                            }}
                            // Separate animation for floating to avoid conflicts with spring entry
                            onLayoutAnimationComplete={() => { }}
                            onClick={handleCardClick}
                            className={`relative flex flex-col rounded-[2.5rem] border cursor-pointer
                                w-full ${desktopOrder} ${cfg.zIndex} ${cfg.glow} ${cfg.border}
                                md:w-[320px] ${cfg.height}
                                transition-all duration-500 backdrop-blur-3xl`}
                        >
                            <motion.div
                                animate={{ y: [0, -8, 0] }}
                                transition={{
                                    repeat: Infinity,
                                    duration: 3 + mobileIdx,
                                    ease: "easeInOut"
                                }}
                                className="w-full h-full flex flex-col"
                            >
                                {/* Dark solid base — ensures card is always dark regardless of system theme */}
                                <div className="absolute inset-0 rounded-[2.5rem] bg-slate-950/40" />

                                {/* Card gradient overlay */}
                                <div className={`absolute inset-0 rounded-[2.5rem] ${cfg.cardBg}`} />

                                {/* Inner shimmer */}
                                <div className="absolute inset-x-0 top-0 h-28 rounded-t-[2.5rem] bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />

                                {/* Crown/Trophy — floats above card */}
                                <motion.div
                                    animate={{ y: [0, -12, 0] }}
                                    transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                                    className={`absolute -top-14 left-1/2 -translate-x-1/2 z-20 ${isFirst ? 'scale-125' : 'scale-110'}`}
                                >
                                    {rank === 1 ? (
                                        <Crown size={80} className="text-yellow-400 drop-shadow-[0_0_30px_rgba(234,179,8,1)] fill-yellow-400" strokeWidth={2} />
                                    ) : rank === 2 ? (
                                        <Trophy size={72} className="text-slate-100 drop-shadow-[0_0_25px_rgba(255,255,255,0.7)] fill-slate-200" strokeWidth={2} />
                                    ) : (
                                        <Trophy size={68} className="text-orange-300 drop-shadow-[0_0_25px_rgba(205,127,50,0.7)] fill-orange-400" strokeWidth={2} />
                                    )}
                                </motion.div>

                                {/* AI Live Badge */}
                                <div className="absolute top-5 right-5 z-20 flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/80 border border-white/20 shadow-2xl">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                                    </span>
                                    <span className="text-[10px] font-black tracking-widest text-white uppercase italic">AI REALTIME</span>
                                </div>

                                {/* Card Content — using fixed layout instead of mt-auto to keep stats grid consistent */}
                                <div className="relative z-10 flex flex-col items-center w-full h-full pt-12 pb-4 px-4">

                                    {/* Avatar */}
                                    <div className={`relative flex-shrink-0 ${isFirst ? 'mt-4' : 'mt-2'} mb-2`}>
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
                                        <div className={`absolute -bottom-3 left-1/2 -translate-x-1/2 px-5 py-1.5 rounded-full text-[11px] font-black uppercase tracking-[0.2em] border ${cfg.badgeBg} shadow-[0_8px_16px_rgba(0,0,0,0.6)] whitespace-nowrap`}>
                                            {rank === 1 ? 'MASTER RANK #1' : `RANK #${rank}`}
                                        </div>
                                    </div>

                                    {/* Name & Email */}
                                    <div className="text-center mt-4 mb-1 w-full flex-shrink-0">
                                        <h3 className={`text-2xl font-black text-center mb-1 drop-shadow-sm ${cfg.nameColor}`}>
                                            {safeRender(tl.fullName)}
                                        </h3>
                                        <p className="text-[11px] font-medium text-white/60 mb-3 text-center line-clamp-1 max-w-[200px]">
                                            {tl.email}
                                        </p>
                                    </div>
                                    {/* AI Score */}
                                    <div className="flex-shrink-0 flex items-center gap-3 bg-white/10 backdrop-blur-xl border border-white/25 px-6 py-3 rounded-2xl shadow-2xl mb-2">
                                        <Sparkles size={18} className="text-indigo-400 animate-pulse flex-shrink-0" />
                                        <span className={`text-2xl font-black tracking-tight ${cfg.nameColor}`}>{tl.score.toLocaleString()}</span>
                                        <span className="text-[11px] font-black text-white/70 uppercase tracking-widest ml-1">pts</span>
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
                                    <div className={`w-full flex-shrink-0 rounded-[2rem] p-4 border ${cfg.statsBg} shadow-inner bg-black/40`}>
                                        <TooltipProvider delayDuration={0}>
                                            <div className="grid grid-cols-2 gap-2">
                                                <Tooltip>
                                                    <TooltipTrigger className="flex flex-col items-center gap-1 py-1.5 px-0.5 rounded-xl hover:bg-white/10 transition-all w-full">
                                                        <RadialProgress value={tl.stats.efficiency} color="#3b82f6" />
                                                        <span className="text-[10px] font-black text-white leading-none mt-1">
                                                            {tl.stats.activeRiders}<span className="text-white/40 text-[8px]">/{tl.stats.totalRiders}</span>
                                                        </span>
                                                        <span className="text-[8px] text-white/50 uppercase font-bold tracking-wide">Efficiency</span>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className="font-bold bg-slate-950 text-[11px] border-white/20 p-3 rounded-xl shadow-2xl">
                                                        <p>Active / Total Riders (+20 pts each)</p>
                                                        <p className="text-blue-400 mt-1">{tl.stats.efficiency}% efficiency score</p>
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
                                                    <TooltipTrigger className="flex flex-col items-center gap-1 py-1.5 px-0.5 rounded-xl hover:bg-white/10 transition-all w-full">
                                                        <RadialProgress value={tl.stats.conversionRate} color="#eab308" />
                                                        <span className="text-[10px] font-black text-white leading-none mt-1">
                                                            {tl.stats.convertedLeads}<span className="text-white/40 text-[8px]">/{tl.stats.leadsTotal}</span>
                                                        </span>
                                                        <span className="text-[8px] text-white/50 uppercase font-bold tracking-wide">Conversion</span>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className="font-bold bg-slate-950 text-[11px] border-white/20 p-3 rounded-xl shadow-2xl">
                                                        <p>Lead Conversion (+40 pts each)</p>
                                                        <p className="text-yellow-400 mt-1">{tl.stats.conversionRate}% conversion rate</p>
                                                    </TooltipContent>
                                                </Tooltip>

                                                <Tooltip>
                                                    <TooltipTrigger className="flex flex-col items-center gap-1 py-1.5 px-0.5 rounded-xl hover:bg-white/10 transition-all w-full">
                                                        <PlusCircle size={15} className="text-indigo-400 flex-shrink-0" strokeWidth={2.5} />
                                                        <span className="text-xs font-black text-white leading-none">
                                                            {tl.stats.allotments}<span className="text-white/40 text-[8px]">/ -{tl.stats.submissions}</span>
                                                        </span>
                                                        <span className="text-[8px] text-white/50 uppercase font-bold tracking-wide">Fleet Flow</span>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className="font-bold bg-slate-950 text-[11px] border-white/20 p-3 rounded-xl shadow-2xl">
                                                        <p className="text-indigo-400">Allotments: +{tl.stats.allotments}</p>
                                                        <p className="text-white/60 font-medium">New registrations in period</p>
                                                        <div className="h-px bg-white/10 my-2" />
                                                        <p className="text-rose-400">Submissions: -{tl.stats.submissions}</p>
                                                        <p className="text-white/60 font-medium">Inactivations in period</p>
                                                        <div className="h-px bg-white/10 my-2" />
                                                        <p className={`font-black ${tl.stats.netGrowth >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                            Net Growth: {tl.stats.netGrowth > 0 ? '+' : ''}{tl.stats.netGrowth}
                                                        </p>
                                                    </TooltipContent>
                                                </Tooltip>

                                                <Tooltip>
                                                    <TooltipTrigger className="flex flex-col items-center gap-1 py-1.5 px-0.5 rounded-xl hover:bg-white/10 transition-all w-full">
                                                        <div className="flex gap-2 items-center">
                                                            <Activity size={15} className="text-emerald-400 flex-shrink-0" strokeWidth={2.5} />
                                                            {tl.stats.netGrowth < 0 && <TrendingDown size={14} className="text-rose-400" />}
                                                        </div>
                                                        <span className={`text-[10px] font-black leading-none mt-1 ${tl.stats.netGrowth >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                            {tl.stats.netGrowth > 0 ? '+' : ''}{tl.stats.netGrowth}
                                                        </span>
                                                        <span className="text-[8px] text-white/50 uppercase font-bold tracking-wide text-center">Net Growth</span>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className="font-bold bg-slate-950 text-[11px] border-white/20 p-3 rounded-xl shadow-2xl">
                                                        <p className="font-black text-indigo-400 uppercase tracking-widest mb-2">AI Score Breakdown</p>
                                                        <div className="space-y-1.5 font-medium text-[10px]">
                                                            <div className="flex justify-between gap-8">
                                                                <span className="text-white/60">Fleet Growth (Net)</span>
                                                                <span className="text-emerald-400">High Impact</span>
                                                            </div>
                                                            <div className="flex justify-between gap-8">
                                                                <span className="text-white/60">Daily Collections</span>
                                                                <span className="text-yellow-400">High Impact</span>
                                                            </div>
                                                            <div className="flex justify-between gap-8">
                                                                <span className="text-white/60">Lead Conversion</span>
                                                                <span className="text-blue-400">Quality Indicator</span>
                                                            </div>
                                                            <div className="flex justify-between gap-8">
                                                                <span className="text-white/60">Wallet Arrears</span>
                                                                <span className="text-rose-400">Risk Factor</span>
                                                            </div>
                                                        </div>
                                                    </TooltipContent>
                                                </Tooltip>
                                                <Tooltip>
                                                    <TooltipTrigger className="flex flex-col items-center gap-1 py-1.5 px-0.5 rounded-xl hover:bg-white/10 transition-all w-full">
                                                        <AlertTriangle size={15} className="text-rose-400 flex-shrink-0" strokeWidth={2.5} />
                                                        <span className="text-xs font-black text-rose-400 leading-none">
                                                            ₹{Math.abs(tl.stats.negativeWallet) >= 1000 ? `${(Math.abs(tl.stats.negativeWallet) / 1000).toFixed(1)}k` : Math.abs(tl.stats.negativeWallet)}
                                                        </span>
                                                        <span className="text-[8px] text-white/50 uppercase font-bold tracking-wide text-center">Arrears</span>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className="font-bold bg-slate-950 text-[11px] border-white/20 p-3 rounded-xl shadow-2xl">
                                                        <p className="text-rose-400">Total Negative Wallet</p>
                                                        <p className="text-white/60 mt-1">Impacts Collection Risk Profile</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </div>
                                        </TooltipProvider>
                                    </div>
                                </div>
                            </motion.div>
                        </motion.div>
                    );
                })}
            </div>

            {/* Ranked List (4th place onwards) — theme-aware styling */}
            {
                scoredTLs.length > 3 && (
                    <div className="mt-12 px-2 md:px-6 space-y-1.5">
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
                                    <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-white/60">
                                        <PlusCircle size={12} className="text-indigo-500 dark:text-indigo-400" />
                                        <span className={`font-bold ${tl.stats.netGrowth >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                                            {tl.stats.allotments}/-{tl.stats.submissions}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Sparkles size={12} className="text-indigo-500 dark:text-indigo-400" />
                                        <span className="text-xs font-black text-slate-800 dark:text-white">{tl.score.toLocaleString()}</span>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )
            }

            {/* Analyze Button */}
            {
                (!action && !disableClick && location.pathname.includes('admin')) && (
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
                )
            }

            {action && <div className="mt-10 flex justify-center">{action}</div>}

            {/* Empty State */}
            {
                scoredTLs.length === 0 && (
                    <div className="text-center p-20 bg-slate-100 dark:bg-indigo-950/30 rounded-[3rem] border-4 border-dashed border-slate-300 dark:border-indigo-500/30 flex flex-col items-center justify-center gap-6">
                        <Trophy size={64} className="opacity-20 animate-pulse text-slate-400 dark:text-indigo-400" />
                        <div className="space-y-2">
                            <p className="font-black text-xl tracking-tighter uppercase italic text-slate-600 dark:text-indigo-200/40">Neural Network Synchronizing</p>
                            <p className="text-xs font-bold text-slate-500 dark:text-indigo-300/70 tracking-widest">Awaiting multi-agent synchronization data.</p>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default Leaderboard;
