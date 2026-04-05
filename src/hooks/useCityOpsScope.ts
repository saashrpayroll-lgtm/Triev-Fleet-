import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/config/supabase';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';

interface CityOpsScope {
    cityOpsId: string;
    rmIds: string[];
    tlIds: string[];
    allUserIds: string[]; // rmIds + tlIds combined
    riderCityOpsId: string; // For direct .eq('city_ops_id', id) queries on riders
    isLoading: boolean;
    error: string | null;
    refresh: () => void;
}

/**
 * Central data-scoping hook for City Ops panel.
 * Fetches hierarchical team members (RMs → TLs) under the logged-in City Ops user.
 * All City Ops pages use this hook to ensure strict data isolation.
 */
export const useCityOpsScope = (): CityOpsScope => {
    const { userData } = useSupabaseAuth();
    const [rmIds, setRmIds] = useState<string[]>([]);
    const [tlIds, setTlIds] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchScope = useCallback(async () => {
        if (!userData?.id || userData.role !== 'cityOps') {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // Step 1: Fetch all RMs reporting to this City Ops
            const { data: rms, error: rmError } = await supabase
                .from('users')
                .select('id')
                .eq('city_ops_id', userData.id)
                .eq('role', 'reportingManager')
                .in('status', ['active', 'inactive']);

            if (rmError) throw rmError;

            const fetchedRmIds = rms?.map(r => r.id) || [];
            setRmIds(fetchedRmIds);

            // Step 2: Fetch all TLs reporting to this City Ops
            const { data: tls, error: tlError } = await supabase
                .from('users')
                .select('id')
                .eq('city_ops_id', userData.id)
                .eq('role', 'teamLeader')
                .in('status', ['active', 'inactive']);

            if (tlError) throw tlError;

            const fetchedTlIds = tls?.map(t => t.id) || [];
            setTlIds(fetchedTlIds);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to load scope';
            console.error('[CityOpsScope] Error:', message);
            setError(message);
        } finally {
            setIsLoading(false);
        }
    }, [userData?.id, userData?.role]);

    useEffect(() => {
        fetchScope();
    }, [fetchScope]);

    return {
        cityOpsId: userData?.id || '',
        rmIds,
        tlIds,
        allUserIds: [...rmIds, ...tlIds],
        riderCityOpsId: userData?.id || '', // Direct filter for riders table
        isLoading,
        error,
        refresh: fetchScope,
    };
};
