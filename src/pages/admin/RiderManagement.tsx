import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/config/supabase';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { Rider, User, RiderStatus, ClientName } from '@/types';
import { Plus, Search, Filter, Download, Phone, MessageCircle, Trash2, ChevronLeft, ChevronRight, RefreshCw, Users, SlidersHorizontal } from 'lucide-react';
import AddRiderForm from '@/components/AddRiderForm';
import RiderDetailsModal from '@/components/RiderDetailsModal';
import ExportModal, { ExportFormat } from '@/components/ExportModal';
import BulkActionsBar from '@/components/BulkActionsBar';
import TLMappingModal from '@/components/TLMappingModal';
import { exportRidersToCSV, exportRidersToExcel, exportRidersToPDF } from '@/utils/exportUtils';
import ActionDropdownMenu from '@/components/ActionDropdownMenu';
import { notifyTeamLeader } from '@/utils/notificationUtils';
import { logActivity } from '@/utils/activityLog';
import { useDebounce } from '@/hooks/useDebounce';
import PaymentReminderModal from '@/components/PaymentReminderModal';
import { toast } from 'sonner';

type TabType = 'all' | 'active' | 'inactive' | 'deleted';

interface AdvancedFilters {
    teamLeader: string;
    client: ClientName | 'all';
    walletRange: 'all' | 'positive' | 'negative' | 'zero';
}

const RiderManagement: React.FC = () => {
    const { userData: currentUser } = useSupabaseAuth();
    const location = useLocation();
    const [activeTab, setActiveTab] = useState<TabType>('all');
    const [riders, setRiders] = useState<Rider[]>([]);
    const [teamLeaders, setTeamLeaders] = useState<User[]>([]);
    const [filteredRiders, setFilteredRiders] = useState<Rider[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingRider, setEditingRider] = useState<Rider | null>(null);
    const [viewingRider, setViewingRider] = useState<Rider | null>(null);
    const [reminderRider, setReminderRider] = useState<Rider | null>(null);
    const [showExportModal, setShowExportModal] = useState(false);
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [selectedRiders, setSelectedRiders] = useState<Set<string>>(new Set());
    const [reassigningRider, setReassigningRider] = useState<Rider | null>(null);
    const [showBulkAssignTL, setShowBulkAssignTL] = useState(false); // State for Bulk TL Modal

    // URL Filter Logic
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const filterParam = params.get('filter');
        if (filterParam && ['all', 'active', 'inactive', 'deleted'].includes(filterParam)) {
            setActiveTab(filterParam as TabType);
        }
    }, [location.search]);

    // Advanced filters
    const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
        teamLeader: 'all',
        client: 'all',
        walletRange: 'all',
    });

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);

    // Sorting
    const [sortBy, setSortBy] = useState<keyof Rider>('createdAt');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    const debouncedSearchTerm = useDebounce(searchTerm, 300);

    useEffect(() => {
        fetchData();

        const channel = supabase
            .channel('admin-riders-list')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'riders' },
                () => {
                    fetchData(); // Refetch to keep list fresh
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    useEffect(() => {
        filterRiders();
    }, [riders, activeTab, debouncedSearchTerm, advancedFilters, sortBy, sortOrder]);

    useEffect(() => {
        setCurrentPage(1);
    }, [filteredRiders.length]);

    // Deep Linking Handler
    // Deep Linking Handler
    useEffect(() => {
        // Handle State (Highlight Rider)
        const state = location.state as { highlightRiderId?: string };
        if (state?.highlightRiderId && riders.length > 0) {
            const targetRider = riders.find(r => r.id === state.highlightRiderId);
            if (targetRider) {
                setViewingRider(targetRider);
                window.history.replaceState({}, document.title);
            }
        }

        // Handle URL Params (Filters)
        const params = new URLSearchParams(location.search);
        const filterParam = params.get('filter');
        const walletParam = params.get('wallet');

        if (filterParam && ['all', 'active', 'inactive', 'deleted'].includes(filterParam)) {
            setActiveTab(filterParam as TabType);
        }

        if (walletParam && ['positive', 'negative', 'zero'].includes(walletParam)) {
            setAdvancedFilters(prev => ({ ...prev, walletRange: walletParam as any }));
            setShowAdvancedFilters(true);
        }
    }, [location.search, riders, location.state]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: ridersData, error: ridersError } = await supabase.from('riders').select(`
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
                deletedAt:deleted_at
            `);
            if (ridersError) throw ridersError;

            const { data: teamLeadersData, error: usersError } = await supabase.from('users').select(`
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
                permissions,
                remarks,
                profilePicUrl:profile_pic_url,
                suspendedUntil:suspended_until,
                createdAt:created_at,
                updatedAt:updated_at
            `).eq('role', 'teamLeader');
            if (usersError) throw usersError;

            setRiders((ridersData as Rider[]) || []);
            setTeamLeaders((teamLeadersData as unknown as User[]) || []);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const filterRiders = () => {
        let filtered = [...riders];

        if (activeTab !== 'all') {
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
            filtered = filtered.filter(r => r.teamLeaderId === advancedFilters.teamLeader);
        }

        if (advancedFilters.client !== 'all') {
            filtered = filtered.filter(r => r.clientName === advancedFilters.client);
        }

        if (advancedFilters.walletRange !== 'all') {
            filtered = filtered.filter(r => {
                if (advancedFilters.walletRange === 'positive') return r.walletAmount > 0;
                if (advancedFilters.walletRange === 'negative') return r.walletAmount < 0;
                if (advancedFilters.walletRange === 'zero') return r.walletAmount === 0;
                return true;
            });
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

        setFilteredRiders(filtered);
    };

    const handleTabChange = (tab: TabType) => {
        setActiveTab(tab);
        setSelectedRiders(new Set());
    };



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
            const dbPayload = {
                triev_id: formData.triev_id || formData.trievId || `TR${Date.now()}`,
                rider_name: formData.rider_name || formData.riderName,
                mobile_number: formData.mobile_number || formData.mobileNumber,
                chassis_number: formData.chassis_number || formData.chassisNumber,
                client_name: formData.client_name || formData.clientName,
                client_id: formData.client_id || formData.clientId,
                wallet_amount: formData.wallet_amount ?? formData.walletAmount ?? 0,
                allotment_date: formData.allotment_date || formData.allotmentDate,
                remarks: formData.remarks,
                status: formData.status || 'active',
                team_leader_id: assignedTeamLeaderId || null,
                team_leader_name: assignedTeamLeaderName, // Redundant if normalized, but requested
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };

            const { data, error } = await supabase.from('riders').insert(dbPayload).select().single();
            if (error) throw error;
            const newItemId = data.id;

            await logActivity({
                actionType: 'riderAdded',
                targetType: 'rider',
                targetId: newItemId,
                details: `Added new rider: ${dbPayload.rider_name}`,
                performedBy: currentUser?.email
            });

            // Notify System & TL
            await notifyTeamLeader(dbPayload.team_leader_id, 'create', dbPayload.rider_name, newItemId);

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
                wallet_amount: formData.walletAmount,
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
        } catch (error) {
            console.error('Error permanently deleting rider:', error);
            toast.error('Failed to permanently delete rider');
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

    // Bulk Actions
    const handleBulkStatusChange = async (newStatus: RiderStatus) => {
        if (currentUser?.permissions?.riders?.bulkActions?.statusChange === false) {
            toast.error("Permission Denied: Status change access required.");
            return;
        }
        if (selectedRiders.size === 0) return;
        if (!confirm(`Change status of ${selectedRiders.size} rider(s) to ${newStatus}?`)) return;

        try {
            const updates = Array.from(selectedRiders).map(async (riderId) => {
                const rider = riders.find(r => r.id === riderId);
                const { error } = await supabase.from('riders').update({
                    status: newStatus,
                    updated_at: new Date().toISOString(),
                }).eq('id', riderId);

                if (error) throw error;

                if (rider) {
                    const actionType = newStatus === 'active' ? 'status_active' : 'status_inactive';
                    await notifyTeamLeader(rider.teamLeaderId, actionType, rider.riderName, rider.id);
                }
            });

            await Promise.all(updates);

            await logActivity({
                actionType: 'bulkImport', // Use bulkAction or similar if defined
                targetType: 'rider',
                targetId: 'multiple',
                details: `Changed status of ${selectedRiders.size} riders to ${newStatus}`,
                performedBy: currentUser?.email
            });

            toast.success('Riders updated successfully');
            setSelectedRiders(new Set());
            await fetchData();
        } catch (error) {
            console.error('Error in bulk status change:', error);
            toast.error('Failed to update riders.');
        }
    };

    const handleBulkDelete = async () => {
        if (currentUser?.permissions?.riders?.bulkActions?.delete === false) {
            toast.error("Permission Denied.");
            return;
        }
        if (selectedRiders.size === 0) return;
        if (!confirm(`Delete ${selectedRiders.size} riders?`)) return;

        try {
            const updates = Array.from(selectedRiders).map(async (riderId) => {
                const rider = riders.find(r => r.id === riderId);
                const { error } = await supabase.from('riders').update({
                    status: 'deleted' as RiderStatus,
                    deleted_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                }).eq('id', riderId);

                if (error) throw error;
                if (rider) await notifyTeamLeader(rider.teamLeaderId, 'status_inactive', rider.riderName, rider.id);
            });

            await Promise.all(updates);
            await logActivity({
                actionType: 'riderDeleted',
                targetType: 'rider',
                targetId: 'multiple',
                details: `Bulk deleted ${selectedRiders.size} riders`,
                performedBy: currentUser?.email
            });

            setSelectedRiders(new Set());
            await fetchData();
        } catch (error) {
            console.error('Error in bulk delete:', error);
        }
    };

    const handleBulkAssignTL = async (newTLId: string) => {
        if (!newTLId) return;

        try {
            const newTL = teamLeaders.find(u => u.id === newTLId);
            const newTLName = newTL?.fullName || 'Unknown';

            const updates = Array.from(selectedRiders).map(async (riderId) => {
                const rider = riders.find(r => r.id === riderId);
                const oldTLId = rider?.teamLeaderId;

                const { error } = await supabase.from('riders').update({
                    team_leader_id: newTLId,
                    team_leader_name: newTLName,
                    updated_at: new Date().toISOString(),
                }).eq('id', riderId);

                if (error) throw error;

                if (rider && oldTLId) {
                    await notifyTeamLeader(oldTLId, 'reassign_from', rider.riderName, rider.id);
                }
                if (rider) {
                    await notifyTeamLeader(newTLId, 'reassign_to', rider.riderName, rider.id);
                }
            });

            await Promise.all(updates);

            await logActivity({
                actionType: 'riderEdited',
                targetType: 'rider',
                targetId: 'multiple',
                details: `Reassigned ${selectedRiders.size} riders to ${newTLName}`,
                performedBy: currentUser?.email
            });

            toast.success('Riders reassigned successfully');
            setSelectedRiders(new Set());
            setShowBulkAssignTL(false); // Close modal
            await fetchData();
        } catch (error) {
            console.error('Error in bulk reassignment:', error);
            toast.error('Failed to reassign riders');
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
        window.location.href = `tel:${phoneNumber}`;
    };

    const handleWhatsApp = (phoneNumber: string) => {
        const cleanNumber = phoneNumber.replace(/\D/g, '');
        window.open(`https://wa.me/${cleanNumber}`, '_blank');
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
            const { error } = await supabase.from('riders').delete().in('id', Array.from(selectedRiders));
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
        } catch (error) {
            console.error('Error in bulk permanent delete:', error);
            toast.error('Failed to permanently delete riders');
        }
    };

    // Determine Actions based on Tab
    const getBulkActions = () => {
        const commonActions = [
            { label: 'Assign TL', onClick: () => setShowBulkAssignTL(true), icon: <Users size={16} /> }
        ];

        if (activeTab === 'deleted') {
            return [
                { label: 'Restore', onClick: handleBulkRestore, icon: <RefreshCw size={16} /> },
                ...commonActions,
                { label: 'Permanently Delete', onClick: handleBulkPermanentDelete, variant: 'destructive', icon: <Trash2 size={16} /> }
            ];
        }

        return [
            { label: 'Set Active', onClick: () => handleBulkStatusChange('active') },
            { label: 'Set Inactive', onClick: () => handleBulkStatusChange('inactive') },
            ...commonActions,
            { label: 'Bulk Delete', onClick: handleBulkDelete, variant: 'destructive', icon: <Trash2 size={16} /> }
        ];
    };

    return (

        <div className="space-y-6">
            {/* ... (Header, Tabs, Filters code remains same) ... */}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
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

            {/* Tabs */}
            <div className="border-b border-border/60">
                <div className="flex gap-8">
                    {['all', 'active', 'inactive', 'deleted'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => handleTabChange(tab as TabType)}
                            className={`pb-4 px-2 font-medium transition-all relative capitalize text-sm tracking-wide ${activeTab === tab
                                ? 'text-primary font-bold'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            {tab} Riders
                            {activeTab === tab && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full shadow-[0_-2px_6px_rgba(var(--primary),0.2)]"></div>
                            )}
                        </button>
                    ))}
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
                    <div className="pt-4 border-t border-border/50 grid grid-cols-1 md:grid-cols-4 gap-6 animate-in slide-in-from-top-2 duration-200">
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Team Leader</label>
                            <select
                                value={advancedFilters.teamLeader}
                                onChange={(e) => setAdvancedFilters({ ...advancedFilters, teamLeader: e.target.value })}
                                className="w-full px-3 py-2 border border-input rounded-lg bg-background/50 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                            >
                                <option value="all">All Team Leaders</option>
                                {teamLeaders.map(tl => (
                                    <option key={tl.id} value={tl.id}>{tl.fullName}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Client</label>
                            <select
                                value={advancedFilters.client}
                                onChange={(e) => setAdvancedFilters({ ...advancedFilters, client: e.target.value as ClientName | 'all' })}
                                className="w-full px-3 py-2 border border-input rounded-lg bg-background/50 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                            >
                                <option value="all">All Clients</option>
                                {['Zomato', 'Zepto', 'Blinkit', 'Uber', 'Porter', 'Rapido', 'Swiggy', 'FLK', 'Other'].map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Wallet Status</label>
                            <select
                                value={advancedFilters.walletRange}
                                onChange={(e) => setAdvancedFilters({ ...advancedFilters, walletRange: e.target.value as any })}
                                className="w-full px-3 py-2 border border-input rounded-lg bg-background/50 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                            >
                                <option value="all">All</option>
                                <option value="positive">Positive Balance (+)</option>
                                <option value="negative">Negative Balance (-)</option>
                                <option value="zero">Zero Balance</option>
                            </select>
                        </div>
                        <div className="flex items-end">
                            <button
                                onClick={() => setAdvancedFilters({ teamLeader: 'all', client: 'all', walletRange: 'all' })}
                                className="w-full px-4 py-2 border border-dashed border-input rounded-lg hover:bg-accent text-sm text-muted-foreground hover:text-foreground transition-all flex items-center justify-center gap-2"
                            >
                                <RefreshCw size={14} /> Reset Filters
                            </button>
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

            {/* Table */}
            <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="px-4 py-3"><input type="checkbox" onChange={handleSelectAll} checked={paginatedRiders.length > 0 && paginatedRiders.every(r => selectedRiders.has(r.id))} /></th>
                                <th className="px-4 py-3 text-left font-semibold cursor-pointer" onClick={() => handleSort('trievId')}>Triev ID</th>
                                <th className="px-4 py-3 text-left font-semibold cursor-pointer" onClick={() => handleSort('riderName')}>Name</th>
                                <th className="px-4 py-3 text-left font-semibold">Mobile</th>
                                <th className="px-4 py-3 text-left font-semibold">Chassis</th>
                                <th className="px-4 py-3 text-left font-semibold cursor-pointer" onClick={() => handleSort('clientName')}>Client</th>
                                <th className="px-4 py-3 text-left font-semibold cursor-pointer" onClick={() => handleSort('walletAmount')}>Wallet</th>
                                <th className="px-4 py-3 text-left font-semibold">Status</th>
                                <th className="px-4 py-3 text-left font-semibold cursor-pointer" onClick={() => handleSort('teamLeaderName')}>Team Leader</th>
                                <th className="px-4 py-3 text-right font-semibold">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {paginatedRiders.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                                        No riders found.
                                    </td>
                                </tr>
                            ) : (
                                paginatedRiders.map((rider) => (
                                    <tr key={rider.id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-3">
                                            <input type="checkbox" checked={selectedRiders.has(rider.id)} onChange={() => handleSelectOne(rider.id)} />
                                        </td>
                                        <td className="px-4 py-3 font-medium text-sm">
                                            <button
                                                onClick={() => setViewingRider(rider)}
                                                className="text-primary hover:underline font-bold"
                                            >
                                                {rider.trievId}
                                            </button>
                                        </td>
                                        <td className="px-4 py-3 text-sm">{rider.riderName}</td>
                                        <td className="px-4 py-3 text-sm">
                                            <div className="flex flex-col gap-1">
                                                <span>{rider.mobileNumber}</span>
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleCall(rider.mobileNumber)} className="text-green-600 hover:text-green-700 p-1 rounded hover:bg-green-100" title="Call"><Phone size={14} /></button>
                                                    <button onClick={() => handleWhatsApp(rider.mobileNumber)} className="text-green-600 hover:text-green-700 p-1 rounded hover:bg-green-100" title="WhatsApp"><MessageCircle size={14} /></button>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-muted-foreground">{rider.chassisNumber}</td>
                                        <td className="px-4 py-3 text-sm capitalize">{rider.clientName}</td>
                                        <td className="px-4 py-3 text-sm font-medium">
                                            <div className="flex items-center gap-2">
                                                <span className={`font-bold ${rider.walletAmount > 0 ? 'text-green-600' : rider.walletAmount < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                                    ₹{rider.walletAmount}
                                                </span>
                                                {rider.walletAmount < 0 && (
                                                    <button
                                                        onClick={() => setReminderRider(rider)}
                                                        className="p-1.5 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-full shadow hover:shadow-lg hover:from-red-600 hover:to-pink-700 transition-all transform hover:-translate-y-0.5"
                                                        title="Send Payment Reminder (AI)"
                                                    >
                                                        <MessageCircle size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${rider.status === 'active' ? 'bg-green-100 text-green-700' :
                                                rider.status === 'inactive' ? 'bg-yellow-100 text-yellow-700' :
                                                    'bg-red-100 text-red-700'
                                                }`}>
                                                {rider.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm">{rider.teamLeaderName}</td>
                                        <td className="px-4 py-3 text-right">
                                            <ActionDropdownMenu
                                                rider={rider}
                                                onView={() => setViewingRider(rider)}
                                                onEdit={() => setEditingRider(rider)}
                                                onStatusChange={(s) => handleStatusChange(rider, s)}
                                                onDelete={() => handleDeleteRider(rider)}
                                                onRestore={() => handleRestoreRider(rider)}
                                                onPermanentDelete={() => handlePermanentDelete(rider)}
                                                onReassign={() => setReassigningRider(rider)}
                                                userRole="admin"
                                            />
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {/* Footer Padding for Dropdown Visibility */}
                <div className="h-32 bg-transparent pointer-events-none" aria-hidden="true" />
            </div>

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
            {showAddModal && <AddRiderForm onClose={() => setShowAddModal(false)} onSubmit={handleAddRider} teamLeaders={teamLeaders} userRole={currentUser?.role} />}
            {editingRider && <AddRiderForm onClose={() => setEditingRider(null)} onSubmit={handleEditRider} initialData={editingRider} isEdit teamLeaders={teamLeaders} userRole={currentUser?.role} />}
            {
                viewingRider && (
                    <RiderDetailsModal
                        rider={viewingRider}
                        onClose={() => setViewingRider(null)}
                    />
                )
            }
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
        </div >
    );
};

export default RiderManagement;
