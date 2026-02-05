import React, { useMemo } from 'react';
import { User, Rider, Lead } from '@/types';
import { Trophy, Sparkles, Calendar, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { safeRender } from '@/utils/safeRender';


interface LeaderboardProps {
    teamLeaders: User[];
    riders: Rider[];
    leads?: Lead[];
    action?: React.ReactNode;
    disableClick?: boolean;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ teamLeaders, riders, leads = [], action, disableClick = false }) => {
    // DEBUG: Log incoming data
    console.log('🎯 LEADERBOARD: Received teamLeaders:', teamLeaders.length);
    if (teamLeaders[0]) {
        console.log('🎯 LEADERBOARD: First TL:', JSON.stringify(teamLeaders[0], null, 2));
        console.log('🎯 LEADERBOARD: fullName:', typeof teamLeaders[0].fullName, teamLeaders[0].fullName);
        console.log('🎯 LEADERBOARD: email:', typeof teamLeaders[0].email, teamLeaders[0].email);
    }

    const navigate = useNavigate();
    const location = useLocation();
    const isDashboard = location.pathname.includes('dashboard') || location.pathname === '/admin' || location.pathname === '/team-leader';

    // AI Scoring Algorithm (Same logic, enhanced display)
    const scoredTLs = useMemo(() => {
        console.log('🎯 LEADERBOARD useMemo: Starting calculation');
        console.log('🎯 LEADERBOARD useMemo: teamLeaders.length:', teamLeaders.length);

        const result = teamLeaders.map(tl => {
            console.log('🎯 LEADERBOARD useMemo: Processing TL:', tl.id);
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
                    leads: tlLeads.length,
                    converted: convertedLeads,
                    conversionRate: tlLeads.length > 0 ? Math.round((convertedLeads / tlLeads.length) * 100) : 0,
                    activity: activityScore
                }
            };
            console.log('🎯 LEADERBOARD useMemo: Created tlData:', JSON.stringify(tlData));
            return tlData;
        }).sort((a, b) => b.score - a.score).slice(0, 3);

        console.log('🎯 LEADERBOARD useMemo: Final result:', result.length, 'items');
        return result;
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {podiumOrder.map((tl, idx) => {
                    // Determine actual rank based on sorted list
                    const actualRank = scoredTLs.indexOf(tl);
                    const isFirst = actualRank === 0;
                    const styles = getRankStyles(actualRank);

                    return (
                        <motion.div
                            key={tl.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.3, delay: idx * 0.1 }}
                            className={`relative rounded-xl border p-3 ${styles.bg} ${styles.border} ${styles.shadow} backdrop-blur-sm hover:shadow-md transition-all ${disableClick ? 'cursor-default' : 'cursor-pointer'} ${isFirst ? 'ring-2 ring-yellow-500/30 ring-offset-2 dark:ring-offset-black' : ''}`}
                            onClick={() => {
                                if (disableClick) return;
                                if (isDashboard) {
                                    navigate('/portal/leaderboard');
                                } else {
                                    navigate(`/portal/users?highlightUserId=${tl.id}`);
                                }
                            }}
                        >
                            {/* Rank & User Info Row */}
                            <div className="flex items-center gap-3 mb-2">
                                <div className={`relative w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center text-sm font-bold bg-white dark:bg-black/20 shadow-sm ${styles.text}`}>
                                    {safeRender(tl.fullName || tl.email || '?').charAt(0).toUpperCase()}
                                    <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full ${styles.badge} text-[10px] text-white flex items-center justify-center shadow-sm`}>
                                        #{actualRank + 1}
                                    </div>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between">
                                        <div className="font-bold text-sm truncate pr-2">
                                            {safeRender(tl.fullName || 'Unknown')}
                                        </div>
                                        <div className="flex items-center gap-1 text-yellow-600 font-bold text-xs bg-white/50 dark:bg-black/10 px-1.5 py-0.5 rounded">
                                            <Sparkles size={8} className="fill-current" />
                                            {Math.round(tl.score)}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between mt-0.5">
                                        <p className="text-[10px] text-muted-foreground truncate opacity-80">
                                            {safeRender(tl.role)}
                                        </p>
                                        <span className="text-[9px] font-mono text-muted-foreground bg-black/5 dark:bg-white/5 px-1 rounded">
                                            ID: {safeRender(tl.id).slice(0, 4)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Score Progress */}
                            <div className="h-1 w-full bg-black/5 rounded-full overflow-hidden mb-3">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.min(tl.score, 100)}%` }}
                                    className={`h-full rounded-full ${styles.badge}`}
                                />
                            </div>

                            {/* Dense Stats Grid */}
                            <div className="grid grid-cols-4 gap-1 mb-2">
                                <div className="bg-white/40 dark:bg-black/5 rounded p-1 text-center">
                                    <div className="text-[9px] text-muted-foreground">Riders</div>
                                    <div className="text-xs font-bold text-blue-600">{tl.stats.activeRiders}</div>
                                </div>
                                <div className="bg-white/40 dark:bg-black/5 rounded p-1 text-center">
                                    <div className="text-[9px] text-muted-foreground">Conv.</div>
                                    <div className="text-xs font-bold text-green-600">{tl.stats.conversionRate}%</div>
                                </div>
                                <div className="bg-white/40 dark:bg-black/5 rounded p-1 text-center">
                                    <div className="text-[9px] text-muted-foreground">Wallet</div>
                                    <div className={`text-xs font-bold ${tl.stats.wallet < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                                        {tl.stats.wallet >= 1000 ? `${(tl.stats.wallet / 1000).toFixed(1)}k` : tl.stats.wallet}
                                    </div>
                                </div>
                                <div className="bg-white/40 dark:bg-black/5 rounded p-1 text-center">
                                    <div className="text-[9px] text-muted-foreground">Leads</div>
                                    <div className="text-xs font-bold text-orange-600">{tl.stats.leads}</div>
                                </div>
                            </div>

                            {/* Footer Metrics */}
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
                                <span className="flex items-center gap-1">
                                    <Activity size={10} /> Act: {tl.stats.activity}
                                </span>
                                <span className="flex items-center gap-1">
                                    <Calendar size={10} /> Total: {tl.stats.totalRiders}
                                </span>
                            </div>

                            {/* Shine Effect */}
                            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000 pointer-events-none rounded-xl" />
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
