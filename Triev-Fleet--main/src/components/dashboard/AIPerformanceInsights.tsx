import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, AlertTriangle, ShieldCheck, Zap, Lightbulb } from 'lucide-react';

export interface PerformanceInsightsProps {
    roleName?: string;
    totalCollection: number;
    activeRidersCount: number;
    totalRidersCount: number;
    leadConversionRate?: number;
    criticalDebtCount?: number;
    avgScore?: number;
    topPerformerName?: string;
}

const AIPerformanceInsights: React.FC<PerformanceInsightsProps> = ({
    roleName = 'Team',
    totalCollection,
    activeRidersCount,
    totalRidersCount,
    leadConversionRate = 0,
    criticalDebtCount = 0,
    avgScore = 85,
    topPerformerName
}) => {
    const activePct = totalRidersCount > 0 ? Math.round((activeRidersCount / totalRidersCount) * 100) : 0;

    // AI Dynamic Evaluations
    const healthGrade = avgScore >= 90 ? 'A+' : avgScore >= 80 ? 'A' : avgScore >= 70 ? 'B' : avgScore >= 60 ? 'C' : 'D';

    const insights: { type: 'success' | 'warning' | 'info'; title: string; text: string }[] = [];

    if (totalCollection > 0) {
        insights.push({
            type: 'info',
            title: 'Revenue Pace',
            text: `Total period collection recorded at ₹${totalCollection.toLocaleString('en-IN')}.`
        });
    }

    if (activePct >= 85) {
        insights.push({
            type: 'success',
            title: 'High Fleet Participation',
            text: `${activePct}% of fleet is actively generating revenue today (${activeRidersCount}/${totalRidersCount} riders).`
        });
    } else if (activePct < 65) {
        insights.push({
            type: 'warning',
            title: 'Rider Inactivity Alert',
            text: `Active fleet ratio is at ${activePct}%. Prioritize calling inactive riders to improve daily yield.`
        });
    }

    if (criticalDebtCount > 0) {
        insights.push({
            type: 'warning',
            title: 'High Wallet Risk',
            text: `${criticalDebtCount} riders are currently in heavy debt (>-₹1,500). Immediate recovery follow-up recommended.`
        });
    } else {
        insights.push({
            type: 'success',
            title: 'Clean Wallet Status',
            text: 'No critical debt defaulters detected in current active fleet.'
        });
    }

    if (leadConversionRate >= 30) {
        insights.push({
            type: 'success',
            title: 'Strong Lead Funnel',
            text: `Lead conversion is performing at ${leadConversionRate}%, exceeding monthly target benchmark.`
        });
    } else if (leadConversionRate > 0) {
        insights.push({
            type: 'info',
            title: 'Lead Conversion Optimization',
            text: `Lead conversion rate stands at ${leadConversionRate}%. Engage uncontacted leads within 24h.`
        });
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="p-5 rounded-2xl bg-gradient-to-br from-indigo-900/20 via-purple-900/10 to-card border border-indigo-500/30 backdrop-blur-xl shadow-lg relative overflow-hidden"
        >
            <div className="absolute top-0 right-0 p-6 pointer-events-none opacity-10">
                <Sparkles className="w-32 h-32 text-indigo-400" />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-3 border-b border-border/50">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shadow-inner">
                        <Sparkles className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-base font-black text-foreground tracking-tight">AI Fleet Health &amp; Insights</h3>
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                                Autonomous Engine
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">Real-time performance diagnosis &amp; optimization targets for {roleName}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {topPerformerName && (
                        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold">
                            <Zap className="w-3.5 h-3.5 fill-amber-400" />
                            <span>Top Leader: {topPerformerName}</span>
                        </div>
                    )}

                    <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30">
                        <span className="text-xs font-bold text-muted-foreground">AI Rating</span>
                        <span className="text-sm font-black text-indigo-400">{healthGrade} ({avgScore} pts)</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {insights.map((item, idx) => (
                    <div
                        key={idx}
                        className={`p-3.5 rounded-xl border backdrop-blur-md transition-all ${
                            item.type === 'success'
                                ? 'bg-emerald-500/5 border-emerald-500/20 text-foreground'
                                : item.type === 'warning'
                                ? 'bg-amber-500/5 border-amber-500/20 text-foreground'
                                : 'bg-blue-500/5 border-blue-500/20 text-foreground'
                        }`}
                    >
                        <div className="flex items-center gap-2 mb-1.5">
                            {item.type === 'success' ? (
                                <ShieldCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                            ) : item.type === 'warning' ? (
                                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                            ) : (
                                <Lightbulb className="w-4 h-4 text-blue-500 flex-shrink-0" />
                            )}
                            <h4 className="text-xs font-bold tracking-tight">{item.title}</h4>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{item.text}</p>
                    </div>
                ))}
            </div>
        </motion.div>
    );
};

export default AIPerformanceInsights;
