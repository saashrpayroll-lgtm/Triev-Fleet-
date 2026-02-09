import React, { useState, useEffect } from 'react';
import { Lead } from '@/types';
import {
    X,
    User,
    MapPin,
    Phone,
    ShieldCheck,
    AlertTriangle,
    Repeat,
    Zap,
    Edit,
    Activity,
    Sparkles,
    MessageCircle,
    Mic,
    StopCircle,
    Send,
    Bot,
    History
} from 'lucide-react';
import { format } from 'date-fns';
import useSpeechRecognition from '@/hooks/useSpeechRecognition';
import { AIService } from '@/services/AIService';
import { supabase } from '@/config/supabase';
import { toast } from 'sonner';

interface LeadDetailModalProps {
    lead: Lead;
    onClose: () => void;
    onEdit: (lead: Lead) => void;
}

const LeadDetailModal: React.FC<LeadDetailModalProps> = ({ lead, onClose, onEdit }) => {
    const [activeTab, setActiveTab] = useState<'details' | 'smart_view' | 'follow_up' | 'activity'>('details');

    // AI & Smart View State
    const [aiSummary, setAiSummary] = useState<string>('');
    const [isGeneratingAi, setIsGeneratingAi] = useState(false);

    // Follow Up & Voice State
    const [comment, setComment] = useState('');
    const { isListening, transcript, startListening, stopListening, resetTranscript, hasRecognitionSupport } = useSpeechRecognition();
    const [isSavingComment, setIsSavingComment] = useState(false);

    // Sync voice transcript to comment
    useEffect(() => {
        if (transcript) {
            setComment(transcript);
        }
    }, [transcript]);

    const handleGenerateSummary = async () => {
        setIsGeneratingAi(true);
        try {
            // Simulate AI Summary or use real service
            // Using AIService if available, otherwise mock for now to ensure UI works
            // Assuming getLeadRecommendations exists or we add a mock fallback
            let summary = "AI Insights not configured.";

            if (AIService && typeof AIService.getLeadRecommendations === 'function') {
                summary = await AIService.getLeadRecommendations(lead);
            } else {
                // Mock logic if service missing
                const score = lead.score || 50;
                summary = `Lead Score: ${score} - ${score > 70 ? "High conversion probability." : "Medium conversion probability."}\n\nRecommended Action: ${score > 70 ? "Call immediately." : "Send follow-up message."}`;
            }

            setAiSummary(summary || "No insights available.");
        } catch (e) {
            console.error(e);
            setAiSummary("Failed to generate summary.");
        } finally {
            setIsGeneratingAi(false);
        }
    };

    const handleSaveComment = async () => {
        if (!comment.trim()) return;
        setIsSavingComment(true);
        try {
            const newRemarks = lead.remarks ? `${lead.remarks}\n[${format(new Date(), 'dd/MM HH:mm')}] ${comment}` : `[${format(new Date(), 'dd/MM HH:mm')}] ${comment}`;

            await supabase.from('leads').update({ remarks: newRemarks }).eq('id', lead.id);

            await supabase.from('activity_logs').insert({
                action_type: 'leadStatusChange',
                target_type: 'lead',
                target_id: lead.id,
                details: `Added comment: ${comment}`,
                user_id: lead.createdBy,
                timestamp: new Date().toISOString()
            });

            toast.success("Comment added successfully");
            setComment('');
            resetTranscript();
        } catch (e) {
            console.error(e);
            toast.error("Failed to save comment");
        } finally {
            setIsSavingComment(false);
        }
    };

    // Helper for badges
    const getStatusBadge = () => (
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${lead.status === 'New' ? 'bg-blue-50 text-blue-700 border-blue-200' :
            lead.status === 'Convert' ? 'bg-green-50 text-green-700 border-green-200' :
                'bg-gray-100 text-gray-700 border-gray-200'
            }`}>
            {lead.status}
        </span>
    );

    const getCategoryBadge = () => {
        const cat = typeof lead.category === 'string' ? lead.category : 'Genuine';
        const config = {
            'Genuine': { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: ShieldCheck },
            'Match': { color: 'bg-red-50 text-red-600 border-red-200', icon: Repeat },
            'Duplicate': { color: 'bg-amber-50 text-amber-600 border-amber-200', icon: AlertTriangle },
        }[cat] || { color: 'bg-gray-100 text-gray-600', icon: User };

        const Icon = config.icon;

        return (
            <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${config.color}`}>
                <Icon size={14} /> {typeof lead.category === 'string' ? lead.category : JSON.stringify(lead.category)}
            </span>
        );
    };

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center p-0 md:p-4 animate-in fade-in duration-200">
            <div className="bg-card w-full max-w-3xl rounded-t-xl md:rounded-xl shadow-2xl border border-border overflow-hidden h-auto max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-6 border-b border-border flex justify-between items-start bg-muted/20">
                    <div className="flex gap-4 items-center">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                            {lead.riderName?.charAt(0) || 'U'}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                {lead.riderName}
                            </h2>
                            <p className="text-sm text-muted-foreground">Lead #{lead.leadId}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => onEdit(lead)}
                            className="px-4 py-2 bg-white border border-border rounded-lg text-sm font-medium hover:bg-accent transition-colors flex items-center gap-2 shadow-sm"
                        >
                            <Edit size={16} /> Edit
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-accent rounded-full transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-border px-6 overflow-x-auto">
                    {[
                        { id: 'details', label: 'Details', icon: User },
                        { id: 'smart_view', label: 'Smart View', icon: Sparkles },
                        { id: 'follow_up', label: 'Follow Up', icon: MessageCircle },
                        { id: 'activity', label: 'Activity', icon: Activity }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === tab.id
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            <tab.icon size={16} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-muted/5">
                    {activeTab === 'details' && (
                        <div className="space-y-6">
                            {/* Status & Score Card */}
                            <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
                                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <Activity size={16} /> Status & Score
                                </h3>
                                <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                                    <div className="flex justify-between items-center py-2 border-b border-border/50">
                                        <span className="text-sm font-medium">Status</span>
                                        {getStatusBadge()}
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-border/50">
                                        <span className="text-sm font-medium">AI Stats</span>
                                        {getCategoryBadge()}
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-border/50">
                                        <span className="text-sm font-medium">AI Score</span>
                                        <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold border border-amber-200">
                                            {lead.score || 0}% - {lead.score && lead.score > 70 ? 'High' : 'Medium'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-border/50 text-xs text-muted-foreground">
                                        <span>Score Updated:</span>
                                        <span>{format(new Date(), 'dd/MM/yyyy HH:mm')}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Contact Info */}
                            <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
                                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <Phone size={16} /> Contact Information
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="text-xs text-muted-foreground mb-1 block">Mobile</label>
                                        <div className="text-sm font-semibold flex items-center gap-2">
                                            {lead.mobileNumber}
                                            <div className="flex gap-1 ml-2">
                                                <a href={`tel:${lead.mobileNumber}`} className="w-6 h-6 rounded bg-blue-100 text-blue-600 flex items-center justify-center cursor-pointer hover:bg-blue-200">
                                                    <Phone size={12} />
                                                </a>
                                                <a href={`https://wa.me/${lead.mobileNumber?.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="w-6 h-6 rounded bg-green-100 text-green-600 flex items-center justify-center cursor-pointer hover:bg-green-200">
                                                    <MessageCircle size={12} />
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground mb-1 block">City</label>
                                        <div className="text-sm font-semibold">{lead.city}</div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground mb-1 block">GPS Location</label>
                                        {lead.location && lead.location.lat ? (
                                            <div
                                                className="text-sm font-medium text-blue-600 flex items-center gap-1 cursor-pointer hover:underline"
                                                onClick={() => window.open(`https://www.google.com/maps?q=${lead.location.lat},${lead.location.lng}`, '_blank')}
                                            >
                                                <MapPin size={14} /> View on Map
                                            </div>
                                        ) : (
                                            <div className="text-sm text-muted-foreground italic">Location not available</div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* EV Interest */}
                            <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
                                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <Zap size={16} /> EV Interest Details
                                </h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between border-b border-border/50 pb-2">
                                        <span className="text-sm text-muted-foreground">EV Type</span>
                                        <span className="text-sm font-medium capitalize">{lead.evTypeInterested}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-border/50 pb-2">
                                        <span className="text-sm text-muted-foreground">Client Interest</span>
                                        <span className="text-sm font-medium capitalize">{lead.clientInterested}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-border/50 pb-2">
                                        <span className="text-sm text-muted-foreground">Current EV</span>
                                        <span className="text-sm font-medium capitalize">{lead.currentEvUsing}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-border/50 pb-2">
                                        <span className="text-sm text-muted-foreground">Driving License</span>
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${lead.drivingLicense === 'Permanent' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                                            {lead.drivingLicense}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'smart_view' && (
                        <div className="space-y-6">
                            <div className="bg-gradient-to-br from-primary/5 to-primary/10 p-8 rounded-xl border border-primary/20 text-center">
                                <Sparkles size={48} className="mx-auto mb-4 text-primary" />
                                <h3 className="text-xl font-bold text-foreground mb-2">AI Smart Analysis</h3>
                                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                                    Get instant insights, conversion probability, and recommended next steps based on lead data and history.
                                </p>

                                {!aiSummary ? (
                                    <button
                                        onClick={handleGenerateSummary}
                                        disabled={isGeneratingAi}
                                        className="px-6 py-2 bg-primary text-primary-foreground rounded-full font-medium shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center gap-2 mx-auto disabled:opacity-50"
                                    >
                                        {isGeneratingAi ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Analyzing...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles size={18} /> Generate Insights
                                            </>
                                        )}
                                    </button>
                                ) : (
                                    <div className="bg-white/50 backdrop-blur-sm p-6 rounded-lg text-left border border-primary/10 shadow-inner animate-in fade-in slide-in-from-bottom-2">
                                        <div className="prose prose-sm max-w-none">
                                            <p className="whitespace-pre-wrap text-foreground/90 leading-relaxed font-mono text-sm">
                                                {aiSummary}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setAiSummary('')}
                                            className="mt-4 text-xs text-primary hover:underline"
                                        >
                                            Regenerate Analysis
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'follow_up' && (
                        <div className="space-y-6 h-full flex flex-col">
                            <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex-1 flex flex-col">
                                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <Bot size={16} /> Add Follow-up Note
                                </h3>

                                <div className="relative flex-1 min-h-[120px]">
                                    <textarea
                                        value={comment}
                                        onChange={(e) => setComment(e.target.value)}
                                        placeholder={isListening ? "Listening... Speak now." : "Type your observation or click the mic to speak..."}
                                        className={`w-full h-full p-4 rounded-lg border resize-none focus:outline-none focus:ring-2 transition-all ${isListening ? 'border-red-400 ring-2 ring-red-100 bg-red-50/50' : 'border-input focus:ring-primary/20'}`}
                                    />
                                    {hasRecognitionSupport && (
                                        <button
                                            onClick={isListening ? stopListening : startListening}
                                            className={`absolute right-3 bottom-3 p-3 rounded-full shadow-md transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}
                                            title={isListening ? "Stop Recording" : "Start Voice Input"}
                                        >
                                            {isListening ? <StopCircle size={20} /> : <Mic size={20} />}
                                        </button>
                                    )}
                                </div>

                                <div className="flex justify-end gap-3 mt-4">
                                    <button
                                        onClick={() => setComment('')}
                                        className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
                                    >
                                        Clear
                                    </button>
                                    <button
                                        onClick={handleSaveComment}
                                        disabled={!comment.trim() || isSavingComment}
                                        className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium shadow-sm hover:shadow-md transition-all disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {isSavingComment ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send size={16} />}
                                        Save Note
                                    </button>
                                </div>
                            </div>

                            {/* Past Comments (From Remarks) */}
                            <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
                                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <History size={16} /> Past Notes
                                </h3>
                                <div className="space-y-4 max-h-[200px] overflow-y-auto pr-2">
                                    {lead.remarks ? (
                                        lead.remarks.split('\n').map((note, idx) => (
                                            <div key={idx} className="p-3 bg-muted/30 rounded-lg text-sm border border-border/50">
                                                {note}
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-center text-muted-foreground text-sm py-4">No past notes available.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'activity' && (
                        <div className="relative border-l-2 border-border ml-3 space-y-8 pl-8 py-4">
                            <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-primary ring-4 ring-background" />
                            <div>
                                <span className="text-xs text-muted-foreground block mb-1">
                                    {format(new Date(lead.createdAt), 'PPP p')}
                                </span>
                                <h4 className="text-sm font-medium">Lead Created</h4>
                                <p className="text-sm text-muted-foreground">Sourced by {lead.createdByName} via {lead.source}</p>
                            </div>

                            {/* Dynamically show recent changes if we had a full log here */}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LeadDetailModal;
