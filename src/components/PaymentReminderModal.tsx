import React, { useState, useEffect } from 'react';
import { X, RefreshCw, MessageCircle, Sparkles } from 'lucide-react';
import { Rider } from '@/types';
import { AIService } from '@/services/AIService';

interface PaymentReminderModalProps {
    rider: Rider;
    onClose: () => void;
    onSend: (message: string) => void;
}

const PaymentReminderModal: React.FC<PaymentReminderModalProps> = ({ rider, onClose, onSend }) => {
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [regenerating, setRegenerating] = useState(false);

    const generateMessage = async () => {
        setLoading(true);
        // Randomize tone slightly to ensure variation on refresh
        const tones: ('professional' | 'friendly' | 'urgent')[] = ['professional', 'friendly', 'urgent'];
        const randomTone = tones[Math.floor(Math.random() * tones.length)];

        try {
            const aiMsg = await AIService.generatePaymentReminder(rider, 'hindi', randomTone); // Defaulting to Hindi as per recent context, or we can make it toggleable
            setMessage(aiMsg);
        } catch (error) {
            console.error("Error generating message:", error);
            setMessage(`Hello ${rider.riderName}, please clear your outstanding balance of ₹${Math.abs(rider.walletAmount)}.`);
        } finally {
            setLoading(false);
            setRegenerating(false);
        }
    };

    useEffect(() => {
        generateMessage();
    }, [rider]);

    const handleRegenerate = () => {
        setRegenerating(true);
        generateMessage();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Send Wallet Reminder</h2>
                        <p className="text-sm text-gray-500 mt-0.5">to {rider.riderName}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    <p className="text-sm text-gray-600">
                        AI has generated a personalized reminder message based on the wallet balance of <span className="font-bold text-red-600">{-Math.abs(rider.walletAmount).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span>. Review and send it via WhatsApp.
                    </p>

                    {/* AI Message Card */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-purple-700 font-semibold">
                                <Sparkles size={18} />
                                <span>AI Generated Message</span>
                            </div>
                            <button
                                onClick={handleRegenerate}
                                disabled={regenerating || loading}
                                className={`p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-full transition-colors ${regenerating ? 'animate-spin' : ''}`}
                                title="Regenerate Message"
                            >
                                <RefreshCw size={18} />
                            </button>
                        </div>

                        <div className="relative">
                            {loading ? (
                                <div className="h-32 w-full bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-center">
                                    <div className="flex flex-col items-center gap-2 text-gray-400">
                                        <Sparkles className="animate-pulse" size={24} />
                                        <span className="text-sm">Generating magic...</span>
                                    </div>
                                </div>
                            ) : (
                                <textarea
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    className="w-full h-32 p-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all resize-none"
                                />
                            )}
                        </div>
                    </div>

                    <div className="text-xs text-gray-400 font-medium">
                        Last reminder: <span className="text-gray-500">None</span>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onSend(message)}
                        disabled={loading || !message}
                        className="px-5 py-2.5 text-sm font-medium text-white bg-purple-700 hover:bg-purple-800 rounded-xl shadow-lg shadow-purple-900/10 flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <MessageCircle size={18} />
                        Send via WhatsApp
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PaymentReminderModal;
