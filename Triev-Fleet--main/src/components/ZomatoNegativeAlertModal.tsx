import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldAlert, Phone, MessageCircle } from 'lucide-react';
import { Rider } from '@/types';
import { safeRender } from '@/utils/safeRender';
import { ZomatoVIPPopupConfig, useZomatoVIPPopupConfig, ZomatoThemeColor } from '@/hooks/useZomatoVIPPopupConfig';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    negativeRiders: Rider[];
    config?: ZomatoVIPPopupConfig;
    isInteractivePreview?: boolean;
}

const THEME_STYLES: Record<ZomatoThemeColor, {
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
    crimson: {
        modalBg: 'bg-gradient-to-b from-red-950/95 to-zinc-950/95',
        modalBorder: 'border-red-500/50',
        shadow: 'shadow-2xl shadow-red-500/25',
        headerBg: 'bg-red-900/40 border-red-500/30',
        headerGlow: 'bg-red-500/25',
        iconBg: 'bg-red-500/20',
        iconBorder: 'border-red-500/40',
        iconColor: 'text-red-400',
        titleColor: 'text-red-50',
        subtitleColor: 'text-red-300',
        closeBtn: 'bg-red-900/50 hover:bg-red-800 text-red-300 hover:text-red-100',
        cardBg: 'bg-red-900/25 hover:bg-red-900/35',
        cardBorder: 'border-red-500/25',
        badgeBg: 'bg-red-500/20',
        badgeText: 'text-red-300',
        walletLabel: 'text-red-400',
        walletValue: 'text-red-200',
        callBtn: 'bg-red-500/20 hover:bg-red-500/30 text-red-200 border-red-500/30',
        footerBg: 'bg-red-950/90 border-red-500/30',
        actionBtn: 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white border-red-500 shadow-red-600/30'
    },
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
        actionBtn: 'bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white border-purple-500 shadow-purple-600/30'
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
        modalBg: 'bg-gradient-to-b from-blue-950/95 to-zinc-950/95',
        modalBorder: 'border-blue-500/50',
        shadow: 'shadow-2xl shadow-blue-500/25',
        headerBg: 'bg-blue-900/40 border-blue-500/30',
        headerGlow: 'bg-blue-500/25',
        iconBg: 'bg-blue-500/20',
        iconBorder: 'border-blue-500/40',
        iconColor: 'text-blue-400',
        titleColor: 'text-blue-50',
        subtitleColor: 'text-blue-300',
        closeBtn: 'bg-blue-900/50 hover:bg-blue-800 text-blue-300 hover:text-blue-100',
        cardBg: 'bg-blue-900/25 hover:bg-blue-900/35',
        cardBorder: 'border-blue-500/25',
        badgeBg: 'bg-blue-500/20',
        badgeText: 'text-blue-300',
        walletLabel: 'text-blue-400',
        walletValue: 'text-blue-200',
        callBtn: 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 border-blue-500/30',
        footerBg: 'bg-blue-950/90 border-blue-500/30',
        actionBtn: 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border-blue-500 shadow-blue-600/30'
    }
};

const ZomatoNegativeAlertModal: React.FC<Props> = ({
    isOpen,
    onClose,
    negativeRiders,
    config: directConfig,
    isInteractivePreview = false
}) => {
    const { config: globalConfig } = useZomatoVIPPopupConfig();
    const config = directConfig || globalConfig;

    if (!isOpen) return null;

    const themeKey = config.themeColor || 'crimson';
    const theme = THEME_STYLES[themeKey] || THEME_STYLES.crimson;

    const handleCall = (phoneNumber: string) => {
        if (!phoneNumber) return;
        window.open(`tel:${phoneNumber}`, '_self');
    };

    const handleWhatsApp = (phoneNumber: string, riderName: string, amount: number) => {
        if (!phoneNumber) return;
        const msg = `Hi ${riderName}, your Zomato VIP Wallet balance is critically low (₹${Math.abs(amount).toLocaleString('en-IN')}). Please recharge immediately to avoid ID deactivation.`;
        window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(msg)}`, '_blank');
    };

    const title = config.customTitle || 'Critical Alert';
    const subtitle = config.customSubtitle || `${negativeRiders.length} Zomato VIP ${negativeRiders.length === 1 ? 'Rider has' : 'Riders have'} 0 or negative wallet balances.`;
    const actionText = config.actionButtonText || 'Acknowledge & Close';

    return (
        <AnimatePresence>
            <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${isInteractivePreview ? 'relative inset-auto z-0 p-0' : ''}`}>
                {!isInteractivePreview && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/70 backdrop-blur-md"
                    />
                )}

                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className={`relative w-full max-w-lg ${theme.modalBg} border ${theme.modalBorder} rounded-2xl ${theme.shadow} backdrop-blur-2xl overflow-hidden flex flex-col max-h-[85vh] z-10`}
                >
                    {/* Header */}
                    <div className={`flex items-start justify-between p-5 border-b ${theme.headerBg} relative overflow-hidden`}>
                        <div className={`absolute top-0 right-0 w-36 h-36 ${theme.headerGlow} rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none`} />
                        <div className="flex gap-3.5 relative z-10 items-center">
                            <div className={`w-12 h-12 rounded-xl ${theme.iconBg} border ${theme.iconBorder} flex items-center justify-center flex-shrink-0 shadow-inner`}>
                                <ShieldAlert size={26} className={theme.iconColor} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className={`text-lg font-black ${theme.titleColor} uppercase tracking-wider`}>{title}</h2>
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white/10 text-white/90 border border-white/10 uppercase tracking-widest">
                                        ZOMATO VIP
                                    </span>
                                </div>
                                <p className={`text-xs font-medium mt-1 leading-relaxed ${theme.subtitleColor}`}>
                                    {subtitle}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className={`p-2 rounded-xl transition-all relative z-10 ${theme.closeBtn}`}
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Content List */}
                    <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                        {negativeRiders.length === 0 ? (
                            <div className="py-8 text-center text-white/50 text-xs">
                                No negative Zomato VIP riders found matching the threshold.
                            </div>
                        ) : (
                            negativeRiders.map(rider => (
                                <div
                                    key={rider.id}
                                    className={`${theme.cardBg} border ${theme.cardBorder} rounded-xl p-3.5 flex flex-col sm:flex-row gap-3 sm:items-center justify-between transition-all`}
                                >
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-white text-sm">{safeRender(rider.riderName)}</span>
                                            <span className={`text-[10px] font-mono px-1.5 py-0.5 ${theme.badgeBg} ${theme.badgeText} rounded uppercase font-semibold`}>
                                                {safeRender(rider.chassisNumber)}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 mt-1.5 text-xs">
                                            <span className={`font-semibold ${theme.walletLabel}`}>
                                                Wallet: <span className={`font-black ${theme.walletValue}`}>₹{Number(rider.walletAmount || 0).toLocaleString('en-IN')}</span>
                                            </span>
                                            {rider.mobileNumber && (
                                                <span className="text-white/40 text-[11px] font-mono">
                                                    📱 {rider.mobileNumber}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1 sm:mt-0 flex-shrink-0">
                                        <button
                                            onClick={() => handleCall(rider.mobileNumber)}
                                            className={`flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg transition-all border text-xs font-bold ${theme.callBtn}`}
                                        >
                                            <Phone size={13} /> Call
                                        </button>
                                        <button
                                            onClick={() => handleWhatsApp(rider.mobileNumber, rider.riderName, rider.walletAmount)}
                                            className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg transition-all border border-emerald-500/30 text-xs font-bold shadow-sm"
                                        >
                                            <MessageCircle size={13} /> WhatsApp
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    <div className={`p-4 border-t ${theme.footerBg}`}>
                        <button
                            onClick={onClose}
                            className={`w-full py-3 font-black rounded-xl border shadow-lg transition-all uppercase tracking-widest text-xs ${theme.actionBtn}`}
                        >
                            {actionText}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default ZomatoNegativeAlertModal;
