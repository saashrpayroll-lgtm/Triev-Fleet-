import React from 'react';
import { Lead, LeadStatus } from '@/types';
import {
    MoreVertical,
    Eye,
    Edit,
    Trash2,
    MapPin,
    ShieldCheck,
    AlertTriangle,
    Repeat,
    Sparkles,
    Phone,
    MessageCircle,
    RotateCw,
    Trash
} from 'lucide-react';
import { format } from 'date-fns';

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

// ... imports ...

const AdminLeadTable: React.FC<AdminLeadTableProps> = ({
    leads,
    loading,
    selectedIds,
    onSelectionChange,
    onStatusChange,
    onView,
    onEdit,
    onDelete,
    onPermanentDelete,
    onAIRecommend,
    getLeadAIStatus,
    onAIStatusClick
}) => {
    // State for fixed position menu
    const [actionMenu, setActionMenu] = React.useState<{ id: string, top: number, right: number } | null>(null);

    // Close dropdown when clicking outside
    React.useEffect(() => {
        const handleClickOutside = () => setActionMenu(null);
        window.addEventListener('click', handleClickOutside);
        window.addEventListener('scroll', handleClickOutside, true); // Close on scroll too
        return () => {
            window.removeEventListener('click', handleClickOutside);
            window.removeEventListener('scroll', handleClickOutside, true);
        };
    }, []);

    const handleSelectAll = () => {
        if (selectedIds.length === leads.length && leads.length > 0) {
            onSelectionChange([]);
        } else {
            onSelectionChange(leads.map(l => l.id));
        }
    };

    const handleSelectOne = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
        e.stopPropagation();
        if (selectedIds.includes(id)) {
            onSelectionChange(selectedIds.filter(selectedId => selectedId !== id));
        } else {
            onSelectionChange([...selectedIds, id]);
        }
    };

    const getScoreColor = (score?: number) => {
        if (!score) return 'bg-gray-100 text-gray-700';
        if (score >= 80) return 'bg-green-100 text-green-700 border-green-200';
        if (score >= 50) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
        return 'bg-red-100 text-red-700 border-red-200';
    };

    const getCategoryBadge = (lead: Lead) => {
        // Use dynamic AI status if function provided, else fallback to lead.category
        const category = getLeadAIStatus ? getLeadAIStatus(lead) : lead.category;

        const baseClasses = "flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold transition-all";
        const clickableClasses = onAIStatusClick ? "cursor-pointer hover:ring-2 hover:ring-offset-1" : "";

        switch (category) {
            case 'Genuine':
                return (
                    <span
                        onClick={() => onAIStatusClick?.(lead, 'Genuine')}
                        className={`${baseClasses} ${clickableClasses} bg-emerald-100 text-emerald-700 border border-emerald-200 hover:ring-emerald-300`}
                    >
                        <ShieldCheck size={12} /> Genuine
                    </span>
                );
            case 'Match':
                return (
                    <span
                        onClick={() => onAIStatusClick?.(lead, 'Match')}
                        className={`${baseClasses} ${clickableClasses} bg-red-100 text-red-700 border border-red-200 hover:ring-red-300`}
                    >
                        <Repeat size={12} /> Match
                    </span>
                );
            case 'Duplicate':
                return (
                    <span
                        onClick={() => onAIStatusClick?.(lead, 'Duplicate')}
                        className={`${baseClasses} ${clickableClasses} bg-amber-100 text-amber-700 border border-amber-200 hover:ring-amber-300`}
                    >
                        <AlertTriangle size={12} /> Duplicate
                    </span>
                );
            default:
                return (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        {String(category || 'Unknown')}
                    </span>
                );
        }
    };

    // Find active lead for menu
    const activeLead = actionMenu ? leads.find(l => l.id === actionMenu.id) : null;

    if (loading) {
        return (
            <div className="p-12 flex justify-center text-muted-foreground">
                <div className="flex flex-col items-center gap-2">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p>Analyzing Leads...</p>
                </div>
            </div>
        );
    }

    if (leads.length === 0) {
        return (
            <div className="p-12 text-center text-muted-foreground">
                <p>No leads found matching current filters.</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto min-h-[400px]">
            {/* Render Menu Portal-like */}
            {actionMenu && activeLead && (
                <div
                    className="fixed w-48 bg-popover border border-border rounded-lg shadow-xl animate-in fade-in zoom-in-95 duration-100"
                    style={{
                        top: `${actionMenu.top}px`,
                        right: `${actionMenu.right}px`,
                        zIndex: 9999
                    }}
                    onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
                >
                    <div className="py-1">
                        <button
                            onClick={() => { setActionMenu(null); onView(activeLead); }}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-accent flex items-center gap-2"
                        >
                            <Eye size={14} className="text-muted-foreground" /> View Lead
                        </button>
                        <button
                            onClick={() => { setActionMenu(null); onEdit(activeLead); }}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-accent flex items-center gap-2"
                        >
                            <Edit size={14} className="text-muted-foreground" /> Edit Lead
                        </button>

                        <div className="border-t border-border/50 my-1" />

                        <div className="px-4 py-1.5 text-xs text-muted-foreground font-semibold">Change Status</div>
                        {(['New', 'Convert', 'Not Convert'] as LeadStatus[]).map(status => (
                            <button
                                key={status}
                                onClick={() => { setActionMenu(null); onStatusChange(activeLead, status); }}
                                disabled={activeLead.status === status}
                                className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 ${activeLead.status === status ? 'opacity-50 cursor-not-allowed bg-accent/50' : 'hover:bg-accent'}`}
                            >
                                <RotateCw size={14} className={activeLead.status === status ? 'animate-spin' : ''} />
                                {status}
                            </button>
                        ))}

                        <div className="border-t border-border/50 my-1" />

                        <button
                            onClick={() => { setActionMenu(null); onAIRecommend?.(activeLead); }}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-accent flex items-center gap-2 text-amber-600"
                        >
                            <Sparkles size={14} /> AI Recommendations
                        </button>

                        <div className="border-t border-border/50 my-1" />

                        <button
                            onClick={() => { setActionMenu(null); onDelete(activeLead); }}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 text-orange-600 flex items-center gap-2"
                        >
                            <Trash2 size={14} /> Soft Delete
                        </button>
                        {onPermanentDelete && (
                            <button
                                onClick={() => { setActionMenu(null); onPermanentDelete(activeLead); }}
                                className="w-full text-left px-4 py-2 text-sm hover:bg-red-100 text-red-600 flex items-center gap-2"
                            >
                                <Trash size={14} /> Permanent Delete
                            </button>
                        )}
                    </div>
                </div>
            )}

            <table className="w-full">
                <thead className="bg-muted/30 border-b border-border/50">
                    <tr>
                        <th className="px-6 py-4 text-left w-[50px]">
                            <input
                                type="checkbox"
                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                checked={leads.length > 0 && selectedIds.length === leads.length}
                                onChange={handleSelectAll}
                            />
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Lead ID</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Mobile</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">City</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Team Leader</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Stats</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Score</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">GPS</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Created</th>
                        <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border/50 bg-card">
                    {leads.map((lead) => (
                        <tr key={lead.id} className={`group transition-all duration-200 ${selectedIds.includes(lead.id) ? 'bg-indigo-50/50 hover:bg-indigo-50' : 'hover:bg-muted/30'}`}>
                            <td className="px-6 py-4">
                                <input
                                    type="checkbox"
                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                    checked={selectedIds.includes(lead.id)}
                                    onChange={(e) => handleSelectOne(lead.id, e)}
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </td>
                            <td className="px-4 py-3 text-sm font-medium">#{lead.leadId}</td>
                            <td className="px-4 py-3 text-sm font-semibold text-foreground/80">{lead.riderName}</td>
                            <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-mono">{lead.mobileNumber}</span>
                                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                        <a href={`tel:${lead.mobileNumber}`} className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-md transition-colors border border-blue-200" title="Call">
                                            <Phone size={14} />
                                        </a>
                                        <a href={`https://wa.me/91${lead.mobileNumber.replace(/\D/g, '').slice(-10)}`} target="_blank" rel="noreferrer" className="p-1.5 bg-green-50 hover:bg-green-100 text-green-600 rounded-md transition-colors border border-green-200" title="WhatsApp">
                                            <MessageCircle size={14} />
                                        </a>
                                    </div>
                                </div>
                            </td>
                            <td className="px-4 py-3 text-sm">{lead.city}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                                {lead.createdByName || <span className="text-gray-400 italic">Self/Admin</span>}
                            </td>
                            <td className="px-4 py-3">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${lead.status === 'New' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                    lead.status === 'Convert' ? 'bg-green-50 text-green-700 border-green-200' :
                                        'bg-gray-100 text-gray-700 border-gray-200'
                                    }`}>
                                    {lead.status}
                                </span>
                            </td>
                            <td className="px-4 py-3">
                                {getCategoryBadge(lead)}
                            </td>
                            <td className="px-4 py-3">
                                {lead.score !== undefined && (
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getScoreColor(lead.score)}`}>
                                        {lead.score}
                                    </span>
                                )}
                            </td>
                            <td className="px-4 py-3">
                                {lead.location ? (
                                    <button
                                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:underline"
                                        onClick={() => window.open(`https://www.google.com/maps?q=${lead.location.lat},${lead.location.lng}`, '_blank')}
                                    >
                                        <MapPin size={12} /> View
                                    </button>
                                ) : (
                                    <span className="text-xs text-muted-foreground">N/A</span>
                                )}
                            </td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">
                                {format(new Date(lead.createdAt), 'dd/MM/yyyy')}
                            </td>
                            <td className="px-4 py-3 text-right">
                                <button
                                    className="p-1.5 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        if (actionMenu?.id === lead.id) {
                                            setActionMenu(null);
                                        } else {
                                            // Position logic: Top = button bottom. Right = window width - button right.
                                            setActionMenu({
                                                id: lead.id,
                                                top: rect.bottom + 4,
                                                right: window.innerWidth - rect.right
                                            });
                                        }
                                    }}
                                >
                                    <MoreVertical size={16} />
                                </button>
                                {/* Dropdown Removed from here */}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default AdminLeadTable;
