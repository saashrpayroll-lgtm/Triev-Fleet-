import React, { useState, useEffect } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/config/supabase';
import { Request, RequestType, RequestPriority, Rider } from '@/types';
import { Plus, Search, Filter, CheckCircle, Clock, XCircle, FileText, Sparkles, Loader, Trash2, CheckSquare, Square } from 'lucide-react';
import { AIService } from '@/services/AIService';
import { logActivity } from '@/utils/activityLog';

const Requests: React.FC = () => {
    const { userData } = useSupabaseAuth();
    const [requests, setRequests] = useState<Request[]>([]);
    const [myRiders, setMyRiders] = useState<Rider[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');

    // Bulk Selection
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Form State
    const [formData, setFormData] = useState({
        type: 'other' as RequestType,
        subject: '',
        description: '',
        priority: 'medium' as RequestPriority,
        relatedEntityId: '',
    });
    const [submitting, setSubmitting] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);

    const handleAiSuggest = async () => {
        if (!formData.subject && !formData.description) return;

        setAiLoading(true);
        try {
            const userInput = `${formData.subject} ${formData.description}`;
            const content = await AIService.suggestRequestContent(userInput);
            if (content) {
                setFormData(prev => ({
                    ...prev,
                    subject: content.subject || prev.subject,
                    description: content.description || prev.description,
                    type: content.type as RequestType || prev.type
                }));
            }

        } catch (error) {
            console.error("AI Suggestion failed:", error);
        } finally {
            setAiLoading(false);
        }
    };

    useEffect(() => {
        if (userData) {
            fetchRequests();
            fetchMyRiders();

            // Real-time updates for requests
            const channel = supabase
                .channel('teamleader-requests')
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'requests', filter: `userId=eq.${userData.id}` },
                    () => {
                        fetchRequests();
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [userData]);

    // Mappers
    const mapRequestToApp = (r: any): Request => ({
        id: r.id,
        ticketId: r.ticket_id,
        type: r.type,
        subject: r.subject,
        description: r.description,
        priority: r.priority,
        userId: r.user_id,
        userName: r.user_name,
        email: r.email,
        userRole: r.user_role,
        status: r.status,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        relatedEntityId: r.related_entity_id,
        relatedEntityName: r.related_entity_name,
        relatedEntityType: r.related_entity_type,
        resolvedAt: r.resolved_at,
        resolvedBy: r.resolved_by,
        adminResponse: r.admin_response
    });

    const mapRequestToDB = (r: any) => ({
        ticket_id: r.ticketId,
        type: r.type,
        subject: r.subject,
        description: r.description,
        priority: r.priority,
        user_id: r.userId,
        user_name: r.userName,
        email: r.email,
        user_role: r.userRole,
        status: r.status,
        related_entity_id: r.relatedEntityId || null,
        related_entity_name: r.relatedEntityName || null,
        related_entity_type: r.relatedEntityType || null,
        created_at: r.createdAt
    });

    // Rider Mapper (simplified)
    const mapRiderToApp = (r: any): Rider => ({
        ...r,
        id: r.id,
        riderName: r.rider_name || r.riderName,
        walletAmount: r.wallet_amount || r.walletAmount,
        teamLeaderId: r.team_leader_id || r.teamLeaderId
    });

    const canViewPage = userData?.permissions?.modules?.requests ?? true;
    const canCreate = userData?.permissions?.modules?.requests ?? true; // Use module access as proxy for creation
    const canDelete = userData?.permissions?.requests?.delete ?? true;

    if (!canViewPage) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center p-8 bg-muted/30 rounded-lg">
                    <h2 className="text-xl font-bold mb-2">Access Restricted</h2>
                    <p className="text-muted-foreground">You do not have permission to view the Requests page.</p>
                </div>
            </div>
        );
    }

    const fetchRequests = async () => {
        try {
            const { data, error } = await supabase
                .from('requests')
                .select('*')
                .eq('user_id', userData?.id) // snake_case
                .neq('status', 'deleted')
                .order('created_at', { ascending: false });

            if (error) throw error;

            setRequests(data?.map(mapRequestToApp) || []);
        } catch (error) {
            console.error("Error fetching requests:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMyRiders = async () => {
        try {
            const { data, error } = await supabase
                .from('riders')
                .select('*')
                .eq('team_leader_id', userData?.id); // snake_case

            if (error) throw error;

            setMyRiders(data?.map(mapRiderToApp) || []);
        } catch (error) {
            console.error("Error fetching riders:", error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userData) return;

        setSubmitting(true);
        try {
            let entityName = '';
            if (formData.relatedEntityId) {
                const rider = myRiders.find(r => r.id === formData.relatedEntityId);
                entityName = rider?.riderName || '';
            }

            // Generate Ticket ID
            const { data: maxTicketData } = await supabase
                .from('requests')
                .select('ticket_id')
                .order('ticket_id', { ascending: false })
                .limit(1);

            let nextId = 10001;
            if (maxTicketData && maxTicketData.length > 0 && maxTicketData[0].ticket_id) {
                nextId = Number(maxTicketData[0].ticket_id) + 1;
            }

            const newRequestApp = {
                ticketId: nextId,
                type: formData.type,
                subject: formData.subject,
                description: formData.description,
                priority: formData.priority,
                userId: userData.id,
                userName: userData.fullName,
                email: userData.email,
                userRole: userData.role,
                status: 'pending',
                createdAt: new Date().toISOString(),
                ...(formData.relatedEntityId ? {
                    relatedEntityId: formData.relatedEntityId,
                    relatedEntityName: entityName,
                    relatedEntityType: 'rider'
                } : {})
            };

            const dbPayload = mapRequestToDB(newRequestApp);

            const { error } = await supabase
                .from('requests')
                .insert([dbPayload]);

            if (error) throw error;

            setIsModalOpen(false);
            setFormData({
                type: 'other',
                subject: '',
                description: '',
                priority: 'medium',
                relatedEntityId: '',
            });
            fetchRequests(); // Refresh list explicitly

            await logActivity({
                actionType: 'requestCreated',
                targetType: 'request',
                targetId: String(nextId),
                details: `New Request #${nextId} (${formData.type}): ${formData.subject}`,
                metadata: {
                    priority: formData.priority,
                    status: 'pending'
                }
            });
        } catch (error) {
            console.error("Error creating request:", error);
            alert("Failed to create request: " + (error instanceof Error ? error.message : "Unknown error"));
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this request? This cannot be undone.')) return;
        try {
            // Soft delete
            const { error } = await supabase
                .from('requests')
                .update({ status: 'deleted', updated_at: new Date().toISOString() })
                .eq('id', id);

            if (error) throw error;

            setRequests(prev => prev.filter(r => r.id !== id));
            setSelectedIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(id);
                return newSet;
            });
        } catch (error) {
            console.error("Error deleting request:", error);
            alert("Failed to delete request.");
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`Are you sure you want to delete ${selectedIds.size} requests?`)) return;

        try {
            // Soft delete
            const { error } = await supabase
                .from('requests')
                .update({ status: 'deleted', updated_at: new Date().toISOString() })
                .in('id', Array.from(selectedIds));

            if (error) throw error;

            setRequests(prev => prev.filter(r => !selectedIds.has(r.id)));
            setSelectedIds(new Set());
        } catch (error) {
            console.error("Error bulk deleting:", error);
            alert("Failed to delete requests.");
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
            case 'resolved': return 'bg-green-100 text-green-800 border-green-200';
            case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
            case 'deleted': return 'bg-gray-300 text-gray-800 border-gray-400';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'high': return 'text-red-600 bg-red-50';
            case 'medium': return 'text-orange-600 bg-orange-50';
            case 'low': return 'text-green-600 bg-green-50';
            default: return 'text-gray-600';
        }
    };

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading requests...</div>;

    const filteredRequests = requests.filter(req => {
        const matchesSearch = req.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
            req.id.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'all' || req.status === filterStatus;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold">My Requests</h1>
                    <p className="text-muted-foreground mt-1">Track and manage your support tickets</p>
                </div>
                {canCreate && (
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
                    >
                        <Plus size={20} />
                        New Request
                    </button>
                )}
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 bg-card p-4 rounded-lg border shadow-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <input
                        type="text"
                        placeholder="Search subject or ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background text-foreground"
                    />
                </div>
                <div className="flex items-center gap-2 min-w-[200px]">
                    {canDelete && (
                        <button
                            onClick={handleBulkDelete}
                            disabled={selectedIds.size === 0}
                            className={`p-2 rounded-md transition-colors ${selectedIds.size > 0 ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'text-muted-foreground opacity-50 cursor-not-allowed'}`}
                            title="Delete Selected"
                        >
                            <Trash2 size={18} />
                        </button>
                    )}
                    <div className="h-6 w-px bg-border mx-1"></div>
                    <button
                        onClick={toggleSelectAll}
                        className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground p-1 px-2 rounded hover:bg-muted transition-colors"
                    >
                        {selectedIds.size > 0 && selectedIds.size === filteredRequests.length ? (
                            <CheckSquare size={18} className="text-primary" />
                        ) : (
                            <Square size={18} />
                        )}
                        <span className="hidden sm:inline">Select All</span>
                    </button>
                    <Filter size={18} className="text-muted-foreground ml-2" />
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background"
                    >
                        <option value="all">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="rejected">Rejected</option>
                    </select>
                </div>
            </div>

            {/* Request List */}
            <div className="grid gap-4">
                {filteredRequests.length === 0 ? (
                    <div className="text-center py-12 bg-card rounded-lg border border-dashed">
                        <FileText className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
                        <h3 className="text-lg font-medium text-foreground">No requests found</h3>
                        <p className="text-muted-foreground">Create a new request to get started.</p>
                    </div>
                ) : (
                    filteredRequests.map(req => (
                        <div key={req.id} className={`bg-card border rounded-lg p-4 hover:shadow-md transition-shadow relative overflow-hidden group ${selectedIds.has(req.id) ? 'border-primary ring-1 ring-primary/20' : ''}`}>
                            {/* Status Stripe */}
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${getStatusColor(req.status).replace('bg-', 'bg-').split(' ')[0].replace('100', '500')}`}></div>

                            <div className="flex flex-col md:flex-row gap-4 justify-between items-start pl-3 relative bg-card">

                                <div className="space-y-1 flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium uppercase tracking-wide border ${getStatusColor(req.status)}`}>
                                            {req.status?.replace('_', ' ')}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium uppercase tracking-wide ${getPriorityColor(req.priority)}`}>
                                            {req.priority} Priority
                                        </span>
                                        <span className="text-xs text-muted-foreground ml-2 flex items-center gap-1">
                                            <Clock size={12} />
                                            {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : 'N/A'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">#{req.ticketId}</span>
                                        <h3 className="font-semibold text-lg">{req.subject}</h3>
                                    </div>
                                    <p className="text-sm text-foreground/80 line-clamp-2">{req.description}</p>

                                    {req.adminResponse && (
                                        <div className="mt-3 p-3 bg-muted/50 rounded-md border-l-2 border-primary">
                                            <p className="text-xs font-bold text-primary mb-1">Admin Response:</p>
                                            <p className="text-sm italic">{req.adminResponse}</p>
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-col items-end gap-2 text-sm text-muted-foreground min-w-[140px] md:pl-4">
                                    {/* Actions Row */}
                                    <div className="flex items-center justify-end gap-1 mb-1">
                                        {canDelete && (
                                            <button
                                                onClick={() => handleDelete(req.id)}
                                                className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded transition-all"
                                                title="Delete Request"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => toggleSelection(req.id)}
                                            className="p-1.5 text-muted-foreground hover:text-primary transition-colors"
                                        >
                                            {selectedIds.has(req.id) ? (
                                                <CheckSquare size={18} className="text-primary" />
                                            ) : (
                                                <Square size={18} />
                                            )}
                                        </button>
                                    </div>

                                    <span className="bg-muted px-2 py-1 rounded text-xs font-medium uppercase">
                                        {req.type?.replace('_', ' ')}
                                    </span>
                                    {req.relatedEntityName && (
                                        <span className="flex items-center gap-1 text-xs">
                                            Rider: <span className="font-medium text-foreground">{req.relatedEntityName}</span>
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Create Request Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-background rounded-lg shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center p-4 border-b">
                            <h2 className="text-lg font-bold">Create New Request</h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-muted rounded-full transition-colors">
                                <XCircle size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Request Type</label>
                                    <select
                                        required
                                        value={formData.type}
                                        onChange={(e) => setFormData({ ...formData, type: e.target.value as RequestType })}
                                        className="w-full p-2 border rounded-md focus:ring-2 focus:ring-primary/50 bg-background"
                                    >
                                        <option value="other">Other</option>
                                        <option value="rider_update">Rider Update</option>
                                        <option value="wallet_issue">Wallet Issue</option>
                                        <option value="permission_request">Permission Request</option>
                                        <option value="data_correction">Data Correction</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Priority</label>
                                    <select
                                        required
                                        value={formData.priority}
                                        onChange={(e) => setFormData({ ...formData, priority: e.target.value as RequestPriority })}
                                        className="w-full p-2 border rounded-md focus:ring-2 focus:ring-primary/50 bg-background"
                                    >
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                    </select>
                                </div>
                            </div>

                            {(formData.type === 'rider_update' || formData.type === 'wallet_issue') && (
                                <div>
                                    <label className="block text-sm font-medium mb-1">Select Rider</label>
                                    <select
                                        value={formData.relatedEntityId}
                                        onChange={(e) => setFormData({ ...formData, relatedEntityId: e.target.value })}
                                        className="w-full p-2 border rounded-md focus:ring-2 focus:ring-primary/50 bg-background"
                                    >
                                        <option value="">-- Select Rider --</option>
                                        {myRiders.map(rider => (
                                            <option key={rider.id} value={rider.id}>
                                                {rider.riderName} ({rider.walletAmount})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium mb-1">Subject</label>
                                <input
                                    required
                                    type="text"
                                    value={formData.subject}
                                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                    placeholder="Brief summary of the issue"
                                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-primary/50 bg-background text-foreground"
                                />
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-sm font-medium">Description</label>
                                    <button
                                        type="button"
                                        onClick={handleAiSuggest}
                                        disabled={aiLoading || (!formData.subject && !formData.description)}
                                        className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full flex items-center gap-1 hover:bg-purple-200 transition-colors disabled:opacity-50"
                                        title="Type a few words in subject/description and click for AI magic"
                                    >
                                        {aiLoading ? <Loader size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                        AI Auto-Fill
                                    </button>
                                </div>
                                <label className="sr-only">Description</label>
                                <textarea
                                    required
                                    rows={4}
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Detailed explanation..."
                                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-primary/50 resize-none bg-background text-foreground"
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-sm font-medium border rounded-md hover:bg-accent transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    {submitting ? 'Submitting...' : (
                                        <>
                                            <CheckCircle size={16} />
                                            Submit Request
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Requests;
