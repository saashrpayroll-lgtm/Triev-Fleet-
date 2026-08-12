import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { AlertTriangle, TrendingDown, Phone, X, RefreshCw, Bot, Bell } from 'lucide-react';
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
    const [drawerOpen, setDrawerOpen] = useState(false);

    if (!loading && totalAlerts === 0) return null;

    const totalNegativeDebt = visibleNegative.reduce((acc, r) => acc + Math.abs(r.wallet_amount), 0);

    return (
        <>
            {/* Sleek Compact Alert Bar (Only ~38px height) */}
            <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="w-full mb-4 rounded-xl overflow-hidden border border-red-500/30 bg-gradient-to-r from-red-500/15 via-rose-500/10 to-amber-500/10 dark:from-red-950/60 dark:via-rose-950/40 dark:to-amber-950/40 shadow-sm backdrop-blur-md"
            >
                <div className="flex items-center justify-between px-3.5 py-2">
                    <div
                        className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0"
                        onClick={() => setDrawerOpen(true)}
                    >
                        <div className="relative flex items-center justify-center shrink-0">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping absolute" />
                            <span className="w-2.5 h-2.5 rounded-full bg-red-600 relative" />
                        </div>

                        <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs font-black text-foreground whitespace-nowrap">Live Alerts</span>
                            <span className="px-1.5 py-0.2 rounded-md text-[10px] font-black bg-red-500/20 text-red-600 dark:text-red-300 border border-red-500/30 shrink-0">
                                {totalAlerts}
                            </span>
                            <span className="text-[11px] text-muted-foreground truncate hidden sm:inline">
                                {visibleNegative.length > 0 && `${visibleNegative.length} Negative (₹${totalNegativeDebt.toLocaleString('en-IN')})`}
                                {visibleNegative.length > 0 && visibleLow.length > 0 && ' • '}
                                {visibleLow.length > 0 && `${visibleLow.length} Low Balance`}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {portalBase === '/portal' && visibleNegative.length > 0 && (
                            <Link
                                to={`${portalBase}/ai-calling`}
                                className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/20 border border-red-500/30 text-red-700 dark:text-red-300 text-[10px] font-black hover:bg-red-500/30 transition-colors"
                            >
                                <Bot size={11} />
                                AI Call All
                            </Link>
                        )}
                        <button
                            onClick={() => setDrawerOpen(true)}
                            className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[10px] font-black tracking-tight transition-all flex items-center gap-1 shadow-sm"
                        >
                            <Bell size={11} />
                            <span>View ({totalAlerts})</span>
                        </button>
                    </div>
                </div>
            </motion.div>

            {/* Slide-over Drawer for Live Alert Details */}
            <AnimatePresence>
                {drawerOpen && (
                    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in">
                        {/* Backdrop Click */}
                        <div className="absolute inset-0" onClick={() => setDrawerOpen(false)} />

                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                            className="relative w-full max-w-md h-full bg-card text-card-foreground shadow-2xl border-l border-red-500/20 flex flex-col overflow-hidden"
                        >
                            {/* Drawer Header */}
                            <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 bg-gradient-to-r from-red-500/10 to-amber-500/10">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-red-500/20 border border-red-500/30 text-red-600 dark:text-red-400">
                                        <Bell size={16} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-foreground">Live Alert Center</h3>
                                        <p className="text-[10px] text-muted-foreground font-mono">
                                            Refreshed: {lastRefreshed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={fetchAlertRiders}
                                        className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                                        title="Refresh"
                                    >
                                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                                    </button>
                                    <button
                                        onClick={() => setDrawerOpen(false)}
                                        className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Drawer Content Body */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                                {/* Negative Balance Section */}
                                {visibleNegative.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-1.5">
                                                <TrendingDown size={13} className="text-red-600 dark:text-red-400" />
                                                <span className="text-[11px] font-black uppercase tracking-wider text-red-600 dark:text-red-400">
                                                    Negative Wallet ({visibleNegative.length})
                                                </span>
                                            </div>
                                            {portalBase === '/portal' && (
                                                <Link
                                                    to={`${portalBase}/ai-calling`}
                                                    onClick={() => setDrawerOpen(false)}
                                                    className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/15 border border-red-500/30 text-red-600 dark:text-red-300 text-[9px] font-bold"
                                                >
                                                    <Bot size={10} />
                                                    AI Call All
                                                </Link>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            {visibleNegative.map((rider) => (
                                                <div
                                                    key={rider.id}
                                                    className="flex items-center gap-3 p-3 rounded-xl bg-red-500/10 dark:bg-red-950/30 border border-red-500/20"
                                                >
                                                    <div
                                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-black shrink-0 shadow-sm"
                                                        style={{ background: `hsl(${rider.rider_name?.charCodeAt(0) * 47 % 360}, 60%, 38%)` }}
                                                    >
                                                        {rider.rider_name?.slice(0, 2).toUpperCase() || '??'}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-bold text-foreground truncate">{rider.rider_name}</p>
                                                        <p className="text-[10px] text-muted-foreground">{rider.triev_id} · {rider.mobile_number}</p>
                                                    </div>
                                                    <span className="text-red-600 dark:text-red-400 font-black text-xs shrink-0 font-mono">
                                                        -₹{Math.abs(rider.wallet_amount).toLocaleString('en-IN')}
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
                                                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                                            title="Dismiss alert"
                                                        >
                                                            <X size={11} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Low Balance Section */}
                                {visibleLow.length > 0 && (
                                    <div className="space-y-2 pt-2 border-t border-border/40">
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <AlertTriangle size={13} className="text-amber-600 dark:text-amber-400" />
                                            <span className="text-[11px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
                                                Low Balance &lt;₹250 ({visibleLow.length})
                                            </span>
                                        </div>
                                        <div className="space-y-2">
                                            {visibleLow.map((rider) => (
                                                <div
                                                    key={rider.id}
                                                    className="flex items-center gap-3 p-2.5 rounded-xl bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/20"
                                                >
                                                    <div
                                                        className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[9px] font-black shrink-0"
                                                        style={{ background: `hsl(${rider.rider_name?.charCodeAt(0) * 47 % 360}, 60%, 38%)` }}
                                                    >
                                                        {rider.rider_name?.charAt(0).toUpperCase() || '?'}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-bold text-foreground truncate">{rider.rider_name}</p>
                                                        <p className="text-[9px] text-muted-foreground">{rider.mobile_number}</p>
                                                    </div>
                                                    <span className="text-amber-700 dark:text-amber-400 font-bold text-xs shrink-0 font-mono">
                                                        ₹{rider.wallet_amount}
                                                    </span>
                                                    <button
                                                        onClick={() => setDismissed(d => new Set([...d, rider.id]))}
                                                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                                    >
                                                        <X size={11} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Drawer Footer Link */}
                            <div className="p-3 border-t border-border/40 bg-muted/20 text-center">
                                <Link
                                    to={`${portalBase}/riders`}
                                    onClick={() => setDrawerOpen(false)}
                                    className="text-xs font-bold text-primary hover:underline"
                                >
                                    Go to Full Rider Management →
                                </Link>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
};

export default LiveAlertCenter;
