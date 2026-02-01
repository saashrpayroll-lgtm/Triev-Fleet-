import React, { useState, useEffect } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/config/supabase';
import { Rider, RiderStatus, RiderFormData, ClientName } from '@/types';
import { Plus, Search, Filter, Download, Phone, MessageCircle, ChevronLeft, ChevronRight, Trash2, UserX, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import AddRiderForm from '@/components/AddRiderForm';
import RiderDetailsModal from '@/components/RiderDetailsModal';
import PaymentReminderModal from '@/components/PaymentReminderModal';
import BulkReminderModal from '@/components/BulkReminderModal';
import ExportModal, { ExportFormat } from '@/components/ExportModal';
import BulkActionsBar from '@/components/BulkActionsBar';
import ActionDropdownMenu from '@/components/ActionDropdownMenu';
import { exportRidersToCSV, exportRidersToExcel, exportRidersToPDF } from '@/utils/exportUtils';
import { logActivity } from '@/utils/activityLog';

type TabType = 'all' | 'active' | 'inactive' | 'deleted';

interface AdvancedFilters {
    client: ClientName | 'all';
    walletRange: 'all' | 'positive' | 'negative' | 'zero';
}

const MyRiders: React.FC = () => {
    const { userData } = useSupabaseAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<TabType>((searchParams.get('filter') as TabType) || 'all');
    const [riders, setRiders] = useState<Rider[]>([]);
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
    const [showBulkReminderModal, setShowBulkReminderModal] = useState(false);

    // Advanced filters
    const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
        client: 'all',
        walletRange: 'all',
    });

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);

    // Sorting
    const [sortBy, setSortBy] = useState<keyof Rider>('createdAt');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    // Permission Checks
    const canViewPage = userData?.permissions?.modules?.riders ?? true;
    const canAddRider = userData?.permissions?.riders?.create ?? true;
    const canExport = userData?.permissions?.riders?.export ?? true;
    const canDelete = userData?.permissions?.riders?.delete ?? true;

    // Pass specific permissions to dropdown
    const riderActionPermissions = {
        view: userData?.permissions?.riders?.view ?? true,
        edit: userData?.permissions?.riders?.edit ?? true,
        statusChange: userData?.permissions?.riders?.statusChange ?? true,
        softDelete: userData?.permissions?.riders?.delete ?? true,
        hardDelete: userData?.permissions?.riders?.hardDelete ?? false,
        canCall: userData?.permissions?.riders?.edit ?? true,
        canWhatsApp: userData?.permissions?.riders?.edit ?? true,
    };



    // Mappers
    const mapRiderFromDB = (data: any): Rider => ({
        id: data.id,
        trievId: data.triev_id,
        riderName: data.rider_name,
        mobileNumber: data.mobile_number,
        chassisNumber: data.chassis_number,
        clientName: data.client_name,
        clientId: data.client_id,
        walletAmount: data.wallet_amount,
        allotmentDate: data.allotment_date,
        remarks: data.remarks,
        status: data.status,
        teamLeaderId: data.team_leader_id,
        teamLeaderName: data.team_leader_name,
        comments: data.comments,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        deletedAt: data.deleted_at
    });

    const mapRiderToDB = (rider: Partial<Rider>) => {
        const payload: any = {};
        if (rider.trievId !== undefined) payload.triev_id = rider.trievId;
        if (rider.riderName !== undefined) payload.rider_name = rider.riderName;
        if (rider.mobileNumber !== undefined) payload.mobile_number = rider.mobileNumber;
        if (rider.chassisNumber !== undefined) payload.chassis_number = rider.chassisNumber;
        if (rider.clientName !== undefined) payload.client_name = rider.clientName;
        if (rider.clientId !== undefined) payload.client_id = rider.clientId;
        if (rider.walletAmount !== undefined) payload.wallet_amount = rider.walletAmount;
        if (rider.allotmentDate !== undefined) payload.allotment_date = rider.allotmentDate;
        if (rider.remarks !== undefined) payload.remarks = rider.remarks;
        if (rider.status !== undefined) payload.status = rider.status;
        if (rider.teamLeaderId !== undefined) payload.team_leader_id = rider.teamLeaderId;
        if (rider.teamLeaderName !== undefined) payload.team_leader_name = rider.teamLeaderName;

        if (rider.updatedAt !== undefined) payload.updated_at = rider.updatedAt;
        if (rider.deletedAt !== undefined) payload.deleted_at = rider.deletedAt;
        // created_at is automatic or manual
        if (rider.createdAt !== undefined) payload.created_at = rider.createdAt;
        return payload;
    };


    useEffect(() => {
        if (userData?.id && canViewPage) {
            fetchRiders();
        }
    }, [userData?.id, canViewPage]);

    if (!canViewPage) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center p-8 bg-muted/30 rounded-lg">
                    <UserX size={48} className="mx-auto mb-4 text-muted-foreground" />
                    <h2 className="text-xl font-bold mb-2">Access Restricted</h2>
                    <p className="text-muted-foreground">You do not have permission to view the Riders page.</p>
                </div>
            </div>
        );
    }

    useEffect(() => {
        filterRiders();
    }, [riders, activeTab, searchTerm, advancedFilters, sortBy, sortOrder]);

    useEffect(() => {
        setCurrentPage(1);
    }, [filteredRiders.length]);

    const fetchRiders = async () => {
        if (!userData) return;

        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('riders')
                .select('*')
                .eq('team_leader_id', userData.id); // snake_case

            if (error) throw error;

            setRiders(data?.map(mapRiderFromDB) || []);
        } catch (error) {
            console.error('Error fetching riders:', error);
        } finally {
            setLoading(false);
        }
    };

    // Real-time Subscription
    useEffect(() => {
        if (!userData?.id) return;

        const channel = supabase
            .channel('my-riders-list')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'riders',
                filter: `team_leader_id=eq.${userData.id}`
            }, () => {
                fetchRiders();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userData?.id]);

    const filterRiders = () => {
        let filtered = [...riders];

        // Filter by tab
        if (activeTab !== 'all') {
            filtered = filtered.filter(r => r.status === activeTab);
        }

        // Filter by search term
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            filtered = filtered.filter(r =>
                (r.riderName || '').toLowerCase().includes(searchLower) ||
                (r.trievId || '').toLowerCase().includes(searchLower) ||
                (r.mobileNumber || '').includes(searchTerm) ||
                (r.chassisNumber && r.chassisNumber.toLowerCase().includes(searchLower))
            );
        }

        // Advanced filters
        if (advancedFilters.client !== 'all') {
            filtered = filtered.filter(r => r.clientName === advancedFilters.client);
        }

        if (advancedFilters.walletRange !== 'all') {
            filtered = filtered.filter(r => {
                const amount = r.walletAmount || 0;
                if (advancedFilters.walletRange === 'positive') return amount > 0;
                if (advancedFilters.walletRange === 'negative') return amount < 0;
                if (advancedFilters.walletRange === 'zero') return amount === 0;
                return true;
            });
        }

        // Sorting
        filtered.sort((a, b) => {
            const aValue = a[sortBy];
            const bValue = b[sortBy];

            if (typeof aValue === 'number' && typeof bValue === 'number') {
                return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
            }

            if (typeof aValue === 'string' && typeof bValue === 'string') {
                return sortOrder === 'asc'
                    ? aValue.localeCompare(bValue)
                    : bValue.localeCompare(aValue);
            }

            return 0;
        });

        setFilteredRiders(filtered);
    };

    const handleTabChange = (tab: TabType) => {
        setActiveTab(tab);
        setSearchParams(tab === 'all' ? {} : { filter: tab });
        setSelectedRiders(new Set());
    };

    const generateTrievId = () => {
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        return `TR${timestamp}${random}`;
    };

    // Local logActivity removed in favor of imported utility from '@/utils/activityLog'

    const handleAddRider = async (formData: RiderFormData) => {
        if (!userData) return;

        try {
            const newRiderApp = {
                ...formData,
                clientName: formData.clientName as ClientName, // Cast string to ClientName
                trievId: formData.trievId || generateTrievId(),
                teamLeaderId: userData.id,
                teamLeaderName: userData.fullName,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                status: 'active' as RiderStatus,
                walletAmount: formData.walletAmount ?? 0,
            };

            const dbPayload = mapRiderToDB(newRiderApp);

            const { data, error } = await supabase.from('riders').insert(dbPayload).select().single();
            if (error) throw error;

            if (data) {
                const createdRider = mapRiderFromDB(data);
                await logActivity({
                    actionType: 'create',
                    targetType: 'rider',
                    targetId: createdRider.id,
                    details: `Added new rider: ${createdRider.riderName} (${createdRider.trievId})`
                });
            }

            toast.success('Rider added successfully');
            await fetchRiders();
            setShowAddModal(false);
        } catch (error: any) {
            console.error('Error adding rider:', error);
            toast.error(`Failed to add rider: ${error.message || 'Unknown error'}`);
        }
    };

    const handleEditRider = async (formData: RiderFormData) => {
        if (!editingRider) return;

        try {
            const updatePayload = mapRiderToDB({
                ...formData,
                clientName: formData.clientName as ClientName, // Cast string to ClientName
                updatedAt: new Date().toISOString(),
            });

            const { error } = await supabase
                .from('riders')
                .update(updatePayload)
                .eq('id', editingRider.id);

            if (error) throw error;

            await logActivity({
                actionType: 'update',
                targetType: 'rider',
                targetId: editingRider.id,
                details: `Updated rider: ${formData.riderName} (${formData.trievId})`
            });

            toast.success('Rider updated successfully');
            await fetchRiders();
            setEditingRider(null);
        } catch (error) {
            console.error('Error updating rider:', error);
            toast.error('Failed to update rider. Please try again.');
        }
    };

    const handleDeleteRider = async (rider: Rider) => {
        if (!confirm(`Are you sure you want to delete ${rider.riderName}?`)) return;

        try {
            const { error } = await supabase
                .from('riders')
                .update({
                    status: 'deleted',
                    deleted_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', rider.id);

            if (error) throw error;

            await logActivity({
                actionType: 'delete',
                targetType: 'rider',
                targetId: rider.id,
                details: `Deleted rider: ${rider.riderName} (${rider.trievId})`
            });

            toast.success('Rider moved to trash');
            await fetchRiders();
        } catch (error) {
            console.error('Error deleting rider:', error);
            toast.error('Failed to delete rider');
        }
    };

    const handleRestoreRider = async (rider: Rider) => {
        try {
            const { error } = await supabase
                .from('riders')
                .update({
                    status: 'active',
                    deleted_at: null,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', rider.id);

            if (error) throw error;

            await logActivity({
                actionType: 'update',
                targetType: 'rider',
                targetId: rider.id,
                details: `Restored rider: ${rider.riderName} (${rider.trievId})`
            });

            toast.success('Rider restored');
            await fetchRiders();
        } catch (error) {
            console.error('Error restoring rider:', error);
            toast.error('Failed to restore rider');
        }
    };

    const handlePermanentDelete = async (rider: Rider) => {
        if (!confirm(`PERMANENT DELETE: This will completely remove ${rider.riderName} from the system. This action CANNOT be undone. Are you absolutely sure?`)) return;

        try {
            // Soft delete flag update as per request logic preserved
            const { error } = await supabase
                .from('riders')
                .update({
                    permanently_deleted: true, // snake_case
                    updated_at: new Date().toISOString(),
                })
                .eq('id', rider.id);

            if (error) throw error;

            await logActivity({
                actionType: 'delete',
                targetType: 'rider',
                targetId: rider.id,
                details: `Permanently deleted rider: ${rider.riderName} (${rider.trievId})`
            });

            toast.success('Rider permanently deleted');
            await fetchRiders();
        } catch (error) {
            console.error('Error permanently deleting rider:', error);
            toast.error('Failed to permanently delete rider');
        }
    };

    const handleStatusChange = async (rider: Rider, newStatus: RiderStatus) => {
        try {
            const { error } = await supabase
                .from('riders')
                .update({
                    status: newStatus,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', rider.id);

            if (error) throw error;

            await logActivity({
                actionType: 'update',
                targetType: 'rider',
                targetId: rider.id,
                details: `Changed status to ${newStatus}: ${rider.riderName} (${rider.trievId})`
            });

            toast.success(`Status updated to ${newStatus}`);
            await fetchRiders();
        } catch (error) {
            console.error('Error changing status:', error);
            toast.error('Failed to change status');
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

    const handleBulkStatusChange = async (newStatus: RiderStatus) => {
        if (selectedRiders.size === 0) return;

        if (!confirm(`Change status of ${selectedRiders.size} rider(s) to ${newStatus}?`)) {
            return;
        }

        try {
            const idsToCheck = Array.from(selectedRiders);
            const { error } = await supabase
                .from('riders')
                .update({
                    status: newStatus,
                    updated_at: new Date().toISOString(),
                })
                .in('id', idsToCheck);

            if (error) throw error;

            await logActivity({
                actionType: 'bulk_update',
                targetType: 'rider',
                targetId: 'multiple',
                details: `Changed status of ${selectedRiders.size} riders to ${newStatus}`
            });

            toast.success('Riders updated successfully');
            setSelectedRiders(new Set());
            await fetchRiders();
        } catch (error) {
            console.error('Error in bulk status change:', error);
            toast.error('Failed to update riders. Please try again.');
        }
    };

    const handleBulkDelete = async () => {
        if (selectedRiders.size === 0) return;

        if (!confirm(`Delete ${selectedRiders.size} rider(s)? This will set their status to deleted.`)) {
            return;
        }

        try {
            const idsToCheck = Array.from(selectedRiders);
            const { error } = await supabase
                .from('riders')
                .update({
                    status: 'deleted',
                    deleted_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .in('id', idsToCheck);

            if (error) throw error;

            await logActivity({
                actionType: 'bulk_delete',
                targetType: 'rider',
                targetId: 'multiple',
                details: `Deleted ${selectedRiders.size} riders`
            });

            toast.success('Riders deleted successfully');
            setSelectedRiders(new Set());
            await fetchRiders();
        } catch (error) {
            console.error('Error in bulk delete:', error);
            toast.error('Failed to delete riders. Please try again.');
        }
    };

    const handleExport = async (format: ExportFormat) => {
        const ridersToExport = filteredRiders.filter(r =>
            selectedRiders.size === 0 || selectedRiders.has(r.id)
        );

        const filename = `riders_${activeTab}_${new Date().toISOString().split('T')[0]}`;

        try {
            if (format === 'csv') {
                exportRidersToCSV(ridersToExport, filename);
            } else if (format === 'excel') {
                exportRidersToExcel(ridersToExport, filename);
            } else if (format === 'pdf') {
                exportRidersToPDF(ridersToExport, filename, `Riders Report - ${activeTab.toUpperCase()}`);
            }

            await logActivity({
                actionType: 'export',
                targetType: 'rider',
                targetId: 'multiple',
                details: `Exported ${ridersToExport.length} riders as ${format.toUpperCase()}`
            });
        } catch (error) {
            console.error('Export error:', error);
            throw error;
        }
    };

    const handleCall = (phoneNumber: string) => {
        window.location.href = `tel:${phoneNumber}`;
    };

    const handleWhatsApp = (phoneNumber: string) => {
        const cleanNumber = phoneNumber.replace(/\D/g, '');
        window.open(`https://wa.me/${cleanNumber}`, '_blank');
    };

    const handleSendReminder = async (message: string) => {
        if (!reminderRider) return;

        // Log the activity
        await logActivity({
            actionType: 'sent_reminder',
            targetType: 'rider',
            targetId: reminderRider.id,
            details: `Sent payment reminder to ${reminderRider.riderName}`
        });

        // Open WhatsApp
        const encodedMessage = encodeURIComponent(message);
        window.open(`https://wa.me/${reminderRider.mobileNumber}?text=${encodedMessage}`, '_blank');

        setReminderRider(null);
    };

    const handleSort = (column: keyof Rider) => {
        if (sortBy === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(column);
            setSortOrder('asc');
        }
    };

    const handleBulkSendReminders = async (message: string) => {
        const selectedRidersList = riders.filter(r => selectedRiders.has(r.id));
        const negativeBalanceRiders = selectedRidersList.filter(r => r.walletAmount < 0);

        if (negativeBalanceRiders.length === 0) {
            toast.error('No riders with negative balance selected');
            return;
        }

        try {
            // Open WhatsApp for each rider
            for (const rider of negativeBalanceRiders) {
                const personalizedMessage = message
                    .replace('{name}', rider.riderName)
                    .replace('{amount}', Math.abs(rider.walletAmount).toLocaleString('en-IN'));

                const encodedMessage = encodeURIComponent(personalizedMessage);
                const cleanNumber = rider.mobileNumber.replace(/\\D/g, '');

                // Open WhatsApp in new tab
                window.open(`https://wa.me/${cleanNumber}?text=${encodedMessage}`, '_blank');

                // Small delay between opening tabs
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            await logActivity({
                actionType: 'payment_reminder',
                targetType: 'rider',
                targetId: 'multiple',
                details: `Sent bulk payment reminder to ${negativeBalanceRiders.length} riders`
            });

            toast.success(`Opened WhatsApp for ${negativeBalanceRiders.length} rider(s)`);
            setSelectedRiders(new Set());
        } catch (error) {
            console.error('Error sending bulk reminders:', error);
            toast.error('Failed to send reminders');
        }
    };

    const canBulkStatusChange = userData?.permissions?.riders?.bulkActions?.statusChange ?? false;
    const canBulkDelete = userData?.permissions?.riders?.bulkActions?.delete ?? false;
    const canBulkSendReminders = userData?.permissions?.riders?.bulkActions?.sendReminders ?? true; // Default true for all

    const getBulkActions = () => {
        const actions = [];

        if (canBulkStatusChange) {
            actions.push({
                label: 'Change to Active',
                onClick: () => handleBulkStatusChange('active'),
            });
            actions.push({
                label: 'Change to Inactive',
                onClick: () => handleBulkStatusChange('inactive'),
            });
        }

        if (canBulkSendReminders) {
            actions.push({
                label: 'Send Bulk Reminder',
                onClick: () => setShowBulkReminderModal(true),
                variant: 'default',
                icon: <AlertTriangle size={16} />,
            });
        }

        if (canBulkDelete) {
            actions.push({
                label: 'Delete Selected',
                onClick: handleBulkDelete,
                variant: 'destructive',
                icon: <Trash2 size={16} />,
            });
        }

        return actions;
    };

    // Pagination constants
    const totalPages = Math.ceil(filteredRiders.length / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const paginatedRiders = filteredRiders.slice(startIndex, startIndex + pageSize);

    const availableExportColumns = [
        { key: 'trievId', label: 'Triev ID' },
        { key: 'riderName', label: 'Rider Name' },
        { key: 'mobileNumber', label: 'Mobile Number' },
        { key: 'chassisNumber', label: 'Chassis Number' },
        { key: 'clientName', label: 'Client Name' },
        { key: 'walletAmount', label: 'Wallet Amount' },
        { key: 'status', label: 'Status' },
        { key: 'teamLeaderName', label: 'Team Leader' },
        { key: 'remarks', label: 'Remarks' }
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">My Riders</h1>
                    <p className="text-muted-foreground mt-1">Manage your assigned riders</p>
                </div>
                {canAddRider && (
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="bg-primary text-primary-foreground px-6 py-3 rounded-lg hover:bg-primary/90 transition-all shadow-md hover:shadow-lg flex items-center gap-2 font-medium"
                    >
                        <Plus size={20} />
                        Add New Rider
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="border-b border-border">
                <div className="flex gap-6">
                    <button
                        onClick={() => handleTabChange('all')}
                        className={`pb-3 px-1 font-medium transition-all relative ${activeTab === 'all'
                            ? 'text-primary'
                            : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        All
                        {activeTab === 'all' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>}
                    </button>

                    <button
                        onClick={() => handleTabChange('active')}
                        className={`pb-3 px-1 font-medium transition-all relative ${activeTab === 'active'
                            ? 'text-primary'
                            : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        Active
                        {activeTab === 'active' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>}
                    </button>

                    <button
                        onClick={() => handleTabChange('inactive')}
                        className={`pb-3 px-1 font-medium transition-all relative ${activeTab === 'inactive'
                            ? 'text-primary'
                            : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        Inactive
                        {activeTab === 'inactive' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>}
                    </button>

                    {canDelete && (
                        <button
                            onClick={() => handleTabChange('deleted')}
                            className={`pb-3 px-1 font-medium transition-all relative ${activeTab === 'deleted'
                                ? 'text-primary'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            Trash
                            {activeTab === 'deleted' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>}
                        </button>
                    )}
                </div>
            </div>

            {/* Search and Filters */}
            <div className="flex items-center gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                    <input
                        type="text"
                        placeholder="Search by name, Triev ID, mobile, or chassis number..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                    />
                </div>
                <button
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                    className={`px-4 py-2.5 border border-input rounded-lg hover:bg-accent transition-colors flex items-center gap-2 ${showAdvancedFilters ? 'bg-accent' : ''}`}
                >
                    <Filter size={20} />
                    Advanced Filter
                </button>
                {canExport && (
                    <button
                        onClick={() => setShowExportModal(true)}
                        className="px-4 py-2.5 border border-input rounded-lg hover:bg-accent transition-colors flex items-center gap-2"
                    >
                        <Download size={20} />
                        Export
                    </button>
                )}
            </div>

            {/* Advanced Filters Panel */}
            {showAdvancedFilters && (
                <div className="bg-muted/50 border border-border rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Client</label>
                            <select
                                value={advancedFilters.client}
                                onChange={(e) => setAdvancedFilters({ ...advancedFilters, client: e.target.value as ClientName | 'all' })}
                                className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                            >
                                <option value="all">All Clients</option>
                                <option value="Zomato">Zomato</option>
                                <option value="Zepto">Zepto</option>
                                <option value="Blinkit">Blinkit</option>
                                <option value="Uber">Uber</option>
                                <option value="Porter">Porter</option>
                                <option value="Rapido">Rapido</option>
                                <option value="Swiggy">Swiggy</option>
                                <option value="FLK">FLK</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">Wallet Range</label>
                            <select
                                value={advancedFilters.walletRange}
                                onChange={(e) => setAdvancedFilters({ ...advancedFilters, walletRange: e.target.value as any })}
                                className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                            >
                                <option value="all">All Wallets</option>
                                <option value="positive">Positive Balance</option>
                                <option value="negative">Negative Balance</option>
                                <option value="zero">Zero Balance</option>
                            </select>
                        </div>
                        <div className="flex items-end">
                            <button
                                onClick={() => setAdvancedFilters({ client: 'all', walletRange: 'all' })}
                                className="px-4 py-2 border border-input rounded-lg hover:bg-accent transition-colors w-full"
                            >
                                Reset Filters
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Actions Bar */}
            {selectedRiders.size > 0 && (
                <BulkActionsBar
                    selectedCount={selectedRiders.size}
                    totalCount={filteredRiders.length}
                    onSelectAll={() => setSelectedRiders(new Set(filteredRiders.map(r => r.id)))}
                    onDeselectAll={() => setSelectedRiders(new Set())}
                    actions={getBulkActions() as any}
                />
            )}

            {/* Riders Table */}
            <div className="bg-card border border-border rounded-lg overflow-hidden">
                {loading ? (
                    <div className="flex justify-center items-center py-12">
                        <Loader2 className="animate-spin text-primary" size={48} />
                    </div>
                ) : filteredRiders.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-muted-foreground mb-4">
                            {searchTerm
                                ? 'No riders found matching your search.'
                                : riders.length === 0
                                    ? 'No riders yet. Click "Add New Rider" to get started.'
                                    : `No ${activeTab} riders.`}
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-muted/50">
                                    <tr>
                                        <th className="px-4 py-3 text-left">
                                            <input
                                                type="checkbox"
                                                checked={paginatedRiders.length > 0 && paginatedRiders.every(r => selectedRiders.has(r.id))}
                                                onChange={handleSelectAll}
                                                className="w-4 h-4 rounded border-input"
                                            />
                                        </th>
                                        <th
                                            onClick={() => handleSort('trievId')}
                                            className="px-4 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-muted transition-colors"
                                        >
                                            Triev ID {sortBy === 'trievId' && (sortOrder === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th
                                            onClick={() => handleSort('riderName')}
                                            className="px-4 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-muted transition-colors"
                                        >
                                            Rider Name {sortBy === 'riderName' && (sortOrder === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold">Mobile Number</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold">Chassis Number</th>
                                        <th
                                            onClick={() => handleSort('clientName')}
                                            className="px-4 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-muted transition-colors"
                                        >
                                            Client {sortBy === 'clientName' && (sortOrder === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th
                                            onClick={() => handleSort('walletAmount')}
                                            className="px-4 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-muted transition-colors"
                                        >
                                            Wallet {sortBy === 'walletAmount' && (sortOrder === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                                        <th className="px-4 py-3 text-right text-sm font-semibold">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {paginatedRiders.map((rider) => (
                                        <tr key={rider.id} className="hover:bg-muted/30 transition-colors">
                                            <td className="px-4 py-3">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedRiders.has(rider.id)}
                                                    onChange={() => handleSelectOne(rider.id)}
                                                    className="w-4 h-4 rounded border-input"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-sm font-medium">
                                                <button
                                                    onClick={() => setViewingRider(rider)}
                                                    className="text-primary hover:underline hover:font-bold transition-all"
                                                >
                                                    {rider.trievId}
                                                </button>
                                            </td>
                                            <td className="px-4 py-3 text-sm">{rider.riderName}</td>
                                            <td className="px-4 py-3 text-sm">
                                                <div className="flex flex-col gap-1">
                                                    <span>{rider.mobileNumber}</span>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleCall(rider.mobileNumber)}
                                                            className="text-green-600 hover:text-green-700 transition-colors"
                                                            title="Call"
                                                        >
                                                            <Phone size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleWhatsApp(rider.mobileNumber)}
                                                            className="text-green-600 hover:text-green-700 transition-colors"
                                                            title="WhatsApp"
                                                        >
                                                            <MessageCircle size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm">{rider.chassisNumber}</td>
                                            <td className="px-4 py-3 text-sm">{rider.clientName}</td>
                                            <td className="px-4 py-3 text-sm">
                                                <span
                                                    className={
                                                        rider.walletAmount > 0
                                                            ? 'wallet-positive'
                                                            : rider.walletAmount < 0
                                                                ? 'wallet-negative'
                                                                : 'wallet-zero'
                                                    }
                                                >
                                                    ₹{rider.walletAmount >= 0 ? '+' : ''}{rider.walletAmount.toLocaleString('en-IN')}
                                                </span>
                                                {rider.walletAmount < 0 && (
                                                    <button
                                                        onClick={() => setReminderRider(rider)}
                                                        className="ml-2 p-1.5 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-full shadow hover:shadow-lg hover:from-red-600 hover:to-pink-700 transition-all transform hover:-translate-y-0.5"
                                                        title="Send Payment Reminder"
                                                    >
                                                        <AlertTriangle size={12} />
                                                    </button>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <span
                                                    className={`px-2 py-1 rounded-full text-xs font-medium ${rider.status === 'active'
                                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                        : rider.status === 'inactive'
                                                            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                        }`}
                                                >
                                                    {rider.status.charAt(0).toUpperCase() + rider.status.slice(1)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <div className="flex items-center justify-end">
                                                    <ActionDropdownMenu
                                                        rider={rider}
                                                        onView={() => setViewingRider(rider)}
                                                        onEdit={() => setEditingRider(rider)}
                                                        onStatusChange={(status) => handleStatusChange(rider, status)}
                                                        onDelete={() => handleDeleteRider(rider)}
                                                        onRestore={() => handleRestoreRider(rider)}
                                                        onPermanentDelete={() => handlePermanentDelete(rider)}
                                                        userRole="teamLeader"
                                                        permissions={riderActionPermissions}
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="border-t border-border px-4 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">Rows per page:</span>
                                <select
                                    value={pageSize}
                                    onChange={(e) => {
                                        setPageSize(Number(e.target.value));
                                        setCurrentPage(1);
                                    }}
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
                                <button
                                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                    disabled={currentPage === 1}
                                    className="p-2 border border-input rounded hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <span className="text-sm text-muted-foreground">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <button
                                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                    disabled={currentPage === totalPages}
                                    className="p-2 border border-input rounded hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Modals */}
            {showAddModal && (
                <AddRiderForm
                    onClose={() => setShowAddModal(false)}
                    onSubmit={handleAddRider}
                />
            )}

            {editingRider && (
                <AddRiderForm
                    onClose={() => setEditingRider(null)}
                    onSubmit={handleEditRider}
                    initialData={editingRider as unknown as RiderFormData}
                    isEdit
                />
            )}

            {viewingRider && (
                <RiderDetailsModal
                    rider={viewingRider}
                    onClose={() => setViewingRider(null)}
                />
            )}

            {reminderRider && (
                <PaymentReminderModal
                    rider={reminderRider}
                    onClose={() => setReminderRider(null)}
                    onSend={handleSendReminder}
                />
            )}

            {showExportModal && (
                <ExportModal
                    isOpen={showExportModal}
                    onClose={() => setShowExportModal(false)}
                    onExport={handleExport}
                    availableColumns={availableExportColumns}
                    title={`Export ${selectedRiders.size > 0 ? `${selectedRiders.size} Selected` : 'All'} Riders`}
                />
            )}

            {showBulkReminderModal && (
                <BulkReminderModal
                    riders={riders.filter(r => selectedRiders.has(r.id))}
                    onClose={() => setShowBulkReminderModal(false)}
                    onSend={handleBulkSendReminders}
                />
            )}
        </div>
    );
};

export default MyRiders;
