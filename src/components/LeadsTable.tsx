import React from 'react';
import { Lead, LeadStatus, LeadCategory } from '@/types';
import { MapPin, Phone, MessageCircle, Edit2, Trash2 } from 'lucide-react';

interface LeadsTableProps {
    leads: Lead[];
    loading: boolean;
    userRole: 'admin' | 'teamLeader';
    onStatusChange: (lead: Lead, newStatus: LeadStatus) => void;
    onDelete: (lead: Lead) => void;
    onEdit: (lead: Lead) => void;
    showLocation: boolean; // Only for Admin
}

const LeadsTable: React.FC<LeadsTableProps> = ({
    leads,
    loading,
    userRole,
    // onStatusChange,
    onDelete,
    onEdit,
    showLocation
}) => {

    const getStatusColor = (status: LeadStatus) => {
        switch (status) {
            case 'New': return 'bg-blue-100 text-blue-700';
            case 'Convert': return 'bg-green-100 text-green-700';
            case 'Not Convert': return 'bg-gray-100 text-gray-700';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getCategoryBadge = (category: LeadCategory) => {
        switch (category) {
            case 'Genuine':
                return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-green-600 border border-green-200">GENUINE</span>;
            case 'Match':
                return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-200">MATCH</span>;
            case 'Duplicate':
                return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-600 border border-red-200">DUPLICATE</span>;
            default: return null;
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground">Loading leads...</div>;
    }

    if (leads.length === 0) {
        return <div className="p-8 text-center text-muted-foreground">No leads found.</div>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead className="bg-muted/50">
                    <tr>
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
                        <tr key={lead.id} className="hover:bg-muted/30 group">
                            <td className="px-4 py-3 text-sm font-medium text-foreground">
                                #{lead.leadId}
                            </td>
                            <td className="px-4 py-3">
                                <div className="font-semibold text-sm">{lead.riderName}</div>
                                <div className="flex items-center gap-2 mt-1">
                                    <a
                                        href={`tel:${lead.mobileNumber}`}
                                        className="p-1 bg-green-50 text-green-600 rounded hover:bg-green-100 transition-colors"
                                        title="Call"
                                    >
                                        <Phone size={14} />
                                    </a>
                                    <a
                                        href={`https://wa.me/${lead.mobileNumber.replace('+', '')}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="p-1 bg-green-50 text-green-600 rounded hover:bg-green-100 transition-colors"
                                        title="WhatsApp"
                                    >
                                        <MessageCircle size={14} />
                                    </a>
                                    <span className="text-xs text-muted-foreground">{lead.mobileNumber}</span>
                                </div>
                            </td>
                            <td className="px-4 py-3 text-sm">
                                <div className="text-foreground">{lead.city}</div>
                                <div className="text-muted-foreground text-xs">{lead.source}</div>
                            </td>
                            <td className="px-4 py-3">
                                {getCategoryBadge(lead.category)}
                            </td>
                            <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded-md text-xs font-semibold ${getStatusColor(lead.status)}`}>
                                    {lead.status}
                                </span>
                            </td>
                            {showLocation && (
                                <td className="px-4 py-3">
                                    {lead.location && (
                                        <a
                                            href={`https://www.google.com/maps?q=${lead.location.lat},${lead.location.lng}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                                        >
                                            <MapPin size={14} />
                                            View Map
                                        </a>
                                    )}
                                </td>
                            )}
                            <td className="px-4 py-3 text-right">
                                <div className="flex justify-end items-center gap-2">
                                    {/* Simple Action Buttons for now, can be dropdown */}
                                    {userRole === 'admin' && (
                                        <button onClick={() => onDelete(lead)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                    <button onClick={() => onEdit(lead)} className="text-blue-500 hover:bg-blue-50 p-1 rounded">
                                        <Edit2 size={16} />
                                    </button>
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
