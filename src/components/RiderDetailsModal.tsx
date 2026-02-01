import React, { useEffect, useState } from 'react';
import { Rider, ActivityLog } from '@/types';
import { X, Phone, MessageCircle, History, AlertTriangle, ShieldCheck } from 'lucide-react';
import { AIService } from '@/services/AIService';
import { supabase } from '@/config/supabase';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';

interface RiderDetailsModalProps {
    rider: Rider;
    onClose: () => void;
}

const RiderDetailsModal: React.FC<RiderDetailsModalProps> = ({ rider, onClose }) => {
    const { userData } = useSupabaseAuth();
    const [score, setScore] = useState<{ score: number; label: string; color: string }>({ score: 0, label: 'Calculating...', color: 'text-gray-500' });
    const [history, setHistory] = useState<ActivityLog[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);

    // Reminder State
    const [showReminder, setShowReminder] = useState(false);
    const [reminderLang, setReminderLang] = useState<'hindi' | 'english'>('hindi');
    const [aiMessage, setAiMessage] = useState('');
    const [generating, setGenerating] = useState(false);

    useEffect(() => {
        // Calculate Score
        setScore(AIService.calculateRiderScore(rider));

        // Fetch Interaction History
        fetchHistory();
    }, [rider]);

    const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
            const { data } = await supabase
                .from('activity_logs')
                .select('*')
                .eq('target_id', rider.id)
                .order('timestamp', { ascending: false })
                .limit(10);

            if (data) {
                setHistory(data as ActivityLog[]);
            }
        } catch (error) {
            console.error("Error fetching history:", error);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleAction = async (type: 'call' | 'whatsapp' | 'reminder', message?: string) => {
        if (!userData) return;

        // Log Action
        try {
            await supabase.from('activity_logs').insert({
                user_id: userData.id,
                user_name: userData.fullName,
                user_role: userData.role,
                action_type: type === 'call' ? 'call_rider' : type === 'whatsapp' ? 'whatsapp_rider' : 'sent_reminder',
                target_type: 'rider',
                target_id: rider.id,
                details: type === 'reminder' ? `Sent payment reminder: "${message?.substring(0, 50)}..."` : `Initiated ${type} to rider`,
                metadata: { mobile: rider.mobileNumber, amount: rider.walletAmount },
                timestamp: new Date().toISOString(),
                is_deleted: false
            });
            fetchHistory(); // Refresh history
        } catch (e) {
            console.error("Log failed", e);
        }

        // Execute Action
        if (type === 'call') {
            window.location.href = `tel:${rider.mobileNumber}`;
        } else if (type === 'whatsapp') {
            const url = `https://wa.me/91${rider.mobileNumber}`;
            window.open(url, '_blank');
        } else if (type === 'reminder' && message) {
            const url = `https://wa.me/91${rider.mobileNumber}?text=${encodeURIComponent(message)}`;
            window.open(url, '_blank');
            setShowReminder(false);
        }
    };

    const generateAiReminder = async () => {
        setGenerating(true);
        const msg = await AIService.generatePaymentReminder(rider, reminderLang);
        setAiMessage(msg);
        setGenerating(false);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-background rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b bg-muted/20">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold bg-primary/10 text-primary uppercase`}>
                            {rider.riderName.charAt(0)}
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold">{rider.riderName}</h2>
                            <p className="text-muted-foreground text-sm font-mono">{rider.trievId} • {rider.mobileNumber}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 grid md:grid-cols-2 gap-8">
                    {/* Left Column: Stats & Actions */}
                    <div className="space-y-6">
                        {/* Score Card */}
                        <div className="p-5 bg-card border rounded-xl shadow-sm text-center relative overflow-hidden">
                            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-widest mb-2">Details & Performance</h3>
                            {/* Detailed Info List */}
                            <div className="text-left space-y-2 mb-4 text-sm">
                                <p className="flex justify-between border-b pb-1">
                                    <span className="text-muted-foreground">Status:</span>
                                    <span className={`font-medium ${rider.status === 'active' ? 'text-green-600' : 'text-red-500'} capitalize`}>{rider.status}</span>
                                </p>
                                <p className="flex justify-between border-b pb-1">
                                    <span className="text-muted-foreground">Client:</span>
                                    <span className="font-medium">{rider.clientName || 'N/A'}</span>
                                </p>
                                <p className="flex justify-between border-b pb-1">
                                    <span className="text-muted-foreground">Location:</span>
                                    <span className="font-medium">N/A</span>
                                </p>
                                <p className="flex justify-between border-b pb-1">
                                    <span className="text-muted-foreground">Chassis:</span>
                                    <span className="font-medium font-mono text-xs">{rider.chassisNumber || 'N/A'}</span>
                                </p>
                            </div>

                            <div className="flex items-center justify-center gap-4 mt-6">
                                <div className="text-center">
                                    <p className="text-4xl font-black text-primary">{score.score}</p>
                                    <p className={`text-sm font-bold ${score.color}`}>{score.label}</p>
                                </div>
                                <div className="h-12 w-[1px] bg-border"></div>
                                <div className="text-center">
                                    <p className={`text-2xl font-bold ${rider.walletAmount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        ₹{rider.walletAmount}
                                    </p>
                                    <p className="text-xs text-muted-foreground">Wallet Balance</p>
                                </div>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => handleAction('call')}
                                className="flex items-center justify-center gap-2 p-3 rounded-lg border hover:bg-muted transition-colors font-medium"
                            >
                                <Phone size={18} className="text-green-600" />
                                Call Rider
                            </button>
                            <button
                                onClick={() => handleAction('whatsapp')}
                                className="flex items-center justify-center gap-2 p-3 rounded-lg border hover:bg-muted transition-colors font-medium"
                            >
                                <MessageCircle size={18} className="text-green-500" />
                                WhatsApp
                            </button>

                            {rider.walletAmount < 0 && (
                                <button
                                    onClick={() => { setShowReminder(true); setAiMessage(''); }}
                                    className="col-span-2 flex items-center justify-center gap-2 p-3 rounded-lg bg-gradient-to-r from-red-500 via-rose-500 to-pink-600 text-white shadow-md hover:shadow-xl hover:from-red-600 hover:via-rose-600 hover:to-pink-700 transition-all font-bold transform hover:-translate-y-0.5"
                                >
                                    <AlertTriangle size={18} />
                                    Send Payment Reminder
                                </button>
                            )}
                        </div>

                        {/* Reminder Generator */}
                        {showReminder && (
                            <div className="p-4 bg-muted/30 rounded-lg border animate-in slide-in-from-top-2">
                                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                                    <ShieldCheck size={16} className="text-primary" />
                                    AI Reminder Generator
                                </h4>
                                <div className="flex gap-2 mb-3">
                                    <select
                                        value={reminderLang}
                                        onChange={(e) => setReminderLang(e.target.value as any)}
                                        className="text-sm p-1.5 rounded border"
                                    >
                                        <option value="hindi">Hindi</option>
                                        <option value="english">English</option>
                                    </select>
                                    <button
                                        onClick={generateAiReminder}
                                        disabled={generating}
                                        className="text-xs bg-primary text-primary-foreground px-3 py-1 rounded"
                                    >
                                        {generating ? 'Generating...' : 'Generate New'}
                                    </button>
                                </div>
                                <textarea
                                    value={aiMessage}
                                    onChange={(e) => setAiMessage(e.target.value)}
                                    placeholder="Click generate to create a message..."
                                    rows={3}
                                    className="w-full text-sm p-2 rounded border mb-2 focus:ring-2 focus:ring-red-500/20 outline-none"
                                />
                                {aiMessage && (
                                    <button
                                        onClick={() => handleAction('reminder', aiMessage)}
                                        className="w-full py-2 bg-green-500 text-white rounded font-medium text-sm hover:bg-green-600"
                                    >
                                        Send via WhatsApp
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right Column: Interaction History */}
                    <div className="bg-card border rounded-xl overflow-hidden flex flex-col h-[500px]">
                        <div className="p-4 border-b bg-muted/40 font-semibold flex items-center gap-2">
                            <History size={18} />
                            Interaction History
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {loadingHistory ? (
                                <div className="text-center py-8 text-muted-foreground">Loading history...</div>
                            ) : history.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground/60 italic">
                                    <p>No recent interactions recorded.</p>
                                    <p className="text-xs mt-1">Calls and reminders sent from here will appear above.</p>
                                </div>
                            ) : (
                                history.map(log => (
                                    <div key={log.id} className="flex gap-3 text-sm group">
                                        <div className="mt-1">
                                            {log.actionType === 'call_rider' && <div className="p-1.5 bg-blue-100 text-blue-600 rounded-full"><Phone size={12} /></div>}
                                            {log.actionType === 'whatsapp_rider' && <div className="p-1.5 bg-green-100 text-green-600 rounded-full"><MessageCircle size={12} /></div>}
                                            {log.actionType === 'sent_reminder' && <div className="p-1.5 bg-red-100 text-red-600 rounded-full"><AlertTriangle size={12} /></div>}
                                        </div>
                                        <div className="flex-1 pb-3 border-b border-dashed group-last:border-0">
                                            <div className="flex justify-between">
                                                <p className="font-medium text-foreground">{log.details}</p>
                                                <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                                                    {log.timestamp ? new Date(log.timestamp).toLocaleDateString() : 'N/A'}
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-0.5">By {log.userName}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RiderDetailsModal;
