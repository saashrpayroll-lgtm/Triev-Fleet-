import React, { useMemo } from 'react';
import { User, Rider, Lead } from '@/types';
import { Trophy, Sparkles, Wallet, Users, CheckCircle, Smartphone, Calendar, Activity, Hash, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';

interface LeaderboardProps {
    teamLeaders: User[];
    riders: Rider[];
    leads?: Lead[];
    action?: React.ReactNode;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ teamLeaders, riders, leads = [], action }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const isDashboard = location.pathname.includes('dashboard') || location.pathname === '/admin' || location.pathname === '/team-leader';

    // AI Scoring Algorithm (Same logic, enhanced display)
    const scoredTLs = useMemo(() => {
        return teamLeaders.map(tl => {
            const tlRiders = riders.filter(r => r.teamLeaderId === tl.id);
            const activeCount = tlRiders.filter(r => r.status === 'active').length;
            const inactiveCount = tlRiders.filter(r => r.status === 'inactive').length;
            const totalWallet = tlRiders.reduce((sum, r) => sum + r.walletAmount, 0);

            // Leads
            const tlLeads = leads.filter(l => l.createdBy === tl.id);
            const convertedLeads = tlLeads.filter(l => l.status === 'Convert').length;

            // Activity (Mock calculation based on recent timeline events or just sum of actions)
            // Ideally this would come from an Activity Log, but we used derived stats for now
            const activityScore = activeCount + convertedLeads + (tlLeads.length > 0 ? 1 : 0);

            // Scoring Logic
            let score = 100;
            score += activeCount * 10;
            score -= inactiveCount * 5;
            score += (totalWallet > 0 ? Math.floor(totalWallet / 1000) : 0);
            score += (totalWallet < 0 ? Math.floor(totalWallet / 1000) * 2 : 0);
            score += convertedLeads * 20;

            return {
                ...tl,
                score: Math.max(0, score),
                stats: {
                    activeRiders: activeCount,
                    totalRiders: tlRiders.length,
                    wallet: totalWallet,
                    leads: tlLeads.length,
                    converted: convertedLeads,
                    conversionRate: tlLeads.length > 0 ? Math.round((convertedLeads / tlLeads.length) * 100) : 0,
                    activity: activityScore
                }
            };
        }).sort((a, b) => b.score - a.score).slice(0, 3);
    }, [teamLeaders, riders, leads]);

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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                {podiumOrder.map((tl, idx) => {
                    // Determine actual rank based on sorted list
                    const actualRank = scoredTLs.indexOf(tl);
                    const isFirst = actualRank === 0;
                    const styles = getRankStyles(actualRank);

                    return (
                        <motion.div
                            key={tl.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: idx * 0.1 }}
                            className={`relative rounded-3xl border p-5 ${styles.bg} ${styles.border} ${styles.shadow} backdrop-blur-sm group hover:scale-[1.03] hover:shadow-2xl transition-all duration-300 cursor-pointer ${isFirst ? 'md:-mt-8 md:mb-4 md:py-8 shadow-xl z-10 ring-1 ring-yellow-500/20' : 'shadow-lg'}`}
                            onClick={() => {
                                if (isDashboard) {
                                    navigate('/admin/leaderboard');
                                } else {
                                    navigate(`/admin/users?highlightUserId=${tl.id}`);
                                }
                            }}
                        >
                            {/* Rank Badge */}
                            <div className={`absolute -right-3 -top-3 w-10 h-10 rounded-full ${styles.badge} text-white font-bold flex items-center justify-center shadow-lg ring-4 ring-white dark:ring-background z-20 group-hover:scale-110 transition-transform`}>
                                #{actualRank + 1}
                            </div>

                            {/* Header */}
                            <div className="flex items-center gap-4 mb-6">
                                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold bg-white dark:bg-black/20 shadow-inner ${styles.text} group-hover:rotate-6 transition-transform`}>
                                    {(tl.fullName || tl.email || '?').charAt(0).toUpperCase()}
                                </div>
                                <div className="overflow-hidden flex-1">
                                    <div
                                        className="font-bold text-base truncate flex items-center gap-1 hover:text-primary transition-colors hover:underline decoration-dotted underline-offset-4"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(`/admin/users?highlightUserId=${tl.id}`);
                                        }}
                                    >
                                        {tl.fullName || tl.email || 'Unknown'}
                                        <ExternalLink size={10} className="opacity-50" />
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate opacity-80 group-hover:opacity-100 transition-opacity">{tl.email}</p>
                                    <div className="flex items-center gap-1 mt-0.5">
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/5 dark:bg-white/10 font-mono text-muted-foreground flex items-center gap-0.5">
                                            <Hash size={8} /> {tl.id.slice(0, 6)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Score Bar */}
                            <div className="mb-6 bg-white/50 dark:bg-black/10 p-3 rounded-xl">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-semibold text-muted-foreground">Performance Score</span>
                                    <div className="flex items-center gap-1 text-yellow-600 font-bold">
                                        <Sparkles size={12} className="fill-current" />
                                        {Math.round(tl.score)}
                                    </div>
                                </div>
                                <div className="h-2 w-full bg-black/5 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${Math.min(tl.score, 100)}%` }}
                                        transition={{ duration: 1, ease: "easeOut" }}
                                        className={`h-full rounded-full ${styles.badge}`}
                                    />
                                </div>
                            </div>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <Users size={12} className="text-blue-500" /> Riders
                                    </div>
                                    <p className="font-bold text-sm">
                                        {tl.stats.activeRiders}<span className="text-muted-foreground font-normal">/{tl.stats.totalRiders}</span>
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <CheckCircle size={12} className="text-green-500" /> Conversion
                                    </div>
                                    <p className="font-bold text-sm">{tl.stats.conversionRate}%</p>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <Wallet size={12} className="text-purple-500" /> Avg Wallet
                                    </div>
                                    <p className={`font-bold text-sm ${tl.stats.wallet < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        ₹{tl.stats.totalRiders > 0 ? Math.round(tl.stats.wallet / tl.stats.totalRiders) : 0}
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <Calendar size={12} className="text-orange-500" /> Allotments
                                    </div>
                                    <p className="font-bold text-sm">{tl.stats.totalRiders}</p>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-between pt-4 border-t border-black/5 dark:border-white/5 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                    <Activity size={12} /> Activity: {tl.stats.activity}
                                </div>
                                <div className="flex items-center gap-1">
                                    <Smartphone size={12} /> {tl.stats.leads} Leads
                                </div>
                            </div>

                            {/* Shine Effect on Hover */}
                            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000 z-30 pointer-events-none rounded-3xl" />
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
