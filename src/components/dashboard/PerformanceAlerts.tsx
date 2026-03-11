import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, TrendingDown, AlertTriangle, UserMinus, ChevronRight } from 'lucide-react';
import { User, Rider, Lead } from '@/types';

interface PerformanceAlert {
    id: string;
    type: 'collection_drop' | 'high_churn' | 'inactive_tl' | 'low_conversion' | 'fleet_decline';
    severity: 'warning' | 'critical';
    title: string;
    message: string;
    tlName: string;
    tlId: string;
    icon: React.ElementType;
}

interface PerformanceAlertsProps {
    teamLeaders: User[];
    riders: Rider[];
    leads: Lead[];
    tlCollections: Record<string, number>;
    className?: string;
    onViewTL?: (tlId: string) => void;
}

/**
 * Auto-detects TL performance issues and shows actionable alerts.
 * Pure computation from existing data — no additional DB queries.
 */
const PerformanceAlerts: React.FC<PerformanceAlertsProps> = ({
    teamLeaders,
    riders,
    leads,
    tlCollections,
    className = '',
    onViewTL,
}) => {
    const alerts = useMemo(() => {
        const result: PerformanceAlert[] = [];

        teamLeaders.forEach(tl => {
            const tlRiders = riders.filter(r => r.teamLeaderId === tl.id);
            const activeRiders = tlRiders.filter(r => r.status === 'active');
            const inactiveRiders = tlRiders.filter(r => r.status === 'inactive');
            const tlLeads = leads.filter(l => l.createdBy === tl.id);
            const collection = tlCollections[tl.id] || 0;
            const tlName = tl.fullName || tl.email || 'Unknown';

            // Alert 1: Zero collection
            if (collection === 0 && activeRiders.length > 0) {
                result.push({
                    id: `${tl.id}-zero-collection`,
                    type: 'collection_drop',
                    severity: 'critical',
                    title: 'Zero Collection',
                    message: `${tlName} has ${activeRiders.length} active riders but ₹0 collected`,
                    tlName,
                    tlId: tl.id,
                    icon: TrendingDown,
                });
            }

            // Alert 2: High churn rate (inactive > 30% of total)
            const totalRiders = tlRiders.length;
            if (totalRiders >= 5 && inactiveRiders.length / totalRiders > 0.3) {
                result.push({
                    id: `${tl.id}-high-churn`,
                    type: 'high_churn',
                    severity: 'warning',
                    title: 'High Churn Rate',
                    message: `${tlName}: ${inactiveRiders.length}/${totalRiders} riders inactive (${Math.round(inactiveRiders.length / totalRiders * 100)}%)`,
                    tlName,
                    tlId: tl.id,
                    icon: UserMinus,
                });
            }

            // Alert 3: Low lead conversion (< 20% with 5+ leads)
            const convertedLeads = tlLeads.filter(l => l.status === 'Convert').length;
            if (tlLeads.length >= 5 && convertedLeads / tlLeads.length < 0.2) {
                result.push({
                    id: `${tl.id}-low-conversion`,
                    type: 'low_conversion',
                    severity: 'warning',
                    title: 'Low Lead Conversion',
                    message: `${tlName}: Only ${convertedLeads}/${tlLeads.length} leads converted (${Math.round(convertedLeads / tlLeads.length * 100)}%)`,
                    tlName,
                    tlId: tl.id,
                    icon: AlertTriangle,
                });
            }

            // Alert 4: Fleet decline (many defaulters)
            const defaulters = activeRiders.filter(r => r.walletAmount < -699);
            if (defaulters.length >= 3) {
                result.push({
                    id: `${tl.id}-defaulters`,
                    type: 'fleet_decline',
                    severity: defaulters.length >= 5 ? 'critical' : 'warning',
                    title: 'Multiple Defaulters',
                    message: `${tlName}: ${defaulters.length} riders in debt (> ₹699)`,
                    tlName,
                    tlId: tl.id,
                    icon: AlertTriangle,
                });
            }
        });

        // Sort: critical first, then alphabetically
        result.sort((a, b) => {
            if (a.severity === 'critical' && b.severity !== 'critical') return -1;
            if (b.severity === 'critical' && a.severity !== 'critical') return 1;
            return a.tlName.localeCompare(b.tlName);
        });

        return result;
    }, [teamLeaders, riders, leads, tlCollections]);

    if (alerts.length === 0) {
        return (
            <div className={`rounded-2xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-950/20 p-6 text-center ${className}`}>
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <Bell size={20} className="text-emerald-500" />
                </div>
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">All Clear</p>
                <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/60 mt-1 font-medium">
                    No performance anomalies detected
                </p>
            </div>
        );
    }

    return (
        <div className={`rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden ${className}`}>
            {/* Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-orange-500/10 via-red-500/5 to-transparent border-b border-border/30 flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-orange-500/10">
                    <Bell size={14} className="text-orange-500" />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-black uppercase tracking-wider">Performance Alerts</h3>
                    <p className="text-[9px] text-muted-foreground font-medium">
                        {alerts.filter(a => a.severity === 'critical').length} critical, {alerts.filter(a => a.severity === 'warning').length} warnings
                    </p>
                </div>
                <div className="px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[10px] font-black">
                    {alerts.length}
                </div>
            </div>

            {/* Alert List */}
            <div className="divide-y divide-border/20 max-h-[320px] overflow-y-auto custom-scrollbar">
                <AnimatePresence>
                    {alerts.slice(0, 10).map((alert, idx) => {
                        const AlertIcon = alert.icon;
                        const isCritical = alert.severity === 'critical';

                        return (
                            <motion.div
                                key={alert.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.04 }}
                                className={`
                                    flex items-center gap-3 px-4 py-3 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors cursor-pointer
                                    ${isCritical ? 'bg-red-50/30 dark:bg-red-950/10' : ''}
                                `}
                                onClick={() => onViewTL?.(alert.tlId)}
                            >
                                <div className={`
                                    p-1.5 rounded-lg flex-shrink-0
                                    ${isCritical ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}
                                    ${isCritical ? 'animate-pulse' : ''}
                                `}>
                                    <AlertIcon size={14} />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded
                                            ${isCritical ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'}
                                        `}>
                                            {alert.severity}
                                        </span>
                                        <span className="text-[10px] font-black truncate">{alert.title}</span>
                                    </div>
                                    <p className="text-[9px] text-muted-foreground font-medium mt-0.5 truncate">{alert.message}</p>
                                </div>

                                <ChevronRight size={14} className="text-muted-foreground/30 flex-shrink-0" />
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>

            {alerts.length > 10 && (
                <div className="px-4 py-2 border-t border-border/20 text-center">
                    <p className="text-[9px] font-bold text-muted-foreground">+{alerts.length - 10} more alerts</p>
                </div>
            )}
        </div>
    );
};

export default PerformanceAlerts;
