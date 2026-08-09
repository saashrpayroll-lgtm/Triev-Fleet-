import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, PhoneCall, Sparkles, AlertTriangle, ShieldAlert, CheckCircle2, Loader2, Bot, Volume2 } from 'lucide-react';
import { Rider } from '@/types';
import { OutboundCallService, CallScenario } from '@/services/OutboundCallService';
import { toast } from 'sonner';

interface ElevenLabsCallModalProps {
    isOpen: boolean;
    onClose: () => void;
    rider: Rider | null;
    currentUserName?: string;
}

export const ElevenLabsCallModal: React.FC<ElevenLabsCallModalProps> = ({
    isOpen,
    onClose,
    rider,
    currentUserName
}) => {
    const [scenario, setScenario] = useState<CallScenario>('negative_balance');
    const [customNote, setCustomNote] = useState('');
    const [calling, setCalling] = useState(false);
    const [callCompleted, setCallCompleted] = useState(false);

    if (!isOpen || !rider) return null;

    // Auto select default scenario based on wallet balance
    const isNegative = rider.walletAmount < 0;
    const isLow = rider.walletAmount >= 0 && rider.walletAmount <= 249;

    const handleInitiateCall = async () => {
        setCalling(true);
        try {
            const result = await OutboundCallService.triggerCall({
                riderId: rider.id,
                riderName: rider.riderName,
                mobileNumber: rider.mobileNumber,
                walletAmount: rider.walletAmount,
                callScenario: scenario,
                customNote,
                triggeredBy: currentUserName
            });

            if (result.success) {
                setCallCompleted(true);
                toast.success(result.message);
            } else {
                toast.error(result.message);
            }
        } catch (error: any) {
            console.error('Call Trigger Error:', error);
            toast.error('Failed to trigger ElevenLabs AI call');
        } finally {
            setCalling(false);
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="w-full max-w-lg bg-card border border-border/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col relative"
                >
                    {/* Glowing Header */}
                    <div className="p-6 bg-gradient-to-r from-violet-600 via-indigo-600 to-primary text-white flex justify-between items-start relative overflow-hidden">
                        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                        <div className="relative z-10 flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-xl border border-white/20 flex items-center justify-center shadow-inner">
                                <Bot className="w-6 h-6 text-white animate-pulse" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-xl font-black tracking-tight">ElevenLabs AI Outbound Call</h2>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-white/20 border border-white/30 text-white tracking-widest">
                                        n8n Powered
                                    </span>
                                </div>
                                <p className="text-xs text-white/80 mt-0.5">Automated AI Voice Call for Rider Recovery & Collection</p>
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-colors relative z-10"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Rider Card Summary */}
                    <div className="p-6 space-y-6">
                        <div className="p-4 rounded-2xl bg-muted/40 border border-border/50 flex items-center justify-between">
                            <div>
                                <h3 className="font-extrabold text-base text-foreground">{rider.riderName}</h3>
                                <p className="text-xs text-muted-foreground font-mono mt-0.5">Mobile: {rider.mobileNumber} · ID: {rider.trievId}</p>
                            </div>
                            <div className={`px-3 py-1.5 rounded-xl text-xs font-black border flex items-center gap-1.5 ${
                                rider.walletAmount < 0
                                    ? 'bg-red-500/10 text-red-600 border-red-500/20'
                                    : rider.walletAmount <= 249
                                        ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                                        : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                            }`}>
                                {rider.walletAmount < 0 ? '-' : ''}₹{Math.abs(rider.walletAmount).toLocaleString('en-IN')}
                            </div>
                        </div>

                        {/* Call Scenario Selector */}
                        <div className="space-y-3">
                            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                <Volume2 size={14} className="text-primary" /> Select Call Scenario Script
                            </label>

                            <div className="grid grid-cols-1 gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => setScenario('negative_balance')}
                                    className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3 ${
                                        scenario === 'negative_balance'
                                            ? 'border-red-500 bg-red-500/5 ring-2 ring-red-500/20'
                                            : 'border-border bg-card hover:bg-muted/30'
                                    }`}
                                >
                                    <div className="p-2 rounded-xl bg-red-500/10 text-red-600 mt-0.5">
                                        <ShieldAlert size={18} />
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm text-foreground flex items-center gap-2">
                                            Overdue Debt Recovery Call
                                            {isNegative && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500 text-white font-black">RECOMMENDED</span>}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            AI Voice Call urging immediate settlement for negative wallet balance (below ₹0).
                                        </p>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setScenario('low_balance')}
                                    className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3 ${
                                        scenario === 'low_balance'
                                            ? 'border-amber-500 bg-amber-500/5 ring-2 ring-amber-500/20'
                                            : 'border-border bg-card hover:bg-muted/30'
                                    }`}
                                >
                                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 mt-0.5">
                                        <AlertTriangle size={18} />
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm text-foreground flex items-center gap-2">
                                            Low Balance Recharge Warning Call
                                            {isLow && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500 text-white font-black">RECOMMENDED</span>}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            AI Voice Reminder for riders with balance between ₹0 and ₹249 to prevent vehicle lockout.
                                        </p>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setScenario('custom_reminder')}
                                    className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3 ${
                                        scenario === 'custom_reminder'
                                            ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                                            : 'border-border bg-card hover:bg-muted/30'
                                    }`}
                                >
                                    <div className="p-2 rounded-xl bg-primary/10 text-primary mt-0.5">
                                        <Sparkles size={18} />
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm text-foreground">Custom Voice Note Scenario</div>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            Pass custom instructions to the ElevenLabs Agent prompt.
                                        </p>
                                    </div>
                                </button>
                            </div>
                        </div>

                        {scenario === 'custom_reminder' && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-muted-foreground">Custom Instructions for ElevenLabs Voice Agent</label>
                                <textarea
                                    value={customNote}
                                    onChange={(e) => setCustomNote(e.target.value)}
                                    placeholder="Enter custom prompt instructions for the AI Agent..."
                                    rows={3}
                                    className="w-full p-3 border border-input rounded-2xl text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="p-6 bg-muted/20 border-t border-border flex items-center justify-between gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 border border-input rounded-xl text-xs font-semibold text-muted-foreground hover:bg-accent transition-colors"
                        >
                            Cancel
                        </button>

                        <button
                            type="button"
                            onClick={handleInitiateCall}
                            disabled={calling}
                            className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-primary text-white rounded-xl text-xs font-extrabold hover:opacity-95 shadow-lg shadow-primary/20 flex items-center gap-2 disabled:opacity-50 transition-all"
                        >
                            {calling ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Initiating AI Call...
                                </>
                            ) : callCompleted ? (
                                <>
                                    <CheckCircle2 size={16} />
                                    Call Dispatched
                                </>
                            ) : (
                                <>
                                    <PhoneCall size={16} />
                                    Trigger ElevenLabs AI Call
                                </>
                            )}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default ElevenLabsCallModal;
