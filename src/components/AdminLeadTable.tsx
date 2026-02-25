import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lead, LeadStatus } from '@/types';
import {
    MoreVertical, Eye, Edit, Trash2, MapPin, ShieldCheck, AlertTriangle,
    Repeat, Sparkles, Phone, MessageCircle, RotateCw, Trash,
    ChevronDown, CheckSquare, Square
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
    const cfg: Record<LeadStatus, { cls: string; dot: string }> = {
        'New': { cls: 'border-blue-200/50 bg-blue-50/50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/50', dot: 'bg-blue-500' },
        'Convert': { cls: 'border-emerald-200/50 bg-emerald-50/50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50', dot: 'bg-emerald-500' },
        'Not Convert': { cls: 'border-slate-200/50 bg-slate-50/50 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700/50', dot: 'bg-slate-400' },
    };

    const s = cfg[lead.status];

    return (
        <div className="relative" onClick={e => e.stopPropagation()}>
            <button
                onClick={() => setOpen(o => !o)}
                className={`
                    flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all duration-300 hover:shadow-lg hover:scale-105 active:scale-95
                    ${s.cls}
                `}
            >
                <span className={`w-1.5 h-1.5 rounded-full ${s.dot} shadow-[0_0_8px_rgba(var(--primary),0.5)]`} />
                {lead.status}
                <ChevronDown size={11} className={`transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="absolute left-0 top-full mt-2 z-50 bg-white dark:bg-slate-900 border border-border/50 rounded-2xl shadow-2xl overflow-hidden min-w-[160px] backdrop-blur-xl bg-white/90 dark:bg-slate-900/90"
                    >
                        {opts.map(status => (
                            <button
                                key={status}
                                onClick={() => { onStatusChange(lead, status); setOpen(false); }}
                                className={`
                                    w-full text-left px-4 py-3 text-[11px] font-bold uppercase tracking-widest flex items-center gap-3 transition-all
                                    ${lead.status === status
                                        ? 'bg-primary/10 text-primary'
                                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400'
                                    }
                                `}
                                disabled={lead.status === status}
                            >
                                <span className={`w-2 h-2 rounded-full ${cfg[status].dot}`} />
                                {status}
                            </button>
                        ))}
                    </motion.div>
                </>
            )}
        </div>
    );
};

const AiBadge: React.FC<{ category: string; onClick?: () => void }> = ({ category, onClick }) => {
    const cfg: Record<string, { cls: string; icon: React.ReactNode; color: string }> = {
        'Genuine': { cls: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', icon: <ShieldCheck size={10} />, color: 'emerald' },
        'Duplicate': { cls: 'bg-amber-500/10 text-amber-600 border-amber-500/20', icon: <AlertTriangle size={10} />, color: 'amber' },
        'Match': { cls: 'bg-rose-500/10 text-rose-600 border-rose-500/20', icon: <Repeat size={10} />, color: 'rose' },
    };
    const c = cfg[category] ?? { cls: 'bg-slate-500/10 text-slate-600 border-slate-500/20', icon: null, color: 'slate' };

    return (
        <button
            onClick={onClick}
            className={`
                flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all duration-300
                ${c.cls} 
                ${onClick ? 'cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-current' : ''}
            `}
        >
            {c.icon} {category || 'Unknown'}
        </button>
    );
};

const ScoreBadge: React.FC<{ score?: number }> = ({ score }) => {
    if (score === undefined || score === null) return <span className="text-xs text-muted-foreground">—</span>;

    const isHigh = score >= 80;
    const isMid = score >= 50 && score < 80;

    const cls = isHigh
        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.1)]'
        : isMid
            ? 'bg-amber-500/10 text-amber-600 border-amber-500/20 shadow-[0_0_12px_rgba(245,158,11,0.1)]'
            : 'bg-rose-500/10 text-rose-600 border-rose-500/20 shadow-[0_0_12px_rgba(244,63,94,0.1)]';

    return (
        <div className={`
            inline-flex items-center justify-center w-8 h-8 rounded-xl border text-[11px] font-black transition-transform hover:scale-110
            ${cls}
        `}>
            {score}
        </div>
    );
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
                <table className="w-full border-separate border-spacing-0">
                    <thead>
                        <tr className="bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-border/50">
                            <th className="px-6 py-4 w-12 border-b border-border/50 rounded-tl-2xl">
                                <button onClick={handleSelectAll} className="text-slate-400 hover:text-primary transition-all active:scale-95">
                                    {selectedIds.length === leads.length && leads.length > 0 ? <CheckSquare size={18} className="text-primary" /> : <Square size={18} />}
                                </button>
                            </th>
                            <th className="px-3 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-border/50">ID</th>
                            <th className="px-3 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-border/50">Candidate Info</th>
                            <th className="px-3 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-border/50">Location / Source</th>
                            <th className="px-3 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-border/50">Assignee</th>
                            <th className="px-3 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-border/50">Status</th>
                            <th className="px-3 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-border/50">AI Verif.</th>
                            <th className="px-3 py-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-border/50">Score</th>
                            <th className="px-3 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-border/50">GPS</th>
                            <th className="px-3 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-border/50">Registered</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-border/50 rounded-tr-2xl">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                        {leads.map(lead => {
                            const isSelected = selectedIds.includes(lead.id);
                            const category = getCategory(lead);

                            return (
                                <tr
                                    key={lead.id}
                                    onClick={() => onView(lead)}
                                    className={`
                                        group relative transition-all duration-300 cursor-pointer
                                        ${isSelected ? 'bg-primary/[0.04]' : 'hover:bg-primary/[0.02] dark:hover:bg-primary/[0.04]'}
                                    `}
                                >
                                    <td className="px-6 py-5 relative" onClick={e => e.stopPropagation()}>
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary opacity-0 group-hover:opacity-100 transition-opacity rounded-r-full" />
                                        <button onClick={() => {
                                            onSelectionChange(isSelected ? selectedIds.filter(x => x !== lead.id) : [...selectedIds, lead.id]);
                                        }} className="text-slate-300 dark:text-slate-600 hover:text-primary transition-all">
                                            {isSelected ? <CheckSquare size={18} className="text-primary" /> : <Square size={18} />}
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
            <div className="md:hidden space-y-4 p-4 bg-slate-50/30 dark:bg-slate-900/30">
                {/* Mobile Select All */}
                <div className="flex items-center justify-between pb-3 mb-2 border-b border-border/50">
                    <button onClick={handleSelectAll} className="flex items-center gap-3 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-primary transition-all active:scale-95">
                        {selectedIds.length === leads.length && leads.length > 0 ? <CheckSquare size={18} className="text-primary" /> : <Square size={18} />}
                        Select {selectedIds.length === leads.length ? 'None' : 'All'} ({leads.length})
                    </button>
                    {selectedIds.length > 0 && (
                        <span className="text-[10px] font-black uppercase tracking-widest text-white bg-primary px-3 py-1 rounded-full shadow-lg shadow-primary/20 animate-in fade-in slide-in-from-right-4">
                            {selectedIds.length} Selected
                        </span>
                    )}
                </div>

                {leads.map(lead => {
                    const isSelected = selectedIds.includes(lead.id);
                    const isExpanded = expandedCard === lead.id;
                    const category = getCategory(lead);

                    return (
                        <div
                            key={lead.id}
                            className={`
                                relative rounded-2xl border transition-all duration-300 overflow-hidden shadow-sm
                                ${isSelected
                                    ? 'border-primary bg-primary/[0.02] ring-1 ring-primary/10'
                                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-primary/40 hover:shadow-lg'
                                }
                            `}
                        >
                            {/* Vertical Accent */}
                            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${isSelected ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-800 transition-colors'}`} />

                            <div className="p-4">
                                <div className="flex justify-between items-start gap-3 mb-4">
                                    <div className="flex items-start gap-3 min-w-0">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onSelectionChange(isSelected ? selectedIds.filter(id => id !== lead.id) : [...selectedIds, lead.id]);
                                            }}
                                            className="mt-1 flex-shrink-0 active:scale-90 transition-transform"
                                        >
                                            {isSelected ? <CheckSquare size={20} className="text-primary" /> : <Square size={20} className="text-slate-300 dark:text-slate-600" />}
                                        </button>
                                        <div className="min-w-0">
                                            <div className="font-black text-slate-900 dark:text-slate-100 text-sm truncate flex items-center gap-2">
                                                {lead.riderName}
                                                <ScoreBadge score={lead.score} />
                                            </div>
                                            <div className="text-[10px] font-mono font-bold tracking-widest text-slate-500 mt-1 uppercase bg-slate-50 dark:bg-slate-800 w-fit px-2 py-0.5 rounded-md">
                                                ID: {lead.leadId || 'N/A'}
                                            </div>
                                        </div>
                                    </div>
                                    <div onClick={e => e.stopPropagation()}>
                                        <StatusDropdown lead={lead} onStatusChange={onStatusChange} />
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 mb-4">
                                    <AiBadge
                                        category={category}
                                        onClick={onAIStatusClick ? () => onAIStatusClick(lead, category as any) : undefined}
                                    />
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100/50 dark:border-slate-800/50 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                        <MapPin size={10} className="text-primary" /> {lead.city || 'N/A'}
                                    </div>
                                </div>

                                <AnimatePresence>
                                    {isExpanded && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="mb-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
                                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Source</p>
                                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{lead.source || 'Direct'}</p>
                                                    </div>
                                                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
                                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Assignee</p>
                                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{lead.createdByName || 'Admin'}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <a href={getCallLink(lead.mobileNumber)} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 active:scale-95 transition-transform">
                                                        <Phone size={14} /> <span className="text-[10px] font-black uppercase tracking-widest">Call</span>
                                                    </a>
                                                    <a href={getWhatsAppLink(lead.mobileNumber)} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#25D366] text-white shadow-lg shadow-green-500/20 active:scale-95 transition-transform">
                                                        <MessageCircle size={14} /> <span className="text-[10px] font-black uppercase tracking-widest">WA</span>
                                                    </a>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <div className="border-t border-slate-100 dark:border-slate-800 flex items-center justify-between pt-4 mt-2">
                                    <button
                                        onClick={() => setExpandedCard(isExpanded ? null : lead.id)}
                                        className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-primary transition-colors flex items-center gap-1.5"
                                    >
                                        {isExpanded ? 'Collapse' : 'Expanded Details'} <ChevronDown size={12} className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                                    </button>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => onView(lead)} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-primary hover:text-white transition-all">
                                            <Eye size={14} />
                                        </button>
                                        <button onClick={() => onEdit(lead)} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-primary hover:text-white transition-all">
                                            <Edit size={14} />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDelete(lead);
                                            }}
                                            className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-600 hover:bg-rose-600 hover:text-white transition-all"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
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
