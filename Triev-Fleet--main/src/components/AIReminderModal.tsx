import React, { useState, useEffect } from 'react';
import { Rider } from '@/types';
import { AIService } from '@/services/AIService';
import { logActivity } from '@/utils/activityLog';
import { toast } from 'sonner';
import { X, Languages, Zap, Copy, Send, Loader2, MessageSquareText } from 'lucide-react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';

export type ReminderType = 'low_balance' | 'warning' | 'critical' | 'inactive' | 'zero_collection';

interface AIReminderModalProps {
    rider: Rider;
    type: ReminderType;
    isOpen: boolean;
    onClose: () => void;
}

const AIReminderModal: React.FC<AIReminderModalProps> = ({ rider, type, isOpen, onClose }) => {
    const { userData } = useSupabaseAuth();
    const [language, setLanguage] = useState<'hindi' | 'english'>('hindi');
    const [message, setMessage] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSending, setIsSending] = useState(false);

    useEffect(() => {
        if (isOpen && rider) {
            generateMessage(language);
        } else {
            setMessage('');
            setLanguage('hindi'); // Reset
        }
    }, [isOpen, rider]);

    const generateMessage = async (lang: 'hindi' | 'english') => {
        setIsGenerating(true);
        try {
            let generatedMsg = '';
            // Determine prompt based on type
            if (type === 'low_balance') {
                generatedMsg = await AIService.generateLowBalanceReminder(rider, lang);
            } else if (type === 'critical') {
                generatedMsg = await AIService.generateRecoveryMessage(rider, lang);
            } else if (type === 'inactive') {
                generatedMsg = await AIService.generateReactivationMessage(rider, lang);
            } else if (type === 'zero_collection') {
                generatedMsg = await AIService.generatePaymentReminder(rider, lang, 'urgent');
            } else {
                generatedMsg = await AIService.generatePaymentReminder(rider, lang, 'urgent');
            }
            setMessage(generatedMsg);
        } catch (error) {
            console.error("Error generating reminder:", error);
            toast.error("Failed to generate AI message.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleLanguageToggle = () => {
        const newLang = language === 'hindi' ? 'english' : 'hindi';
        setLanguage(newLang);
        generateMessage(newLang);
    };

    const handleRegenerate = () => {
        generateMessage(language);
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(message);
        toast.success("Message copied!");
    };

    const handleSend = async () => {
        if (!message.trim()) return;
        setIsSending(true);

        try {
            // 1. Open WhatsApp
            const phone = rider.mobileNumber.replace(/\D/g, '');
            const encodedMsg = encodeURIComponent(message);
            const url = `https://wa.me/${phone}?text=${encodedMsg}`;
            window.open(url, '_blank');

            // 2. Log Activity
            let actionName = 'payment_reminder';
            if (type === 'low_balance') actionName = 'sent_low_balance_reminder';
            if (type === 'critical') actionName = 'sent_recovery_warning';
            if (type === 'inactive') actionName = 'sent_reactivation_message';

            await logActivity({
                actionType: actionName,
                targetType: 'rider',
                targetId: rider.id,
                details: `Sent ${type.replace('_', ' ')} reminder to ${rider.riderName}`,
                metadata: {
                    amount: rider.walletAmount,
                    language: language,
                    message_preview: message.substring(0, 50) + '...'
                },
                performedBy: userData?.email
            });

            toast.success("Message sent and logged!");
            onClose();
        } catch (error) {
            console.error("Error sending or logging message:", error);
            toast.error("Failed to complete action.");
        } finally {
            setIsSending(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />

            <div className="relative bg-card border border-border shadow-2xl rounded-3xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Decorative Header Background */}
                <div className={`h-24 w-full absolute top-0 left-0 opacity-10 ${type === 'low_balance' ? 'bg-amber-500' : type === 'critical' ? 'bg-red-500' : 'bg-primary'}`} />

                <div className="relative p-6 pt-8 flex flex-col items-center text-center">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-lg ${type === 'low_balance' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' : type === 'critical' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-primary/10 text-primary'}`}>
                        <MessageSquareText size={28} />
                    </div>

                    <h2 className="text-2xl font-black tracking-tight text-foreground">
                        AI Reminder
                    </h2>
                    <p className="text-muted-foreground text-sm mt-1 max-w-xs">
                        Review and send a customized message to <strong className="text-foreground">{rider.riderName}</strong>.
                        Balance: <strong className={rider.walletAmount < 0 ? 'text-red-500' : rider.walletAmount < 250 ? 'text-amber-500' : 'text-green-500'}>
                            {rider.walletAmount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                        </strong>
                    </p>
                </div>

                <div className="p-6 pt-2 bg-muted/20 border-t border-border/50">
                    {/* Controls */}
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleLanguageToggle}
                                disabled={isGenerating}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-background rounded-lg text-xs font-bold border hover:bg-muted transition-colors disabled:opacity-50"
                            >
                                <Languages size={14} />
                                {language === 'hindi' ? 'Eng' : 'Hin'}
                            </button>
                            <button
                                onClick={handleRegenerate}
                                disabled={isGenerating}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-bold border border-primary/20 hover:bg-primary/20 transition-colors disabled:opacity-50"
                                title="Get a new message variant"
                            >
                                <Zap size={14} className={isGenerating ? "animate-spin" : "fill-current"} />
                                Retry
                            </button>
                        </div>
                        <button
                            onClick={copyToClipboard}
                            disabled={!message || isGenerating}
                            className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 disabled:opacity-50"
                            title="Copy text"
                        >
                            <Copy size={14} /> Copy
                        </button>
                    </div>

                    {/* Chat Bubble Style Editor */}
                    <div className="relative bg-background rounded-2xl rounded-tl-sm p-4 border border-border shadow-sm min-h-[120px] mb-6">
                        {isGenerating ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 rounded-inherit backdrop-blur-[2px]">
                                <Loader2 className="animate-spin text-primary mb-2" size={24} />
                                <span className="text-xs font-bold text-muted-foreground animate-pulse">Drafting perfect message...</span>
                            </div>
                        ) : null}
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className="w-full h-full text-sm bg-transparent border-none focus:ring-0 p-0 resize-none font-medium leading-relaxed text-foreground min-h-[100px]"
                            placeholder="Message will appear here..."
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl font-bold text-sm text-foreground bg-muted hover:bg-muted/80 transition-all flex items-center gap-2"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSend}
                            disabled={isGenerating || !message || isSending}
                            className="px-6 py-2.5 rounded-xl font-bold text-sm text-white bg-[#25D366] hover:bg-[#128C7E] shadow-lg shadow-green-500/25 transform hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center gap-2 disabled:opacity-50 disabled:transform-none"
                        >
                            {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} className="fill-white" />}
                            Send Web
                        </button>
                    </div>
                </div>

                {/* Close Button Top Right */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-foreground/50 hover:text-foreground bg-background/50 hover:bg-background rounded-full transition-colors z-10"
                >
                    <X size={20} />
                </button>
            </div>
        </div>
    );
};

export default AIReminderModal;
