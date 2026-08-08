import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Target, Users, CheckCircle, XCircle } from 'lucide-react';
import { Lead } from '@/types';

interface LeadConversionFunnelProps {
    leads: Lead[];
    className?: string;
}

/**
 * Visual funnel chart showing lead conversion pipeline:
 * Total → New → Converted → Not Converted
 */
const LeadConversionFunnel: React.FC<LeadConversionFunnelProps> = ({ leads, className = '' }) => {
    const funnel = useMemo(() => {
        const total = leads.length;
        const newLeads = leads.filter(l => l.status === 'New').length;
        const converted = leads.filter(l => l.status === 'Convert').length;
        const notConverted = leads.filter(l => l.status === 'Not Convert').length;
        const conversionRate = total > 0 ? Math.round((converted / total) * 100) : 0;

        return [
            { label: 'Total Leads', count: total, width: 100, color: 'from-slate-400 to-slate-500', icon: Users, textColor: 'text-slate-600' },
            { label: 'New / In Progress', count: newLeads, width: total > 0 ? Math.max((newLeads / total) * 100, 20) : 20, color: 'from-blue-400 to-blue-500', icon: Target, textColor: 'text-blue-600' },
            { label: 'Converted', count: converted, width: total > 0 ? Math.max((converted / total) * 100, 15) : 15, color: 'from-emerald-400 to-emerald-500', icon: CheckCircle, textColor: 'text-emerald-600' },
            { label: 'Not Converted', count: notConverted, width: total > 0 ? Math.max((notConverted / total) * 100, 10) : 10, color: 'from-rose-400 to-rose-500', icon: XCircle, textColor: 'text-rose-600' },
        ].map(item => ({ ...item, conversionRate }));
    }, [leads]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden ${className}`}
        >
            {/* Header */}
            <div className="px-4 py-3 border-b border-border/20 flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-500/10">
                    <Target size={14} className="text-blue-500" />
                </div>
                <div className="flex-1">
                    <h3 className="text-xs font-black uppercase tracking-wider">Lead Funnel</h3>
                    <p className="text-[9px] text-muted-foreground font-medium">Conversion pipeline</p>
                </div>
                <span className={`text-sm font-black tabular-nums ${funnel[0].conversionRate >= 30 ? 'text-emerald-600' : funnel[0].conversionRate >= 15 ? 'text-amber-600' : 'text-rose-600'}`}>
                    {funnel[0].conversionRate}%
                </span>
            </div>

            {/* Funnel Bars */}
            <div className="px-4 py-4 space-y-2">
                {funnel.map((stage, idx) => {
                    const StageIcon = stage.icon;
                    return (
                        <div key={stage.label} className="flex items-center gap-2">
                            <StageIcon size={12} className={`${stage.textColor} flex-shrink-0`} />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-0.5">
                                    <span className="text-[9px] font-bold text-muted-foreground truncate">{stage.label}</span>
                                    <span className="text-[10px] font-black tabular-nums">{stage.count}</span>
                                </div>
                                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex justify-center">
                                    <motion.div
                                        className={`h-full rounded-full bg-gradient-to-r ${stage.color}`}
                                        initial={{ width: 0 }}
                                        animate={{ width: `${stage.width}%` }}
                                        transition={{ duration: 0.8, delay: idx * 0.15, ease: 'easeOut' }}
                                    />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Conversion Rate Footer */}
            <div className="px-4 py-2 bg-slate-50/50 dark:bg-slate-900/30 border-t border-border/20 text-center">
                <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">
                    Conversion Rate: <span className={`${funnel[0].conversionRate >= 30 ? 'text-emerald-600' : funnel[0].conversionRate >= 15 ? 'text-amber-600' : 'text-rose-600'}`}>{funnel[0].conversionRate}%</span>
                </p>
            </div>
        </motion.div>
    );
};

export default LeadConversionFunnel;
