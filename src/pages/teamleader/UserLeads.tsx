import React, { useState, useEffect } from 'react';
import { supabase } from '@/config/supabase';
import { Lead } from '@/types';
import LeadsTable from '@/components/LeadsTable';
import LeadForm from '@/components/LeadForm';
import { Plus } from 'lucide-react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';

const UserLeads: React.FC = () => {
    const { userData } = useSupabaseAuth();
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);

    useEffect(() => {
        if (!userData?.id) return;

        const fetchLeads = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('leads')
                .select('*')
                .eq('createdBy', userData.id)
                .order('createdAt', { ascending: false });

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
                filter: `createdBy=eq.${userData.id}`
            }, () => {
                fetchLeads(); // Re-fetch to sort properly
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [userData?.id]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">My Leads</h1>
                    <p className="text-muted-foreground">Track your sourced leads</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="bg-primary text-primary-foreground px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg hover:shadow-xl transition-all"
                >
                    <Plus size={20} />
                    Start Sourcing
                </button>
            </div>

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
                    onDelete={() => { }} // Team Leads typically don't hard delete? Or strict permissions.
                    onStatusChange={() => { }} // Maybe restricted?
                    onEdit={() => { }}
                    showLocation={false}
                />
            </div>
        </div>
    );
};

export default UserLeads;
