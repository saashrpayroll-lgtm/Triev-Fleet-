import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { AlertTriangle, TrendingDown, Phone, X, ChevronRight, RefreshCw, Bot, Bell } from 'lucide-react';
import { supabase } from '@/config/supabase';

interface AlertRider {
    id: string;
    triev_id: string;
    rider_name: string;
    mobile_number: string;
    wallet_amount: number;
    status: string;
}

interface LiveAlertCenterProps {
    /** If provided, only show riders belonging to this TL's ID */
    teamLeaderId?: string;
    /** Admin portal base path for links */
    portalBase?: string;
}

const LiveAlertCenter: React.FC<LiveAlertCenterProps> = ({
    teamLeaderId,
    portalBase = '/portal'
}) => {
    const [negativeRiders, setNegativeRiders] = useState<AlertRider[]>([]);
    const [lowBalanceRiders, setLowBalanceRiders] = useState<AlertRider[]>([]);
    const [loading, setLoading] = useState(true);
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());
    const [expanded, setExpanded] = useState(true);
    const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

    const fetchAlertRiders = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('riders')
                .select('id, triev_id, rider_name, mobile_number, wallet_amount, status')
                .neq('status', 'deleted')
                .neq('status', 'inactive');

            if (teamLeaderId) {
                query = query.eq('team_leader_id', teamLeaderId);
            }

            const { data, error } = await query.order('wallet_amount', { ascending: true }).limit(30);
            if (error) throw error;

            const riders = data || [];
            setNegativeRiders(riders.filter(r => r.wallet_amount < 0));
            setLowBalanceRiders(riders.filter(r => r.wallet_amount >= 0 && r.wallet_amount < 250));
            setLastRefreshed(new Date());
        } catch (e) {
            console.error('[LiveAlertCenter] fetch failed:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAlertRiders();

        // Realtime subscription
        const channel = supabase
            .channel('alert-center-riders')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'riders' }, () => {
                fetchAlertRiders();
            })
            .subscribe();

        // Also refresh every 90 seconds as fallback
        const interval = setInterval(fetchAlertRiders, 90_000);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(interval);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [teamLeaderId]);

    const visibleNegative = negativeRiders.filter(r => !dismissed.has(r.id));
    const visibleLow = lowBalanceRiders.filter(r => !dismissed.has(r.id));
    const totalAlerts = visibleNegative.length + visibleLow.length;

    if (!loading && totalAlerts === 0) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="w-full mb-6 rounded-2xl overflow-hidden border border-red-500/20 dark:border-red-500/30 shadow-md bg-card"
        >
            {/* Alert Header */}
            <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer select-none bg-gradient-to-r from-red-500/10 via-amber-500/5 to-red-500/10 dark:from-red-950/40 dark:via-amber-950/20 dark:to-red-950/40 border-b border-red-500/15"
                onClick={() => setExpanded(e => !e)}
            >
                <div className="flex items-center gap-3">
                    <motion.div
                        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-red-500/15 dark:bg-red-500/25 border border-red-500/30"
                        animate={{ boxShadow: ['0 0 0px rgba(239,68,68,0)', '0 0 12px rgba(239,68,68,0.4)', '0 0 0px rgba(239,68,68,0)'] }}
                        transition={{ duration: 2, repeat: Infinity }}
                    >
                        <Bell size={16} className="text-red-600 dark:text-red-400" />
                    </motion.div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-foreground">Live Alert Center</span>
                            {loading ? (
                                <RefreshCw size={11} className="text-muted-foreground animate-spin" />
                            ) : (
                                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-red-500/15 dark:bg-red-500/20 text-red-600 dark:text-red-300 border border-red-500/30">
                                    {totalAlerts} Active
                                </span>
                            )}
                        </div>
                        <p className="text-[10px] text-muted-foreground font-mono">
                            Last refresh: {lastRefreshed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={(e) => { e.stopPropagation(); fetchAlertRiders(); }}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                        title="Refresh"
                    >
                        <RefreshCw size={13} />
                    </button>
                    <ChevronRight
                        size={16}
                        className="text-muted-foreground transition-transform duration-300"
                        style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                    />
                </div>
            </div>

            {/* Alert Body */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden bg-card/90 dark:bg-black/30"
                    >
                        <div className="p-4 space-y-4">
                            {/* Negative Balance Section */}
                            {visibleNegative.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <TrendingDown size={13} className="text-red-600 dark:text-red-400" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-red-600 dark:text-red-400">
                                            Negative Balance ({visibleNegative.length})
                                        </span>
                                        {portalBase === '/portal' && (
                                            <Link
                                                to={`${portalBase}/ai-calling`}
                                                className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/15 border border-red-500/30 text-red-700 dark:text-red-300 text-[9px] font-black hover:bg-red-500/25 transition-colors"
                                            >
                                                <Bot size={10} />
                                                AI Call All
                                            </Link>
                                        )}
                                    </div>
                                    <div className="space-y-1.5">
                                        {visibleNegative.slice(0, 5).map((rider) => (
                                            <motion.div
                                                key={rider.id}
                                                initial={{ opacity: 0, x: -8 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-red-500/10 dark:bg-red-500/10 border border-red-500/20 group"
                                            >
                                                {/* Avatar */}
                                                <div
                                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-black shrink-0 ring-1 ring-red-500/30"
                                                    style={{ background: `hsl(${rider.rider_name?.charCodeAt(0) * 47 % 360}, 60%, 38%)` }}
                                                >
                                                    {rider.rider_name?.slice(0, 2).toUpperCase() || '??'}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-foreground truncate">{rider.rider_name}</p>
                                                    <p className="text-[10px] text-muted-foreground">{rider.triev_id} · {rider.mobile_number}</p>
                                                </div>
                                                <span className="text-red-600 dark:text-red-400 font-black text-sm shrink-0">
                                                    ₹{Math.abs(rider.wallet_amount).toLocaleString('en-IN')} ↓
                                                </span>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <a
                                                        href={`tel:${rider.mobile_number}`}
                                                        className="p-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 transition-colors"
                                                        title="Call Rider"
                                                    >
                                                        <Phone size={12} />
                                                    </a>
                                                    <button
                                                        onClick={() => setDismissed(d => new Set([...d, rider.id]))}
                                                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
                                                        title="Dismiss alert"
                                                    >
                                                        <X size={11} />
                                                    </button>
                                                </div>
                                            </motion.div>
                                        ))}
                                        {visibleNegative.length > 5 && (
                                            <Link to={`${portalBase}/riders`}
                                                className="block text-center text-[10px] text-red-600/80 dark:text-red-400/70 hover:text-red-600 dark:hover:text-red-400 font-bold py-1.5 transition-colors">
                                                +{visibleNegative.length - 5} more negative riders → View all
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Low Balance Section */}
                            {visibleLow.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <AlertTriangle size={13} className="text-amber-600 dark:text-amber-400" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">
                                            Low Balance &lt;₹250 ({visibleLow.length})
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {visibleLow.slice(0, 8).map((rider) => (
                                            <motion.div
                                                key={rider.id}
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 dark:bg-amber-500/10 border border-amber-500/20 group"
                                            >
                                                <div
                                                    className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[9px] font-black shrink-0"
                                                    style={{ background: `hsl(${rider.rider_name?.charCodeAt(0) * 47 % 360}, 60%, 38%)` }}
                                                >
                                                    {rider.rider_name?.charAt(0).toUpperCase() || '?'}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[11px] font-bold text-foreground truncate max-w-[100px]">{rider.rider_name}</p>
                                                    <p className="text-[9px] text-amber-700 dark:text-amber-400 font-black">₹{rider.wallet_amount}</p>
                                                </div>
                                                <button
                                                    onClick={() => setDismissed(d => new Set([...d, rider.id]))}
                                                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
                                                >
                                                    <X size={10} />
                                                </button>
                                            </motion.div>
                                        ))}
                                        {visibleLow.length > 8 && (
                                            <div className="flex items-center px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-[10px] font-bold">
                                                +{visibleLow.length - 8} more
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default LiveAlertCenter;
