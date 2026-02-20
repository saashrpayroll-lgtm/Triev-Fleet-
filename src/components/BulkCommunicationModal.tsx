import React, { useState } from 'react';
import { X, Send, Sparkles, Loader } from 'lucide-react';
import { Rider } from '@/types';
import { AIService } from '@/services/AIService';

interface BulkCommunicationModalProps {
    riders: Rider[];
    onClose: () => void;
    onSend: (message: string) => Promise<void>;
}

const BulkCommunicationModal: React.FC<BulkCommunicationModalProps> = ({ riders, onClose, onSend }) => {
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState<'reminder' | 'broadcast' | 'reactivation'>('broadcast');
    const [language, setLanguage] = useState<'hindi' | 'english'>('english');
    const [tone, setTone] = useState<'professional' | 'friendly' | 'urgent'>('professional');
    const [aiLoading, setAiLoading] = useState(false);
    const [sending, setSending] = useState(false);

    // Derived states
    const totalDebt = riders.reduce((sum, r) => sum + (r.walletAmount < 0 ? Math.abs(r.walletAmount) : 0), 0);

    const handleAiGenerate = async () => {
        if (riders.length === 0) return;

        setAiLoading(true);
        try {
            // Use the first rider as a sample for AI generation
            const sampleRider = riders[0];
            let generatedMessage = '';

            if (messageType === 'reminder') {
                generatedMessage = await AIService.generatePaymentReminder(sampleRider, language, tone);
            } else if (messageType === 'reactivation') {
                generatedMessage = await AIService.generateReactivationMessage(sampleRider, language);
            } else {
                generatedMessage = await AIService.generateBulkAnnouncement('Service Update / General Broadcast', 'riders');
            }

            setMessage(generatedMessage);
        } catch (error) {
            console.error('AI generation failed:', error);
        } finally {
            setAiLoading(false);
        }
    };

    const handleSend = async () => {
        if (!message.trim()) return;

        setSending(true);
        try {
            await onSend(message);
            onClose();
        } catch (error) {
            console.error('Failed to send reminders:', error);
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-background rounded-lg shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-border">
                    <div>
                        <h2 className="text-xl font-bold">Bulk WhatsApp Communication</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            {riders.length} rider(s) selected
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-muted rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                    {/* Riders Summary */}
                    <div className="bg-muted/50 rounded-lg p-4">
                        <h3 className="font-semibold mb-3">Selected Riders</h3>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                            {riders.map(rider => (
                                <div key={rider.id} className="flex justify-between items-center text-sm">
                                    <span className="font-medium">{rider.riderName}</span>
                                    <span className={`font-semibold ${rider.walletAmount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        ₹{Math.abs(rider.walletAmount).toLocaleString('en-IN')}
                                        {rider.walletAmount < 0 ? ' (Due)' : ''}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div className="mt-3 pt-3 border-t border-border flex justify-between font-bold">
                            <span>Total Debt:</span>
                            <span className="text-red-600">₹{totalDebt.toLocaleString('en-IN')}</span>
                        </div>
                    </div>

                    {/* Message Configuration */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Message Type</label>
                            <select
                                value={messageType}
                                onChange={(e) => setMessageType(e.target.value as any)}
                                className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                            >
                                <option value="broadcast">General Broadcast</option>
                                <option value="reminder">Payment Reminder</option>
                                <option value="reactivation">Reactivation (Inactive)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">Language</label>
                            <select
                                value={language}
                                onChange={(e) => setLanguage(e.target.value as 'hindi' | 'english')}
                                className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                            >
                                <option value="english">English</option>
                                <option value="hindi">Hindi</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">Tone</label>
                            <select
                                value={tone}
                                onChange={(e) => setTone(e.target.value as 'professional' | 'friendly' | 'urgent')}
                                className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                            >
                                <option value="professional">Professional</option>
                                <option value="friendly">Friendly</option>
                                <option value="urgent">Urgent</option>
                            </select>
                        </div>
                    </div>

                    {/* Message Input */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-medium">Message Details</label>
                            <button
                                onClick={handleAiGenerate}
                                disabled={aiLoading || riders.length === 0}
                                className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-3 py-1.5 rounded-full flex items-center gap-1 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors disabled:opacity-50"
                            >
                                {aiLoading ? <Loader size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                AI Generate
                            </button>
                        </div>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            rows={6}
                            placeholder="Enter your message here... You can use {name} and {amount} as placeholders."
                            className="w-full px-4 py-3 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground resize-none"
                        />
                        <p className="text-xs text-muted-foreground mt-2">
                            This message will be sent via WhatsApp to all {riders.length} selected rider(s)
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-border bg-muted/30">
                    <button
                        onClick={onClose}
                        disabled={sending}
                        className="px-6 py-2.5 border border-input rounded-lg hover:bg-accent transition-colors font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={!message.trim() || sending || riders.length === 0}
                        className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-2.5 rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all shadow-md hover:shadow-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {sending ? (
                            <>
                                <Loader size={18} className="animate-spin" />
                                Sending...
                            </>
                        ) : (
                            <>
                                <Send size={18} />
                                Send to {riders.length} Rider(s)
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BulkCommunicationModal;
