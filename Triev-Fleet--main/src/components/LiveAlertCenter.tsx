import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { AlertTriangle, TrendingDown, Phone, X, RefreshCw, Bot, Bell, MessageCircle, Sparkles } from 'lucide-react';
import { supabase } from '@/config/supabase';
import { Rider } from '@/types';
import AIReminderModal, { ReminderType } from '@/components/AIReminderModal';
import { getCallLink, getWhatsAppLink } from '@/utils/validationUtils';
import { toast } from 'sonner';

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
    const [drawerOpen, setDrawerOpen] = useState(false);

    // AI Reminder Modal State
    const [selectedReminderRider, setSelectedReminderRider] = useState<Rider | null>(null);
    const [reminderType, setReminderType] = useState<ReminderType>('low_balance');

    const mapAlertToRider = (ar: AlertRider): Rider => ({
        id: ar.id,
        trievId: ar.triev_id || '',
        riderName: ar.rider_name || 'Rider',
        mobileNumber: ar.mobile_number || '',
        chassisNumber: '',
        clientName: '' as any,
        walletAmount: Number(ar.wallet_amount || 0),
        status: (ar.status || 'active') as any,
        allotmentDate: '',
        remarks: '',
        teamLeaderId: teamLeaderId || '',
        teamLeaderName: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });

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

            const { data, error } = await query.order('wallet_amount', { ascending: true }).limit(50);
            if (error) throw error;

            const riders = data || [];
            setNegativeRiders(riders.filter(r => Number(r.wallet_amount) < 0));
            setLowBalanceRiders(riders.filter(r => Number(r.wallet_amount) >= 0 && Number(r.wallet_amount) < 250));
            setLastRefreshed(new Date());
        } catch (e) {
            console.error('[LiveAlertCenter] fetch failed:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAlertRiders();

        // ✅ EGRESS OPTIMIZED: Fixed channel name prevents duplicate connections on each mount.
        // A random suffix created a new Supabase connection every time this component mounted.
        const channel = supabase
            .channel('live-alert-riders')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'riders' }, () => {
                fetchAlertRiders();
            })
            .subscribe();

        // ✅ EGRESS OPTIMIZED: Reduced fallback poll from 90s to 10 min.
        // The realtime subscription above handles instant updates.
        const interval = setInterval(fetchAlertRiders, 10 * 60 * 1000);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(interval);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [teamLeaderId]);

    const visibleNegative = negativeRiders.filter(r => !dismissed.has(r.id));
    const visibleLow = lowBalanceRiders.filter(r => !dismissed.has(r.id));
    const totalAlerts = visibleNegative.length + visibleLow.length;

    const handleOpenAIReminder = (ar: AlertRider, type: ReminderType) => {
        setSelectedReminderRider(mapAlertToRider(ar));
        setReminderType(type);
    };

    const handleCallRider = (phone: string) => {
        if (!phone) {
            toast.error('Mobile number not available');
            return;
        }
        window.open(getCallLink(phone), '_self');
    };

    const handleDirectWhatsApp = (ar: AlertRider, isNegative: boolean) => {
        if (!ar.mobile_number) {
            toast.error('Mobile number not available');
            return;
        }
        const phone = ar.mobile_number.replace(/\D/g, '');
        const amt = Math.abs(ar.wallet_amount);
        let msg = '';
        if (isNegative) {
            msg = `नमस्ते ${ar.rider_name}, आपका Triev वॉलेट बैलेंस ₹-${amt.toLocaleString('en-IN')} (Negative) है। कृपया अपनी सेवा जारी रखने के लिए तुरंत बकाया राशि का भुगतान करें। धन्यवाद! 🛵`;
        } else {
            msg = `नमस्ते ${ar.rider_name}, आपका Triev वॉलेट बैलेंस केवल ₹${ar.wallet_amount} है। निर्बाध राइडिंग के लिए कृपया तुरंत टॉप-अप करें और कम से कम ₹250 बैलेंस बनाए रखें। 🛵`;
        }
        window.open(getWhatsAppLink(phone, msg), '_blank');
    };

    if (!loading && totalAlerts === 0) return null;

    const totalNegativeDebt = visibleNegative.reduce((acc, r) => acc + Math.abs(r.wallet_amount), 0);

    return (
        <>
            {/* Sleek Compact Alert Bar */}
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
                                {visibleLow.length > 0 && `${visibleLow.length} Low Balance (<₹250)`}
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
                            className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[10px] font-black tracking-tight transition-all flex items-center gap-1 shadow-sm active:scale-95"
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
                            className="relative w-full max-w-lg h-full bg-card text-card-foreground shadow-2xl border-l border-red-500/20 flex flex-col overflow-hidden"
                        >
                            {/* Drawer Header */}
                            <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 bg-gradient-to-r from-red-500/10 to-amber-500/10">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-red-500/20 border border-red-500/30 text-red-600 dark:text-red-400">
                                        <Bell size={16} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                                            Live Alert Center
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500 text-white font-mono">
                                                {totalAlerts} Active
                                            </span>
                                        </h3>
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
                            <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
                                {/* Negative Balance Section */}
                                {visibleNegative.length > 0 && (
                                    <div className="space-y-2.5">
                                        <div className="flex items-center justify-between pb-1 border-b border-red-500/20">
                                            <div className="flex items-center gap-1.5">
                                                <TrendingDown size={14} className="text-red-600 dark:text-red-400" />
                                                <span className="text-xs font-black uppercase tracking-wider text-red-600 dark:text-red-400">
                                                    Negative Balance ({visibleNegative.length})
                                                </span>
                                            </div>
                                            <span className="text-[11px] font-mono font-black text-red-600 dark:text-red-400">
                                                ₹{totalNegativeDebt.toLocaleString('en-IN')} Total Debt
                                            </span>
                                        </div>

                                        <div className="space-y-2">
                                            {visibleNegative.map((rider) => {
                                                const isCritical = Number(rider.wallet_amount) <= -699;
                                                return (
                                                    <div
                                                        key={rider.id}
                                                        className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 p-3 rounded-2xl border transition-all ${
                                                            isCritical
                                                                ? 'bg-red-500/10 dark:bg-red-950/40 border-red-500/30'
                                                                : 'bg-rose-500/5 dark:bg-rose-950/20 border-rose-500/20'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                            <div
                                                                className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-black shrink-0 shadow-sm"
                                                                style={{ background: isCritical ? '#dc2626' : '#ea580c' }}
                                                            >
                                                                {rider.rider_name?.slice(0, 2).toUpperCase() || '??'}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-center gap-1.5">
                                                                    <p className="text-xs font-bold text-foreground truncate">{rider.rider_name}</p>
                                                                    {isCritical && (
                                                                        <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-red-600 text-white shrink-0">
                                                                            CRITICAL
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className="text-[10px] text-muted-foreground font-mono">
                                                                    {rider.triev_id} · {rider.mobile_number}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-border/40">
                                                            <span className="text-red-600 dark:text-red-400 font-black text-xs font-mono">
                                                                -₹{Math.abs(rider.wallet_amount).toLocaleString('en-IN')}
                                                            </span>

                                                            <div className="flex items-center gap-1">
                                                                {/* 1-Click Call Button */}
                                                                <button
                                                                    onClick={() => handleCallRider(rider.mobile_number)}
                                                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-xs font-bold transition-all active:scale-95 shadow-sm border border-emerald-500/20"
                                                                    title="Direct Call"
                                                                >
                                                                    <Phone size={12} />
                                                                    <span className="hidden sm:inline">Call</span>
                                                                </button>

                                                                {/* 1-Click AI Reminder WhatsApp Button */}
                                                                <button
                                                                    onClick={() => handleOpenAIReminder(rider, isCritical ? 'critical' : 'warning')}
                                                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all active:scale-95 shadow-sm shadow-emerald-600/20"
                                                                    title="AI WhatsApp Reminder Modal"
                                                                >
                                                                    <Sparkles size={12} />
                                                                    <MessageCircle size={12} />
                                                                    <span className="hidden sm:inline">AI WA</span>
                                                                </button>

                                                                {/* Quick Direct WA */}
                                                                <button
                                                                    onClick={() => handleDirectWhatsApp(rider, true)}
                                                                    className="p-1.5 rounded-xl bg-green-500/15 hover:bg-green-500/25 text-green-600 dark:text-green-400 transition-colors"
                                                                    title="Quick Direct WhatsApp"
                                                                >
                                                                    <MessageCircle size={13} />
                                                                </button>

                                                                {/* Dismiss Button */}
                                                                <button
                                                                    onClick={() => setDismissed(d => new Set([...d, rider.id]))}
                                                                    className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                                                    title="Dismiss alert"
                                                                >
                                                                    <X size={13} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Low Balance Section */}
                                {visibleLow.length > 0 && (
                                    <div className="space-y-2.5 pt-2 border-t border-border/40">
                                        <div className="flex items-center justify-between pb-1 border-b border-amber-500/20">
                                            <div className="flex items-center gap-1.5">
                                                <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400" />
                                                <span className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
                                                    Low Balance &lt; ₹250 ({visibleLow.length})
                                                </span>
                                            </div>
                                            <span className="text-[10px] text-muted-foreground font-medium">
                                                Positive ₹0 - ₹249 Top-Up Required
                                            </span>
                                        </div>

                                        <div className="space-y-2">
                                            {visibleLow.map((rider) => (
                                                <div
                                                    key={rider.id}
                                                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 p-3 rounded-2xl bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/25 transition-all"
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                        <div
                                                            className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-black shrink-0 shadow-sm"
                                                            style={{ background: '#d97706' }}
                                                        >
                                                            {rider.rider_name?.charAt(0).toUpperCase() || '?'}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-xs font-bold text-foreground truncate">{rider.rider_name}</p>
                                                            <p className="text-[10px] text-muted-foreground font-mono">
                                                                {rider.triev_id} · {rider.mobile_number}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-border/40">
                                                        <span className="text-amber-700 dark:text-amber-400 font-bold text-xs font-mono">
                                                            ₹{rider.wallet_amount}
                                                        </span>

                                                        <div className="flex items-center gap-1">
                                                            {/* 1-Click Call Button */}
                                                            <button
                                                                onClick={() => handleCallRider(rider.mobile_number)}
                                                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-xs font-bold transition-all active:scale-95 shadow-sm border border-emerald-500/20"
                                                                title="Direct Call"
                                                            >
                                                                <Phone size={12} />
                                                                <span className="hidden sm:inline">Call</span>
                                                            </button>

                                                            {/* 1-Click AI Reminder WhatsApp Button */}
                                                            <button
                                                                onClick={() => handleOpenAIReminder(rider, 'low_balance')}
                                                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all active:scale-95 shadow-sm shadow-amber-500/20"
                                                                title="AI Low Balance Reminder Modal"
                                                            >
                                                                <Sparkles size={12} />
                                                                <MessageCircle size={12} />
                                                                <span className="hidden sm:inline">AI WA</span>
                                                            </button>

                                                            {/* Quick Direct WA */}
                                                            <button
                                                                onClick={() => handleDirectWhatsApp(rider, false)}
                                                                className="p-1.5 rounded-xl bg-orange-500/15 hover:bg-orange-500/25 text-orange-600 dark:text-orange-400 transition-colors"
                                                                title="Quick Direct WhatsApp"
                                                            >
                                                                <MessageCircle size={13} />
                                                            </button>

                                                            {/* Dismiss Button */}
                                                            <button
                                                                onClick={() => setDismissed(d => new Set([...d, rider.id]))}
                                                                className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                                                title="Dismiss alert"
                                                            >
                                                                <X size={13} />
                                                            </button>
                                                        </div>
                                                    </div>
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

            {/* Global AI Reminder Modal Integration for Live Alerts */}
            {selectedReminderRider && (
                <AIReminderModal
                    rider={selectedReminderRider}
                    type={reminderType}
                    isOpen={Boolean(selectedReminderRider)}
                    onClose={() => setSelectedReminderRider(null)}
                />
            )}
        </>
    );
};

export default LiveAlertCenter;
