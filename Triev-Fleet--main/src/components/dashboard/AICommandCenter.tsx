import React, { useState, useEffect } from 'react';
import { Zap, Brain, Globe, CheckCircle2, XCircle, Clock, RefreshCw, TrendingUp, Activity, Sparkles, Key, ChevronDown, ChevronUp } from 'lucide-react';
import { AIConfigService } from '@/services/AIConfigService';
import { supabase } from '@/config/supabase';
import { toast } from 'sonner';

interface EngineStatus {
    name: string;
    key: 'groq' | 'gemini' | 'mistral';
    icon: React.ReactNode;
    color: string;
    role: string;
    configured: boolean;
}

interface AIActivityLog {
    details: string;
    timestamp: string;
    action_type: string;
}

const AICommandCenter: React.FC = () => {
    const [engines, setEngines] = useState<EngineStatus[]>([]);
    const [recentLogs, setRecentLogs] = useState<AIActivityLog[]>([]);
    const [totalCalls, setTotalCalls] = useState(0);
    const [successRate, setSuccessRate] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showKeyModal, setShowKeyModal] = useState(false);
    const [showAllActivity, setShowAllActivity] = useState(false);

    // Key inputs for manual configuration modal
    const [mistralInput, setMistralInput] = useState('');
    const [groqInput, setGroqInput] = useState('');
    const [geminiInput, setGeminiInput] = useState('');

    const loadEngineStatus = () => {
        const groqKey = AIConfigService.getGroqKey();
        const geminiKey = AIConfigService.getGeminiKey();
        const mistralKey = AIConfigService.getMistralKey();

        setGroqInput(groqKey || '');
        setGeminiInput(geminiKey || '');
        setMistralInput(mistralKey || '');

        setEngines([
            {
                name: 'Groq',
                key: 'groq',
                icon: <Zap size={14} className="fill-current" />,
                color: 'orange',
                role: 'Speed Engine (sub-second)',
                configured: !!(groqKey && groqKey.length >= 20),
            },
            {
                name: 'Gemini',
                key: 'gemini',
                icon: <Brain size={14} />,
                color: 'blue',
                role: 'Analysis & Creative',
                configured: !!(geminiKey && geminiKey.length >= 20),
            },
            {
                name: 'Mistral',
                key: 'mistral',
                icon: <Globe size={14} />,
                color: 'purple',
                role: 'Hindi / Multilingual',
                configured: !!(mistralKey && mistralKey.length >= 20),
            },
        ]);
    };

    const loadActivityLogs = async () => {
        try {
            const { data } = await supabase
                .from('activity_logs')
                .select('details, timestamp, action_type')
                .eq('action_type', 'AI_GENERATION')
                .order('timestamp', { ascending: false })
                .limit(10);

            if (data) {
                setRecentLogs(data);
                setTotalCalls(data.length);
                const successes = data.filter(d => !d.details.includes('Fail') && !d.details.includes('failed')).length;
                setSuccessRate(data.length > 0 ? Math.round((successes / data.length) * 100) : 100);
            }
        } catch (e) {
            console.error('[AICommandCenter] Failed to load logs', e);
        }
    };

    const refresh = async () => {
        setIsRefreshing(true);
        loadEngineStatus();
        await loadActivityLogs();
        setIsRefreshing(false);
    };

    const handleSaveKeys = () => {
        const current = AIConfigService.getConfig();
        AIConfigService.saveConfig({
            ...current,
            groqKey: groqInput.trim(),
            geminiKey: geminiInput.trim(),
            mistralKey: mistralInput.trim()
        });
        loadEngineStatus();
        setShowKeyModal(false);
        toast.success('AI API Keys updated successfully!');
    };

    useEffect(() => {
        loadEngineStatus();
        loadActivityLogs();
    }, []);

    const colorMap: Record<string, { bg: string; text: string; border: string; pill: string }> = {
        orange: {
            bg:     'bg-orange-50/60 dark:bg-orange-950/20',
            text:   'text-orange-600 dark:text-orange-400',
            border: 'border-orange-200/60 dark:border-orange-800/40',
            pill:   'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
        },
        blue: {
            bg:     'bg-blue-50/60 dark:bg-blue-950/20',
            text:   'text-blue-600 dark:text-blue-400',
            border: 'border-blue-200/60 dark:border-blue-800/40',
            pill:   'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
        },
        purple: {
            bg:     'bg-purple-50/60 dark:bg-purple-950/20',
            text:   'text-purple-600 dark:text-purple-400',
            border: 'border-purple-200/60 dark:border-purple-800/40',
            pill:   'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
        },
    };

    const extractProvider = (details: string) => {
        if (details.includes('(groq)'))    return { label: 'Groq',    cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' };
        if (details.includes('(gemini)'))  return { label: 'Gemini',  cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' };
        if (details.includes('(mistral)')) return { label: 'Mistral', cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' };
        return null;
    };

    const extractLatency = (details: string) => {
        const match = details.match(/(\d+)ms/);
        return match ? `${match[1]}ms` : null;
    };

    const formatTaskLabel = (details: string) => {
        const cleaned = details.replace(/AI performed:\s*/i, '').replace(/\s*-\s*\d+ms.*/, '').trim();
        if (cleaned.includes('analysis') || cleaned.includes('performance')) return 'Fleet Performance Analytics';
        if (cleaned.includes('briefing') || cleaned.includes('daily')) return 'AI Daily Briefing';
        if (cleaned.includes('chat') || cleaned.includes('copilot')) return 'AI Ops Copilot Assistant';
        if (cleaned.includes('reminder') || cleaned.includes('payment')) return 'Rider Payment Reminder';
        if (cleaned.includes('request') || cleaned.includes('resolution')) return 'Support Request Resolution';
        if (cleaned.includes('speed')) return 'Realtime Data Parsing';
        return cleaned.replace(/-all-failed.*/, '').replace(/-fallback-\d+/, '') || 'Fleet Optimization Engine';
    };

    const configuredCount = engines.filter(e => e.configured).length;
    const displayedLogs = showAllActivity ? recentLogs : recentLogs.slice(0, 3);

    return (
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            {/* Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-purple-600/10 via-blue-600/10 to-orange-600/10 border-b border-border">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
                            <Sparkles size={14} className="text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-xs">AI Command Center</h3>
                            <p className="text-[10px] text-muted-foreground">
                                {configuredCount}/3 engines active
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => setShowKeyModal(true)}
                            className="p-1.5 hover:bg-accent/80 rounded-lg text-muted-foreground hover:text-foreground text-[11px] font-medium flex items-center gap-1 transition-colors"
                            title="Manage API Keys"
                        >
                            <Key size={12} />
                            <span className="hidden sm:inline text-[10px]">Keys</span>
                        </button>
                        <button
                            onClick={refresh}
                            className="p-1.5 hover:bg-accent/80 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                            title="Refresh Status"
                        >
                            <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="p-3 space-y-3">
                {/* Engine Status Cards (Compact) */}
                <div className="grid grid-cols-3 gap-2">
                    {engines.map(engine => {
                        const c = colorMap[engine.color];
                        return (
                            <div
                                key={engine.key}
                                className={`relative rounded-lg p-2.5 border ${c.bg} ${c.border} flex flex-col justify-between`}
                            >
                                <span className={`absolute top-2 right-2 w-1.5 h-1.5 rounded-full ${engine.configured ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />

                                <div className="flex items-center gap-1.5">
                                    <div className={`w-5 h-5 rounded-md flex items-center justify-center ${c.pill}`}>
                                        {engine.icon}
                                    </div>
                                    <p className={`text-xs font-bold ${engine.configured ? c.text : 'text-muted-foreground'}`}>
                                        {engine.name}
                                    </p>
                                </div>

                                <div className="mt-2 flex items-center justify-between">
                                    <span className="text-[9px] text-muted-foreground truncate max-w-[80px]">{engine.role.split('(')[0]}</span>
                                    <span className={`text-[9px] font-semibold ${engine.configured ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                                        {engine.configured ? 'Active' : 'No Key'}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Stats Row & Fallback Chain (Horizontal Compact) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-muted/30 rounded-lg p-2 flex items-center justify-around border border-border/40">
                        <div className="flex items-center gap-2">
                            <Activity size={13} className="text-blue-500" />
                            <div>
                                <span className="font-bold">{totalCalls}</span>
                                <span className="text-[10px] text-muted-foreground ml-1">Calls</span>
                            </div>
                        </div>
                        <div className="h-4 w-px bg-border" />
                        <div className="flex items-center gap-2">
                            <TrendingUp size={13} className="text-green-500" />
                            <div>
                                <span className="font-bold">{successRate}%</span>
                                <span className="text-[10px] text-muted-foreground ml-1">Success</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-muted/30 rounded-lg p-2 flex items-center justify-between border border-border/40">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Fallback:</span>
                        <div className="flex items-center gap-1 text-[10px]">
                            <span className="px-1.5 py-0.5 rounded font-bold bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300">Groq</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="px-1.5 py-0.5 rounded font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">Gemini</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="px-1.5 py-0.5 rounded font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">Mistral</span>
                        </div>
                    </div>
                </div>

                {/* Recent AI Activity (Compact List) */}
                {recentLogs.length > 0 && (
                    <div className="pt-1 border-t border-border/40">
                        <div className="flex items-center justify-between mb-1.5">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Recent Activity</p>
                            {recentLogs.length > 3 && (
                                <button
                                    onClick={() => setShowAllActivity(!showAllActivity)}
                                    className="text-[10px] text-primary hover:underline flex items-center gap-0.5 font-medium"
                                >
                                    {showAllActivity ? 'Show Less' : `View All (${recentLogs.length})`}
                                    {showAllActivity ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                                </button>
                            )}
                        </div>

                        <div className={`space-y-1.5 ${showAllActivity ? 'max-h-48' : 'max-h-24'} overflow-y-auto pr-1`}>
                            {displayedLogs.map((log, i) => {
                                const provider = extractProvider(log.details);
                                const latency = extractLatency(log.details);
                                const isSuccess = !log.details.includes('Fail') && !log.details.includes('failed');

                                return (
                                    <div key={i} className="flex items-center justify-between gap-2 p-1.5 rounded-md bg-muted/20 hover:bg-muted/40 text-[11px] transition-colors">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            {isSuccess
                                                ? <CheckCircle2 size={11} className="text-green-500 shrink-0" />
                                                : <XCircle size={11} className="text-red-400 shrink-0" />
                                            }
                                            <span className="font-medium text-foreground/80 truncate text-[11px]">
                                                {formatTaskLabel(log.details)}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {provider ? (
                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${provider.cls}`}>
                                                    {provider.label}
                                                </span>
                                            ) : (
                                                <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300">
                                                    Failed
                                                </span>
                                            )}
                                            {latency && (
                                                <span className="text-[9px] text-muted-foreground font-mono">
                                                    {latency}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* API Keys Configuration Modal */}
            {showKeyModal && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-card border border-border rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl">
                        <div className="flex items-center justify-between border-b border-border pb-3">
                            <div className="flex items-center gap-2">
                                <Key size={16} className="text-primary" />
                                <h3 className="font-bold text-sm">AI Engine API Keys</h3>
                            </div>
                            <button
                                onClick={() => setShowKeyModal(false)}
                                className="text-muted-foreground hover:text-foreground text-xs"
                            >
                                ✕
                            </button>
                        </div>

                        <p className="text-xs text-muted-foreground leading-relaxed">
                            API keys save directly to browser secure storage and environment fallbacks. Paste your Mistral, Groq, or Gemini keys below:
                        </p>

                        <div className="space-y-3">
                            <div>
                                <label className="text-[11px] font-bold text-purple-600 dark:text-purple-400 mb-1 flex items-center justify-between">
                                    <span>Mistral AI Key (Hindi / Multilingual)</span>
                                    {mistralInput.length >= 20 && <span className="text-[9px] text-green-500 font-normal">✓ Valid Format</span>}
                                </label>
                                <input
                                    type="password"
                                    value={mistralInput}
                                    onChange={e => setMistralInput(e.target.value)}
                                    placeholder="Paste Mistral API Key..."
                                    className="w-full p-2 text-xs rounded-lg border border-input bg-background font-mono outline-none focus:ring-1 focus:ring-purple-500"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-orange-600 dark:text-orange-400 mb-1 flex items-center justify-between">
                                    <span>Groq API Key (Speed Engine)</span>
                                    {groqInput.length >= 20 && <span className="text-[9px] text-green-500 font-normal">✓ Valid Format</span>}
                                </label>
                                <input
                                    type="password"
                                    value={groqInput}
                                    onChange={e => setGroqInput(e.target.value)}
                                    placeholder="Paste Groq API Key..."
                                    className="w-full p-2 text-xs rounded-lg border border-input bg-background font-mono outline-none focus:ring-1 focus:ring-orange-500"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-blue-600 dark:text-blue-400 mb-1 flex items-center justify-between">
                                    <span>Gemini API Key (Analytics)</span>
                                    {geminiInput.length >= 20 && <span className="text-[9px] text-green-500 font-normal">✓ Valid Format</span>}
                                </label>
                                <input
                                    type="password"
                                    value={geminiInput}
                                    onChange={e => setGeminiInput(e.target.value)}
                                    placeholder="Paste Gemini API Key..."
                                    className="w-full p-2 text-xs rounded-lg border border-input bg-background font-mono outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                            <button
                                onClick={() => setShowKeyModal(false)}
                                className="px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveKeys}
                                className="px-4 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-sm"
                            >
                                Save & Activate
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AICommandCenter;
