import React, { useState, useEffect } from 'react';
import { Rider } from '@/types';
import { supabase } from '@/config/supabase';
import { AIService } from '@/services/AIService';
import { AlertTriangle, MessageCircle, RefreshCw, Wallet, AlertOctagon, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface DebtRecoveryTasksProps {
    riders: Rider[];
    currentUserId: string;
}

const CRITICAL_THRESHOLD = -300;

const DebtRecoveryTasks: React.FC<DebtRecoveryTasksProps> = ({ riders, currentUserId }) => {
    const [activeTab, setActiveTab] = useState<'critical' | 'warning'>('critical');
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [recoveryMessage, setRecoveryMessage] = useState<string>('');
    const [selectedRider, setSelectedRider] = useState<Rider | null>(null);

    // Filter Riders
    const criticalRiders = riders.filter(r => r.walletAmount <= CRITICAL_THRESHOLD).sort((a, b) => a.walletAmount - b.walletAmount); // Ascending (more negative first)
    const warningRiders = riders.filter(r => r.walletAmount < 0 && r.walletAmount > CRITICAL_THRESHOLD).sort((a, b) => a.walletAmount - b.walletAmount);

    const activeList = activeTab === 'critical' ? criticalRiders : warningRiders;

    const handleAction = async (rider: Rider) => {
        setSelectedRider(rider);
        setProcessingId(rider.id);
        try {
            // Generate Message based on severity
            let msg = '';
            if (rider.walletAmount <= CRITICAL_THRESHOLD) {
                msg = await AIService.generateRecoveryMessage(rider, 'hindi'); // Default to Hindi for mass market? Or make selectable.
            } else {
                msg = await AIService.generatePaymentReminder(rider, 'hindi', 'urgent');
            }

            // Hydrate placeholders immediately for preview
            const amountStr = Math.abs(rider.walletAmount).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
            const hydrated = msg.replace(/{name}/g, `*${rider.riderName}*`).replace(/{amount}/g, `*${amountStr}*`);

            setRecoveryMessage(hydrated);
        } catch (error) {
            console.error("Error generating recovery message:", error);
            toast.error("Failed to generate AI message.");
            setProcessingId(null);
            setSelectedRider(null);
        }
    };

    const confirmSend = async () => {
        if (!selectedRider) return;

        try {
            // 1. Open WhatsApp
            const phone = selectedRider.mobileNumber.replace(/\D/g, '');
            const encodedMsg = encodeURIComponent(recoveryMessage);
            const url = `https://wa.me/${phone}?text=${encodedMsg}`;
            window.open(url, '_blank');

            // 2. Log Activity
            const { error } = await supabase.from('activity_logs').insert({
                user_id: currentUserId,
                action_type: selectedRider.walletAmount <= CRITICAL_THRESHOLD ? 'sent_recovery_warning' : 'payment_reminder',
                target_type: 'rider',
                target_id: selectedRider.id,
                details: `Sent ${selectedRider.walletAmount <= CRITICAL_THRESHOLD ? 'EV Recovery Warning' : 'Payment Reminder'} to ${selectedRider.riderName} (₹${selectedRider.walletAmount})`,
                timestamp: new Date().toISOString()
            });

            if (error) throw error;

            toast.success("Action logged & WhatsApp opened!");
        } catch (error) {
            console.error("Error logging action:", error);
            toast.error("Message sent but failed to log action.");
        } finally {
            setProcessingId(null);
            setSelectedRider(null);
            setRecoveryMessage('');
        }
    };

    return (
        <div className="bg-card/50 backdrop-blur-sm border rounded-3xl p-6 shadow-lg space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-black tracking-tight flex items-center gap-2">
                        <AlertOctagon className={activeTab === 'critical' ? "text-red-500" : "text-orange-500"} />
                        Recovery Tasks
                    </h3>
                    <p className="text-muted-foreground text-sm">
                        AI-Prioritized actions for negative wallet balance.
                    </p>
                </div>
                <div className="flex bg-muted rounded-xl p-1">
                    <button
                        onClick={() => setActiveTab('critical')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'critical' ? 'bg-red-500 text-white shadow-md' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        Critical ({criticalRiders.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('warning')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'warning' ? 'bg-orange-500 text-white shadow-md' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        Dues ({warningRiders.length})
                    </button>
                </div>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {activeList.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground border border-dashed rounded-xl">
                        <CheckCircle2 className="mx-auto mb-2 text-green-500" size={32} />
                        <p>No riders in this category. Great job!</p>
                    </div>
                ) : (
                    <AnimatePresence>
                        {activeList.map((rider) => (
                            <motion.div
                                key={rider.id}
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className={`group p-4 rounded-2xl border transition-all ${selectedRider?.id === rider.id
                                        ? 'bg-primary/5 border-primary ring-1 ring-primary'
                                        : 'bg-card border-border hover:border-primary/50'
                                    }`}
                            >
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex items-start gap-3">
                                        <div className={`mt-1 p-2 rounded-full ${rider.walletAmount <= CRITICAL_THRESHOLD ? 'bg-red-100 dark:bg-red-900/30 text-red-600' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-600'}`}>
                                            <Wallet size={18} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-foreground">{rider.riderName}</h4>
                                            <p className="text-xs text-muted-foreground font-medium flex items-center gap-2">
                                                ID: {rider.trievId}
                                                <span className="w-1 h-1 rounded-full bg-border" />
                                                {rider.mobileNumber}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`text-sm font-black ${rider.walletAmount <= CRITICAL_THRESHOLD ? 'text-red-600' : 'text-orange-500'}`}>
                                                    {rider.walletAmount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                                                </span>
                                                {rider.walletAmount <= CRITICAL_THRESHOLD && (
                                                    <span className="text-[10px] font-bold uppercase tracking-wider bg-red-100 dark:bg-red-900/30 text-red-600 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-800">
                                                        Risk: High
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {selectedRider?.id === rider.id ? (
                                        <div className="flex-1 w-full md:max-w-md animate-in fade-in zoom-in-95 duration-200">
                                            <div className="bg-background border rounded-xl p-3 shadow-sm">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-xs font-bold text-primary flex items-center gap-1">
                                                        <MessageCircle size={12} />
                                                        AI Draft ({activeTab === 'critical' ? 'Recovery' : 'Reminder'})
                                                    </span>
                                                </div>
                                                <textarea
                                                    value={recoveryMessage}
                                                    onChange={(e) => setRecoveryMessage(e.target.value)}
                                                    className="w-full text-xs bg-muted/50 p-2 rounded-lg border-none focus:ring-1 focus:ring-primary h-20 resize-none font-medium"
                                                />
                                                <div className="flex justify-end gap-2 mt-2">
                                                    <button
                                                        onClick={() => { setSelectedRider(null); setProcessingId(null); }}
                                                        className="text-xs font-bold text-muted-foreground hover:text-foreground px-3 py-1.5"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        onClick={confirmSend}
                                                        className="text-xs font-bold bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-sm"
                                                    >
                                                        <MessageCircle size={14} />
                                                        Send WhatsApp
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => handleAction(rider)}
                                            disabled={processingId !== null}
                                            className={`
                                                relative overflow-hidden px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-sm
                                                ${activeTab === 'critical'
                                                    ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/20'
                                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20'}
                                                disabled:opacity-50 disabled:cursor-not-allowed
                                            `}
                                        >
                                            {activeTab === 'critical' ? (
                                                <>
                                                    <AlertTriangle size={16} />
                                                    Recover EV
                                                </>
                                            ) : (
                                                <>
                                                    <RefreshCw size={16} />
                                                    Remind
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
};

export default DebtRecoveryTasks;
