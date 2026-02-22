import React, { useState } from 'react';
import { Lead, LeadStatus } from '@/types';
import {
    MapPin, Phone, MessageCircle, Edit2, Trash2,
    CheckSquare, Square, Eye, ChevronDown
} from 'lucide-react';

interface LeadsTableProps {
    leads: Lead[];
    loading: boolean;
    userRole: 'admin' | 'teamLeader';
    onStatusChange: (lead: Lead, newStatus: LeadStatus) => void;
    onDelete: (lead: Lead) => void;
    onEdit: (lead: Lead) => void;
    onView?: (lead: Lead) => void;
    showLocation: boolean;
    permissions?: {
        edit?: boolean;
        delete?: boolean;
        statusChange?: boolean;
    };
    selectedIds?: Set<string>;
    onToggleSelect?: (id: string) => void;
    onToggleSelectAll?: () => void;
    getLeadAIStatus?: (lead: Lead) => 'Genuine' | 'Duplicate' | 'Match';
}

const LeadsTable: React.FC<LeadsTableProps> = ({
    leads,
    loading,
    userRole,
    onStatusChange,
    onDelete,
    onEdit,
    onView,
    showLocation,
    permissions = { edit: true, delete: true, statusChange: true },
    selectedIds = new Set(),
    onToggleSelect,
    onToggleSelectAll,
    getLeadAIStatus
}) => {
    const [openStatusMenu, setOpenStatusMenu] = useState<string | null>(null);

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'New': return 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800';
            case 'Convert': return 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
            case 'Not Convert': return 'bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';
            default: return 'bg-muted text-muted-foreground border-border';
        }
    };

    const getStatusDot = (status: string) => {
        switch (status) {
            case 'New': return 'bg-blue-500 animate-pulse';
            case 'Convert': return 'bg-emerald-500';
            case 'Not Convert': return 'bg-slate-400';
            default: return 'bg-muted-foreground';
        }
    };

    const getAIBadge = (lead: Lead) => {
        const cat = getLeadAIStatus ? getLeadAIStatus(lead) : lead.category;
        if (typeof cat === 'object' && cat !== null) return null;
        switch (cat) {
            case 'Genuine': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">✦ GENUINE</span>;
            case 'Match': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">⚑ MATCH</span>;
            case 'Duplicate': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">⊘ DUPE</span>;
            default: return null;
        }
    };

    const canChangeStatus = userRole === 'admin' || permissions.statusChange;
    const canEdit = userRole === 'admin' || permissions.edit;
    const canDeleteLead = userRole === 'admin' || permissions.delete;

    const allSelected = leads.length > 0 && selectedIds.size === leads.length;

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground font-medium">Loading leads...</p>
            </div>
        );
    }

    if (leads.length === 0) {
        return (
            <div className="text-center py-20 px-6">
                <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-4 text-3xl">📋</div>
                <p className="font-bold text-foreground mb-1">No leads found</p>
                <p className="text-sm text-muted-foreground">Start by adding a new lead or adjust your filters.</p>
            </div>
        );
    }

    return (
        <>
            {/* ── Desktop Table ── */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-muted/40 border-b border-border">
                        <tr>
                            <th className="px-5 py-3.5 w-10">
                                {onToggleSelectAll && (
                                    <button onClick={onToggleSelectAll} className="text-muted-foreground hover:text-primary transition-colors">
                                        {allSelected ? <CheckSquare size={18} className="text-primary" /> : <Square size={18} />}
                                    </button>
                                )}
                            </th>
                            <th className="px-5 py-3.5 text-left text-[10px] font-black uppercase tracking-wider text-muted-foreground">Lead ID</th>
                            <th className="px-5 py-3.5 text-left text-[10px] font-black uppercase tracking-wider text-muted-foreground">Candidate</th>
                            <th className="px-5 py-3.5 text-left text-[10px] font-black uppercase tracking-wider text-muted-foreground">Details</th>
                            <th className="px-5 py-3.5 text-left text-[10px] font-black uppercase tracking-wider text-muted-foreground">AI Tag</th>
                            <th className="px-5 py-3.5 text-left text-[10px] font-black uppercase tracking-wider text-muted-foreground">Status</th>
                            {showLocation && <th className="px-5 py-3.5 text-left text-[10px] font-black uppercase tracking-wider text-muted-foreground">Location</th>}
                            <th className="px-5 py-3.5 text-right text-[10px] font-black uppercase tracking-wider text-muted-foreground">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                        {leads.map((lead) => (
                            <tr key={lead.id} className={`hover:bg-muted/25 transition-all duration-150 ${selectedIds.has(lead.id) ? 'bg-primary/5' : ''}`}>
                                {/* Checkbox */}
                                <td className="px-5 py-4">
                                    {onToggleSelect && (
                                        <button onClick={() => onToggleSelect(lead.id)} className="text-muted-foreground hover:text-primary transition-colors">
                                            {selectedIds.has(lead.id) ? <CheckSquare size={18} className="text-primary" /> : <Square size={18} />}
                                        </button>
                                    )}
                                </td>

                                {/* Lead ID */}
                                <td className="px-5 py-4">
                                    {onView ? (
                                        <button onClick={() => onView(lead)} className="text-primary font-black text-sm hover:underline hover:text-primary/80 transition-colors">
                                            #{String(lead.leadId || '')}
                                        </button>
                                    ) : (
                                        <span className="text-sm font-bold text-foreground">#{String(lead.leadId || '')}</span>
                                    )}
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                        {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                                    </p>
                                </td>

                                {/* Candidate */}
                                <td className="px-5 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-sm flex-shrink-0 border border-indigo-100 dark:border-indigo-800">
                                            {String(lead.riderName || '?').charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-sm text-foreground truncate max-w-[130px]">{String(lead.riderName || 'Unknown')}</p>
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <a href={`tel:${lead.mobileNumber}`} className="p-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-100 transition-colors" title="Call">
                                                    <Phone size={11} />
                                                </a>
                                                <a href={`https://wa.me/${String(lead.mobileNumber || '').replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="p-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-100 transition-colors" title="WhatsApp">
                                                    <MessageCircle size={11} />
                                                </a>
                                                <span className="text-[10px] text-muted-foreground">{lead.mobileNumber}</span>
                                            </div>
                                        </div>
                                    </div>
                                </td>

                                {/* Details */}
                                <td className="px-5 py-4">
                                    <p className="text-sm text-foreground/80 font-medium">{typeof lead.city === 'string' ? lead.city : 'N/A'}</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">{typeof lead.source === 'string' ? lead.source : '—'}</p>
                                    {typeof lead.clientInterested === 'string' && lead.clientInterested && (
                                        <span className="inline-block mt-1 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                                            {lead.clientInterested}
                                        </span>
                                    )}
                                </td>

                                {/* AI Tag */}
                                <td className="px-5 py-4">{getAIBadge(lead)}</td>

                                {/* Status */}
                                <td className="px-5 py-4">
                                    <div className="relative">
                                        <button
                                            onClick={() => canChangeStatus && setOpenStatusMenu(openStatusMenu === lead.id ? null : lead.id)}
                                            className={`inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-full border transition-all ${getStatusStyle(lead.status)} ${canChangeStatus ? 'cursor-pointer hover:opacity-80 pr-1.5' : 'cursor-default'}`}
                                        >
                                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${getStatusDot(lead.status)}`} />
                                            {typeof lead.status === 'string' ? lead.status : String(lead.status || '')}
                                            {canChangeStatus && <ChevronDown size={10} className="ml-0.5 opacity-60 flex-shrink-0" />}
                                        </button>
                                        {openStatusMenu === lead.id && canChangeStatus && (
                                            <>
                                                <div className="fixed inset-0 z-40" onClick={() => setOpenStatusMenu(null)} />
                                                <div className="absolute left-0 top-full mt-1.5 w-36 bg-background border border-border shadow-xl rounded-xl overflow-hidden z-50">
                                                    {(['New', 'Convert', 'Not Convert'] as LeadStatus[]).map((s) => (
                                                        <button
                                                            key={s}
                                                            onClick={() => { onStatusChange(lead, s); setOpenStatusMenu(null); }}
                                                            className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-muted transition-colors ${lead.status === s ? 'font-black text-primary bg-primary/5' : 'font-medium text-foreground'}`}
                                                        >
                                                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${getStatusDot(s)}`} />
                                                            {s}
                                                        </button>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </td>

                                {/* Location */}
                                {showLocation && (
                                    <td className="px-5 py-4">
                                        {lead.location ? (
                                            <a href={`https://www.google.com/maps?q=${lead.location.lat},${lead.location.lng}`} target="_blank" rel="noreferrer"
                                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-bold">
                                                <MapPin size={12} /> View
                                            </a>
                                        ) : <span className="text-muted-foreground text-xs">—</span>}
                                    </td>
                                )}

                                {/* Actions */}
                                <td className="px-5 py-4">
                                    <div className="flex justify-end items-center gap-1.5">
                                        {onView && (
                                            <button onClick={() => onView(lead)} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="View">
                                                <Eye size={15} />
                                            </button>
                                        )}
                                        {canEdit && (
                                            <button onClick={() => onEdit(lead)} className="p-1.5 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" title="Edit">
                                                <Edit2 size={15} />
                                            </button>
                                        )}
                                        {canDeleteLead && (
                                            <button onClick={() => onDelete(lead)} className="p-1.5 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors" title="Delete">
                                                <Trash2 size={15} />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* ── Mobile Card View ── */}
            <div className="md:hidden">
                {/* Mobile Select All */}
                <div className="px-4 py-3 bg-muted/30 flex items-center justify-between border-b border-border/50">
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-muted-foreground">
                        {onToggleSelectAll && (
                            <>
                                <button onClick={onToggleSelectAll} className="text-muted-foreground hover:text-primary transition-colors">
                                    {allSelected ? <CheckSquare size={18} className="text-primary" /> : <Square size={18} />}
                                </button>
                                Select all
                            </>
                        )}
                    </label>
                    <span className="text-xs text-muted-foreground">{leads.length} leads</span>
                </div>

                <div className="divide-y divide-border/50">
                    {leads.map((lead) => (
                        <div key={lead.id} className={`p-4 transition-colors ${selectedIds.has(lead.id) ? 'bg-primary/5' : 'hover:bg-muted/20'}`}>
                            <div className="flex items-start gap-3">
                                {onToggleSelect && (
                                    <button onClick={() => onToggleSelect(lead.id)} className="mt-1 text-muted-foreground hover:text-primary transition-colors flex-shrink-0">
                                        {selectedIds.has(lead.id) ? <CheckSquare size={18} className="text-primary" /> : <Square size={18} />}
                                    </button>
                                )}
                                <div className="flex-1 min-w-0">
                                    {/* Card Header */}
                                    <div className="flex items-start justify-between gap-2 mb-3">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-lg flex-shrink-0 border border-indigo-100 dark:border-indigo-800">
                                                {String(lead.riderName || '?').charAt(0).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                {onView ? (
                                                    <button onClick={() => onView(lead)} className="font-black text-sm text-foreground block truncate max-w-[160px] text-left hover:text-primary transition-colors">
                                                        {String(lead.riderName || 'Unknown')}
                                                    </button>
                                                ) : (
                                                    <p className="font-black text-sm text-foreground truncate max-w-[160px]">{String(lead.riderName || 'Unknown')}</p>
                                                )}
                                                <p className="text-xs text-primary font-bold">#{String(lead.leadId || '')}</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                                            {/* Status Pill */}
                                            <div className="relative">
                                                <button
                                                    onClick={() => canChangeStatus && setOpenStatusMenu(openStatusMenu === lead.id ? null : lead.id)}
                                                    className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full border ${getStatusStyle(lead.status)}`}
                                                >
                                                    <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(lead.status)}`} />
                                                    {String(lead.status || '')}
                                                    {canChangeStatus && <ChevronDown size={9} className="opacity-60" />}
                                                </button>
                                                {openStatusMenu === lead.id && canChangeStatus && (
                                                    <>
                                                        <div className="fixed inset-0 z-40" onClick={() => setOpenStatusMenu(null)} />
                                                        <div className="absolute right-0 top-full mt-1.5 w-36 bg-background border border-border shadow-xl rounded-xl overflow-hidden z-50">
                                                            {(['New', 'Convert', 'Not Convert'] as LeadStatus[]).map((s) => (
                                                                <button key={s} onClick={() => { onStatusChange(lead, s); setOpenStatusMenu(null); }}
                                                                    className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-muted transition-colors ${lead.status === s ? 'font-black text-primary bg-primary/5' : 'font-medium text-foreground'}`}>
                                                                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${getStatusDot(s)}`} />{s}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                            {/* AI Badge */}
                                            {getAIBadge(lead)}
                                        </div>
                                    </div>

                                    {/* Details Grid */}
                                    <div className="grid grid-cols-2 gap-2 mb-3">
                                        <div className="bg-muted/40 rounded-xl p-2.5">
                                            <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground mb-0.5">Mobile</p>
                                            <p className="text-sm font-bold text-foreground">{lead.mobileNumber}</p>
                                        </div>
                                        <div className="bg-muted/40 rounded-xl p-2.5">
                                            <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground mb-0.5">City</p>
                                            <p className="text-sm font-bold text-foreground">{typeof lead.city === 'string' ? lead.city : 'N/A'}</p>
                                        </div>
                                        {typeof lead.source === 'string' && lead.source && (
                                            <div className="bg-muted/40 rounded-xl p-2.5">
                                                <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground mb-0.5">Source</p>
                                                <p className="text-sm font-bold text-foreground">{lead.source}</p>
                                            </div>
                                        )}
                                        {typeof lead.clientInterested === 'string' && lead.clientInterested && (
                                            <div className="bg-muted/40 rounded-xl p-2.5">
                                                <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground mb-0.5">Interested In</p>
                                                <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{lead.clientInterested}</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-2">
                                        <a href={`tel:${lead.mobileNumber}`}
                                            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-bold border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors active:scale-95">
                                            <Phone size={13} /> Call
                                        </a>
                                        <a href={`https://wa.me/${String(lead.mobileNumber || '').replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                                            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-bold border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors active:scale-95">
                                            <MessageCircle size={13} /> WA
                                        </a>
                                        {onView && (
                                            <button onClick={() => onView(lead)}
                                                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-muted/60 text-foreground/70 rounded-xl text-xs font-bold border border-border hover:bg-muted transition-colors active:scale-95">
                                                <Eye size={13} /> View
                                            </button>
                                        )}
                                        {canEdit && (
                                            <button onClick={() => onEdit(lead)}
                                                className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors active:scale-95">
                                                <Edit2 size={14} />
                                            </button>
                                        )}
                                        {canDeleteLead && (
                                            <button onClick={() => onDelete(lead)}
                                                className="p-2 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-200 dark:border-rose-800 hover:bg-rose-100 transition-colors active:scale-95">
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                        {showLocation && lead.location && (
                                            <a href={`https://www.google.com/maps?q=${lead.location.lat},${lead.location.lng}`} target="_blank" rel="noreferrer"
                                                className="p-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-colors active:scale-95">
                                                <MapPin size={14} />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
};

export default LeadsTable;
