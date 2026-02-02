import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Wallet, History, HelpCircle, FileText, AlertTriangle, Trash2, RefreshCw, Sparkles, Download as DownloadIcon } from 'lucide-react';
import { toast } from 'sonner';
import DataImport from '@/components/DataImport';
import GlassCard from '@/components/GlassCard';
import { processRiderImport, processWalletUpdate } from '@/utils/importUtils';
import { syncGoogleSheet } from '@/utils/googleSheetsUtils';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/config/supabase';
import { downloadRiderTemplate, downloadWalletTemplate } from '@/utils/exportUtils';
import { logActivity } from '@/utils/activityLog';

const DataManagement: React.FC = () => {
    const { userData } = useSupabaseAuth();
    const [activeTab, setActiveTab] = useState<'import' | 'wallet' | 'gsheets' | 'history' | 'help'>('import');
    const [history, setHistory] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(new Set());

    // Google Sheets State
    const [sheetConfig, setSheetConfig] = useState({
        sheetId: '',
        range: 'Sheet1!A1:Z500',
        apiKey: ''
    });
    const [syncMode, setSyncMode] = useState<'rider' | 'wallet'>('rider');
    const [isAutoSyncing, setIsAutoSyncing] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
    const [syncError, setSyncError] = useState<string | null>(null);

    // Refs for Real-time listeners to avoid stale closures
    const sheetConfigRef = React.useRef(sheetConfig);
    const syncModeRef = React.useRef(syncMode);

    useEffect(() => {
        sheetConfigRef.current = sheetConfig;
        syncModeRef.current = syncMode;
    }, [sheetConfig, syncMode]);

    // Initial Fetch & Real-time History
    useEffect(() => {
        fetchHistory();

        // Real-time subscription for import history
        const historyChannel = supabase
            .channel('import-history-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'import_history'
                },
                () => fetchHistory()
            )
            .subscribe();

        // Real-time subscription for Google Sheet sync events
        const syncChannel = supabase
            .channel('google-sync-events')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'sync_events'
                },
                (payload) => {
                    console.log('Sync event received:', payload);
                    handleSyncEvent(payload.new);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(historyChannel);
            supabase.removeChannel(syncChannel);
        };
    }, []); // Removed userData from dep to avoid refresh loops, handleSyncEvent uses stable ref

    const handleSyncEvent = async (event: any) => {
        if (!userData) return;

        // Ensure this is for the current sheet and mode
        const currentMode = event.event_type === 'wallet_sync' ? 'wallet' : 'rider';

        if (event.sheet_id === sheetConfigRef.current.sheetId) {
            console.log(`Triggering Real-time ${currentMode} Sync for Sheet: ${event.sheet_id}`);
            toast.info(`Real-time ${currentMode} sync triggered from sheet...`);
            handleGoogleSync(null, true, currentMode);
        }
    };

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

    // Auto-Sync Interval
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isAutoSyncing) {
            interval = setInterval(() => {
                handleGoogleSync(null, true);
            }, 10000);
        }
        return () => clearInterval(interval);
    }, [isAutoSyncing, sheetConfig, userData]);

    const handleGoogleSync = async (e: React.FormEvent | null, isAuto = false, overrideMode?: 'rider' | 'wallet') => {
        if (e) e.preventDefault();
        if (!userData || isSyncing) return;

        const activeMode = overrideMode || syncMode;
        if (!isAuto) setIsSyncing(true);
        setSyncError(null);

        try {
            if (!sheetConfig.sheetId || !sheetConfig.range || sheetConfig.sheetId.length < 10) {
                if (!isAuto) alert("Please enter valid Sheet ID and Range");
                throw new Error("Invalid Configuration");
            }

            // Fix Range Format: Quote sheet name if it contains spaces
            let formattedRange = sheetConfig.range.trim();
            if (formattedRange.includes('!')) {
                const parts = formattedRange.split('!');
                // Check if we have exactly 2 parts and the first part has spaces but no quotes
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
                sheetId: sheetConfig.sheetId,
                range: formattedRange,
                apiKey: sheetConfig.apiKey || undefined
            }, userData.id, userData.fullName, activeMode);

            setLastSyncTime(new Date());

            if (!isAuto) {
                alert(`Sync Complete!\nSuccess: ${summary.success}\nFailed: ${summary.failed}`);
            } else {
                toast.success(`${activeMode === 'rider' ? 'Riders' : 'Wallets'} synced automatically.`);
            }

            fetchHistory();
        } catch (err: any) {
            console.error("Sync Failed:", err);
            setSyncError(err.message || 'Sync failed');
            if (!isAuto) alert("Sync Failed: " + err.message);
        } finally {
            if (!isAuto) setIsSyncing(false);
        }
    };

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

                {activeTab === 'gsheets' && (
                    <GlassCard className="p-8">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-2xl font-bold flex items-center gap-2">
                                    <FileText className="text-orange-500" /> Google Sheets Sync
                                </h2>
                                <p className="text-muted-foreground mt-1">Real-time synchronization with external sheets.</p>
                            </div>
                            <div className="flex items-center gap-2 bg-muted/30 p-2 rounded-lg border border-border/50">
                                <div className={`w-2 h-2 rounded-full ${isAutoSyncing ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                                <span className="text-xs font-medium text-muted-foreground">
                                    {isAutoSyncing ? 'Auto-Sync Active' : 'Auto-Sync Off'}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2 space-y-6">
                                <form onSubmit={(e) => handleGoogleSync(e, false)} className="space-y-5">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium flex items-center gap-2">Sheet ID</label>
                                            <input
                                                type="text"
                                                value={sheetConfig.sheetId}
                                                onChange={e => setSheetConfig({ ...sheetConfig, sheetId: e.target.value })}
                                                className="w-full p-3 rounded-lg border bg-background/50 focus:ring-2 focus:ring-primary/50 outline-none transition-all font-mono text-sm"
                                                placeholder="e.g., 1BxiMvs0XRA5nLFd..."
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Sync Mode</label>
                                            <select
                                                value={syncMode}
                                                onChange={e => setSyncMode(e.target.value as 'rider' | 'wallet')}
                                                className="w-full p-3 rounded-lg border bg-background/50 focus:ring-2 focus:ring-primary/50 outline-none transition-all text-sm"
                                            >
                                                <option value="rider">Bulk Rider Import</option>
                                                <option value="wallet">Bulk Wallet Update</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Range / Sheet Name</label>
                                            <input
                                                type="text"
                                                value={sheetConfig.range}
                                                onChange={e => setSheetConfig({ ...sheetConfig, range: e.target.value })}
                                                className="w-full p-3 rounded-lg border bg-background/50 focus:ring-2 focus:ring-primary/50 outline-none transition-all font-mono text-sm"
                                                placeholder="e.g., Sheet1!A1:Z500"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">API Key</label>
                                            <input
                                                type="password"
                                                value={sheetConfig.apiKey}
                                                onChange={e => setSheetConfig({ ...sheetConfig, apiKey: e.target.value })}
                                                className="w-full p-3 rounded-lg border bg-background/50 focus:ring-2 focus:ring-primary/50 outline-none transition-all font-mono text-sm"
                                                placeholder="Optional if Sheet is Public"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between p-4 bg-muted/20 rounded-xl border border-muted/50">
                                        <div>
                                            <h4 className="font-semibold text-sm">Auto-Sync (Every 10s)</h4>
                                            <p className="text-xs text-muted-foreground mt-0.5">Automatically pull changes from the sheet.</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={isAutoSyncing}
                                                onChange={(e) => setIsAutoSyncing(e.target.checked)}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                        </label>
                                    </div>

                                    <div className="flex gap-3 pt-2">
                                        <button
                                            type="submit"
                                            disabled={isSyncing}
                                            className="flex-1 bg-green-600 text-white px-6 py-3 rounded-xl hover:bg-green-700 shadow-lg shadow-green-600/20 transition-all font-bold flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                                        >
                                            {isSyncing ? <span className="animate-spin">⟳</span> : <FileText size={18} />}
                                            {isSyncing ? 'Syncing...' : `Sync ${syncMode === 'rider' ? 'Riders' : 'Wallets'} Now`}
                                        </button>
                                    </div>
                                </form>

                                <div className="mt-8 border-t pt-6">
                                    <h4 className="font-bold text-sm mb-4 flex items-center gap-2">
                                        <Sparkles size={16} className="text-primary animate-pulse" /> Real-Time Activation Steps
                                    </h4>
                                    <div className="space-y-4">
                                        <div className="p-4 bg-primary/5 rounded-xl border border-primary/20">
                                            <p className="text-sm font-semibold mb-2">1. Install Google Apps Script</p>
                                            <p className="text-xs text-muted-foreground mb-3">Copy this script into your Google Sheet (Extensions &gt; Apps Script) to enable push-based sync.</p>
                                            <div className="relative">
                                                <pre className="bg-black/90 text-green-400 p-4 rounded-lg text-[10px] h-40 overflow-y-auto overflow-x-hidden font-mono scrollbar-thin">
                                                    {`function onEdit(e) {
  const SHEET_ID = "${sheetConfig.sheetId || 'YOUR_SHEET_ID'}";
  const SUPABASE_URL = "${import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL'}";
  const SUPABASE_KEY = "${import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_KEY'}";
  UrlFetchApp.fetch(\`\${SUPABASE_URL}/rest/v1/sync_events\`, {
    method: "POST",
    headers: { "apikey": SUPABASE_KEY, "Authorization": \`Bearer \${SUPABASE_KEY}\`, "Content-Type": "application/json" },
    payload: JSON.stringify({ event_type: "${syncModeRef.current}_sync", sheet_id: SHEET_ID, metadata: { range: e.range.getA1Notation() } })
  });
}`}
                                                </pre>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="lg:col-span-1">
                                <GlassCard className="h-full bg-primary/5 border-primary/10 p-5 flex flex-col justify-between">
                                    <div>
                                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                            <History size={18} className="text-primary" /> Sync Status
                                        </h3>
                                        <div className="space-y-4">
                                            <div className="p-3 bg-background/60 rounded-lg border border-border/50">
                                                <p className="text-xs text-muted-foreground mb-1 font-semibold uppercase tracking-wider">Last Synced</p>
                                                <p className="font-mono font-medium text-sm">{lastSyncTime ? lastSyncTime.toLocaleTimeString() : 'Never'}</p>
                                            </div>
                                            <div className="p-3 bg-background/60 rounded-lg border border-border/50">
                                                <p className="text-xs text-muted-foreground mb-1 font-semibold uppercase tracking-wider">Last Result</p>
                                                {history.length > 0 ? (
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between text-sm"><span className="text-green-600 font-medium">Success: {history[0].successCount}</span></div>
                                                        <div className="flex justify-between text-sm"><span className="text-red-500 font-medium">Failed: {history[0].failureCount}</span></div>
                                                    </div>
                                                ) : <p className="text-sm text-muted-foreground italic">No recent sync data</p>}
                                            </div>
                                            {syncError && <div className="p-3 bg-red-50 text-red-600 rounded-lg border border-red-100 text-xs"><strong>Error:</strong> {syncError}</div>}
                                        </div>
                                    </div>
                                </GlassCard>
                            </div>
                        </div>
                    </GlassCard>
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
