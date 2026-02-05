import { Lead, LeadStatus } from '@/types';
import { MapPin, Phone, MessageCircle, Edit2, Trash2, CheckSquare, Square, RefreshCw } from 'lucide-react';

interface LeadsTableProps {
    leads: Lead[];
    loading: boolean;
    userRole: 'admin' | 'teamLeader';
    onStatusChange: (lead: Lead, newStatus: LeadStatus) => void;
    onDelete: (lead: Lead) => void;
    onEdit: (lead: Lead) => void;
    onView?: (lead: Lead) => void;
    showLocation: boolean; // Only for Admin
    permissions?: {
        edit?: boolean;
        delete?: boolean;
        statusChange?: boolean;
    };
    // Bulk Selection Props
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

    const getStatusColor = (status: LeadStatus) => {
        switch (status) {
            case 'New': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'Convert': return 'bg-green-100 text-green-700 border-green-200';
            case 'Not Convert': return 'bg-gray-100 text-gray-700 border-gray-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const getCategoryBadge = (lead: Lead) => {
        const category = getLeadAIStatus ? getLeadAIStatus(lead) : lead.category;

        if (typeof category === 'object' && category !== null) return null;
        switch (category) {
            case 'Genuine': return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-green-600 border border-green-200">GENUINE</span>;
            case 'Match': return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-600 border border-red-200">MATCH</span>;
            case 'Duplicate': return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200">DUPLICATE</span>;
            default: return null;
        }
    };

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading leads...</div>;
    if (leads.length === 0) return <div className="p-8 text-center text-muted-foreground">No leads found.</div>;

    const allSelected = leads.length > 0 && selectedIds.size === leads.length;

    return (
        <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                    <tr>
                        <th className="px-4 py-3 w-[50px]">
                            {onToggleSelectAll && (
                                <button onClick={onToggleSelectAll} className="text-muted-foreground hover:text-foreground">
                                    {allSelected ? <CheckSquare size={18} className="text-primary" /> : <Square size={18} />}
                                </button>
                            )}
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-bold text-muted-foreground">Lead ID</th>
                        <th className="px-4 py-3 text-left text-sm font-bold text-muted-foreground">Rider</th>
                        <th className="px-4 py-3 text-left text-sm font-bold text-muted-foreground">Details</th>
                        <th className="px-4 py-3 text-left text-sm font-bold text-muted-foreground">Stats</th>
                        <th className="px-4 py-3 text-left text-sm font-bold text-muted-foreground">Status</th>
                        {showLocation && <th className="px-4 py-3 text-left text-sm font-bold text-muted-foreground">Location</th>}
                        <th className="px-4 py-3 text-right text-sm font-bold text-muted-foreground">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {leads.map((lead) => (
                        <tr key={lead.id} className="hover:bg-muted/30 group transition-colors">
                            <td className="px-4 py-3">
                                {onToggleSelect && (
                                    <button onClick={() => onToggleSelect(lead.id)} className="text-muted-foreground hover:text-primary">
                                        {selectedIds.has(lead.id) ? <CheckSquare size={18} className="text-primary" /> : <Square size={18} />}
                                    </button>
                                )}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-foreground">
                                {onView ? (
                                    <button onClick={() => onView(lead)} className="text-blue-600 hover:text-blue-800 hover:underline font-bold">
                                        #{String(lead.leadId || '')}
                                    </button>
                                ) : (
                                    <span>#{String(lead.leadId || '')}</span>
                                )}
                            </td>
                            <td className="px-4 py-3">
                                <div className="font-semibold text-sm">{String(lead.riderName || 'Unknown')}</div>
                                <div className="flex items-center gap-2 mt-1">
                                    <a href={`tel:${lead.mobileNumber}`} className="p-1 bg-green-50 text-green-600 rounded hover:bg-green-100 transition-colors" title="Call">
                                        <Phone size={14} />
                                    </a>
                                    <a href={`https://wa.me/${lead.mobileNumber.replace('+', '')}`} target="_blank" rel="noreferrer" className="p-1 bg-green-50 text-green-600 rounded hover:bg-green-100 transition-colors" title="WhatsApp">
                                        <MessageCircle size={14} />
                                    </a>
                                </div>
                            </td>
                            <td className="px-4 py-3 text-sm">
                                <div className="text-foreground">{typeof lead.city === 'string' ? lead.city : 'N/A'}</div>
                                <div className="text-muted-foreground text-xs">{typeof lead.source === 'string' ? lead.source : 'Unknown Source'}</div>
                            </td>
                            <td className="px-4 py-3">{getCategoryBadge(lead)}</td>
                            <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded-md text-xs font-semibold border ${getStatusColor(lead.status)}`}>
                                    {typeof lead.status === 'string' ? lead.status : String(lead.status || '')}
                                </span>
                            </td>
                            {showLocation && (
                                <td className="px-4 py-3">
                                    {lead.location && (
                                        <a href={`https://www.google.com/maps?q=${lead.location.lat},${lead.location.lng}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                                            <MapPin size={14} /> View Map
                                        </a>
                                    )}
                                </td>
                            )}
                            <td className="px-4 py-3 text-right">
                                <div className="flex justify-end items-center gap-2">
                                    {((userRole === 'admin' || permissions.statusChange)) && (
                                        <div className="relative group/status">
                                            <button className="text-muted-foreground hover:bg-muted p-1 rounded transition-colors" title="Change Status">
                                                <RefreshCw size={16} />
                                            </button>
                                            {/* Simple Custom Hover Dropdown to avoid Radix dependency issues */}
                                            <div className="absolute right-0 top-full mt-1 w-32 bg-white border border-border shadow-lg rounded-md hidden group-hover/status:block z-50">
                                                <div className="py-1">
                                                    {['New', 'Convert', 'Not Convert'].map((status) => (
                                                        <button
                                                            key={status}
                                                            onClick={() => onStatusChange(lead, status as LeadStatus)}
                                                            className={`block w-full text-left px-4 py-2 text-sm hover:bg-muted ${lead.status === status ? 'text-primary font-medium bg-primary/5' : 'text-foreground'}`}
                                                        >
                                                            {status}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {(userRole === 'admin' || permissions.edit) && (
                                        <button onClick={() => onEdit(lead)} className="text-blue-500 hover:bg-blue-50 p-1 rounded">
                                            <Edit2 size={16} />
                                        </button>
                                    )}
                                    {(userRole === 'admin' || permissions.delete) && (
                                        <button onClick={() => onDelete(lead)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default LeadsTable;
