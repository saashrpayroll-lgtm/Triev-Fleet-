import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/config/supabase';
import { Rider, User } from '@/types';
import { parseIndianDate } from '@/utils/dateUtils';
import { toast } from 'sonner';

export type ZomatoThemeColor = 'crimson' | 'amber' | 'purple' | 'emerald' | 'blue';
export type ZomatoLowBalanceThemeColor = 'amber' | 'gold' | 'purple' | 'emerald' | 'blue';

export interface ZomatoVIPPopupConfig {
    isEnabled: boolean;
    enableAutoPopup: boolean;
    negativeThreshold: number; // e.g. 0, -250, -500, -1000
    excludeNewAllotments: boolean; // exclude within 24-48 hrs
    excludeStolen: boolean;
    excludeCompanyTagged: boolean;
    visibilityMode: 'all' | 'specific' | 'excluded';
    selectedTlIds: string[];
    enabledForRoles: ('teamLeader' | 'reportingManager' | 'cityOps')[];
    themeColor: ZomatoThemeColor;
    customTitle: string;
    customSubtitle: string;
    actionButtonText: string;
}

export interface ZomatoLowBalancePopupConfig {
    isEnabled: boolean;
    enableAutoPopup: boolean;
    lowBalanceThreshold: number; // default: 250 (range: strictly >= 0 and < lowBalanceThreshold)
    excludeNewAllotments: boolean;
    excludeStolen: boolean;
    excludeCompanyTagged: boolean;
    visibilityMode: 'all' | 'specific' | 'excluded';
    selectedTlIds: string[];
    enabledForRoles: ('teamLeader' | 'reportingManager' | 'cityOps')[];
    themeColor: ZomatoLowBalanceThemeColor;
    customTitle: string;
    customSubtitle: string;
    actionButtonText: string;
}

export const DEFAULT_ZOMATO_POPUP_CONFIG: ZomatoVIPPopupConfig = {
    isEnabled: true,
    enableAutoPopup: true,
    negativeThreshold: 0,
    excludeNewAllotments: false,
    excludeStolen: true,
    excludeCompanyTagged: false,
    visibilityMode: 'all',
    selectedTlIds: [],
    enabledForRoles: ['teamLeader', 'reportingManager'],
    themeColor: 'crimson',
    customTitle: 'Critical Alert',
    customSubtitle: 'Zomato VIP Riders have 0 or negative wallet balances.',
    actionButtonText: 'Acknowledge & Action'
};

export const DEFAULT_ZOMATO_LOW_BALANCE_POPUP_CONFIG: ZomatoLowBalancePopupConfig = {
    isEnabled: true,
    enableAutoPopup: true,
    lowBalanceThreshold: 250, // Positive ₹0 to ₹249.99
    excludeNewAllotments: false,
    excludeStolen: true,
    excludeCompanyTagged: false,
    visibilityMode: 'all',
    selectedTlIds: [],
    enabledForRoles: ['teamLeader', 'reportingManager'],
    themeColor: 'gold',
    customTitle: '⚡ Low Balance Alert',
    customSubtitle: 'Zomato VIP Riders with wallet balance under ₹250 need a quick recharge top-up.',
    actionButtonText: 'Acknowledge & Remind'
};

const STORAGE_KEY = 'zomato_vip_popup_config';
const LOW_BALANCE_STORAGE_KEY = 'zomato_vip_low_balance_popup_config';

export const isNewAllotmentRider = (allotmentDateStr?: string): boolean => {
    if (!allotmentDateStr) return false;
    try {
        const parsedIso = parseIndianDate(allotmentDateStr) || allotmentDateStr;
        const allotmentDate = new Date(parsedIso);
        if (isNaN(allotmentDate.getTime())) return false;

        const now = new Date();
        const diffHours = (now.getTime() - allotmentDate.getTime()) / (1000 * 60 * 60);
        if (diffHours >= -2 && diffHours <= 48) return true;

        const nowIstStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
        const allotmentIstStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(allotmentDate);

        const [nY, nM, nD] = nowIstStr.split('-').map(Number);
        const [aY, aM, aD] = allotmentIstStr.split('-').map(Number);

        const nDate = Date.UTC(nY, nM - 1, nD);
        const aDate = Date.UTC(aY, aM - 1, aD);

        const dayDiff = Math.round((nDate - aDate) / (1000 * 60 * 60 * 24));
        return dayDiff >= 0 && dayDiff <= 1;
    } catch {
        return false;
    }
};

export function filterZomatoEligibleRiders(
    riders: Rider[],
    config: ZomatoVIPPopupConfig
): Rider[] {
    if (!config.isEnabled) return [];

    return riders.filter(r => {
        // 1. Must be Active
        if (String(r.status || '').toLowerCase() !== 'active') return false;

        // 2. Must be Zomato VIP (Chassis prefix P6DSVFMSP)
        const chassis = (r.chassisNumber || (r as any).chassis_number || '').trim().toUpperCase();
        if (!chassis.startsWith('P6DSVFMSP')) return false;

        // 3. Wallet threshold check (negative/zero)
        const wallet = Number(r.walletAmount ?? (r as any).wallet_amount ?? 0);
        const targetLimit = Number(config.negativeThreshold) || 0;
        if (wallet > targetLimit) return false;

        // 4. Stolen exclusion check
        if (config.excludeStolen && (r.isStolen || (r as any).is_stolen)) return false;

        // 5. Company tagged exclusion check
        if (config.excludeCompanyTagged && (r.isCompanyTagged || (r as any).is_company_tagged)) return false;

        // 6. New allotment exclusion check
        if (config.excludeNewAllotments) {
            const allotDate = r.allotmentDate || (r as any).allotment_date || r.createdAt || (r as any).created_at;
            if (isNewAllotmentRider(allotDate)) return false;
        }

        return true;
    });
}

export function filterZomatoLowBalanceRiders(
    riders: Rider[],
    config: ZomatoLowBalancePopupConfig
): Rider[] {
    if (!config.isEnabled) return [];

    return riders.filter(r => {
        // 1. Must be Active
        if (String(r.status || '').toLowerCase() !== 'active') return false;

        // 2. Must be Zomato VIP (Chassis prefix P6DSVFMSP)
        const chassis = (r.chassisNumber || (r as any).chassis_number || '').trim().toUpperCase();
        if (!chassis.startsWith('P6DSVFMSP')) return false;

        // 3. Wallet threshold check: Must be positive (>= 0) and strictly less than threshold (< lowBalanceThreshold)
        const wallet = Number(r.walletAmount ?? (r as any).wallet_amount ?? 0);
        const targetLimit = Number(config.lowBalanceThreshold) || 250;
        if (wallet < 0 || wallet >= targetLimit) return false;

        // 4. Stolen exclusion check
        if (config.excludeStolen && (r.isStolen || (r as any).is_stolen)) return false;

        // 5. Company tagged exclusion check
        if (config.excludeCompanyTagged && (r.isCompanyTagged || (r as any).is_company_tagged)) return false;

        // 6. New allotment exclusion check
        if (config.excludeNewAllotments) {
            const allotDate = r.allotmentDate || (r as any).allotment_date || r.createdAt || (r as any).created_at;
            if (isNewAllotmentRider(allotDate)) return false;
        }

        return true;
    });
}

export function isPopupVisibleForUser(
    userData: User | null | undefined,
    config: ZomatoVIPPopupConfig
): boolean {
    if (!userData || !config.isEnabled) return false;

    const userRole = userData.role as any;
    if (!config.enabledForRoles.includes(userRole)) return false;

    // TL Specific Visibility checks
    if (userRole === 'teamLeader') {
        const tlId = userData.id;
        if (config.visibilityMode === 'specific') {
            return config.selectedTlIds.includes(tlId);
        }
        if (config.visibilityMode === 'excluded') {
            return !config.selectedTlIds.includes(tlId);
        }
        return true;
    }

    return true;
}

export function isLowBalancePopupVisibleForUser(
    userData: User | null | undefined,
    config: ZomatoLowBalancePopupConfig
): boolean {
    if (!userData || !config.isEnabled) return false;

    const userRole = userData.role as any;
    if (!config.enabledForRoles.includes(userRole)) return false;

    // TL Specific Visibility checks
    if (userRole === 'teamLeader') {
        const tlId = userData.id;
        if (config.visibilityMode === 'specific') {
            return config.selectedTlIds.includes(tlId);
        }
        if (config.visibilityMode === 'excluded') {
            return !config.selectedTlIds.includes(tlId);
        }
        return true;
    }

    return true;
}

// ============================================================
// MODULE-LEVEL SINGLETON: One shared channel for ALL hook instances
// This prevents "cannot add callbacks after subscribe()" error
// when multiple components mount useZomatoVIPPopupConfig at once.
// ============================================================
type ConfigUpdateListener = (payload: any) => void;
const _listeners = new Set<ConfigUpdateListener>();
let _channelReady = false;

function ensureZomatoChannel() {
    if (_channelReady) return;
    _channelReady = true;

    supabase
        .channel('zomato-popup-config-singleton')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'system_settings',
            filter: 'key=eq.zomato_vip_popup_config'
        }, (payload: any) => {
            // Fan-out to all active hook listeners
            _listeners.forEach(fn => fn(payload));
        })
        .subscribe((status) => {
            if (status === 'CHANNEL_ERROR') {
                // Reset so it can be re-created on next mount
                _channelReady = false;
            }
        });
}

export function useZomatoVIPPopupConfig() {
    const [negativeConfig, setNegativeConfig] = useState<ZomatoVIPPopupConfig>(() => {
        try {
            const cached = localStorage.getItem(STORAGE_KEY);
            if (cached) return { ...DEFAULT_ZOMATO_POPUP_CONFIG, ...JSON.parse(cached) };
        } catch {}
        return DEFAULT_ZOMATO_POPUP_CONFIG;
    });

    const [lowBalanceConfig, setLowBalanceConfig] = useState<ZomatoLowBalancePopupConfig>(() => {
        try {
            const cached = localStorage.getItem(LOW_BALANCE_STORAGE_KEY);
            if (cached) return { ...DEFAULT_ZOMATO_LOW_BALANCE_POPUP_CONFIG, ...JSON.parse(cached) };
        } catch {}
        return DEFAULT_ZOMATO_LOW_BALANCE_POPUP_CONFIG;
    });

    const [loading, setLoading] = useState(true);
    const lastFetchedRef = useRef<number>(0);
    const POLLING_STALE_MS = 10 * 60 * 1000; // 10 minutes

    const parsePayload = useCallback((val: any) => {
        if (!val) return;
        if (val.lowBalance) {
            const mergedLB = { ...DEFAULT_ZOMATO_LOW_BALANCE_POPUP_CONFIG, ...val.lowBalance };
            setLowBalanceConfig(mergedLB);
            try {
                localStorage.setItem(LOW_BALANCE_STORAGE_KEY, JSON.stringify(mergedLB));
            } catch {}
        }
        const negSource = val.negative || val;
        const mergedNeg = { ...DEFAULT_ZOMATO_POPUP_CONFIG, ...negSource };
        setNegativeConfig(mergedNeg);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedNeg));
        } catch {}
    }, []);

    const fetchConfig = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('system_settings')
                .select('value')
                .eq('key', 'zomato_vip_popup_config')
                .maybeSingle();

            if (!error && data?.value) {
                parsePayload(data.value);
            }
        } catch (err) {
            console.error('Failed to fetch Zomato VIP Popup Config:', err);
        } finally {
            setLoading(false);
            lastFetchedRef.current = Date.now();
        }
    }, [parsePayload]);

    useEffect(() => {
        // Initial fetch
        fetchConfig();

        // Register this instance's realtime listener in the module-level Set
        const handleRealtimeUpdate = (payload: any) => {
            if (payload.new?.value) {
                parsePayload(payload.new.value);
            }
        };
        _listeners.add(handleRealtimeUpdate);

        // Ensure the singleton channel is active (no-op if already running)
        ensureZomatoChannel();

        // Visibility-based polling fallback (if tab was hidden > 10 min)
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                if (Date.now() - lastFetchedRef.current > POLLING_STALE_MS) {
                    fetchConfig();
                }
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            _listeners.delete(handleRealtimeUpdate);
            document.removeEventListener('visibilitychange', handleVisibility);
            // NOTE: We do NOT remove the channel here — it's shared across all instances.
            // The channel stays alive as long as the app is running.
        };
    }, [fetchConfig, parsePayload]);

    const saveConfig = async (
        newNegativeConfig?: ZomatoVIPPopupConfig,
        newLowBalanceConfig?: ZomatoLowBalancePopupConfig
    ) => {
        try {
            const targetNeg = newNegativeConfig || negativeConfig;
            const targetLB = newLowBalanceConfig || lowBalanceConfig;

            if (newNegativeConfig) {
                setNegativeConfig(targetNeg);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(targetNeg));
            }
            if (newLowBalanceConfig) {
                setLowBalanceConfig(targetLB);
                localStorage.setItem(LOW_BALANCE_STORAGE_KEY, JSON.stringify(targetLB));
            }

            const combinedPayload = {
                ...targetNeg,
                negative: targetNeg,
                lowBalance: targetLB
            };

            const { error } = await supabase
                .from('system_settings')
                .upsert({
                    key: 'zomato_vip_popup_config',
                    value: combinedPayload,
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;
            toast.success('Zomato VIP Pop-up settings saved & synced in real-time across all panels!');
            return true;
        } catch (err: any) {
            console.error('Error saving Zomato VIP popup config:', err);
            toast.error(`Failed to save settings: ${err.message || 'Unknown error'}`);
            return false;
        }
    };

    return {
        config: negativeConfig,
        negativeConfig,
        lowBalanceConfig,
        loading,
        saveConfig,
        refresh: fetchConfig
    };
}
