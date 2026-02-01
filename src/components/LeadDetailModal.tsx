import React, { useState } from 'react';
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
    MessageCircle
} from 'lucide-react';
import { format } from 'date-fns';

interface LeadDetailModalProps {
    lead: Lead;
    onClose: () => void;
    onEdit: (lead: Lead) => void;
}

const LeadDetailModal: React.FC<LeadDetailModalProps> = ({ lead, onClose, onEdit }) => {
    const [activeTab, setActiveTab] = useState<'details' | 'ai' | 'activity'>('details');

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
        const cat = typeof lead.category === 'string' ? lead.category : 'Genuine'; // Fallback
        const config = {
            'Genuine': { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: ShieldCheck },
            'Match': { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Repeat },
            'Duplicate': { color: 'bg-rose-100 text-rose-700 border-rose-200', icon: AlertTriangle },
        }[cat] || { color: 'bg-gray-100 text-gray-600', icon: User };

        const Icon = config.icon;

        return (
            <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${config.color}`}>
                <Icon size={14} /> {typeof lead.category === 'string' ? lead.category : JSON.stringify(lead.category)}
            </span>
        );
    };

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-card w-full max-w-3xl rounded-xl shadow-2xl border border-border overflow-hidden h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
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
                <div className="flex border-b border-border px-6">
                    {(['details', 'ai', 'activity'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            {tab === 'details' && 'Details'}
                            {tab === 'ai' && 'Smart Notes'}
                            {tab === 'activity' && 'Activity'}
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
                                                <div className="w-5 h-5 rounded bg-blue-100 text-blue-600 flex items-center justify-center cursor-pointer">
                                                    <Phone size={12} />
                                                </div>
                                                <div className="w-5 h-5 rounded bg-green-100 text-green-600 flex items-center justify-center cursor-pointer">
                                                    <MessageCircle size={12} />
                                                </div>
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

                    {activeTab === 'ai' && (
                        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                            <Sparkles size={48} className="mb-4 text-primary/50" />
                            <h3 className="text-lg font-semibold text-foreground mb-2">Smart Notes</h3>
                            <p className="max-w-sm">
                                AI analysis of call logs and rider interactions will appear here to give you better context.
                            </p>
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

                            {/* Future logs would be mapped here */}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LeadDetailModal;
