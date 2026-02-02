import React, { useState, useEffect } from 'react';
import { supabase } from '@/config/supabase';
import { Request, RequestStatus, Rider } from '@/types';
import { useNavigate, useLocation } from 'react-router-dom';
import { XCircle, Clock, FileText, MessageSquare, Sparkles, Send, User, Phone, Wallet, Trash2, CheckSquare, Square } from 'lucide-react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { AIService } from '@/services/AIService';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { logActivity } from '@/utils/activityLog';
import { DEFAULT_RESET_PASSWORD } from '@/utils/passwordUtils';

const RequestManagement: React.FC = () => {
    const [requests, setRequests] = useState<Request[]>([]);
    const [loading, setLoading] = useState(true);
    const { userData: currentUser } = useSupabaseAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // Tabs
    const [activeTab, setActiveTab] = useState<'active' | 'history' | 'trash'>('active');
    const [filterStatus, setFilterStatus] = useState<RequestStatus | 'all'>('all');

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const status = params.get('status') as RequestStatus;
        if (status) {
            setFilterStatus(status);
            if (['resolved', 'rejected'].includes(status)) {
                setActiveTab('history');
            } else {
                setActiveTab('active');
            }
        }
    }, [location.search]);

    // Resolution Modal
    const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
    const [linkedRider, setLinkedRider] = useState<Rider | null>(null);

    // Resolution Form
    const [resolutionNote, setResolutionNote] = useState('');
    const [internalNote, setInternalNote] = useState('');
    const [resolutionStatus, setResolutionStatus] = useState<RequestStatus>('resolved');
    const [aiLoading, setAiLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [error, setError] = useState<string | null>(null);

    // Selection State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());


    const fetchRequests = async () => {
        setLoading(true);
        try {
            let query = supabase.from('requests').select(`
                id,
                ticketId:ticket_id,
                type,
                subject,
                description,
                priority,
                userId:user_id,
                userName:user_name,
                email,
                userRole:user_role,
                status,
                createdAt:created_at,
                updatedAt:updated_at,
                relatedEntityId:related_entity_id,
                relatedEntityName:related_entity_name,
                relatedEntityType:related_entity_type,
                resolvedAt:resolved_at,
                resolvedBy:resolved_by,
                adminResponse:admin_response,
                timeline,
                internalNotes:internal_notes
            `);

            if (activeTab === 'trash') {
                query = query.eq('status', 'deleted');
            } else {
                query = query.neq('status', 'deleted').neq('status', 'purged');
            }

            const { data, error } = await query.order('created_at', { ascending: false });

            if (error) throw error;
            setRequests((data || []) as Request[]);
        } catch (err: any) {
            console.error("Error fetching requests:", err);
            setError('Failed to load requests.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();

        const channel = supabase
            .channel('admin-requests-all')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'requests' },
                () => {
                    fetchRequests();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [activeTab]);

    // Filter Logic based on Tabs and specific Status Parameter
    const filteredRequests = requests.filter(req => {
        if (activeTab === 'trash') {
            return req.status === 'deleted';
        }

        const matchesTab = activeTab === 'active'
            ? ['pending', 'in_progress', 'waiting_for_info'].includes(req.status)
            : ['resolved', 'rejected'].includes(req.status);

        const matchesStatus = filterStatus === 'all' || req.status === filterStatus;

        return matchesTab && matchesStatus;
    });

    const handleOpenResolution = async (request: Request) => {
        setSelectedRequest(request);
        setResolutionStatus(request.status === 'pending' ? 'in_progress' : request.status);
        setResolutionNote('');
        setInternalNote('');
        setLinkedRider(null);

        // Fetch related rider if applicable
        if (request.relatedEntityId && request.relatedEntityType === 'rider') {
            try {
                const { data } = await supabase
                    .from('riders')
                    .select(`
                        id, 
                        trievId:triev_id, 
                        riderName:rider_name, 
                        mobileNumber:mobile_number, 
                        walletAmount:wallet_amount, 
                        status
                    `)
                    .eq('id', request.relatedEntityId)
                    .single();

                if (data) {
                    setLinkedRider(data as any);
                }
            } catch (e) {
                console.error("Error fetching rider details", e);
            }
        }
    };

    const generateAiResponse = async () => {
        if (!selectedRequest) return;
        setAiLoading(true);
        try {
            const suggestion = await AIService.generateResolutionSuggestion(selectedRequest);
            setResolutionNote(suggestion);
        } catch (e) {
            console.error(e);
        } finally {
            setAiLoading(false);
        }
    };

    const handleResetPassword = async () => {
        if (!selectedRequest?.userId) {
            toast.error("No User ID found for this request.");
            return;
        }

        if (!confirm(`Are you sure you want to reset the password to "${DEFAULT_RESET_PASSWORD}"?`)) return;

        setSubmitting(true);
        try {
            // 1. Attempt to reset password via Custom RPC (Secure Database Function)
            // This bypasses the need for Service Role Key on frontend
            const { error: rpcError } = await supabase.rpc('admin_reset_password_v2', {
                target_user_id: selectedRequest.userId,
                new_password: DEFAULT_RESET_PASSWORD
            });

            if (rpcError) {
                console.error("RPC Error:", rpcError);
                toast.error("Failed to reset password: " + rpcError.message);
                setSubmitting(false);
                return;
            }

            // 2. Auto-Resolve the ticket
            setResolutionStatus('resolved');
            setResolutionNote(`Password reset to default ("${DEFAULT_RESET_PASSWORD}") by Admin.`);

            // Construct payload for resolution
            const newTimelineEvent = {
                status: 'resolved',
                remark: `Password reset to default ("${DEFAULT_RESET_PASSWORD}") by Admin.`,
                timestamp: new Date().toISOString(),
                updatedBy: currentUser?.email || 'Admin',
                role: 'admin' as const
            };

            const updatedTimeline = [...(selectedRequest.timeline || []), newTimelineEvent];

            const { error: updateError } = await supabase
                .from('requests')
                .update({
                    status: 'resolved',
                    admin_response: `Password has been reset to: ${DEFAULT_RESET_PASSWORD}\nPlease login and change it immediately.`,
                    timeline: updatedTimeline,
                    resolved_at: new Date().toISOString(),
                    resolved_by: currentUser?.email || 'Admin',
                    updated_at: new Date().toISOString()
                })
                .eq('id', selectedRequest.id);

            if (updateError) throw updateError;

            // Update local state
            setRequests(prev => prev.map(r => r.id === selectedRequest.id ? {
                ...r,
                status: 'resolved',
                adminResponse: `Password has been reset to: ${DEFAULT_RESET_PASSWORD}\nPlease login and change it immediately.`,
                resolvedAt: new Date().toISOString(),
                resolvedBy: currentUser?.email,
                timeline: updatedTimeline
            } as Request : r));

            toast.success("Password reset successfully & Ticket Resolved!");
            setSelectedRequest(null);

            // Log activity
            await logActivity({
                actionType: 'Ticket Resolved',
                targetType: 'request',
                targetId: selectedRequest.id,
                details: `Reset password & Resolved ticket #${selectedRequest.ticketId || selectedRequest.id.slice(0, 6)}`,
                performedBy: currentUser?.email
            }).catch(console.error);

        } catch (e: any) {
            console.error("Reset Password Failed:", e);
            toast.error(e.message || "Failed to reset password");
        } finally {
            setSubmitting(false);
        }
    };

    const submitResolution = async () => {
        if (!selectedRequest || !currentUser || !resolutionNote) {
            toast.warning("Please enter a response/comment.");
            return;
        }

        setSubmitting(true);
        try {
            const newTimelineEvent = {
                status: resolutionStatus,
                remark: resolutionNote,
                timestamp: new Date().toISOString(),
                updatedBy: currentUser.email || 'Admin',
                role: 'admin' as const
            };

            // Ensure timeline is an array
            const currentTimeline = Array.isArray(selectedRequest.timeline) ? selectedRequest.timeline : [];
            const updatedTimeline = [...currentTimeline, newTimelineEvent];

            const updatePayload: any = {
                status: resolutionStatus,
                admin_response: resolutionNote,
                internal_notes: internalNote,
                timeline: updatedTimeline,
                updated_at: new Date().toISOString()
            };

            if (resolutionStatus === 'resolved') {
                updatePayload.resolved_at = new Date().toISOString();
                updatePayload.resolved_by = currentUser.email || 'Admin';
            } else if ((selectedRequest.status as string) === 'resolved') {
                // If reopening a resolved ticket, clear resolution details
                updatePayload.resolved_at = null;
                updatePayload.resolved_by = null;
            }

            const { error } = await supabase
                .from('requests')
                .update(updatePayload)
                .eq('id', selectedRequest.id);

            if (error) throw error;

            // Update local state
            setRequests(prev => prev.map(r => r.id === selectedRequest.id ? {
                ...r,
                ...updatePayload,
                // Adjust timestamp for local display if needed, keeping string or Date object consistency
                // Supabase returns strings, but if type expects Timestamp objects we might need conversion or type update
                // For now assuming Type is compatible or we use strings.
            } as Request : r));

            setSelectedRequest(null);

            // Redirect if needed
            if (selectedRequest.type === 'password_reset' && resolutionStatus === 'resolved') {
                if (confirm("Request resolved. Do you want to go to the User page?")) {
                    // Navigate to the correct path for User Management
                    navigate('/portal/users', { state: { highlightUserId: selectedRequest.userId } });
                }
            }
            toast.success("Request updated successfully.");

            // Log activity
            await logActivity({
                actionType: (resolutionStatus === 'resolved' || resolutionStatus === 'rejected') ? 'Ticket Resolved' : 'Ticket Updated',
                targetType: 'request',
                targetId: selectedRequest.id,
                details: `${resolutionStatus === 'resolved' ? 'Resolved' : 'Updated'} ticket #${selectedRequest.ticketId || selectedRequest.id.slice(0, 6)}: ${resolutionStatus}`,
                performedBy: currentUser.email
            }).catch(console.error);

        } catch (error) {
            console.error("Failed to update:", error);
            toast.error("Error updating request.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this request?')) return;
        try {
            // Soft delete by updating status
            const { error } = await supabase
                .from('requests')
                .update({ status: 'deleted', updated_at: new Date().toISOString() })
                .eq('id', id);

            if (error) throw error;

            // Log activity
            await logActivity({
                actionType: 'Ticket Deleted',
                targetType: 'request',
                targetId: id,
                details: `Moved ticket to trash.`,
                performedBy: currentUser?.email
            }).catch(console.error);

            setRequests(prev => prev.filter(r => r.id !== id));
            setSelectedIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(id);
                return newSet;
            });
        } catch (error: any) {
            console.error("Error deleting request:", error);
            toast.error("Failed to move to trash: " + (error?.message || "Unknown error"));
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;

        const isTrash = activeTab === 'trash';
        const msg = isTrash
            ? `Are you sure you want to PERMANENTLY delete ${selectedIds.size} requests? This cannot be undone.`
            : `Are you sure you want to move ${selectedIds.size} requests to Trash?`;

        if (!confirm(msg)) return;

        try {
            let error;
            if (isTrash) {
                // Hard Delete Replacement: Purge (Update status to 'purged')
                // This bypasses RLS 'DELETE' restriction
                const res = await supabase
                    .from('requests')
                    .update({ status: 'purged', updated_at: new Date().toISOString() })
                    .in('id', Array.from(selectedIds));
                error = res.error;
            } else {
                // Soft delete
                const res = await supabase
                    .from('requests')
                    .update({ status: 'deleted', updated_at: new Date().toISOString() })
                    .in('id', Array.from(selectedIds));
                error = res.error;
            }

            if (error) throw error;

            // Log activity
            await logActivity({
                actionType: isTrash ? 'Ticket Purged' : 'Ticket Deleted',
                targetType: 'request',
                targetId: 'multiple',
                details: `${isTrash ? 'Permanently deleted' : 'Moved to trash'} ${selectedIds.size} requests.`,
                performedBy: currentUser?.email
            }).catch(console.error);

            setRequests(prev => prev.filter(r => !selectedIds.has(r.id)));
            setSelectedIds(new Set());
            toast.success(`Successfully ${isTrash ? 'deleted' : 'moved to trash'} ${selectedIds.size} requests.`);
        } catch (error: any) {
            console.error("Error bulk deleting:", error);
            toast.error("Failed to delete requests: " + (error?.message || "Unknown error"));
        }
    };

    const handlePermanentDelete = async (id: string) => {
        if (!confirm('PERMANENTLY DELETE? This cannot be undone.')) return;
        try {
            // "Purge" by updating status to 'purged' (since DELETE is RLS blocked)
            const { error } = await supabase
                .from('requests')
                .update({ status: 'purged', updated_at: new Date().toISOString() })
                .eq('id', id);

            if (error) throw error;

            // Log activity
            await logActivity({
                actionType: 'Ticket Purged',
                targetType: 'request',
                targetId: id,
                details: `Permanently deleted ticket.`,
                performedBy: currentUser?.email
            }).catch(console.error);

            setRequests(prev => prev.filter(r => r.id !== id));
            toast.success("Request permanently deleted.");
        } catch (e: any) {
            console.error("Permanent Delete Error:", e);
            toast.error(`Failed to delete. Code: ${e.code || 'N/A'} - ${e.message}`);
        }
    };

    const handleRestore = async (id: string) => {
        try {
            const { error } = await supabase
                .from('requests')
                .update({ status: 'pending', updated_at: new Date().toISOString() })
                .eq('id', id);
            if (error) throw error;

            // Log activity
            await logActivity({
                actionType: 'Ticket Restored',
                targetType: 'request',
                targetId: id,
                details: `Restored ticket from trash.`,
                performedBy: currentUser?.email
            }).catch(console.error);

            setRequests(prev => prev.filter(r => r.id !== id));
        } catch (e) {
            console.error(e);
            toast.error("Failed to restore request.");
        }
    };

    const toggleSelection = (id: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredRequests.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredRequests.map(r => r.id)));
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'waiting_for_info': return 'bg-purple-100 text-purple-800 border-purple-200';
            case 'resolved': return 'bg-green-100 text-green-800 border-green-200';
            case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
            case 'deleted': return 'bg-gray-300 text-gray-800 border-gray-400';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Request Management</h1>
                    <p className="text-muted-foreground mt-1">Unified ticketing system for User & Rider issues</p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    {selectedIds.size > 0 && (
                        <button
                            onClick={handleBulkDelete}
                            className="flex items-center gap-2 px-3 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors animate-in fade-in slide-in-from-right-5"
                        >
                            <Trash2 size={16} />
                            <span className="text-sm font-medium">
                                {activeTab === 'trash' ? 'Delete Permanently' : 'Move to Trash'} ({selectedIds.size})
                            </span>
                        </button>
                    )}

                    {/* Tabs */}
                    <div className="flex p-1 bg-muted rounded-lg overflow-x-auto max-w-[100vw] sm:max-w-auto">
                        <button
                            onClick={() => { setActiveTab('active'); setSelectedIds(new Set()); }}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'active' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            Active Requests
                            {requests.filter(r => ['pending', 'in_progress', 'waiting_for_info'].includes(r.status)).length > 0 && (
                                <span className="ml-2 bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-full">
                                    {requests.filter(r => ['pending', 'in_progress', 'waiting_for_info'].includes(r.status)).length}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => { setActiveTab('history'); setSelectedIds(new Set()); }}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'history' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            Resolved / History
                        </button>
                        <button
                            onClick={() => { setActiveTab('trash'); setSelectedIds(new Set()); }}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${activeTab === 'trash' ? 'bg-red-50 text-red-700 shadow border border-red-100' : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            <Trash2 size={14} />
                            Trash Bin
                        </button>
                    </div>
                </div>
            </div>

            {error && <div className="p-4 bg-red-50 text-red-600 rounded-md border border-red-200">{error}</div>}

            <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-muted/50 border-b border-border">
                            <tr>
                                <th className="px-4 py-3 w-[50px]">
                                    <button
                                        onClick={toggleSelectAll}
                                        className="text-muted-foreground hover:text-foreground"
                                    >
                                        {selectedIds.size > 0 && selectedIds.size === filteredRequests.length ? (
                                            <CheckSquare size={18} className="text-primary" />
                                        ) : (
                                            <Square size={18} />
                                        )}
                                    </button>
                                </th>
                                <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground">Status</th>
                                <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground">Priority</th>
                                <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground">Type</th>
                                <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground">Subject</th>
                                <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground">Last Update</th>
                                <th className="px-6 py-3 text-right text-sm font-semibold text-muted-foreground">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filteredRequests.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-12 text-muted-foreground">
                                        No requests found in this tab.
                                    </td>
                                </tr>
                            ) : (
                                filteredRequests.map((req) => (
                                    <tr key={req.id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-4">
                                            <button
                                                onClick={() => toggleSelection(req.id)}
                                                className="text-muted-foreground hover:text-primary transition-colors block"
                                            >
                                                {selectedIds.has(req.id) ? (
                                                    <CheckSquare size={18} className="text-primary" />
                                                ) : (
                                                    <Square size={18} />
                                                )}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium uppercase border ${getStatusColor(req.status)}`}>
                                                {req.status?.replace(/_/g, ' ')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`text-xs font-bold uppercase ${req.priority === 'high' ? 'text-red-600' :
                                                req.priority === 'medium' ? 'text-orange-500' : 'text-green-600'
                                                }`}>
                                                {req.priority}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium">{req.type?.replace('_', ' ')}</td>
                                        <td className="px-6 py-4">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                                        #{req.ticketId || req.id.slice(0, 6)}
                                                    </span>
                                                    <p className="font-semibold text-sm">{req.subject}</p>
                                                </div>
                                                <p className="text-xs text-muted-foreground">by {req.userName || req.email}</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-muted-foreground">
                                            {req.updatedAt ? format(new Date(req.updatedAt as any), 'MMM dd, HH:mm') : 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => activeTab === 'trash' ? handlePermanentDelete(req.id) : handleDelete(req.id)}
                                                    className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                    title={activeTab === 'trash' ? "Delete Permanently" : "Move to Trash"}
                                                >
                                                    <Trash2 size={16} />
                                                </button>

                                                {activeTab === 'trash' && (
                                                    <button
                                                        onClick={() => handleRestore(req.id)}
                                                        className="p-1.5 text-muted-foreground hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                                                        title="Restore"
                                                    >
                                                        <Sparkles size={16} />
                                                    </button>
                                                )}

                                                {activeTab !== 'trash' && (
                                                    <button
                                                        onClick={() => handleOpenResolution(req)}
                                                        className="px-3 py-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-md text-sm font-medium transition-colors"
                                                    >
                                                        Manage
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Enhanced Resolution Modal */}
            {selectedRequest && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-background rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col md:flex-row">

                        {/* Left: Details Panel */}
                        <div className="md:w-1/2 p-6 overflow-y-auto border-r border-border bg-muted/10">
                            <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
                                <FileText className="text-primary" />
                                Ticket Details
                            </h2>

                            <div className="space-y-4">
                                <div className="p-4 bg-background border rounded-lg shadow-sm">
                                    <h3 className="font-semibold text-lg">{selectedRequest.subject}</h3>
                                    <div className="flex gap-2 mt-2">
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${getStatusColor(selectedRequest.status)}`}>
                                            {selectedRequest.status.replace(/_/g, ' ')}
                                        </span>
                                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-muted uppercase border">
                                            {selectedRequest.type.replace(/_/g, ' ')}
                                        </span>
                                    </div>
                                    <p className="mt-4 text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                                        {selectedRequest.description}
                                    </p>
                                    <div className="mt-4 pt-4 border-t flex justify-between text-xs text-muted-foreground">
                                        <span>User: {selectedRequest.userName || selectedRequest.email}</span>
                                        <span>{selectedRequest.createdAt ? new Date(selectedRequest.createdAt as any).toLocaleString() : ''}</span>
                                    </div>
                                </div>

                                {/* Linked Rider Card */}
                                {linkedRider && (
                                    <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-lg">
                                        <h4 className="text-sm font-semibold text-blue-700 mb-3 flex items-center gap-2">
                                            <User size={16} /> Linked Rider Information
                                        </h4>
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <p className="text-muted-foreground text-xs">Rider Name</p>
                                                <p className="font-medium">{linkedRider.riderName}</p>
                                            </div>
                                            <div>
                                                <p className="text-muted-foreground text-xs">Triev ID</p>
                                                <p className="font-medium font-mono">{linkedRider.trievId}</p>
                                            </div>
                                            <div>
                                                <p className="text-muted-foreground text-xs">Mobile</p>
                                                <p className="font-medium flex items-center gap-1">
                                                    <Phone size={12} /> {linkedRider.mobileNumber}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-muted-foreground text-xs">Wallet Balance</p>
                                                <p className={`font-bold flex items-center gap-1 ${linkedRider.walletAmount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                    <Wallet size={12} /> ₹{linkedRider.walletAmount}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Timeline / History */}
                                <div>
                                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                        <Clock size={16} /> Activity History
                                    </h4>
                                    <div className="space-y-4 max-h-[200px] overflow-y-auto pr-2">
                                        {/* Original Request */}
                                        <div className="flex gap-3">
                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                                <User size={14} className="text-primary" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-medium">Ticket Created</p>
                                                    <span className="text-xs text-muted-foreground">{selectedRequest.createdAt ? format(new Date(selectedRequest.createdAt as any), 'MMM dd, HH:mm') : ''}</span>
                                                </div>
                                                <p className="text-xs text-muted-foreground">System</p>
                                            </div>
                                        </div>

                                        {selectedRequest.timeline?.map((event, idx) => (
                                            <div key={idx} className="flex gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${event.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100'}`}>
                                                    {event.role === 'admin' ? <MessageSquare size={14} /> : <User size={14} />}
                                                </div>
                                                <div className="bg-card w-full p-2 rounded-lg border text-sm">
                                                    <div className="flex justify-between mb-1">
                                                        <span className={`font-semibold text-xs uppercase ${getStatusColor(event.status).split(' ')[0]} px-1.5 rounded`}>
                                                            {event.status.replace(/_/g, ' ')}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">
                                                            {event.timestamp ? format(new Date(event.timestamp as any), 'MMM dd, HH:mm') : ''}
                                                        </span>
                                                    </div>
                                                    <p className="text-foreground/90">{event.remark}</p>
                                                    <p className="text-[10px] text-muted-foreground mt-1 text-right">by {event.updatedBy}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right: Action Panel */}
                        <div className="md:w-1/2 flex flex-col h-full bg-background border-l border-border">
                            <div className="p-4 border-b flex justify-between items-center bg-muted/5">
                                <h3 className="font-semibold flex items-center gap-2">
                                    <MessageSquare size={18} />
                                    Update Status & Reply
                                </h3>
                                <button onClick={() => setSelectedRequest(null)} className="p-1 hover:bg-muted rounded-full">
                                    <XCircle size={24} />
                                </button>
                            </div>

                            <div className="p-6 flex-1 flex flex-col gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Change Status To</label>
                                    <select
                                        value={resolutionStatus}
                                        onChange={(e) => setResolutionStatus(e.target.value as RequestStatus)}
                                        className="w-full p-2.5 border rounded-lg bg-background focus:ring-2 focus:ring-primary/50"
                                    >
                                        <option value="pending">Pending</option>
                                        <option value="in_progress">In Progress</option>
                                        <option value="waiting_for_info">Waiting for Info</option>
                                        <option value="resolved">Resolved</option>
                                        <option value="rejected">Rejected</option>
                                    </select>
                                </div>

                                <div className="flex-1 flex flex-col">
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="block text-sm font-medium">Comment / Reply</label>
                                        <button
                                            onClick={generateAiResponse}
                                            disabled={aiLoading}
                                            className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full flex items-center gap-1 hover:bg-purple-200 transition-colors"
                                        >
                                            <Sparkles size={12} />
                                            AI Suggest
                                        </button>
                                    </div>
                                    <textarea
                                        value={resolutionNote}
                                        onChange={(e) => setResolutionNote(e.target.value)}
                                        className="w-full flex-1 p-3 border rounded-lg bg-background focus:ring-2 focus:ring-primary/50 resize-none"
                                        placeholder="Add a remark relating to this status update..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">Internal Note (Hidden)</label>
                                    <input
                                        type="text"
                                        value={internalNote}
                                        onChange={(e) => setInternalNote(e.target.value)}
                                        className="w-full p-2 border rounded-lg text-sm"
                                        placeholder="For admin eyes only..."
                                    />
                                </div>
                            </div>

                            <div className="p-4 border-t bg-muted/5 space-y-3">
                                {selectedRequest.type === 'password_reset' && selectedRequest.status !== 'resolved' && (
                                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-2">
                                        <h4 className="text-sm font-semibold text-yellow-800 mb-1">Password Reset Action</h4>
                                        <button
                                            onClick={handleResetPassword}
                                            disabled={submitting}
                                            className="w-full py-2 bg-yellow-600 text-white rounded-md font-medium hover:bg-yellow-700 transition-colors flex items-center justify-center gap-2 text-sm shadow-sm"
                                        >
                                            <Sparkles size={14} />
                                            Reset to Default ({DEFAULT_RESET_PASSWORD})
                                        </button>
                                        <p className="text-[10px] text-yellow-700 mt-2 text-center">
                                            Sets password to {DEFAULT_RESET_PASSWORD} and resolves ticket.
                                        </p>
                                    </div>
                                )}

                                <button
                                    onClick={submitResolution}
                                    disabled={submitting}
                                    className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 flex items-center justify-center gap-2 shadow-sm transition-all"
                                >
                                    {submitting ? <Clock size={16} className="animate-spin" /> : <Send size={16} />}
                                    Update Ticket
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RequestManagement;
