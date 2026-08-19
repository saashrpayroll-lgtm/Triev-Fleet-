import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/config/supabase';
import { Rider, User } from '@/types';
import { parseIndianDate } from '@/utils/dateUtils';
import { toast } from 'sonner';

export type ZomatoThemeColor = 'crimson' | 'amber' | 'purple' | 'emerald' | 'blue';

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

const STORAGE_KEY = 'zomato_vip_popup_config';

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

        // 3. Wallet threshold check
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

export function useZomatoVIPPopupConfig() {
    const [config, setConfig] = useState<ZomatoVIPPopupConfig>(() => {
        try {
            const cached = localStorage.getItem(STORAGE_KEY);
            if (cached) return { ...DEFAULT_ZOMATO_POPUP_CONFIG, ...JSON.parse(cached) };
        } catch {}
        return DEFAULT_ZOMATO_POPUP_CONFIG;
    });
    const [loading, setLoading] = useState(true);

    const fetchConfig = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('system_settings')
                .select('value')
                .eq('key', 'zomato_vip_popup_config')
                .maybeSingle();

            if (!error && data?.value) {
                const merged = { ...DEFAULT_ZOMATO_POPUP_CONFIG, ...data.value };
                setConfig(merged);
                try {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
                } catch {}
            }
        } catch (err) {
            console.error('Failed to fetch Zomato VIP Popup Config:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchConfig();

        // Realtime Subscription with Unique Channel Name per mount instance
        const channelName = `zomato-popup-${Math.random().toString(36).substring(2, 9)}`;
        const channel = supabase
            .channel(channelName)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'system_settings',
                filter: 'key=eq.zomato_vip_popup_config'
            }, (payload: any) => {
                if (payload.new?.value) {
                    const merged = { ...DEFAULT_ZOMATO_POPUP_CONFIG, ...payload.new.value };
                    setConfig(merged);
                    try {
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
                    } catch {}
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchConfig]);

    const saveConfig = async (newConfig: ZomatoVIPPopupConfig) => {
        try {
            setConfig(newConfig);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));

            const { error } = await supabase
                .from('system_settings')
                .upsert({
                    key: 'zomato_vip_popup_config',
                    value: newConfig,
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
        config,
        loading,
        saveConfig,
        refresh: fetchConfig
    };
}
