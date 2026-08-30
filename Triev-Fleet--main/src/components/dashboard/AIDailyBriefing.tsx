import React, { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, ChevronRight, Loader2 } from 'lucide-react';
import { AIService } from '@/services/AIService';

interface BriefingItem {
    priority: 'high' | 'medium' | 'low';
    action: string;
    icon: string;
}

interface AIDailyBriefingProps {
    stats: {
        activeRiders: number;
        negativeBalanceRiders: number;
        totalWallet: number;
        openRequests: number;
        newLeadsToday: number;
    };
}

const PRIORITY_STYLES: Record<string, { bar: string; badge: string; label: string }> = {
    high:   { bar: 'bg-red-500',    badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',       label: 'High' },
    medium: { bar: 'bg-amber-400',  badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', label: 'Medium' },
    low:    { bar: 'bg-green-500',  badge: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300', label: 'Low' },
};

const AIDailyBriefing: React.FC<AIDailyBriefingProps> = ({ stats }) => {
    const [briefing, setBriefing] = useState<BriefingItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
    const [hasData, setHasData] = useState(false);

    const loadBriefing = async () => {
        // Only call if we have real data
        if (!stats || stats.activeRiders === 0) return;
        setIsLoading(true);
        try {
            const result = await AIService.generateDailyBriefing(stats);
            setBriefing(result);
            setGeneratedAt(new Date());
            setHasData(true);
        } catch (e) {
            console.error('[AIDailyBriefing] Failed', e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (stats && stats.activeRiders > 0 && !hasData) {
            loadBriefing();
        }
    }, [stats]);

    const today = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

    return (
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            {/* Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-violet-600/15 to-blue-600/10 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
                        <Sparkles size={14} className="text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-xs">AI Daily Briefing</h3>
                        <p className="text-[10px] text-muted-foreground">{today}</p>
                    </div>
                </div>
                <button
                    onClick={loadBriefing}
                    disabled={isLoading}
                    className="p-1.5 hover:bg-accent/80 rounded-lg transition-colors disabled:opacity-50 text-muted-foreground hover:text-foreground"
                    title="Regenerate"
                >
                    <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
                </button>
            </div>

            <div className="p-3">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-6 gap-2">
                        <div className="relative">
                            <div className="w-8 h-8 rounded-full border-2 border-violet-200 dark:border-violet-800" />
                            <div className="absolute inset-0 w-8 h-8 rounded-full border-2 border-t-violet-600 animate-spin" />
                        </div>
                        <p className="text-[11px] text-muted-foreground animate-pulse">AI analyzing fleet data…</p>
                    </div>
                ) : briefing.length > 0 ? (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {briefing.map((item, i) => {
                            const style = PRIORITY_STYLES[item.priority] || PRIORITY_STYLES.medium;
                            return (
                                <div
                                    key={i}
                                    className="flex items-start gap-2.5 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group cursor-default text-xs"
                                >
                                    {/* Priority bar */}
                                    <div className={`w-1 self-stretch rounded-full ${style.bar} shrink-0`} />

                                    <span className="text-base select-none mt-0.5">{item.icon}</span>

                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium leading-tight text-foreground/90">{item.action}</p>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0 self-center">
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${style.badge}`}>
                                            {style.label}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}

                        {generatedAt && (
                            <p className="text-[9px] text-muted-foreground text-right pt-1 flex items-center justify-end gap-1">
                                <Sparkles size={9} />
                                Generated by Gemini at {generatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="text-center py-4 text-muted-foreground">
                        <p className="text-xs">Briefing will appear once data loads.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AIDailyBriefing;
