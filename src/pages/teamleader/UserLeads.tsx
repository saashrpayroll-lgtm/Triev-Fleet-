import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/config/supabase';
import { Lead, Rider } from '@/types';
import { AILeadStatsCards } from '@/components/AILeadStatsCards';
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

    const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());

    const [allLeads, setAllLeads] = useState<Lead[]>([]);
    const [allRiders, setAllRiders] = useState<Rider[]>([]);
    // Removed unused activeFilter state

    useEffect(() => {
        if (!userData?.id) return;

        const fetchLeads = async () => {
            setLoading(true);

            // 1. Fetch My Leads (Scoped)
            const { data: myLeadsData, error: myLeadsError } = await supabase
                .from('leads')
                .select(`
                    id, leadId:lead_id, riderName:rider_name, mobileNumber:mobile_number,
                    city, status, score, category, source, createdAt:created_at,
                    drivingLicense:driving_license, clientInterested:client_interested,
                    location
                `)
                .eq('created_by', userData.id)
                .order('created_at', { ascending: false });

            // 2. Fetch ALL Leads (Global - for AI Stats)
            // optimization: fetching minimal fields for stats
            const { data: allLeadsData } = await supabase
                .from('leads')
                .select('mobile_number, id'); // Minimal fetch for duplicated check

            // 3. Fetch ALL Riders (Global - for AI Stats)
            const { data: allRidersData } = await supabase
                .from('rider_master')
                .select('mobile_number, id');

            if (myLeadsData) setLeads(myLeadsData as Lead[]);
            if (allLeadsData) setAllLeads(allLeadsData.map((l: any) => ({ ...l, mobileNumber: l.mobile_number })) as Lead[]);
            if (allRidersData) setAllRiders(allRidersData.map((r: any) => ({ ...r, mobileNumber: r.mobile_number })) as Rider[]);

            if (myLeadsError) console.error("Error fetching leads:", myLeadsError);
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


    // AI Status Logic
    const normalizeMobile = (phone: string | null | undefined): string => {
        if (!phone) return '';
        const digits = phone.replace(/\D/g, '');
        return digits.length > 10 ? digits.slice(-10) : digits;
    };

    const { riderMobileSet, leadMobileCounts } = useMemo(() => {
        const rSet = new Set(allRiders.map(r => normalizeMobile(r.mobileNumber)));
        const lCounts = new Map<string, number>();
        allLeads.forEach(l => {
            const mobile = normalizeMobile(l.mobileNumber);
            if (mobile) {
                lCounts.set(mobile, (lCounts.get(mobile) || 0) + 1);
            }
        });
        return { riderMobileSet: rSet, leadMobileCounts: lCounts };
    }, [allRiders, allLeads]);

    const getLeadAIStatus = (lead: Lead): 'Genuine' | 'Duplicate' | 'Match' => {
        const mobile = normalizeMobile(lead.mobileNumber || String(lead.leadId));
        if (riderMobileSet.has(mobile)) return 'Match';
        if ((leadMobileCounts.get(mobile) || 0) > 1) return 'Duplicate';
        return 'Genuine';
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

            {/* AI Stats (View Only for Team Leaders) */}
            <AILeadStatsCards
                leads={leads}
                allLeads={allLeads}
                allRiders={allRiders}
                onFilterChange={() => { }}
                activeFilter={null}
                isAdmin={false}
            />

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
                    getLeadAIStatus={getLeadAIStatus}
                />
            </div>
        </div>
    );
};

export default UserLeads;
