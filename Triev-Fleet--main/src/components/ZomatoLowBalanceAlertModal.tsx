import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, Phone, MessageCircle, Sparkles, BatteryMedium } from 'lucide-react';
import { Rider } from '@/types';
import { safeRender } from '@/utils/safeRender';
import {
    ZomatoLowBalancePopupConfig,
    useZomatoVIPPopupConfig,
    ZomatoLowBalanceThemeColor
} from '@/hooks/useZomatoVIPPopupConfig';
import { getCallLink, getWhatsAppLink } from '@/utils/validationUtils';
import AIReminderModal from '@/components/AIReminderModal';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    lowBalanceRiders: Rider[];
    config?: ZomatoLowBalancePopupConfig;
    isInteractivePreview?: boolean;
}

const LOW_BALANCE_THEME_STYLES: Record<ZomatoLowBalanceThemeColor, {
    modalBg: string;
    modalBorder: string;
    shadow: string;
    headerBg: string;
    headerGlow: string;
    iconBg: string;
    iconBorder: string;
    iconColor: string;
    titleColor: string;
    subtitleColor: string;
    closeBtn: string;
    cardBg: string;
    cardBorder: string;
    badgeBg: string;
    badgeText: string;
    walletLabel: string;
    walletValue: string;
    callBtn: string;
    footerBg: string;
    actionBtn: string;
}> = {
    amber: {
        modalBg: 'bg-gradient-to-b from-amber-950/95 to-zinc-950/95',
        modalBorder: 'border-amber-500/50',
        shadow: 'shadow-2xl shadow-amber-500/25',
        headerBg: 'bg-amber-900/40 border-amber-500/30',
        headerGlow: 'bg-amber-500/25',
        iconBg: 'bg-amber-500/20',
        iconBorder: 'border-amber-500/40',
        iconColor: 'text-amber-400',
        titleColor: 'text-amber-50',
        subtitleColor: 'text-amber-300',
        closeBtn: 'bg-amber-900/50 hover:bg-amber-800 text-amber-300 hover:text-amber-100',
        cardBg: 'bg-amber-900/25 hover:bg-amber-900/35',
        cardBorder: 'border-amber-500/25',
        badgeBg: 'bg-amber-500/20',
        badgeText: 'text-amber-300',
        walletLabel: 'text-amber-400',
        walletValue: 'text-amber-200',
        callBtn: 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border-amber-500/30',
        footerBg: 'bg-amber-950/90 border-amber-500/30',
        actionBtn: 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white border-amber-500 shadow-amber-600/30'
    },
    gold: {
        modalBg: 'bg-gradient-to-b from-yellow-950/95 to-stone-950/95',
        modalBorder: 'border-yellow-500/50',
        shadow: 'shadow-2xl shadow-yellow-500/25',
        headerBg: 'bg-yellow-900/40 border-yellow-500/30',
        headerGlow: 'bg-yellow-500/25',
        iconBg: 'bg-yellow-500/20',
        iconBorder: 'border-yellow-500/40',
        iconColor: 'text-yellow-400',
        titleColor: 'text-yellow-50',
        subtitleColor: 'text-yellow-300',
        closeBtn: 'bg-yellow-900/50 hover:bg-yellow-800 text-yellow-300 hover:text-yellow-100',
        cardBg: 'bg-yellow-900/25 hover:bg-yellow-900/35',
        cardBorder: 'border-yellow-500/25',
        badgeBg: 'bg-yellow-500/20',
        badgeText: 'text-yellow-300',
        walletLabel: 'text-yellow-400',
        walletValue: 'text-yellow-200',
        callBtn: 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-200 border-yellow-500/30',
        footerBg: 'bg-yellow-950/90 border-yellow-500/30',
        actionBtn: 'bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-zinc-950 font-black border-yellow-400 shadow-yellow-500/30'
    },
    purple: {
        modalBg: 'bg-gradient-to-b from-purple-950/95 to-zinc-950/95',
        modalBorder: 'border-purple-500/50',
        shadow: 'shadow-2xl shadow-purple-500/25',
        headerBg: 'bg-purple-900/40 border-purple-500/30',
        headerGlow: 'bg-purple-500/25',
        iconBg: 'bg-purple-500/20',
        iconBorder: 'border-purple-500/40',
        iconColor: 'text-purple-400',
        titleColor: 'text-purple-50',
        subtitleColor: 'text-purple-300',
        closeBtn: 'bg-purple-900/50 hover:bg-purple-800 text-purple-300 hover:text-purple-100',
        cardBg: 'bg-purple-900/25 hover:bg-purple-900/35',
        cardBorder: 'border-purple-500/25',
        badgeBg: 'bg-purple-500/20',
        badgeText: 'text-purple-300',
        walletLabel: 'text-purple-400',
        walletValue: 'text-purple-200',
        callBtn: 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border-purple-500/30',
        footerBg: 'bg-purple-950/90 border-purple-500/30',
        actionBtn: 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white border-purple-500 shadow-purple-600/30'
    },
    emerald: {
        modalBg: 'bg-gradient-to-b from-emerald-950/95 to-zinc-950/95',
        modalBorder: 'border-emerald-500/50',
        shadow: 'shadow-2xl shadow-emerald-500/25',
        headerBg: 'bg-emerald-900/40 border-emerald-500/30',
        headerGlow: 'bg-emerald-500/25',
        iconBg: 'bg-emerald-500/20',
        iconBorder: 'border-emerald-500/40',
        iconColor: 'text-emerald-400',
        titleColor: 'text-emerald-50',
        subtitleColor: 'text-emerald-300',
        closeBtn: 'bg-emerald-900/50 hover:bg-emerald-800 text-emerald-300 hover:text-emerald-100',
        cardBg: 'bg-emerald-900/25 hover:bg-emerald-900/35',
        cardBorder: 'border-emerald-500/25',
        badgeBg: 'bg-emerald-500/20',
        badgeText: 'text-emerald-300',
        walletLabel: 'text-emerald-400',
        walletValue: 'text-emerald-200',
        callBtn: 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border-emerald-500/30',
        footerBg: 'bg-emerald-950/90 border-emerald-500/30',
        actionBtn: 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border-emerald-500 shadow-emerald-600/30'
    },
    blue: {
        modalBg: 'bg-gradient-to-b from-cyan-950/95 to-zinc-950/95',
        modalBorder: 'border-cyan-500/50',
        shadow: 'shadow-2xl shadow-cyan-500/25',
        headerBg: 'bg-cyan-900/40 border-cyan-500/30',
        headerGlow: 'bg-cyan-500/25',
        iconBg: 'bg-cyan-500/20',
        iconBorder: 'border-cyan-500/40',
        iconColor: 'text-cyan-400',
        titleColor: 'text-cyan-50',
        subtitleColor: 'text-cyan-300',
        closeBtn: 'bg-cyan-900/50 hover:bg-cyan-800 text-cyan-300 hover:text-cyan-100',
        cardBg: 'bg-cyan-900/25 hover:bg-cyan-900/35',
        cardBorder: 'border-cyan-500/25',
        badgeBg: 'bg-cyan-500/20',
        badgeText: 'text-cyan-300',
        walletLabel: 'text-cyan-400',
        walletValue: 'text-cyan-200',
        callBtn: 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border-cyan-500/30',
        footerBg: 'bg-cyan-950/90 border-cyan-500/30',
        actionBtn: 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white border-cyan-500 shadow-cyan-600/30'
    }
};

const ZomatoLowBalanceAlertModal: React.FC<Props> = ({
    isOpen,
    onClose,
    lowBalanceRiders,
    config: propConfig,
    isInteractivePreview = false
}) => {
    const { lowBalanceConfig: globalConfig } = useZomatoVIPPopupConfig();
    const config = propConfig || globalConfig;
    const [selectedReminderRider, setSelectedReminderRider] = useState<Rider | null>(null);

    const theme = LOW_BALANCE_THEME_STYLES[config.themeColor] || LOW_BALANCE_THEME_STYLES.gold;

    const handleCall = (rider: Rider) => {
        if (isInteractivePreview) return;
        window.open(getCallLink(rider.mobileNumber), '_self');
    };

    const handleWhatsApp = (rider: Rider) => {
        if (isInteractivePreview) return;
        const msg = `नमस्ते ${rider.riderName}, आपका Triev वॉलेट बैलेंस केवल ₹${rider.walletAmount} है। निर्बाध राइडिंग के लिए कृपया तुरंत टॉप-अप करें और कम से कम ₹250 बैलेंस बनाए रखें। 🛵`;
        window.open(getWhatsAppLink(rider.mobileNumber, msg), '_blank');
    };

    const handleOpenAIReminder = (rider: Rider) => {
        if (isInteractivePreview) return;
        setSelectedReminderRider(rider);
    };

    const totalBalanceInLowRange = lowBalanceRiders.reduce((s, r) => s + (r.walletAmount || 0), 0);

    return (
        <>
            <AnimatePresence>
                {isOpen && (
                    <div className={`${isInteractivePreview ? 'relative w-full' : 'fixed inset-0 z-[100]'} flex items-center justify-center p-4 overflow-y-auto`}>
                        {/* Backdrop */}
                        {!isInteractivePreview && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={onClose}
                                className="fixed inset-0 bg-black/80 backdrop-blur-md"
                            />
                        )}

                        {/* Modal Container */}
                        <motion.div
                            initial={isInteractivePreview ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={isInteractivePreview ? undefined : { opacity: 0, scale: 0.95, y: 20 }}
                            transition={{ type: 'spring', duration: 0.35 }}
                            className={`relative w-full ${isInteractivePreview ? 'max-w-none' : 'max-w-2xl'} ${theme.modalBg} border ${theme.modalBorder} rounded-3xl ${theme.shadow} overflow-hidden flex flex-col max-h-[88vh] z-10`}
                        >
                            {/* Top Header */}
                            <div className={`relative px-6 py-4 border-b ${theme.headerBg} flex items-center justify-between overflow-hidden`}>
                                <div className={`absolute -top-12 -left-12 w-32 h-32 rounded-full ${theme.headerGlow} blur-2xl pointer-events-none`} />

                                <div className="flex items-center gap-3 relative z-10">
                                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${theme.iconBg} border ${theme.iconBorder} ${theme.iconColor} shadow-inner`}>
                                        <Zap size={22} className="animate-pulse" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className={`text-base font-black tracking-tight ${theme.titleColor}`}>
                                                {safeRender(config.customTitle || '⚡ Low Balance Alert')}
                                            </h3>
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                                                Zomato VIP &lt; ₹{config.lowBalanceThreshold || 250}
                                            </span>
                                        </div>
                                        <p className={`text-xs ${theme.subtitleColor} mt-0.5 line-clamp-1`}>
                                            {safeRender(config.customSubtitle || 'Zomato VIP Riders with low balance need a recharge top-up.')}
                                        </p>
                                    </div>
                                </div>

                                <button
                                    onClick={onClose}
                                    className={`p-2 rounded-xl border border-white/10 transition-colors ${theme.closeBtn}`}
                                    title="Close alert"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Summary Stat Bar */}
                            <div className="px-6 py-2.5 bg-black/30 border-b border-white/5 flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                    <BatteryMedium size={14} className="text-yellow-400" />
                                    <span className="text-zinc-400 font-medium">Affected VIP Riders:</span>
                                    <strong className="text-yellow-300 font-mono font-black">{lowBalanceRiders.length} Riders</strong>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-zinc-400">Total In-Range Balance:</span>
                                    <strong className="text-yellow-300 font-mono font-black">₹{totalBalanceInLowRange.toLocaleString('en-IN')}</strong>
                                </div>
                            </div>

                            {/* Body Rider Cards */}
                            <div className="p-6 overflow-y-auto space-y-3 custom-scrollbar flex-1">
                                {lowBalanceRiders.length === 0 ? (
                                    <div className="py-12 text-center text-zinc-400">
                                        <Zap size={32} className="mx-auto text-emerald-400 mb-2 opacity-50" />
                                        <p className="text-sm font-semibold">No Zomato VIP riders under ₹{config.lowBalanceThreshold || 250} balance right now!</p>
                                    </div>
                                ) : (
                                    lowBalanceRiders.map((rider) => (
                                        <div
                                            key={rider.id}
                                            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border transition-all ${theme.cardBg} ${theme.cardBorder}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 flex items-center justify-center font-black text-xs font-mono shrink-0">
                                                    {rider.riderName?.charAt(0).toUpperCase() || 'R'}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-bold text-sm text-zinc-100">{safeRender(rider.riderName)}</h4>
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${theme.badgeBg} ${theme.badgeText}`}>
                                                            {safeRender(rider.chassisNumber)}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-zinc-400 font-mono mt-0.5">
                                                        {safeRender(rider.trievId || rider.id)} · {safeRender(rider.mobileNumber)}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
                                                <div className="text-right">
                                                    <span className={`block text-[10px] font-bold uppercase tracking-wider ${theme.walletLabel}`}>
                                                        Current Balance
                                                    </span>
                                                    <span className={`text-base font-black font-mono ${theme.walletValue}`}>
                                                        ₹{(rider.walletAmount || 0).toLocaleString('en-IN')}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        onClick={() => handleCall(rider)}
                                                        className={`p-2 rounded-xl border transition-all active:scale-95 ${theme.callBtn}`}
                                                        title="Direct Call"
                                                    >
                                                        <Phone size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleOpenAIReminder(rider)}
                                                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-zinc-950 text-xs font-black transition-all active:scale-95 shadow-sm shadow-yellow-500/20"
                                                        title="AI Low Balance Reminder"
                                                    >
                                                        <Sparkles size={13} />
                                                        <span>AI Remind</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleWhatsApp(rider)}
                                                        className="p-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition-all active:scale-95"
                                                        title="Direct WhatsApp"
                                                    >
                                                        <MessageCircle size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Footer Action */}
                            <div className={`p-4 border-t ${theme.footerBg} flex items-center justify-between gap-3`}>
                                <span className="text-xs text-zinc-400 hidden sm:inline">
                                    Admin Controlled Low Balance Threshold: &lt; ₹{config.lowBalanceThreshold || 250}
                                </span>
                                <button
                                    onClick={onClose}
                                    className={`w-full sm:w-auto px-6 py-2.5 rounded-xl border font-bold text-xs uppercase tracking-wider transition-all shadow-lg active:scale-95 ${theme.actionBtn}`}
                                >
                                    {safeRender(config.actionButtonText || 'Acknowledge & Remind')}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* AI Multilingual Reminder Modal */}
            {selectedReminderRider && (
                <AIReminderModal
                    rider={selectedReminderRider}
                    type="low_balance"
                    isOpen={Boolean(selectedReminderRider)}
                    onClose={() => setSelectedReminderRider(null)}
                />
            )}
        </>
    );
};

export default ZomatoLowBalanceAlertModal;
