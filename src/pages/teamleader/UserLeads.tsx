import React, { useState, useEffect } from 'react';
import { supabase } from '@/config/supabase';
import { Lead } from '@/types';
import LeadsTable from '@/components/LeadsTable';
import LeadForm from '@/components/LeadForm';
import { Plus } from 'lucide-react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';

import BulkActionsBar from '@/components/BulkActionsBar';
import { toast } from 'sonner';
import { logActivity } from '@/utils/activityLog';

const UserLeads: React.FC = () => {
    const { userData } = useSupabaseAuth();
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);

    // Bulk Action State
    const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!userData?.id) return;

        const fetchLeads = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('leads')
                .select(`
                    id, leadId:lead_id, riderName:rider_name, mobileNumber:mobile_number,
                    city, status, score, category, source, createdAt:created_at,
                    drivingLicense:driving_license, clientInterested:client_interested,
                    location
                `)
                .eq('created_by', userData.id)
                .order('created_at', { ascending: false });

            if (data) setLeads(data as Lead[]);
            if (error) console.error("Error fetching leads:", error);
            setLoading(false);
        };

        fetchLeads();

        // Real-time subscription
        const subscription = supabase
            .channel('my-leads')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'leads',
                filter: `created_by=eq.${userData.id}`
            }, () => {
                fetchLeads(); // Re-fetch to sort properly
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [userData?.id]);

    // Permission Checks
    const canViewPage = userData?.permissions?.modules?.leads ?? true;
    const canCreate = userData?.permissions?.leads?.create ?? true;
    const canEdit = userData?.permissions?.leads?.edit ?? true;
    const canDelete = userData?.permissions?.leads?.delete ?? true;
    const canStatusChange = userData?.permissions?.leads?.statusChange ?? true;

    const canBulkStatusChange = userData?.permissions?.leads?.bulkActions?.statusChange ?? false;
    const canBulkDelete = userData?.permissions?.leads?.bulkActions?.delete ?? false;
    // const canBulkAssign = userData?.permissions?.leads?.bulkActions?.assign ?? false; // Unused for now

    // Handlers
    const handleToggleSelect = (id: string) => {
        setSelectedLeads(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };

    const handleToggleSelectAll = () => {
        if (selectedLeads.size === leads.length) {
            setSelectedLeads(new Set());
        } else {
            setSelectedLeads(new Set(leads.map(l => l.id)));
        }
    };

    const handleSimpleStatusChange = async (lead: Lead, newStatus: string) => {
        if (!canStatusChange) {
            toast.error("You don't have permission to change status.");
            return;
        }
        try {
            const { error } = await supabase.from('leads').update({ status: newStatus }).eq('id', lead.id);
            if (error) throw error;
            toast.success(`Status updated to ${newStatus}`);

            await logActivity({
                actionType: 'leadStatusChange',
                targetType: 'lead',
                targetId: lead.id,
                details: `Changed lead status to ${newStatus}`,
                performedBy: userData?.email
            });
        } catch (e: any) {
            console.error(e);
            toast.error("Failed to update status");
        }
    };

    // Bulk Handlers
    const getBulkActions = () => {
        const actions = [];
        if (canBulkStatusChange) {
            actions.push({
                label: 'Mark as Convert',
                onClick: () => handleBulkStatusUpdate('Convert')
            });
            actions.push({
                label: 'Mark as Not Convert',
                onClick: () => handleBulkStatusUpdate('Not Convert')
            });
        }
        if (canBulkDelete) {
            actions.push({
                label: 'Delete Selected',
                onClick: handleBulkDelete,
                variant: 'destructive'
            });
        }
        return actions as any[];
    };

    const handleBulkStatusUpdate = async (status: string) => {
        if (selectedLeads.size === 0) return;
        try {
            const { error } = await supabase
                .from('leads')
                .update({ status })
                .in('id', Array.from(selectedLeads));

            if (error) throw error;
            toast.success(`Updated status for ${selectedLeads.size} leads`);
            setSelectedLeads(new Set());
        } catch (e) {
            console.error(e);
            toast.error("Bulk update failed");
        }
    };

    const handleBulkDelete = async () => {
        if (selectedLeads.size === 0) return;
        if (!confirm(`Are you sure you want to delete ${selectedLeads.size} leads?`)) return;

        try {
            const { error } = await supabase
                .from('leads')
                .delete()
                .in('id', Array.from(selectedLeads));

            if (error) throw error;
            toast.success(`Deleted ${selectedLeads.size} leads`);
            setSelectedLeads(new Set());
        } catch (e) {
            console.error(e);
            toast.error("Bulk delete failed");
        }
    };


    if (!canViewPage) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center p-8 bg-muted/30 rounded-lg">
                    <h2 className="text-xl font-bold mb-2">Access Restricted</h2>
                    <p className="text-muted-foreground">You do not have permission to view the Leads page.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 relative h-full">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">My Leads</h1>
                    <p className="text-muted-foreground">Track your sourced leads</p>
                </div>
                {canCreate && (
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="bg-primary text-primary-foreground px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg hover:shadow-xl transition-all"
                    >
                        <Plus size={20} />
                        Start Sourcing
                    </button>
                )}
            </div>

            {selectedLeads.size > 0 && (
                <div className="absolute inset-0 z-10">
                    <BulkActionsBar
                        selectedCount={selectedLeads.size}
                        totalCount={leads.length}
                        onSelectAll={handleToggleSelectAll}
                        onDeselectAll={() => setSelectedLeads(new Set())}
                        actions={getBulkActions()}
                    />
                </div>
            )}

            {showAddModal && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="max-h-[90vh] overflow-y-auto w-full max-w-2xl">
                        <LeadForm
                            onSuccess={() => { setShowAddModal(false); }}
                            onCancel={() => setShowAddModal(false)}
                        />
                    </div>
                </div>
            )}

            <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
                <LeadsTable
                    leads={leads}
                    loading={loading}
                    userRole="teamLeader"
                    onDelete={() => { toast.info("Use bulk delete or implement individual delete") }}
                    onStatusChange={handleSimpleStatusChange}
                    onEdit={() => { }}
                    showLocation={false}
                    permissions={{
                        edit: canEdit,
                        delete: canDelete,
                        statusChange: canStatusChange
                    }}
                    selectedIds={selectedLeads}
                    onToggleSelect={handleToggleSelect}
                    onToggleSelectAll={handleToggleSelectAll}
                />
            </div>
        </div>
    );
};

export default UserLeads;
