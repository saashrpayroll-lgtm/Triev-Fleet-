import React, { useState, useEffect } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useSearchParams, useLocation } from 'react-router-dom';
import { supabase } from '@/config/supabase';
import { Rider, RiderStatus, RiderFormData, ClientName } from '@/types';
import { Plus, Search, Filter, Download, Phone, MessageCircle, ChevronLeft, ChevronRight, Trash2, UserX, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { getWhatsAppLink, getCallLink } from '@/utils/validationUtils';
import AddRiderForm from '@/components/AddRiderForm';
import RiderDetailsModal from '@/components/RiderDetailsModal';
import AIReminderModal from '@/components/AIReminderModal';
import BulkCommunicationModal from '@/components/BulkCommunicationModal';
import ExportModal, { ExportFormat } from '@/components/ExportModal';
import BulkActionsBar from '@/components/BulkActionsBar';
import ActionDropdownMenu from '@/components/ActionDropdownMenu';
import ElevenLabsCallModal from '@/components/ElevenLabsCallModal';
import { exportRidersToCSV, exportRidersToExcel, exportRidersToPDF } from '@/utils/exportUtils';
import { logActivity } from '@/utils/activityLog';
import { fetchAllRidersPaginated } from '@/utils/dbUtils';
import RiskBadge from '@/components/RiskBadge';
import StarRating from '@/components/StarRating';
import ChurnPredictionBadge from '@/components/ChurnPredictionBadge';
import RiderRatingDetailModal from '@/components/RiderRatingDetailModal';
import { RiderRatingService } from '@/services/RiderRatingService';
import { StarRatingResult } from '@/utils/starRatingEngine';
import LiveAlertCenter from '@/components/LiveAlertCenter';
import { motion } from 'framer-motion';

type TabType = 'all' | 'active' | 'inactive' | 'deleted' | 'zomato';

interface AdvancedFilters {
    client: ClientName | 'all';
    walletRange: 'all' | 'positive' | 'negative' | 'zero' | 'low_balance' | 'defaulter' | 'zero_collection';
}

const MyRiders: React.FC = () => {
    const { userData } = useSupabaseAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const location = useLocation();
    const [activeTab, setActiveTab] = useState<TabType>((searchParams.get('filter') as TabType) || 'active');
    const [riders, setRiders] = useState<Rider[]>([]);
    const [filteredRiders, setFilteredRiders] = useState<Rider[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingRider, setEditingRider] = useState<Rider | null>(null);
    const [viewingRider, setViewingRider] = useState<Rider | null>(null);
    const [selectedReminderRider, setSelectedReminderRider] = useState<Rider | null>(null);
    const [reminderType, setReminderType] = useState<'low_balance' | 'warning' | 'critical' | 'inactive' | 'zero_collection'>('low_balance');
    const [showExportModal, setShowExportModal] = useState(false);
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [selectedRiders, setSelectedRiders] = useState<Set<string>>(new Set());
    const [showBulkCommunicationModal, setShowBulkCommunicationModal] = useState(false);
    const [selectedCallRider, setSelectedCallRider] = useState<Rider | null>(null);
    const [showElevenLabsModal, setShowElevenLabsModal] = useState(false);

    // AI Star Rating State
    const [riderRatings, setRiderRatings] = useState<Map<string, StarRatingResult>>(new Map());
    const [ratingDetailRider, setRatingDetailRider] = useState<Rider | null>(null);

    // To track today's collections for the zero_collection filter
    const [todayCollections, setTodayCollections] = useState<Record<string, number>>({});

    const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
        client: 'all',
        walletRange: 'all',
    });

    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [sortBy, setSortBy] = useState<keyof Rider>('createdAt');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    const canViewPage = userData?.permissions?.modules?.riders ?? true;
    const canAddRider = userData?.permissions?.riders?.create ?? true;
    const canExport = userData?.permissions?.riders?.export ?? true;
    const canDelete = userData?.permissions?.riders?.delete ?? true;

    const riderActionPermissions = {
        view: userData?.permissions?.riders?.view ?? true,
        edit: userData?.permissions?.riders?.edit ?? true,
        statusChange: userData?.permissions?.riders?.statusChange ?? true,
        softDelete: userData?.permissions?.riders?.delete ?? true,
        hardDelete: userData?.permissions?.riders?.hardDelete ?? false,
        canCall: userData?.permissions?.riders?.call ?? true,
        canWhatsApp: userData?.permissions?.riders?.whatsapp ?? true,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapRiderFromDB = (data: any): Rider => ({
        id: data.id,
        trievId: data.triev_id,
        riderName: data.rider_name,
        mobileNumber: data.mobile_number,
        chassisNumber: data.chassis_number,
        clientName: data.client_name,
        clientId: data.client_id,
        walletAmount: data.status === 'active' ? data.wallet_amount : 0,
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        if (rider.createdAt !== undefined) payload.created_at = rider.createdAt;
        return payload;
    };

    const fetchRiders = React.useCallback(async () => {
        if (!userData) return;
        try {
            setLoading(true);

            // 1. Fetch Riders
            const { data, error } = await fetchAllRidersPaginated('*', { column: 'team_leader_id', value: userData.id });
            if (error) throw error;

            const fetchedRiders = data?.map(mapRiderFromDB) || [];
            setRiders(fetchedRiders);

            // 2. Fetch Today's Collections for Zero Collection filter
            const now = new Date();
            const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
            const [y, m, d] = todayIST.split('-').map(Number);
            const midnight = new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - 5.5 * 60 * 60 * 1000).toISOString();
            const fallbackOrQuery = `transaction_date.gte.${midnight},and(transaction_date.is.null,created_at.gte.${midnight})`;

            const { data: ledgerData, error: ledgerError } = await supabase
                .from('wallet_ledger')
                .select('amount, rider:riders!inner(id, team_leader_id)')
                .eq('mode', 'ADD')
                .eq('rider.team_leader_id', userData.id)
                .in('transaction_type', ['DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION', 'COLLECTION', 'RENT', 'DAILY COLLECTION', 'RENT COLLECTION', 'FTD COLLECTION'])
                .or(fallbackOrQuery);

            if (!ledgerError && ledgerData) {
                const liveTodayByRider: Record<string, number> = {};
                ledgerData.forEach(txn => {
                    const riderId = (txn.rider as any)?.id;
                    if (riderId) {
                        liveTodayByRider[riderId] = (liveTodayByRider[riderId] || 0) + (Number(txn.amount) || 0);
                    }
                });
                setTodayCollections(liveTodayByRider);
            }

        } catch (error) {
            console.error('Error fetching riders:', error);
        } finally {
            setLoading(false);
        }
    }, [userData, mapRiderFromDB]);

    const filterRiders = React.useCallback(() => {
        let filtered = [...riders];
        if (activeTab === 'zomato') {
            filtered = filtered.filter(r => r.status === 'active' && (r.chassisNumber?.trim().toUpperCase().startsWith('P6DSVFMSP') || (r as any).chassis_number?.trim().toUpperCase().startsWith('P6DSVFMSP')));
        } else if (activeTab && activeTab !== 'all') {
            filtered = filtered.filter(r => r.status === activeTab);
        }
        if (searchTerm) {
            const s = searchTerm.toLowerCase();
            filtered = filtered.filter(r =>
                (r.riderName || '').toLowerCase().includes(s) ||
                (r.trievId || '').toLowerCase().includes(s) ||
                (r.mobileNumber || '').includes(searchTerm) ||
                (r.chassisNumber && r.chassisNumber.toLowerCase().includes(s))
            );
        }
        if (advancedFilters.client !== 'all') filtered = filtered.filter(r => r.clientName === advancedFilters.client);
        if (advancedFilters.walletRange !== 'all') {
            filtered = filtered.filter(r => {
                const a = r.walletAmount || 0;
                if (advancedFilters.walletRange === 'positive') return a > 0;
                if (advancedFilters.walletRange === 'negative') return a < 0;
                if (advancedFilters.walletRange === 'zero') return a === 0;
                if (advancedFilters.walletRange === 'low_balance') return r.status === 'active' && a >= 0 && a <= 250;
                if (advancedFilters.walletRange === 'defaulter') return a <= -699;
                if (advancedFilters.walletRange === 'zero_collection') return r.status === 'active' && a <= 0 && !(todayCollections[r.id] > 0);
                return true;
            });
        }
        filtered.sort((a, b) => {
            const av = a[sortBy]; const bv = b[sortBy];
            if (typeof av === 'number' && typeof bv === 'number') return sortOrder === 'asc' ? av - bv : bv - av;
            if (typeof av === 'string' && typeof bv === 'string') return sortOrder === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
            return 0;
        });
        setFilteredRiders(filtered);
    }, [riders, activeTab, searchTerm, advancedFilters, sortBy, sortOrder]);

    useEffect(() => {
        if (userData?.id && canViewPage) fetchRiders();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userData?.id, canViewPage]);


    useEffect(() => { filterRiders(); }, [filterRiders]);
    useEffect(() => { setCurrentPage(1); }, [filteredRiders.length]);

    // AI Star Rating: Compute ratings when paginated riders change
    useEffect(() => {
        if (!paginatedRiders.length) return;
        const ridersToRate = paginatedRiders.filter(r => !riderRatings.has(r.id));
        if (ridersToRate.length === 0) return;

        let cancelled = false;
        RiderRatingService.fetchRatingsForRiders(ridersToRate).then(newRatings => {
            if (cancelled) return;
            setRiderRatings(prev => {
                const merged = new Map(prev);
                for (const [id, rating] of newRatings) merged.set(id, rating);
                return merged;
            });
        });
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filteredRiders, currentPage, pageSize]);

    useEffect(() => {
        if (searchParams.get('action') === 'new' && canAddRider) {
            setShowAddModal(true);
            setSearchParams(prev => { const p = new URLSearchParams(prev); p.delete('action'); return p; });
        }
        
        // Sync searchTerm state if URL search param changes
        const currentSearch = searchParams.get('search');
        if (currentSearch !== null) {
            setSearchTerm(currentSearch);
        }
    }, [searchParams, canAddRider, setSearchParams]);

    useEffect(() => {
        const state = location.state as { filter?: string; highlight?: string; };
        if (state?.filter) {
            if (state.filter === 'positive_wallet') { setAdvancedFilters(p => ({ ...p, walletRange: 'positive' })); setShowAdvancedFilters(true); }
            else if (state.filter === 'negative_wallet') { setAdvancedFilters(p => ({ ...p, walletRange: 'negative' })); setShowAdvancedFilters(true); }
            else if (state.filter === 'zero_balance') { setAdvancedFilters(p => ({ ...p, walletRange: 'zero' })); setShowAdvancedFilters(true); }
            else if (state.filter === 'low_balance') { setAdvancedFilters(p => ({ ...p, walletRange: 'low_balance' })); setShowAdvancedFilters(true); setActiveTab('active'); }
            else if (['active', 'inactive', 'deleted'].includes(state.filter)) setActiveTab(state.filter as TabType);
        }
    }, [location.state]);

    useEffect(() => {
        const state = location.state as { highlight?: string };
        if (state?.highlight && riders.length > 0) {
            const riderToView = riders.find(r => r.mobileNumber === state.highlight || r.trievId === state.highlight);
            if (riderToView) {
                setViewingRider(riderToView);
                // Clear the state so it doesn't reopen if closed
                const newHistoryState = { ...window.history.state };
                if (newHistoryState && newHistoryState.usr) delete newHistoryState.usr.highlight;
                window.history.replaceState(newHistoryState, '');
            }
        }
    }, [location.state, riders]);

    useEffect(() => {
        if (!userData?.id) return;
        const channel = supabase.channel('my-riders-list')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'riders', filter: `team_leader_id = eq.${userData.id} ` }, () => fetchRiders())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [userData?.id, fetchRiders]);
    const handleTabChange = (tab: TabType) => {
        setActiveTab(tab);
        setSearchParams(tab === 'all' ? {} : { filter: tab });
        setSelectedRiders(new Set());
    };

    const generateTrievId = () => `TR${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')} `;

    const handleAddRider = async (formData: RiderFormData) => {
        if (!userData) return;
        try {
            const newRiderApp = { ...formData, clientName: formData.clientName as ClientName, trievId: formData.trievId || generateTrievId(), teamLeaderId: userData.id, teamLeaderName: userData.fullName, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), status: 'active' as RiderStatus, walletAmount: formData.walletAmount ?? 0 };
            const { data, error } = await supabase.from('riders').insert(mapRiderToDB(newRiderApp)).select().single();
            if (error) throw error;
            if (data) { const cr = mapRiderFromDB(data); await logActivity({ actionType: 'create', targetType: 'rider', targetId: cr.id, details: `Added new rider: ${cr.riderName} (${cr.trievId})` }); }
            toast.success('Rider added successfully');
            await fetchRiders();
            setShowAddModal(false);
        } catch (error) {
            console.error('Error adding rider:', error);
            toast.error(`Failed to add rider: ${error instanceof Error ? error.message : 'Unknown error'} `);
        }
    };

    const handleEditRider = async (formData: RiderFormData) => {
        if (!editingRider) return;
        try {
            const { error } = await supabase.from('riders').update(mapRiderToDB({ ...formData, clientName: formData.clientName as ClientName, updatedAt: new Date().toISOString() })).eq('id', editingRider.id);
            if (error) throw error;
            await logActivity({ actionType: 'update', targetType: 'rider', targetId: editingRider.id, details: `Updated rider: ${formData.riderName} (${formData.trievId})` });
            toast.success('Rider updated successfully');
            await fetchRiders();
            setEditingRider(null);
        } catch (error) { console.error('Error updating rider:', error); toast.error('Failed to update rider.'); }
    };

    const handleDeleteRider = async (rider: Rider) => {
        if (!confirm(`Are you sure you want to delete ${rider.riderName}?`)) return;
        try {
            const { error } = await supabase.from('riders').update({ status: 'deleted', deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', rider.id);
            if (error) throw error;
            await logActivity({ actionType: 'delete', targetType: 'rider', targetId: rider.id, details: `Deleted rider: ${rider.riderName} (${rider.trievId})` });
            toast.success('Rider moved to trash');
            await fetchRiders();
        } catch (error) { console.error('Error deleting rider:', error); toast.error('Failed to delete rider'); }
    };

    const handleRestoreRider = async (rider: Rider) => {
        try {
            const { error } = await supabase.from('riders').update({ status: 'active', deleted_at: null, updated_at: new Date().toISOString() }).eq('id', rider.id);
            if (error) throw error;
            await logActivity({ actionType: 'update', targetType: 'rider', targetId: rider.id, details: `Restored rider: ${rider.riderName} (${rider.trievId})` });
            toast.success('Rider restored');
            await fetchRiders();
        } catch (error) { console.error('Error restoring rider:', error); toast.error('Failed to restore rider'); }
    };



    const handlePermanentDelete = async (rider: Rider) => {
        if (!confirm(`PERMANENT DELETE: This will completely remove ${rider.riderName} from the system.This action CANNOT be undone.Are you absolutely sure ? `)) return;
        try {
            const { error } = await supabase.from('riders').update({ permanently_deleted: true, updated_at: new Date().toISOString() }).eq('id', rider.id);
            if (error) throw error;
            await logActivity({ actionType: 'delete', targetType: 'rider', targetId: rider.id, details: `Permanently deleted rider: ${rider.riderName} (${rider.trievId})` });
            toast.success('Rider permanently deleted');
            await fetchRiders();
        } catch (error) { console.error('Error permanently deleting rider:', error); toast.error('Failed to permanently delete rider'); }
    };

    const handleStatusChange = async (rider: Rider, newStatus: RiderStatus) => {
        try {
            const { error } = await supabase.from('riders').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', rider.id);
            if (error) throw error;
            await logActivity({ actionType: 'update', targetType: 'rider', targetId: rider.id, details: `Changed status to ${newStatus}: ${rider.riderName} (${rider.trievId})` });
            toast.success(`Status updated to ${newStatus} `);
            await fetchRiders();
        } catch (error) { console.error('Error changing status:', error); toast.error('Failed to change status'); }
    };

    const handleSelectAll = () => {
        if (selectedRiders.size === paginatedRiders.length) setSelectedRiders(new Set());
        else setSelectedRiders(new Set(paginatedRiders.map(r => r.id)));
    };

    const handleSelectOne = (riderId: string) => {
        const s = new Set(selectedRiders);
        if (s.has(riderId)) s.delete(riderId); else s.add(riderId);
        setSelectedRiders(s);
    };

    const handleBulkStatusChange = async (newStatus: RiderStatus) => {
        if (selectedRiders.size === 0) return;
        if (!confirm(`Change status of ${selectedRiders.size} rider(s) to ${newStatus}?`)) return;
        try {
            const { error } = await supabase.from('riders').update({ status: newStatus, updated_at: new Date().toISOString() }).in('id', Array.from(selectedRiders));
            if (error) throw error;
            await logActivity({ actionType: 'bulk_update', targetType: 'rider', targetId: 'multiple', details: `Changed status of ${selectedRiders.size} riders to ${newStatus} ` });
            toast.success('Riders updated successfully');
            setSelectedRiders(new Set());
            await fetchRiders();
        } catch (error) { console.error('Error in bulk status change:', error); toast.error('Failed to update riders.'); }
    };

    const handleBulkDelete = async () => {
        if (selectedRiders.size === 0) return;
        if (!confirm(`Delete ${selectedRiders.size} rider(s) ? `)) return;
        try {
            const { error } = await supabase.from('riders').update({ status: 'deleted', deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).in('id', Array.from(selectedRiders));
            if (error) throw error;
            await logActivity({ actionType: 'bulk_delete', targetType: 'rider', targetId: 'multiple', details: `Deleted ${selectedRiders.size} riders` });
            toast.success('Riders deleted successfully');
            setSelectedRiders(new Set());
            await fetchRiders();
        } catch (error) { console.error('Error in bulk delete:', error); toast.error('Failed to delete riders.'); }
    };

    const handleExport = async (format: ExportFormat) => {
        const ridersToExport = filteredRiders.filter(r => selectedRiders.size === 0 || selectedRiders.has(r.id));
        const filename = `riders_${activeTab}_${new Date().toISOString().split('T')[0]} `;
        try {
            if (format === 'csv') exportRidersToCSV(ridersToExport, filename);
            else if (format === 'excel') exportRidersToExcel(ridersToExport, filename);
            else if (format === 'pdf') exportRidersToPDF(ridersToExport, filename, `Riders Report - ${activeTab.toUpperCase()} `);
            await logActivity({ actionType: 'export', targetType: 'rider', targetId: 'multiple', details: `Exported ${ridersToExport.length} riders as ${format.toUpperCase()} ` });
        } catch (error) { console.error('Export error:', error); throw error; }
    };

    const handleCall = (phoneNumber: string) => {
        window.open(getCallLink(phoneNumber), '_self');
    };

    const handleWhatsApp = (phoneNumber: string) => {
        window.open(getWhatsAppLink(phoneNumber), '_blank');
    };



    const handleSort = (column: keyof Rider) => {
        if (sortBy === column) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        else { setSortBy(column); setSortOrder('asc'); }
    };

    const handleBulkCommunication = async (message: string) => {
        const list = riders.filter(r => selectedRiders.has(r.id));
        if (list.length === 0) { toast.error('No riders selected'); return; }
        try {
            for (const rider of list) {
                const amtStr = rider.walletAmount < 0 ? `-${Math.abs(rider.walletAmount).toLocaleString('en-IN')}` : Math.abs(rider.walletAmount).toLocaleString('en-IN');
                const msg = message.replace('{name}', rider.riderName).replace('{amount}', amtStr);
                window.open(`https://wa.me/${rider.mobileNumber.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
                await new Promise(r => setTimeout(r, 500));
            }
            await logActivity({ actionType: 'bulk_communication', targetType: 'rider', targetId: 'multiple', details: `Sent bulk communication to ${list.length} riders` });
            toast.success(`Opened WhatsApp for ${list.length} rider(s)`);
            setSelectedRiders(new Set());
        } catch (error) { console.error('Error sending bulk communication:', error); toast.error('Failed to send messages'); }
    };

    const canBulkStatusChange = userData?.permissions?.riders?.bulkActions?.statusChange ?? false;
    const canBulkDelete = userData?.permissions?.riders?.bulkActions?.delete ?? false;
    const canBulkSendReminders = userData?.permissions?.riders?.bulkActions?.sendReminders ?? true;

    const getBulkActions = () => {
        const actions = [];
        if (canBulkStatusChange) {
            actions.push({ label: 'Set Active', onClick: () => handleBulkStatusChange('active') });
            actions.push({ label: 'Set Inactive', onClick: () => handleBulkStatusChange('inactive') });
        }
        if (canBulkSendReminders) actions.push({ label: 'Bulk WhatsApp', onClick: () => setShowBulkCommunicationModal(true), variant: 'default', icon: <MessageCircle size={16} /> });
        if (canBulkDelete) actions.push({ label: 'Delete Selected', onClick: handleBulkDelete, variant: 'destructive', icon: <Trash2 size={16} /> });
        return actions;
    };

    const totalPages = Math.ceil(filteredRiders.length / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const paginatedRiders = filteredRiders.slice(startIndex, startIndex + pageSize);

    const availableExportColumns = [
        { key: 'trievId', label: 'Triev ID' }, { key: 'riderName', label: 'Rider Name' },
        { key: 'mobileNumber', label: 'Mobile Number' }, { key: 'chassisNumber', label: 'Chassis Number' },
        { key: 'clientName', label: 'Client Name' }, { key: 'walletAmount', label: 'Wallet Amount' },
        { key: 'status', label: 'Status' }, { key: 'teamLeaderName', label: 'Team Leader' },
        { key: 'remarks', label: 'Remarks' }
    ];

    // ─── Status config for badges
    const statusCfg = (status: string) => {
        if (status === 'active') return 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
        if (status === 'inactive') return 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800';
        return 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800';
    };
    const statusDot = (status: string) => {
        if (status === 'active') return 'bg-emerald-500 animate-pulse';
        if (status === 'inactive') return 'bg-amber-500';
        return 'bg-rose-500';
    };

    if (!canViewPage) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center p-8 bg-muted/30 rounded-2xl border border-border">
                    <UserX size={48} className="mx-auto mb-4 text-muted-foreground" />
                    <h2 className="text-xl font-bold mb-2">Access Restricted</h2>
                    <p className="text-muted-foreground">You do not have permission to view the Riders page.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* ── Premium Gradient Banner Header ── */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative rounded-2xl overflow-hidden border border-border/50 shadow-lg"
                style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(234,88,12,0.08) 50%, rgba(99,102,241,0.06) 100%)' }}
            >
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(245,158,11,1) 1px, transparent 1px), linear-gradient(90deg, rgba(245,158,11,1) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
                <div className="relative px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shrink-0"
                            style={{ background: 'linear-gradient(135deg, #f59e0b, #ea580c)' }}>
                            <span className="text-white font-black text-xl">🛵</span>
                        </div>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight">My Riders</h1>
                            <p className="text-muted-foreground text-sm mt-0.5">
                                Manage your riders •{' '}
                                <span className="font-semibold" style={{ color: '#f59e0b' }}>{riders.length} total</span>
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Stat chips */}
                        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black border" style={{ background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.2)', color: '#10b981' }}>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            {riders.filter(r => r.status === 'active').length} Active
                        </span>
                        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black border" style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)', color: '#ef4444' }}>
                            {riders.filter(r => r.status === 'active' && r.walletAmount < 0).length} Negative
                        </span>
                        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black border" style={{ background: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.2)', color: '#f59e0b' }}>
                            {riders.filter(r => r.status === 'active' && r.walletAmount >= 0 && r.walletAmount < 250).length} Low Balance
                        </span>
                        {canAddRider && (
                            <button
                                onClick={() => setShowAddModal(true)}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-white font-black text-sm shadow-lg hover:opacity-90 transition-all active:scale-95"
                                style={{ background: 'linear-gradient(135deg, #f59e0b, #ea580c)' }}
                            >
                                <Plus size={16} /> Add Rider
                            </button>
                        )}
                    </div>
                </div>
            </motion.div>

            {/* ── Tab Bar ── */}
            <div className="flex gap-1 p-1 bg-muted/60 backdrop-blur-sm rounded-2xl border border-border/50 w-fit overflow-x-auto">
                {(['active', 'zomato', 'inactive', ...(canDelete ? ['deleted'] : [])] as TabType[]).map((tab) => {
                    const cnt = tab === 'zomato' 
                        ? riders.filter(r => r.status === 'active' && (r.chassisNumber?.trim().toUpperCase().startsWith('P6DSVFMSP') || (r as any).chassis_number?.trim().toUpperCase().startsWith('P6DSVFMSP'))).length
                        : riders.filter(r => r.status === tab).length;
                    const tabColors: Record<string, string> = {
                        active: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/40 dark:text-emerald-400',
                        zomato: 'text-orange-600 bg-orange-50 dark:bg-orange-900/40 dark:text-orange-400',
                        inactive: 'text-amber-600 bg-amber-50 dark:bg-amber-900/40 dark:text-amber-400',
                        deleted: 'text-rose-600 bg-rose-50 dark:bg-rose-900/40 dark:text-rose-400',
                    };
                    return (
                        <button
                            key={tab}
                            onClick={() => handleTabChange(tab)}
                            className={`px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === tab ? 'bg-background shadow-md text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${tabColors[tab]}`}>{cnt}</span>
                        </button>
                    );
                })}
            </div>

            {/* ── Search + Filter Row ── */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={17} />
                    <input
                        type="text"
                        placeholder="Search by name, Triev ID, mobile, chassis..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background text-sm transition-all"
                    />
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                        className={`px-4 py-2.5 border rounded-xl flex items-center gap-2 text-sm font-medium transition-colors ${showAdvancedFilters ? 'bg-primary/10 border-primary/30 text-primary' : 'border-input hover:bg-accent'}`}
                    >
                        <Filter size={16} />
                        <span className="hidden sm:inline">Filter</span>
                    </button>
                    {canExport && (
                        <button
                            onClick={() => setShowExportModal(true)}
                            className="px-4 py-2.5 border border-input rounded-xl hover:bg-accent transition-colors flex items-center gap-2 text-sm font-medium"
                        >
                            <Download size={16} />
                            <span className="hidden sm:inline">Export</span>
                        </button>
                    )}
                </div>
            </div>

            {/* ── Advanced Filters ── */}
            {showAdvancedFilters && (
                <div className="bg-muted/40 border border-border rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-xs font-black uppercase tracking-wider text-muted-foreground mb-1.5">Client</label>
                        <select value={advancedFilters.client} onChange={(e) => setAdvancedFilters({ ...advancedFilters, client: e.target.value as ClientName | 'all' })}
                            className="w-full px-3 py-2.5 border border-input rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                            <option value="all">All Clients</option>
                            {['Zomato', 'Zepto', 'Blinkit', 'Uber', 'Porter', 'Rapido', 'Swiggy', 'FLK', 'Other'].map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-black uppercase tracking-wider text-muted-foreground mb-1.5">Wallet / Alerts</label>
                        <select value={advancedFilters.walletRange} onChange={(e) => setAdvancedFilters({ ...advancedFilters, walletRange: e.target.value as AdvancedFilters['walletRange'] })}
                            className="w-full px-3 py-2.5 border border-input rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                            <option value="all">All Wallets</option>
                            <option value="positive">Positive Balance</option>
                            <option value="negative">Negative Balance</option>
                            <option value="zero">Zero Balance</option>
                            <option value="low_balance">Low Balance (0-250)</option>
                            <option value="defaulter">🚨 Defaulters (&lt; -699)</option>
                            <option value="zero_collection">⚠️ Zero Collection Today</option>
                        </select>
                    </div>
                    <div className="flex items-end">
                        <button onClick={() => setAdvancedFilters({ client: 'all', walletRange: 'all' })}
                            className="w-full px-4 py-2.5 border border-input rounded-xl hover:bg-accent transition-colors text-sm font-medium">
                            Reset Filters
                        </button>
                    </div>
                </div>
            )}

            {/* ── Bulk Actions Bar ── */}
            {selectedRiders.size > 0 && (
                <BulkActionsBar
                    selectedCount={selectedRiders.size}
                    totalCount={filteredRiders.length}
                    onSelectAll={() => setSelectedRiders(new Set(filteredRiders.map(r => r.id)))}
                    onDeselectAll={() => setSelectedRiders(new Set())}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    actions={getBulkActions() as any}
                />
            )}

            {/* ── Quick Stats & TL Defaulter Alert ── */}
            {!loading && riders.length > 0 && (
                <div className="space-y-3">
                    {(() => {
                        const defaulters = riders.filter(r => r.status === 'active' && r.walletAmount <= -699);
                        const totalDebt = defaulters.reduce((acc, r) => acc + Math.abs(r.walletAmount), 0);

                        if (defaulters.length === 0) return null;

                        return (
                            <div className="bg-gradient-to-r from-red-500/15 via-rose-500/10 to-orange-500/15 border border-red-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-500 flex items-center justify-center font-black flex-shrink-0 animate-pulse">
                                        🚨
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-red-600 dark:text-red-400 flex items-center gap-2">
                                            {defaulters.length} Defaulter Riders Detected
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500 text-white font-mono">
                                                ₹{totalDebt.toLocaleString('en-IN')} Total Outstanding
                                            </span>
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            Riders with negative balance &le; -₹699 needing immediate payment follow-up.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setAdvancedFilters(p => ({ ...p, walletRange: 'defaulter' }));
                                        setShowAdvancedFilters(true);
                                        const defaulterIds = new Set(defaulters.map(r => r.id));
                                        setSelectedRiders(defaulterIds);
                                        setShowBulkCommunicationModal(true);
                                    }}
                                    className="w-full sm:w-auto px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-red-500/20 transition-all flex items-center justify-center gap-2 active:scale-95 whitespace-nowrap"
                                >
                                    <MessageCircle size={15} /> 1-Click WhatsApp Reminders
                                </button>
                            </div>
                        );
                    })()}

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            { label: 'Active', count: riders.filter(r => r.status === 'active').length, cls: 'border-l-emerald-500 bg-emerald-50/60 dark:bg-emerald-900/10', txt: 'text-emerald-600 dark:text-emerald-400' },
                            { label: 'Low Balance (0-250)', count: riders.filter(r => r.status === 'active' && r.walletAmount >= 0 && r.walletAmount <= 250).length, cls: 'border-l-orange-500 bg-orange-50/60 dark:bg-orange-900/10', txt: 'text-orange-600 dark:text-orange-400' },
                            { label: 'Inactive', count: riders.filter(r => r.status === 'inactive').length, cls: 'border-l-amber-500 bg-amber-50/60 dark:bg-amber-900/10', txt: 'text-amber-600 dark:text-amber-400' },
                            { label: 'Deleted', count: riders.filter(r => r.status === 'deleted').length, cls: 'border-l-rose-500 bg-rose-50/60 dark:bg-rose-900/10', txt: 'text-rose-600 dark:text-rose-400' },
                        ].map(s => (
                            <div key={s.label} className={`rounded-2xl border-l-4 px-4 py-3 border border-border/50 ${s.cls}`}>
                                <p className={`text-xl font-black ${s.txt}`}>{s.count}</p>
                                <p className="text-xs text-muted-foreground font-semibold truncate">{s.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Live Alert Center (TL-scoped) ── */}
            {userData?.id && (
                <LiveAlertCenter teamLeaderId={userData.id} portalBase="/team-leader" />
            )}

            {/* ── Main Table / Card Panel ── */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                {loading ? (
                    // Shimmer skeleton loader
                    <div className="p-4 space-y-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-4 px-3 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)' }}>
                                <div className="w-4 h-4 rounded bg-muted animate-pulse shrink-0" />
                                <div className="w-9 h-9 rounded-xl bg-muted animate-pulse shrink-0" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-3 bg-muted rounded animate-pulse" style={{ width: `${55 + i * 7}%`, animationDelay: `${i * 0.08}s` }} />
                                    <div className="h-2.5 bg-muted/60 rounded animate-pulse" style={{ width: `${35 + i * 5}%`, animationDelay: `${i * 0.08 + 0.1}s` }} />
                                </div>
                                <div className="h-6 w-16 bg-muted rounded-lg animate-pulse" style={{ animationDelay: `${i * 0.08 + 0.2}s` }} />
                                <div className="h-7 w-20 bg-muted rounded-xl animate-pulse" style={{ animationDelay: `${i * 0.08 + 0.3}s` }} />
                            </div>
                        ))}
                    </div>
                ) : filteredRiders.length === 0 ? (
                    <div className="text-center py-20 px-6">
                        <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-4">
                            <UserX size={28} className="text-muted-foreground" />
                        </div>
                        <p className="font-bold text-foreground mb-1">
                            {searchTerm ? 'No riders match your search' : `No ${activeTab} riders`}
                        </p>
                        <p className="text-sm text-muted-foreground">
                            {riders.length === 0 ? 'Click "Add Rider" to get started.' : 'Try adjusting your filters.'}
                        </p>
                    </div>
                ) : (
                    <>
                        {/* ── Desktop Table ── */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full">
                                <thead className="border-b border-border/50" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(99,102,241,0.04))' }}>
                                    <tr>
                                        <th className="px-5 py-3.5 text-left w-10">
                                            <input type="checkbox"
                                                checked={paginatedRiders.length > 0 && paginatedRiders.every(r => selectedRiders.has(r.id))}
                                                onChange={handleSelectAll}
                                                className="w-4 h-4 rounded accent-primary cursor-pointer" />
                                        </th>
                                        {[
                                            { label: 'Rider', key: 'riderName' },
                                            { label: 'Triev ID', key: 'trievId' },
                                            { label: 'Mobile', key: null },
                                            { label: 'Chassis No.', key: 'chassisNumber' },
                                            { label: 'Wallet', key: 'walletAmount' },
                                            { label: 'AI Rating', key: null },
                                            { label: 'Allotment', key: 'allotmentDate' },
                                            { label: 'Status', key: 'status' },
                                        ].map(col => (
                                            <th key={col.label}
                                                onClick={() => col.key && handleSort(col.key as keyof Rider)}
                                                className={`px-5 py-3.5 text-left text-[10px] font-black uppercase tracking-wider text-muted-foreground/70 ${col.key ? 'cursor-pointer hover:bg-amber-500/5 hover:text-amber-600 transition-colors select-none' : ''}`}>
                                                <span className="flex items-center gap-1">
                                                    {col.label}
                                                    {col.key && sortBy === col.key && <span className="text-amber-500 text-xs">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                                                </span>
                                            </th>
                                        ))}
                                        <th className="px-5 py-3.5 text-right text-[10px] font-black uppercase tracking-wider text-muted-foreground/70">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                    {paginatedRiders.map((rider) => (
                                        <tr key={rider.id}
                                            className={`hover:bg-muted/25 transition-all duration-150 ${selectedRiders.has(rider.id) ? 'bg-primary/5' : ''}`}>
                                            <td className="px-5 py-4">
                                                <input type="checkbox" checked={selectedRiders.has(rider.id)} onChange={() => handleSelectOne(rider.id)}
                                                    className="w-4 h-4 rounded accent-primary cursor-pointer" />
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    {/* Premium Avatar with status dot */}
                                                    <div className="relative shrink-0">
                                                        <div
                                                            className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-md"
                                                            style={{ background: `hsl(${(rider.riderName?.charCodeAt(0) || 65) * 47 % 360}, 60%, 40%)` }}
                                                        >
                                                            {(rider.riderName || '?').slice(0, 2).toUpperCase()}
                                                        </div>
                                                        <span
                                                            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${statusDot(rider.status)}`}
                                                            title={rider.status}
                                                        />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-sm text-foreground truncate max-w-[130px]">{rider.riderName}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <button onClick={() => setViewingRider(rider)} className="text-amber-500 dark:text-amber-400 font-black text-xs hover:underline hover:text-amber-600 transition-colors font-mono">
                                                    {rider.trievId}
                                                </button>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-sm text-foreground/80 whitespace-nowrap">{rider.mobileNumber}</span>
                                                    <div className="flex gap-1">
                                                        {riderActionPermissions.canCall && (
                                                            <button onClick={() => handleCall(rider.mobileNumber)} className="p-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors" title="Call">
                                                                <Phone size={13} />
                                                            </button>
                                                        )}
                                                        {riderActionPermissions.canWhatsApp && (
                                                            <button onClick={() => handleWhatsApp(rider.mobileNumber)} className="p-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors" title="WhatsApp">
                                                                <MessageCircle size={13} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            {/* ── Chassis Number (replaces Client + Allotment) ── */}
                                            <td className="px-5 py-4">
                                                <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
                                                    {rider.chassisNumber || '—'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-1.5 whitespace-nowrap">
                                                    <span className={`text-sm font-black ${rider.walletAmount > 0 ? 'text-emerald-600 dark:text-emerald-400' : rider.walletAmount < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground'}`}>
                                                        {rider.walletAmount >= 0 ? '+' : ''}₹{rider.walletAmount.toLocaleString('en-IN')}
                                                    </span>
                                                    {rider.status === 'active' && (() => {
                                                        const w = rider.walletAmount;
                                                        // No badge for wallet > 250
                                                        if (w > 250) return null;
                                                        const level = w <= -1000 ? 'critical' : w <= -249 ? 'high' : w < 0 ? 'medium' : 'low';
                                                        return (
                                                            <RiskBadge
                                                                level={level}
                                                                score={0}
                                                                showScore={false}
                                                            />
                                                        );
                                                    })()}
                                                    {rider.status === 'active' && ((rider.chassisNumber?.trim().toUpperCase().startsWith('P6DSVFMSP') || (rider as any).chassis_number?.trim().toUpperCase().startsWith('P6DSVFMSP')) ? rider.walletAmount <= 300 : rider.walletAmount < 0) && (
                                                        <button onClick={(e) => { e.stopPropagation(); setSelectedReminderRider(rider); setReminderType('warning'); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-lg shadow-sm transition-colors" title="Send Reminder">
                                                            <AlertTriangle size={16} /> Remind
                                                        </button>
                                                    )}
                                                    {rider.status === 'active' && !(rider.chassisNumber?.trim().toUpperCase().startsWith('P6DSVFMSP') || (rider as any).chassis_number?.trim().toUpperCase().startsWith('P6DSVFMSP')) && rider.walletAmount >= 0 && rider.walletAmount <= 250 && (
                                                        <button onClick={(e) => { e.stopPropagation(); setSelectedReminderRider(rider); setReminderType('low_balance'); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg shadow-sm transition-colors" title="Send Low Balance WhatsApp Reminder">
                                                            <MessageCircle size={16} /> Low Bal.
                                                        </button>
                                                    )}
                                                    {rider.status === 'active' && rider.walletAmount < 250 && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedCallRider(rider);
                                                                setShowElevenLabsModal(true);
                                                            }}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
                                                            title="Trigger AI Voice Call"
                                                        >
                                                            <Phone size={14} /> AI Call
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                            {/* AI Rating Column */}
                                            <td className="px-5 py-4">
                                                <div className="flex flex-col items-center gap-1">
                                                    <StarRating
                                                        rating={riderRatings.get(rider.id) || null}
                                                        size="sm"
                                                        onClick={() => setRatingDetailRider(rider)}
                                                    />
                                                    {riderRatings.get(rider.id)?.churn.level !== 'stable' && riderRatings.get(rider.id) && (
                                                        <ChurnPredictionBadge churn={riderRatings.get(rider.id)!.churn} size="sm" showPercentage={false} />
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-sm text-muted-foreground whitespace-nowrap">
                                                {rider.allotmentDate ? new Date(rider.allotmentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                                            </td>

                                            <td className="px-5 py-4">
                                                <span className={`inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-full border ${statusCfg(rider.status)}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDot(rider.status)}`} />
                                                    {rider.status}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <ActionDropdownMenu
                                                    rider={rider}
                                                    onView={() => setViewingRider(rider)}
                                                    onEdit={() => setEditingRider(rider)}
                                                    onStatusChange={(status) => handleStatusChange(rider, status)}
                                                    onDelete={() => handleDeleteRider(rider)}
                                                    onRestore={() => handleRestoreRider(rider)}
                                                    onPermanentDelete={() => handlePermanentDelete(rider)}
                                                    onElevenLabsCall={userData?.permissions?.aiCalling?.enabled !== false ? () => { setSelectedCallRider(rider); setShowElevenLabsModal(true); } : undefined}
                                                    userRole="teamLeader"
                                                    permissions={riderActionPermissions}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* ── Mobile Card View ── */}
                        <div className="md:hidden">
                            <div className="px-4 py-3 bg-muted/30 flex items-center justify-between border-b border-border/50">
                                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-muted-foreground">
                                    <input type="checkbox"
                                        checked={paginatedRiders.length > 0 && paginatedRiders.every(r => selectedRiders.has(r.id))}
                                        onChange={handleSelectAll}
                                        className="w-4 h-4 rounded accent-primary" />
                                    Select all
                                </label>
                                <span className="text-xs text-muted-foreground">{filteredRiders.length} riders</span>
                            </div>
                            <div className="divide-y divide-border/50">
                                {paginatedRiders.map((rider) => (
                                    <div key={rider.id} className={`p-4 transition-colors ${selectedRiders.has(rider.id) ? 'bg-primary/5' : 'hover:bg-muted/20'}`}>
                                        <div className="flex items-start gap-3">
                                            <input type="checkbox" checked={selectedRiders.has(rider.id)} onChange={() => handleSelectOne(rider.id)}
                                                className="w-4 h-4 rounded accent-primary mt-1.5 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                {/* Card Header */}
                                                <div className="flex items-start justify-between gap-2 mb-3">
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-lg flex-shrink-0">
                                                            {(rider.riderName || '?').charAt(0).toUpperCase()}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <button onClick={() => setViewingRider(rider)} className="font-black text-sm text-foreground block truncate max-w-[160px] text-left hover:text-primary transition-colors">
                                                                {rider.riderName}
                                                            </button>
                                                            <button onClick={() => setViewingRider(rider)} className="text-xs text-primary font-bold">{rider.trievId}</button>
                                                        </div>
                                                    </div>
                                                    <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full border flex-shrink-0 ${statusCfg(rider.status)}`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${statusDot(rider.status)}`} />
                                                        {rider.status}
                                                    </span>
                                                </div>

                                                {/* Details Grid */}
                                                <div className="grid grid-cols-2 gap-2 mb-3">
                                                    <div className="bg-muted/40 rounded-xl p-2.5">
                                                        <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground mb-0.5">Mobile</p>
                                                        <p className="text-sm font-bold text-foreground">{rider.mobileNumber}</p>
                                                    </div>
                                                    <div className="bg-muted/40 rounded-xl p-2.5">
                                                        <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground mb-0.5">Wallet</p>
                                                        <p className={`text-sm font-black ${rider.walletAmount > 0 ? 'text-emerald-600' : rider.walletAmount < 0 ? 'text-rose-600' : 'text-muted-foreground'}`}>
                                                            {rider.walletAmount >= 0 ? '+' : ''}₹{rider.walletAmount.toLocaleString('en-IN')}
                                                        </p>
                                                    </div>
                                                    <div className="bg-muted/40 rounded-xl p-2.5">
                                                        <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground mb-0.5">Chassis No.</p>
                                                        <p className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300 break-all">
                                                            {rider.chassisNumber || '—'}
                                                        </p>
                                                    </div>
                                                    <div className="bg-muted/40 rounded-xl p-2.5">
                                                        <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground mb-0.5">Allotment</p>
                                                        <p className="text-xs font-bold text-foreground">
                                                            {rider.allotmentDate ? new Date(rider.allotmentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Action Buttons */}
                                                <div className="flex items-center gap-2">
                                                    {riderActionPermissions.canCall && (
                                                        <button onClick={() => handleCall(rider.mobileNumber)} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-bold border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors active:scale-95">
                                                            <Phone size={13} /> Call
                                                        </button>
                                                    )}
                                                    {riderActionPermissions.canWhatsApp && (
                                                        <button onClick={() => handleWhatsApp(rider.mobileNumber)} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-bold border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors active:scale-95">
                                                            <MessageCircle size={13} /> WA
                                                        </button>
                                                    )}
                                                    {rider.status === 'active' && ((rider.chassisNumber?.trim().toUpperCase().startsWith('P6DSVFMSP') || (rider as any).chassis_number?.trim().toUpperCase().startsWith('P6DSVFMSP')) ? rider.walletAmount <= 300 : rider.walletAmount < 0) && (
                                                        <button onClick={(e) => { e.stopPropagation(); setSelectedReminderRider(rider); setReminderType('warning'); }} className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 rounded-xl text-base font-bold border border-rose-200 dark:border-rose-800 hover:bg-rose-100 transition-colors active:scale-95">
                                                            <AlertTriangle size={18} /> Remind
                                                        </button>
                                                    )}
                                                    {rider.status === 'active' && !(rider.chassisNumber?.trim().toUpperCase().startsWith('P6DSVFMSP') || (rider as any).chassis_number?.trim().toUpperCase().startsWith('P6DSVFMSP')) && rider.walletAmount >= 0 && rider.walletAmount <= 250 && (
                                                        <button onClick={(e) => { e.stopPropagation(); setSelectedReminderRider(rider); setReminderType('low_balance'); }} className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 rounded-xl text-base font-bold border border-orange-200 dark:border-orange-800 hover:bg-orange-100 transition-colors active:scale-95">
                                                            <MessageCircle size={18} /> Low Bal.
                                                        </button>
                                                    )}
                                                    {rider.status === 'active' && rider.walletAmount < 250 && (
                                                        <button onClick={(e) => { e.stopPropagation(); setSelectedCallRider(rider); setShowElevenLabsModal(true); }} className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-bold shadow-md transition-colors active:scale-95">
                                                            <Phone size={15} /> AI Call
                                                        </button>
                                                    )}
                                                    <ActionDropdownMenu
                                                        rider={rider}
                                                        onView={() => setViewingRider(rider)}
                                                        onEdit={() => setEditingRider(rider)}
                                                        onStatusChange={(status) => handleStatusChange(rider, status)}
                                                        onDelete={() => handleDeleteRider(rider)}
                                                        onRestore={() => handleRestoreRider(rider)}
                                                        onPermanentDelete={() => handlePermanentDelete(rider)}
                                                        onElevenLabsCall={userData?.permissions?.aiCalling?.enabled !== false ? () => { setSelectedCallRider(rider); setShowElevenLabsModal(true); } : undefined}
                                                        userRole="teamLeader"
                                                        permissions={riderActionPermissions}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* ── Pagination ── */}
                        <div className="border-t border-border px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 bg-muted/20">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">Rows:</span>
                                    <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                                        className="px-2 py-1.5 border border-input rounded-lg bg-background text-xs">
                                        {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                                    </select>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                    {startIndex + 1}–{Math.min(startIndex + pageSize, filteredRiders.length)} of <strong>{filteredRiders.length}</strong>
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1}
                                    className="px-2 py-1.5 border border-input rounded-lg hover:bg-accent transition-colors disabled:opacity-40 text-xs font-bold">«</button>
                                <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}
                                    className="p-1.5 border border-input rounded-lg hover:bg-accent transition-colors disabled:opacity-40">
                                    <ChevronLeft size={15} />
                                </button>
                                <span className="text-xs text-muted-foreground px-1">
                                    <strong>{currentPage}</strong> / <strong>{totalPages}</strong>
                                </span>
                                <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}
                                    className="p-1.5 border border-input rounded-lg hover:bg-accent transition-colors disabled:opacity-40">
                                    <ChevronRight size={15} />
                                </button>
                                <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}
                                    className="px-2 py-1.5 border border-input rounded-lg hover:bg-accent transition-colors disabled:opacity-40 text-xs font-bold">»</button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* ── Modals ── */}
            {showAddModal && <AddRiderForm onClose={() => setShowAddModal(false)} onSubmit={handleAddRider} />}
            {editingRider && <AddRiderForm onClose={() => setEditingRider(null)} onSubmit={handleEditRider} initialData={editingRider as unknown as RiderFormData} isEdit />}
            {viewingRider && <RiderDetailsModal rider={viewingRider} onClose={() => setViewingRider(null)} onUpdate={fetchRiders} />}
            {selectedReminderRider && (
                <AIReminderModal
                    isOpen={true}
                    onClose={() => setSelectedReminderRider(null)}
                    rider={selectedReminderRider}
                    type={reminderType}
                />
            )}
            {showExportModal && (
                <ExportModal isOpen={showExportModal} onClose={() => setShowExportModal(false)} onExport={handleExport}
                    availableColumns={availableExportColumns}
                    title={`Export ${selectedRiders.size > 0 ? `${selectedRiders.size} Selected` : 'All'} Riders`} />
            )}
            {showBulkCommunicationModal && (
                <BulkCommunicationModal riders={riders.filter(r => selectedRiders.has(r.id))}
                    onClose={() => setShowBulkCommunicationModal(false)} onSend={handleBulkCommunication} />
            )}
            {ratingDetailRider && (
                <RiderRatingDetailModal
                    isOpen={true}
                    rider={ratingDetailRider}
                    initialRating={riderRatings.get(ratingDetailRider.id) || null}
                    onClose={() => setRatingDetailRider(null)}
                />
            )}
            <ElevenLabsCallModal
                isOpen={showElevenLabsModal}
                onClose={() => { setShowElevenLabsModal(false); setSelectedCallRider(null); }}
                rider={selectedCallRider}
                currentUserName={userData?.fullName || userData?.email}
            />
        </div>
    );
};

export default MyRiders;
