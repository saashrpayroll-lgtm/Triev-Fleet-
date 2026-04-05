import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/config/supabase';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { Rider, User, RiderStatus, ClientName } from '@/types';
import { Plus, Search, Filter, Download, Phone, MessageCircle, Trash2, ChevronLeft, ChevronRight, RefreshCw, Users, SlidersHorizontal, CheckCircle, XCircle, Send, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import AddRiderForm from '@/components/AddRiderForm';
import RiderDetailsModal from '@/components/RiderDetailsModal';
import ExportModal, { ExportFormat } from '@/components/ExportModal';
import BulkActionsBar from '@/components/BulkActionsBar';
import TLMappingModal from '@/components/TLMappingModal';
import { exportRidersToCSV, exportRidersToExcel, exportRidersToPDF } from '@/utils/exportUtils';
import ActionDropdownMenu from '@/components/ActionDropdownMenu';
import WalletAdjustmentModal from '@/components/WalletAdjustmentModal';
import AIReminderModal, { ReminderType } from '@/components/AIReminderModal';

import { notifyTeamLeader } from '@/utils/notificationUtils';
import { logActivity } from '@/utils/activityLog';
import { useDebounce } from '@/hooks/useDebounce';
import PaymentReminderModal from '@/components/PaymentReminderModal';
import BulkCommunicationModal from '@/components/BulkCommunicationModal';
import { toast } from 'sonner';
import { getWhatsAppLink, getCallLink } from '@/utils/validationUtils';
import ResponsiveTable, { Column } from '@/components/ui/ResponsiveTable';
import { fetchAllRidersPaginated } from '@/utils/dbUtils';

type TabType = 'all' | 'active' | 'inactive' | 'deleted' | 'zomato';

interface AdvancedFilters {
    teamLeader: string;
    client: ClientName | 'all';
    walletRange: 'all' | 'positive' | 'negative' | 'zero' | 'low_balance' | 'high_debt';
    reportingManager: string;
}

interface RiderManagementProps {
    scopedCityOpsId?: string;
}

const RiderManagement: React.FC<RiderManagementProps> = ({ scopedCityOpsId }) => {
    const { userData: currentUser } = useSupabaseAuth();
    const location = useLocation();
    const [activeTab, setActiveTab] = useState<TabType>('all');
    const [riders, setRiders] = useState<Rider[]>([]);
    const [teamLeaders, setTeamLeaders] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingRider, setEditingRider] = useState<Rider | null>(null);
    const [viewingRider, setViewingRider] = useState<Rider | null>(null);
    const [reminderRider, setReminderRider] = useState<Rider | null>(null);
    const [adjustmentRider, setAdjustmentRider] = useState<Rider | null>(null); // New State
    const [showExportModal, setShowExportModal] = useState(false);
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [selectedRiders, setSelectedRiders] = useState<Set<string>>(new Set());
    const [reassigningRider, setReassigningRider] = useState<Rider | null>(null);
    const [showBulkAssignTL, setShowBulkAssignTL] = useState(false); // State for Bulk TL Modal
    const [showBulkCommunicationModal, setShowBulkCommunicationModal] = useState(false);
    const [selectedReminderRider, setSelectedReminderRider] = useState<Rider | null>(null);
    const [reminderType, setReminderType] = useState<ReminderType>('low_balance');

    // Highlight Logic
    const [highlightedRiderId, setHighlightedRiderId] = useState<string | null>(null);

    // Advanced Filter: Searchable TL Dropdown
    const [tlSearchQuery, setTlSearchQuery] = useState('');
    const [showTLDropdown, setShowTLDropdown] = useState(false);
    const tlDropdownRef = useRef<HTMLDivElement>(null);

    // Close TL dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (tlDropdownRef.current && !tlDropdownRef.current.contains(e.target as Node)) {
                setShowTLDropdown(false);
            }
        };
        if (showTLDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showTLDropdown]);

    // URL Filter & Highlight Logic
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const filterParam = params.get('filter');
        const highlightMobile = params.get('highlight');

        if (filterParam && ['all', 'active', 'inactive', 'deleted', 'zomato'].includes(filterParam)) {
            setActiveTab(filterParam as TabType);
        }

        if (highlightMobile) {
            setSearchTerm(highlightMobile);
            // We need to wait for riders to load to find the ID, but search term will do the filtering.
            // We can try to find the rider ID immediately if riders are loaded
            const rider = riders.find(r => r.mobileNumber?.includes(highlightMobile));
            if (rider) {
                setHighlightedRiderId(rider.id);
                setTimeout(() => setHighlightedRiderId(null), 3000);
            }
        }
    }, [location.search, riders]); // Add riders to dependency to trigger when data loads

    // Advanced filters
    const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
        teamLeader: 'all',
        client: 'all',
        walletRange: 'all',
        reportingManager: 'all',
    });

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);

    // Sorting
    const [sortBy, setSortBy] = useState<keyof Rider>('createdAt');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    const debouncedSearchTerm = useDebounce(searchTerm, 300);

    // fetchData is defined below (after state declarations) and passed here via useCallback.
    // useEffect is placed AFTER fetchData definition to avoid "used before declaration" TS error.

    // Removed filterRiders wrapper and its useEffect


    const filteredRiders = useMemo(() => {
        let filtered = [...riders];

        if (activeTab === 'zomato') {
            filtered = filtered.filter(r => r.status === 'active' && (r.chassisNumber?.trim().toUpperCase().startsWith('P6DSVFMSP') || (r as any).chassis_number?.trim().toUpperCase().startsWith('P6DSVFMSP')));
        } else if (activeTab !== 'all') {
            filtered = filtered.filter(r => r.status === activeTab);
        }

        if (debouncedSearchTerm) {
            const searchLower = debouncedSearchTerm.toLowerCase();
            filtered = filtered.filter(r =>
                r.riderName.toLowerCase().includes(searchLower) ||
                r.trievId.toLowerCase().includes(searchLower) ||
                r.mobileNumber.includes(debouncedSearchTerm) ||
                r.chassisNumber.toLowerCase().includes(searchLower) ||
                r.teamLeaderName.toLowerCase().includes(searchLower)
            );
        }

        if (advancedFilters.teamLeader !== 'all') {
            if (advancedFilters.teamLeader === 'unassigned') {
                filtered = filtered.filter(r => !r.teamLeaderId);
            } else {
                filtered = filtered.filter(r => r.teamLeaderId === advancedFilters.teamLeader);
            }
        }

        if (advancedFilters.client !== 'all') {
            filtered = filtered.filter(r => r.clientName === advancedFilters.client);
        }

        if (advancedFilters.walletRange !== 'all') {
            filtered = filtered.filter(r => {
                if (advancedFilters.walletRange === 'positive') return r.walletAmount > 0;
                if (advancedFilters.walletRange === 'negative') return r.walletAmount < 0;
                if (advancedFilters.walletRange === 'zero') return r.walletAmount === 0;
                if (advancedFilters.walletRange === 'low_balance') return r.status === 'active' && r.walletAmount >= 0 && r.walletAmount <= 250;
                if (advancedFilters.walletRange === 'high_debt') return r.walletAmount < -3000;
                return true;
            });
        }

        if (advancedFilters.reportingManager !== 'all') {
            const tlIdsForRM = teamLeaders
                .filter(tl => (tl.reportingManager || '') === advancedFilters.reportingManager)
                .map(tl => tl.id);
            filtered = filtered.filter(r => tlIdsForRM.includes(r.teamLeaderId));
        }

        filtered.sort((a, b) => {
            const aValue = a[sortBy];
            const bValue = b[sortBy];
            if (typeof aValue === 'number' && typeof bValue === 'number') {
                return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
            }
            if (typeof aValue === 'string' && typeof bValue === 'string') {
                return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
            }
            return 0;
        });

        return filtered;
    }, [riders, activeTab, debouncedSearchTerm, advancedFilters, sortBy, sortOrder, teamLeaders]);

    useEffect(() => {
        setCurrentPage(1);
    }, [filteredRiders.length]);

    // Deep Linking Handler
    // Deep Linking Handler
    // Deep Linking Handler
    useEffect(() => {
        // Handle State (Highlight Rider & Filters)
        const state = location.state as { highlightRiderId?: string, filter?: string, value?: string };

        if (state?.highlightRiderId && riders.length > 0) {
            const targetRider = riders.find(r => r.id === state.highlightRiderId);
            if (targetRider) {
                setViewingRider(targetRider);
                window.history.replaceState({}, document.title);
            }
        }

        // Handle Quick Filter from Dashboard
        if (state?.filter) {
            if (state.filter === 'teamLeader' && state.value) {
                setAdvancedFilters(prev => ({ ...prev, teamLeader: state.value! }));
                setShowAdvancedFilters(true);
            }
            // Map Wallet Filters
            else if (state.filter === 'positive_wallet') {
                setAdvancedFilters(prev => ({ ...prev, walletRange: 'positive' }));
                setShowAdvancedFilters(true);
            }
            else if (state.filter === 'negative_wallet') {
                setAdvancedFilters(prev => ({ ...prev, walletRange: 'negative' }));
                setShowAdvancedFilters(true);
            }
            else if (state.filter === 'high_debt') {
                setAdvancedFilters(prev => ({ ...prev, walletRange: 'high_debt' }));
                setShowAdvancedFilters(true);
            }
            else if (state.filter === 'zero_balance') {
                setAdvancedFilters(prev => ({ ...prev, walletRange: 'zero' }));
                setShowAdvancedFilters(true);
            }
            else if (state.filter === 'low_balance') {
                setAdvancedFilters(prev => ({ ...prev, walletRange: 'low_balance' }));
                setActiveTab('active');
                setShowAdvancedFilters(true);
            }
            // Map Status Filters
            else if (['active', 'inactive', 'deleted'].includes(state.filter)) {
                setActiveTab(state.filter as TabType);
            }
        }

        // Handle URL Params (Filters)
        const params = new URLSearchParams(location.search);
        const filterParam = params.get('filter');
        const walletParam = params.get('wallet');

        if (filterParam && ['all', 'active', 'inactive', 'deleted'].includes(filterParam)) {
            setActiveTab(filterParam as TabType);
        }

        if (walletParam && ['positive', 'negative', 'zero', 'high_debt'].includes(walletParam)) {
            setAdvancedFilters(prev => ({ ...prev, walletRange: walletParam as any }));
            setShowAdvancedFilters(true);
        }
    }, [location.search, riders, location.state]);

    const fetchData = React.useCallback(async () => {
        setLoading(true);
        try {
            // Step 1: Fetch scoped TLs first (for both rider scoping and dropdown)
            let tlQuery = supabase.from('users').select(`
                id,
                fullName:full_name,
                email,
                mobile,
                role,
                status,
                userId:user_id,
                username,
                jobLocation:job_location,
                reportingManager:reporting_manager,
                reportingManagerId:reporting_manager_id,
                city_ops_id,
                permissions,
                remarks,
                profilePicUrl:profile_pic_url,
                suspendedUntil:suspended_until,
                createdAt:created_at,
                updatedAt:updated_at
            `).eq('role', 'teamLeader');

            if (scopedCityOpsId) {
                tlQuery = tlQuery.eq('city_ops_id', scopedCityOpsId);
            }

            const { data: teamLeadersData, error: usersError } = await tlQuery;
            if (usersError) throw usersError;

            // Step 2: Scope riders by TL IDs (safe — team_leader_id always exists)
            const scopedTlIds = scopedCityOpsId && teamLeadersData && teamLeadersData.length > 0
                ? (teamLeadersData as { id: string }[]).map(tl => tl.id)
                : undefined;
            const riderFilter = scopedTlIds && scopedTlIds.length > 0
                ? { column: 'team_leader_id', value: scopedTlIds, type: 'in' as const }
                : undefined;

            const { data: ridersData, error: ridersError } = await fetchAllRidersPaginated(`
                id,
                trievId:triev_id,
                riderName:rider_name,
                mobileNumber:mobile_number,
                chassisNumber:chassis_number,
                clientName:client_name,
                clientId:client_id,
                walletAmount:wallet_amount,
                allotmentDate:allotment_date,
                remarks,
                status,
                teamLeaderId:team_leader_id,
                teamLeaderName:team_leader_name,
                createdAt:created_at,
                updatedAt:updated_at,
                inactivatedAt:inactivated_at,
                lastStatusChangeAt:last_status_change_at,
                deletedAt:deleted_at
            `, riderFilter);
            if (ridersError) throw ridersError;

            const mappedRiders = ((ridersData as Rider[]) || []).map(r => ({ ...r, walletAmount: r.status === 'active' ? r.walletAmount : 0 }));
            setRiders(mappedRiders);
            setTeamLeaders((teamLeadersData as unknown as User[]) || []);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    }, [scopedCityOpsId]);

    // Real-time subscription + initial fetch — placed AFTER fetchData to avoid hoisting issues
    useEffect(() => {
        fetchData();

        let debounceTimer: ReturnType<typeof setTimeout> | null = null;
        const fetchDebounced = () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => fetchData(), 1000);
        };

        const channel = supabase
            .channel('admin-riders-list')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'riders' },
                fetchDebounced
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            if (debounceTimer) clearTimeout(debounceTimer);
        };
    }, [fetchData]);

    const handleTabChange = (tab: TabType) => {
        setActiveTab(tab);
        setSelectedRiders(new Set());
    };

    const getTabCount = (tab: TabType) => {
        if (tab === 'all') return riders.length;
        if (tab === 'zomato') return riders.filter(r => r.status === 'active' && (r.chassisNumber?.trim().toUpperCase().startsWith('P6DSVFMSP') || (r as any).chassis_number?.trim().toUpperCase().startsWith('P6DSVFMSP'))).length;
        return riders.filter(r => r.status === tab).length;
    };

    const tabConfig = [
        { id: 'all', label: 'All Riders', icon: Users },
        { id: 'active', label: 'Active', icon: CheckCircle },
        { id: 'zomato', label: 'Zomato VIP', icon: Sparkles },
        { id: 'inactive', label: 'Inactive', icon: XCircle },
        { id: 'deleted', label: 'Trash', icon: Trash2 },
    ] as const;



    // --- Actions with Notification & Permission Checks ---

    const handleAddRider = async (formData: any) => {
        // Permission check: 'create'
        if (currentUser?.permissions?.riders?.create === false) {
            toast.error("Permission Denied: You do not have rights to add riders.");
            return;
        }

        try {
            // Logic for Team Leader Assignment
            // The form now returns snake_case for most fields, but let's be robust
            let assignedTeamLeaderId = formData.team_leader_id || formData.teamLeaderId;

            if (!assignedTeamLeaderId) {
                if (currentUser?.role === 'teamLeader') {
                    assignedTeamLeaderId = currentUser.id;
                } else if (teamLeaders.length > 0) {
                    assignedTeamLeaderId = teamLeaders[0].id;
                }
            }

            // Calculate Team Leader Name for notification/display purposes (not necessarily for DB if normalized)
            // But DB has team_leader_name column
            const slctd = teamLeaders.find(t => t.id === assignedTeamLeaderId);
            const assignedTeamLeaderName = slctd?.fullName || '';

            // Construct Strict DB Payload
            // When operating in City Ops scope, always stamp city_ops_id so the new rider
            // is immediately visible in this City Ops panel and correctly isolated.
            const dbPayload: Record<string, unknown> = {
                triev_id: formData.triev_id || formData.trievId || `TR${Date.now()}`,
                rider_name: formData.rider_name || formData.riderName,
                mobile_number: formData.mobile_number || formData.mobileNumber,
                chassis_number: formData.chassis_number || formData.chassisNumber,
                client_name: formData.client_name || formData.clientName,
                client_id: formData.client_id || formData.clientId,
                wallet_amount: 0, // Initial amount handled via Ledger Transaction
                allotment_date: formData.allotment_date || formData.allotmentDate,
                remarks: formData.remarks,
                status: formData.status || 'active',
                team_leader_id: assignedTeamLeaderId || null,
                team_leader_name: assignedTeamLeaderName,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                ...(scopedCityOpsId ? { city_ops_id: scopedCityOpsId } : {}),
            };

            const { data, error } = await supabase.from('riders').insert(dbPayload).select().single();
            if (error) throw error;
            const newItemId = data.id;
            const walletAmount = Number(dbPayload.wallet_amount) || 0;

            await logActivity({
                actionType: 'riderAdded',
                targetType: 'rider',
                targetId: newItemId,
                details: `Added new rider: ${dbPayload.rider_name}`,
                performedBy: currentUser?.email
            });

            // Log Wallet Transaction if initial amount > 0
            // Log Wallet Transaction if initial amount > 0
            if (walletAmount !== 0) {
                try {
                    // Phase 2: Insert into wallet_snapshots as Opening Balance
                    // We do not create a ledger entry for the base balance.
                    await supabase.from('wallet_snapshots').insert({
                        rider_id: newItemId,
                        snapshot_balance: walletAmount,
                        snapshot_date: new Date().toISOString(),
                        source_type: 'MANUAL_SNAPSHOT',
                        created_by: currentUser?.id
                    });
                } catch (err) {
                    console.error('Failed to create opening snapshot:', err);
                    toast.error('Rider added but opening balance log failed.');
                }
            }

            // Notify System & TL
            await notifyTeamLeader(dbPayload.team_leader_id as string, 'create', dbPayload.rider_name as string, newItemId);

            toast.success('Rider added successfully');
            await fetchData();
            setShowAddModal(false);
        } catch (error) {
            console.error('Error adding rider:', error);
            toast.error('Failed to add rider');
        }
    };

    const handleEditRider = async (formData: any) => {
        if (currentUser?.permissions?.riders?.edit === false) {
            toast.error("Permission Denied: Edit access required.");
            return;
        }
        if (!editingRider) return;

        try {
            const dbPayload = {
                triev_id: formData.trievId,
                rider_name: formData.riderName,
                mobile_number: formData.mobileNumber,
                chassis_number: formData.chassisNumber,
                client_name: formData.clientName,
                client_id: formData.clientId,
                // wallet_amount: formData.walletAmount, // Prevent direct wallet update
                allotment_date: formData.allotmentDate,
                remarks: formData.remarks || formData.comments,
                status: formData.status,
                team_leader_id: formData.teamLeaderId,
                updated_at: new Date().toISOString(),
            };

            const { error } = await supabase.from('riders').update(dbPayload).eq('id', editingRider.id);

            if (error) throw error;

            await logActivity({
                actionType: 'riderEdited',
                targetType: 'rider',
                targetId: editingRider.id,
                details: `Updated rider: ${formData.rider_name}`,
                performedBy: currentUser?.email
            });

            // Wallet updates are now handled via separate Adjustment Modal
            if (formData.walletAmount !== undefined && Number(formData.walletAmount) !== Number(editingRider.walletAmount)) {
                toast.info("Wallet balance cannot be edited directly. Please use the 'Adjust Wallet' action.");
            }

            // Notify TL
            await notifyTeamLeader(editingRider.teamLeaderId, 'update', formData.rider_name, editingRider.id);

            toast.success('Rider updated successfully');
            await fetchData();
            setEditingRider(null);
        } catch (error) {
            console.error('Error updating rider:', error);
            toast.error('Failed to update rider');
        }
    };

    const handleStatusChange = async (rider: Rider, newStatus: RiderStatus) => {
        if (currentUser?.permissions?.riders?.statusChange === false) {
            toast.error("Permission Denied: Status change access required.");
            return;
        }

        try {
            const { error } = await supabase.from('riders').update({
                status: newStatus,
                updated_at: new Date().toISOString(),
            }).eq('id', rider.id);

            if (error) throw error;

            await logActivity({
                actionType: 'statusChanged',
                targetType: 'rider',
                targetId: rider.id,
                details: `Changed status to ${newStatus}: ${rider.riderName}`,
                performedBy: currentUser?.email
            });

            // Notify TL
            const actionType = newStatus === 'active' ? 'status_active' : 'status_inactive';
            await notifyTeamLeader(rider.teamLeaderId, actionType, rider.riderName, rider.id);

            toast.success(`Status updated to ${newStatus}`);
            await fetchData();
        } catch (error) {
            console.error('Error changing status:', error);
            toast.error('Failed to change status');
        }
    };

    const handleDeleteRider = async (rider: Rider) => {
        if (currentUser?.permissions?.riders?.delete === false) {
            toast.error("Permission Denied: Delete access required.");
            return;
        }

        if (!confirm(`Are you sure you want to delete ${rider.riderName}?`)) return;

        try {
            const { error } = await supabase.from('riders').update({
                status: 'deleted' as RiderStatus,
                deleted_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }).eq('id', rider.id);

            if (error) throw error;

            await logActivity({
                actionType: 'riderDeleted',
                targetType: 'rider',
                targetId: rider.id,
                details: `Soft deleted rider: ${rider.riderName}`,
                performedBy: currentUser?.email
            });
            await notifyTeamLeader(rider.teamLeaderId, 'status_inactive', rider.riderName, rider.id);

            toast.success('Rider moved to trash');
            await fetchData();
        } catch (error) {
            console.error('Error deleting rider:', error);
            toast.error('Failed to delete rider');
        }
    };

    const handleRestoreRider = async (rider: Rider) => {
        try {
            const { error } = await supabase.from('riders').update({
                status: 'active' as RiderStatus,
                deleted_at: null,
                updated_at: new Date().toISOString(),
            }).eq('id', rider.id);

            if (error) throw error;

            await logActivity({
                actionType: 'riderRestored',
                targetType: 'rider',
                targetId: rider.id,
                details: `Restored rider: ${rider.riderName}`,
                performedBy: currentUser?.email
            });
            await notifyTeamLeader(rider.teamLeaderId, 'status_active', rider.riderName, rider.id);

            toast.success('Rider restored');
            await fetchData();
        } catch (error) {
            console.error('Error restoring rider:', error);
            toast.error('Failed to restore rider');
        }
    };

    const handlePermanentDelete = async (rider: Rider) => {
        if (currentUser?.role !== 'admin') {
            toast.error("Security Alert: Only Super Admins can permanently delete records.");
            return;
        }

        if (!confirm(`PERMANENT DELETE: This will completely remove ${rider.riderName} from the system. This action CANNOT be undone. Are you absolutely sure?`)) return;

        try {
            // 1. Delete dependent data (Manual Cascade)

            // A. Ledger & Transactions (Critical Financial Data)
            // We must delete from wallet_ledger first as it's the new source of truth.
            const { error: wlError } = await supabase.from('wallet_ledger').delete().eq('rider_id', rider.id);
            if (wlError) {
                console.error('Error deleting wallet_ledger:', wlError);
                throw new Error('Failed to clean up wallet ledger. Deletion aborted.');
            }

            // Wallet Transactions (Legacy Support)
            const { error: wtError } = await supabase.from('wallet_transactions').delete().eq('rider_id', rider.id);
            if (wtError) {
                console.warn('Error deleting legacy wallet_transactions (non-fatal):', wtError);
            }

            // 2. Requests (Manual Cascade)
            const { error: reqError } = await supabase
                .from('requests')
                .delete()
                .eq('related_entity_id', rider.id)
                .eq('related_entity_type', 'rider');

            if (reqError) {
                console.error('Error deleting requests:', reqError);
                // Log but continue, as requests might not be strict FK
            }

            // 3. Delete Rider
            const { error } = await supabase.from('riders').delete().eq('id', rider.id);
            if (error) throw error;

            await logActivity({
                actionType: 'riderPermanentlyDeleted',
                targetType: 'rider',
                targetId: rider.id,
                details: `Permanently deleted rider: ${rider.riderName}`,
                performedBy: currentUser?.email
            });

            toast.success('Rider permanently deleted');
            await fetchData();
        } catch (error: any) {
            console.error('Error permanently deleting rider:', error);
            toast.error(`Failed to permanently delete rider: ${error.message || 'Unknown error'}`);
        }
    };

    const handleSendReminder = async (message: string) => {
        if (!reminderRider) return;

        // Log the activity
        await logActivity({
            actionType: 'sent_reminder',
            targetType: 'rider',
            targetId: reminderRider.id,
            details: `Sent payment reminder to ${reminderRider.riderName}`,
            performedBy: currentUser?.email
        });

        // Open WhatsApp
        const encodedMessage = encodeURIComponent(message);
        window.open(`https://wa.me/${reminderRider.mobileNumber}?text=${encodedMessage}`, '_blank');

        setReminderRider(null);
    };

    const handleLowBalanceReminder = (rider: Rider) => {
        setSelectedReminderRider(rider);
        setReminderType('low_balance');
    };

    // Bulk Actions — uses single batch UPDATE for reliability
    const handleBulkStatusChange = async (newStatus: RiderStatus) => {
        if (currentUser?.permissions?.riders?.bulkActions?.statusChange === false) {
            toast.error("Permission Denied: Status change access required.");
            return;
        }
        if (selectedRiders.size === 0) return;
        if (!confirm(`Change status of ${selectedRiders.size} rider(s) to ${newStatus}?`)) return;

        const riderIds = Array.from(selectedRiders);
        const totalCount = riderIds.length;

        try {
            toast.loading(`Updating ${totalCount} riders...`, { id: 'bulk-status' });

            // Process in chunks of 50 to avoid Supabase payload limits
            const CHUNK_SIZE = 50;
            for (let i = 0; i < riderIds.length; i += CHUNK_SIZE) {
                const chunk = riderIds.slice(i, i + CHUNK_SIZE);
                const { error } = await supabase.from('riders').update({
                    status: newStatus,
                    updated_at: new Date().toISOString(),
                    ...(newStatus === 'inactive' || newStatus === 'deleted'
                        ? { inactivated_at: new Date().toISOString() }
                        : {}),
                }).in('id', chunk);

                if (error) throw error;
            }

            await logActivity({
                actionType: 'bulkImport',
                targetType: 'rider',
                targetId: 'multiple',
                details: `Changed status of ${totalCount} riders to ${newStatus}`,
                performedBy: currentUser?.email
            });

            // Send summary notifications to affected TLs (batch, not per-rider)
            const affectedTLs = new Map<string, number>();
            riderIds.forEach(id => {
                const rider = riders.find(r => r.id === id);
                if (rider?.teamLeaderId) {
                    affectedTLs.set(rider.teamLeaderId, (affectedTLs.get(rider.teamLeaderId) || 0) + 1);
                }
            });
            // Fire-and-forget summary notifications
            for (const [tlId, count] of affectedTLs) {
                const actionType = newStatus === 'active' ? 'status_active' : 'status_inactive';
                notifyTeamLeader(tlId, actionType, `${count} rider(s)`, 'bulk').catch(() => {});
            }

            toast.success(`${totalCount} riders updated to ${newStatus}`, { id: 'bulk-status' });
            setSelectedRiders(new Set());
            await fetchData();
        } catch (error) {
            console.error('Error in bulk status change:', error);
            toast.error(`Failed to update riders: ${(error as any)?.message || 'Unknown error'}`, { id: 'bulk-status' });
        }
    };

    const handleBulkDelete = async () => {
        if (currentUser?.permissions?.riders?.bulkActions?.delete === false) {
            toast.error("Permission Denied.");
            return;
        }
        if (selectedRiders.size === 0) return;
        if (!confirm(`Delete ${selectedRiders.size} riders?`)) return;

        const riderIds = Array.from(selectedRiders);
        const totalCount = riderIds.length;

        try {
            toast.loading(`Deleting ${totalCount} riders...`, { id: 'bulk-delete' });

            const CHUNK_SIZE = 50;
            for (let i = 0; i < riderIds.length; i += CHUNK_SIZE) {
                const chunk = riderIds.slice(i, i + CHUNK_SIZE);
                const { error } = await supabase.from('riders').update({
                    status: 'deleted' as RiderStatus,
                    deleted_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                }).in('id', chunk);

                if (error) throw error;
            }

            await logActivity({
                actionType: 'riderDeleted',
                targetType: 'rider',
                targetId: 'multiple',
                details: `Bulk deleted ${totalCount} riders`,
                performedBy: currentUser?.email
            });

            // Summary notifications
            const affectedTLs = new Map<string, number>();
            riderIds.forEach(id => {
                const rider = riders.find(r => r.id === id);
                if (rider?.teamLeaderId) {
                    affectedTLs.set(rider.teamLeaderId, (affectedTLs.get(rider.teamLeaderId) || 0) + 1);
                }
            });
            for (const [tlId, count] of affectedTLs) {
                notifyTeamLeader(tlId, 'status_inactive', `${count} rider(s)`, 'bulk').catch(() => {});
            }

            toast.success(`${totalCount} riders deleted`, { id: 'bulk-delete' });
            setSelectedRiders(new Set());
            await fetchData();
        } catch (error) {
            console.error('Error in bulk delete:', error);
            toast.error(`Failed to delete riders: ${(error as any)?.message || 'Unknown error'}`, { id: 'bulk-delete' });
        }
    };

    const handleBulkAssignTL = async (newTLId: string) => {
        if (!newTLId) return;

        const riderIds = Array.from(selectedRiders);
        const totalCount = riderIds.length;

        try {
            const newTL = teamLeaders.find(u => u.id === newTLId);
            const newTLName = newTL?.fullName || 'Unknown';

            toast.loading(`Assigning ${totalCount} riders to ${newTLName}...`, { id: 'bulk-assign' });

            // Collect old TLs for notification before update
            const oldTLCounts = new Map<string, number>();
            riderIds.forEach(id => {
                const rider = riders.find(r => r.id === id);
                if (rider?.teamLeaderId && rider.teamLeaderId !== newTLId) {
                    oldTLCounts.set(rider.teamLeaderId, (oldTLCounts.get(rider.teamLeaderId) || 0) + 1);
                }
            });

            // Single batch update — process in chunks of 50
            const CHUNK_SIZE = 50;
            for (let i = 0; i < riderIds.length; i += CHUNK_SIZE) {
                const chunk = riderIds.slice(i, i + CHUNK_SIZE);
                const { error } = await supabase.from('riders').update({
                    team_leader_id: newTLId,
                    team_leader_name: newTLName,
                    updated_at: new Date().toISOString(),
                }).in('id', chunk);

                if (error) throw error;

                // Show progress for large batches
                if (riderIds.length > CHUNK_SIZE) {
                    const done = Math.min(i + CHUNK_SIZE, riderIds.length);
                    toast.loading(`Assigned ${done}/${totalCount} riders...`, { id: 'bulk-assign' });
                }
            }

            await logActivity({
                actionType: 'riderEdited',
                targetType: 'rider',
                targetId: 'multiple',
                details: `Reassigned ${totalCount} riders to ${newTLName}`,
                performedBy: currentUser?.email
            });

            // Fire-and-forget summary notifications
            // Notify old TLs about removal
            for (const [tlId, count] of oldTLCounts) {
                notifyTeamLeader(tlId, 'reassign_from', `${count} rider(s)`, 'bulk').catch(() => {});
            }
            // Notify new TL about assignment
            notifyTeamLeader(newTLId, 'reassign_to', `${totalCount} rider(s)`, 'bulk').catch(() => {});

            toast.success(`${totalCount} riders assigned to ${newTLName}`, { id: 'bulk-assign' });
            setSelectedRiders(new Set());
            setShowBulkAssignTL(false);
            await fetchData();
        } catch (error) {
            console.error('Error in bulk reassignment:', error);
            toast.error(`Failed to reassign riders: ${(error as any)?.message || 'Unknown error'}`, { id: 'bulk-assign' });
        }
    };

    const handleSelectAll = () => {
        if (selectedRiders.size === paginatedRiders.length) {
            setSelectedRiders(new Set());
        } else {
            const allIds = new Set(paginatedRiders.map(r => r.id));
            setSelectedRiders(allIds);
        }
    };

    const handleSelectOne = (riderId: string) => {
        const newSelected = new Set(selectedRiders);
        if (newSelected.has(riderId)) {
            newSelected.delete(riderId);
        } else {
            newSelected.add(riderId);
        }
        setSelectedRiders(newSelected);
    };

    const handleCall = (phoneNumber: string) => {
        window.open(getCallLink(phoneNumber), '_self');
    };

    const handleWhatsApp = (phoneNumber: string) => {
        window.open(getWhatsAppLink(phoneNumber), '_blank');
    };

    const handleExport = async (format: ExportFormat) => {
        const ridersToExport = filteredRiders.filter(r =>
            selectedRiders.size === 0 || selectedRiders.has(r.id)
        );
        const filename = `riders_export_${activeTab}_${new Date().toISOString().split('T')[0]}`;

        try {
            if (format === 'csv') exportRidersToCSV(ridersToExport, filename);
            else if (format === 'excel') exportRidersToExcel(ridersToExport, filename);
            else if (format === 'pdf') exportRidersToPDF(ridersToExport, filename, 'Rider Export');

            await logActivity({
                actionType: 'reportGenerated',
                targetType: 'rider',
                targetId: 'multiple',
                details: `Exported ${ridersToExport.length} riders as ${format}`,
                performedBy: currentUser?.email
            });
            toast.success('Export started');
        } catch (e) {
            console.error(e);
            toast.error("Export Failed");
        }
    };

    const handleSort = (column: keyof Rider) => {
        if (sortBy === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(column);
            setSortOrder('asc');
        }
    };

    const handleBulkCommunication = async (message: string) => {
        const selectedRidersList = filteredRiders.filter(r => selectedRiders.has(r.id));

        if (selectedRidersList.length === 0) {
            toast.error('No riders selected');
            return;
        }

        try {
            // Open WhatsApp for each rider
            for (const rider of selectedRidersList) {
                const amountStr = rider.walletAmount < 0
                    ? `-${Math.abs(rider.walletAmount).toLocaleString('en-IN')}`
                    : Math.abs(rider.walletAmount).toLocaleString('en-IN');

                const personalizedMessage = message
                    .replace('{name}', rider.riderName)
                    .replace('{amount}', amountStr);

                const encodedMessage = encodeURIComponent(personalizedMessage);
                const cleanNumber = rider.mobileNumber.replace(/\D/g, '');

                // Open WhatsApp in new tab
                window.open(`https://wa.me/${cleanNumber}?text=${encodedMessage}`, '_blank');

                // Small delay between opening tabs
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            await logActivity({
                actionType: 'bulk_communication',
                targetType: 'rider',
                targetId: 'multiple',
                details: `Sent bulk communication to ${selectedRidersList.length} riders`,
                performedBy: currentUser?.email
            });

            toast.success(`Opened WhatsApp for ${selectedRidersList.length} rider(s)`);
            setSelectedRiders(new Set());
        } catch (error) {
            console.error('Error sending bulk communication:', error);
            toast.error('Failed to send messages');
        }
    };

    const handleReassignRider = async (newTLId: string) => {
        if (!reassigningRider) return;

        try {
            const oldTLId = reassigningRider.teamLeaderId;
            const newTL = teamLeaders.find(u => u.id === newTLId);
            const newTLName = newTL?.fullName || 'Unknown';

            const { error } = await supabase.from('riders').update({
                team_leader_id: newTLId,
                team_leader_name: newTLName,
                updated_at: new Date().toISOString(),
            }).eq('id', reassigningRider.id);

            if (error) throw error;

            await logActivity({
                actionType: 'riderEdited',
                targetType: 'rider',
                targetId: reassigningRider.id,
                details: `Reassigned rider ${reassigningRider.riderName} to ${newTLName}`,
                performedBy: currentUser?.email
            });

            // Notify Old & New TL
            await notifyTeamLeader(oldTLId, 'reassign_from', reassigningRider.riderName, reassigningRider.id);
            await notifyTeamLeader(newTLId, 'reassign_to', reassigningRider.riderName, reassigningRider.id);

            toast.success('Rider reassigned successfully');
            await fetchData();
            setReassigningRider(null);
        } catch (error) {
            console.error('Error reassigning rider:', error);
            toast.error('Failed to reassign rider');
        }
    };



    // Sub-components helpers
    const totalPages = Math.ceil(filteredRiders.length / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const paginatedRiders = filteredRiders.slice(startIndex, startIndex + pageSize);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading riders...</p>
                </div>
            </div>
        );
    }

    const handleBulkRestore = async () => {
        if (selectedRiders.size === 0) return;
        if (!confirm(`Restore ${selectedRiders.size} riders?`)) return;

        try {
            const updates = Array.from(selectedRiders).map(async (riderId) => {
                const rider = riders.find(r => r.id === riderId);
                const { error } = await supabase.from('riders').update({
                    status: 'active',
                    deleted_at: null,
                    updated_at: new Date().toISOString(),
                }).eq('id', riderId);

                if (error) throw error;
                if (rider) await notifyTeamLeader(rider.teamLeaderId, 'status_active', rider.riderName, rider.id);
            });

            await Promise.all(updates);
            await logActivity({
                actionType: 'riderRestored',
                targetType: 'rider',
                targetId: 'multiple',
                details: `Bulk restored ${selectedRiders.size} riders`,
                performedBy: currentUser?.email
            });

            toast.success('Riders restored successfully');
            setSelectedRiders(new Set());
            await fetchData();
        } catch (error) {
            console.error('Error in bulk restore:', error);
            toast.error('Failed to restore riders');
        }
    };

    const handleBulkPermanentDelete = async () => {
        if (currentUser?.role !== 'admin') {
            toast.error("Security Alert: Only Super Admins can permanently delete records.");
            return;
        }
        if (selectedRiders.size === 0) return;
        if (!confirm(`PERMANENTLY DELETE ${selectedRiders.size} riders? This cannot be undone.`)) return;

        try {
            const idsToDelete = Array.from(selectedRiders);

            // 1. Delete dependent data (Manual Cascade)

            // A. Ledger (New System)
            const { error: wlError } = await supabase
                .from('wallet_ledger')
                .delete()
                .in('rider_id', idsToDelete);

            if (wlError) {
                console.error('Error deleting wallet ledger (bulk):', wlError);
                throw new Error('Failed to clean up wallet ledger. Bulk deletion aborted.');
            }

            // B. Wallet Transactions (Legacy)
            const { error: wtError } = await supabase
                .from('wallet_transactions')
                .delete()
                .in('rider_id', idsToDelete);

            if (wtError) {
                console.warn('Error deleting legacy wallet transactions (bulk, non-fatal):', wtError);
            }

            // Requests (Manual Cascade)
            const { error: reqError } = await supabase
                .from('requests')
                .delete()
                .in('related_entity_id', idsToDelete)
                .eq('related_entity_type', 'rider');

            if (reqError) {
                console.error('Error deleting requests (bulk):', reqError);
            }

            // 2. Delete Riders
            const { error } = await supabase.from('riders').delete().in('id', idsToDelete);
            if (error) throw error;

            await logActivity({
                actionType: 'riderPermanentlyDeleted',
                targetType: 'rider',
                targetId: 'multiple',
                details: `Bulk PERMANENTLY deleted ${selectedRiders.size} riders`,
                performedBy: currentUser?.email
            });

            toast.success('Riders permanently deleted');
            setSelectedRiders(new Set());
            await fetchData();
        } catch (error: any) {
            console.error('Error in bulk permanent delete:', error);
            toast.error(`Failed to permanently delete riders: ${error.message || 'Unknown error'}`);
        }
    };

    // Determine Actions based on Tab
    const getBulkActions = () => {
        const commonActions = [
            { label: 'Assign TL', onClick: () => setShowBulkAssignTL(true), variant: 'default' as const, icon: <Users size={14} /> }
        ];

        if (activeTab === 'deleted') {
            return [
                { label: 'Restore', onClick: handleBulkRestore, variant: 'premium' as const, icon: <RefreshCw size={14} /> },
                ...commonActions,
                { label: 'Permanently Delete', onClick: handleBulkPermanentDelete, variant: 'destructive' as const, icon: <Trash2 size={14} /> }
            ];
        }

        return [
            { label: 'Set Active', onClick: () => handleBulkStatusChange('active'), variant: 'default' as const, icon: <CheckCircle size={14} className="text-green-500" /> },
            { label: 'Set Inactive', onClick: () => handleBulkStatusChange('inactive'), variant: 'default' as const, icon: <XCircle size={14} className="text-amber-500" /> },
            { label: 'Communicate', onClick: () => setShowBulkCommunicationModal(true), variant: 'premium' as const, icon: <Send size={14} /> },
            ...commonActions,
            { label: 'Delete', onClick: handleBulkDelete, variant: 'destructive' as const, icon: <Trash2 size={14} /> }
        ];
    };

    // Table Columns Definition
    const columns: Column<Rider>[] = [
        {
            header: <input
                type="checkbox"
                onChange={(e) => {
                    e.stopPropagation();
                    handleSelectAll();
                }}
                className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/20 accent-primary"
                checked={paginatedRiders.length > 0 && paginatedRiders.every(r => selectedRiders.has(r.id))}
            />,
            accessorKey: 'id',
            className: 'w-10 text-center',
            cell: (rider) => (
                <div onClick={(e) => e.stopPropagation()} className="flex items-center justify-center">
                    <input
                        type="checkbox"
                        checked={selectedRiders.has(rider.id)}
                        onChange={() => handleSelectOne(rider.id)}
                        className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/20 accent-primary cursor-pointer"
                    />
                </div>
            )
        },
        {
            header: <span className="cursor-pointer tracking-widest" onClick={() => handleSort('trievId')}>ID</span>,
            accessorKey: 'trievId',
            cell: (rider) => (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setViewingRider(rider);
                    }}
                    className="text-primary hover:text-primary/70 font-black font-mono text-[11px] tracking-tighter"
                >
                    {rider.trievId}
                </button>
            )
        },
        {
            header: <span className="cursor-pointer tracking-widest" onClick={() => handleSort('riderName')}>Full Name</span>,
            accessorKey: 'riderName',
            cell: (rider) => (
                <div className="flex flex-col">
                    <span className="font-bold text-slate-700 dark:text-slate-200">{rider.riderName}</span>
                    <span className="text-[10px] text-slate-400 font-medium">{rider.clientName || 'Standalone'}</span>
                </div>
            )
        },
        {
            header: <span className="tracking-widest">Contact Info</span>,
            accessorKey: 'mobileNumber',
            cell: (rider) => (
                <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{rider.mobileNumber}</span>
                    </div>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => handleCall(rider.mobileNumber)} className="p-1.5 text-slate-400 hover:text-green-500 hover:bg-green-50 rounded-lg transition-all" title="Call"><Phone size={14} /></button>
                        <button onClick={() => handleWhatsApp(rider.mobileNumber)} className="p-1.5 text-slate-400 hover:text-green-500 hover:bg-green-50 rounded-lg transition-all" title="WhatsApp"><MessageCircle size={14} /></button>
                    </div>
                </div>
            )
        },
        {
            header: <span className="tracking-widest">Asset Details</span>,
            accessorKey: 'chassisNumber',
            cell: (rider) => (
                <div className="flex flex-col">
                    <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-tighter">{rider.chassisNumber || 'N/A'}</span>
                    <span className="text-[9px] text-slate-400 uppercase font-black">Chassis Info</span>
                </div>
            )
        },
        {
            header: <span className="cursor-pointer tracking-widest text-center" onClick={() => handleSort('walletAmount')}>Ledger Balance</span>,
            accessorKey: 'walletAmount',
            className: 'text-center',
            cell: (rider) => (
                <div className="flex flex-col items-center justify-center gap-1">
                    <div className={`
                        px-3 py-1 rounded-full text-[11px] font-black tracking-tight flex items-center gap-1.5
                        ${rider.walletAmount > 0
                            ? 'bg-green-500/10 text-green-600 border border-green-500/20'
                            : rider.walletAmount < 0
                                ? 'bg-red-500/10 text-red-600 border border-red-500/20 shadow-[0_4px_12px_rgba(239,68,68,0.1)]'
                                : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                        }
                    `}>
                        {rider.walletAmount < 0 ? '-' : ''}₹{Math.abs(rider.walletAmount).toLocaleString('en-IN')}
                        {rider.walletAmount < 0 && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setReminderRider(rider);
                                }}
                                className="ml-1 p-1.5 bg-red-500 text-white rounded-full hover:scale-110 transition-transform"
                                title="Send AI Penalty/Reminder"
                            >
                                <Send size={16} />
                            </button>
                        )}
                        {rider.status === 'active' && rider.walletAmount >= 0 && rider.walletAmount <= 250 && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleLowBalanceReminder(rider);
                                }}
                                className="ml-1 p-1.5 bg-orange-500 text-white rounded-full hover:scale-110 transition-transform"
                                title="Send Low Balance WhatsApp Reminder"
                            >
                                <MessageCircle size={16} />
                            </button>
                        )}
                    </div>
                </div >
            )
        },
        {
            header: <span className="tracking-widest">Status</span>,
            accessorKey: 'status',
            cell: (rider) => (
                <div className={`
                    w-fit px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-[0.15em] border
                    ${rider.status === 'active'
                        ? 'bg-green-500/5 text-green-600 border-green-500/20 shadow-[0_2px_10px_rgba(34,197,94,0.1)]'
                        : rider.status === 'inactive'
                            ? 'bg-amber-500/5 text-amber-600 border-amber-500/20'
                            : 'bg-red-500/5 text-red-600 border-red-500/20'
                    }
                `}>
                    {rider.status}
                </div>
            )
        },
        {
            header: <span className="cursor-pointer tracking-widest" onClick={() => handleSort('teamLeaderName')}>Captain / TL</span>,
            accessorKey: 'teamLeaderName',
            cell: (rider) => (
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">
                        {rider.teamLeaderName?.charAt(0) || <Users size={12} />}
                    </div>
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{rider.teamLeaderName || 'Unassigned'}</span>
                </div>
            )
        },
    ];

    return (

        <div className="space-y-6">
            {/* ... (Header, Tabs, Filters code remains same) ... */}

            {/* Header */}
            <div className="flex flex-col gap-6 mb-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-4xl font-extrabold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                            Rider Management
                        </h1>
                        <p className="text-muted-foreground mt-2 text-lg">
                            Manage your fleet, track performance, and organize teams efficiently.
                        </p>
                    </div>
                    {(currentUser?.permissions?.riders?.create ?? true) && (
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="bg-primary text-primary-foreground px-6 py-3 rounded-xl hover:bg-primary/90 transition-all shadow-lg hover:shadow-primary/25 flex items-center gap-2 font-semibold group"
                        >
                            <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                            Add New Rider
                        </button>
                    )}
                </div>
            </div>

            {/* Enhanced Segmented Tabs */}
            <div className="relative p-1 bg-slate-100/50 dark:bg-slate-900/50 backdrop-blur-xl rounded-[2rem] border border-slate-200/50 dark:border-slate-800/50 w-fit mx-auto md:mx-0 shadow-sm">
                <div className="flex flex-wrap md:flex-nowrap gap-1">
                    {tabConfig.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        const count = getTabCount(tab.id as TabType);

                        return (
                            <button
                                key={tab.id}
                                onClick={() => handleTabChange(tab.id as TabType)}
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
                                        layoutId="activeTabBackground"
                                        className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-primary rounded-full shadow-lg shadow-primary/20"
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

            {/* Filters & Toolbar */}
            <div className="bg-card border border-border/50 rounded-xl p-4 shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    {/* Search */}
                    <div className="relative flex-1 w-full md:max-w-xl">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={18} />
                        <input
                            type="text"
                            placeholder="Search by name, ID, mobile, chassis, or Team Leader..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-background/50 hover:bg-background"
                        />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <button
                            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                            className={`px-4 py-2.5 border rounded-lg hover:bg-accent transition-all flex items-center gap-2 font-medium text-sm flex-1 md:flex-none justify-center ${showAdvancedFilters ? 'bg-primary/5 border-primary text-primary shadow-sm' : 'border-input bg-background'}`}
                        >
                            {showAdvancedFilters ? <SlidersHorizontal size={18} /> : <Filter size={18} />}
                            {showAdvancedFilters ? 'Hide Filters' : 'Filters'}
                            {(() => {
                                const activeCount = [advancedFilters.teamLeader !== 'all', advancedFilters.client !== 'all', advancedFilters.walletRange !== 'all'].filter(Boolean).length;
                                return activeCount > 0 ? (
                                    <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black bg-primary text-white">
                                        {activeCount}
                                    </span>
                                ) : null;
                            })()}
                        </button>
                        <button
                            onClick={() => setShowExportModal(true)}
                            className="px-4 py-2.5 border border-input bg-background rounded-lg hover:bg-accent transition-all flex items-center gap-2 font-medium text-sm flex-1 md:flex-none justify-center group"
                        >
                            <Download size={18} className="text-muted-foreground group-hover:text-primary transition-colors" />
                            Export
                        </button>
                    </div>
                </div>

                {/* Advanced Filters Panel */}
                {showAdvancedFilters && (
                    <div className="pt-4 border-t border-border/50 animate-in slide-in-from-top-2 duration-200 space-y-4">
                        {/* Active filters summary */}
                        {(advancedFilters.teamLeader !== 'all' || advancedFilters.client !== 'all' || advancedFilters.walletRange !== 'all' || advancedFilters.reportingManager !== 'all') && (
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Active:</span>
                                {advancedFilters.teamLeader !== 'all' && (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                                        TL: {teamLeaders.find(t => t.id === advancedFilters.teamLeader)?.fullName || 'Unknown'}
                                        <button onClick={() => setAdvancedFilters(p => ({ ...p, teamLeader: 'all' }))} className="ml-0.5 hover:text-red-500 transition-colors">&times;</button>
                                    </span>
                                )}
                                {advancedFilters.client !== 'all' && (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-500/10 text-violet-600 border border-violet-500/20">
                                        Client: {advancedFilters.client}
                                        <button onClick={() => setAdvancedFilters(p => ({ ...p, client: 'all' }))} className="ml-0.5 hover:text-red-500 transition-colors">&times;</button>
                                    </span>
                                )}
                                {advancedFilters.walletRange !== 'all' && (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                        Wallet: {advancedFilters.walletRange.replace('_', ' ')}
                                        <button onClick={() => setAdvancedFilters(p => ({ ...p, walletRange: 'all' }))} className="ml-0.5 hover:text-red-500 transition-colors">&times;</button>
                                    </span>
                                )}
                                {advancedFilters.reportingManager !== 'all' && (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-500/10 text-teal-600 border border-teal-500/20">
                                        RM: {advancedFilters.reportingManager}
                                        <button onClick={() => setAdvancedFilters(p => ({ ...p, reportingManager: 'all' }))} className="ml-0.5 hover:text-red-500 transition-colors">&times;</button>
                                    </span>
                                )}
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
                            {/* ═══ Team Leader — Searchable Scrollable Dropdown ═══ */}
                            <div className="relative" ref={tlDropdownRef}>
                                <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-1.5">
                                    Team Leader
                                </label>
                                <button
                                    type="button"
                                    onClick={() => { setShowTLDropdown(prev => !prev); setTlSearchQuery(''); }}
                                    className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 border rounded-lg text-sm font-medium transition-all text-left
                                        ${advancedFilters.teamLeader !== 'all'
                                            ? 'border-primary bg-primary/5 text-foreground ring-1 ring-primary/20'
                                            : 'border-input bg-background/50 text-foreground hover:border-primary/40'
                                        }`}
                                >
                                    <span className="truncate block w-full">
                                        {advancedFilters.teamLeader === 'all'
                                            ? 'All Team Leaders'
                                            : teamLeaders.find(t => t.id === advancedFilters.teamLeader)?.fullName || 'Unknown'
                                        }
                                    </span>
                                    <svg className={`w-4 h-4 flex-shrink-0 text-muted-foreground transition-transform ${showTLDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                {/* Dropdown panel */}
                                {showTLDropdown && (
                                    <div className="absolute z-[100] mt-1 w-full min-w-[280px] bg-card border border-border rounded-xl shadow-2xl shadow-black/10 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                                        {/* Search input */}
                                        <div className="p-2 border-b border-border/50">
                                            <div className="relative">
                                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" size={14} />
                                                <input
                                                    type="text"
                                                    placeholder="Search Team Leader..."
                                                    value={tlSearchQuery}
                                                    onChange={(e) => setTlSearchQuery(e.target.value)}
                                                    autoFocus
                                                    className="w-full pl-8 pr-3 py-2 text-sm border border-input rounded-lg bg-background/80 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary placeholder:text-muted-foreground/50"
                                                />
                                            </div>
                                        </div>

                                        {/* Scrollable list */}
                                        <div className="max-h-[240px] overflow-y-auto overscroll-contain">
                                            {/* "All" option */}
                                            <button
                                                type="button"
                                                onClick={() => { setAdvancedFilters(p => ({ ...p, teamLeader: 'all' })); setShowTLDropdown(false); }}
                                                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors text-left hover:bg-accent/50
                                                    ${advancedFilters.teamLeader === 'all' ? 'bg-primary/5 text-primary font-bold' : 'text-foreground'}
                                                `}
                                            >
                                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center flex-shrink-0">
                                                    <Users size={13} className="text-slate-500 dark:text-slate-400" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <span className="block font-semibold">All Team Leaders</span>
                                                    <span className="text-[10px] text-muted-foreground">{riders.length} riders total</span>
                                                </div>
                                                {advancedFilters.teamLeader === 'all' && (
                                                    <CheckCircle size={16} className="text-primary flex-shrink-0" />
                                                )}
                                            </button>

                                            {/* "Unassigned" option */}
                                            {(() => {
                                                const unassignedCount = riders.filter(r => !r.teamLeaderId).length;
                                                if (unassignedCount > 0 && (!tlSearchQuery || 'unassigned'.includes(tlSearchQuery.toLowerCase()))) {
                                                    return (
                                                        <button
                                                            type="button"
                                                            onClick={() => { setAdvancedFilters(p => ({ ...p, teamLeader: 'unassigned' })); setShowTLDropdown(false); }}
                                                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors text-left hover:bg-accent/50
                                                                ${advancedFilters.teamLeader === 'unassigned' ? 'bg-primary/5 text-primary font-bold' : 'text-foreground'}
                                                            `}
                                                        >
                                                            <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                                                                <span className="text-amber-600 text-[10px] font-black">?</span>
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <span className="block font-semibold">Unassigned</span>
                                                                <span className="text-[10px] text-muted-foreground">{unassignedCount} rider{unassignedCount !== 1 ? 's' : ''}</span>
                                                            </div>
                                                            {advancedFilters.teamLeader === 'unassigned' && (
                                                                <CheckCircle size={16} className="text-primary flex-shrink-0" />
                                                            )}
                                                        </button>
                                                    );
                                                }
                                                return null;
                                            })()}

                                            {/* TL list */}
                                            {teamLeaders
                                                .filter(tl => !tlSearchQuery || tl.fullName.toLowerCase().includes(tlSearchQuery.toLowerCase()))
                                                .sort((a, b) => a.fullName.localeCompare(b.fullName))
                                                .map(tl => {
                                                    const riderCount = riders.filter(r => r.teamLeaderId === tl.id).length;
                                                    const activeCount = riders.filter(r => r.teamLeaderId === tl.id && r.status === 'active').length;
                                                    return (
                                                        <button
                                                            key={tl.id}
                                                            type="button"
                                                            onClick={() => { setAdvancedFilters(p => ({ ...p, teamLeader: tl.id })); setShowTLDropdown(false); }}
                                                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors text-left hover:bg-accent/50
                                                                ${advancedFilters.teamLeader === tl.id ? 'bg-primary/5 text-primary font-bold' : 'text-foreground'}
                                                            `}
                                                        >
                                                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-900/40 dark:to-violet-900/40 flex items-center justify-center flex-shrink-0">
                                                                <span className="text-indigo-600 dark:text-indigo-400 text-[11px] font-black">
                                                                    {tl.fullName.charAt(0).toUpperCase()}
                                                                </span>
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <span className="block font-semibold whitespace-normal break-words leading-tight">{tl.fullName}</span>
                                                                <span className="text-[10px] text-muted-foreground">
                                                                    {activeCount} active · {riderCount} total
                                                                </span>
                                                            </div>
                                                            {advancedFilters.teamLeader === tl.id && (
                                                                <CheckCircle size={16} className="text-primary flex-shrink-0" />
                                                            )}
                                                        </button>
                                                    );
                                                })
                                            }

                                            {/* No results */}
                                            {tlSearchQuery && teamLeaders.filter(tl => tl.fullName.toLowerCase().includes(tlSearchQuery.toLowerCase())).length === 0 && (
                                                <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                                                    No team leader matches "<strong>{tlSearchQuery}</strong>"
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* ═══ Client Filter ═══ */}
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-1.5">Client</label>
                                <select
                                    value={advancedFilters.client}
                                    onChange={(e) => setAdvancedFilters({ ...advancedFilters, client: e.target.value as ClientName | 'all' })}
                                    className={`w-full px-3 py-2.5 border rounded-lg text-sm font-medium transition-all outline-none
                                        ${advancedFilters.client !== 'all'
                                            ? 'border-violet-500 bg-violet-500/5 ring-1 ring-violet-500/20'
                                            : 'border-input bg-background/50 hover:border-primary/40'
                                        } focus:ring-2 focus:ring-primary/20 focus:border-primary`}
                                >
                                    <option value="all">All Clients</option>
                                    {['Zomato', 'Zepto', 'Blinkit', 'Uber', 'Porter', 'Rapido', 'Swiggy', 'FLK', 'Other'].map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>

                            {/* ═══ Wallet Status Filter ═══ */}
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-1.5">Wallet Status</label>
                                <select
                                    value={advancedFilters.walletRange}
                                    onChange={(e) => setAdvancedFilters({ ...advancedFilters, walletRange: e.target.value as any })}
                                    className={`w-full px-3 py-2.5 border rounded-lg text-sm font-medium transition-all outline-none
                                        ${advancedFilters.walletRange !== 'all'
                                            ? 'border-amber-500 bg-amber-500/5 ring-1 ring-amber-500/20'
                                            : 'border-input bg-background/50 hover:border-primary/40'
                                        } focus:ring-2 focus:ring-primary/20 focus:border-primary`}
                                >
                                    <option value="all">All Wallets</option>
                                    <option value="positive">✅ Positive Balance</option>
                                    <option value="negative">🔴 Negative Balance</option>
                                    <option value="zero">⚪ Zero Balance</option>
                                    <option value="low_balance">⚠️ Low Balance (₹0–250)</option>
                                    <option value="high_debt">🚨 High Debt (&lt; ₹-3,000)</option>
                                </select>
                            </div>

                            {/* ═══ Reporting Manager Filter ═══ */}
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-1.5">Reporting Manager</label>
                                <select
                                    value={advancedFilters.reportingManager}
                                    onChange={(e) => setAdvancedFilters({ ...advancedFilters, reportingManager: e.target.value })}
                                    className={`w-full px-3 py-2.5 border rounded-lg text-sm font-medium transition-all outline-none
                                        ${advancedFilters.reportingManager !== 'all'
                                            ? 'border-teal-500 bg-teal-500/5 ring-1 ring-teal-500/20'
                                            : 'border-input bg-background/50 hover:border-primary/40'
                                        } focus:ring-2 focus:ring-primary/20 focus:border-primary`}
                                >
                                    <option value="all">All Managers</option>
                                    {Array.from(new Set(teamLeaders.map(tl => tl.reportingManager).filter(Boolean))).sort().map(rm => (
                                        <option key={rm} value={rm}>{rm} ({teamLeaders.filter(tl => tl.reportingManager === rm).length} TLs)</option>
                                    ))}
                                </select>
                            </div>

                            {/* ═══ Reset Button ═══ */}
                            <div className="flex items-end">
                                <button
                                    onClick={() => { setAdvancedFilters({ teamLeader: 'all', client: 'all', walletRange: 'all', reportingManager: 'all' }); setTlSearchQuery(''); setShowTLDropdown(false); }}
                                    className="w-full px-4 py-2.5 border border-dashed border-input rounded-lg hover:bg-accent text-sm text-muted-foreground hover:text-foreground transition-all flex items-center justify-center gap-2 font-medium"
                                >
                                    <RefreshCw size={14} /> Reset All Filters
                                </button>
                            </div>
                        </div>

                        {/* Filter result count */}
                        <div className="text-[11px] text-muted-foreground font-medium">
                            Showing <strong className="text-foreground">{filteredRiders.length}</strong> of <strong className="text-foreground">{riders.length}</strong> riders
                        </div>
                    </div>
                )}
            </div>

            {/* Bulk Actions */}
            {selectedRiders.size > 0 && (
                <BulkActionsBar
                    selectedCount={selectedRiders.size}
                    totalCount={filteredRiders.length}
                    onSelectAll={() => setSelectedRiders(new Set(filteredRiders.map(r => r.id)))}
                    onDeselectAll={() => setSelectedRiders(new Set())}
                    actions={getBulkActions() as any}
                />
            )}

            {/* Desktop and Mobile Table */}
            <ResponsiveTable
                columns={columns}
                data={paginatedRiders}
                keyField="id"
                isLoading={loading}
                emptyMessage="No riders found matching your criteria."
                highlightedRowId={highlightedRiderId}
                onRowClick={(rider) => setViewingRider(rider)}
                actions={(rider) => (
                    <ActionDropdownMenu
                        rider={rider}
                        onView={() => setViewingRider(rider)}
                        onEdit={() => setEditingRider(rider)}
                        onStatusChange={(s) => handleStatusChange(rider, s)}
                        onDelete={() => handleDeleteRider(rider)}
                        onRestore={() => handleRestoreRider(rider)}
                        onPermanentDelete={() => handlePermanentDelete(rider)}
                        onReassign={() => setReassigningRider(rider)}
                        onAdjustWallet={() => setAdjustmentRider(rider)}
                        userRole="admin"
                    />
                )}
            />

            {/* Modals */}
            <TLMappingModal
                isOpen={!!reassigningRider || showBulkAssignTL}
                onClose={() => {
                    setReassigningRider(null);
                    setShowBulkAssignTL(false);
                }}
                onSave={showBulkAssignTL ? handleBulkAssignTL : handleReassignRider}
                currentTLId={reassigningRider?.teamLeaderId}
                teamLeaders={teamLeaders}
                riderName={reassigningRider?.riderName}
                count={showBulkAssignTL ? selectedRiders.size : undefined}
            />

            {/* Pagination Footer */}
            <div className="border-t border-border px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Rows per page:</span>
                    <select
                        value={pageSize}
                        onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                        className="px-2 py-1 border border-input rounded bg-background text-sm"
                    >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                    </select>
                    <span className="text-sm text-muted-foreground ml-4">
                        Showing {startIndex + 1}-{Math.min(startIndex + pageSize, filteredRiders.length)} of {filteredRiders.length}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setCurrentPage(c => Math.max(1, c - 1))} disabled={currentPage === 1} className="p-2 border rounded hover:bg-accent"><ChevronLeft size={16} /></button>
                    <span className="text-sm">Page {currentPage} of {totalPages || 1}</span>
                    <button onClick={() => setCurrentPage(c => Math.min(totalPages, c + 1))} disabled={currentPage === totalPages} className="p-2 border rounded hover:bg-accent"><ChevronRight size={16} /></button>
                </div>
            </div>


            {/* Modals */}
            {showAddModal && <AddRiderForm onClose={() => setShowAddModal(false)} onSubmit={handleAddRider} teamLeaders={teamLeaders} userRole="admin" />}
            {editingRider && <AddRiderForm onClose={() => setEditingRider(null)} onSubmit={handleEditRider} initialData={editingRider} isEdit teamLeaders={teamLeaders} userRole="admin" />}
            {viewingRider && (
                <RiderDetailsModal
                    rider={viewingRider}
                    onClose={() => setViewingRider(null)}
                    onUpdate={fetchData}
                />
            )}
            {
                showExportModal && (
                    <ExportModal
                        isOpen={showExportModal}
                        onClose={() => setShowExportModal(false)}
                        onExport={handleExport}
                        availableColumns={[
                            { key: 'trievId', label: 'Triev ID' },
                            { key: 'riderName', label: 'Rider Name' },
                            { key: 'mobileNumber', label: 'Mobile Number' },
                            { key: 'chassisNumber', label: 'Chassis Number' },
                            { key: 'clientName', label: 'Client Name' },
                            { key: 'clientId', label: 'Client ID' },
                            { key: 'walletAmount', label: 'Wallet Amount' },
                            { key: 'status', label: 'Status' },
                            { key: 'teamLeaderName', label: 'Team Leader' },
                            { key: 'allotmentDate', label: 'Allotment Date' },
                            { key: 'remarks', label: 'Remarks' },
                        ]}
                    />
                )
            }
            {
                reassigningRider && (
                    <TLMappingModal
                        isOpen={!!reassigningRider}
                        onClose={() => setReassigningRider(null)}
                        onSave={handleReassignRider}
                        currentTLId={reassigningRider.teamLeaderId}
                        teamLeaders={teamLeaders}
                        riderName={reassigningRider.riderName}
                    />
                )
            }
            {
                reminderRider && (
                    <PaymentReminderModal
                        rider={reminderRider}
                        onClose={() => setReminderRider(null)}
                        onSend={handleSendReminder}
                    />
                )
            }
            {
                showBulkCommunicationModal && (
                    <BulkCommunicationModal
                        riders={filteredRiders.filter(r => selectedRiders.has(r.id))}
                        onClose={() => setShowBulkCommunicationModal(false)}
                        onSend={handleBulkCommunication}
                    />
                )
            }
            {
                adjustmentRider && (
                    <WalletAdjustmentModal
                        riderId={adjustmentRider.id}
                        riderName={adjustmentRider.riderName}
                        currentBalance={adjustmentRider.walletAmount}
                        onClose={() => setAdjustmentRider(null)}
                        onSuccess={() => {
                            fetchData();
                        }}
                    />
                )
            }
            {selectedReminderRider && (
                <AIReminderModal
                    isOpen={true}
                    onClose={() => setSelectedReminderRider(null)}
                    rider={selectedReminderRider}
                    type={reminderType}
                />
            )}
        </div >
    );
};

export default RiderManagement;
