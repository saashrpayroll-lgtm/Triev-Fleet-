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

    private constructor() {
        // Register visibility & storage listeners for multi-tab resilience
        if (typeof window !== 'undefined') {
            window.addEventListener('storage', this.handleStorageEvent);
            document.addEventListener('visibilitychange', this.handleVisibilityChange);
        }
    }

    public static getInstance(): LiveSheetAutoSyncService {
        if (!LiveSheetAutoSyncService.instance) {
            LiveSheetAutoSyncService.instance = new LiveSheetAutoSyncService();
        }
        return LiveSheetAutoSyncService.instance;
    }

    public async initialize(userId: string, userName: string) {
        this.activeUserId = userId;
        this.activeUserName = userName;

        if (!this.initialized) {
            this.initialized = true;
            await this.loadConfigFromDatabase();
            this.restartTimers();
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

    public async executeAutoSync(isManual = false): Promise<ImportSummary | null> {
        if (this.isSyncing) return null;
        if (!this.config || (!this.config.sheetId && !isManual)) return null;
        if (!this.activeUserId) return null;

        this.isSyncing = true;
        this.syncError = null;
        this.notifyListeners();

        try {
            const summary = await syncGoogleSheet({
                sheetId: this.config.sheetId,
                range: this.config.range || 'Sheet1!A1:Z10000',
                apiKey: this.config.apiKey || undefined,
                columnMapping: this.config.columnMapping,
                staffFilter: this.config.staffFilter
            }, this.activeUserId, this.activeUserName || 'Admin System', 'rider', this.config.strictMirror || false);

            this.lastSyncTime = new Date();
            this.lastSummary = summary;
            this.scannedCount = summary.total || 0;
            this.syncError = null;

            // Broadcast last sync timestamp to other tabs via localStorage
            if (typeof window !== 'undefined') {
                localStorage.setItem('triev_last_sheet_sync_ts', this.lastSyncTime.toISOString());
            }

            return summary;
        } catch (err: any) {
            console.error("Global Live Sheet Background Sync Error:", err);
            this.syncError = err.message || 'Background sync failed';
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
            // Check if last sync is stale by more than interval
            const intervalMs = (this.config.syncIntervalMinutes || 2) * 60 * 1000;
            if (this.lastSyncTime && (Date.now() - this.lastSyncTime.getTime() > intervalMs + 10000)) {
                console.log("Tab returned from background - triggering caught-up sync...");
                this.executeAutoSync();
            }
        }
    };
}

export const liveSheetAutoSync = LiveSheetAutoSyncService.getInstance();
export default liveSheetAutoSync;
