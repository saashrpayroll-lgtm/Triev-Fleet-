import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldAlert, Phone, MessageCircle } from 'lucide-react';
import { Rider } from '@/types';
import { safeRender } from '@/utils/safeRender';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    negativeRiders: Rider[];
}

const ZomatoNegativeAlertModal: React.FC<Props> = ({ isOpen, onClose, negativeRiders }) => {
    if (!isOpen) return null;

    const handleCall = (phoneNumber: string) => {
        if (!phoneNumber) return;
        window.open(`tel:${phoneNumber}`, '_self');
    };

    const handleWhatsApp = (phoneNumber: string, riderName: string, amount: number) => {
        if (!phoneNumber) return;
        const msg = `Hi ${riderName}, your Zomato VIP Wallet balance is critically low or negative (₹${Math.abs(amount).toLocaleString('en-IN')}). Please recharge immediately to avoid ID deactivation.`;
        window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(msg)}`, '_blank');
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-lg bg-red-950/90 border border-red-500/50 rounded-2xl shadow-2xl shadow-red-500/20 overflow-hidden flex flex-col max-h-[85vh] z-10"
                >
                    {/* Header */}
                    <div className="flex items-start justify-between p-5 border-b border-red-500/30 bg-red-900/40 relative">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                        <div className="flex gap-4 relative z-10">
                            <div className="w-12 h-12 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center flex-shrink-0">
                                <ShieldAlert size={28} className="text-red-400" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-red-50 uppercase tracking-wide">Critical Alert</h2>
                                <p className="text-red-300 text-sm font-medium mt-1">
                                    {negativeRiders.length} Zomato VIP {negativeRiders.length === 1 ? 'Rider has' : 'Riders have'} 0 or negative wallet balances.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 bg-red-900/50 hover:bg-red-800 text-red-300 hover:text-red-100 rounded-xl transition-colors relative z-10"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-5 scrollbar-thin scrollbar-thumb-red-500/30 scrollbar-track-transparent">
                        <div className="space-y-3">
                            {negativeRiders.map(rider => (
                                <div key={rider.id} className="bg-red-900/30 border border-red-500/20 rounded-xl p-3 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-red-50">{safeRender(rider.riderName)}</span>
                                            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-red-500/20 text-red-300 rounded uppercase">
                                                {safeRender(rider.chassisNumber)}
                                            </span>
                                        </div>
                                        <div className="text-xs font-semibold text-red-400 mt-1">
                                            Wallet: <span className="text-red-200 font-bold">₹{rider.walletAmount.toLocaleString('en-IN')}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 mt-2 sm:mt-0">
                                        <button
                                            onClick={() => handleCall(rider.mobileNumber)}
                                            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded-lg transition-colors border border-red-500/30 text-xs font-bold"
                                        >
                                            <Phone size={14} /> Call
                                        </button>
                                        <button
                                            onClick={() => handleWhatsApp(rider.mobileNumber, rider.riderName, rider.walletAmount)}
                                            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg transition-colors border border-green-500/30 text-xs font-bold"
                                        >
                                            <MessageCircle size={14} /> WhatsApp
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-5 border-t border-red-500/30 bg-red-950/80">
                        <button
                            onClick={onClose}
                            className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl border border-red-500 shadow-lg shadow-red-600/20 transition-all uppercase tracking-widest text-sm"
                        >
                            Acknowledge & Close
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default ZomatoNegativeAlertModal;
