import React, { useState } from 'react';
import { Rider, User } from '@/types';
import { supabase } from '@/config/supabase';
import { AIService } from '@/services/AIService';
import { AlertTriangle, MessageCircle, RefreshCw, Wallet, CheckCircle2, Send, X, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface DebtRecoveryTasksProps {
    riders: Rider[];
    currentUser: User;
}

const CRITICAL_THRESHOLD = -300;

const DebtRecoveryTasks: React.FC<DebtRecoveryTasksProps> = ({ riders, currentUser }) => {
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
                // Modified prompt in AIService now handles name/amount injection directly
                msg = await AIService.generateRecoveryMessage(rider, 'hindi');
            } else {
                msg = await AIService.generatePaymentReminder(rider, 'hindi', 'urgent');
            }

            setRecoveryMessage(msg);
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
            // Ensure we match the ActivityLog interface in types/index.ts
            const logEntry = {
                user_id: currentUser.id,
                user_name: currentUser.fullName || currentUser.username || 'Unknown',
                user_role: currentUser.role,
                action_type: selectedRider.walletAmount <= CRITICAL_THRESHOLD ? 'sent_recovery_warning' : 'payment_reminder',
                target_type: 'rider',
                target_id: selectedRider.id,
                details: `Sent ${selectedRider.walletAmount <= CRITICAL_THRESHOLD ? 'EV Recovery Warning' : 'Payment Reminder'} to ${selectedRider.riderName} (₹${selectedRider.walletAmount})`,
                metadata: {
                    message_preview: recoveryMessage.substring(0, 50) + '...',
                    rider_name: selectedRider.riderName,
                    amount: selectedRider.walletAmount
                },
                timestamp: new Date().toISOString()
            };

            const { error } = await supabase.from('activity_logs').insert(logEntry);

            if (error) {
                console.error("Supabase Log Error:", error);
                throw error;
            }

            toast.success("Action logged & WhatsApp opened!");
        } catch (error) {
            console.error("Error logging action:", error);
            toast.error("Message sent but failed to log action in system.");
        } finally {
            setProcessingId(null);
            setSelectedRider(null);
            setRecoveryMessage('');
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(recoveryMessage);
        toast.success("Message copied!");
    };

    return (
        <div className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-xl border rounded-[2rem] p-6 shadow-xl space-y-6 relative overflow-hidden">
            {/* Decorative Background */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10" />

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h3 className="text-xl font-black tracking-tight flex items-center gap-2">
                        {activeTab === 'critical' ? (
                            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-xl text-red-600">
                                <AlertTriangle size={20} className="fill-current" />
                            </div>
                        ) : (
                            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-xl text-orange-600">
                                <RefreshCw size={20} />
                            </div>
                        )}
                        Recovery Assistant
                    </h3>
                    <p className="text-muted-foreground text-xs font-medium ml-1">
                        AI-Powered Debt Collection & Communication
                    </p>
                </div>

                <div className="flex bg-muted/50 p-1.5 rounded-2xl border">
                    <button
                        onClick={() => setActiveTab('critical')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'critical' ? 'bg-red-500 text-white shadow-lg shadow-red-500/25 scale-105' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <AlertTriangle size={14} />
                        Critical ({criticalRiders.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('warning')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'warning' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25 scale-105' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <Wallet size={14} />
                        Dues ({warningRiders.length})
                    </button>
                </div>
            </div>

            {/* Task Area */}
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {activeList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border-2 border-dashed border-muted rounded-[2rem] bg-card/30">
                        <div className="bg-green-100 dark:bg-green-900/20 p-4 rounded-full mb-4">
                            <CheckCircle2 className="text-green-600" size={40} />
                        </div>
                        <h4 className="font-bold text-lg text-foreground">All Clear!</h4>
                        <p className="text-sm opacity-80">No riders in this category. Great job!</p>
                    </div>
                ) : (
                    <AnimatePresence mode="popLayout">
                        {activeList.map((rider) => (
                            <motion.div
                                key={rider.id}
                                layout
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                                className={`group relative overflow-hidden rounded-[1.5rem] border transition-all duration-300 ${selectedRider?.id === rider.id
                                    ? 'bg-card ring-2 ring-primary shadow-2xl z-10'
                                    : 'bg-card/50 hover:bg-card border-border hover:border-primary/30 hover:shadow-lg'
                                    }`}
                            >
                                <div className="p-5">
                                    <div className="flex flex-col md:flex-row gap-5">

                                        {/* Rider Profile Section */}
                                        <div className="flex items-start gap-4 min-w-[200px]">
                                            <div className={`mt-1 w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${rider.walletAmount <= CRITICAL_THRESHOLD ? 'bg-red-100 dark:bg-red-900/20 text-red-600' : 'bg-orange-100 dark:bg-orange-900/20 text-orange-600'}`}>
                                                <Wallet size={24} strokeWidth={2.5} />
                                            </div>
                                            <div>
                                                <h4 className="font-black text-lg text-foreground leading-tight">{rider.riderName}</h4>
                                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-1 flex items-center gap-2">
                                                    ID: {rider.trievId}
                                                    <span className="w-1 h-1 rounded-full bg-border" />
                                                    {rider.mobileNumber}
                                                </p>
                                                <div className="mt-3 inline-flex flex-col items-start bg-muted/50 rounded-lg px-3 py-1.5 border border-border/50">
                                                    <span className="text-[10px] font-medium text-muted-foreground uppercase">Outstanding</span>
                                                    <span className={`text-xl font-black ${rider.walletAmount <= CRITICAL_THRESHOLD ? 'text-red-500' : 'text-orange-500'}`}>
                                                        {rider.walletAmount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action / Context Section */}
                                        <div className="flex-1 w-full relative">
                                            {selectedRider?.id === rider.id ? (
                                                <motion.div
                                                    initial={{ opacity: 0, x: 20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    className="bg-muted/30 rounded-2xl border p-4 h-full flex flex-col"
                                                >
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-xs font-bold text-primary flex items-center gap-1.5 uppercase tracking-wider">
                                                            <MessageCircle size={12} className="fill-primary" />
                                                            AI Draft Message
                                                        </span>
                                                        <button onClick={copyToClipboard} className="text-xs text-muted-foreground hover:text-primary transition-colors" title="Copy text">
                                                            <Copy size={12} />
                                                        </button>
                                                    </div>

                                                    {/* Chat Bubble Style */}
                                                    <div className="flex-1 bg-white dark:bg-black/20 rounded-xl rounded-tl-none p-3 mb-3 border border-border/50 shadow-sm">
                                                        <textarea
                                                            value={recoveryMessage}
                                                            onChange={(e) => setRecoveryMessage(e.target.value)}
                                                            className="w-full text-sm bg-transparent border-none focus:ring-0 p-0 resize-none font-medium leading-relaxed text-foreground min-h-[80px]"
                                                            placeholder="Generating message..."
                                                        />
                                                    </div>

                                                    <div className="flex justify-end gap-3 mt-auto">
                                                        <button
                                                            onClick={() => { setSelectedRider(null); setProcessingId(null); }}
                                                            className="text-xs font-bold text-muted-foreground hover:text-foreground px-4 py-2 hover:bg-muted/50 rounded-lg transition-colors flex items-center gap-1"
                                                        >
                                                            <X size={14} />
                                                            Cancel
                                                        </button>
                                                        <button
                                                            onClick={confirmSend}
                                                            className="text-xs font-bold bg-[#25D366] hover:bg-[#128C7E] text-white px-5 py-2 rounded-xl flex items-center gap-2 shadow-lg shadow-green-500/20 transform hover:-translate-y-0.5 transition-all"
                                                        >
                                                            <Send size={14} className="fill-white" />
                                                            Send WhatsApp
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            ) : (
                                                <div className="h-full flex flex-col justify-center items-end md:items-start space-y-3 pl-0 md:pl-4 border-l-0 md:border-l border-border/50">
                                                    <div className="hidden md:block">
                                                        {activeTab === 'critical' ? (
                                                            <p className="text-xs font-medium text-red-600/80 max-w-sm">
                                                                High risk of default. Send mandatory recovery warning regarding <b>"Hard Recovery Team"</b> action.
                                                            </p>
                                                        ) : (
                                                            <p className="text-xs font-medium text-orange-600/80 max-w-sm">
                                                                Payment overdue. Send a polite but firm reminder to avoid escalation.
                                                            </p>
                                                        )}
                                                    </div>

                                                    <button
                                                        onClick={() => handleAction(rider)}
                                                        disabled={processingId !== null}
                                                        className={`
                                                            group relative overflow-hidden px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-3 transition-all shadow-lg transform hover:-translate-y-0.5 active:translate-y-0 w-full md:w-auto justify-center
                                                            ${activeTab === 'critical'
                                                                ? 'bg-gradient-to-r from-red-600 to-red-500 hover:to-red-600 text-white shadow-red-500/25'
                                                                : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:to-orange-500 text-white shadow-orange-500/25'}
                                                            disabled:opacity-50 disabled:cursor-not-allowed
                                                        `}
                                                    >
                                                        {activeTab === 'critical' ? (
                                                            <>
                                                                <AlertTriangle size={18} className="fill-white/20" />
                                                                Initiate Recovery
                                                            </>
                                                        ) : (
                                                            <>
                                                                <RefreshCw size={18} className={processingId === rider.id ? "animate-spin" : ""} />
                                                                Send Reminder
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {/* Progress Bar / Severity Indicator */}
                                <div className={`h-1.5 w-full ${activeTab === 'critical' ? 'bg-red-500/20' : 'bg-orange-500/20'}`}>
                                    <div
                                        className={`h-full ${activeTab === 'critical' ? 'bg-red-500' : 'bg-orange-500'}`}
                                        style={{ width: `${Math.min(Math.abs(rider.walletAmount) / 100, 100)}%` }}
                                    />
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
