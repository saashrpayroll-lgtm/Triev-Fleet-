import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Trophy, Medal, Award } from 'lucide-react';
import { User, Rider, Lead } from '@/types';

interface TLComparisonCardProps {
    teamLeaders: User[];
    riders: Rider[];
    leads: Lead[];
    tlCollections: Record<string, number>;
    className?: string;
}

interface TLRanking {
    id: string;
    name: string;
    fleet: number;
    collection: number;
    leads: number;
    converted: number;
    score: number;
}

const rankIcons = [Trophy, Medal, Award];
const rankColors = ['text-amber-500', 'text-slate-400', 'text-amber-700'];
const rankBgs = ['bg-amber-500/10', 'bg-slate-500/10', 'bg-amber-700/10'];

/**
 * TL Comparison widget for Admin — ranks team leaders by composite score.
 * Shows fleet size, collection, leads, and conversion side by side.
 */
const TLComparisonCard: React.FC<TLComparisonCardProps> = ({
    teamLeaders,
    riders,
    leads,
    tlCollections,
    className = '',
}) => {
    const rankings = useMemo(() => {
        const tls: TLRanking[] = teamLeaders.map(tl => {
            const myRiders = riders.filter(r => r.teamLeaderId === tl.id && r.status === 'active');
            const myLeads = leads.filter(l => l.createdBy === tl.id);
            const myConverted = myLeads.filter(l => l.status === 'Convert').length;
            const collection = tlCollections[tl.id] || 0;

            // Composite score: 40% collection, 30% fleet, 20% conversion, 10% leads
            const maxCollection = Math.max(...Object.values(tlCollections), 1);
            const maxFleet = Math.max(...teamLeaders.map(t => riders.filter(r => r.teamLeaderId === t.id && r.status === 'active').length), 1);

            const score = Math.round(
                (collection / maxCollection) * 40 +
                (myRiders.length / maxFleet) * 30 +
                (myLeads.length > 0 ? (myConverted / myLeads.length) * 20 : 0) +
                Math.min(myLeads.length / 10, 1) * 10
            );

            return {
                id: tl.id,
                name: tl.fullName || 'Unknown TL',
                fleet: myRiders.length,
                collection,
                leads: myLeads.length,
                converted: myConverted,
                score,
            };
        });

        return tls.sort((a, b) => b.score - a.score).slice(0, 5);
    }, [teamLeaders, riders, leads, tlCollections]);

    if (rankings.length === 0) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden ${className}`}
        >
            {/* Header */}
            <div className="px-4 py-3 border-b border-border/20 flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/10">
                    <BarChart3 size={14} className="text-amber-500" />
                </div>
                <div className="flex-1">
                    <h3 className="text-xs font-black uppercase tracking-wider">TL Comparison</h3>
                    <p className="text-[9px] text-muted-foreground font-medium">Top {rankings.length} by composite score</p>
                </div>
            </div>

            {/* Column Headers */}
            <div className="grid grid-cols-[auto,1fr,60px,80px,50px,40px] gap-1 px-4 py-1.5 bg-slate-50/50 dark:bg-slate-900/20 border-b border-border/10">
                <span className="w-5" />
                <span className="text-[7px] font-black uppercase tracking-widest text-muted-foreground/50">Name</span>
                <span className="text-[7px] font-black uppercase tracking-widest text-muted-foreground/50 text-right">Fleet</span>
                <span className="text-[7px] font-black uppercase tracking-widest text-muted-foreground/50 text-right">Collected</span>
                <span className="text-[7px] font-black uppercase tracking-widest text-muted-foreground/50 text-right">Leads</span>
                <span className="text-[7px] font-black uppercase tracking-widest text-muted-foreground/50 text-right">Score</span>
            </div>

            {/* Rankings */}
            <div className="divide-y divide-border/10">
                {rankings.map((tl, idx) => {
                    const RankIcon = idx < 3 ? rankIcons[idx] : null;
                    return (
                        <motion.div
                            key={tl.id}
                            initial={{ opacity: 0, x: -5 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="grid grid-cols-[auto,1fr,60px,80px,50px,40px] gap-1 items-center px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors"
                        >
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${idx < 3 ? rankBgs[idx] : 'bg-slate-100 dark:bg-slate-800'}`}>
                                {RankIcon ? (
                                    <RankIcon size={10} className={rankColors[idx]} />
                                ) : (
                                    <span className="text-[8px] font-black text-muted-foreground">{idx + 1}</span>
                                )}
                            </div>
                            <span className="text-[10px] font-bold truncate">{tl.name.split(' ')[0]}</span>
                            <span className="text-[10px] font-black tabular-nums text-right">{tl.fleet}</span>
                            <span className="text-[10px] font-black tabular-nums text-right text-emerald-600 dark:text-emerald-400">₹{tl.collection.toLocaleString('en-IN')}</span>
                            <span className="text-[10px] font-black tabular-nums text-right">{tl.leads}</span>
                            <span className={`text-[10px] font-black tabular-nums text-right ${tl.score >= 70 ? 'text-emerald-600' : tl.score >= 40 ? 'text-amber-600' : 'text-rose-600'}`}>{tl.score}</span>
                        </motion.div>
                    );
                })}
            </div>
        </motion.div>
    );
};

export default TLComparisonCard;
