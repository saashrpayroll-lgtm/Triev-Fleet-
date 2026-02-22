import React, { useState } from 'react';
import { Lead, LeadStatus } from '@/types';
import {
    MoreVertical, Eye, Edit, Trash2, MapPin, ShieldCheck, AlertTriangle,
    Repeat, Sparkles, Phone, MessageCircle, RotateCw, Trash,
    ChevronDown, CheckSquare, Square, ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { getWhatsAppLink, getCallLink } from '@/utils/validationUtils';

interface AdminLeadTableProps {
    leads: Lead[];
    loading: boolean;
    selectedIds: string[];
    onSelectionChange: (ids: string[]) => void;
    onStatusChange: (lead: Lead, newStatus: LeadStatus) => void;
    onView: (lead: Lead) => void;
    onEdit: (lead: Lead) => void;
    onDelete: (lead: Lead) => void;
    onPermanentDelete?: (lead: Lead) => void;
    onAIRecommend?: (lead: Lead) => void;
    getLeadAIStatus?: (lead: Lead) => 'Genuine' | 'Duplicate' | 'Match';
    onAIStatusClick?: (lead: Lead, status: 'Genuine' | 'Duplicate' | 'Match') => void;
}

const StatusDropdown: React.FC<{
    lead: Lead;
    onStatusChange: (lead: Lead, status: LeadStatus) => void;
}> = ({ lead, onStatusChange }) => {
    const [open, setOpen] = useState(false);
    const opts: LeadStatus[] = ['New', 'Convert', 'Not Convert'];
    const cfg: Record<LeadStatus, string> = {
        'New': 'bg-blue-100 text-blue-700 border-blue-200',
        'Convert': 'bg-emerald-100 text-emerald-700 border-emerald-200',
        'Not Convert': 'bg-slate-100 text-slate-600 border-slate-200',
    };
    return (
        <div className="relative" onClick={e => e.stopPropagation()}>
            <button
                onClick={() => setOpen(o => !o)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border transition-all hover:shadow-sm ${cfg[lead.status]}`}
            >
                {lead.status}
                <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div className="absolute left-0 top-full mt-1 z-50 bg-white dark:bg-slate-900 border border-border rounded-xl shadow-2xl overflow-hidden min-w-[140px]">
                        {opts.map(s => (
                            <button
                                key={s}
                                onClick={() => { onStatusChange(lead, s); setOpen(false); }}
                                className={`w-full text-left px-3 py-2 text-xs font-semibold flex items-center gap-2 transition-colors
                                    ${lead.status === s ? 'bg-accent/50 text-foreground cursor-default' : 'hover:bg-accent text-foreground'}`}
                                disabled={lead.status === s}
                            >
                                <span className={`w-2 h-2 rounded-full ${s === 'New' ? 'bg-blue-500' : s === 'Convert' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                {s}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

const AiBadge: React.FC<{ category: string; onClick?: () => void }> = ({ category, onClick }) => {
    const cfg: Record<string, { cls: string; icon: React.ReactNode }> = {
        'Genuine': { cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: <ShieldCheck size={11} /> },
        'Duplicate': { cls: 'bg-amber-100 text-amber-700 border-amber-200', icon: <AlertTriangle size={11} /> },
        'Match': { cls: 'bg-red-100 text-red-700 border-red-200', icon: <Repeat size={11} /> },
    };
    const c = cfg[category] ?? { cls: 'bg-slate-100 text-slate-600 border-slate-200', icon: null };
    return (
        <span
            onClick={onClick}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${c.cls} ${onClick ? 'cursor-pointer hover:ring-2 hover:ring-offset-1' : ''}`}
        >
            {c.icon} {category || 'Unknown'}
        </span>
    );
};

const ScoreBadge: React.FC<{ score?: number }> = ({ score }) => {
    if (score === undefined || score === null) return <span className="text-xs text-muted-foreground">—</span>;
    const cls = score >= 80 ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
        : score >= 50 ? 'bg-amber-100 text-amber-700 border-amber-200'
            : 'bg-red-100 text-red-700 border-red-200';
    return <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${cls}`}>{score}</span>;
};

const AdminLeadTable: React.FC<AdminLeadTableProps> = ({
    leads, loading, selectedIds, onSelectionChange,
    onStatusChange, onView, onEdit, onDelete,
    onPermanentDelete, onAIRecommend, getLeadAIStatus, onAIStatusClick
}) => {
    const [actionMenu, setActionMenu] = useState<{ id: string; top: number; right: number } | null>(null);
    const [expandedCard, setExpandedCard] = useState<string | null>(null);

    React.useEffect(() => {
        const close = () => setActionMenu(null);
        window.addEventListener('click', close);
        window.addEventListener('scroll', close, true);
        return () => { window.removeEventListener('click', close); window.removeEventListener('scroll', close, true); };
    }, []);

    const getCategory = (lead: Lead) => getLeadAIStatus ? getLeadAIStatus(lead) : (lead.category as string);
    const handleSelectAll = () => onSelectionChange(selectedIds.length === leads.length && leads.length > 0 ? [] : leads.map(l => l.id));

    const activeLead = actionMenu ? leads.find(l => l.id === actionMenu.id) : null;

    if (loading) return (
        <div className="p-16 flex justify-center">
            <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground font-medium">Analyzing Leads...</p>
            </div>
        </div>
    );

    if (leads.length === 0) return (
        <div className="p-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <Sparkles size={28} className="text-muted-foreground" />
            </div>
            <p className="text-base font-semibold text-foreground">No leads found</p>
            <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters</p>
        </div>
    );

    return (
        <div>
            {/* Fixed-position action menu portal */}
            {actionMenu && activeLead && (
                <div
                    className="fixed w-52 bg-popover border border-border rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-100 overflow-hidden"
                    style={{ top: `${actionMenu.top}px`, right: `${actionMenu.right}px`, zIndex: 9999 }}
                    onClick={e => e.stopPropagation()}
                >
                    <div className="py-1.5">
                        <button onClick={() => { setActionMenu(null); onView(activeLead); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-accent flex items-center gap-2.5"><Eye size={14} className="text-blue-500" /> View Details</button>
                        <button onClick={() => { setActionMenu(null); onEdit(activeLead); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-accent flex items-center gap-2.5"><Edit size={14} className="text-violet-500" /> Edit Lead</button>
                        <div className="border-t border-border/50 my-1" />
                        <div className="px-4 py-1.5 text-[10px] text-muted-foreground font-black uppercase tracking-wider">Change Status</div>
                        {(['New', 'Convert', 'Not Convert'] as LeadStatus[]).map(status => (
                            <button key={status} onClick={() => { setActionMenu(null); onStatusChange(activeLead, status); }} disabled={activeLead.status === status}
                                className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 ${activeLead.status === status ? 'opacity-40 cursor-not-allowed' : 'hover:bg-accent'}`}>
                                <RotateCw size={13} className={activeLead.status === status ? 'opacity-50' : 'text-muted-foreground'} /> {status}
                            </button>
                        ))}
                        {onAIRecommend && (<>
                            <div className="border-t border-border/50 my-1" />
                            <button onClick={() => { setActionMenu(null); onAIRecommend(activeLead); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-amber-50 dark:hover:bg-amber-900/10 flex items-center gap-2.5 text-amber-600"><Sparkles size={14} /> AI Recommendations</button>
                        </>)}
                        <div className="border-t border-border/50 my-1" />
                        <button onClick={() => { setActionMenu(null); onDelete(activeLead); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-orange-50 dark:hover:bg-orange-900/10 text-orange-600 flex items-center gap-2.5"><Trash2 size={14} /> Soft Delete</button>
                        {onPermanentDelete && <button onClick={() => { setActionMenu(null); onPermanentDelete(activeLead); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-red-50 dark:hover:bg-red-900/10 text-red-600 flex items-center gap-2.5"><Trash size={14} /> Permanent Delete</button>}
                    </div>
                </div>
            )}

            {/* ─── DESKTOP TABLE (md+) ─── */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-border bg-muted/20">
                            <th className="px-4 py-3 w-10">
                                <button onClick={handleSelectAll} className="text-muted-foreground hover:text-foreground transition-colors">
                                    {selectedIds.length === leads.length && leads.length > 0 ? <CheckSquare size={16} className="text-primary" /> : <Square size={16} />}
                                </button>
                            </th>
                            <th className="px-3 py-3 text-left text-[10px] font-black uppercase tracking-wider text-muted-foreground">Lead ID</th>
                            <th className="px-3 py-3 text-left text-[10px] font-black uppercase tracking-wider text-muted-foreground">Candidate</th>
                            <th className="px-3 py-3 text-left text-[10px] font-black uppercase tracking-wider text-muted-foreground">City / Source</th>
                            <th className="px-3 py-3 text-left text-[10px] font-black uppercase tracking-wider text-muted-foreground">Team Leader</th>
                            <th className="px-3 py-3 text-left text-[10px] font-black uppercase tracking-wider text-muted-foreground">Status</th>
                            <th className="px-3 py-3 text-left text-[10px] font-black uppercase tracking-wider text-muted-foreground">AI</th>
                            <th className="px-3 py-3 text-left text-[10px] font-black uppercase tracking-wider text-muted-foreground">Score</th>
                            <th className="px-3 py-3 text-left text-[10px] font-black uppercase tracking-wider text-muted-foreground">GPS</th>
                            <th className="px-3 py-3 text-left text-[10px] font-black uppercase tracking-wider text-muted-foreground">Created</th>
                            <th className="px-3 py-3 text-right text-[10px] font-black uppercase tracking-wider text-muted-foreground">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                        {leads.map(lead => {
                            const isSelected = selectedIds.includes(lead.id);
                            const category = getCategory(lead);
                            return (
                                <tr
                                    key={lead.id}
                                    onClick={() => onView(lead)}
                                    className={`group transition-colors cursor-pointer ${isSelected ? 'bg-primary/5' : 'hover:bg-muted/30'}`}
                                >
                                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                        <button onClick={() => {
                                            onSelectionChange(isSelected ? selectedIds.filter(x => x !== lead.id) : [...selectedIds, lead.id]);
                                        }} className="text-muted-foreground hover:text-foreground">
                                            {isSelected ? <CheckSquare size={16} className="text-primary" /> : <Square size={16} />}
                                        </button>
                                    </td>
                                    <td className="px-3 py-3">
                                        <span className="text-xs font-black text-muted-foreground">#{lead.leadId}</span>
                                        <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                                            {lead.createdAt ? format(new Date(lead.createdAt), 'dd/MM') : '—'}
                                        </div>
                                    </td>
                                    <td className="px-3 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-xs font-black flex-shrink-0">
                                                {lead.riderName?.charAt(0)?.toUpperCase() || '?'}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-foreground truncate max-w-[130px]">{lead.riderName}</p>
                                                <div className="flex items-center gap-1 mt-0.5">
                                                    <span className="text-[10px] font-mono text-muted-foreground">{lead.mobileNumber}</span>
                                                    <div className="flex gap-0.5" onClick={e => e.stopPropagation()}>
                                                        <a href={getCallLink(lead.mobileNumber)} className="p-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 text-blue-600 rounded transition-colors" title="Call"><Phone size={10} /></a>
                                                        <a href={getWhatsAppLink(lead.mobileNumber)} target="_blank" rel="noreferrer" className="p-1 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 rounded transition-colors" title="WhatsApp"><MessageCircle size={10} /></a>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-3 py-3">
                                        <p className="text-sm font-medium text-foreground">{lead.city || '—'}</p>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">{lead.source || '—'}</p>
                                    </td>
                                    <td className="px-3 py-3">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center text-white text-[8px] font-black flex-shrink-0">
                                                {(lead.createdByName || 'A')?.charAt(0)?.toUpperCase()}
                                            </div>
                                            <span className="text-xs text-muted-foreground truncate max-w-[100px]">{lead.createdByName || 'Admin'}</span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                                        <StatusDropdown lead={lead} onStatusChange={onStatusChange} />
                                    </td>
                                    <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                                        <AiBadge
                                            category={category}
                                            onClick={onAIStatusClick ? () => onAIStatusClick(lead, category as any) : undefined}
                                        />
                                    </td>
                                    <td className="px-3 py-3"><ScoreBadge score={lead.score} /></td>
                                    <td className="px-3 py-3">
                                        {lead.location ? (
                                            <button
                                                onClick={e => { e.stopPropagation(); window.open(`https://www.google.com/maps?q=${lead.location.lat},${lead.location.lng}`, '_blank'); }}
                                                className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-700 hover:underline px-2 py-1 bg-blue-50 dark:bg-blue-900/20 rounded-lg transition-colors"
                                            >
                                                <MapPin size={10} /> View
                                            </button>
                                        ) : <span className="text-[10px] text-muted-foreground/50">N/A</span>}
                                    </td>
                                    <td className="px-3 py-3">
                                        <span className="text-[11px] text-muted-foreground">{lead.createdAt ? format(new Date(lead.createdAt), 'dd MMM yy') : '—'}</span>
                                    </td>
                                    <td className="px-3 py-3 text-right" onClick={e => e.stopPropagation()}>
                                        <div className="flex items-center justify-end gap-1">
                                            <button onClick={() => onView(lead)} className="p-1.5 rounded-lg text-muted-foreground hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors" title="View"><Eye size={14} /></button>
                                            <button onClick={() => onEdit(lead)} className="p-1.5 rounded-lg text-muted-foreground hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors" title="Edit"><Edit size={14} /></button>
                                            <button
                                                onClick={e => {
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    setActionMenu(actionMenu?.id === lead.id ? null : { id: lead.id, top: rect.bottom + 4, right: window.innerWidth - rect.right });
                                                }}
                                                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                                            ><MoreVertical size={14} /></button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* ─── MOBILE CARDS (< md) ─── */}
            <div className="md:hidden space-y-2 p-3">
                {/* Mobile Select All */}
                <div className="flex items-center justify-between pb-2 border-b border-border">
                    <button onClick={handleSelectAll} className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                        {selectedIds.length === leads.length && leads.length > 0 ? <CheckSquare size={16} className="text-primary" /> : <Square size={16} />}
                        Select All ({leads.length})
                    </button>
                    {selectedIds.length > 0 && <span className="text-xs font-bold text-primary">{selectedIds.length} selected</span>}
                </div>

                {leads.map(lead => {
                    const isSelected = selectedIds.includes(lead.id);
                    const isExpanded = expandedCard === lead.id;
                    const category = getCategory(lead);

                    return (
                        <div
                            key={lead.id}
                            className={`rounded-2xl border transition-all ${isSelected ? 'border-primary bg-primary/5' : 'border-border bg-card'} shadow-sm`}
                        >
                            {/* Card Header */}
                            <div className="flex items-start gap-3 p-3">
                                {/* Checkbox */}
                                <button onClick={() => onSelectionChange(isSelected ? selectedIds.filter(x => x !== lead.id) : [...selectedIds, lead.id])} className="mt-0.5 flex-shrink-0">
                                    {isSelected ? <CheckSquare size={16} className="text-primary" /> : <Square size={16} className="text-muted-foreground" />}
                                </button>

                                {/* Avatar */}
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-sm font-black flex-shrink-0">
                                    {lead.riderName?.charAt(0)?.toUpperCase() || '?'}
                                </div>

                                {/* Main Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <p className="font-bold text-foreground text-sm truncate">{lead.riderName}</p>
                                            <p className="text-[10px] text-muted-foreground font-mono">{lead.mobileNumber}</p>
                                        </div>
                                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                            <span className="text-[10px] font-black text-muted-foreground">#{lead.leadId}</span>
                                            <ScoreBadge score={lead.score} />
                                        </div>
                                    </div>

                                    {/* Badges Row */}
                                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                        <StatusDropdown lead={lead} onStatusChange={onStatusChange} />
                                        <AiBadge
                                            category={category}
                                            onClick={onAIStatusClick ? () => onAIStatusClick(lead, category as any) : undefined}
                                        />
                                        {lead.city && <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{lead.city}</span>}
                                    </div>
                                </div>
                            </div>

                            {/* Expanded Details */}
                            {isExpanded && (
                                <div className="border-t border-border/50 px-3 pb-3 pt-2 space-y-2">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-muted/40 rounded-xl p-2.5">
                                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-wide">Team Leader</p>
                                            <p className="text-xs font-semibold text-foreground mt-0.5">{lead.createdByName || 'Admin'}</p>
                                        </div>
                                        <div className="bg-muted/40 rounded-xl p-2.5">
                                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-wide">Source</p>
                                            <p className="text-xs font-semibold text-foreground mt-0.5">{lead.source || '—'}</p>
                                        </div>
                                        <div className="bg-muted/40 rounded-xl p-2.5">
                                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-wide">Created</p>
                                            <p className="text-xs font-semibold text-foreground mt-0.5">{lead.createdAt ? format(new Date(lead.createdAt), 'dd MMM yyyy') : '—'}</p>
                                        </div>
                                        {lead.location && (
                                            <div className="bg-muted/40 rounded-xl p-2.5">
                                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-wide">GPS</p>
                                                <button
                                                    onClick={() => window.open(`https://www.google.com/maps?q=${lead.location.lat},${lead.location.lng}`, '_blank')}
                                                    className="text-xs font-bold text-blue-600 flex items-center gap-1 mt-0.5"
                                                ><MapPin size={10} /> View Map</button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Card Footer Actions */}
                            <div className="border-t border-border/50 flex items-center justify-between px-3 py-2">
                                <div className="flex gap-1">
                                    <a href={getCallLink(lead.mobileNumber)} className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg text-[10px] font-bold transition-colors active:scale-95">
                                        <Phone size={11} /> Call
                                    </a>
                                    <a href={getWhatsAppLink(lead.mobileNumber)} target="_blank" rel="noreferrer" className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-lg text-[10px] font-bold transition-colors active:scale-95">
                                        <MessageCircle size={11} /> WA
                                    </a>
                                    <button onClick={() => onView(lead)} className="flex items-center gap-1 px-2.5 py-1.5 bg-violet-50 dark:bg-violet-900/20 text-violet-600 rounded-lg text-[10px] font-bold transition-colors active:scale-95">
                                        <Eye size={11} /> View
                                    </button>
                                    <button onClick={() => onEdit(lead)} className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-bold transition-colors active:scale-95">
                                        <Edit size={11} /> Edit
                                    </button>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setExpandedCard(isExpanded ? null : lead.id)}
                                        className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground transition-colors"
                                    >
                                        <ChevronRight size={14} className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                    </button>
                                    <button
                                        onClick={e => {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            setActionMenu(actionMenu?.id === lead.id ? null : { id: lead.id, top: rect.bottom + 4, right: window.innerWidth - rect.right });
                                        }}
                                        className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground transition-colors"
                                    >
                                        <MoreVertical size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default AdminLeadTable;
