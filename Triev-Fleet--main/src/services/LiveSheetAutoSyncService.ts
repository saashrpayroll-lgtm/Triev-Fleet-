import { supabase } from '@/config/supabase';
import { syncGoogleSheet } from '@/utils/googleSheetsUtils';
import { ImportSummary, RiderImportConfig } from '@/types';

export interface LiveSyncEngineStatus {
    isSyncing: boolean;
    lastSyncTime: Date | null;
    nextSyncTime: Date | null;
    nextSyncCountdown: number; // in seconds
    syncError: string | null;
    lastSummary: ImportSummary | null;
    config: RiderImportConfig | null;
    healthState: 'active' | 'paused' | 'syncing' | 'error';
    scannedCount: number;
}

type StatusListener = (status: LiveSyncEngineStatus) => void;

class LiveSheetAutoSyncService {
    private static instance: LiveSheetAutoSyncService;
    private config: RiderImportConfig | null = null;
    private isSyncing = false;
    private lastSyncTime: Date | null = null;
    private nextSyncTime: Date | null = null;
    private nextSyncCountdown = 0;
    private syncError: string | null = null;
    private lastSummary: ImportSummary | null = null;
    private scannedCount = 0;
    
    private syncIntervalTimer: NodeJS.Timeout | null = null;
    private countdownTimer: NodeJS.Timeout | null = null;
    private listeners: Set<StatusListener> = new Set();
    private initialized = false;
    private activeUserId: string | null = null;
    private activeUserName: string | null = null;
    private realtimeChannel: any = null;

    private constructor() {
        if (typeof window !== 'undefined') {
            window.addEventListener('storage', this.handleStorageEvent);
            document.addEventListener('visibilitychange', this.handleVisibilityChange);
        }
        this.setupRealtimeSubscription();
    }

    public static getInstance(): LiveSheetAutoSyncService {
        if (!LiveSheetAutoSyncService.instance) {
            LiveSheetAutoSyncService.instance = new LiveSheetAutoSyncService();
        }
        return LiveSheetAutoSyncService.instance;
    }

    private setupRealtimeSubscription() {
        try {
            this.realtimeChannel = supabase
                .channel('global-sheet-sync-settings')
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'system_settings'
                }, (payload: any) => {
                    if (payload.new && payload.new.key === 'last_sheet_sync_status') {
                        this.applySyncStatusFromDB(payload.new.value);
                    } else if (payload.new && payload.new.key === 'rider_import_config') {
                        this.config = payload.new.value as RiderImportConfig;
                        this.restartTimers();
                        this.notifyListeners();
                    }
                })
                .subscribe();
        } catch (err) {
            console.warn("Failed to subscribe to Supabase Realtime for sheet sync:", err);
        }
    }

    public destroy() {
        if (this.realtimeChannel) {
            supabase.removeChannel(this.realtimeChannel);
            this.realtimeChannel = null;
        }
        if (this.syncIntervalTimer) clearInterval(this.syncIntervalTimer);
        if (this.countdownTimer) clearInterval(this.countdownTimer);
        if (typeof window !== 'undefined') {
            window.removeEventListener('storage', this.handleStorageEvent);
            document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        }
    }

    public async initialize(userId: string, userName: string) {
        this.activeUserId = userId;
        this.activeUserName = userName;

        if (!this.initialized) {
            this.initialized = true;
            await this.loadConfigFromDatabase();
            await this.loadSyncStatusFromDatabase();
            this.restartTimers();

            // Passive Catch-up sync on session start
            if (this.config?.enabled && this.config?.sheetId) {
                const intervalMs = (this.config.syncIntervalMinutes || 2) * 60 * 1000;
                if (!this.lastSyncTime || (Date.now() - this.lastSyncTime.getTime() > intervalMs)) {
                    this.executeAutoSync().catch(err => {
                        console.warn("Passive catch-up sync skipped or failed:", err);
                    });
                }
            }
        }
    }

    public subscribe(listener: StatusListener): () => void {
        this.listeners.add(listener);
        listener(this.getStatus());
        return () => {
            this.listeners.delete(listener);
        };
    }

    public getStatus(): LiveSyncEngineStatus {
        let healthState: 'active' | 'paused' | 'syncing' | 'error' = 'paused';
        if (this.isSyncing) healthState = 'syncing';
        else if (this.syncError) healthState = 'error';
        else if (this.config?.enabled) healthState = 'active';

        return {
            isSyncing: this.isSyncing,
            lastSyncTime: this.lastSyncTime,
            nextSyncTime: this.nextSyncTime,
            nextSyncCountdown: this.nextSyncCountdown,
            syncError: this.syncError,
            lastSummary: this.lastSummary,
            config: this.config,
            healthState,
            scannedCount: this.scannedCount
        };
    }

    private notifyListeners() {
        const status = this.getStatus();
        this.listeners.forEach(fn => {
            try { fn(status); } catch (e) { console.error("Error in sync listener:", e); }
        });
    }

    public async loadConfigFromDatabase(): Promise<RiderImportConfig | null> {
        try {
            const { data, error } = await supabase
                .from('system_settings')
                .select('value')
                .eq('key', 'rider_import_config')
                .maybeSingle();

            if (error) throw error;
            if (data?.value) {
                this.config = data.value as RiderImportConfig;
                this.notifyListeners();
                return this.config;
            }
        } catch (err) {
            console.error("Failed to load rider_import_config from Supabase:", err);
        }
        return null;
    }

    public async loadSyncStatusFromDatabase() {
        try {
            const { data, error } = await supabase
                .from('system_settings')
                .select('value')
                .eq('key', 'last_sheet_sync_status')
                .maybeSingle();

            if (!error && data?.value) {
                this.applySyncStatusFromDB(data.value);
            }
        } catch (err) {
            console.error("Failed to load last_sheet_sync_status from Supabase:", err);
        }
    }

    private applySyncStatusFromDB(val: any) {
        if (!val) return;
        if (val.lastSyncTime) this.lastSyncTime = new Date(val.lastSyncTime);
        if (val.syncError !== undefined) this.syncError = val.syncError;
        if (val.lastSummary) this.lastSummary = val.lastSummary;
        if (val.scannedCount !== undefined) this.scannedCount = val.scannedCount;
        if (val.status === 'syncing') this.isSyncing = true;
        else if (val.status === 'active' || val.status === 'error' || val.status === 'paused') this.isSyncing = false;
        this.notifyListeners();
    }

    public async saveConfig(newConfig: RiderImportConfig): Promise<boolean> {
        this.config = newConfig;
        this.restartTimers();
        this.notifyListeners();

        try {
            const { error } = await supabase.from('system_settings').upsert({
                key: 'rider_import_config',
                value: newConfig,
                updated_at: new Date().toISOString()
            });
            if (error) throw error;
            return true;
        } catch (err) {
            console.error("Failed to persist rider_import_config:", err);
            return false;
        }
    }

    public restartTimers() {
        if (this.syncIntervalTimer) clearInterval(this.syncIntervalTimer);
        if (this.countdownTimer) clearInterval(this.countdownTimer);

        if (!this.config?.enabled || !this.config.sheetId) {
            this.nextSyncTime = null;
            this.nextSyncCountdown = 0;
            this.notifyListeners();
            return;
        }

        const intervalMs = (this.config.syncIntervalMinutes || 2) * 60 * 1000;
        this.nextSyncTime = new Date(Date.now() + intervalMs);
        this.nextSyncCountdown = Math.floor(intervalMs / 1000);

        // Countdown timer tick every second
        this.countdownTimer = setInterval(() => {
            if (this.nextSyncCountdown > 1) {
                this.nextSyncCountdown -= 1;
            } else {
                this.nextSyncCountdown = Math.floor(intervalMs / 1000);
            }
            this.notifyListeners();
        }, 1000);

        // Background interval trigger
        this.syncIntervalTimer = setInterval(() => {
            this.executeAutoSync();
        }, intervalMs);

        this.notifyListeners();
    }

    private async acquireLock(): Promise<boolean> {
        try {
            const { data } = await supabase
                .from('system_settings')
                .select('value')
                .eq('key', 'last_sheet_sync_status')
                .maybeSingle();

            const current = data?.value || {};
            if (current.lockedUntil && new Date(current.lockedUntil) > new Date()) {
                console.log("Auto sync skipped: another worker holds the sync lock.");
                return false;
            }

            const lockUntil = new Date(Date.now() + 120 * 1000).toISOString();
            await supabase.from('system_settings').upsert({
                key: 'last_sheet_sync_status',
                value: { ...current, status: 'syncing', lockedUntil: lockUntil },
                updated_at: new Date().toISOString()
            });

            return true;
        } catch (err) {
            console.error("Failed to acquire sync lock:", err);
            return true; // Fallback to proceed if lock table isn't accessible
        }
    }

    private async releaseLock(statusState: 'active' | 'error', summary: ImportSummary | null = null, errorMsg: string | null = null) {
        try {
            const nowIso = new Date().toISOString();
            const payload = {
                lastSyncTime: nowIso,
                status: statusState,
                syncError: errorMsg,
                scannedCount: summary ? (summary.total || 0) : this.scannedCount,
                lastSummary: summary || this.lastSummary,
                lockedUntil: null
            };

            await supabase.from('system_settings').upsert({
                key: 'last_sheet_sync_status',
                value: payload,
                updated_at: nowIso
            });

            this.applySyncStatusFromDB(payload);
        } catch (err) {
            console.error("Failed to release sync lock:", err);
        }
    }

    public async executeAutoSync(isManual = false): Promise<ImportSummary | null> {
        if (this.isSyncing) return null;
        if (!this.config || (!this.config.sheetId && !isManual)) return null;

        // Verify lock
        const locked = await this.acquireLock();
        if (!locked && !isManual) return null;

        this.isSyncing = true;
        this.syncError = null;
        this.notifyListeners();

        const userId = this.activeUserId || 'system-auto-worker';
        const userName = this.activeUserName || 'Background System Sync';

        try {
            const summary = await syncGoogleSheet({
                sheetId: this.config.sheetId,
                range: this.config.range || 'Sheet1!A1:Z10000',
                apiKey: this.config.apiKey || undefined,
                columnMapping: this.config.columnMapping,
                staffFilter: this.config.staffFilter
            }, userId, userName, 'rider', this.config.strictMirror || false);

            this.lastSyncTime = new Date();
            this.lastSummary = summary;
            this.scannedCount = summary.total || 0;
            this.syncError = null;

            await this.releaseLock('active', summary, null);

            if (typeof window !== 'undefined') {
                localStorage.setItem('triev_last_sheet_sync_ts', this.lastSyncTime.toISOString());
            }

            return summary;
        } catch (err: any) {
            console.error("Global Live Sheet Background Sync Error:", err);
            this.syncError = err.message || 'Background sync failed';
            await this.releaseLock('error', null, this.syncError);
            throw err;
        } finally {
            this.isSyncing = false;
            this.restartTimers();
            this.notifyListeners();
        }
    }

    private handleStorageEvent = (e: StorageEvent) => {
        if (e.key === 'triev_last_sheet_sync_ts' && e.newValue) {
            this.lastSyncTime = new Date(e.newValue);
            this.notifyListeners();
        }
    };

    private handleVisibilityChange = () => {
        if (document.visibilityState === 'visible' && this.config?.enabled) {
            const intervalMs = (this.config.syncIntervalMinutes || 2) * 60 * 1000;
            if (!this.lastSyncTime || (Date.now() - this.lastSyncTime.getTime() > intervalMs + 5000)) {
                console.log("Tab returned from background - triggering caught-up sync...");
                this.executeAutoSync().catch(() => {});
            }
        }
    };
}

export const liveSheetAutoSync = LiveSheetAutoSyncService.getInstance();
export default liveSheetAutoSync;
