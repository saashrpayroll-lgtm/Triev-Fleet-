import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Wallet, History, HelpCircle, FileText, AlertTriangle, Trash2 } from 'lucide-react';
import DataImport from '@/components/DataImport';
import GlassCard from '@/components/GlassCard';
import { processRiderImport, processWalletUpdate } from '@/utils/importUtils';
import { syncGoogleSheet } from '@/utils/googleSheetsUtils';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/config/supabase';
import { downloadRiderTemplate, downloadWalletTemplate } from '@/utils/exportUtils';
import { Download as DownloadIcon } from 'lucide-react';

const DataManagement: React.FC = () => {
    const { userData } = useSupabaseAuth();
    const [activeTab, setActiveTab] = useState<'import' | 'wallet' | 'gsheets' | 'history' | 'help'>('import');
    const [history, setHistory] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Real-time History Fetching
    useEffect(() => {
        if (activeTab === 'history') {
            setLoadingHistory(true);

            // Initial fetch
            fetchHistory();

            // Real-time subscription
            const channel = supabase
                .channel('import-history-changes')
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'import_history'
                    },
                    (_) => {
                        // For simplicity, re-fetch on any change. 
                        // Optimization: Append/Update locally based on payload.
                        fetchHistory();
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [activeTab]);

    const fetchHistory = async () => {
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

            if (error) throw error;
            setHistory(data || []);
        } catch (err) {
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
            setActiveTab('history'); // Switch to history tab to show result
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

    const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(new Set());

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
            fetchHistory(); // Refresh to be sure
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

    // Google Sheets State
    const [sheetConfig, setSheetConfig] = useState({
        sheetId: '1BxiMvs0XRA5nLFd...', // Default or empty
        range: 'Sheet1!A1:Z100'
    });
    const [isAutoSyncing, setIsAutoSyncing] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
    const [syncError, setSyncError] = useState<string | null>(null);

    // Auto-Sync Interval
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isAutoSyncing) {
            // Run immediately on enable? Maybe not, mostly waiting 10s is safer logic.
            interval = setInterval(() => {
                handleGoogleSync(null, true);
            }, 10000); // 10 seconds
        }
        return () => clearInterval(interval);
    }, [isAutoSyncing, sheetConfig, userData]); // Re-create if config changes

    const handleGoogleSync = async (e: React.FormEvent | null, isAuto = false) => {
        if (e) e.preventDefault();

        if (!userData) return;
        if (isSyncing) return; // Prevent overlap

        if (!isAuto) setIsSyncing(true); // Only show loading spinner on manual
        setSyncError(null);

        try {
            // Validate config
            if (!sheetConfig.sheetId || !sheetConfig.range || sheetConfig.sheetId.includes('...')) {
                if (!isAuto) alert("Please enter valid Sheet ID and Range");
                throw new Error("Invalid Configuration");
            }

            const summary = await syncGoogleSheet({
                sheetId: sheetConfig.sheetId,
                range: sheetConfig.range
            }, userData.id, userData.fullName);

            setLastSyncTime(new Date());

            if (!isAuto) {
                alert(`Sync Complete!\nSuccess: ${summary.success}\nFailed: ${summary.failed}`);
            } else {
                // For auto-sync, maybe just console log or toast if serious error?
                console.log(`Auto-Sync Success: ${summary.success} updated`);
            }

            // Refresh history if on that tab
            if (activeTab === 'history') fetchHistory();

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

            {/* Navigation Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                <button
                    onClick={() => setActiveTab('import')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-medium whitespace-nowrap ${activeTab === 'import' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25' : 'hover:bg-accent bg-card border border-border'
                        }`}
                >
                    <FileSpreadsheet size={18} />
                    <span>Rider Import</span>
                </button>
                <button
                    onClick={() => setActiveTab('wallet')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-medium whitespace-nowrap ${activeTab === 'wallet' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25' : 'hover:bg-accent bg-card border border-border'
                        }`}
                >
                    <Wallet size={18} />
                    <span>Wallet Update</span>
                </button>
                <button
                    onClick={() => setActiveTab('gsheets')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-medium whitespace-nowrap ${activeTab === 'gsheets' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25' : 'hover:bg-accent bg-card border border-border'
                        }`}
                >
                    <FileText size={18} />
                    <span>Google Sheets</span>
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-medium whitespace-nowrap ${activeTab === 'history' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25' : 'hover:bg-accent bg-card border border-border'
                        }`}
                >
                    <History size={18} />
                    <span>Import History</span>
                </button>
                <button
                    onClick={() => setActiveTab('help')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-medium whitespace-nowrap ${activeTab === 'help' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25' : 'hover:bg-accent bg-card border border-border'
                        }`}
                >
                    <HelpCircle size={18} />
                    <span>Instructions</span>
                </button>
            </div>

            {/* Content Area */}
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
                            {/* Configuration Form */}
                            <div className="lg:col-span-2 space-y-6">
                                <form onSubmit={(e) => handleGoogleSync(e, false)} className="space-y-5">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium flex items-center gap-2">
                                            Sheet ID <span className="text-xs text-muted-foreground">(from URL)</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={sheetConfig.sheetId}
                                            onChange={e => setSheetConfig({ ...sheetConfig, sheetId: e.target.value })}
                                            className="w-full p-3 rounded-lg border bg-background/50 focus:ring-2 focus:ring-primary/50 outline-none transition-all font-mono text-sm"
                                            placeholder="e.g., 1BxiMvs0XRA5nLFd..."
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Range / Sheet Name</label>
                                        <input
                                            type="text"
                                            value={sheetConfig.range}
                                            onChange={e => setSheetConfig({ ...sheetConfig, range: e.target.value })}
                                            className="w-full p-3 rounded-lg border bg-background/50 focus:ring-2 focus:ring-primary/50 outline-none transition-all font-mono text-sm"
                                            placeholder="e.g., Sheet1!A1:Z100"
                                        />
                                    </div>

                                    {/* Auto Sync Toggle */}
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
                                            {isSyncing ? 'Syncing...' : 'Sync Now (Manual)'}
                                        </button>
                                    </div>
                                </form>
                            </div>

                            {/* Status Panel */}
                            <div className="lg:col-span-1">
                                <GlassCard className="h-full bg-primary/5 border-primary/10 p-5 flex flex-col justify-between">
                                    <div>
                                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                            <History size={18} className="text-primary" /> Sync Status
                                        </h3>

                                        <div className="space-y-4">
                                            <div className="p-3 bg-background/60 rounded-lg border border-border/50">
                                                <p className="text-xs text-muted-foreground mb-1 font-semibold uppercase tracking-wider">Last Synced</p>
                                                <p className="font-mono font-medium text-sm">
                                                    {lastSyncTime ? lastSyncTime.toLocaleTimeString() : 'Never'}
                                                </p>
                                            </div>

                                            <div className="p-3 bg-background/60 rounded-lg border border-border/50">
                                                <p className="text-xs text-muted-foreground mb-1 font-semibold uppercase tracking-wider">Last Result</p>
                                                {history.length > 0 && history[0].importType === 'rider' ? (
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-green-600 font-medium">Success: {history[0].successCount}</span>
                                                        </div>
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-red-500 font-medium">Failed: {history[0].failureCount}</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-muted-foreground italic">No recent sync data</p>
                                                )}
                                            </div>

                                            {syncError && (
                                                <div className="p-3 bg-red-50 text-red-600 rounded-lg border border-red-100 text-xs">
                                                    <strong>Error:</strong> {syncError}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-6 text-[10px] text-muted-foreground text-center">
                                        <p>Auto-sync runs in background.</p>
                                        <p>Errors will be logged but won't stop the timer.</p>
                                    </div>
                                </GlassCard>
                            </div>
                        </div>
                    </GlassCard>
                )}

                {activeTab === 'history' && (
                    <div className="space-y-4">
                        <GlassCard className="p-6">
                            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                                <History className="text-purple-500" /> Import History
                            </h2>
                            {loadingHistory ? (
                                <div className="text-center py-12">
                                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                                    <p className="text-muted-foreground">Loading history...</p>
                                </div>
                            ) : history.length === 0 ? (
                                <div className="text-center text-muted-foreground py-12 bg-muted/10 rounded-xl border border-dashed border-muted">
                                    No history records found.
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {/* Bulk Actions Header */}
                                    {history.length > 0 && (
                                        <div className="flex justify-between items-center bg-card p-3 rounded-lg border border-border/50">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    onChange={handleSelectAllHistory}
                                                    checked={history.length > 0 && selectedHistoryIds.size === history.length}
                                                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                                                />
                                                <span className="text-sm text-muted-foreground">{selectedHistoryIds.size} Selected</span>
                                            </div>
                                            {selectedHistoryIds.size > 0 && (
                                                <button
                                                    onClick={handleBulkDeleteHistory}
                                                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-100 dark:bg-red-900/30 rounded-md hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                                                >
                                                    <Trash2 size={14} /> Delete Selected
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {history.map((record: any) => (
                                        <div key={record.id} className={`group p-5 border rounded-xl bg-card/50 hover:bg-card hover:shadow-md transition-all ${selectedHistoryIds.has(record.id) ? 'border-primary/50 bg-primary/5' : 'border-border/50'}`}>
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedHistoryIds.has(record.id)}
                                                        onChange={() => handleSelectHistory(record.id)}
                                                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary mt-1"
                                                    />
                                                    <div className={`p-2 rounded-lg ${record.importType === 'wallet' ? 'bg-blue-500/10 text-blue-500' :
                                                        record.importType === 'rider' ? 'bg-green-500/10 text-green-500' : 'bg-orange-500/10 text-orange-500'
                                                        }`}>
                                                        {record.importType === 'wallet' ? <Wallet size={20} /> : <FileSpreadsheet size={20} />}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold capitalize text-lg">{record.importType} Import</div>
                                                        <div className="text-xs text-muted-foreground flex gap-2">
                                                            <span>by {record.adminName}</span>
                                                            <span>•</span>
                                                            <span>{record.timestamp ? new Date(record.timestamp).toLocaleString() : 'N/A'}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${record.status === 'success' ? 'bg-green-500/10 text-green-600 border border-green-500/20' :
                                                        record.status === 'failed' ? 'bg-red-500/10 text-red-600 border border-red-500/20' :
                                                            'bg-yellow-500/10 text-yellow-600 border border-yellow-500/20'
                                                        }`}>
                                                        {record.status}
                                                    </div>
                                                    <button
                                                        onClick={() => handleDeleteHistory(record.id)}
                                                        className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                                        title="Delete Record"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4 bg-muted/20 p-3 rounded-lg text-sm ml-0 sm:ml-7">
                                                <div className="text-center border-r border-border/50">
                                                    <div className="text-muted-foreground text-xs mb-1">Total Rows</div>
                                                    <div className="font-bold">{record.totalRows}</div>
                                                </div>
                                                <div className="text-center border-r border-border/50">
                                                    <div className="text-muted-foreground text-xs mb-1">Success</div>
                                                    <div className="font-bold text-green-600">{record.successCount}</div>
                                                </div>
                                                <div className="text-center">
                                                    <div className="text-muted-foreground text-xs mb-1">Failed</div>
                                                    <div className="font-bold text-red-600">{record.failureCount}</div>
                                                </div>
                                            </div>

                                            {record.errors && record.errors.length > 0 && (
                                                <div className="mt-4 border-t border-border/50 pt-3 ml-7">
                                                    <div className="text-xs font-semibold text-destructive mb-2 flex items-center gap-1">
                                                        <AlertTriangle size={12} /> Error Details (First 5)
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        {record.errors.slice(0, 5).map((err: any, idx: number) => (
                                                            <div key={idx} className="text-xs bg-destructive/5 text-destructive p-2 rounded border border-destructive/10">
                                                                <span className="font-bold">Row {err.row}:</span> {typeof err.reason === 'object' ? JSON.stringify(err.reason) : err.reason}
                                                                {err.identifier && <span className="opacity-70"> ({err.identifier})</span>}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </GlassCard>
                    </div>
                )}

                {activeTab === 'help' && (
                    <GlassCard className="p-8">
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                            <HelpCircle className="text-blue-400" /> Instructions
                        </h2>
                        <div className="space-y-6 text-sm leading-relaxed">
                            <div className="bg-muted/20 p-4 rounded-xl border border-muted/50">
                                <h3 className="font-semibold text-base mb-2">1. Rider Import</h3>
                                <p>Use for adding new riders or updating details like name, chassis number, etc.</p>
                                <ul className="list-disc pl-5 mt-2 space-y-1 text-muted-foreground">
                                    <li>Required: <strong>Rider Name</strong>, <strong>Team Leader</strong>, <strong>Client Name</strong>.</li>
                                    <li>Required: <strong>Allotment Date</strong>, <strong>Wallet Amount</strong> (can be 0).</li>
                                    <li>Required (One of for matching): <strong>Triev ID</strong>, <strong>Mobile Number</strong>, or <strong>Chassis Number</strong>.</li>
                                    <li>Team Leader name must match an existing Team Leader in the system EXACTLY.</li>
                                    <li>Optional: <strong>Remarks</strong>.</li>
                                </ul>
                            </div>

                            <div className="bg-muted/20 p-4 rounded-xl border border-muted/50">
                                <h3 className="font-semibold text-base mb-2">2. Wallet Update</h3>
                                <p>Use for bulk updating rider wallet balances.</p>
                                <ul className="list-disc pl-5 mt-2 space-y-1 text-muted-foreground">
                                    <li>Required: <strong>Wallet Amount</strong></li>
                                    <li>Required (Identifier): <strong>Triev ID</strong> or <strong>Mobile Number</strong>.</li>
                                    <li>Supports existing riders only. Will assume positive/negative based on the number in the sheet.</li>
                                </ul>
                            </div>
                        </div>
                    </GlassCard>
                )}
            </div>
        </div>
    );
};

export default DataManagement;
