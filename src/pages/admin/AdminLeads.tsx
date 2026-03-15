import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/config/supabase';
import { Lead, LeadStatus, Rider } from '@/types';
import AdminLeadTable from '@/components/AdminLeadTable';
import { AILeadStatsCards } from '@/components/AILeadStatsCards';
import LeadDetailModal from '@/components/LeadDetailModal';
import LeadForm from '@/components/LeadForm';
import BulkActionsBar from '@/components/BulkActionsBar';
import AdvancedFilterModal, { FilterConfig } from '@/components/AdvancedFilterModal';
import { AIService } from '@/services/AIService';
import { Plus, Sparkles, Download, Search, Trash2, SlidersHorizontal, Users, PlusCircle, Target, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { mapLeadToDB } from '@/utils/leadUtils';
import { logActivity } from '@/utils/activityLog';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { startOfDay, endOfDay, isWithinInterval, parseISO } from 'date-fns';
import { formatPhoneNumber } from '@/utils/validationUtils';

const AdminLeads: React.FC = () => {
    const { userData: currentUser } = useSupabaseAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [leads, setLeads] = useState<Lead[]>([]);
    const [riders, setRiders] = useState<Rider[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [activeTab, setActiveTab] = useState<'All' | LeadStatus>('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [refreshKey, setRefreshKey] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const LEADS_PAGE_SIZE = 25;

    // AI Stats Filter (Quick Filter)
    const [activeFilter, setActiveFilter] = useState<'genuine' | 'duplicate' | 'match' | null>(null);

    // Advanced Filters
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [teamLeaders, setTeamLeaders] = useState<{ id: string; name: string; rm?: string }[]>([]);
    const [rmFilter, setRmFilter] = useState<string>('all');
    const [filterConfig, setFilterConfig] = useState<FilterConfig>({
        dateRange: null,
        teamLeaderId: null,
        status: [],
        category: [],
        source: [],
        city: null,
        drivingLicense: null
    });

    // Bulk Selection State
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const statusParam = params.get('status');
        if (statusParam) {
            setActiveTab(statusParam as any);
        }

        // Handle Quick Filters from Dashboard (e.g., Team Leader Table)
        const state = location.state as { filter?: string, value?: string };
        if (state?.filter === 'teamLeader' && state.value) {
            setFilterConfig(prev => ({ ...prev, teamLeaderId: state.value! }));
            setShowFilterModal(true); // Show modal so they know unique view is active
        }
    }, [location.search, location.state]);

    useEffect(() => {
        setLoading(true);

        const fetchData = async () => {
            // 1. Fetch Riders
            const { data: riderData } = await supabase.from('riders').select(`
id, mobileNumber: mobile_number, trievId: triev_id, riderName: rider_name
    `);
            if (riderData) setRiders(riderData as any);

            // 2. Fetch Leads
            const { data: leadData } = await supabase.from('leads').select(`
id, leadId: lead_id, riderName: rider_name, mobileNumber: mobile_number,
    city, status, score, category, source, createdAt: created_at,
        drivingLicense: driving_license, clientInterested: client_interested,
            location, createdBy: created_by, createdByName: created_by_name,
                remarks
                    `).order('id', { ascending: false });

            if (leadData) {
                const leadsData = leadData as any[];
                setLeads(leadsData);

                // 3. Extract Unique Team Leaders from Leads
                const uniqueTLs = new Map<string, string>();
                leadsData.forEach(lead => {
                    if (lead.createdBy && lead.createdByName) {
                        uniqueTLs.set(lead.createdBy, lead.createdByName);
                    }
                });

                setTeamLeaders(Array.from(uniqueTLs.entries()).map(([id, name]) => ({ id, name })));

                // Fetch RM info for TLs from users table
                const tlIds = Array.from(uniqueTLs.keys());
                if (tlIds.length > 0) {
                    const { data: userData } = await supabase
                        .from('users')
                        .select('id, reporting_manager')
                        .in('id', tlIds);
                    if (userData) {
                        const rmMap = new Map(userData.map((u: any) => [u.id, u.reporting_manager || '']));
                        setTeamLeaders(Array.from(uniqueTLs.entries()).map(([id, name]) => ({ id, name, rm: rmMap.get(id) || '' })));
                    }
                }
            }

            setLoading(false);
        };

        fetchData();

        const subscription = supabase
            .channel('leads-list-sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
                // Ideally optimistically update or refetch
                fetchData();
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [refreshKey]);

    // Apply Filters
    const filteredLeads = useMemo(() => {
        // console.log("Filtering Leads with Config:", filterConfig);

        return leads.filter(lead => {
            // 1. Search Term
            const matchesSearch = searchTerm === '' ||
                lead.riderName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                lead.mobileNumber?.includes(searchTerm) ||
                lead.city?.toLowerCase().includes(searchTerm.toLowerCase());

            if (!matchesSearch) return false;

            // 2. Quick Tab Status Filter
            if (activeTab !== 'All' && lead.status !== activeTab) return false;

            // 3. Quick AI Filter (Cards)
            if (activeFilter) {
                const cat = (typeof lead.category === 'string' ? lead.category : '').toLowerCase();
                if (cat !== activeFilter) return false;
            }

            // 4. Advanced Filters
            // Date Range
            if (filterConfig.dateRange?.start && filterConfig.dateRange?.end) {
                const leadDate = parseISO(lead.createdAt);
                const start = startOfDay(parseISO(filterConfig.dateRange.start));
                const end = endOfDay(parseISO(filterConfig.dateRange.end));
                if (!isWithinInterval(leadDate, { start, end })) {
                    // console.log("Failed Date:", lead.createdAt, start, end);
                    return false;
                }
            }

            // Team Leader
            if (filterConfig.teamLeaderId && lead.createdBy !== filterConfig.teamLeaderId) {
                // console.log("Failed TL:", lead.createdBy, filterConfig.teamLeaderId);
                return false;
            }

            // Reporting Manager
            if (rmFilter !== 'all') {
                const tlRM = teamLeaders.find(t => t.id === lead.createdBy);
                if (!tlRM || tlRM.rm !== rmFilter) return false;
            }

            // Status (Multi-select)
            if (filterConfig.status.length > 0 && !filterConfig.status.includes(lead.status)) {
                // console.log("Failed Status:", lead.status, filterConfig.status);
                return false;
            }

            // Category
            if (filterConfig.category.length > 0) {
                const cat = typeof lead.category === 'string' ? lead.category : 'Genuine';
                const normalize = (s: string) => s.toLowerCase();
                // Case-insensitive check for category
                const configCats = filterConfig.category.map(normalize);
                if (!configCats.includes(normalize(cat))) {
                    // console.log("Failed Category:", cat, filterConfig.category);
                    return false;
                }
            }

            // Source
            if (filterConfig.source.length > 0 && !filterConfig.source.includes(lead.source)) {
                // console.log("Failed Source:", lead.source, filterConfig.source);
                return false;
            }

            // City
            if (filterConfig.city && lead.city !== filterConfig.city) {
                // console.log("Failed City:", lead.city, filterConfig.city);
                return false;
            }

            // License
            if (filterConfig.drivingLicense && lead.drivingLicense !== filterConfig.drivingLicense) {
                // console.log("Failed License:", lead.drivingLicense, filterConfig.drivingLicense);
                return false;
            }

            return true;
        });
    }, [leads, searchTerm, activeTab, activeFilter, filterConfig, rmFilter, teamLeaders]);

    // Reset to page 1 whenever filters change
    React.useEffect(() => { setCurrentPage(1); }, [filteredLeads.length]);

    const totalLeadPages = Math.ceil(filteredLeads.length / LEADS_PAGE_SIZE);
    const paginatedLeads = filteredLeads.slice((currentPage - 1) * LEADS_PAGE_SIZE, currentPage * LEADS_PAGE_SIZE);

    const availableCities = useMemo(() => Array.from(new Set(leads.map(l => l.city).filter(Boolean))), [leads]);

    const getTabCount = (status: 'All' | LeadStatus) => {
        if (status === 'All') return leads.length;
        return leads.filter(l => l.status === status).length;
    };

    const leadTabConfig = [
        { id: 'All', label: 'All Leads', icon: Users },
        { id: 'New', label: 'New', icon: PlusCircle },
        { id: 'Convert', label: 'Converted', icon: Target },
        { id: 'Not Convert', label: 'Not Converted', icon: AlertTriangle },
    ] as const;

    // Bulk Actions Handlers
    const handleSelectionChange = (ids: string[]) => {
        setSelectedIds(ids);
    };

    const handleBulkDelete = async () => {
        if (!confirm(`Are you sure you want to delete ${selectedIds.length} leads ? `)) return;

        try {
            const { error } = await supabase.from('leads').delete().in('id', selectedIds);
            if (error) throw error;

            await logActivity({
                actionType: 'Lead Bulk Delete',
                targetType: 'lead',
                targetId: 'multiple',
                details: `Permanently deleted ${selectedIds.length} leads.`,
                performedBy: currentUser?.email
            }).catch(console.error);

            setLeads(prev => prev.filter(l => !selectedIds.includes(l.id)));
            setSelectedIds([]);
            alert("Leads deleted successfully.");
        } catch (error) {
            console.error("Bulk delete failed", error);
            alert("Failed to delete leads.");
        }
    };

    const handleResetFilters = () => {
        setFilterConfig({
            dateRange: null,
            teamLeaderId: null,
            status: [],
            category: [],
            source: [],
            city: null,
            drivingLicense: null
        });
        setActiveFilter(null);
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

                // Log activity
                await logActivity({
                    actionType: 'Lead AI Scoring',
                    targetType: 'lead',
                    targetId: 'multiple',
                    details: `Bulk AI scored ${updates.length} leads.`,
                    performedBy: currentUser?.email
                }).catch(console.error);

                setLeads(prev => prev.map(l => {
                    const updated = updates.find(u => u.id === l.id);
                    return updated ? { ...l, category: updated.category, score: updated.score } : l;
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

            logActivity({
                actionType: 'leadDeleted',
                targetType: 'lead',
                targetId: String(lead.leadId),
                details: `Permanently deleted lead #${lead.leadId} `,
                performedBy: currentUser?.email
            }).catch(console.error);

        } catch (error) {
            console.error("Delete failed", error);
            alert("Failed to delete lead");
        }
    };

    const handleStatusChange = async (lead: Lead, newStatus: LeadStatus) => {
        try {
            await supabase.from('leads').update({ status: newStatus }).eq('id', lead.id);

            logActivity({
                actionType: 'statusChanged',
                targetType: 'lead',
                targetId: String(lead.leadId),
                details: `Changed lead #${lead.leadId} status to ${newStatus} `,
                performedBy: currentUser?.email
            }).catch(console.error);

            // Notify Linked Team Leader (if lead was created by one)
            if (lead.createdBy) {
                // Warning: lead.createdBy might be 'system' or non-UUID for some old data.
                // Assuming standard UUID.
                await supabase.from('notifications').insert({
                    user_id: lead.createdBy,
                    title: 'Lead Status Updated',
                    message: `Admin updated status of lead ${lead.riderName} to ${newStatus}.`,
                    type: 'info',
                    related_entity: { id: lead.id, type: 'lead' }, // 'lead' isn't in older types, may fallback or need refactor. 
                    // Wait, `relatedEntity` type is 'rider' | 'user' | 'request' | 'wallet'. 
                    // I should check `NotificationService.ts` types or just omit related entity if strict.
                    // Let's use 'request' as a proxy or just generic. Or update type.
                    // For now, I'll omit relatedEntity details that break types, or use 'rider' if it fits.
                    // Actually, let's just send the message.
                    is_read: false,
                    created_at: new Date().toISOString()
                });
            }

        } catch (error) {
            console.error("Error updating status", error);
        }
    };




    // Helper to normalize mobile numbers
    const normalizeMobile = (phone: string | null | undefined): string => {
        return formatPhoneNumber(phone || '');
    };

    // Pre-calculate sets for filtering
    const { riderMobileSet, leadMobileCounts } = useMemo(() => { // ensure useMemo is imported or React.useMemo
        const rSet = new Set(riders.map(r => normalizeMobile(r.mobileNumber)));
        const lCounts = new Map<string, number>();
        leads.forEach(l => {
            const m = normalizeMobile(l.mobileNumber || String(l.leadId)); // fallback
            if (m) lCounts.set(m, (lCounts.get(m) || 0) + 1);
        });
        return { riderMobileSet: rSet, leadMobileCounts: lCounts };
    }, [riders, leads]);

    const getLeadAIStatus = (lead: Lead): 'Genuine' | 'Duplicate' | 'Match' => {
        const mobile = normalizeMobile(lead.mobileNumber || String(lead.leadId));
        if (riderMobileSet.has(mobile)) return 'Match';
        if ((leadMobileCounts.get(mobile) || 0) > 1) return 'Duplicate';
        return 'Genuine';
    };

    const handleAIStatusClick = (lead: Lead, status: 'Genuine' | 'Duplicate' | 'Match') => {
        const mobile = normalizeMobile(lead.mobileNumber || String(lead.leadId));
        if (!mobile) return;

        if (status === 'Match') {
            navigate(`/portal/riders?highlight=${mobile}`);
        } else if (status === 'Duplicate') {
            setSearchTerm(mobile);
            toast.info(`Showing duplicates for: ${mobile}`);
        }
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

        logActivity({
            actionType: 'reportGenerated',
            targetType: 'lead',
            targetId: 'multiple',
            details: `Exported ${filteredLeads.length} leads to CSV`,
            performedBy: currentUser?.email
        }).catch(console.error);
    };

    const handleAIRecommend = async (lead: Lead) => {
        const recommendation = await AIService.getLeadRecommendations(lead);
        alert(`AI Recommendation for ${lead.riderName}: \n\n${recommendation} `);
    };

    return (
        <div className="space-y-6 pb-20 relative">
            {/* Bulk Actions */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-full max-w-2xl px-4 pointer-events-none">
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

            {/* Search Bar & Filters */}
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

                {/* Reporting Manager Filter */}
                {(() => {
                    const uniqueRMs = Array.from(new Set(teamLeaders.map(t => t.rm).filter(Boolean))).sort() as string[];
                    if (uniqueRMs.length === 0) return null;
                    return (
                        <select
                            value={rmFilter}
                            onChange={(e) => setRmFilter(e.target.value)}
                            className={`px-3 py-3 border rounded-xl text-sm font-medium transition-all outline-none cursor-pointer shadow-sm ${rmFilter !== 'all' ? 'bg-teal-50 border-teal-500 text-teal-700 ring-1 ring-teal-500/20' : 'bg-background border-input hover:bg-accent'}`}
                        >
                            <option value="all">All Managers</option>
                            {uniqueRMs.map(rm => (
                                <option key={rm} value={rm}>{rm}</option>
                            ))}
                        </select>
                    );
                })()}

                <button
                    onClick={() => setShowFilterModal(true)}
                    className={`px - 4 py - 3 border rounded - xl flex items - center gap - 2 text - sm font - medium transition - colors ${Object.values(filterConfig).some(v => Array.isArray(v) ? v.length > 0 : v)
                        ? 'bg-primary/10 border-primary text-primary'
                        : 'bg-background hover:bg-accent border-input'
                        } `}
                >
                    <SlidersHorizontal size={18} /> Filters
                </button>
            </div>

            {/* Lead Conversion Funnel */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <Target size={18} className="text-primary" />
                    <h2 className="text-sm font-bold">Conversion Funnel</h2>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-2 w-full">
                    {(() => {
                        const total = leads.length;
                        const newLeads = leads.filter(l => l.status === 'New').length;
                        const followUp = leads.filter(l => l.status === 'Not Convert').length; // Changed from 'Follow Up' to 'Not Convert'
                        const convert = leads.filter(l => l.status === 'Convert').length;

                        const stages = [
                            { label: 'Total Leads', count: total, color: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200' },
                            { label: 'New', count: newLeads, color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' },
                            { label: 'Not Converted', count: followUp, color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' },
                            { label: 'Converted', count: convert, color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' }
                        ];

                        return stages.map((stage, idx) => (
                            <React.Fragment key={stage.label}>
                                <div className={`flex-1 w-full flex flex-col items-center justify-center p-3 rounded-xl ${stage.color}`}>
                                    <span className="text-2xl font-black">{stage.count}</span>
                                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">{stage.label}</span>
                                    {idx > 0 && total > 0 && (
                                        <span className="text-[9px] font-medium mt-1 opacity-70">
                                            {Math.round((stage.count / total) * 100)}% of total
                                        </span>
                                    )}
                                </div>
                                {idx < stages.length - 1 && (
                                    <div className="hidden sm:block text-muted-foreground/30">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                                    </div>
                                )}
                            </React.Fragment>
                        ));
                    })()}
                </div>
            </div>

            {/* AI Stats Cards */}
            <div className="animate-in fade-in slide-in-from-top-4 duration-500 mt-4">
                <AILeadStatsCards
                    leads={leads}
                    allLeads={leads}
                    allRiders={riders}
                    onFilterChange={setActiveFilter}
                    activeFilter={activeFilter}
                    isAdmin={true}
                />
            </div>

            {/* Enhanced Segmented Tabs */}
            <div className="relative p-1 bg-slate-100/50 dark:bg-slate-900/50 backdrop-blur-xl rounded-[2rem] border border-slate-200/50 dark:border-slate-800/50 w-fit mx-auto md:mx-0 shadow-sm">
                <div className="flex flex-wrap md:flex-nowrap gap-1">
                    {leadTabConfig.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        const count = getTabCount(tab.id as any);

                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`
                                    relative flex items-center gap-2.5 px-6 py-3 rounded-full text-sm font-bold uppercase tracking-wider transition-all duration-500
                                    ${isActive
                                        ? 'text-white'
                                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                                    }
                                `}
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="leadActiveTabBackground"
                                        className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full shadow-lg shadow-blue-500/20"
                                        initial={false}
                                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                    />
                                )}
                                <span className="relative z-10 flex items-center gap-2.5">
                                    <Icon size={16} className={`${isActive ? 'opacity-100' : 'opacity-60'}`} />
                                    {tab.label}
                                    <span className={`
                                        flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-black border
                                        ${isActive
                                            ? 'bg-white/20 border-white/30 text-white'
                                            : 'bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                                        }
                                    `}>
                                        {count}
                                    </span>
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Table + Pagination Area */}
            <div className="space-y-4">
                <AdminLeadTable
                    leads={paginatedLeads}
                    loading={loading}
                    selectedIds={selectedIds}
                    onSelectionChange={handleSelectionChange}
                    onStatusChange={handleStatusChange}
                    onView={(lead) => setSelectedLead(lead)}
                    onEdit={openEditModal}
                    onDelete={handleDelete}
                    onAIRecommend={handleAIRecommend}
                    getLeadAIStatus={getLeadAIStatus}
                    onAIStatusClick={handleAIStatusClick}
                />
            </div>

            {/* Pagination footer */}
            {totalLeadPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border/50">
                    <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 text-xs font-bold border border-input rounded-lg hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        ← Prev
                    </button>
                    <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalLeadPages) }, (_, i) => {
                            const page = totalLeadPages <= 5 ? i + 1 : currentPage <= 3 ? i + 1 : currentPage >= totalLeadPages - 2 ? totalLeadPages - 4 + i : currentPage - 2 + i;
                            return (
                                <button
                                    key={page}
                                    onClick={() => setCurrentPage(page)}
                                    className={`w - 8 h - 8 text - xs font - bold rounded - lg transition - colors ${page === currentPage
                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                        : 'hover:bg-accent text-muted-foreground'
                                        } `}
                                >
                                    {page}
                                </button>
                            );
                        })}
                    </div>
                    <button
                        onClick={() => setCurrentPage(p => Math.min(totalLeadPages, p + 1))}
                        disabled={currentPage === totalLeadPages}
                        className="px-3 py-1.5 text-xs font-bold border border-input rounded-lg hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        Next →
                    </button>
                </div>
            )}
            {/* Add/Edit Lead Modal */}
            {(showAddModal || editingLead) && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[20000] flex items-center justify-center p-0 md:p-4">
                    <div className="w-full h-full md:h-auto max-w-2xl">
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

            {/* Advanced Filters Modal */}
            <AdvancedFilterModal
                isOpen={showFilterModal}
                onClose={() => setShowFilterModal(false)}
                onApply={(filters) => {
                    setFilterConfig(filters);
                    setShowFilterModal(false);
                    toast.success("Filters applied");
                }}
                onReset={handleResetFilters}
                initialFilters={filterConfig}
                teamLeaders={teamLeaders}
                availableCities={availableCities}
            />
        </div>
    );
};

export default AdminLeads;
