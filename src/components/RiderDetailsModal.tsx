import React, { useEffect, useState, useRef } from 'react';
import { Rider, ActivityLog } from '@/types';
import { X, Phone, MessageCircle, History, AlertTriangle, ShieldCheck, Building2, Bike, UserCheck, Share2, Calendar, Download, Wallet, ArrowUpRight, ArrowDownLeft, RefreshCw, Smartphone } from 'lucide-react';
import { AIService } from '@/services/AIService';
import { supabase } from '@/config/supabase';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

interface RiderDetailsModalProps {
    rider: Rider;
    onClose: () => void;
}

interface TeamLeaderInfo {
    fullName: string;
    mobile: string;
}

interface LedgerEntry {
    id: string;
    amount: number;
    type: string;
    mode: 'ADD' | 'SUBTRACT' | 'SET';
    description: string;
    created_at: string;
}

const RiderDetailsModal: React.FC<RiderDetailsModalProps> = ({ rider, onClose }) => {
    const { userData } = useSupabaseAuth();
    const [activeTab, setActiveTab] = useState<'profile' | 'wallet'>('profile');

    // Profile State
    const [score, setScore] = useState<{ score: number; label: string; color: string }>({ score: 0, label: 'Calculating...', color: 'text-gray-500' });
    const [history, setHistory] = useState<ActivityLog[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [teamLeader, setTeamLeader] = useState<TeamLeaderInfo | null>(null);
    const [loadingTL, setLoadingTL] = useState(true);

    // Wallet State
    const [walletTxns, setWalletTxns] = useState<any[]>([]); // Use any to support both type and transaction_type temporarily
    const [loadingWallet, setLoadingWallet] = useState(false);
    const [walletBalance, setWalletBalance] = useState(rider.walletAmount);

    useEffect(() => {
        setWalletBalance(rider.walletAmount);
    }, [rider]);


    // Reminder State
    const [showReminder, setShowReminder] = useState(false);
    const [reminderLang, setReminderLang] = useState<'hindi' | 'english'>('hindi');
    const [aiMessage, setAiMessage] = useState('');
    const [generating, setGenerating] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (rider) {
            setScore(AIService.calculateRiderScore(rider));
            fetchHistory();
            fetchTeamLeaderDetails();
            if (activeTab === 'wallet') {
                fetchWalletHistory();
            }
        }
    }, [rider, activeTab]);

    const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
            const { data } = await supabase
                .from('activity_logs')
                .select('*')
                .eq('target_id', rider.id)
                .order('timestamp', { ascending: false })
                .limit(20);

            if (data) setHistory(data as ActivityLog[]);
        } catch (error) {
            console.error("Error fetching history:", error);
        } finally {
            setLoadingHistory(false);
        }
    };

    const fetchWalletHistory = async () => {
        setLoadingWallet(true);
        try {
            const { data, error } = await supabase
                .from('wallet_ledger')
                .select('*')
                .eq('rider_id', rider.id)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            setWalletTxns(data as LedgerEntry[]);
        } catch (error) {
            console.error("Error fetching wallet ledger:", error);
            toast.error("Failed to load wallet history");
        } finally {
            setLoadingWallet(false);
        }
    };

    const fetchTeamLeaderDetails = async () => {
        // Validate UUID format (Simple check: length and hyphens, or just length > 20)
        // UUID is 36 chars. If it is "N/A" or empty or short, skip.
        if (!rider.teamLeaderId || rider.teamLeaderId.length < 30) {
            setLoadingTL(false);
            return;
        }

        try {
            const { data, error } = await supabase
                .from('users')
                .select('fullName, mobile')
                .eq('id', rider.teamLeaderId)
                .single();

            if (error) throw error;

            if (data) {
                setTeamLeader({
                    fullName: data.fullName || rider.teamLeaderName || 'N/A',
                    mobile: data.mobile || 'N/A'
                });
            }
        } catch (error) {
            console.error("Error fetching team leader:", error);
            setTeamLeader({
                fullName: rider.teamLeaderName || 'N/A',
                mobile: 'N/A'
            });
        } finally {
            setLoadingTL(false);
        }
    };

    const generateShareCard = () => {
        const formattedDate = rider.allotmentDate
            ? new Date(rider.allotmentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
            : 'N/A';

        const walletStatus = rider.walletAmount < 0 ? '⚠️ Negative' : rider.walletAmount > 0 ? '✅ Positive' : '➖ Zero';

        const card = `🚴 *RIDER DETAILS CARD*
━━━━━━━━━━━━━━━━━━━━

👤 *Rider Information*
Name: ${rider.riderName}
ID: ${rider.trievId}
Mobile: ${rider.mobileNumber}
Status: ${rider.status.toUpperCase()}

🏢 *Client Details*
Client: ${rider.clientName}
Client ID: ${rider.clientId || 'N/A'}

🏍️ *Vehicle Information*
Chassis: ${rider.chassisNumber || 'N/A'}
Allotment: ${formattedDate}

👨‍💼 *Team Leader*
Name: ${teamLeader?.fullName || 'Loading...'}
Mobile: ${teamLeader?.mobile || 'N/A'}

💰 *Wallet Balance*
Amount: ₹${rider.walletAmount.toLocaleString('en-IN')}
Status: ${walletStatus}

📊 *Performance Score*
Score: ${score.score}/100
Rating: ${score.label}

━━━━━━━━━━━━━━━━━━━━
Generated by Triev Fleet Manager
${new Date().toLocaleString('en-IN')}`;

        return card;
    };

    const handleShareCard = () => {
        const cardText = generateShareCard();
        const url = `https://wa.me/?text=${encodeURIComponent(cardText)}`;
        window.open(url, '_blank');
        toast.success('Share card opened in WhatsApp!');
    };

    const handleDownloadCard = async () => {
        if (!cardRef.current) return;

        try {
            if (typeof window !== 'undefined' && (window as any).html2canvas) {
                const canvas = await (window as any).html2canvas(cardRef.current, {
                    backgroundColor: '#ffffff',
                    scale: 2,
                    logging: false
                });

                canvas.toBlob((blob: Blob | null) => {
                    if (blob) {
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `rider-card-${rider.trievId}.png`;
                        link.click();
                        URL.revokeObjectURL(url);
                        toast.success('Card downloaded successfully!');
                    }
                });
            } else {
                const cardText = generateShareCard();
                await navigator.clipboard.writeText(cardText);
                toast.success('Card details copied to clipboard!');
            }
        } catch (error) {
            console.error('Error downloading card:', error);
            toast.error('Failed to download card');
        }
    };

    const handleAction = async (type: 'call' | 'whatsapp' | 'reminder' | 'call_tl', message?: string) => {
        if (!userData) return;

        try {
            await supabase.from('activity_logs').insert({
                user_id: userData.id,
                user_name: userData.fullName,
                user_role: userData.role,
                action_type: type === 'call' ? 'call_rider' : type === 'whatsapp' ? 'whatsapp_rider' : type === 'call_tl' ? 'call_rider' : 'sent_reminder',
                target_type: 'rider',
                target_id: rider.id,
                details: type === 'reminder' ? `Sent payment reminder: "${message?.substring(0, 50)}..."` : type === 'call_tl' ? `Called Team Leader for rider` : `Initiated ${type} to rider`,
                metadata: { mobile: rider.mobileNumber, amount: rider.walletAmount },
                timestamp: new Date().toISOString(),
                is_deleted: false
            });
            fetchHistory();
        } catch (e) {
            console.error("Log failed", e);
        }

        if (type === 'call') {
            window.location.href = `tel:${rider.mobileNumber}`;
        } else if (type === 'call_tl' && teamLeader?.mobile && teamLeader.mobile !== 'N/A') {
            window.location.href = `tel:${teamLeader.mobile}`;
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
        try {
            const rawMsg = await AIService.generatePaymentReminder(rider, reminderLang, 'professional');
            const amountStr = rider.walletAmount < 0
                ? `-₹${Math.abs(rider.walletAmount).toLocaleString('en-IN')}`
                : `₹${rider.walletAmount.toLocaleString('en-IN')}`;

            const hydratedMsg = rawMsg
                .replace(/{name}/g, `*${rider.riderName}*`)
                .replace(/{amount}/g, `*${amountStr}*`);

            setAiMessage(hydratedMsg);
        } catch (error) {
            console.error("Error generating reminder:", error);
            setAiMessage(`Hello *${rider.riderName}*, please clear your dues of *₹${rider.walletAmount}*.`);
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center z-[20000] p-0 md:p-4">
            <div className="bg-background rounded-t-xl md:rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] md:h-auto md:max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex-none p-6 border-b bg-gradient-to-r from-primary/10 to-purple-500/10">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold bg-primary text-primary-foreground uppercase shadow-lg">
                                {rider.riderName.charAt(0)}
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold">{rider.riderName}</h2>
                                <p className="text-muted-foreground text-sm font-mono flex items-center gap-2">
                                    <span>{rider.trievId}</span>
                                    <span>•</span>
                                    <span>{rider.mobileNumber}</span>
                                    <span className="mx-2 text-border">|</span>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${rider.status === 'active' ? 'bg-green-100 text-green-700' : rider.status === 'inactive' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                        {rider.status}
                                    </span>
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
                            <X size={24} />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-6 mt-6 border-b border-primary/20">
                        <button
                            onClick={() => setActiveTab('profile')}
                            className={`pb-2 px-1 text-sm font-semibold transition-colors relative ${activeTab === 'profile' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Profile Overview
                            {activeTab === 'profile' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />}
                        </button>
                        <button
                            onClick={() => setActiveTab('wallet')}
                            className={`pb-2 px-1 text-sm font-semibold transition-colors relative ${activeTab === 'wallet' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <span className="flex items-center gap-2">
                                Wallet Ledger
                                {rider.walletAmount < 0 && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
                            </span>
                            {activeTab === 'wallet' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />}
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 bg-muted/10">
                    {activeTab === 'profile' ? (
                        <div className="grid lg:grid-cols-3 gap-6" ref={cardRef}>
                            {/* Left Column: Rider Info */}
                            <div className="lg:col-span-2 space-y-4">
                                {/* Client Information */}
                                <div className="p-4 bg-card border rounded-xl shadow-sm">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Building2 size={18} className="text-blue-600" />
                                        <h3 className="font-semibold text-sm">Client Information</h3>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <p className="text-muted-foreground text-xs">Client Name</p>
                                            <p className="font-medium">{rider.clientName}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground text-xs">Client ID</p>
                                            <p className="font-medium font-mono text-xs">{rider.clientId || 'N/A'}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Vehicle Information */}
                                <div className="p-4 bg-card border rounded-xl shadow-sm">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Bike size={18} className="text-orange-600" />
                                        <h3 className="font-semibold text-sm">Vehicle Information</h3>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <p className="text-muted-foreground text-xs">Chassis Number</p>
                                            <p className="font-medium font-mono text-xs">{rider.chassisNumber || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground text-xs flex items-center gap-1">
                                                <Calendar size={12} /> Allotment Date
                                            </p>
                                            <p className="font-medium">
                                                {rider.allotmentDate
                                                    ? new Date(rider.allotmentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                                    : 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Team Leader Information */}
                                <div className="p-4 bg-card border rounded-xl shadow-sm">
                                    <div className="flex items-center gap-2 mb-3">
                                        <UserCheck size={18} className="text-purple-600" />
                                        <h3 className="font-semibold text-sm">Team Leader</h3>
                                    </div>
                                    {loadingTL ? (
                                        <p className="text-sm text-muted-foreground">Loading...</p>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                            <div>
                                                <p className="text-muted-foreground text-xs">Name</p>
                                                <p className="font-medium">{teamLeader?.fullName || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <p className="text-muted-foreground text-xs">Mobile</p>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-medium">{teamLeader?.mobile || 'N/A'}</p>
                                                    {teamLeader?.mobile && teamLeader.mobile !== 'N/A' && (
                                                        <button onClick={() => handleAction('call_tl')} className="p-1 hover:bg-green-100 rounded-full transition-colors" title="Call Team Leader">
                                                            <Phone size={14} className="text-green-600" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Financial & Performance */}
                                <div className="p-4 bg-card border rounded-xl shadow-sm">
                                    <h3 className="font-semibold text-sm mb-3">Financial & Performance</h3>
                                    <div className="flex items-center justify-around">
                                        <div className="text-center">
                                            <p className="text-xs text-muted-foreground mb-1">Wallet Balance</p>
                                            <p className={`text-3xl font-bold ${rider.walletAmount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                ₹{rider.walletAmount.toLocaleString('en-IN')}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {rider.walletAmount < 0 ? '⚠️ Negative' : rider.walletAmount > 0 ? '✅ Positive' : '➖ Zero'}
                                            </p>
                                        </div>
                                        <div className="h-16 w-[1px] bg-border"></div>
                                        <div className="text-center">
                                            <p className="text-xs text-muted-foreground mb-1">Performance Score</p>
                                            <p className="text-3xl font-bold text-primary">{score.score}</p>
                                            <p className={`text-xs font-bold ${score.color} mt-1`}>{score.label}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="grid grid-cols-2 gap-3">
                                    <button onClick={() => handleAction('call')} className="flex items-center justify-center gap-2 p-3 rounded-lg border border-green-200 bg-white hover:bg-green-600 hover:border-green-600 text-green-700 hover:text-white transition-all font-medium group shadow-sm">
                                        <Phone size={18} className="text-green-600 group-hover:text-white" />
                                        <span className="group-hover:text-white">Call Rider</span>
                                    </button>
                                    <button onClick={() => handleAction('whatsapp')} className="flex items-center justify-center gap-2 p-3 rounded-lg border border-green-200 bg-white hover:bg-green-600 hover:border-green-600 text-green-700 hover:text-white transition-all font-medium group shadow-sm">
                                        <MessageCircle size={18} className="text-green-600 group-hover:text-white" />
                                        <span className="group-hover:text-white">WhatsApp</span>
                                    </button>

                                    {rider.walletAmount < 0 && (
                                        <button onClick={() => { setShowReminder(true); setAiMessage(''); }} className="col-span-2 flex items-center justify-center gap-2 p-3 rounded-lg bg-gradient-to-r from-red-500 via-rose-500 to-pink-600 text-white shadow-md hover:shadow-xl hover:from-red-600 hover:via-rose-600 hover:to-pink-700 transition-all font-bold">
                                            <AlertTriangle size={18} />
                                            Send Payment Reminder
                                        </button>
                                    )}

                                    <button onClick={handleShareCard} className="flex items-center justify-center gap-2 p-3 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md hover:shadow-xl hover:from-blue-600 hover:to-blue-700 transition-all font-bold">
                                        <Share2 size={18} />
                                        Share Card
                                    </button>
                                    <button onClick={handleDownloadCard} className="flex items-center justify-center gap-2 p-3 rounded-lg bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-md hover:shadow-xl hover:from-purple-600 hover:to-purple-700 transition-all font-bold">
                                        <Download size={18} />
                                        Download
                                    </button>
                                </div>

                                {/* Reminder Generator */}
                                {showReminder && (
                                    <div className="p-4 bg-muted/30 rounded-lg border animate-in slide-in-from-top-2">
                                        <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                                            <ShieldCheck size={16} className="text-primary" /> AI Reminder Generator
                                        </h4>
                                        <div className="flex gap-2 mb-3">
                                            <select value={reminderLang} onChange={(e) => setReminderLang(e.target.value as any)} className="text-sm p-1.5 rounded border bg-background text-foreground border-input focus:ring-2 focus:ring-primary/20 outline-none">
                                                <option value="hindi">Hindi</option>
                                                <option value="english">English</option>
                                            </select>
                                            <button onClick={generateAiReminder} disabled={generating} className="text-xs bg-primary text-primary-foreground px-3 py-1 rounded hover:bg-primary/90 transition-colors">
                                                {generating ? 'Generating...' : 'Generate New'}
                                            </button>
                                        </div>
                                        <textarea value={aiMessage} onChange={(e) => setAiMessage(e.target.value)} placeholder="Click generate to create a message..." rows={3} className="w-full text-sm p-2 rounded border bg-background text-foreground border-input mb-2 focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-muted-foreground" />
                                        {aiMessage && (
                                            <button onClick={() => handleAction('reminder', aiMessage)} className="w-full py-2 bg-green-500 text-white rounded font-medium text-sm hover:bg-green-600">
                                                Send via WhatsApp
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Right Column: Interaction History */}
                            <div className="bg-card border rounded-xl overflow-hidden flex flex-col h-[600px] shadow-sm">
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

                    ) : (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            {/* Wallet Tab Content */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                <div className="bg-card p-4 rounded-xl border flex items-center gap-4">
                                    <div className="p-3 bg-primary/10 text-primary rounded-full">
                                        <Wallet size={24} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="text-xs text-muted-foreground">Current Balance</p>
                                            <button
                                                onClick={async () => {
                                                    const toastId = toast.loading("Recalculating...");
                                                    try {
                                                        // 1. Force Recalculate
                                                        const { error: syncError } = await supabase.rpc('sync_wallet_balance_for_rider', { p_rider_id: rider.id });
                                                        if (syncError) throw syncError;

                                                        // 2. Fetch New Balance
                                                        const { data: newBalance, error: fetchError } = await supabase.rpc('calculate_rider_balance', { p_rider_id: rider.id });
                                                        if (fetchError) throw fetchError;

                                                        // 3. Update Local State
                                                        setWalletBalance(newBalance);
                                                        toast.success("Balance updated!", { id: toastId });

                                                        // Refresh Ledger too
                                                        fetchWalletHistory();
                                                    } catch (err) {
                                                        console.error(err);
                                                        toast.error("Recalculation failed", { id: toastId });
                                                    }
                                                }}
                                                className="p-1 hover:bg-muted rounded-full transition-colors text-xs text-blue-600 flex items-center gap-1"
                                                title="Recalculate Balance"
                                            >
                                                <RefreshCw size={12} /> Sync
                                            </button>
                                        </div>
                                        <p className="text-2xl font-bold">₹{walletBalance.toLocaleString('en-IN')}</p>
                                    </div>
                                </div>
                                <div className="bg-card p-4 rounded-xl border flex items-center gap-4">
                                    <div className="p-3 bg-green-100 text-green-600 rounded-full">
                                        <Smartphone size={24} />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Last Transaction</p>
                                        <p className="text-sm font-medium">
                                            {walletTxns.length > 0 ? format(parseISO(walletTxns[0].created_at), 'dd MMM yyyy') : 'No history'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
                                <div className="p-4 border-b bg-muted/40 font-semibold flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <History size={18} />
                                        <span>Transaction Ledger</span>
                                    </div>
                                    <button onClick={fetchWalletHistory} className="p-1.5 hover:bg-white rounded-full transition-colors">
                                        <RefreshCw size={16} className={loadingWallet ? "animate-spin" : ""} />
                                    </button>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs uppercase bg-muted/30 text-muted-foreground font-semibold">
                                            <tr>
                                                <th className="px-6 py-3">Date</th>
                                                <th className="px-6 py-3">Type</th>
                                                <th className="px-6 py-3">Mode</th>
                                                <th className="px-6 py-3 text-right">Amount</th>
                                                <th className="px-6 py-3">Description</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/50">
                                            {loadingWallet ? (
                                                <tr>
                                                    <td colSpan={5} className="text-center py-12 text-muted-foreground">Loading ledger...</td>
                                                </tr>
                                            ) : walletTxns.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="text-center py-12 text-muted-foreground">No wallet transactions found.</td>
                                                </tr>
                                            ) : (
                                                walletTxns.map((t) => {
                                                    const isCredit = t.mode === 'ADD';
                                                    const isDebit = t.mode === 'SUBTRACT';
                                                    return (
                                                        <tr key={t.id} className="hover:bg-muted/10">
                                                            <td className="px-6 py-3 whitespace-nowrap">
                                                                <div className="flex flex-col">
                                                                    <span className="font-medium">{format(parseISO(t.created_at), 'dd MMM yyyy')}</span>
                                                                    <span className="text-xs text-muted-foreground">{format(parseISO(t.created_at), 'hh:mm a')}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-3">
                                                                <span className="bg-muted px-2 py-0.5 rounded textxs font-mono">
                                                                    {t.transaction_type ? t.transaction_type.replace(/_/g, ' ') : (t.type ? t.type.replace(/_/g, ' ') : 'Unknown')}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-3">
                                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${isCredit ? 'bg-green-100 text-green-700' : isDebit ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                                                    {isCredit ? <ArrowUpRight size={10} /> : isDebit ? <ArrowDownLeft size={10} /> : <RefreshCw size={10} />}
                                                                    {t.mode}
                                                                </span>
                                                            </td>
                                                            <td className={`px-6 py-3 text-right font-bold ${isCredit ? 'text-green-600' : isDebit ? 'text-red-600' : 'text-blue-600'}`}>
                                                                {isCredit ? '+' : isDebit ? '-' : ''}₹{t.amount.toLocaleString()}
                                                            </td>
                                                            <td className="px-6 py-3 text-muted-foreground max-w-xs truncate" title={t.description}>
                                                                {t.description}
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RiderDetailsModal;
