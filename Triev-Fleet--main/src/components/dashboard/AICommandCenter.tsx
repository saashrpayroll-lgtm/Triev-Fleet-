import React, { useState, useEffect } from 'react';
import { Zap, Brain, Globe, CheckCircle2, XCircle, Clock, RefreshCw, TrendingUp, Activity, Sparkles } from 'lucide-react';
import { AIConfigService } from '@/services/AIConfigService';
import { supabase } from '@/config/supabase';

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

    const loadEngineStatus = () => {
        const groqKey = AIConfigService.getGroqKey();
        const geminiKey = AIConfigService.getGeminiKey();
        const mistralKey = AIConfigService.getMistralKey();

        setEngines([
            {
                name: 'Groq',
                key: 'groq',
                icon: <Zap size={16} className="fill-current" />,
                color: 'orange',
                role: 'Speed Engine (sub-second)',
                configured: !!(groqKey && groqKey.length >= 20),
            },
            {
                name: 'Gemini',
                key: 'gemini',
                icon: <Brain size={16} />,
                color: 'blue',
                role: 'Analysis & Creative',
                configured: !!(geminiKey && geminiKey.length >= 20),
            },
            {
                name: 'Mistral',
                key: 'mistral',
                icon: <Globe size={16} />,
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
                .limit(8);

            if (data) {
                setRecentLogs(data);
                setTotalCalls(data.length);
                const successes = data.filter(d => !d.details.includes('Fail')).length;
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

    useEffect(() => {
        loadEngineStatus();
        loadActivityLogs();
    }, []);

    const colorMap: Record<string, { bg: string; text: string; border: string; pill: string }> = {
        orange: {
            bg:     'bg-orange-50 dark:bg-orange-900/20',
            text:   'text-orange-600 dark:text-orange-400',
            border: 'border-orange-200 dark:border-orange-800',
            pill:   'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
        },
        blue: {
            bg:     'bg-blue-50 dark:bg-blue-900/20',
            text:   'text-blue-600 dark:text-blue-400',
            border: 'border-blue-200 dark:border-blue-800',
            pill:   'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
        },
        purple: {
            bg:     'bg-purple-50 dark:bg-purple-900/20',
            text:   'text-purple-600 dark:text-purple-400',
            border: 'border-purple-200 dark:border-purple-800',
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

    const configuredCount = engines.filter(e => e.configured).length;

    return (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-purple-600/10 via-blue-600/10 to-orange-600/10 border-b border-border">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
                            <Sparkles size={18} className="text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-sm">AI Command Center</h3>
                            <p className="text-xs text-muted-foreground">
                                {configuredCount}/3 engines active
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={refresh}
                        className="p-2 hover:bg-accent rounded-lg transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw size={14} className={`text-muted-foreground ${isRefreshing ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            <div className="p-4 space-y-4">
                {/* Engine Status Cards */}
                <div className="grid grid-cols-3 gap-2">
                    {engines.map(engine => {
                        const c = colorMap[engine.color];
                        return (
                            <div
                                key={engine.key}
                                className={`relative rounded-xl p-3 border ${c.bg} ${c.border} flex flex-col gap-2`}
                            >
                                {/* Status dot */}
                                <span className={`absolute top-2 right-2 w-2 h-2 rounded-full ${engine.configured ? 'bg-green-500 animate-pulse' : 'bg-gray-300 dark:bg-gray-600'}`} />

                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${c.pill}`}>
                                    {engine.icon}
                                </div>

                                <div>
                                    <p className={`text-xs font-bold ${engine.configured ? c.text : 'text-muted-foreground'}`}>
                                        {engine.name}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                                        {engine.role}
                                    </p>
                                </div>

                                <div className="flex items-center gap-1">
                                    {engine.configured ? (
                                        <>
                                            <CheckCircle2 size={10} className="text-green-500" />
                                            <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">Active</span>
                                        </>
                                    ) : (
                                        <>
                                            <XCircle size={10} className="text-muted-foreground" />
                                            <span className="text-[10px] text-muted-foreground">No Key</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-2 gap-2">
                    <div className="bg-muted/40 rounded-xl p-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                            <Activity size={14} className="text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <p className="text-lg font-black leading-none">{totalCalls}</p>
                            <p className="text-[10px] text-muted-foreground">AI Calls (recent)</p>
                        </div>
                    </div>
                    <div className="bg-muted/40 rounded-xl p-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                            <TrendingUp size={14} className="text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                            <p className="text-lg font-black leading-none">{successRate}%</p>
                            <p className="text-[10px] text-muted-foreground">Success Rate</p>
                        </div>
                    </div>
                </div>

                {/* Fallback Chain Visualization */}
                <div className="bg-muted/20 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Fallback Chain</p>
                    <div className="flex items-center gap-1.5 text-xs flex-wrap">
                        {[
                            { label: '⚡ Groq', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
                            { label: '→', cls: 'text-muted-foreground' },
                            { label: '🧠 Gemini', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
                            { label: '→', cls: 'text-muted-foreground' },
                            { label: '🌐 Mistral', cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
                        ].map((item, i) => (
                            item.label === '→'
                                ? <span key={i} className={item.cls}>{item.label}</span>
                                : <span key={i} className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${item.cls}`}>{item.label}</span>
                        ))}
                    </div>
                </div>

                {/* Recent AI Activity */}
                {recentLogs.length > 0 && (
                    <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Recent Activity</p>
                        <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                            {recentLogs.map((log, i) => {
                                const provider = extractProvider(log.details);
                                const latency = extractLatency(log.details);
                                const isSuccess = !log.details.includes('Fail');

                                return (
                                    <div key={i} className="flex items-start gap-2 text-[11px]">
                                        {isSuccess
                                            ? <CheckCircle2 size={11} className="text-green-500 mt-0.5 shrink-0" />
                                            : <XCircle size={11} className="text-red-400 mt-0.5 shrink-0" />
                                        }
                                        <div className="flex-1 min-w-0">
                                            <p className="text-foreground/70 truncate">
                                                {log.details.replace(/AI performed: /, '').replace(/ - \d+ms.*/, '')}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            {provider && (
                                                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${provider.cls}`}>
                                                    {provider.label}
                                                </span>
                                            )}
                                            {latency && (
                                                <span className="flex items-center gap-0.5 text-muted-foreground text-[9px]">
                                                    <Clock size={9} />{latency}
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
        </div>
    );
};

export default AICommandCenter;
