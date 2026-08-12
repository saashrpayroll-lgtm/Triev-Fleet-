import React, { useState, useEffect, useRef } from 'react';
import { 
    FileSpreadsheet, Wallet, History, HelpCircle, FileText, AlertTriangle, 
    Trash2, RefreshCw, Download as DownloadIcon, Search, Sliders, Users, 
    CheckCircle2, Pause, Play, Clock, Sparkles, ShieldCheck, Check, Table
} from 'lucide-react';
import { toast } from 'sonner';
import DataImport from '@/components/DataImport';
import GlassCard from '@/components/GlassCard';
import { processRiderImport, processWalletUpdate, processRentCollectionImport } from '@/utils/importUtils';
import { syncGoogleSheet } from '@/utils/googleSheetsUtils';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/config/supabase';
import { downloadRiderTemplate, downloadWalletTemplate, downloadRentCollectionTemplate } from '@/utils/exportUtils';
import { logActivity } from '@/utils/activityLog';
import RiderAuditModal from '@/components/RiderAuditModal';
import ImportLogModal from '@/components/ImportLogModal';
import ColumnMappingModal from '@/components/ColumnMappingModal';
import StaffFilterSelectorModal from '@/components/StaffFilterSelectorModal';
import { RiderColumnMapping, LiveSyncStaffFilter, RiderImportConfig } from '@/types';

import liveSheetAutoSync, { LiveSyncEngineStatus } from '@/services/LiveSheetAutoSyncService';

interface DataManagementProps {
    scopedCityOpsId?: string;
}

const DEFAULT_COLUMN_MAPPING: RiderColumnMapping = {
    primaryKey: 'TriEVRiderID',
    riderName: 'Rider Name',
    mobileNumber: 'MobileNo',
    chassisNumber: 'Chassis No',
    clientName: 'quick commerce',
    clientId: 'RiderId',
    allotmentDate: 'Registered Date',
    walletAmount: 'Balance',
    teamLeader: 'TL Name',
    reportingManager: 'Reproting Manager',
    cityOps: 'Skip Manager',
    remarks: 'days'
};

const DEFAULT_STAFF_FILTER: LiveSyncStaffFilter = {
    teamLeaderIds: [],
    reportingManagerIds: [],
    cityOpsIds: [],
    syncAllStaff: false
};

const DataManagement: React.FC<DataManagementProps> = ({ scopedCityOpsId }) => {
    const { userData } = useSupabaseAuth();
    
    // Persistent Settings State
    const [riderConfig, setRiderConfig] = useState<RiderImportConfig>({ 
        sheetId: '', 
        range: 'Sheet1!A1:Z10000', 
        apiKey: '', 
        enabled: false, 
        strictMirror: false,
        syncIntervalMinutes: 2, // Default: every 2 minutes
        columnMapping: DEFAULT_COLUMN_MAPPING,
        staffFilter: DEFAULT_STAFF_FILTER
    });
    const [walletConfig, setWalletConfig] = useState({ sheetId: '', range: 'Sheet1!A1:C10000', apiKey: '', enabled: false });
    const [rentConfig, setRentConfig] = useState({ sheetId: '', range: 'Sheet1!A1:C10000', apiKey: '', enabled: false });

    // UI Tabs & Modals
    const [activeTab, setActiveTab] = useState<'import' | 'wallet' | 'rent_collection' | 'gsheets' | 'history' | 'help'>('gsheets');
    const [history, setHistory] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(new Set());
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
    const [syncError, setSyncError] = useState<string | null>(null);
    const [showAuditModal, setShowAuditModal] = useState(false);
    const [showColumnMappingModal, setShowColumnMappingModal] = useState(false);
    const [showStaffFilterModal, setShowStaffFilterModal] = useState(false);
    const [selectedLogRecord, setSelectedLogRecord] = useState<any | null>(null);
    const [nextSyncCountdown, setNextSyncCountdown] = useState<number>(0);
    const [engineStatus, setEngineStatus] = useState<LiveSyncEngineStatus>(liveSheetAutoSync.getStatus());

    // Subscribe to Global Live Sheet Auto Sync Service
    useEffect(() => {
        const unsubscribe = liveSheetAutoSync.subscribe(status => {
            setEngineStatus(status);
            setIsSyncing(status.isSyncing);
            setLastSyncTime(status.lastSyncTime);
            setNextSyncCountdown(status.nextSyncCountdown);
            setSyncError(status.syncError);
            if (status.config) {
                setRiderConfig(prev => ({
                    ...prev,
                    ...status.config,
                    columnMapping: status.config?.columnMapping || DEFAULT_COLUMN_MAPPING,
                    staffFilter: status.config?.staffFilter || DEFAULT_STAFF_FILTER
                }));
            }
        });
        return () => unsubscribe();
    }, []);

    // Refs for interval safety
    const riderConfigRef = useRef(riderConfig);
    const walletConfigRef = useRef(walletConfig);
    const rentConfigRef = useRef(rentConfig);
    const isSyncingRef = useRef(isSyncing);

    useEffect(() => { riderConfigRef.current = riderConfig; }, [riderConfig]);
    useEffect(() => { walletConfigRef.current = walletConfig; }, [walletConfig]);
    useEffect(() => { rentConfigRef.current = rentConfig; }, [rentConfig]);
    useEffect(() => { isSyncingRef.current = isSyncing; }, [isSyncing]);

    // Fetch Settings on Mount
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const { data } = await supabase
                    .from('system_settings')
                    .select('key, value')
                    .in('key', ['rider_import_config', 'wallet_update_config', 'rent_collection_sync_config']);

                if (data) {
                    data.forEach(setting => {
                        if (setting.key === 'rider_import_config') {
                            const val = setting.value;
                            if (val?.range === 'Sheet1!A1:Z1000') {
                                val.range = 'Sheet1!A1:Z10000';
                            }
                            setRiderConfig(prev => ({ 
                                ...prev, 
                                ...val,
                                columnMapping: val.columnMapping || DEFAULT_COLUMN_MAPPING,
                                staffFilter: val.staffFilter || DEFAULT_STAFF_FILTER,
                                syncIntervalMinutes: val.syncIntervalMinutes || 2
                            }));
                        }
                        if (setting.key === 'wallet_update_config') {
                            setWalletConfig(prev => ({ ...prev, ...setting.value }));
                        }
                        if (setting.key === 'rent_collection_sync_config') {
                            setRentConfig(prev => ({ ...prev, ...setting.value }));
                        }
                    });
                }
            } catch (err) {
                console.error("Failed to load settings from database:", err);
            }
        };
        fetchSettings();
    }, []);

    // Save Settings Helper
    const saveSettings = async (type: 'rider' | 'wallet' | 'rent_collection', newConfig: any) => {
        if (type === 'rider') {
            const success = await liveSheetAutoSync.saveConfig(newConfig);
            if (success) toast.success("Rider Live Sync Settings Saved & Background Service Updated!");
            else toast.error("Failed to save settings to database.");
            return;
        }
        const key = type === 'wallet' ? 'wallet_update_config' : 'rent_collection_sync_config';
        try {
            await supabase.from('system_settings').upsert({
                key,
                value: newConfig,
                updated_at: new Date().toISOString()
            });
            toast.success("Settings saved successfully!");
        } catch (err) {
            console.error("Failed to save settings:", err);
            toast.error("Failed to save settings to database.");
        }
    };

    const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
            let historyQuery = supabase
                .from('import_history')
                .select(`
                    id,
                    adminName:admin_name,
                    importType:import_type,
                    totalRows:total_rows,
                    successCount:success_count,
                    failureCount:failure_count,
                    updated_count,
                    skipped_count,
                    skipped_details,
                    status,
                    timestamp,
                    errors
                `)
                .order('timestamp', { ascending: false })
                .limit(30);

            if (scopedCityOpsId && userData?.id) {
                historyQuery = historyQuery.eq('admin_id', userData.id);
            }

            const { data, error } = await historyQuery;

            if (error) {
                console.error("Supabase Error fetching history:", error);
                toast.error(`History Fetch Failed: ${error.message}`);
                throw error;
            }
            setHistory(data || []);
        } catch (err: any) {
            console.error("Error fetching history:", err);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleGoogleSync = async (e: React.FormEvent | null, isAuto = false, mode: 'rider' | 'wallet' | 'rent_collection', config: any) => {
        if (e) e.preventDefault();
        if (!userData || isSyncingRef.current) return;

        if (scopedCityOpsId) {
            alert("Data Uploads are restricted to Admin Panel.");
            return;
        }

        if (mode === 'rider') {
            try {
                const toastId = toast.loading("Syncing Live Google Sheet in Background...");
                const summary = await liveSheetAutoSync.executeAutoSync(true);
                if (summary) {
                    const totalActiveSynced = summary.success + (summary.updated || 0) + (summary.unchanged || 0);
                    toast.success(`Live Sync Complete! Total Active Synced: ${totalActiveSynced} (${summary.success} New, ${summary.updated || 0} Updated, ${summary.unchanged || 0} Identical, ${summary.inactivated || 0} Inactivated)`, { id: toastId });
                    fetchHistory();
                } else {
                    toast.error("Sync did not produce results.", { id: toastId });
                }
            } catch (err: any) {
                toast.error("Sync Error: " + (err.message || 'Failed'));
            }
            return;
        }

        setIsSyncing(true);
        setSyncError(null);

        try {
            if (!config.sheetId || !config.range || config.sheetId.length < 10) {
                if (!isAuto) toast.error("Please enter valid Sheet ID and Range");
                throw new Error("Invalid Configuration");
            }

            let formattedRange = config.range.trim();
            if (formattedRange.includes('!')) {
                const parts = formattedRange.split('!');
                if (parts.length === 2) {
                    let sheetName = parts[0];
                    const cells = parts[1];
                    if (sheetName.includes(' ') && !sheetName.startsWith("'") && !sheetName.endsWith("'")) {
                        sheetName = `'${sheetName}'`;
                        formattedRange = `${sheetName}!${cells}`;
                    }
                }
            }

            const summary = await syncGoogleSheet({
                sheetId: config.sheetId,
                range: formattedRange,
                apiKey: config.apiKey || undefined,
                columnMapping: config.columnMapping,
                staffFilter: config.staffFilter
            }, userData.id, userData.fullName, mode, config.strictMirror || false);

            setLastSyncTime(new Date());

            if (!isAuto) {
                toast.success(`Sync Complete! Success: ${summary.success}, Updated: ${summary.updated || 0}, Inactivated: ${summary.inactivated || 0}, Reactivated: ${summary.reactivated || 0}`);
            } else {
                toast.success(`${mode === 'wallet' ? 'Wallets' : 'Rent Collection'} auto-synced successfully.`);
            }

            fetchHistory();
        } catch (err: any) {
            console.error("Sync Failed:", err);
            setSyncError(err.message || 'Sync failed');
            if (!isAuto) toast.error("Sync Failed: " + err.message);
        } finally {
            setIsSyncing(false);
        }
    };

    const [isEmergencyResyncing, setIsEmergencyResyncing] = useState(false);
    const handleEmergencyResync = async () => {
        if (!confirm("This will force-recalculate all Daily Collection metrics for today across all Team Leaders. Proceed?")) return;

        setIsEmergencyResyncing(true);
        const toastId = toast.loading("Resyncing Daily Collections cache from Ledger history...");

        try {
            const { error } = await supabase.rpc('resync_all_daily_collections');
            if (error) throw error;

            toast.success("Successfully resynced all daily collection caches!", { id: toastId });
            logActivity({
                actionType: 'systemEmergencyResync',
                targetType: 'system',
                targetId: 'daily_collections',
                details: `Manually triggered emergency resync of daily collections cache`,
                performedBy: userData?.email || 'admin'
            }).catch(console.error);
        } catch (err: any) {
            console.error(err);
            toast.error("Failed to resync caches: " + err.message, { id: toastId });
        } finally {
            setIsEmergencyResyncing(false);
        }
    };

    const handleRiderImport = async (data: any[]) => {
        if (!userData) return;
        try {
            const summary = await processRiderImport(data, userData.id, userData.fullName);
            alert(`Import Complete!\nSuccess: ${summary.success}\nFailed: ${summary.failed}`);
            setActiveTab('history');
        } catch (error) {
            console.error(error);
            alert("Import Failed. Check console for details.");
        }
    };

    const handleWalletImport = async (data: any[]) => {
        if (!userData) return;
        try {
            const summary = await processWalletUpdate(data, userData.id, userData.fullName);
            alert(`Wallet Update Complete!\nSuccess: ${summary.success}\nFailed: ${summary.failed}`);
            setActiveTab('history');
        } catch (error) {
            console.error(error);
            alert("Update Failed. Check console for details.");
        }
    };

    const handleRentCollectionImport = async (data: any[]) => {
        if (!userData) return;
        try {
            const summary = await processRentCollectionImport(data, userData.id, userData.fullName);
            alert(`Rent Collection Import Complete!\nSuccess: ${summary.success}\nFailed: ${summary.failed}`);
            setActiveTab('history');
        } catch (error) {
            console.error(error);
            alert("Import Failed. Check console for details.");
        }
    };

    const handleDeleteHistory = async (id: string) => {
        if (!confirm("Are you sure you want to delete this import record?")) return;
        try {
            const { error } = await supabase.from('import_history').delete().eq('id', id);
            if (error) throw error;

            setSelectedHistoryIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(id);
                return newSet;
            });
            fetchHistory();
        } catch (error) {
            console.error("Error deleting history:", error);
            alert("Failed to delete record.");
        }
    };

    const handleBulkDeleteHistory = async () => {
        if (selectedHistoryIds.size === 0) return;
        if (!confirm(`Delete ${selectedHistoryIds.size} records? This cannot be undone.`)) return;

        try {
            const idsToDelete = Array.from(selectedHistoryIds);
            const { error } = await supabase.from('import_history').delete().in('id', idsToDelete);
            if (error) throw error;
            setSelectedHistoryIds(new Set());
            fetchHistory();
        } catch (error) {
            console.error("Error bulk deleting history:", error);
            alert("Failed to delete records.");
        }
    };

    const handleSelectHistory = (id: string) => {
        setSelectedHistoryIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };

    const handleSelectAllHistory = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedHistoryIds(new Set(history.map(h => h.id)));
        } else {
            setSelectedHistoryIds(new Set());
        }
    };

    useEffect(() => {
        fetchHistory();

        const historyChannel = supabase
            .channel('import-history-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'import_history' }, () => fetchHistory())
            .subscribe();

        return () => {
            supabase.removeChannel(historyChannel);
        };
    }, []);

    const formatCountdown = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}m ${s < 10 ? '0' : ''}${s}s`;
    };

    const selectedStaffCount = (riderConfig.staffFilter?.teamLeaderIds?.length || 0) + 
                               (riderConfig.staffFilter?.reportingManagerIds?.length || 0) + 
                               (riderConfig.staffFilter?.cityOpsIds?.length || 0);

    return (
        <div className="space-y-6">
            {/* Header with Live Sync Status Pill */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-background via-muted/30 to-background p-6 rounded-2xl border border-border/60 shadow-lg">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-extrabold bg-gradient-to-r from-primary via-purple-600 to-indigo-600 bg-clip-text text-transparent">
                            Data Management Engine
                        </h1>
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20 flex items-center gap-1.5 shadow-sm">
                            <Sparkles size={13} /> V2 Live Engine
                        </span>
                    </div>
                    <p className="text-sm text-muted-foreground">Real-time Live Google Sheet Rider Sync, Column Mapper & Scope Filter</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Live Sync Status Pill */}
                    <div className={`px-4 py-2 rounded-xl border font-bold text-xs flex items-center gap-2.5 transition-all shadow-sm ${
                        riderConfig.enabled
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                    }`}>
                        <span className="relative flex h-2.5 w-2.5">
                            {riderConfig.enabled && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${riderConfig.enabled ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                        </span>
                        <span>{riderConfig.enabled ? `LIVE SYNC ACTIVE (${formatCountdown(nextSyncCountdown)})` : 'SYNC PAUSED'}</span>
                    </div>

                    <button
                        onClick={handleEmergencyResync}
                        disabled={isEmergencyResyncing}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm ${
                            isEmergencyResyncing
                                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                                : 'bg-red-500/10 text-red-600 border border-red-500/20 hover:bg-red-500/20'
                        }`}
                        title="Force recalculate all Daily Collections from Ledger History"
                    >
                        <RefreshCw size={15} className={isEmergencyResyncing ? 'animate-spin' : ''} />
                        <span>{isEmergencyResyncing ? 'Resyncing...' : 'Resync Daily Collections'}</span>
                    </button>

                    <button
                        onClick={async () => {
                            if (!confirm("Delete Wallet Ledger rows older than 35 days to save DB space? Proceed?")) return;
                            const toastId = toast.loading("Pruning old wallet data (>35 days)...");
                            try {
                                const { data, error } = await supabase.rpc('prune_old_wallet_ledger_data');
                                if (error) throw error;
                                if (data && data.success) {
                                    toast.success(data.message, { id: toastId });
                                } else {
                                    throw new Error(data?.error || "Error during pruning.");
                                }
                            } catch (err: any) {
                                toast.error("Failed to prune data: " + err.message, { id: toastId });
                            }
                        }}
                        className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-orange-500/10 text-orange-600 border border-orange-500/20 hover:bg-orange-500/20 transition-all shadow-sm"
                        title="Clean entries older than 35 days"
                    >
                        <Trash2 size={15} />
                        <span>Clean 35+ Days Data</span>
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                <button
                    onClick={() => setActiveTab('gsheets')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all font-bold text-xs whitespace-nowrap ${
                        activeTab === 'gsheets'
                            ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25 border border-primary'
                            : 'hover:bg-accent bg-card border border-border text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <FileText size={16} />
                    <span>Live Google Sheet Engine</span>
                </button>
                <button
                    onClick={() => setActiveTab('import')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all font-bold text-xs whitespace-nowrap ${
                        activeTab === 'import'
                            ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25 border border-primary'
                            : 'hover:bg-accent bg-card border border-border text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <FileSpreadsheet size={16} />
                    <span>Rider CSV Import</span>
                </button>
                <button
                    onClick={() => setActiveTab('wallet')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all font-bold text-xs whitespace-nowrap ${
                        activeTab === 'wallet'
                            ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25 border border-primary'
                            : 'hover:bg-accent bg-card border border-border text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <Wallet size={16} />
                    <span>Wallet Update</span>
                </button>
                <button
                    onClick={() => setActiveTab('rent_collection')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all font-bold text-xs whitespace-nowrap ${
                        activeTab === 'rent_collection'
                            ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25 border border-primary'
                            : 'hover:bg-accent bg-card border border-border text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <RefreshCw size={16} />
                    <span>Rent Collection</span>
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all font-bold text-xs whitespace-nowrap ${
                        activeTab === 'history'
                            ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25 border border-primary'
                            : 'hover:bg-accent bg-card border border-border text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <History size={16} />
                    <span>Sync & Audit History</span>
                </button>
                <button
                    onClick={() => setActiveTab('help')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all font-bold text-xs whitespace-nowrap ${
                        activeTab === 'help'
                            ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25 border border-primary'
                            : 'hover:bg-accent bg-card border border-border text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <HelpCircle size={16} />
                    <span>Guide & Instructions</span>
                </button>
            </div>

            {/* Tab Views */}
            <div className="min-h-[500px] animate-in fade-in duration-300">

                {/* Tab 1: Live Google Sheet Engine */}
                {activeTab === 'gsheets' && (
                    <div className="space-y-6">

                        {/* Top Action Cards for Column Mapping & Staff Filter */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Card 1: Column Mapping Engine */}
                            <GlassCard className="p-6 border-l-4 border-l-primary relative overflow-hidden group hover:border-primary transition-all">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
                                                <Table size={18} />
                                            </div>
                                            <h3 className="font-bold text-lg text-foreground">Column Mapping Engine</h3>
                                        </div>
                                        <p className="text-xs text-muted-foreground">Map Live Google Sheet columns to system Rider fields ONCE</p>
                                    </div>
                                    <button
                                        onClick={() => setShowColumnMappingModal(true)}
                                        className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 transition-all shadow-md shadow-primary/20 flex items-center gap-1.5"
                                    >
                                        <Sliders size={14} /> Map Columns
                                    </button>
                                </div>

                                <div className="mt-4 pt-3 border-t border-border/40 flex flex-wrap gap-2">
                                    <span className="text-[11px] px-2.5 py-1 rounded-lg bg-accent/60 text-foreground font-mono">
                                        Key: <strong>{riderConfig.columnMapping?.primaryKey || 'Triev ID'}</strong>
                                    </span>
                                    <span className="text-[11px] px-2.5 py-1 rounded-lg bg-accent/60 text-foreground font-mono">
                                        Name: <strong>{riderConfig.columnMapping?.riderName || 'Rider Name'}</strong>
                                    </span>
                                    <span className="text-[11px] px-2.5 py-1 rounded-lg bg-accent/60 text-foreground font-mono">
                                        Mobile: <strong>{riderConfig.columnMapping?.mobileNumber || 'Mobile Number'}</strong>
                                    </span>
                                    <span className="text-[11px] px-2.5 py-1 rounded-lg bg-accent/60 text-foreground font-mono">
                                        TL: <strong>{riderConfig.columnMapping?.teamLeader || 'Team Leader'}</strong>
                                    </span>
                                </div>
                            </GlassCard>

                            {/* Card 2: Staff Multi-Select Scope Filter */}
                            <GlassCard className="p-6 border-l-4 border-l-purple-500 relative overflow-hidden group hover:border-purple-500 transition-all">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/20">
                                                <ShieldCheck size={18} />
                                            </div>
                                            <h3 className="font-bold text-lg text-foreground">Staff Scope Multi-Filter</h3>
                                        </div>
                                        <p className="text-xs text-muted-foreground">Select TLs, RMs & City Ops whose riders sync into system</p>
                                    </div>
                                    <button
                                        onClick={() => setShowStaffFilterModal(true)}
                                        className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 text-white hover:bg-purple-700 transition-all shadow-md shadow-purple-600/20 flex items-center gap-1.5"
                                    >
                                        <Users size={14} /> Filter Staff
                                    </button>
                                </div>

                                <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">Filter Mode:</span>
                                    {riderConfig.staffFilter?.syncAllStaff ? (
                                        <span className="font-bold text-emerald-500 flex items-center gap-1">
                                            <CheckCircle2 size={13} /> Global (All Registered Staff)
                                        </span>
                                    ) : selectedStaffCount > 0 ? (
                                        <span className="font-bold text-purple-500 flex items-center gap-1">
                                            <Check size={13} /> Restricted to {selectedStaffCount} Selected Staff
                                        </span>
                                    ) : (
                                        <span className="font-bold text-amber-500">
                                            No Staff Filter Selected (All Staff Sync)
                                        </span>
                                    )}
                                </div>
                            </GlassCard>
                        </div>

                        {/* Main Rider Live Sheet Settings Card */}
                        <GlassCard className="p-8 border-l-4 border-l-emerald-500 shadow-xl">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-border/40">
                                <div className="space-y-1">
                                    <h2 className="text-2xl font-bold flex items-center gap-2.5 text-foreground">
                                        <FileSpreadsheet className="text-emerald-500" /> Live Google Sheet Rider Sync Config
                                    </h2>
                                    <p className="text-xs text-muted-foreground">Real-time sync sheet parameters & auto-activation engine</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => saveSettings('rider', riderConfig)}
                                        className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-md shadow-emerald-600/20"
                                    >
                                        Save Rider Config
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Left 2 Columns: Credentials & Frequency */}
                                <div className="lg:col-span-2 space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold text-foreground">Google Sheet ID</label>
                                            <input
                                                type="text"
                                                value={riderConfig.sheetId}
                                                onChange={e => setRiderConfig({ ...riderConfig, sheetId: e.target.value })}
                                                className="w-full p-3 rounded-xl border border-input bg-card text-foreground font-mono text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                                                placeholder="e.g., 1BxiMvs0..."
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold text-foreground">Sheet Range</label>
                                            <input
                                                type="text"
                                                value={riderConfig.range}
                                                onChange={e => setRiderConfig({ ...riderConfig, range: e.target.value })}
                                                className="w-full p-3 rounded-xl border border-input bg-card text-foreground font-mono text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                                                placeholder="Sheet1!A1:Z10000"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold text-foreground">Optional API Key</label>
                                            <input
                                                type="text"
                                                value={riderConfig.apiKey || ''}
                                                onChange={e => setRiderConfig({ ...riderConfig, apiKey: e.target.value })}
                                                className="w-full p-3 rounded-xl border border-input bg-card text-foreground font-mono text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                                                placeholder="Leave empty for Public Sheets"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                                <Clock size={14} className="text-emerald-500" /> Sync Update Frequency
                                            </label>
                                            <select
                                                value={riderConfig.syncIntervalMinutes || 2}
                                                onChange={e => {
                                                    const newInterval = Number(e.target.value);
                                                    const updated = { ...riderConfig, syncIntervalMinutes: newInterval };
                                                    setRiderConfig(updated);
                                                    saveSettings('rider', updated);
                                                }}
                                                className="w-full p-3 rounded-xl border border-input bg-card text-foreground text-xs focus:ring-2 focus:ring-emerald-500 outline-none font-semibold"
                                            >
                                                <option value={1}>Every 1 Minute</option>
                                                <option value={2}>Every 2 Minutes (Recommended)</option>
                                                <option value={3}>Every 3 Minutes</option>
                                                <option value={5}>Every 5 Minutes</option>
                                                <option value={10}>Every 10 Minutes</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Right 1 Column: Controls & Triggers */}
                                <div className="space-y-4 flex flex-col justify-between">
                                    <div className="p-4 rounded-xl bg-accent/40 border border-border/50 flex items-center justify-between">
                                        <div>
                                            <h4 className="font-bold text-xs text-foreground flex items-center gap-2">
                                                {riderConfig.enabled ? <Play size={14} className="text-emerald-500" /> : <Pause size={14} className="text-amber-500" />}
                                                Auto Live Sync Engine
                                            </h4>
                                            <p className="text-[11px] text-muted-foreground mt-0.5">
                                                {riderConfig.enabled ? `Syncing every ${riderConfig.syncIntervalMinutes || 2} mins` : 'Sync is currently paused'}
                                            </p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={riderConfig.enabled}
                                                onChange={(e) => {
                                                    const newVal = e.target.checked;
                                                    const newConfig = { ...riderConfig, enabled: newVal };
                                                    setRiderConfig(newConfig);
                                                    saveSettings('rider', newConfig);
                                                }}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                                        </label>
                                    </div>

                                    <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-between">
                                        <div>
                                            <h4 className="font-bold text-xs text-purple-600 dark:text-purple-400">Strict Active / Inactive Mirror</h4>
                                            <p className="text-[10px] text-muted-foreground mt-0.5">Auto-inactivate riders missing in sheet</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer ml-2 shrink-0">
                                            <input
                                                type="checkbox"
                                                checked={riderConfig.strictMirror}
                                                onChange={(e) => {
                                                    const newVal = e.target.checked;
                                                    const newConfig = { ...riderConfig, strictMirror: newVal };
                                                    setRiderConfig(newConfig);
                                                    saveSettings('rider', newConfig);
                                                }}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                                        </label>
                                    </div>

                                    <button
                                        onClick={(e) => handleGoogleSync(e, false, 'rider', riderConfig)}
                                        disabled={isSyncing}
                                        className="w-full py-3.5 rounded-xl bg-emerald-600 text-white font-extrabold text-xs hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                                    >
                                        {isSyncing ? <RefreshCw size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                                        <span>{isSyncing ? 'Syncing Live Data...' : 'Sync Live Sheet Now'}</span>
                                    </button>
                                </div>
                            </div>
                        </GlassCard>

                        {/* Recent Status & Fallback Safety Notice */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <GlassCard className="p-6 bg-card/60 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-bold text-sm flex items-center gap-2 text-foreground">
                                        <Clock size={16} className="text-primary" /> Live Engine Health Status & Background Worker
                                    </h3>
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border flex items-center gap-1.5 ${
                                        engineStatus.healthState === 'syncing'
                                            ? 'bg-blue-500/10 text-blue-500 border-blue-500/30'
                                            : engineStatus.healthState === 'active'
                                                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                                                : engineStatus.healthState === 'error'
                                                    ? 'bg-red-500/10 text-red-500 border-red-500/30'
                                                    : 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                                    }`}>
                                        <span className="relative flex h-2 w-2">
                                            {engineStatus.healthState === 'active' && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                                            <span className={`relative inline-flex rounded-full h-2 w-2 ${
                                                engineStatus.healthState === 'active' ? 'bg-emerald-500' : engineStatus.healthState === 'syncing' ? 'bg-blue-500' : 'bg-amber-500'
                                            }`}></span>
                                        </span>
                                        <span>
                                            {engineStatus.healthState === 'syncing' ? 'SYNCING NOW' : engineStatus.healthState === 'active' ? '24/7 SERVER SYNC ACTIVE' : 'SYNC PAUSED'}
                                        </span>
                                    </span>
                                </div>
                                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                                    <Sparkles size={14} className="shrink-0" />
                                    <span>Server background sync runs 24/7 even when Admin panel is closed or logged out.</span>
                                </div>

                                <div className="space-y-2.5 text-xs">
                                    <div className="p-3 bg-accent/40 rounded-xl border border-border/40 flex justify-between items-center">
                                        <span className="text-muted-foreground">Last Successful Sync Time</span>
                                        <span className="font-mono font-bold text-foreground">
                                            {lastSyncTime ? `${lastSyncTime.toLocaleDateString()} ${lastSyncTime.toLocaleTimeString()}` : 'No sync recorded in session'}
                                        </span>
                                    </div>

                                    <div className="p-3 bg-accent/40 rounded-xl border border-border/40 flex justify-between items-center">
                                        <span className="text-muted-foreground">Next Scheduled Auto Sync</span>
                                        <span className="font-mono font-bold text-emerald-500">
                                            {engineStatus.nextSyncTime 
                                                ? `${engineStatus.nextSyncTime.toLocaleTimeString()} (${formatCountdown(nextSyncCountdown)})`
                                                : 'Auto-sync paused'}
                                        </span>
                                    </div>

                                    {engineStatus.lastSummary && (
                                        <div className="p-3 rounded-xl bg-card border border-border/50 grid grid-cols-4 gap-2 text-center text-[11px]">
                                            <div>
                                                <span className="text-muted-foreground block text-[10px]">Scanned</span>
                                                <strong className="text-foreground">{engineStatus.lastSummary.total}</strong>
                                            </div>
                                            <div>
                                                <span className="text-emerald-500 block text-[10px]">New Added</span>
                                                <strong className="text-emerald-500">{engineStatus.lastSummary.success}</strong>
                                            </div>
                                            <div>
                                                <span className="text-blue-500 block text-[10px]">Updated</span>
                                                <strong className="text-blue-500">{engineStatus.lastSummary.updated || 0}</strong>
                                            </div>
                                            <div>
                                                <span className="text-rose-500 block text-[10px]">Inactivated</span>
                                                <strong className="text-rose-500">{engineStatus.lastSummary.inactivated || 0}</strong>
                                            </div>
                                        </div>
                                    )}

                                    {syncError ? (
                                        <div className="p-3 bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl border border-red-500/20 font-medium">
                                            <strong>Sync Warning:</strong> {syncError}
                                        </div>
                                    ) : (
                                        <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-500/20 font-medium flex items-center gap-2">
                                            <CheckCircle2 size={16} />
                                            <span>Background Engine Running Seamlessly Across All Pages & Tab State.</span>
                                        </div>
                                    )}
                                </div>
                            </GlassCard>

                            <GlassCard className="p-6 bg-card/60 text-xs space-y-2">
                                <h4 className="font-bold text-foreground flex items-center gap-2">
                                    <AlertTriangle size={16} className="text-amber-500" /> Fallback & Data Resilience Rule
                                </h4>
                                <p className="text-muted-foreground leading-relaxed">
                                    अगर कभी Live Google Sheet में Technical Issue की वजह से Data नहीं आता या 0 Rows return होते हैं, तो System मौजूदा Riders के Data और Statuses को Touch नहीं करेगा। Existing status सुरक्षित रहेगा और Sheet ठीक होते ही Auto-Sync Resume होगा।
                                </p>
                            </GlassCard>
                        </div>
                    </div>
                )}

                {/* Tab 2: Rider CSV Import */}
                {activeTab === 'import' && (
                    <GlassCard className="p-8">
                        <div className="mb-8 flex justify-between items-start">
                            <div className="space-y-1">
                                <h2 className="text-2xl font-bold flex items-center gap-2 text-foreground">
                                    <FileSpreadsheet className="text-emerald-500" /> Manual Rider CSV Import
                                </h2>
                                <p className="text-xs text-muted-foreground">Upload Excel/CSV file for manual one-time rider batch imports</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => downloadRiderTemplate()}
                                    className="px-4 py-2 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded-xl flex gap-2 items-center transition-all border border-primary/20"
                                >
                                    <DownloadIcon size={14} /> Download Template
                                </button>
                                <button
                                    onClick={() => setShowAuditModal(true)}
                                    className="px-4 py-2 text-xs font-bold text-purple-600 bg-purple-500/10 hover:bg-purple-500/20 rounded-xl flex gap-2 items-center transition-all border border-purple-500/20"
                                >
                                    <Search size={14} /> Audit / Sync Check
                                </button>
                            </div>
                        </div>
                        <DataImport onImport={handleRiderImport} mode="rider" />
                    </GlassCard>
                )}

                {/* Tab 3: Wallet Update */}
                {activeTab === 'wallet' && (
                    <GlassCard className="p-8">
                        <div className="mb-8 flex justify-between items-start">
                            <div className="space-y-1">
                                <h2 className="text-2xl font-bold flex items-center gap-2 text-foreground">
                                    <Wallet className="text-blue-500" /> Manual Wallet Balance Update
                                </h2>
                                <p className="text-xs text-muted-foreground">Bulk update wallet balances for existing riders</p>
                            </div>
                            <button
                                onClick={() => downloadWalletTemplate()}
                                className="px-4 py-2 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded-xl flex gap-2 items-center transition-all border border-primary/20"
                            >
                                <DownloadIcon size={14} /> Download Template
                            </button>
                        </div>
                        <DataImport onImport={handleWalletImport} mode="wallet" />
                    </GlassCard>
                )}

                {/* Tab 4: Rent Collection */}
                {activeTab === 'rent_collection' && (
                    <GlassCard className="p-8">
                        <div className="mb-8 flex justify-between items-start">
                            <div className="space-y-1">
                                <h2 className="text-2xl font-bold flex items-center gap-2 text-foreground">
                                    <RefreshCw className="text-purple-500" /> Manual Rent Collection Import
                                </h2>
                                <p className="text-xs text-muted-foreground">Import daily collection logs and credit wallet balances</p>
                            </div>
                            <button
                                onClick={() => downloadRentCollectionTemplate()}
                                className="px-4 py-2 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded-xl flex gap-2 items-center transition-all border border-primary/20"
                            >
                                <DownloadIcon size={14} /> Download Template
                            </button>
                        </div>
                        <DataImport onImport={handleRentCollectionImport} mode="rent_collection" />
                    </GlassCard>
                )}

                {/* Tab 5: Sync & Import History */}
                {activeTab === 'history' && (
                    <GlassCard className="p-6">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
                                    <History className="text-purple-500" /> Import & Live Sync History Log
                                </h2>
                                <p className="text-xs text-muted-foreground mt-0.5">Audit log of sheet sync runs, row changes, and active/inactive reconciliations</p>
                            </div>
                            <div className="flex items-center gap-3">
                                {selectedHistoryIds.size > 0 && (
                                    <button
                                        onClick={handleBulkDeleteHistory}
                                        className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-red-600 bg-red-500/10 hover:bg-red-500/20 rounded-xl transition-all border border-red-500/20"
                                    >
                                        <Trash2 size={14} /> Delete Selected ({selectedHistoryIds.size})
                                    </button>
                                )}
                                <button onClick={() => fetchHistory()} disabled={loadingHistory} className="p-2 hover:bg-accent rounded-xl transition-colors">
                                    <RefreshCw size={18} className={`${loadingHistory ? 'animate-spin text-primary' : 'text-muted-foreground'}`} />
                                </button>
                            </div>
                        </div>

                        {loadingHistory ? (
                            <div className="text-center py-12 text-xs text-muted-foreground">Loading sync history...</div>
                        ) : history.length === 0 ? (
                            <div className="text-center text-muted-foreground py-16 bg-muted/10 rounded-2xl border border-dashed border-border/60 flex flex-col items-center gap-3">
                                <History size={40} className="text-muted-foreground/40" />
                                <p className="font-semibold text-sm text-foreground">No sync history records found</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 px-2 pb-2">
                                    <input
                                        type="checkbox"
                                        checked={history.length > 0 && selectedHistoryIds.size === history.length}
                                        onChange={handleSelectAllHistory}
                                        className="w-4 h-4 rounded border-input text-primary focus:ring-primary"
                                    />
                                    <span className="text-xs font-medium text-muted-foreground">Select All History Rows</span>
                                </div>
                                {history.map((record: any) => (
                                    <div key={record.id} className={`p-5 border rounded-2xl bg-card/60 hover:bg-card transition-all ${selectedHistoryIds.has(record.id) ? 'border-primary/50 bg-primary/5' : 'border-border/50'}`}>
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedHistoryIds.has(record.id)}
                                                    onChange={() => handleSelectHistory(record.id)}
                                                    className="w-4 h-4 rounded border-input text-primary focus:ring-primary"
                                                />
                                                <div className={`p-2.5 rounded-xl ${record.importType === 'wallet' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}`}>
                                                    {record.importType === 'wallet' ? <Wallet size={20} /> : <FileSpreadsheet size={20} />}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-sm capitalize text-foreground">{record.importType} Sync Run</div>
                                                    <div className="text-xs text-muted-foreground">{new Date(record.timestamp).toLocaleString()} by {record.adminName}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => setSelectedLogRecord(record)}
                                                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 transition-all border border-primary/20"
                                                >
                                                    View Details
                                                </button>
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                                                    record.status === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'
                                                }`}>
                                                    {record.status}
                                                </span>
                                                <button
                                                    onClick={() => handleDeleteHistory(record.id)}
                                                    className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 bg-accent/30 p-3 rounded-xl text-xs">
                                            <div className="text-center border-r border-border/40"><div>Total Parsed</div><div className="font-bold text-foreground">{record.totalRows}</div></div>
                                            <div className="text-center border-r border-border/40"><div>Created</div><div className="font-bold text-emerald-500">{record.successCount}</div></div>
                                            <div className="text-center border-r border-border/40"><div>Updated</div><div className="font-bold text-blue-500">{record.updated_count || 0}</div></div>
                                            <div className="text-center"><div>Failed</div><div className="font-bold text-red-500">{record.failureCount}</div></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </GlassCard>
                )}

                {/* Tab 6: Instructions */}
                {activeTab === 'help' && (
                    <GlassCard className="p-8">
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-foreground"><HelpCircle className="text-blue-500" /> Setup & Operational Guide</h2>
                        <div className="space-y-4 text-xs leading-relaxed text-muted-foreground">
                            <div className="p-4 rounded-xl bg-accent/40 border border-border/50 space-y-1">
                                <h3 className="font-bold text-sm text-foreground">1. Live Sheet Column Mapping</h3>
                                <p>Admin "Map Columns" बटन पर क्लिक करके अपनी Google Sheet की Header Names को System attributes से एक बार map कर दें।</p>
                            </div>
                            <div className="p-4 rounded-xl bg-accent/40 border border-border/50 space-y-1">
                                <h3 className="font-bold text-sm text-foreground">2. Team Leader / RM / City Ops Multi-Select Filter</h3>
                                <p>"Filter Staff" पर क्लिक करके उन Staff members को select करें जिनके Riders का data system में sync करना है। Unselected staff का data skip हो जाएगा।</p>
                            </div>
                            <div className="p-4 rounded-xl bg-accent/40 border border-border/50 space-y-1">
                                <h3 className="font-bold text-sm text-foreground">3. Automatic Active / Inactive Engine</h3>
                                <p>Live Google Sheet में जो Riders एक्टिव हैं केवल वे active रहेंगे। Sheet में Rider न होने पर System auto Inactive कर देगा। Sheet में दोबारा आने पर auto Active हो जाएगा।</p>
                            </div>
                        </div>
                    </GlassCard>
                )}
            </div>

            {/* Modals */}
            <RiderAuditModal
                isOpen={showAuditModal}
                onClose={() => setShowAuditModal(false)}
            />

            <ColumnMappingModal
                isOpen={showColumnMappingModal}
                onClose={() => setShowColumnMappingModal(false)}
                sheetId={riderConfig.sheetId}
                range={riderConfig.range}
                apiKey={riderConfig.apiKey}
                currentMapping={riderConfig.columnMapping}
                onSaveMapping={(newMapping) => {
                    const updatedConfig = { ...riderConfig, columnMapping: newMapping };
                    setRiderConfig(updatedConfig);
                    saveSettings('rider', updatedConfig);
                }}
            />

            <StaffFilterSelectorModal
                isOpen={showStaffFilterModal}
                onClose={() => setShowStaffFilterModal(false)}
                currentFilter={riderConfig.staffFilter}
                onSaveFilter={(newFilter) => {
                    const updatedConfig = { ...riderConfig, staffFilter: newFilter };
                    setRiderConfig(updatedConfig);
                    saveSettings('rider', updatedConfig);
                }}
            />

            <ImportLogModal
                isOpen={!!selectedLogRecord}
                onClose={() => setSelectedLogRecord(null)}
                record={selectedLogRecord}
            />
        </div>
    );
};

export default DataManagement;
