import React, { useState } from 'react';
import { Sparkles, Lightbulb, RefreshCw } from 'lucide-react';
import { AIService } from '@/services/AIService';
import { User } from '@/types';

interface GeminiInsightsProps {
    users: User[];
}

const GeminiInsights: React.FC<GeminiInsightsProps> = ({ users }) => {
    const [insights, setInsights] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleAnalyze = async () => {
        setLoading(true);
        // Prepare summary stats for AI to save token usage
        const stats = {
            total: users.length,
            active: users.filter(u => u.status === 'active').length,
            roles: users.reduce((acc: any, u) => { acc[u.role] = (acc[u.role] || 0) + 1; return acc; }, {}),
            locations: users.reduce((acc: any, u) => {
                const loc = u.jobLocation || 'Unknown';
                acc[loc] = (acc[loc] || 0) + 1;
                return acc;
            }, {})
        };

        const result = await AIService.generateInsights(stats);
        setInsights(result);
        setLoading(false);
    };

    return (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20 border border-indigo-100 dark:border-indigo-900 rounded-xl p-5 shadow-sm relative overflow-hidden">
            {/* Glossy background effect */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

            <div className="flex items-start justify-between mb-4 relative z-10">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-white/80 dark:bg-black/20 backdrop-blur rounded-lg shadow-sm text-indigo-600">
                        <Sparkles size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-indigo-950 dark:text-indigo-100">Gemini Insights</h3>
                        <p className="text-xs text-indigo-600 dark:text-indigo-300">AI-powered analytics of your team</p>
                    </div>
                </div>

                <button
                    onClick={handleAnalyze}
                    disabled={loading}
                    className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-all shadow-md hover:shadow-lg disabled:opacity-50"
                >
                    {loading ? <RefreshCw size={14} className="animate-spin" /> : <Lightbulb size={14} />}
                    {insights ? 'Refresh Analysis' : 'Analyze Data'}
                </button>
            </div>

            <div className="bg-white/60 dark:bg-black/20 backdrop-blur-md rounded-lg p-4 min-h-[100px] relative z-10 border border-white/50 dark:border-white/5">
                {loading ? (
                    <div className="space-y-3 animate-pulse">
                        <div className="h-4 bg-indigo-200/50 rounded w-3/4" />
                        <div className="h-4 bg-indigo-200/50 rounded w-1/2" />
                        <div className="h-4 bg-indigo-200/50 rounded w-full" />
                    </div>
                ) : insights ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none text-indigo-950 dark:text-indigo-100/90 text-sm leading-relaxed">
                        <p className="whitespace-pre-line">{insights}</p>
                    </div>
                ) : (
                    <div className="text-center text-muted-foreground text-sm py-4">
                        Tap "Analyze Data" to reveal trends and patterns in your user base.
                    </div>
                )}
            </div>

            <div className="mt-3 flex items-center justify-end gap-2 text-[10px] text-indigo-400/80">
                <Sparkles size={10} /> Powered by Google Gemini
            </div>
        </div>
    );
};

export default GeminiInsights;
