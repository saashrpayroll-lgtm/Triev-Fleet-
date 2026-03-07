import React, { useEffect, useState, useRef } from 'react';
import { Rider, ActivityLog } from '@/types';
import { X, Phone, MessageCircle, History, AlertTriangle, ShieldCheck, Building2, Bike, UserCheck, Calendar, Download, Wallet, ArrowUpRight, ArrowDownLeft, RefreshCw } from 'lucide-react';

import { AIService } from '@/services/AIService';
import { supabase } from '@/config/supabase';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { logActivity } from '@/utils/activityLog';
import AIReminderModal, { ReminderType } from '@/components/AIReminderModal';
import RiderIdCard from '@/components/RiderIdCard';
import { Camera, Image as ImageIcon } from 'lucide-react';

interface RiderDetailsModalProps {
    rider: Rider;
    onClose: () => void;
    onUpdate?: () => void;
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

const RiderDetailsModal: React.FC<RiderDetailsModalProps> = ({ rider, onClose, onUpdate }) => {
    const { userData } = useSupabaseAuth();
    const [activeTab, setActiveTab] = useState<'profile' | 'wallet' | 'idcard'>('profile');
    const canViewIdCard = userData?.permissions?.riders?.idCard;

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
        setDisplaySubmissionDate(rider.inactivatedAt || '');
    }, [rider]);

    // Submission Date Edit State
    const [isEditingSubmission, setIsEditingSubmission] = useState(false);
    const [selectedDate, setSelectedDate] = useState('');
    const [displaySubmissionDate, setDisplaySubmissionDate] = useState(rider.inactivatedAt || '');
    const [isSavingDate, setIsSavingDate] = useState(false);

    const handleUpdateSubmissionDate = async () => {
        if (!selectedDate) {
            toast.error("Please select a valid date");
            return;
        }

        setIsSavingDate(true);
        try {
            const { error } = await supabase
                .from('riders')
                .update({ inactivated_at: selectedDate })
                .eq('id', rider.id);

            if (error) throw error;

            setDisplaySubmissionDate(selectedDate);
            setIsEditingSubmission(false);

            // Log Activity
            await logActivity({
                actionType: 'riderEdited',
                targetType: 'rider',
                targetId: rider.id,
                details: `Updated submission date to ${selectedDate} for ${rider.riderName}`,
                performedBy: userData?.email
            });

            toast.success("Submission date updated successfully");
            onUpdate?.(); // Sync tables safely
        } catch (error) {
            console.error("Failed to update date:", error);
            toast.error("Failed to update submission date");
        } finally {
            setIsSavingDate(false);
        }
    };


    // Reminder State
    const [reminderModalType, setReminderModalType] = useState<ReminderType | null>(null);
    const fullCardRef = useRef<HTMLDivElement>(null);
    const cardRef = useRef<HTMLDivElement>(null);
    const idCardRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Photo Upload State
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const [riderPhoto, setRiderPhoto] = useState<string | undefined>(rider.photoUrl);

    useEffect(() => {
        setRiderPhoto(rider.photoUrl);
    }, [rider.photoUrl]);

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
        if (activeTab === 'idcard') {
            toast.info("Please use the 'Download' button to share the official ID Card as an image.");
            return;
        }
        const cardText = generateShareCard();
        const url = `https://wa.me/?text=${encodeURIComponent(cardText)}`;
        window.open(url, '_blank');
        toast.success('Share card opened in WhatsApp!');
    };

    const handleDownloadCard = async () => {
        const activeRef = activeTab === 'idcard' ? idCardRef : fullCardRef;
        if (!activeRef.current) return;

        const toastId = toast.loading(activeTab === 'idcard' ? 'Generating ID Card...' : 'Generating Card...');

        try {
            if (typeof window !== 'undefined' && (window as any).html2canvas) {
                // Temporarily remove scroll bounds for full capture
                const originalStyle = activeRef.current.style.cssText;
                if (activeTab === 'profile') {
                    // Lock width and use absolute positioning to prevent flex centering from clipping the top
                    const currentWidth = activeRef.current.offsetWidth;
                    activeRef.current.style.width = `${currentWidth}px`;

                    activeRef.current.style.position = 'absolute';
                    activeRef.current.style.top = '0px';
                    activeRef.current.style.left = '0px';
                    activeRef.current.style.margin = '0';
                    activeRef.current.style.transform = 'none';
                    activeRef.current.style.maxHeight = 'none';
                    activeRef.current.style.height = 'auto';
                    activeRef.current.style.zIndex = '99999';

                    // Force the inner content div to also expand
                    if (cardRef.current) {
                        cardRef.current.style.overflow = 'visible';
                        cardRef.current.style.maxHeight = 'none';
                    }
                }

                // Check active theme (via document class or fallback)
                const isDark = document.documentElement.classList.contains('dark');
                const bgColor = activeTab === 'idcard' ? null : (isDark ? '#020617' : '#ffffff'); // slate-950 or white

                const canvas = await (window as any).html2canvas(activeRef.current, {
                    backgroundColor: bgColor,
                    scale: 3,
                    logging: false,
                    useCORS: true,
                    allowTaint: true,
                    scrollX: 0,
                    scrollY: -window.scrollY
                });

                // Restore styles
                if (activeTab === 'profile') {
                    activeRef.current.style.cssText = originalStyle;
                    if (cardRef.current) {
                        cardRef.current.style.overflow = 'auto';
                        cardRef.current.style.maxHeight = '';
                    }
                }

                canvas.toBlob((blob: Blob | null) => {
                    if (blob) {
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = activeTab === 'idcard' ? `rider-id-card-${rider.trievId}.png` : `rider-card-${rider.trievId}.png`;
                        link.click();
                        URL.revokeObjectURL(url);
                        toast.success('Card downloaded successfully!', { id: toastId });
                    }
                }, 'image/png');
            } else {
                if (activeTab === 'idcard') {
                    toast.error('Image export failed. Please try again or contact support.', { id: toastId });
                    return;
                }
                const cardText = generateShareCard();
                await navigator.clipboard.writeText(cardText);
                toast.success('Card details copied to clipboard!', { id: toastId });
            }
        } catch (error) {
            console.error('Error downloading card:', error);

            // Failsafe restore styles
            if (activeTab === 'profile' && activeRef.current) {
                activeRef.current.style.maxHeight = '';
                activeRef.current.style.overflow = '';
                if (cardRef.current) cardRef.current.style.overflow = 'auto';
            }

            toast.error('Failed to download card', { id: toastId });
        }
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Please upload an image file');
            return;
        }

        const toastId = toast.loading('Uploading photo...');
        setIsUploadingPhoto(true);

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${rider.id}-${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `photos/${fileName}`;

            // 1. Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('rider-photos')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) throw uploadError;

            // 2. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('rider-photos')
                .getPublicUrl(filePath);

            // 3. Update Database
            const { error: updateError } = await supabase
                .from('riders')
                .update({ photo_url: publicUrl })
                .eq('id', rider.id);

            if (updateError) throw updateError;

            setRiderPhoto(publicUrl);
            toast.success('Photo updated successfully!', { id: toastId });
            onUpdate?.();
        } catch (error: any) {
            console.error('Error uploading photo:', error);
            toast.error(error.message || 'Failed to upload photo', { id: toastId });
        } finally {
            setIsUploadingPhoto(false);
        }
    };

    const handleAction = async (type: 'call' | 'whatsapp' | 'reminder' | 'call_tl', message?: string) => {
        if (!userData) return;

        try {
            await supabase.from('activity_logs').insert({
                user_id: userData.id,
                user_name: userData.fullName,
                user_role: userData.role,
                action_type: type === 'call' ? 'call_rider' : type === 'whatsapp' ? 'whatsapp_rider' : type === 'call_tl' ? 'call_rider' : 'whatsapp_rider',
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
        }
    };



    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center z-[20000] p-0 md:p-4">
            <div className="bg-background w-full max-w-4xl flex flex-col rounded-t-3xl md:rounded-2xl shadow-2xl max-h-[92vh] overflow-hidden animate-in slide-in-from-bottom-4 md:zoom-in-95 duration-200" ref={fullCardRef}>

                {/* ── HERO HEADER ── */}
                <div className="flex-none relative overflow-hidden bg-slate-950 text-white border-b border-indigo-500/20">
                    {/* Decorative mixed dark/light blobs for richer aesthetics */}
                    <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-500/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/4 pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-violet-600/25 rounded-full blur-[60px] translate-y-1/3 -translate-x-1/4 pointer-events-none" />
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-900/50 via-transparent to-slate-950/80 pointer-events-none" />

                    {/* Mobile drag handle */}
                    <div className="md:hidden flex justify-center pt-3 pb-0 relative z-10">
                        <div className="w-10 h-1 rounded-full bg-white/25" />
                    </div>

                    <div className="relative px-5 pt-3 pb-0 md:pt-5">
                        <div className="flex items-start gap-4">
                            {/* Avatar + score ring */}
                            <div className="relative flex-shrink-0 mt-1">
                                <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white/10 backdrop-blur border-2 border-white/20 flex items-center justify-center text-3xl font-black uppercase shadow-xl">
                                    {rider.riderName.charAt(0)}
                                </div>
                                <div className={`absolute -bottom-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black border-2 border-slate-900 shadow-lg ${score.score >= 70 ? 'bg-emerald-500' : score.score >= 40 ? 'bg-amber-500' : 'bg-red-500'
                                    }`}>
                                    {score.score}
                                </div>
                            </div>

                            {/* Name / meta */}
                            <div className="flex-1 min-w-0">
                                <h2 className="text-xl md:text-2xl font-black truncate leading-tight">{rider.riderName}</h2>
                                <p className="text-white/50 text-xs font-mono mt-0.5 truncate">{rider.trievId} · {rider.mobileNumber}</p>
                                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${rider.status === 'active' ? 'bg-emerald-400/20 border-emerald-300/40 text-emerald-300'
                                        : rider.status === 'inactive' ? 'bg-amber-400/20 border-amber-300/40 text-amber-300'
                                            : 'bg-red-400/20 border-red-300/40 text-red-300'
                                        }`}>{rider.status}</span>
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-white/10 border border-white/15 truncate max-w-[120px]">{rider.clientName}</span>
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${walletBalance < 0 ? 'bg-red-400/20 border-red-300/40 text-red-300' : 'bg-emerald-400/20 border-emerald-300/40 text-emerald-300'
                                        }`}>₹{walletBalance.toLocaleString('en-IN')}</span>
                                </div>
                            </div>

                            {/* Close */}
                            <button onClick={onClose} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors flex-shrink-0">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Quick actions — horizontal scroll */}
                        <div className="flex gap-2 mt-4 overflow-x-auto scrollbar-hide pb-1">
                            {[
                                { label: 'Call', icon: <Phone size={13} />, onClick: () => handleAction('call'), cls: 'bg-white/10 hover:bg-white/20' },
                                { label: 'WhatsApp', icon: <MessageCircle size={13} />, onClick: () => handleAction('whatsapp'), cls: 'bg-emerald-500/25 hover:bg-emerald-500/40' },
                                { label: 'Share Image', icon: <Download size={13} />, onClick: handleDownloadCard, cls: 'bg-indigo-500/25 hover:bg-indigo-500/40 ring-1 ring-indigo-400/30' },
                                ...(rider.status === 'active' && rider.walletAmount < 0 ? [{ label: 'Payment Req', icon: <AlertTriangle size={17} />, onClick: () => setReminderModalType('warning'), cls: 'bg-red-500/25 hover:bg-red-500/40 px-5 py-3 text-base shadow-lg transition-all' }] : []),
                                ...(rider.status === 'active' && rider.walletAmount >= 0 && rider.walletAmount <= 250 ? [{ label: 'Low Bal Msg', icon: <MessageCircle size={17} />, onClick: () => setReminderModalType('low_balance'), cls: 'bg-orange-500/25 hover:bg-orange-500/40 px-5 py-3 text-base shadow-lg transition-all' }] : []),
                            ].map(({ label, icon, onClick, cls }) => (
                                <button key={label} onClick={onClick}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 text-xs font-bold whitespace-nowrap transition-all active:scale-95 ${cls}`}>
                                    {icon}{label}
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-6 mt-4 border-b border-white/15">
                            {(['profile', 'wallet', 'idcard'] as const).filter(t => t !== 'idcard' || canViewIdCard).map(tab => (
                                <button key={tab} onClick={() => setActiveTab(tab)}
                                    className={`pb-2.5 px-1 text-sm font-bold transition-colors relative capitalize ${activeTab === tab ? 'text-white' : 'text-white/40 hover:text-white/70'}`}>
                                    {tab === 'wallet' ? (
                                        <span className="flex items-center gap-2">Wallet Ledger {rider.walletAmount < 0 && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />}</span>
                                    ) : tab === 'idcard' ? (
                                        <span className="flex items-center gap-2">Official ID Card</span>
                                    ) : 'Profile Overview'}
                                    {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-t-full" />}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── CONTENT ── */}
                <div className="flex-1 overflow-y-auto" ref={cardRef}>

                    {/* ── PROFILE TAB ── */}
                    {activeTab === 'profile' && (
                        <div className="p-4 space-y-3">

                            {/* Info cards — 2 col on mobile, 3 on desktop */}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {/* Client */}
                                <div className="bg-card border border-border rounded-2xl p-3.5">
                                    <div className="flex items-center gap-1.5 mb-2.5">
                                        <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0"><Building2 size={12} className="text-blue-600" /></div>
                                        <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Client</p>
                                    </div>
                                    <p className="font-bold text-sm text-foreground truncate capitalize">{rider.clientName}</p>
                                    <p className="text-[10px] font-mono text-muted-foreground mt-0.5 truncate">{rider.clientId || '—'}</p>
                                </div>

                                {/* Vehicle */}
                                <div className="bg-card border border-border rounded-2xl p-3.5">
                                    <div className="flex items-center gap-1.5 mb-2.5">
                                        <div className="w-6 h-6 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0"><Bike size={12} className="text-orange-600" /></div>
                                        <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Vehicle</p>
                                    </div>
                                    <p className="font-bold text-sm font-mono text-foreground truncate">{rider.chassisNumber || 'N/A'}</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                        Allotment: {rider.allotmentDate ? new Date(rider.allotmentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'No date'}
                                    </p>
                                    {displaySubmissionDate && (
                                        <div className="mt-1 flex items-center justify-between">
                                            {isEditingSubmission ? (
                                                <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg w-full mt-1">
                                                    <input
                                                        type="date"
                                                        value={selectedDate}
                                                        onChange={e => setSelectedDate(e.target.value)}
                                                        className="text-xs py-1 px-1.5 focus:outline-none bg-background rounded border border-border w-full text-foreground"
                                                        max={new Date().toISOString().split('T')[0]}
                                                    />
                                                    <button
                                                        onClick={handleUpdateSubmissionDate}
                                                        disabled={isSavingDate}
                                                        className="p-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded shadow-sm disabled:opacity-50 transition-colors"
                                                    >
                                                        {isSavingDate ? <RefreshCw size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
                                                    </button>
                                                    <button
                                                        onClick={() => setIsEditingSubmission(false)}
                                                        disabled={isSavingDate}
                                                        className="p-1.5 bg-muted-foreground/20 hover:bg-muted-foreground/30 text-foreground rounded transition-colors"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex flex-1 items-center justify-between group">
                                                    <p className="text-[10px] text-rose-500 font-bold">
                                                        Submission: {new Date(displaySubmissionDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </p>
                                                    {userData?.role === 'admin' && (
                                                        <button
                                                            onClick={() => {
                                                                const currentDateStr = displaySubmissionDate.split('T')[0];
                                                                setSelectedDate(currentDateStr);
                                                                setIsEditingSubmission(true);
                                                            }}
                                                            className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-primary transition-all rounded-md hover:bg-accent"
                                                            title="Edit Submission Date"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Team Leader — spans 2 cols on mobile */}
                                <div className="col-span-2 md:col-span-1 bg-card border border-border rounded-2xl p-3.5">
                                    <div className="flex items-center gap-1.5 mb-2.5">
                                        <div className="w-6 h-6 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0"><UserCheck size={12} className="text-violet-600" /></div>
                                        <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Team Leader</p>
                                    </div>
                                    {loadingTL ? (
                                        <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                                    ) : (
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="font-bold text-sm text-foreground truncate">{teamLeader?.fullName || 'N/A'}</p>
                                                <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{teamLeader?.mobile || 'N/A'}</p>
                                            </div>
                                            {teamLeader?.mobile && teamLeader.mobile !== 'N/A' && (
                                                <button onClick={() => handleAction('call_tl')} className="p-2 bg-violet-100 dark:bg-violet-900/30 text-violet-600 rounded-xl hover:bg-violet-200 transition-colors flex-shrink-0">
                                                    <Phone size={13} />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Financials */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className={`rounded-2xl p-3.5 border ${walletBalance < 0 ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/30' : 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/30'}`}>
                                    <div className="flex items-center gap-1.5 mb-2">
                                        <Wallet size={13} className={walletBalance < 0 ? 'text-red-600' : 'text-emerald-600'} />
                                        <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Wallet</p>
                                    </div>
                                    <p className={`text-2xl font-black ${walletBalance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                        ₹{Math.abs(walletBalance).toLocaleString('en-IN')}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">{walletBalance < 0 ? '⚠️ Negative' : walletBalance > 0 ? '✅ Positive' : '➖ Zero'}</p>
                                </div>
                                <div className="bg-primary/5 border border-primary/20 rounded-2xl p-3.5">
                                    <div className="flex items-center gap-1.5 mb-2">
                                        <ShieldCheck size={13} className="text-primary" />
                                        <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">AI Score</p>
                                    </div>
                                    <p className="text-2xl font-black text-primary">{score.score}<span className="text-sm font-normal text-muted-foreground">/100</span></p>
                                    <p className={`text-[10px] font-bold mt-0.5 ${score.color}`}>{score.label}</p>
                                </div>
                            </div>


                            <div className="bg-card border border-border rounded-2xl overflow-hidden">
                                <div className="px-4 py-3 border-b border-border/50 bg-muted/20 flex items-center gap-2">
                                    <History size={14} className="text-muted-foreground" />
                                    <h3 className="font-bold text-sm">Interaction History</h3>
                                    {loadingHistory && <div className="ml-auto w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />}
                                </div>
                                <div className="max-h-48 overflow-y-auto divide-y divide-border/40">
                                    {loadingHistory ? (
                                        <div className="py-6 text-center text-sm text-muted-foreground">Loading...</div>
                                    ) : history.length === 0 ? (
                                        <div className="py-8 flex flex-col items-center text-muted-foreground gap-2">
                                            <History size={24} className="opacity-25" />
                                            <p className="text-sm">No interactions yet</p>
                                        </div>
                                    ) : history.map(log => (
                                        <div key={log.id} className="flex gap-3 px-4 py-2.5 hover:bg-muted/20">
                                            <div className="flex-shrink-0 mt-0.5">
                                                {log.actionType === 'call_rider' && <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-full"><Phone size={10} className="text-blue-600" /></div>}
                                                {log.actionType === 'whatsapp_rider' && <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-full"><MessageCircle size={10} className="text-emerald-600" /></div>}
                                                {log.actionType === 'sent_reminder' && <div className="p-1.5 bg-red-100 dark:bg-red-900/30 rounded-full"><AlertTriangle size={10} className="text-red-600" /></div>}
                                                {!['call_rider', 'whatsapp_rider', 'sent_reminder'].includes(log.actionType) && <div className="p-1.5 bg-muted rounded-full"><Calendar size={10} /></div>}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-semibold text-foreground truncate">{log.details}</p>
                                                <p className="text-[10px] text-muted-foreground">By {log.userName} · {log.timestamp ? new Date(log.timestamp).toLocaleDateString('en-IN') : ''}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'wallet' && (
                        /* ... wallet code ... */
                        <div className="p-4 space-y-3">
                            {/* Balance row */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-card border border-border rounded-2xl p-3.5">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Balance</p>
                                        <button onClick={async () => {
                                            const tid = toast.loading('Recalculating...');
                                            try {
                                                await supabase.rpc('sync_wallet_balance_for_rider', { p_rider_id: rider.id });
                                                const { data } = await supabase.rpc('calculate_rider_balance', { p_rider_id: rider.id });
                                                setWalletBalance(data);
                                                toast.success('Balance updated!', { id: tid });
                                                fetchWalletHistory();
                                            } catch {
                                                toast.error('Failed', { id: tid });
                                            }
                                        }} className="p-1 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-500 hover:bg-blue-100 transition-colors">
                                            <RefreshCw size={11} />
                                        </button>
                                    </div>
                                    <p className={`text-xl font-black ${walletBalance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>₹{walletBalance.toLocaleString('en-IN')}</p>
                                </div>
                                <div className="bg-card border border-border rounded-2xl p-3.5">
                                    <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground mb-2">Last Txn</p>
                                    <p className="text-sm font-bold text-foreground">{walletTxns.length > 0 ? format(parseISO(walletTxns[0].created_at), 'dd MMM yy') : '—'}</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">{walletTxns.length} entries</p>
                                </div>
                            </div>

                            {/* Ledger */}
                            <div className="bg-card border border-border rounded-2xl overflow-hidden">
                                <div className="px-4 py-3 border-b border-border/50 bg-muted/20 flex items-center justify-between">
                                    <div className="flex items-center gap-2"><History size={14} className="text-muted-foreground" /><h3 className="font-bold text-sm">Transaction Ledger</h3></div>
                                    <button onClick={fetchWalletHistory} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
                                        <RefreshCw size={13} className={loadingWallet ? 'animate-spin' : ''} />
                                    </button>
                                </div>

                                {/* Desktop table */}
                                <div className="hidden md:block overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted/20 border-b border-border/50">
                                            <tr>{['Date', 'Type', 'Mode', 'Amount', 'Description'].map(h => <th key={h} className={`px-4 py-2.5 text-[9px] font-black uppercase tracking-wider text-muted-foreground text-left ${h === 'Amount' ? 'text-right' : ''}`}>{h}</th>)}</tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/40">
                                            {loadingWallet ? (
                                                <tr><td colSpan={5} className="text-center py-10 text-muted-foreground text-sm">Loading...</td></tr>
                                            ) : walletTxns.length === 0 ? (
                                                <tr><td colSpan={5} className="text-center py-10 text-muted-foreground text-sm">No transactions.</td></tr>
                                            ) : walletTxns.map(t => {
                                                const isC = t.mode === 'ADD', isD = t.mode === 'SUBTRACT';
                                                return (
                                                    <tr key={t.id} className="hover:bg-muted/20 transition-colors">
                                                        <td className="px-4 py-3">
                                                            <p className="font-medium">{format(parseISO(t.created_at), 'dd MMM yy')}</p>
                                                            <p className="text-[10px] text-muted-foreground">{format(parseISO(t.created_at), 'hh:mm a')}</p>
                                                        </td>
                                                        <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-lg bg-muted text-xs font-mono">{(t.transaction_type || t.type || 'Unknown').replace(/_/g, ' ')}</span></td>
                                                        <td className="px-4 py-3">
                                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${isC ? 'bg-emerald-100 text-emerald-700' : isD ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                                                {isC ? <ArrowUpRight size={9} /> : isD ? <ArrowDownLeft size={9} /> : <RefreshCw size={9} />} {t.mode}
                                                            </span>
                                                        </td>
                                                        <td className={`px-4 py-3 text-right font-black ${isC ? 'text-emerald-600' : isD ? 'text-red-600' : 'text-blue-600'}`}>
                                                            {isC ? '+' : isD ? '-' : ''}₹{t.amount?.toLocaleString()}
                                                        </td>
                                                        <td className="px-4 py-3 text-muted-foreground max-w-[180px] truncate text-xs" title={t.description}>{t.description}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile ledger rows */}
                                <div className="md:hidden divide-y divide-border/40">
                                    {loadingWallet ? (
                                        <div className="py-8 flex justify-center"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
                                    ) : walletTxns.length === 0 ? (
                                        <div className="py-8 text-center text-sm text-muted-foreground">No transactions.</div>
                                    ) : walletTxns.map(t => {
                                        const isC = t.mode === 'ADD', isD = t.mode === 'SUBTRACT';
                                        return (
                                            <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${isC ? 'bg-emerald-100 dark:bg-emerald-900/30' : isD ? 'bg-red-100 dark:bg-red-900/30' : 'bg-blue-100 dark:bg-blue-900/30'}`}>
                                                    {isC ? <ArrowUpRight size={14} className="text-emerald-600" /> : isD ? <ArrowDownLeft size={14} className="text-red-600" /> : <RefreshCw size={14} className="text-blue-600" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-semibold text-foreground truncate">{(t.transaction_type || t.type || 'Unknown').replace(/_/g, ' ')}</p>
                                                    <p className="text-[10px] text-muted-foreground">{format(parseISO(t.created_at), 'dd MMM yy, hh:mm a')}</p>
                                                </div>
                                                <p className={`font-black text-sm flex-shrink-0 ${isC ? 'text-emerald-600' : isD ? 'text-red-600' : 'text-blue-600'}`}>
                                                    {isC ? '+' : isD ? '-' : ''}₹{t.amount?.toLocaleString()}
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                    {activeTab === 'idcard' && canViewIdCard && (
                        <div className="p-6 flex flex-col items-center gap-6">
                            {/* Hidden actual card for capturing */}
                            <div className="fixed -left-[2000px] top-0 pointer-events-none">
                                <RiderIdCard
                                    ref={idCardRef}
                                    rider={{ ...rider, photoUrl: riderPhoto }}
                                    teamLeaderName={teamLeader?.fullName}
                                />
                            </div>

                            {/* View Preview */}
                            <div className="scale-[0.7] md:scale-[0.8] origin-top mb-[-120px] md:mb-[-80px] shadow-2xl rounded-[32px]">
                                <RiderIdCard
                                    rider={{ ...rider, photoUrl: riderPhoto }}
                                    teamLeaderName={teamLeader?.fullName}
                                />
                            </div>

                            {/* Upload & Controls */}
                            <div className="w-full max-w-sm space-y-4">
                                <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800/20 p-4 rounded-2xl">
                                    <div className="flex items-center gap-3 mb-3 text-orange-700 dark:text-orange-400">
                                        <Camera size={18} />
                                        <h4 className="font-bold text-sm">Update Rider Photo</h4>
                                    </div>
                                    <p className="text-xs text-orange-600/70 dark:text-orange-400/60 mb-4 leading-relaxed">
                                        Upload a clear, passport-size photo of the rider for the official ID Card. Max size 2MB.
                                    </p>

                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handlePhotoUpload}
                                        className="hidden"
                                        accept="image/*"
                                    />

                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isUploadingPhoto}
                                        className="w-full bg-white dark:bg-slate-900 border-2 border-dashed border-orange-300 dark:border-orange-800/50 hover:border-orange-500 hover:bg-orange-50 transition-all p-4 rounded-xl flex flex-col items-center gap-2 group"
                                    >
                                        {isUploadingPhoto ? (
                                            <RefreshCw className="animate-spin text-orange-500" size={20} />
                                        ) : (
                                            <ImageIcon className="text-orange-400 group-hover:text-orange-500 transition-colors" size={24} />
                                        )}
                                        <span className="text-xs font-bold text-orange-600">
                                            {isUploadingPhoto ? 'Uploading...' : 'Choose Photo'}
                                        </span>
                                    </button>
                                </div>

                                {/* Download & Share Section - Positioned below the card */}
                                <div className="flex gap-3 pt-2">
                                    <button
                                        onClick={handleDownloadCard}
                                        className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-violet-600 hover:bg-violet-700 text-white rounded-2xl font-bold shadow-lg shadow-violet-500/20 transition-all active:scale-95"
                                    >
                                        <Download size={18} />
                                        Download PNG
                                    </button>
                                    <button
                                        onClick={handleShareCard}
                                        className="w-14 flex items-center justify-center bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                                        title="Share on WhatsApp"
                                    >
                                        <MessageCircle size={20} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <AIReminderModal
                isOpen={!!reminderModalType}
                onClose={() => setReminderModalType(null)}
                rider={rider}
                type={reminderModalType || 'warning'}
            />
        </div>
    );
};

export default RiderDetailsModal;
