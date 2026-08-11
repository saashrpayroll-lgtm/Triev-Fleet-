import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Sparkles, Phone, MessageSquare, ShieldAlert, RefreshCw, ChevronDown, ChevronUp, Copy, Check, Send } from 'lucide-react';
import { AIService } from '@/services/AIService';
import { Rider, Lead } from '@/types';
import { toast } from 'sonner';

export interface AIVirtualOpsCopilotProps {
    roleName: string;
    riders: Rider[];
    leads?: Lead[];
    requests?: any[];
}

export const AIVirtualOpsCopilot: React.FC<AIVirtualOpsCopilotProps> = ({
    roleName,
    riders,
    leads = [],
    requests = []
}) => {
    const [loading, setLoading] = useState(false);
    const [plan, setPlan] = useState<any>(null);
    const [isExpanded, setIsExpanded] = useState(true);
    const [selectedRiderScript, setSelectedRiderScript] = useState<any | null>(null);
    const [scriptLoading, setScriptLoading] = useState(false);
    const [scripts, setScripts] = useState<{ hindiScript: string; englishScript: string; whatsappHindi: string; whatsappEnglish: string } | null>(null);
    const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

    // Dynamic prompt query state
    const [query, setQuery] = useState('');
    const [queryResponse, setQueryResponse] = useState<string | null>(null);
    const [queryLoading, setQueryLoading] = useState(false);

    const generatePlan = async () => {
        setLoading(true);
        try {
            const res = await AIService.generateDailyOperationsPlan({ riders, leads, requests }, roleName);
            setPlan(res);
        } catch (err) {
            console.error("Failed to generate AI plan", err);
            toast.error("Failed to load AI Operations Plan");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (riders.length > 0 && !plan) {
            generatePlan();
        }
    }, [riders.length]);

    const handleGenerateScript = async (riderName: string, walletAmount: number) => {
        setScriptLoading(true);
        setSelectedRiderScript({ name: riderName, walletAmount });
        try {
            const res = await AIService.generateSmartCallScript({ riderName, walletAmount });
            setScripts(res);
        } catch (err) {
            toast.error("Failed to generate call script");
        } finally {
            setScriptLoading(false);
        }
    };

    const handleCopy = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(label);
        toast.success(`Copied ${label} script to clipboard!`);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    const handleQuerySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;
        setQueryLoading(true);
        try {
            const activeCount = riders.filter(r => r.status === 'active').length;
            const negCount = riders.filter(r => r.status === 'active' && r.walletAmount < 0).length;
            const totalWallet = riders.reduce((s, r) => s + r.walletAmount, 0);

            const ans = await AIService.chatWithBot(query, [], {
                userName: roleName,
                role: roleName,
                stats: { activeRiders: activeCount, totalRiders: riders.length, negativeRiders: negCount, totalLeads: leads.length, totalWallet }
            });
            setQueryResponse(ans);
        } catch (err) {
            toast.error("AI query failed");
        } finally {
            setQueryLoading(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-5 rounded-3xl bg-gradient-to-br from-indigo-950/90 via-slate-900/90 to-black/90 border border-indigo-500/30 text-white backdrop-blur-2xl shadow-2xl relative overflow-hidden"
        >
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />

            {/* Header */}
            <div className="flex items-center justify-between gap-4 pb-3 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-400/30 shadow-inner">
                        <Bot className="w-5 h-5 animate-bounce" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-base font-black tracking-tight text-white">AI Virtual Team Leader &amp; Copilot</h3>
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-400/30">
                                Autonomous Assistant
                            </span>
                        </div>
                        <p className="text-xs text-white/60">Targeted daily directives, debt recovery calls &amp; lead priorities</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={generatePlan}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold transition-all border border-white/10"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        <span>Refresh Plan</span>
                    </button>
                    <button
                        onClick={() => setIsExpanded(v => !v)}
                        className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 transition-colors"
                    >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-4 pt-4"
                    >
                        {/* Daily AI Directive */}
                        {loading ? (
                            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center animate-pulse text-xs text-white/60">
                                AI is analyzing fleet metrics and generating optimal daily action plan...
                            </div>
                        ) : plan ? (
                            <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 backdrop-blur-md">
                                <div className="flex items-center gap-2 text-xs font-bold text-indigo-300 mb-1">
                                    <Sparkles className="w-4 h-4 text-indigo-400" />
                                    <span>AI Daily Operations Directive</span>
                                </div>
                                <p className="text-xs text-white/90 leading-relaxed font-medium">{plan.summary}</p>
                            </div>
                        ) : null}

                        {/* Hard Recovery Escalations (> ₹1,500 Debt) */}
                        {plan?.hardRecoveryEscalations?.length > 0 && (
                            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 backdrop-blur-md">
                                <div className="flex items-center gap-2 text-xs font-black text-rose-400 mb-2">
                                    <ShieldAlert className="w-4 h-4 animate-pulse" />
                                    <span>Hard Recovery Escalations (Debt &gt; ₹1,500)</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                    {plan.hardRecoveryEscalations.map((item: any, idx: number) => (
                                        <div key={idx} className="p-2.5 rounded-xl bg-black/40 border border-rose-500/20 flex flex-col justify-between">
                                            <div>
                                                <div className="flex items-center justify-between text-xs font-bold text-white">
                                                    <span>{item.riderName}</span>
                                                    <span className="text-rose-400">-₹{item.debtAmount}</span>
                                                </div>
                                                <p className="text-[10px] text-white/60 mt-0.5">{item.reason}</p>
                                            </div>
                                            <button
                                                onClick={() => handleGenerateScript(item.riderName, -item.debtAmount)}
                                                className="mt-2 w-full py-1 text-[10px] font-black uppercase rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30 flex items-center justify-center gap-1 transition-all"
                                            >
                                                <Phone className="w-3 h-3" />
                                                <span>Script &amp; Call</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Priority Debt Recovery Tasks */}
                        {plan?.debtRecoveryActions?.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-xs font-bold text-white/80 uppercase tracking-wider">Priority Debt Recovery Tasks</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {plan.debtRecoveryActions.map((task: any, i: number) => (
                                        <div key={i} className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-white truncate">{task.riderName}</span>
                                                    <span className="text-xs font-mono font-bold text-rose-400">₹{task.walletAmount}</span>
                                                </div>
                                                <p className="text-[11px] text-white/60 truncate mt-0.5">{task.action}</p>
                                            </div>

                                            <button
                                                onClick={() => handleGenerateScript(task.riderName, task.walletAmount)}
                                                className="px-2.5 py-1.5 text-[10px] font-bold rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 shrink-0 flex items-center gap-1"
                                            >
                                                <MessageSquare className="w-3 h-3" />
                                                <span>AI Scripts</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Script Modal Popup / Display */}
                        {selectedRiderScript && (
                            <div className="p-4 rounded-2xl bg-slate-950 border border-indigo-500/40 space-y-3 animate-in fade-in slide-in-from-top-2">
                                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                                    <div className="flex items-center gap-2">
                                        <Phone className="w-4 h-4 text-indigo-400" />
                                        <span className="text-xs font-bold text-white">
                                            Smart Multilingual Script for {selectedRiderScript.name} (Balance: ₹{selectedRiderScript.walletAmount})
                                        </span>
                                    </div>
                                    <button onClick={() => setSelectedRiderScript(null)} className="text-xs text-white/50 hover:text-white">Close</button>
                                </div>

                                {scriptLoading ? (
                                    <p className="text-xs text-white/60 animate-pulse py-4 text-center">Generating Hindi &amp; English AI Scripts...</p>
                                ) : scripts ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                        {/* Hindi Script */}
                                        <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
                                            <div className="flex items-center justify-between text-indigo-300 font-bold">
                                                <span>🇮🇳 Hindi Phone Call Script</span>
                                                <button onClick={() => handleCopy(scripts.hindiScript, 'Hindi Call')} className="text-[10px] text-white/60 hover:text-white flex items-center gap-1">
                                                    {copiedIndex === 'Hindi Call' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />} Copy
                                                </button>
                                            </div>
                                            <p className="text-white/80 leading-relaxed font-sans">{scripts.hindiScript}</p>

                                            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-emerald-300 font-bold">
                                                <span>💬 WhatsApp Hindi</span>
                                                <button onClick={() => handleCopy(scripts.whatsappHindi, 'Hindi WhatsApp')} className="text-[10px] text-white/60 hover:text-white flex items-center gap-1">
                                                    {copiedIndex === 'Hindi WhatsApp' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />} Copy
                                                </button>
                                            </div>
                                            <p className="text-white/80 leading-relaxed font-sans">{scripts.whatsappHindi}</p>
                                        </div>

                                        {/* English Script */}
                                        <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
                                            <div className="flex items-center justify-between text-indigo-300 font-bold">
                                                <span>🇬🇧 English Phone Call Script</span>
                                                <button onClick={() => handleCopy(scripts.englishScript, 'English Call')} className="text-[10px] text-white/60 hover:text-white flex items-center gap-1">
                                                    {copiedIndex === 'English Call' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />} Copy
                                                </button>
                                            </div>
                                            <p className="text-white/80 leading-relaxed font-sans">{scripts.englishScript}</p>

                                            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-emerald-300 font-bold">
                                                <span>💬 WhatsApp English</span>
                                                <button onClick={() => handleCopy(scripts.whatsappEnglish, 'English WhatsApp')} className="text-[10px] text-white/60 hover:text-white flex items-center gap-1">
                                                    {copiedIndex === 'English WhatsApp' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />} Copy
                                                </button>
                                            </div>
                                            <p className="text-white/80 leading-relaxed font-sans">{scripts.whatsappEnglish}</p>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        )}

                        {/* Natural Language AI Fleet Query Bar */}
                        <form onSubmit={handleQuerySubmit} className="flex gap-2 pt-2 border-t border-white/10">
                            <input
                                type="text"
                                placeholder="Ask AI Copilot (e.g. 'Show total negative wallet balance' or 'Suggest lead strategy')..."
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                className="flex-1 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                            />
                            <button
                                type="submit"
                                disabled={queryLoading}
                                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition-all flex items-center gap-1.5"
                            >
                                {queryLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                <span>Ask AI</span>
                            </button>
                        </form>

                        {queryResponse && (
                            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-white/90 leading-relaxed">
                                <span className="font-bold text-indigo-300 block mb-1">AI Response:</span>
                                {queryResponse}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default AIVirtualOpsCopilot;
