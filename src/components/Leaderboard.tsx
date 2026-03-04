import React, { useMemo, useEffect, useRef } from 'react';
import { User, Rider, Lead } from '../types';
import {
    Trophy, Crown, Sparkles, Wallet,
    ArrowRight, TrendingUp, Target, TrendingDown, PlusCircle, Activity,
    AlertTriangle, Clock, ChevronUp, ChevronDown, Minus, Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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

// ── Rank-change helpers ────────────────────────────────────────────────────────
const RANK_STORAGE_KEY = 'lb_prev_ranks_v2';

const getPreviousRanks = (): Record<string, number> => {
    try { return JSON.parse(sessionStorage.getItem(RANK_STORAGE_KEY) || '{}'); } catch { return {}; }
};

const saveCurrentRanks = (ranks: Record<string, number>) => {
    try { sessionStorage.setItem(RANK_STORAGE_KEY, JSON.stringify(ranks)); } catch { /* noop */ }
};

// ── Grade config ───────────────────────────────────────────────────────────────
const gradeConfig: Record<string, { bg: string; text: string; border: string; label: string }> = {
    S: { bg: 'bg-yellow-400/20', text: 'text-yellow-400', border: 'border-yellow-400/40', label: 'S RANK' },
    A: { bg: 'bg-emerald-400/20', text: 'text-emerald-400', border: 'border-emerald-400/40', label: 'A RANK' },
    B: { bg: 'bg-blue-400/20', text: 'text-blue-400', border: 'border-blue-400/40', label: 'B RANK' },
    C: { bg: 'bg-slate-400/20', text: 'text-slate-400', border: 'border-slate-400/40', label: 'C RANK' },
    D: { bg: 'bg-rose-400/10', text: 'text-rose-400', border: 'border-rose-400/20', label: 'D RANK' },
};

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
    const prevRanksRef = useRef<Record<string, number>>(getPreviousRanks());

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
                aiGrade: metrics.aiGrade,
                stats: metrics
            };
        }).sort((a, b) => b.score - a.score);
    }, [teamLeaders, riders, leads, collections, period]);

    // Save current ranks on each render so next session can compare
    useEffect(() => {
        const currentRanks: Record<string, number> = {};
        scoredTLs.forEach((tl, idx) => { currentRanks[tl.id] = idx + 1; });
        // Only save after a short delay so we read prev before overwriting
        const t = setTimeout(() => saveCurrentRanks(currentRanks), 3000);
        return () => clearTimeout(t);
    }, [scoredTLs]);

    const getRankChange = (tlId: string, currentRank: number) => {
        const prev = prevRanksRef.current[tlId];
        if (!prev) return 0;
        return prev - currentRank; // positive = moved up, negative = moved down
    };

    const top3 = scoredTLs.slice(0, 3);

    const handleCardClick = () => {
        if (!disableClick && location.pathname.includes('admin')) {
            navigate('/portal/leaderboard');
        }
    };

    const rankConfig = (rank: number) => {
        const uniformHeight = 'md:h-auto pb-4';
        const uniformWidth = 'md:w-[320px] w-full';

        if (rank === 1) return {
            cardBg: 'bg-gradient-to-b from-yellow-500/35 via-yellow-900/25 to-slate-950/98',
            border: 'border-yellow-400/70 shadow-[0_0_20px_rgba(234,179,8,0.4)]',
            glow: 'shadow-[0_0_120px_-30px_rgba(255,200,0,0.5),0_40px_80px_-30px_rgba(255,200,0,0.25)]',
            nameColor: 'text-yellow-200 font-extrabold',
            badgeBg: 'bg-yellow-500 border-yellow-400 text-black',
            height: uniformHeight, width: uniformWidth,
            zIndex: 'z-30', ringColor: 'border-yellow-400/50',
            statsBg: 'bg-black/40 border-yellow-500/20 backdrop-blur-xl',
            accentColor: '#eab308',
        };
        if (rank === 2) return {
            cardBg: 'bg-gradient-to-b from-slate-400/30 via-slate-800/25 to-slate-950/98',
            border: 'border-slate-300/60 shadow-[0_0_20px_rgba(200,200,220,0.25)]',
            glow: 'shadow-[0_0_80px_-30px_rgba(200,200,220,0.4)]',
            nameColor: 'text-white font-extrabold',
            badgeBg: 'bg-slate-500 border-slate-400 text-white',
            height: uniformHeight, width: uniformWidth,
            zIndex: 'z-20', ringColor: 'border-slate-300/40',
            statsBg: 'bg-black/40 border-slate-500/20 backdrop-blur-xl',
            accentColor: '#94a3b8',
        };
        return {
            cardBg: 'bg-gradient-to-b from-orange-600/30 via-orange-900/20 to-slate-950/98',
            border: 'border-orange-500/60 shadow-[0_0_20px_rgba(205,127,50,0.25)]',
            glow: 'shadow-[0_0_80px_-30px_rgba(205,127,50,0.4)]',
            nameColor: 'text-orange-100 font-extrabold',
            badgeBg: 'bg-orange-600 border-orange-500 text-white',
            height: uniformHeight, width: uniformWidth,
            zIndex: 'z-10', ringColor: 'border-orange-300/40',
            statsBg: 'bg-black/40 border-orange-500/20 backdrop-blur-xl',
            accentColor: '#ea580c',
        };
    };

    const RadialProgress = ({ value, color, size = 32 }: { value: number; color: string; size?: number }) => {
        const radius = size / 2 - 2;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (value / 100) * circumference;
        return (
            <div className="relative" style={{ width: size, height: size }}>
                <svg className="transform -rotate-90" width={size} height={size}>
                    <circle cx={size / 2} cy={size / 2} r={radius} stroke="currentColor" strokeWidth="2" fill="transparent" className="text-white/5" />
                    <circle cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth="2.5" fill="transparent"
                        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
                        className="transition-all duration-1000 ease-out" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[7px] font-black text-white">{value}%</span>
                </div>
            </div>
        );
    };

    // ── Rank change badge ──────────────────────────────────────────────────────
    const RankChangeBadge = ({ tlId, currentRank, size = 'sm' }: { tlId: string; currentRank: number; size?: 'sm' | 'xs' }) => {
        const change = getRankChange(tlId, currentRank);
        const isXs = size === 'xs';

        if (change > 0) return (
            <motion.span
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`flex items-center gap-0.5 ${isXs ? 'text-[8px]' : 'text-[9px]'} font-black text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-full ring-1 ring-emerald-400/20`}
            >
                <ChevronUp size={isXs ? 8 : 10} className="flex-shrink-0" />
                {change}
            </motion.span>
        );
        if (change < 0) return (
            <motion.span
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`flex items-center gap-0.5 ${isXs ? 'text-[8px]' : 'text-[9px]'} font-black text-rose-400 bg-rose-400/10 px-1.5 py-0.5 rounded-full ring-1 ring-rose-400/20`}
            >
                <ChevronDown size={isXs ? 8 : 10} className="flex-shrink-0" />
                {Math.abs(change)}
            </motion.span>
        );
        return <span className={`${isXs ? 'text-[8px]' : 'text-[9px]'} font-black text-white/20`}><Minus size={isXs ? 8 : 10} /></span>;
    };

    return (
        <div className="relative overflow-visible pb-2 mt-4">
            {/* ── Podium Cards ── */}
            <div className="flex flex-col md:flex-row md:items-end justify-center gap-8 md:gap-6 px-2 md:px-4 pt-16 pb-4">
                <AnimatePresence mode="popLayout">
                    {[0, 1, 2].map((mobileIdx) => {
                        const tl = top3[mobileIdx];
                        if (!tl) return null;
                        const rank = mobileIdx + 1;
                        const cfg = rankConfig(rank);
                        const isFirst = rank === 1;
                        const desktopOrder = mobileIdx === 0 ? 'md:order-2' : mobileIdx === 1 ? 'md:order-1' : 'md:order-3';
                        const grade = gradeConfig[tl.aiGrade] || gradeConfig.C;
                        const rankChange = getRankChange(tl.id, rank);

                        return (
                            <motion.div
                                key={tl.id}
                                layoutId={`podium-${tl.id}`}
                                initial={{ opacity: 0, y: 40, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                whileHover={{ y: -18, scale: 1.03, zIndex: 50, transition: { duration: 0.25, ease: 'easeOut' } }}
                                transition={{ delay: mobileIdx * 0.1, duration: 0.8, type: 'spring', damping: 22 }}
                                onClick={handleCardClick}
                                className={`relative flex flex-col rounded-[2.5rem] border cursor-pointer
                                    w-full ${desktopOrder} ${cfg.zIndex} ${cfg.glow} ${cfg.border}
                                    md:w-[320px] ${cfg.height}
                                    transition-all duration-500 backdrop-blur-3xl`}
                            >
                                <motion.div
                                    animate={{ y: [0, -6, 0] }}
                                    transition={{ repeat: Infinity, duration: 3 + mobileIdx, ease: 'easeInOut' }}
                                    className="w-full h-full flex flex-col"
                                >
                                    <div className="absolute inset-0 rounded-[2.5rem] bg-slate-950/40" />
                                    <div className={`absolute inset-0 rounded-[2.5rem] ${cfg.cardBg}`} />
                                    <div className="absolute inset-x-0 top-0 h-28 rounded-t-[2.5rem] bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />

                                    {/* Crown / Trophy */}
                                    <motion.div
                                        animate={{ y: [0, -12, 0] }}
                                        transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
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

                                    {/* Grade badge top-left */}
                                    <div className={`absolute top-5 left-5 z-20 flex items-center gap-1 px-2.5 py-1 rounded-full border ${grade.bg} ${grade.border}`}>
                                        <Star size={8} className={grade.text} />
                                        <span className={`text-[9px] font-black tracking-widest uppercase ${grade.text}`}>{grade.label}</span>
                                    </div>

                                    {/* Card Content */}
                                    <div className="relative z-10 flex flex-col items-center w-full h-full pt-12 pb-3 px-3">

                                        {/* Avatar */}
                                        <div className={`relative flex-shrink-0 ${isFirst ? 'mt-4' : 'mt-2'} mb-2`}>
                                            <div className={`absolute -inset-2 rounded-full border-2 animate-ping opacity-20 ${cfg.ringColor}`} />
                                            <div className="w-[72px] h-[72px] rounded-full overflow-hidden
                                            bg-gradient-to-br from-white/25 to-white/5 backdrop-blur-sm
                                            border-2 border-white/30 shadow-xl flex-shrink-0 flex items-center justify-center">
                                                {tl.profilePicUrl ? (
                                                    <img src={tl.profilePicUrl} alt={tl.fullName} className="w-full h-full object-cover"
                                                        onError={(e) => {
                                                            const target = e.currentTarget; target.style.display = 'none';
                                                            const parent = target.parentElement;
                                                            if (parent) parent.innerHTML = `<span class="text-2xl font-black text-white">${tl.fullName ? tl.fullName.charAt(0).toUpperCase() : '?'}</span>`;
                                                        }} />
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

                                        {/* Name + Rank Change */}
                                        <div className="text-center mt-3 mb-1 w-full flex-shrink-0">
                                            <h3 className={`text-xl font-black text-center mb-1 drop-shadow-sm ${cfg.nameColor}`}>
                                                {safeRender(tl.fullName)}
                                            </h3>
                                            <div className="flex items-center justify-center gap-2">
                                                <RankChangeBadge tlId={tl.id} currentRank={rank} />
                                                {rankChange > 0 && (
                                                    <span className="text-[8px] font-black text-emerald-400/70 uppercase tracking-widest">Climbing</span>
                                                )}
                                                {rankChange < 0 && (
                                                    <span className="text-[8px] font-black text-rose-400/70 uppercase tracking-widest">Dropped</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* AI Score */}
                                        <TooltipProvider delayDuration={0}>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className="flex-shrink-0 flex items-center gap-3 bg-white/10 backdrop-blur-xl border border-white/25 px-6 py-3 rounded-2xl shadow-2xl mb-2 cursor-help transition-all hover:bg-white/20">
                                                        <Sparkles size={18} className="text-indigo-400 animate-pulse flex-shrink-0" />
                                                        <span className={`text-2xl font-black tracking-tight ${cfg.nameColor}`}>{tl.score.toLocaleString()}</span>
                                                        <span className="text-[11px] font-black text-white/70 uppercase tracking-widest ml-1">pts</span>
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent side="bottom" className="w-[280px] p-0 overflow-hidden bg-slate-950 border-white/10 shadow-2xl rounded-2xl">
                                                    <div className="bg-indigo-600/20 p-3 border-b border-white/10">
                                                        <div className="flex items-center gap-2">
                                                            <Sparkles size={14} className="text-indigo-400" />
                                                            <h4 className="text-[12px] font-black uppercase tracking-widest text-white">Intelligence Breakdown</h4>
                                                        </div>
                                                        <p className="text-[10px] text-white/50 font-bold mt-1">Real-time performance impact analysis</p>
                                                    </div>
                                                    <div className="p-3 space-y-2.5">
                                                        <div className="flex justify-between items-center group">
                                                            <div className="flex items-center gap-2">
                                                                <Activity size={12} className="text-blue-400" />
                                                                <span className="text-[10px] font-bold text-white/70 uppercase">Fleet Health</span>
                                                            </div>
                                                            <div className="text-[10px] font-black text-blue-400">+25 / -15 pts</div>
                                                        </div>
                                                        <div className="flex justify-between items-center group">
                                                            <div className="flex items-center gap-2">
                                                                <TrendingUp size={12} className="text-emerald-400" />
                                                                <span className="text-[10px] font-bold text-white/70 uppercase">Net Growth</span>
                                                            </div>
                                                            <div className="text-[10px] font-black text-emerald-400">+60 pts (Multi)</div>
                                                        </div>
                                                        <div className="flex justify-between items-center group">
                                                            <div className="flex items-center gap-2">
                                                                <Wallet size={12} className="text-yellow-400" />
                                                                <span className="text-[10px] font-bold text-white/70 uppercase">Collections</span>
                                                            </div>
                                                            <div className="text-[10px] font-black text-yellow-400">+12 pts / ₹1k</div>
                                                        </div>
                                                        <div className="flex justify-between items-center group">
                                                            <div className="flex items-center gap-2">
                                                                <Target size={12} className="text-purple-400" />
                                                                <span className="text-[10px] font-bold text-white/70 uppercase">Conversion</span>
                                                            </div>
                                                            <div className="text-[10px] font-black text-purple-400">+45 pts / lead</div>
                                                        </div>
                                                        <div className="pt-2 border-t border-white/5 flex justify-between items-center">
                                                            <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">Risk: Churn</span>
                                                            <span className="text-[10px] font-black text-rose-500">-40 pts</span>
                                                        </div>
                                                    </div>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>

                                        {/* Trending badge */}
                                        {tl.isTrending && (
                                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                                className="flex-shrink-0 flex items-center gap-1.5 text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1">
                                                <TrendingUp size={10} className="fill-emerald-400 flex-shrink-0" /> Top Performer
                                            </motion.div>
                                        )}

                                        {/* Spacer before stats */}
                                        <div className="flex-1 min-h-0" />

                                        {/* Enhanced 3×3 Stats Grid */}
                                        <div className={`w-full flex-shrink-0 rounded-[2rem] p-3 border ${cfg.statsBg} shadow-inner bg-black/40`}>
                                            <TooltipProvider delayDuration={0}>
                                                <div className="grid grid-cols-3 gap-1.5">

                                                    {/* 1: Fleet Efficiency */}
                                                    <Tooltip>
                                                        <TooltipTrigger className="flex flex-col items-center gap-1 py-2 px-0.5 rounded-xl hover:bg-white/10 transition-all w-full">
                                                            <RadialProgress value={tl.stats.efficiency} color="#3b82f6" size={30} />
                                                            <span className="text-[9px] font-black text-white leading-none mt-0.5">
                                                                {tl.stats.activeRiders}<span className="text-white/40 text-[7px]">/{tl.stats.totalRiders}</span>
                                                            </span>
                                                            <span className="text-[7px] text-white/50 uppercase font-bold tracking-wide">Fleet</span>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top" className="font-bold bg-slate-950 text-[11px] border-white/20 p-3 rounded-xl shadow-2xl">
                                                            <p>Active / Total Riders</p>
                                                            <p className="text-blue-400 mt-1">{tl.stats.efficiency}% fleet efficiency</p>
                                                        </TooltipContent>
                                                    </Tooltip>

                                                    {/* 2: Rent Collected */}
                                                    <Tooltip>
                                                        <TooltipTrigger className="flex flex-col items-center gap-1 py-2 px-0.5 rounded-xl hover:bg-white/10 transition-all w-full">
                                                            <Wallet size={14} className="text-emerald-400 flex-shrink-0" strokeWidth={2.5} />
                                                            <span className="text-[9px] font-black text-white leading-none">
                                                                ₹{tl.stats.collection >= 1000 ? `${(tl.stats.collection / 1000).toFixed(1)}k` : tl.stats.collection}
                                                            </span>
                                                            <span className="text-[7px] text-white/50 uppercase font-bold tracking-wide">Rent</span>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top" className="font-bold bg-slate-950 text-[11px] border-white/20 p-3 rounded-xl shadow-2xl">
                                                            <p>Total Rent Collected</p>
                                                            <p className="text-emerald-400 mt-1">+₹{tl.stats.positiveWallet.toLocaleString()} (Positive Wallet)</p>
                                                            <p className="text-red-400">-₹{Math.abs(tl.stats.negativeWallet).toLocaleString()} (Arrears)</p>
                                                        </TooltipContent>
                                                    </Tooltip>

                                                    {/* 3: Lead Conversion */}
                                                    <Tooltip>
                                                        <TooltipTrigger className="flex flex-col items-center gap-1 py-2 px-0.5 rounded-xl hover:bg-white/10 transition-all w-full">
                                                            <RadialProgress value={tl.stats.conversionRate} color="#eab308" size={30} />
                                                            <span className="text-[9px] font-black text-white leading-none mt-0.5">
                                                                {tl.stats.convertedLeads}<span className="text-white/40 text-[7px]">/{tl.stats.leadsTotal}</span>
                                                            </span>
                                                            <span className="text-[7px] text-white/50 uppercase font-bold tracking-wide">Leads</span>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top" className="font-bold bg-slate-950 text-[11px] border-white/20 p-3 rounded-xl shadow-2xl">
                                                            <p>Lead Conversion Rate</p>
                                                            <p className="text-yellow-400 mt-1">{tl.stats.conversionRate}% conversion</p>
                                                        </TooltipContent>
                                                    </Tooltip>

                                                    {/* 4: Fleet Flow */}
                                                    <Tooltip>
                                                        <TooltipTrigger className="flex flex-col items-center gap-1 py-2 px-0.5 rounded-xl hover:bg-white/10 transition-all w-full">
                                                            <PlusCircle size={14} className="text-indigo-400 flex-shrink-0" strokeWidth={2.5} />
                                                            <span className="text-[9px] font-black text-white leading-none">
                                                                {tl.stats.allotments}<span className="text-white/40 text-[7px]">/-{tl.stats.submissions}</span>
                                                            </span>
                                                            <span className="text-[7px] text-white/50 uppercase font-bold tracking-wide">Flow</span>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top" className="font-bold bg-slate-950 text-[11px] border-white/20 p-3 rounded-xl shadow-2xl">
                                                            <p className="text-indigo-400">Allotments: +{tl.stats.allotments}</p>
                                                            <p className="text-rose-400">Submissions: -{tl.stats.submissions}</p>
                                                            <div className="h-px bg-white/10 my-2" />
                                                            <p className={`font-black ${tl.stats.netGrowth >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                                Net: {tl.stats.netGrowth > 0 ? '+' : ''}{tl.stats.netGrowth}
                                                            </p>
                                                        </TooltipContent>
                                                    </Tooltip>

                                                    {/* 5: Net Growth */}
                                                    <Tooltip>
                                                        <TooltipTrigger className="flex flex-col items-center gap-1 py-2 px-0.5 rounded-xl hover:bg-white/10 transition-all w-full">
                                                            <div className="flex gap-1 items-center">
                                                                <Activity size={13} className="text-emerald-400 flex-shrink-0" strokeWidth={2.5} />
                                                                {tl.stats.netGrowth < 0 && <TrendingDown size={11} className="text-rose-400" />}
                                                            </div>
                                                            <span className={`text-[9px] font-black leading-none mt-0.5 ${tl.stats.netGrowth >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                                {tl.stats.netGrowth > 0 ? '+' : ''}{tl.stats.netGrowth}
                                                            </span>
                                                            <span className="text-[7px] text-white/50 uppercase font-bold tracking-wide text-center">Net Grow</span>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top" className="font-bold bg-slate-950 text-[11px] border-white/20 p-3 rounded-xl shadow-2xl">
                                                            <p className="font-black text-indigo-400 uppercase tracking-widest mb-2">AI Score Breakdown</p>
                                                            <div className="space-y-1.5 font-medium text-[10px]">
                                                                <div className="flex justify-between gap-8"><span className="text-white/60">Fleet Growth</span><span className="text-emerald-400">High Impact</span></div>
                                                                <div className="flex justify-between gap-8"><span className="text-white/60">Collections</span><span className="text-yellow-400">High Impact</span></div>
                                                                <div className="flex justify-between gap-8"><span className="text-white/60">Lead Conv.</span><span className="text-blue-400">Quality</span></div>
                                                                <div className="flex justify-between gap-8"><span className="text-white/60">Arrears</span><span className="text-rose-400">Risk Factor</span></div>
                                                            </div>
                                                        </TooltipContent>
                                                    </Tooltip>

                                                    {/* 6: Arrears */}
                                                    <Tooltip>
                                                        <TooltipTrigger className="flex flex-col items-center gap-1 py-2 px-0.5 rounded-xl hover:bg-white/10 transition-all w-full">
                                                            <AlertTriangle size={13} className="text-rose-400 flex-shrink-0" strokeWidth={2.5} />
                                                            <span className="text-[9px] font-black text-rose-400 leading-none">
                                                                ₹{Math.abs(tl.stats.negativeWallet) >= 1000 ? `${(Math.abs(tl.stats.negativeWallet) / 1000).toFixed(1)}k` : Math.abs(tl.stats.negativeWallet)}
                                                            </span>
                                                            <span className="text-[7px] text-white/50 uppercase font-bold tracking-wide text-center">Arrears</span>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top" className="font-bold bg-slate-950 text-[11px] border-white/20 p-3 rounded-xl shadow-2xl">
                                                            <p className="text-rose-400">Total Negative Wallet</p>
                                                            <p className="text-white/60 mt-1">{tl.stats.negativeWalletCount} riders in arrears</p>
                                                        </TooltipContent>
                                                    </Tooltip>

                                                    {/* 7: Positive Wallet % */}
                                                    <Tooltip>
                                                        <TooltipTrigger className="flex flex-col items-center gap-1 py-2 px-0.5 rounded-xl hover:bg-white/10 transition-all w-full">
                                                            <TrendingUp size={13} className="text-green-400 flex-shrink-0" strokeWidth={2.5} />
                                                            <span className="text-[9px] font-black text-green-400 leading-none">
                                                                {tl.stats.totalRiders > 0 ? Math.round((tl.stats.positiveWalletCount / tl.stats.totalRiders) * 100) : 0}%
                                                            </span>
                                                            <span className="text-[7px] text-white/50 uppercase font-bold tracking-wide text-center">+Wallet</span>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top" className="font-bold bg-slate-950 text-[11px] border-white/20 p-3 rounded-xl shadow-2xl">
                                                            <p className="text-emerald-400">Positive Wallet Riders</p>
                                                            <p className="text-white/60 mt-1">{tl.stats.positiveWalletCount} of {tl.stats.totalRiders} riders</p>
                                                        </TooltipContent>
                                                    </Tooltip>

                                                    {/* 8: Collection / Rider */}
                                                    <Tooltip>
                                                        <TooltipTrigger className="flex flex-col items-center gap-1 py-2 px-0.5 rounded-xl hover:bg-white/10 transition-all w-full">
                                                            <Target size={13} className="text-purple-400 flex-shrink-0" strokeWidth={2.5} />
                                                            <span className="text-[9px] font-black text-purple-300 leading-none">
                                                                ₹{tl.stats.collectionPerRider >= 1000 ? `${(tl.stats.collectionPerRider / 1000).toFixed(1)}k` : tl.stats.collectionPerRider}
                                                            </span>
                                                            <span className="text-[7px] text-white/50 uppercase font-bold tracking-wide text-center">/Rider</span>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top" className="font-bold bg-slate-950 text-[11px] border-white/20 p-3 rounded-xl shadow-2xl">
                                                            <p className="text-purple-400">Collection Per Active Rider</p>
                                                            <p className="text-white/60 mt-1">₹{tl.stats.collection.toLocaleString()} ÷ {tl.stats.activeRiders} riders</p>
                                                        </TooltipContent>
                                                    </Tooltip>

                                                    {/* 9: Avg Rider Age */}
                                                    <Tooltip>
                                                        <TooltipTrigger className="flex flex-col items-center gap-1 py-2 px-0.5 rounded-xl hover:bg-white/10 transition-all w-full">
                                                            <Clock size={13} className="text-sky-400 flex-shrink-0" strokeWidth={2.5} />
                                                            <span className="text-[9px] font-black text-sky-300 leading-none">
                                                                {tl.stats.avgRiderAge > 0 ? `${tl.stats.avgRiderAge}d` : '—'}
                                                            </span>
                                                            <span className="text-[7px] text-white/50 uppercase font-bold tracking-wide text-center">Avg Age</span>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top" className="font-bold bg-slate-950 text-[11px] border-white/20 p-3 rounded-xl shadow-2xl">
                                                            <p className="text-sky-400">Average Rider Tenure</p>
                                                            <p className="text-white/60 mt-1">Days since allotment (active riders)</p>
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
                </AnimatePresence>
            </div>

            {/* ── Other Rankings Table ── */}
            {scoredTLs.length > 3 && (
                <div className="mt-10 px-2 md:px-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 dark:text-white/30 text-center mb-4">Other Rankings</p>
                    <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-white/8 shadow-lg">

                        {/* Table Header */}
                        <div className="hidden sm:grid grid-cols-[40px_1fr_100px_90px_90px_80px_100px_90px_80px_70px_60px] gap-2 px-4 py-2.5 bg-slate-100/80 dark:bg-slate-900/60 text-[8px] font-black uppercase tracking-[0.15em] text-slate-500 dark:text-white/30 border-b border-slate-200 dark:border-white/8">
                            <span className="text-center">#</span>
                            <span>Leader</span>
                            <span className="text-center">AI Score</span>
                            <span className="text-center">Fleet</span>
                            <span className="text-center">Flow (A/S/N)</span>
                            <span className="text-center">Leads%</span>
                            <span className="text-center">Wallet</span>
                            <span className="text-center">Collected</span>
                            <span className="text-center">/Rider</span>
                            <span className="text-center">Churn</span>
                            <span className="text-center">Avg Age</span>
                        </div>

                        <div className="divide-y divide-slate-100 dark:divide-white/5">
                            <AnimatePresence mode="popLayout">
                                {scoredTLs.slice(3).map((tl, idx) => {
                                    const currentRank = idx + 4;
                                    const rankChange = getRankChange(tl.id, currentRank);
                                    const positiveWalletPct = tl.stats.totalRiders > 0 ? Math.round((tl.stats.positiveWalletCount / tl.stats.totalRiders) * 100) : 0;

                                    return (
                                        <motion.div
                                            key={tl.id}
                                            layoutId={`row-${tl.id}`}
                                            initial={{ opacity: 0, x: -16 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 16 }}
                                            transition={{ delay: idx * 0.04 }}
                                            className="group relative flex flex-col sm:grid sm:grid-cols-[40px_1fr_100px_90px_90px_80px_100px_90px_80px_70px_60px] gap-2 px-4 py-3
                                                bg-white/90 dark:bg-slate-900/40
                                                hover:bg-indigo-50/60 dark:hover:bg-indigo-900/20
                                                hover:shadow-md hover:scale-[1.002]
                                                transition-all duration-200 cursor-default"
                                            style={{
                                                borderLeft: rankChange > 0 ? '3px solid #10b981' : rankChange < 0 ? '3px solid #f43f5e' : '3px solid transparent'
                                            }}
                                        >
                                            {/* Rank */}
                                            <div className="flex items-center justify-center gap-1">
                                                <span className="text-sm font-black text-slate-400 dark:text-white/30 w-5 text-center">{currentRank}</span>
                                                <RankChangeBadge tlId={tl.id} currentRank={currentRank} size="xs" />
                                            </div>

                                            {/* Leader Info */}
                                            <div className="flex items-center gap-2.5">
                                                <div className="flex-shrink-0 relative">
                                                    <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-900/40 dark:to-violet-900/40 flex items-center justify-center text-[11px] font-black text-indigo-600 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-500/30">
                                                        {tl.profilePicUrl ? (
                                                            <img src={tl.profilePicUrl} alt={tl.fullName} className="w-full h-full object-cover"
                                                                onError={(e) => { const t = e.currentTarget; t.style.display = 'none'; const p = t.parentElement; if (p) p.innerHTML = `<span class="text-xs font-black">${tl.fullName.charAt(0).toUpperCase()}</span>`; }} />
                                                        ) : tl.fullName.charAt(0).toUpperCase()}
                                                    </div>
                                                    {/* Grade dot */}
                                                    <div className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-white dark:border-slate-900 flex items-center justify-center ${gradeConfig[tl.aiGrade]?.bg || ''}`}>
                                                        <span className={`text-[5px] font-black ${gradeConfig[tl.aiGrade]?.text || 'text-slate-400'}`}>{tl.aiGrade}</span>
                                                    </div>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-black text-slate-800 dark:text-white truncate">{safeRender(tl.fullName)}</p>
                                                    <p className="text-[9px] text-slate-500 dark:text-white/40 truncate">{tl.email}</p>
                                                </div>
                                            </div>

                                            {/* AI Score */}
                                            <div className="flex flex-col items-center justify-center">
                                                <span className="text-sm font-black bg-gradient-to-r from-indigo-500 to-violet-600 bg-clip-text text-transparent italic">{tl.score.toLocaleString()}</span>
                                                <span className="text-[7px] font-black text-indigo-400/60 uppercase tracking-widest">pts</span>
                                            </div>

                                            {/* Fleet */}
                                            <div className="flex flex-col items-center justify-center gap-0.5">
                                                <span className="text-xs font-black text-slate-700 dark:text-white">{tl.stats.activeRiders}<span className="text-[9px] font-bold text-slate-400">/{tl.stats.totalRiders}</span></span>
                                                <div className="w-14 h-1 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                                                    <motion.div initial={{ width: 0 }} animate={{ width: `${tl.stats.efficiency}%` }}
                                                        className="h-full bg-blue-500 rounded-full" transition={{ duration: 0.8 }} />
                                                </div>
                                                <span className="text-[8px] font-bold text-blue-500">{tl.stats.efficiency}%</span>
                                            </div>

                                            {/* Fleet Flow */}
                                            <div className="flex flex-col items-center justify-center">
                                                <span className={`text-xs font-black ${tl.stats.netGrowth >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                                                    {tl.stats.netGrowth > 0 ? '+' : ''}{tl.stats.netGrowth}
                                                </span>
                                                <span className="text-[8px] font-bold text-slate-400 dark:text-white/40">
                                                    +{tl.stats.allotments}/-{tl.stats.submissions}
                                                </span>
                                            </div>

                                            {/* Leads% */}
                                            <div className="flex flex-col items-center justify-center">
                                                <span className="text-xs font-black text-yellow-600 dark:text-yellow-400">{tl.stats.conversionRate}%</span>
                                                <span className="text-[8px] font-bold text-slate-400 dark:text-white/40">{tl.stats.convertedLeads}/{tl.stats.leadsTotal}</span>
                                            </div>

                                            {/* Wallet */}
                                            <div className="flex flex-col items-center justify-center">
                                                <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400">+{(tl.stats.positiveWallet / 1000).toFixed(1)}k</span>
                                                <span className="text-[8px] font-bold text-rose-400">-{(Math.abs(tl.stats.negativeWallet) / 1000).toFixed(1)}k</span>
                                                <span className="text-[7px] font-bold text-slate-400 dark:text-white/30">{positiveWalletPct}% pos</span>
                                            </div>

                                            {/* Collected */}
                                            <div className="flex flex-col items-center justify-center">
                                                <span className="text-xs font-black text-slate-700 dark:text-white">
                                                    ₹{tl.stats.collection >= 1000 ? `${(tl.stats.collection / 1000).toFixed(1)}k` : tl.stats.collection}
                                                </span>
                                                <span className="text-[7px] font-bold text-emerald-500/70 uppercase">Rent</span>
                                            </div>

                                            {/* Per Rider */}
                                            <div className="flex flex-col items-center justify-center">
                                                <span className="text-xs font-black text-purple-600 dark:text-purple-300">
                                                    ₹{tl.stats.collectionPerRider >= 1000 ? `${(tl.stats.collectionPerRider / 1000).toFixed(1)}k` : tl.stats.collectionPerRider}
                                                </span>
                                                <span className="text-[7px] font-bold text-slate-400 dark:text-white/30">/rider</span>
                                            </div>

                                            {/* Churn */}
                                            <div className="flex flex-col items-center justify-center">
                                                <span className={`text-xs font-black ${tl.stats.churnRiders > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                                    {tl.stats.churnRiders}
                                                </span>
                                                <span className="text-[7px] font-bold text-slate-400 dark:text-white/30">{tl.stats.inactiveRiders} inact</span>
                                            </div>

                                            {/* Avg Rider Age */}
                                            <div className="flex flex-col items-center justify-center">
                                                <span className="text-xs font-black text-sky-600 dark:text-sky-300">
                                                    {tl.stats.avgRiderAge > 0 ? `${tl.stats.avgRiderAge}d` : '—'}
                                                </span>
                                                <span className="text-[7px] font-bold text-slate-400 dark:text-white/30">tenure</span>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            )}

            {/* Analyze Button */}
            {(!action && !disableClick && location.pathname.includes('admin')) && (
                <div onClick={handleCardClick} className="mt-10 flex justify-center">
                    <motion.button
                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
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
