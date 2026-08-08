import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lead, LeadStatus } from '@/types';
import {
    MoreVertical, Eye, Edit, Trash2, MapPin, ShieldCheck, AlertTriangle,
    Repeat, Sparkles, Phone, MessageCircle, Trash,
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
                    className="fixed w-60 bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border border-white/20 dark:border-slate-800/50 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] animate-in fade-in zoom-in-95 duration-200 overflow-hidden"
                    style={{
                        top: actionMenu.top > 0 ? `${actionMenu.top}px` : undefined,
                        bottom: actionMenu.top <= 0 ? `${Math.abs(actionMenu.top)}px` : undefined,
                        right: `${actionMenu.right}px`,
                        zIndex: 9999,
                        maxHeight: '70vh',
                        overflowY: 'auto',
                    }}
                    onClick={e => e.stopPropagation()}
                >
                    <div className="p-2 space-y-1">
                        <div className="px-4 py-2 mb-1 border-b border-border/50">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Manage Lead</p>
                            <p className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate mt-0.5">{activeLead.riderName}</p>
                        </div>

                        <button onClick={() => { setActionMenu(null); onView(activeLead); }} className="w-full text-left px-3 py-2.5 text-xs font-bold hover:bg-primary/10 hover:text-primary rounded-xl flex items-center gap-3 transition-all"><div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0"><Eye size={14} className="text-blue-500" /></div> View Details</button>
                        <button onClick={() => { setActionMenu(null); onEdit(activeLead); }} className="w-full text-left px-3 py-2.5 text-xs font-bold hover:bg-primary/10 hover:text-primary rounded-xl flex items-center gap-3 transition-all"><div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0"><Edit size={14} className="text-violet-500" /></div> Edit Lead</button>

                        <div className="h-[1px] bg-border/50 my-2" />
                        <div className="px-4 py-1.5 text-[10px] text-slate-400 font-black uppercase tracking-wider">Change Status</div>

                        <div className="grid grid-cols-1 gap-1">
                            {(['New', 'Convert', 'Not Convert'] as LeadStatus[]).map(status => (
                                <button key={status} onClick={() => { setActionMenu(null); onStatusChange(activeLead, status); }} disabled={activeLead.status === status}
                                    className={`w-full text-left px-3 py-2 text-xs font-bold rounded-xl flex items-center gap-3 transition-all ${activeLead.status === status ? 'opacity-40 cursor-not-allowed bg-slate-50 dark:bg-slate-800/50' : 'hover:bg-primary/10 hover:text-primary'}`}>
                                    <div className="w-2 h-2 rounded-full bg-slate-400" /> {status}
                                </button>
                            ))}
                        </div>

                        {onAIRecommend && (<>
                            <div className="h-[1px] bg-border/50 my-2" />
                            <button onClick={() => { setActionMenu(null); onAIRecommend(activeLead); }} className="w-full text-left px-3 py-2.5 text-xs font-bold hover:bg-amber-500/10 text-amber-600 rounded-xl flex items-center gap-3 transition-all"><div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0"><Sparkles size={14} /></div> AI Recommendations</button>
                        </>)}

                        <div className="h-[1px] bg-border/50 my-2" />
                        <button onClick={() => { setActionMenu(null); onDelete(activeLead); }} className="w-full text-left px-3 py-2.5 text-xs font-bold hover:bg-orange-500/10 text-orange-600 rounded-xl flex items-center gap-3 transition-all"><div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0"><Trash2 size={14} /></div> Soft Delete</button>
                        {onPermanentDelete && <button onClick={() => { setActionMenu(null); onPermanentDelete(activeLead); }} className="w-full text-left px-3 py-2.5 text-xs font-bold hover:bg-red-500/10 text-red-600 rounded-xl flex items-center gap-3 transition-all"><div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0"><Trash size={14} /></div> Permanent Delete</button>}
                    </div>
                </div>
            )}

            {/* ─── DESKTOP TABLE (md+) ─── */}
            <div className="hidden md:block">
                <div className="relative rounded-3xl border border-white/20 dark:border-slate-800/50 bg-white/40 dark:bg-slate-950/40 backdrop-blur-2xl shadow-2xl overflow-hidden group/table">
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full border-separate border-spacing-0">
                            <thead className="sticky top-0 z-20">
                                <tr className="bg-slate-50/40 dark:bg-slate-900/40 backdrop-blur-xl border-b border-white/10">
                                    <th className="px-6 py-5 w-12 border-b border-white/10 pl-8">
                                        <button onClick={handleSelectAll} className="text-slate-400 hover:text-primary transition-all active:scale-95">
                                            {selectedIds.length === leads.length && leads.length > 0 ? <CheckSquare size={18} className="text-primary" /> : <Square size={18} />}
                                        </button>
                                    </th>
                                    <th className="px-3 py-5 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-500/70 dark:text-slate-400/70 border-b border-white/10">ID</th>
                                    <th className="px-3 py-5 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-500/70 dark:text-slate-400/70 border-b border-white/10">Candidate Info</th>
                                    <th className="px-3 py-5 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-500/70 dark:text-slate-400/70 border-b border-white/10">Location / Source</th>
                                    <th className="px-3 py-5 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-500/70 dark:text-slate-400/70 border-b border-white/10">Assignee</th>
                                    <th className="px-3 py-5 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-500/70 dark:text-slate-400/70 border-b border-white/10">Status</th>
                                    <th className="px-3 py-5 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-500/70 dark:text-slate-400/70 border-b border-white/10">AI Verif.</th>
                                    <th className="px-3 py-5 text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-500/70 dark:text-slate-400/70 border-b border-white/10">Score</th>
                                    <th className="px-3 py-5 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-500/70 dark:text-slate-400/70 border-b border-white/10">GPS</th>
                                    <th className="px-3 py-5 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-500/70 dark:text-slate-400/70 border-b border-white/10">Registered</th>
                                    <th className="px-6 py-5 text-right text-[10px] font-black uppercase tracking-[0.2em] text-slate-500/70 dark:text-slate-400/70 border-b border-white/10 pr-8">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="relative">
                                <AnimatePresence mode="popLayout">
                                    {leads.map((lead, index) => {
                                        const isSelected = selectedIds.includes(lead.id);
                                        const category = getCategory(lead);

                                        return (
                                            <motion.tr
                                                key={lead.id}
                                                initial={{ opacity: 0, y: 15 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.98 }}
                                                transition={{
                                                    duration: 0.4,
                                                    delay: Math.min(index * 0.03, 0.3),
                                                    ease: [0.23, 1, 0.32, 1]
                                                }}
                                                onClick={() => onView(lead)}
                                                className={`
                                                    group relative transition-all duration-500 cursor-pointer
                                                    ${isSelected ? 'bg-primary/5' : 'hover:bg-white/60 dark:hover:bg-slate-800/40'}
                                                `}
                                            >
                                                <td className="px-6 py-4 relative pl-8" onClick={e => e.stopPropagation()}>
                                                    {/* Floating Hover Indicator */}
                                                    <div className="absolute left-2 top-2 bottom-2 w-1.5 bg-primary/0 group-hover:bg-primary rounded-full transition-all duration-500 opacity-0 group-hover:opacity-100 shadow-[0_0_15px_rgba(var(--primary),0.5)] scale-y-50 group-hover:scale-y-100" />

                                                    <button onClick={() => {
                                                        onSelectionChange(isSelected ? selectedIds.filter(x => x !== lead.id) : [...selectedIds, lead.id]);
                                                    }} className="text-slate-300 dark:text-slate-600 hover:text-primary transition-all">
                                                        {isSelected ? <CheckSquare size={18} className="text-primary" /> : <Square size={18} />}
                                                    </button>
                                                </td>
                                                <td className="px-3 py-4">
                                                    <span className="text-xs font-black text-slate-400/80 tracking-tighter">#{lead.leadId}</span>
                                                    <div className="text-[10px] text-slate-400/50 mt-0.5">
                                                        {lead.createdAt ? format(new Date(lead.createdAt), 'dd/MM') : '—'}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 via-indigo-500 to-blue-600 p-[1px] shadow-lg group-hover:rotate-6 transition-transform duration-500 flex-shrink-0">
                                                            <div className="w-full h-full rounded-[14px] bg-white dark:bg-slate-900 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-xs font-black">
                                                                {lead.riderName?.charAt(0)?.toUpperCase() || '?'}
                                                            </div>
                                                        </div>
                                                        <div className="min-w-0 transition-transform duration-500 group-hover:translate-x-1">
                                                            <p className="text-sm font-black text-slate-900 dark:text-slate-100 truncate max-w-[140px] tracking-tight">{lead.riderName}</p>
                                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                                <span className="text-[10px] font-mono font-bold text-slate-400">{lead.mobileNumber}</span>
                                                                <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                                                                    <a href={getCallLink(lead.mobileNumber)} className="p-1.5 bg-blue-500/10 hover:bg-blue-500 text-blue-600 hover:text-white rounded-lg transition-all duration-300 transform hover:scale-110 active:scale-90" title="Call"><Phone size={10} /></a>
                                                                    <a href={getWhatsAppLink(lead.mobileNumber)} target="_blank" rel="noreferrer" className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-600 hover:text-white rounded-lg transition-all duration-300 transform hover:scale-110 active:scale-90" title="WhatsApp"><MessageCircle size={10} /></a>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-4">
                                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300 tracking-tight">{lead.city || '—'}</p>
                                                    <div className="flex items-center gap-1 mt-0.5">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700" />
                                                        <p className="text-[10px] font-black uppercase text-slate-400/70 tracking-widest">{lead.source || 'Direct'}</p>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-4">
                                                    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/50 w-fit group-hover:bg-white dark:group-hover:bg-slate-800 transition-colors">
                                                        <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-orange-400 to-rose-500 flex items-center justify-center text-white text-[9px] font-black flex-shrink-0 shadow-sm">
                                                            {(lead.createdByName || 'A')?.charAt(0)?.toUpperCase()}
                                                        </div>
                                                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate max-w-[90px]">{lead.createdByName || 'Admin'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-4" onClick={e => e.stopPropagation()}>
                                                    <StatusDropdown lead={lead} onStatusChange={onStatusChange} />
                                                </td>
                                                <td className="px-3 py-4" onClick={e => e.stopPropagation()}>
                                                    <AiBadge
                                                        category={category}
                                                        onClick={onAIStatusClick ? () => onAIStatusClick(lead, category as 'Genuine' | 'Duplicate' | 'Match') : undefined}
                                                    />
                                                </td>
                                                <td className="px-3 py-4 text-center"><ScoreBadge score={lead.score} /></td>
                                                <td className="px-3 py-4">
                                                    {lead.location ? (
                                                        <button
                                                            onClick={e => { e.stopPropagation(); window.open(`https://www.google.com/maps?q=${lead.location.lat},${lead.location.lng}`, '_blank'); }}
                                                            className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-blue-600 hover:text-white px-3 py-1.5 bg-blue-500/10 hover:bg-blue-600 rounded-xl transition-all active:scale-95 shadow-sm"
                                                        >
                                                            <MapPin size={10} /> View
                                                        </button>
                                                    ) : <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 dark:text-slate-700">None</span>}
                                                </td>
                                                <td className="px-3 py-4">
                                                    <span className="text-[11px] font-black text-slate-400/60 uppercase tracking-tighter">{lead.createdAt ? format(new Date(lead.createdAt), 'dd MMM yy') : '—'}</span>
                                                </td>
                                                <td className="px-3 py-4 text-right pr-8" onClick={e => e.stopPropagation()}>
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button onClick={() => onView(lead)} className="p-2 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-500/10 transform hover:scale-110 active:scale-90 transition-all" title="View"><Eye size={15} /></button>
                                                        <button onClick={() => onEdit(lead)} className="p-2 rounded-xl text-slate-400 hover:text-violet-600 hover:bg-violet-500/10 transform hover:scale-110 active:scale-90 transition-all" title="Edit"><Edit size={15} /></button>
                                                        <button
                                                            onClick={e => {
                                                                const rect = e.currentTarget.getBoundingClientRect();
                                                                const spaceBelow = window.innerHeight - rect.bottom;
                                                                const menuHeight = 400; // approximate menu height
                                                                const top = spaceBelow >= menuHeight
                                                                    ? rect.bottom + 8 // open below
                                                                    : -(window.innerHeight - rect.top + 8); // negative = use 'bottom' instead
                                                                setActionMenu(actionMenu?.id === lead.id ? null : { id: lead.id, top, right: window.innerWidth - rect.right });
                                                            }}
                                                            className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-500/10 transform hover:scale-110 active:scale-90 transition-all"
                                                        ><MoreVertical size={15} /></button>
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        );
                                    })}
                                </AnimatePresence>
                            </tbody>
                        </table>
                    </div>
                </div>
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
                                        onClick={onAIStatusClick ? () => onAIStatusClick(lead, category as 'Genuine' | 'Duplicate' | 'Match') : undefined}
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
