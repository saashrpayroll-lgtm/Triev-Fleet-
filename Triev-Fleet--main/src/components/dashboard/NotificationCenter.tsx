import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, AlertTriangle, TrendingDown, UserMinus, DollarSign, CheckCircle, X, ChevronDown } from 'lucide-react';
import { Rider } from '@/types';

interface SystemNotification {
    id: string;
    type: 'warning' | 'critical' | 'info' | 'success';
    title: string;
    message: string;
    timestamp: Date;
    icon: React.ElementType;
}

interface NotificationCenterProps {
    riders: Rider[];
    totalCollection: number;
    monthlyTarget?: number;
    className?: string;
}

const typeStyles: Record<string, { bg: string; text: string; border: string; dot: string }> = {
    critical: { bg: 'bg-red-50 dark:bg-red-950/20', text: 'text-red-600 dark:text-red-400', border: 'border-red-200 dark:border-red-800/40', dot: 'bg-red-500' },
    warning: { bg: 'bg-amber-50 dark:bg-amber-950/20', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800/40', dot: 'bg-amber-500' },
    info: { bg: 'bg-blue-50 dark:bg-blue-950/20', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800/40', dot: 'bg-blue-500' },
    success: { bg: 'bg-emerald-50 dark:bg-emerald-950/20', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800/40', dot: 'bg-emerald-500' },
};

/**
 * Auto-generated notification center based on system state.
 * Generates alerts from rider data — no DB queries needed.
 */
const NotificationCenter: React.FC<NotificationCenterProps> = ({
    riders,
    totalCollection,
    monthlyTarget = 0,
    className = '',
}) => {
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());
    const [expanded, setExpanded] = useState(false);

    const notifications = useMemo(() => {
        const result: SystemNotification[] = [];
        const now = new Date();
        const active = riders.filter(r => r.status === 'active');

        // Critical: Severe defaulters
        const severeDefaulters = active.filter(r => r.walletAmount < -3000);
        if (severeDefaulters.length > 0) {
            result.push({
                id: 'severe-defaulters',
                type: 'critical',
                title: `${severeDefaulters.length} Severe Defaulter${severeDefaulters.length > 1 ? 's' : ''}`,
                message: `Riders with wallet below -₹3,000 need immediate attention. Total debt: ₹${Math.abs(severeDefaulters.reduce((s, r) => s + r.walletAmount, 0)).toLocaleString('en-IN')}`,
                timestamp: now,
                icon: AlertTriangle,
            });
        }

        // Warning: Collection target behind
        if (monthlyTarget > 0) {
            const daysPassed = now.getDate();
            const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            const expectedPace = (daysPassed / daysInMonth) * monthlyTarget;
            if (totalCollection < expectedPace * 0.8) {
                result.push({
                    id: 'target-behind',
                    type: 'warning',
                    title: 'Collection Behind Target',
                    message: `₹${totalCollection.toLocaleString('en-IN')} collected vs ₹${Math.round(expectedPace).toLocaleString('en-IN')} expected by day ${daysPassed}`,
                    timestamp: now,
                    icon: TrendingDown,
                });
            }
        }

        // Info: Fleet size milestones
        if (active.length >= 50) {
            result.push({
                id: 'fleet-milestone-50',
                type: 'success',
                title: 'Fleet Milestone Reached!',
                message: `Your fleet has ${active.length} active riders. Great fleet management!`,
                timestamp: now,
                icon: CheckCircle,
            });
        }

        // Warning: High inactive ratio
        const inactive = riders.filter(r => r.status === 'inactive');
        if (riders.length >= 10 && inactive.length / riders.length > 0.25) {
            result.push({
                id: 'high-inactive',
                type: 'warning',
                title: 'High Inactivity Rate',
                message: `${inactive.length} of ${riders.length} riders are inactive (${Math.round(inactive.length / riders.length * 100)}%). Consider re-engagement.`,
                timestamp: now,
                icon: UserMinus,
            });
        }

        // Info: Collection activity
        if (totalCollection > 0) {
            result.push({
                id: 'collection-active',
                type: 'info',
                title: 'Collection Active',
                message: `₹${totalCollection.toLocaleString('en-IN')} collected this period across ${active.length} riders.`,
                timestamp: now,
                icon: DollarSign,
            });
        }

        return result.filter(n => !dismissed.has(n.id));
    }, [riders, totalCollection, monthlyTarget, dismissed]);

    const criticalCount = notifications.filter(n => n.type === 'critical').length;
    const displayNotifications = expanded ? notifications : notifications.slice(0, 3);

    if (notifications.length === 0) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden ${className}`}
        >
            {/* Header */}
            <div className="px-4 py-2.5 border-b border-border/20 flex items-center gap-2">
                <div className="relative">
                    <Bell size={14} className="text-muted-foreground" />
                    {criticalCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full text-[7px] font-black text-white flex items-center justify-center animate-pulse">
                            {criticalCount}
                        </span>
                    )}
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider flex-1">
                    Notifications
                </span>
                <span className="text-[9px] font-bold text-muted-foreground">{notifications.length}</span>
            </div>

            {/* Notifications */}
            <div className="divide-y divide-border/10">
                <AnimatePresence>
                    {displayNotifications.map((notif) => {
                        const style = typeStyles[notif.type];
                        const NotifIcon = notif.icon;
                        return (
                            <motion.div
                                key={notif.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, height: 0 }}
                                className={`flex items-start gap-2 px-3 py-2.5 ${style.bg}`}
                            >
                                <div className={`p-1 rounded-lg ${style.text} mt-0.5`}>
                                    <NotifIcon size={12} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-black">{notif.title}</p>
                                    <p className="text-[9px] text-muted-foreground font-medium mt-0.5 line-clamp-2">{notif.message}</p>
                                </div>
                                <button
                                    onClick={() => setDismissed(prev => new Set([...prev, notif.id]))}
                                    className="p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex-shrink-0"
                                >
                                    <X size={10} className="text-muted-foreground/50" />
                                </button>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>

            {notifications.length > 3 && (
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="w-full px-4 py-1.5 border-t border-border/20 text-[9px] font-bold text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
                >
                    <ChevronDown size={10} className={expanded ? 'rotate-180 transition-transform' : 'transition-transform'} />
                    {expanded ? 'Show Less' : `+${notifications.length - 3} More`}
                </button>
            )}
        </motion.div>
    );
};

export default NotificationCenter;
