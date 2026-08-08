import React from 'react';
import { motion } from 'framer-motion';
import { ArrowUp, ArrowDown } from 'lucide-react';

interface InsightItem {
    label: string;
    value: string | number;
    change?: number; // percentage change
    prefix?: string;
    suffix?: string;
}

interface QuickInsightStripProps {
    insights: InsightItem[];
    className?: string;
}

/**
 * Compact horizontal KPI strip showing key metrics at a glance.
 * Designed to sit below the header as a quick summary bar.
 */
const QuickInsightStrip: React.FC<QuickInsightStripProps> = ({ insights, className = '' }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex items-center gap-1 overflow-x-auto hide-scrollbar py-1 ${className}`}
        >
            {insights.map((item, idx) => (
                <React.Fragment key={item.label}>
                    {idx > 0 && (
                        <div className="w-px h-6 bg-border/40 flex-shrink-0 mx-0.5" />
                    )}
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-card/40 border border-border/20 flex-shrink-0 hover:bg-card/70 transition-colors">
                        <div className="min-w-0">
                            <p className="text-[7px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 whitespace-nowrap">
                                {item.label}
                            </p>
                            <p className="text-sm font-black tabular-nums whitespace-nowrap leading-none mt-0.5">
                                {item.prefix}{typeof item.value === 'number' ? item.value.toLocaleString('en-IN') : item.value}{item.suffix}
                            </p>
                        </div>
                        {item.change !== undefined && item.change !== 0 && (
                            <span className={`
                                flex items-center gap-0.5 text-[8px] font-black px-1.5 py-0.5 rounded-full
                                ${item.change > 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'}
                            `}>
                                {item.change > 0 ? <ArrowUp size={8} /> : <ArrowDown size={8} />}
                                {Math.abs(item.change)}%
                            </span>
                        )}
                    </div>
                </React.Fragment>
            ))}
        </motion.div>
    );
};

export default QuickInsightStrip;
