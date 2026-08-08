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

            // Step 1: Fetch all RMs strictly reporting to this City Ops UUID
            // We ONLY use city_ops_id to prevent name collisions where a new City Ops
            // inherits RMs just because of a generic or blank name.
            const { data: rms, error: rmError } = await supabase
                .from('users')
                .select('id, full_name')
                .eq('role', 'reportingManager')
                .eq('city_ops_id', userData.id)
                .in('status', ['active', 'inactive', 'suspended']);

            if (rmError) throw rmError;

            const fetchedRmIds = rms?.map(r => r.id) || [];
            setRmIds(fetchedRmIds);

            // Step 2: Fetch all TLs under this City Ops.
            // TLs are linked to RMs via the reporting_manager field (which stores RM full_name).
            // They can also be linked if their reporting_manager is the City Ops' own full_name.
            const rmNames = (rms || []).map(r => r.full_name).filter(Boolean);
            const validManagers = [...rmNames, userData.fullName].filter(Boolean);

            let fetchedTlIds: string[] = [];

            if (validManagers.length > 0) {
                const { data: tls, error: tlError } = await supabase
                    .from('users')
                    .select('id, full_name')
                    .eq('role', 'teamLeader')
                    .in('reporting_manager', validManagers)
                    .in('status', ['active', 'inactive', 'suspended']);

                if (tlError) throw tlError;
                fetchedTlIds = tls?.map(t => t.id) || [];
            }
            setTlIds(fetchedTlIds);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to load scope';
            console.error('[CityOpsScope] Error:', message);
            setError(message);
        } finally {
            setIsLoading(false);
        }
    }, [userData?.id, userData?.role, userData?.fullName]);

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
