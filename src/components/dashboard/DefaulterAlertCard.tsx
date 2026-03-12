import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, MessageCircle, Eye, ShieldAlert, PhoneCall } from 'lucide-react';
import { Rider } from '@/types';

interface DefaulterAlertCardProps {
    riders: Rider[];
    onViewRider?: (rider: Rider) => void;
    onSendReminder?: (rider: Rider) => void;
    className?: string;
}

type SeverityLevel = 'warning' | 'critical' | 'severe';

const severityConfig: Record<SeverityLevel, { label: string; color: string; bg: string; border: string; range: string }> = {
    warning: {
        label: 'WARNING',
        color: 'text-amber-600 dark:text-amber-400',
        bg: 'bg-amber-500/10',
        border: 'border-amber-400/30',
        range: '₹-700 to ₹-1,500',
    },
    critical: {
        label: 'CRITICAL',
        color: 'text-orange-600 dark:text-orange-400',
        bg: 'bg-orange-500/10',
        border: 'border-orange-400/30',
        range: '₹-1,500 to ₹-3,000',
    },
    severe: {
        label: 'SEVERE',
        color: 'text-red-600 dark:text-red-400',
        bg: 'bg-red-500/10',
        border: 'border-red-400/30',
        range: 'Below ₹-3,000',
    },
};


/**
 * Defaulter alert section showing riders with wallet < -699,
 * grouped by severity with quick action buttons.
 */
const DefaulterAlertCard: React.FC<DefaulterAlertCardProps> = ({
    riders,
    onViewRider,
    onSendReminder,
    className = '',
}) => {
    const defaulters = riders
        .filter(r => r.status === 'active' && r.walletAmount < -699)
        .sort((a, b) => a.walletAmount - b.walletAmount);

    if (defaulters.length === 0) {
        return (
            <div className={`rounded-2xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-950/20 p-6 text-center ${className}`}>
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <ShieldAlert size={20} className="text-emerald-500" />
                </div>
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">No Defaulters</p>
                <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/60 mt-1 font-medium">
                    All riders are within acceptable wallet limits
                </p>
            </div>
        );
    }

    const grouped = {
        severe: defaulters.filter(r => r.walletAmount <= -3000),
        critical: defaulters.filter(r => r.walletAmount > -3000 && r.walletAmount <= -1500),
        warning: defaulters.filter(r => r.walletAmount > -1500),
    };

    return (
        <div className={`rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden ${className}`}>
            {/* Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-red-500/10 via-orange-500/5 to-transparent border-b border-border/30 flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-red-500/10">
                    <AlertTriangle size={14} className="text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-black uppercase tracking-wider">Defaulter Alerts</h3>
                    <p className="text-[9px] text-muted-foreground font-medium">
                        {defaulters.length} rider{defaulters.length !== 1 ? 's' : ''} with wallet below -₹700
                    </p>
                </div>
                <div className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] font-black">
                    {defaulters.length}
                </div>
            </div>

            {/* Severity Groups */}
            <div className="divide-y divide-border/20">
                {(['severe', 'critical', 'warning'] as SeverityLevel[]).map(level => {
                    const group = grouped[level];
                    if (group.length === 0) return null;
                    const config = severityConfig[level];

                    return (
                        <div key={level} className="px-3 py-2">
                            <div className={`flex items-center gap-1.5 mb-2 ${config.color}`}>
                                <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${config.bg} ${config.border} border`}>
                                    {config.label}
                                </span>
                                <span className="text-[9px] font-medium text-muted-foreground">{config.range}</span>
                                <span className="ml-auto text-[9px] font-bold">{group.length}</span>
                            </div>

                            <AnimatePresence>
                                <div className="space-y-1.5">
                                    {group.slice(0, 5).map((rider, idx) => (
                                        <motion.div
                                            key={rider.id}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.05 }}
                                            className={`flex items-center gap-2 p-2 rounded-xl ${config.bg} ${config.border} border transition-all hover:scale-[1.01]`}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold truncate">{rider.riderName}</p>
                                                <p className="text-[9px] text-muted-foreground font-medium">{rider.mobileNumber}</p>
                                            </div>
                                            <span className={`text-sm font-black ${config.color} whitespace-nowrap`}>
                                                ₹{rider.walletAmount.toLocaleString('en-IN')}
                                            </span>
                                            <div className="flex gap-1">
                                                {onSendReminder && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onSendReminder(rider); }}
                                                        className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors"
                                                        title="Send WhatsApp Reminder"
                                                    >
                                                        <MessageCircle size={12} />
                                                    </button>
                                                )}
                                                <a
                                                    href={`tel:${rider.mobileNumber}`}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 transition-colors flex items-center justify-center"
                                                    title="Call Rider"
                                                >
                                                    <PhoneCall size={12} />
                                                </a>
                                                {onViewRider && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onViewRider(rider); }}
                                                        className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-colors"
                                                        title="View Details"
                                                    >
                                                        <Eye size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        </motion.div>
                                    ))}
                                    {group.length > 5 && (
                                        <p className="text-[9px] text-center text-muted-foreground font-bold py-1">
                                            +{group.length - 5} more
                                        </p>
                                    )}
                                </div>
                            </AnimatePresence>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default DefaulterAlertCard;
