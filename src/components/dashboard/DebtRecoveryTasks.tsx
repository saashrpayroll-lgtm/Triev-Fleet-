import React, { useState } from 'react';
import { Rider } from '@/types';
import { AIService } from '@/services/AIService';
import { logActivity } from '@/utils/activityLog';
import { AlertTriangle, RefreshCw, Wallet, CheckCircle2, Send, X, Copy, Zap, Languages } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface DebtRecoveryTasksProps {
    riders: Rider[];
}

const CRITICAL_THRESHOLD = -300;

const DebtRecoveryTasks: React.FC<DebtRecoveryTasksProps> = ({ riders }) => {
    const [activeTab, setActiveTab] = useState<'critical' | 'warning'>('critical');
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [recoveryMessage, setRecoveryMessage] = useState<string>('');
    const [selectedRider, setSelectedRider] = useState<Rider | null>(null);
    const [language, setLanguage] = useState<'hindi' | 'english'>('hindi');

    // Filter Riders
    const criticalRiders = riders.filter(r => r.walletAmount <= CRITICAL_THRESHOLD).sort((a, b) => a.walletAmount - b.walletAmount); // Ascending (more negative first)
    const warningRiders = riders.filter(r => r.walletAmount < 0 && r.walletAmount > CRITICAL_THRESHOLD).sort((a, b) => a.walletAmount - b.walletAmount);

    const activeList = activeTab === 'critical' ? criticalRiders : warningRiders;

    const generateMsg = async (rider: Rider, lang: 'hindi' | 'english') => {
        try {
            let msg = '';
            if (rider.walletAmount <= CRITICAL_THRESHOLD) {
                msg = await AIService.generateRecoveryMessage(rider, lang);
            } else {
                msg = await AIService.generatePaymentReminder(rider, lang, 'urgent');
            }
            setRecoveryMessage(msg);
        } catch (error) {
            console.error("Error generating message:", error);
            toast.error("Failed to generate AI message.");
        }
    };

    const handleAction = async (rider: Rider) => {
        setSelectedRider(rider);
        setProcessingId(rider.id);
        await generateMsg(rider, language);
    };

    const handleRegenerate = async () => {
        if (!selectedRider) return;
        setProcessingId(selectedRider.id); // Show spinner if needed, though usually fast
        await generateMsg(selectedRider, language);
        setProcessingId(null);
        toast.success("Message regenerated!");
    };

    const handleLanguageToggle = async () => {
        const newLang = language === 'hindi' ? 'english' : 'hindi';
        setLanguage(newLang);
        if (selectedRider) {
            await generateMsg(selectedRider, newLang);
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

            // 2. Log Activity using the Utility Function
            await logActivity({
                actionType: selectedRider.walletAmount <= CRITICAL_THRESHOLD ? 'sent_recovery_warning' : 'payment_reminder',
                targetType: 'rider',
                targetId: selectedRider.id,
                details: `Sent ${selectedRider.walletAmount <= CRITICAL_THRESHOLD ? 'EV Recovery Warning' : 'Payment Reminder'} to ${selectedRider.riderName}`,
                metadata: {
                    rider_name: selectedRider.riderName,
                    amount: selectedRider.walletAmount,
                    message_preview: recoveryMessage.substring(0, 50) + '...',
                    language: language
                }
            });

            toast.success("Action logged & WhatsApp opened!");
        } catch (error) {
            console.error("Error logging action:", error);
            toast.error("Message sent but logic failed. Check console.");
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
                                        <div className="flex items-start gap-4 min-w-[200px] md:w-1/3">
                                            <div className={`mt-1 w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${rider.walletAmount <= CRITICAL_THRESHOLD ? 'bg-red-100 dark:bg-red-900/20 text-red-600' : 'bg-orange-100 dark:bg-orange-900/20 text-orange-600'}`}>
                                                <Wallet size={28} strokeWidth={2.5} />
                                            </div>
                                            <div>
                                                <h4 className="font-black text-xl text-foreground leading-tight tracking-tight">{rider.riderName}</h4>
                                                <p className="text-sm font-bold text-muted-foreground/80 flex items-center gap-2 mt-1">
                                                    {rider.mobileNumber}
                                                </p>
                                                <div className="mt-3 inline-flex flex-col items-start bg-muted/50 rounded-lg px-3 py-1.5 border border-border/50 w-full">
                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-70">Outstanding Dues</span>
                                                    <span className={`text-2xl font-black ${rider.walletAmount <= CRITICAL_THRESHOLD ? 'text-red-500' : 'text-orange-500'}`}>
                                                        {rider.walletAmount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action / Context Section */}
                                        <div className="flex-1 w-full relative border-t md:border-t-0 md:border-l border-border/50 pt-4 md:pt-0 md:pl-5">
                                            {selectedRider?.id === rider.id ? (
                                                <motion.div
                                                    initial={{ opacity: 0, x: 20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    className="bg-muted/30 rounded-2xl border p-4 h-full flex flex-col"
                                                >
                                                    {/* Controls */}
                                                    <div className="flex items-center justify-between mb-3">
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={handleLanguageToggle}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-black/20 rounded-lg text-xs font-bold border hover:bg-muted transition-colors"
                                                            >
                                                                <Languages size={14} />
                                                                {language === 'hindi' ? 'Hindi' : 'English'}
                                                            </button>
                                                            <button
                                                                onClick={handleRegenerate}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-black/20 rounded-lg text-xs font-bold border hover:bg-muted transition-colors text-primary"
                                                                title="Get a refreshing new message"
                                                            >
                                                                <Zap size={14} className={processingId === rider.id ? "animate-spin" : "fill-current"} />
                                                                Regenerate
                                                            </button>
                                                        </div>
                                                        <button onClick={copyToClipboard} className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1" title="Copy text">
                                                            <Copy size={12} /> Copy
                                                        </button>
                                                    </div>

                                                    {/* Chat Bubble Style */}
                                                    <div className="flex-1 bg-white dark:bg-black/20 rounded-xl rounded-tl-none p-3 mb-3 border border-border/50 shadow-sm">
                                                        <textarea
                                                            value={recoveryMessage}
                                                            onChange={(e) => setRecoveryMessage(e.target.value)}
                                                            className="w-full text-sm bg-transparent border-none focus:ring-0 p-0 resize-none font-medium leading-relaxed text-foreground min-h-[80px]"
                                                            placeholder="Generating AI message..."
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
                                                <div className="h-full flex flex-col justify-center items-end md:items-start space-y-3">
                                                    <div className="">
                                                        {activeTab === 'critical' ? (
                                                            <p className="text-sm font-medium text-red-600/90 leading-snug">
                                                                ⚠ <b>Action Required:</b> Send mandatory "Hard Recovery" warning.<br />
                                                                <span className="text-xs opacity-75 font-normal">Message warns about vehicle seizure.</span>
                                                            </p>
                                                        ) : (
                                                            <p className="text-sm font-medium text-orange-600/90 leading-snug">
                                                                ⚠ <b>Payment Overdue:</b> Send payment reminder.<br />
                                                                <span className="text-xs opacity-75 font-normal">Polite but firm request to clear dues.</span>
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
