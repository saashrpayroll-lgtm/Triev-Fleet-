import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/config/supabase';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { fetchAllRidersPaginated, fetchTablePaginated } from '@/utils/dbUtils';
import { Rider, User, Lead } from '@/types';

export interface RMTeamData {
    teamLeaders: User[];
    riders: Rider[];
    leads: Lead[];
    teamLeaderIds: string[];
    loading: boolean;
    error: string | null;
    refresh: () => void;
}

/**
 * Hook that fetches all data scoped to the current Reporting Manager's team.
 * It finds all TLs where reporting_manager matches the RM's fullName,
 * then fetches all riders and leads under those TLs.
 */
export function useRMTeamData(): RMTeamData {
    const { userData } = useSupabaseAuth();
    const [teamLeaders, setTeamLeaders] = useState<User[]>([]);
    const [riders, setRiders] = useState<Rider[]>([]);
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    const rmName = userData?.fullName || '';

    useEffect(() => {
        if (!rmName) return;

        const fetchData = async () => {
            setLoading(true);
            setError(null);

            try {
                // 1. Fetch Team Leaders assigned to this RM
                const { data: tlData, error: tlError } = await fetchTablePaginated('users', `
                        id, userId:user_id, fullName:full_name, email, mobile, role, status,
                        username, jobLocation:job_location, reportingManager:reporting_manager,
                        permissions, remarks, profilePicUrl:profile_pic_url,
                        suspendedUntil:suspended_until, createdAt:created_at, updatedAt:updated_at,
                        position
                    `, [
                        { column: 'reporting_manager', operator: 'ilike', value: `%${rmName.trim()}%` },
                        { column: 'role', operator: 'eq', value: 'teamLeader' }
                    ]);

                console.log('[RM Panel Debug] RM Name:', rmName.trim());
                console.log('[RM Panel Debug] TL Query result:', { count: tlData?.length, error: tlError, data: tlData?.map((t: any) => ({ id: t.id, name: t.full_name || t.fullName, rm: t.reporting_manager || t.reportingManager })) });

                if (tlError) throw tlError;

                const tls = (tlData as unknown as User[]) || [];
                setTeamLeaders(tls);

                const tlIds = tls.map(tl => tl.id);

                if (tlIds.length === 0) {
                    setRiders([]);
                    setLeads([]);
                    setLoading(false);
                    return;
                }

                // 2. Fetch Riders under these TLs
                const { data: riderData, error: riderError } = await fetchAllRidersPaginated(`
                        id, trievId:triev_id, riderName:rider_name, mobileNumber:mobile_number,
                        teamLeaderId:team_leader_id, teamLeaderName:team_leader_name,
                        clientName:client_name, status, walletAmount:wallet_amount,
                        createdAt:created_at, updatedAt:updated_at,
                        inactivatedAt:inactivated_at, lastStatusChangeAt:last_status_change_at,
                        allotmentDate:allotment_date, chassisNumber:chassis_number
                    `, { column: 'team_leader_id', value: tlIds, type: 'in' });

                if (riderError) throw riderError;
                setRiders((riderData as unknown as Rider[]) || []);

                // 3. Fetch Leads created by these TLs
                const { data: leadDataRaw, error: leadError } = await fetchTablePaginated('leads', `
                        id, leadId:lead_id, riderName:rider_name, mobileNumber:mobile_number,
                        city, status, score, category, source, createdAt:created_at,
                        drivingLicense:driving_license, clientInterested:client_interested,
                        location, createdBy:created_by, createdByName:created_by_name, remarks
                    `, [
                        { column: 'created_by', operator: 'in', value: tlIds }
                    ]);

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const leadData = leadDataRaw ? [...leadDataRaw].sort((a: any, b: any) => b.id - a.id) : [];

                if (leadError) throw leadError;
                setLeads((leadData as Lead[]) || []);

            } catch (err: any) {
                console.error('RM Team Data fetch error:', err);
                setError(err.message || 'Failed to load team data');
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        // Real-time subscriptions
        const channel = supabase
            .channel('rm-team-sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
                fetchData();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'riders' }, () => {
                fetchData();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
                fetchData();
            })
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, [rmName, refreshKey]);

    const teamLeaderIds = useMemo(() => teamLeaders.map(tl => tl.id), [teamLeaders]);

    return {
        teamLeaders,
        riders,
        leads,
        teamLeaderIds,
        loading,
        error,
        refresh: () => setRefreshKey(k => k + 1)
    };
}
