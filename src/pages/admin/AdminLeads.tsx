import React, { useState, useEffect } from 'react';
import { supabase } from '@/config/supabase';
import { Lead, LeadStatus, Rider } from '@/types';
import AdminLeadTable from '@/components/AdminLeadTable';
import LeadDetailModal from '@/components/LeadDetailModal';
import LeadForm from '@/components/LeadForm';
import BulkActionsBar from '@/components/BulkActionsBar'; // Import
import { AIService } from '@/services/AIService';
import { Plus, Sparkles, Download, Filter, Search, Trash2 } from 'lucide-react';
import { mapLeadToDB } from '@/utils/leadUtils';

import { useLocation } from 'react-router-dom';

const AdminLeads: React.FC = () => {
    const location = useLocation();
    const [leads, setLeads] = useState<Lead[]>([]);
    const [riders, setRiders] = useState<Rider[]>([]); // For matching logic
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [activeTab, setActiveTab] = useState<'All' | LeadStatus>('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [refreshKey, setRefreshKey] = useState(0);

    // Bulk Selection State
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const statusParam = params.get('status');
        if (statusParam) {
            setActiveTab(statusParam as any);
        }
    }, [location.search]);

    // ... useEffect for data fetching ... (Keep existing fetch logic)
    useEffect(() => {
        setLoading(true);

        const fetchData = async () => {
            // 1. Fetch Riders
            const { data: riderData } = await supabase.from('riders').select(`
                id, mobileNumber:mobile_number, trievId:triev_id, riderName:rider_name
            `);
            if (riderData) setRiders(riderData as any);

            // 2. Fetch Leads
            const { data: leadData } = await supabase.from('leads').select(`
                id, leadId:lead_id, riderName:rider_name, mobileNumber:mobile_number,
                city, status, score, category, source, createdAt:created_at,
                drivingLicense:driving_license, clientInterested:client_interested
            `).order('id', { ascending: false });
            if (leadData) setLeads(leadData as any);

            setLoading(false);
        };

        fetchData();

        // Real-time subscription
        const subscription = supabase
            .channel('leads-list-sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
                fetchData();
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [refreshKey]);


    // Bulk Actions Handlers
    const handleSelectionChange = (ids: string[]) => {
        setSelectedIds(ids);
    };

    const handleBulkDelete = async () => {
        if (!confirm(`Are you sure you want to delete ${selectedIds.length} leads?`)) return;

        try {
            const { error } = await supabase.from('leads').delete().in('id', selectedIds);
            if (error) throw error;

            // Optimistic update
            setLeads(prev => prev.filter(l => !selectedIds.includes(l.id)));
            setSelectedIds([]);
            alert("Leads deleted successfully.");
        } catch (error) {
            console.error("Bulk delete failed", error);
            alert("Failed to delete leads.");
        }
    };

    // ... handleAIScoreAll (Keep existing) ...
    const handleAIScoreAll = async () => {
        setLoading(true);
        try {
            const updates: { id: string, category: 'Genuine' | 'Match' | 'Duplicate', score: number }[] = [];

            leads.forEach(lead => {
                let category: 'Genuine' | 'Match' | 'Duplicate' = 'Genuine';
                let score = 50; // Base score

                // 1. Check Match with Riders
                const isMatch = riders.some(r => r.mobileNumber === lead.mobileNumber);
                if (isMatch) {
                    category = 'Match';
                    score += 40;
                }

                // 2. Check Duplicate in Leads
                // Find leads with same mobile, excluding self
                const duplicates = leads.filter(l => l.mobileNumber === lead.mobileNumber && l.id !== lead.id);
                if (duplicates.length > 0) {
                    category = 'Duplicate';
                    score -= 30;
                }

                // 3. Completeness Bonus
                if (lead.drivingLicense === 'Permanent') score += 10;
                // if (lead.activeUPI === 'Yes') score += 10; 
                if (lead.clientInterested) score += 5;

                // Cap score
                score = Math.min(100, Math.max(0, score));

                // Only update if changed
                if (lead.category !== category || lead.score !== score) {
                    updates.push({ id: lead.id, category, score });
                }
            });

            if (updates.length > 0) {
                // Execute updates
                // FIX: Use mapLeadToDB to ensure 'category' -> 'leadCategory'
                await Promise.all(updates.map(u => {
                    const payload = mapLeadToDB({ category: u.category, score: u.score });
                    return supabase.from('leads').update(payload).eq('id', u.id);
                }));
                alert(`AI Scored ${updates.length} leads successfully!`);
                // State update will happen via subscription or next fetch
            } else {
                alert("All leads are already up to date.");
            }

        } catch (error) {
            console.error("AI Score failed", error);
            alert("AI Scoring Failed.");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (lead: Lead) => {
        if (!confirm(`Are you sure you want to delete lead #${lead.leadId}?`)) return;
        try {
            const { error } = await supabase.from('leads').delete().eq('id', lead.id);
            if (error) throw error;
        } catch (error) {
            console.error("Delete failed", error);
            alert("Failed to delete lead");
        }
    };

    const handleStatusChange = async (lead: Lead, newStatus: LeadStatus) => {
        try {
            await supabase.from('leads').update({ status: newStatus }).eq('id', lead.id);
        } catch (error) {
            console.error("Error updating status", error);
        }
    };

    // Advanced Filter State
    const [filterCity, setFilterCity] = useState('All');
    const [filterSource, setFilterSource] = useState('All');
    const [filterScore, setFilterScore] = useState('All');

    // Filter Logic
    const filteredLeads = leads.filter(lead => {
        const matchesTab = activeTab === 'All' ? true : lead.status === activeTab;
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch =
            (lead.riderName || '').toLowerCase().includes(searchLower) ||
            (lead.mobileNumber || '').includes(searchTerm) ||
            (lead.city || '').toLowerCase().includes(searchLower) ||
            String(lead.leadId || '').includes(searchTerm);

        // Advanced Filters matches
        const matchesCity = filterCity === 'All' || lead.city === filterCity;
        const matchesSource = filterSource === 'All' || lead.source === filterSource;
        const matchesScore = filterScore === 'All'
            ? true
            : filterScore === 'High' ? (lead.score || 0) >= 80
                : filterScore === 'Medium' ? (lead.score || 0) >= 50 && (lead.score || 0) < 80
                    : (lead.score || 0) < 50;

        return matchesTab && matchesSearch && matchesCity && matchesSource && matchesScore;
    });

    const getTabCount = (tab: typeof activeTab) => {
        if (tab === 'All') return leads.length;
        return leads.filter(l => l.status === tab).length;
    };

    // Redoing state management for clear Add vs Edit
    const [editingLead, setEditingLead] = useState<Lead | null>(null);

    const openEditModal = (lead: Lead) => {
        setSelectedLead(null);
        setEditingLead(lead);
    };

    const handleExport = () => {
        const headers = ["Lead ID", "Name", "Mobile", "City", "Status", "Score", "Category", "Source", "Created At"];
        const csvContent = [
            headers.join(","),
            ...filteredLeads.map(l => [
                l.leadId,
                l.riderName,
                l.mobileNumber,
                l.city,
                l.status,
                l.score || 0,
                l.category,
                l.source,
                l.createdAt ? new Date(l.createdAt).toISOString() : ''
            ].map(f => `"${f}"`).join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `leads_export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleAIRecommend = async (lead: Lead) => {
        const recommendation = await AIService.getLeadRecommendations(lead);
        alert(`AI Recommendation for ${lead.riderName}:\n\n${recommendation}`);
    };

    // Filter Logic Toggle
    const [showFilters, setShowFilters] = useState(false);

    return (
        <div className="space-y-6 pb-20 relative">
            {/* Bulk Actions */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4 pointer-events-none">
                <div className="pointer-events-auto">
                    <BulkActionsBar
                        selectedCount={selectedIds.length}
                        totalCount={filteredLeads.length}
                        onSelectAll={() => setSelectedIds(filteredLeads.map(l => l.id))}
                        onDeselectAll={() => setSelectedIds([])}
                        actions={[
                            {
                                label: 'Delete Selected',
                                onClick: handleBulkDelete,
                                variant: 'destructive',
                                icon: <Trash2 size={16} />
                            }
                        ]}
                    />
                </div>
            </div>

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                        Lead Management
                    </h1>
                    <p className="text-muted-foreground">Track and score your leads with AI</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleExport}
                        className="px-4 py-2 border bg-background hover:bg-accent rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
                    >
                        <Download size={16} /> Export
                    </button>
                    <button
                        onClick={handleAIScoreAll}
                        className="px-4 py-2 border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg flex items-center gap-2 text-sm font-bold transition-all shadow-sm hover:shadow"
                    >
                        <Sparkles size={16} /> AI Score All
                    </button>
                    <button
                        onClick={() => { setEditingLead(null); setShowAddModal(true); }}
                        className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg flex items-center gap-2 text-sm font-bold shadow-lg shadow-primary/20 transition-all"
                    >
                        <Plus size={18} /> Add Lead
                    </button>
                </div>
            </div>

            {/* Search Bar */}
            <div className="flex gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                    <input
                        type="text"
                        placeholder="Search by ID, name, mobile, or city..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
                    />
                </div>
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`px-4 py-3 border rounded-xl flex items-center gap-2 text-sm font-medium transition-colors ${showFilters ? 'bg-primary/10 border-primary text-primary' : 'bg-background hover:bg-accent border-input'}`}
                >
                    <Filter size={18} /> Filters
                </button>
            </div>

            {/* Optional Filter Row */}
            {showFilters && (
                <div className="p-4 bg-muted/30 border border-border rounded-xl animate-in fade-in slide-in-from-top-2">
                    <p className="text-sm text-muted-foreground mb-2">Advanced Filters</p>
                    <div className="flex gap-4">
                        <select
                            value={filterCity}
                            onChange={(e) => setFilterCity(e.target.value)}
                            className="px-3 py-2 rounded-lg border bg-background text-sm"
                        >
                            <option value="All">City: All</option>
                            <option value="Noida">Noida</option>
                            <option value="Delhi">Delhi</option>
                            <option value="Gurgaon">Gurgaon</option>
                        </select>
                        <select
                            value={filterSource}
                            onChange={(e) => setFilterSource(e.target.value)}
                            className="px-3 py-2 rounded-lg border bg-background text-sm"
                        >
                            <option value="All">Source: All</option>
                            <option value="Field Survey">Field Survey</option>
                            <option value="Social Media">Social Media</option>
                            <option value="Referral">Referral</option>
                        </select>
                        <select
                            value={filterScore}
                            onChange={(e) => setFilterScore(e.target.value)}
                            className="px-3 py-2 rounded-lg border bg-background text-sm"
                        >
                            <option value="All">Score: All</option>
                            <option value="High">High ({'>'}80)</option>
                            <option value="Medium">Medium (50-80)</option>
                            <option value="Low">Low ({'<'}50)</option>
                        </select>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="border-b border-border/50">
                <div className="flex gap-6">
                    {(['All', 'New', 'Convert', 'Not Convert'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`pb-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${activeTab === tab
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            {tab}
                            <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === tab ? 'bg-primary/10' : 'bg-muted'
                                }`}>
                                {getTabCount(tab)}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                <AdminLeadTable
                    leads={filteredLeads}
                    loading={loading}
                    selectedIds={selectedIds}
                    onSelectionChange={handleSelectionChange}
                    onStatusChange={handleStatusChange}
                    onView={(lead) => setSelectedLead(lead)}
                    onEdit={openEditModal}
                    onDelete={handleDelete}
                    onAIRecommend={handleAIRecommend}
                />
            </div>
            {/* Add/Edit Lead Modal */}
            {(showAddModal || editingLead) && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="max-h-[90vh] overflow-y-auto w-full max-w-2xl">
                        <LeadForm
                            initialData={editingLead || undefined}
                            onSuccess={() => {
                                setShowAddModal(false);
                                setEditingLead(null);
                                // Trigger refresh
                                setRefreshKey(prev => prev + 1);
                            }}
                            onCancel={() => { setShowAddModal(false); setEditingLead(null); }}
                        />
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {selectedLead && (
                <LeadDetailModal
                    lead={selectedLead}
                    onClose={() => setSelectedLead(null)}
                    onEdit={openEditModal}
                />
            )}
        </div>
    );
};

export default AdminLeads;
