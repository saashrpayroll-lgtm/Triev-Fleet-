import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Wallet, History, HelpCircle, FileText, AlertTriangle, Trash2, RefreshCw, Download as DownloadIcon } from 'lucide-react';
import { toast } from 'sonner';
import DataImport from '@/components/DataImport';
import GlassCard from '@/components/GlassCard';
import { processRiderImport, processWalletUpdate, processRentCollectionImport } from '@/utils/importUtils';
import { syncGoogleSheet } from '@/utils/googleSheetsUtils';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/config/supabase';
import { downloadRiderTemplate, downloadWalletTemplate, downloadRentCollectionTemplate } from '@/utils/exportUtils';
import { logActivity } from '@/utils/activityLog';

const DataManagement: React.FC = () => {
    const { userData } = useSupabaseAuth();
    // Persistent Settings
    const [riderConfig, setRiderConfig] = useState({ sheetId: '', range: 'Sheet1!A1:Z10000', apiKey: '', enabled: false });
    const [walletConfig, setWalletConfig] = useState({ sheetId: '', range: 'Sheet1!A1:C10000', apiKey: '', enabled: false });

    // Legacy state for UI (optional, or we replace usage)
    const [activeTab, setActiveTab] = useState<'import' | 'wallet' | 'rent_collection' | 'gsheets' | 'history' | 'help'>('import');
    const [history, setHistory] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(new Set());
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
    const [syncError, setSyncError] = useState<string | null>(null);

    // Refs for interval
    const riderConfigRef = React.useRef(riderConfig);
    const walletConfigRef = React.useRef(walletConfig);
    const isSyncingRef = React.useRef(isSyncing);

    useEffect(() => { riderConfigRef.current = riderConfig; }, [riderConfig]);
    useEffect(() => { walletConfigRef.current = walletConfig; }, [walletConfig]);
    useEffect(() => { isSyncingRef.current = isSyncing; }, [isSyncing]);

    // Fetch Settings on Mount
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const { data } = await supabase
                    .from('system_settings')
                    .select('key, value')
                    .in('key', ['rider_import_config', 'wallet_update_config']);

                if (data) {
                    data.forEach(setting => {
                        if (setting.key === 'rider_import_config') {
                            const val = setting.value;
                            // Migration: Auto-update limit if it's the old default
                            if (val?.range === 'Sheet1!A1:Z1000') {
                                val.range = 'Sheet1!A1:Z10000';
                                saveSettings('rider', val); // Persist the upgrade
                            }
                            setRiderConfig({ ...riderConfig, ...val });
                        }
                        if (setting.key === 'wallet_update_config') {
                            const val = setting.value;
                            // Migration: Auto-update limit if it's the old default
                            if (val?.range === 'Sheet1!A1:C1000') {
                                val.range = 'Sheet1!A1:C10000';
                                saveSettings('wallet', val); // Persist the upgrade
                            }
                            setWalletConfig({ ...walletConfig, ...val });
                        }
                    });
                }
            } catch (err) {
                console.error("Failed to load settings (Table might be missing):", err);
            }
        };
        fetchSettings();
    }, []);

    // Save Settings Helper (Debounce or Call explicitly)
    const saveSettings = async (type: 'rider' | 'wallet', newConfig: any) => {
        const key = type === 'rider' ? 'rider_import_config' : 'wallet_update_config';
        try {
            await supabase.from('system_settings').upsert({
                key,
                value: newConfig,
                updated_at: new Date().toISOString()
            });
            toast.success("Settings saved!");
        } catch (err) {
            console.error("Failed to save settings:", err);
            toast.error("Failed to save settings to database.");
        }
    };

    // Auto-Sync Interval (Every 10s)
    useEffect(() => {
        const interval = setInterval(() => {
            if (isSyncingRef.current || !userData) return;

            // Check Rider Sync
            if (riderConfigRef.current.enabled && riderConfigRef.current.sheetId) {
                console.log("Auto-syncing Rider Data...");
                handleGoogleSync(null, true, 'rider', riderConfigRef.current);
            }

            // Check Wallet Sync (Chain them or run parallel? Parallel is fine if handleSync checks isSyncing)
            // But handleSync sets isSyncing=true. So we should probably wait. 
            // Better: Trigger separately if not invalid.
            // Actually, handleGoogleSync has a guard `if (isSyncing) return`.
            // So if Rider takes >0ms, Wallet check immediately after might fail.
            // We should stagger them or check individually. 
            // For now, let's try to run Wallet only if Rider isn't running? 
            // Or just fire both and let the second one wait or fail?
            // "dono me... update ho".
            // Let's modify handleGoogleSync to accept concurrency or strictly serialize.
            // Simplified: If Rider is enabled, run it. On success/fail, verify Wallet. 
            // But setInterval fires blindly.

            if (walletConfigRef.current.enabled && walletConfigRef.current.sheetId) {
                // simple timeout to stagger
                setTimeout(() => {
                    if (!isSyncingRef.current) {
                        console.log("Auto-syncing Wallet Data...");
                        handleGoogleSync(null, true, 'wallet', walletConfigRef.current);
                    }
                }, 5000); // 5s stagger
            }

        }, 10000); // 10 seconds

        return () => clearInterval(interval);
    }, [userData]);

    // DEFINE FUNCTIONS FIRST to avoid hoisting issues with const

    const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
            const { data, error } = await supabase
                .from('import_history')
                .select(`
                    id,
                    adminName:admin_name,
                    importType:import_type,
                    totalRows:total_rows,
                    successCount:success_count,
                    failureCount:failure_count,
                    status,
                    timestamp,
                    errors
                `)
                .order('timestamp', { ascending: false })
                .limit(20);

            if (error) {
                console.error("Supabase Error fetching history:", error);
                toast.error(`History Fetch Failed: ${error.message} (${error.code})`);
                throw error;
            }
            setHistory(data || []);
        } catch (err: any) {
            console.error("Error fetching history:", err);
        } finally {
            setLoadingHistory(false);
        }
    };



    const handleGoogleSync = async (e: React.FormEvent | null, isAuto = false, mode: 'rider' | 'wallet', config: any) => {
        if (e) e.preventDefault();
        if (!userData || isSyncingRef.current) return;

        // Prevent concurrent syncs if needed, or allow parallel. 
        // For safety, let's keep isSyncing lock global for now to avoid UI confusion, 
        // unless we split isSyncing state. The user wants "dono me... chalta rahe".
        // If we use global lock, one will block the other.
        // Let's rely on the lock but realize 10s is enough time for one to finish usually.

        setIsSyncing(true);
        setSyncError(null);

        try {
            if (!config.sheetId || !config.range || config.sheetId.length < 10) {
                if (!isAuto) toast.error("Please enter valid Sheet ID and Range");
                throw new Error("Invalid Configuration");
            }

            // Fix Range Format
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
                apiKey: config.apiKey || undefined
            }, userData.id, userData.fullName, mode);

            setLastSyncTime(new Date());

            if (!isAuto) {
                alert(`Sync Complete!\nSuccess: ${summary.success}\nFailed: ${summary.failed}`);
            } else {
                toast.success(`${mode === 'rider' ? 'Riders' : 'Wallets'} synced automatically.`);
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

    const handleSyncEvent = async (event: any) => {
        if (!userData) return;
        const currentMode = event.event_type === 'wallet_sync' ? 'wallet' : 'rider';
        const targetConfig = currentMode === 'rider' ? riderConfigRef.current : walletConfigRef.current;

        if (event.sheet_id === targetConfig.sheetId) {
            console.log(`Triggering Real-time ${currentMode} Sync for Sheet: ${event.sheet_id}`);
            toast.info(`Real-time ${currentMode} sync triggered from sheet...`);
            handleGoogleSync(null, true, currentMode, targetConfig);
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
            logActivity({
                actionType: 'importHistoryDeleted',
                targetType: 'system',
                targetId: id,
                details: `Deleted an import history record`,
                performedBy: userData?.email || 'admin'
            }).catch(console.error);
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
            logActivity({
                actionType: 'bulkImportHistoryDeleted',
                targetType: 'system',
                targetId: 'multiple',
                details: `Bulk deleted ${idsToDelete.length} import history records`,
                performedBy: userData?.email || 'admin'
            }).catch(console.error);
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

    // Initial Fetch & Real-time History
    useEffect(() => {
        fetchHistory();

        // Real-time subscription
        const historyChannel = supabase
            .channel('import-history-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'import_history' }, () => fetchHistory())
            .subscribe();

        // Real-time sync events
        const syncChannel = supabase
            .channel('google-sync-events')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sync_events' }, (payload) => {
                console.log('Sync event received:', payload);
                handleSyncEvent(payload.new);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(historyChannel);
            supabase.removeChannel(syncChannel);
        };
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">Data Management</h1>
                    <p className="text-muted-foreground mt-1">Bulk Operations & Import History</p>
                </div>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                <button
                    onClick={() => setActiveTab('import')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-medium whitespace-nowrap ${activeTab === 'import' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25' : 'hover:bg-accent bg-card border border-border'}`}
                >
                    <FileSpreadsheet size={18} />
                    <span>Rider Import</span>
                </button>
                <button
                    onClick={() => setActiveTab('wallet')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-medium whitespace-nowrap ${activeTab === 'wallet' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25' : 'hover:bg-accent bg-card border border-border'}`}
                >
                    <Wallet size={18} />
                    <span>Wallet Update</span>
                </button>
                <button
                    onClick={() => setActiveTab('rent_collection')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-medium whitespace-nowrap ${activeTab === 'rent_collection' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25' : 'hover:bg-accent bg-card border border-border'}`}
                >
                    <RefreshCw size={18} />
                    <span>Rent Collection Import</span>
                </button>
                <button
                    onClick={() => setActiveTab('gsheets')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-medium whitespace-nowrap ${activeTab === 'gsheets' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25' : 'hover:bg-accent bg-card border border-border'}`}
                >
                    <FileText size={18} />
                    <span>Google Sheets</span>
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-medium whitespace-nowrap ${activeTab === 'history' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25' : 'hover:bg-accent bg-card border border-border'}`}
                >
                    <History size={18} />
                    <span>Import History</span>
                </button>
                <button
                    onClick={() => setActiveTab('help')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-medium whitespace-nowrap ${activeTab === 'help' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25' : 'hover:bg-accent bg-card border border-border'}`}
                >
                    <HelpCircle size={18} />
                    <span>Instructions</span>
                </button>
            </div>

            <div className="min-h-[500px] animate-in fade-in duration-300">
                {activeTab === 'import' && (
                    <GlassCard className="p-8">
                        <div className="mb-8 flex justify-between items-start">
                            <div className="space-y-1">
                                <h2 className="text-2xl font-bold flex items-center gap-2">
                                    <FileSpreadsheet className="text-green-500" /> Bulk Rider Import
                                </h2>
                                <p className="text-muted-foreground">Upload Excel/CSV file to create or update riders.</p>
                            </div>
                            <button
                                onClick={() => downloadRiderTemplate()}
                                className="px-4 py-2 text-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-lg flex gap-2 items-center transition-colors"
                            >
                                <DownloadIcon size={16} /> Download Template
                            </button>
                        </div>
                        <DataImport onImport={handleRiderImport} mode="rider" />
                    </GlassCard>
                )}

                {activeTab === 'wallet' && (
                    <GlassCard className="p-8">
                        <div className="mb-8 flex justify-between items-start">
                            <div className="space-y-1">
                                <h2 className="text-2xl font-bold flex items-center gap-2">
                                    <Wallet className="text-blue-500" /> Bulk Wallet Update
                                </h2>
                                <p className="text-muted-foreground">Update wallet balances for existing riders.</p>
                            </div>
                            <button
                                onClick={() => downloadWalletTemplate()}
                                className="px-4 py-2 text-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-lg flex gap-2 items-center transition-colors"
                            >
                                <DownloadIcon size={16} /> Download Template
                            </button>
                        </div>
                        <DataImport onImport={handleWalletImport} mode="wallet" />
                    </GlassCard>
                )}

                {activeTab === 'rent_collection' && (
                    <GlassCard className="p-8">
                        <div className="mb-8 flex justify-between items-start">
                            <div className="space-y-1">
                                <h2 className="text-2xl font-bold flex items-center gap-2">
                                    <RefreshCw className="text-purple-500" /> Rent Collection Import
                                </h2>
                                <p className="text-muted-foreground">Process daily collections via CSV/Excel.</p>
                            </div>
                            <button
                                onClick={() => downloadRentCollectionTemplate()}
                                className="px-4 py-2 text-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-lg flex gap-2 items-center transition-colors"
                            >
                                <DownloadIcon size={16} /> Download Template
                            </button>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 p-4 rounded-lg mb-4">
                            <h3 className="font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-2">
                                <Wallet size={18} /> Rent Collection Process
                            </h3>
                            <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                                Upload a "Wallet Recharge" file. The amount will be <strong>ADDED</strong> to the rider's current wallet balance (Credit).
                                <br />
                                <em>Example: If Rider has -500 and you collect 200, New Balance = -300.</em>
                            </p>
                        </div>
                        <DataImport onImport={handleRentCollectionImport} mode="rent_collection" />
                    </GlassCard>
                )}

                {activeTab === 'gsheets' && (
                    <div className="space-y-8 animate-in fade-in duration-300">

                        {/* Rider Import Settings */}
                        <GlassCard className="p-8 border-l-4 border-l-green-500">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h2 className="text-2xl font-bold flex items-center gap-2">
                                        <FileSpreadsheet className="text-green-500" /> Rider Import Config
                                    </h2>
                                    <p className="text-muted-foreground mt-1">Configure Google Sheet for automated Rider Sync.</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => saveSettings('rider', riderConfig)}
                                        className="text-sm bg-primary/10 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors font-semibold"
                                    >
                                        Save Config
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Sheet ID</label>
                                        <input
                                            type="text"
                                            value={riderConfig.sheetId}
                                            onChange={e => setRiderConfig({ ...riderConfig, sheetId: e.target.value })}
                                            className="w-full p-3 rounded-lg border bg-background/50 outline-none focus:ring-2 focus:ring-green-500/50 font-mono text-sm"
                                            placeholder="e.g., 1BxiMvs0..."
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Range</label>
                                        <input
                                            type="text"
                                            value={riderConfig.range}
                                            onChange={e => setRiderConfig({ ...riderConfig, range: e.target.value })}
                                            className="w-full p-3 rounded-lg border bg-background/50 outline-none focus:ring-2 focus:ring-green-500/50 font-mono text-sm"
                                            placeholder="Sheet1!A1:Z1000"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4 flex flex-col justify-end">
                                    <div className="bg-muted/20 p-4 rounded-xl border border-muted/50 flex items-center justify-between">
                                        <div>
                                            <h4 className="font-semibold text-sm">Auto-Sync (10s)</h4>
                                            <p className="text-xs text-muted-foreground">Automatically pull every 10 seconds.</p>
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
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                                        </label>
                                    </div>

                                    <button
                                        onClick={(e) => handleGoogleSync(e, false, 'rider', riderConfig)}
                                        disabled={isSyncing}
                                        className="w-full bg-green-600 text-white px-6 py-3 rounded-xl hover:bg-green-700 shadow-lg shadow-green-600/20 transition-all font-bold flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                                    >
                                        {isSyncing ? <span className="animate-spin">⟳</span> : <RefreshCw size={18} />}
                                        Sync Riders Now
                                    </button>
                                </div>
                            </div>
                        </GlassCard>

                        {/* Wallet Update Settings */}
                        <GlassCard className="p-8 border-l-4 border-l-blue-500">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h2 className="text-2xl font-bold flex items-center gap-2">
                                        <Wallet className="text-blue-500" /> Wallet Sync Config
                                    </h2>
                                    <p className="text-muted-foreground mt-1">Configure Google Sheet for automated Wallet Updates.</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => saveSettings('wallet', walletConfig)}
                                        className="text-sm bg-primary/10 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors font-semibold"
                                    >
                                        Save Config
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Sheet ID</label>
                                        <input
                                            type="text"
                                            value={walletConfig.sheetId}
                                            onChange={e => setWalletConfig({ ...walletConfig, sheetId: e.target.value })}
                                            className="w-full p-3 rounded-lg border bg-background/50 outline-none focus:ring-2 focus:ring-blue-500/50 font-mono text-sm"
                                            placeholder="e.g., 1BxiMvs0..."
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Range</label>
                                        <input
                                            type="text"
                                            value={walletConfig.range}
                                            onChange={e => setWalletConfig({ ...walletConfig, range: e.target.value })}
                                            className="w-full p-3 rounded-lg border bg-background/50 outline-none focus:ring-2 focus:ring-blue-500/50 font-mono text-sm"
                                            placeholder="Sheet1!A1:C1000"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4 flex flex-col justify-end">
                                    <div className="bg-muted/20 p-4 rounded-xl border border-muted/50 flex items-center justify-between">
                                        <div>
                                            <h4 className="font-semibold text-sm">Auto-Sync (10s)</h4>
                                            <p className="text-xs text-muted-foreground">Automatically pull every 10 seconds.</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={walletConfig.enabled}
                                                onChange={(e) => {
                                                    const newVal = e.target.checked;
                                                    const newConfig = { ...walletConfig, enabled: newVal };
                                                    setWalletConfig(newConfig);
                                                    saveSettings('wallet', newConfig);
                                                }}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                        </label>
                                    </div>

                                    <button
                                        onClick={(e) => handleGoogleSync(e, false, 'wallet', walletConfig)}
                                        disabled={isSyncing}
                                        className="w-full bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all font-bold flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                                    >
                                        {isSyncing ? <span className="animate-spin">⟳</span> : <RefreshCw size={18} />}
                                        Sync Wallets Now
                                    </button>
                                </div>
                            </div>
                        </GlassCard>

                        {/* Recent Activity / Status */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <GlassCard className="p-5 bg-primary/5 border-primary/10">
                                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                    <History size={18} className="text-primary" /> Sync Status
                                </h3>
                                <div className="space-y-4">
                                    <div className="p-3 bg-background/60 rounded-lg border border-border/50 flex justify-between items-center">
                                        <span className="text-sm font-medium">Last Synced</span>
                                        <span className="font-mono text-sm">{lastSyncTime ? lastSyncTime.toLocaleTimeString() : 'Never'}</span>
                                    </div>
                                    {syncError && <div className="p-3 bg-red-50 text-red-600 rounded-lg border border-red-100 text-xs font-bold">Error: {syncError}</div>}
                                </div>
                            </GlassCard>
                            <div className="p-4 bg-muted/20 rounded-xl border border-muted/50 text-xs text-muted-foreground">
                                <p className="font-bold mb-1">Note on Persistence:</p>
                                <p>Settings are now saved to the database. They will persist across devices, logouts, and page refreshes.</p>
                                <p className="mt-2"><b>Auto-Sync</b> requires this admin panel to be open in a browser tab. If you close the tab, sync will pause until you return.</p>
                            </div>
                        </div>

                    </div>
                )}

                {activeTab === 'history' && (
                    <GlassCard className="p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold flex items-center gap-2"><History className="text-purple-500" /> Import History</h2>
                            <div className="flex items-center gap-3">
                                {selectedHistoryIds.size > 0 && (
                                    <button
                                        onClick={handleBulkDeleteHistory}
                                        className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-100 rounded-lg hover:bg-red-200 transition-colors"
                                    >
                                        <Trash2 size={14} /> Delete Selected ({selectedHistoryIds.size})
                                    </button>
                                )}
                                <button onClick={() => fetchHistory()} disabled={loadingHistory} className="p-2 hover:bg-muted rounded-full transition-colors group">
                                    <RefreshCw size={20} className={`${loadingHistory ? 'animate-spin text-primary' : 'text-muted-foreground group-hover:text-primary'}`} />
                                </button>
                            </div>
                        </div>
                        {loadingHistory ? (
                            <div className="text-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div><p className="text-muted-foreground">Loading history...</p></div>
                        ) : history.length === 0 ? (
                            <div className="text-center text-muted-foreground py-16 bg-muted/10 rounded-2xl border border-dashed border-muted/50 flex flex-col items-center gap-3">
                                <History size={40} className="text-muted-foreground/50" />
                                <p className="font-semibold text-lg">No history records found</p>
                                <button onClick={() => fetchHistory()} className="mt-2 text-sm text-primary hover:underline font-medium">Refresh</button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 px-2 pb-2">
                                    <input
                                        type="checkbox"
                                        checked={history.length > 0 && selectedHistoryIds.size === history.length}
                                        onChange={handleSelectAllHistory}
                                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                                    />
                                    <span className="text-xs font-medium text-muted-foreground">Select All</span>
                                </div>
                                {history.map((record: any) => (
                                    <div key={record.id} className={`p-5 border rounded-xl bg-card/50 hover:bg-card transition-all ${selectedHistoryIds.has(record.id) ? 'border-primary/50 bg-primary/5' : 'border-border/50'}`}>
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedHistoryIds.has(record.id)}
                                                    onChange={() => handleSelectHistory(record.id)}
                                                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                                                />
                                                <div className={`p-2 rounded-lg ${record.importType === 'wallet' ? 'bg-blue-500/10 text-blue-500' : 'bg-green-500/10 text-green-500'}`}>
                                                    {record.importType === 'wallet' ? <Wallet size={20} /> : <FileSpreadsheet size={20} />}
                                                </div>
                                                <div>
                                                    <div className="font-bold capitalize text-lg">{record.importType} Import</div>
                                                    <div className="text-xs text-muted-foreground">{new Date(record.timestamp).toLocaleString()} by {record.adminName}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${record.status === 'success' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>{record.status}</div>
                                                <button
                                                    onClick={() => handleDeleteHistory(record.id)}
                                                    className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 mt-4 bg-muted/20 p-3 rounded-lg text-sm ml-7">
                                            <div className="text-center border-r border-border/50"><div>Total</div><div className="font-bold">{record.totalRows}</div></div>
                                            <div className="text-center border-r border-border/50"><div>Success</div><div className="font-bold text-green-600">{record.successCount}</div></div>
                                            <div className="text-center"><div>Failed</div><div className="font-bold text-red-600">{record.failureCount}</div></div>
                                        </div>
                                        {record.errors && record.errors.length > 0 && (
                                            <div className="mt-3 ml-7 p-3 bg-red-50/50 rounded-lg border border-red-100 text-[10px] text-red-600 flex items-start gap-1.5">
                                                <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="font-bold mb-1 uppercase tracking-wider">Recent Errors</p>
                                                    <ul className="space-y-0.5 list-disc list-inside">
                                                        {record.errors.slice(0, 3).map((err: any, idx: number) => (
                                                            <li key={idx} className="opacity-90">{err.reason} (Row {err.row})</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </GlassCard>
                )}

                {activeTab === 'help' && (
                    <GlassCard className="p-8">
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><HelpCircle className="text-blue-400" /> Instructions</h2>
                        <div className="space-y-6 text-sm leading-relaxed">
                            <div className="bg-muted/20 p-4 rounded-xl border border-muted/50">
                                <h3 className="font-semibold text-base mb-2">1. Rider Import</h3>
                                <p>Required: Rider Name, Team Leader, Client Name, Triev ID or Mobile Number.</p>
                            </div>
                            <div className="bg-muted/20 p-4 rounded-xl border border-muted/50">
                                <h3 className="font-semibold text-base mb-2">2. Wallet Update</h3>
                                <p>Required: Wallet Amount, Triev ID or Mobile Number.</p>
                            </div>
                        </div>
                    </GlassCard>
                )}
            </div>
        </div>
    );
};

export default DataManagement;
