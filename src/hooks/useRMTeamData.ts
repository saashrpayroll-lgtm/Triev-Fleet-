import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/config/supabase';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
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
                const { data: tlData, error: tlError } = await supabase
                    .from('users')
                    .select(`
                        id, userId:user_id, fullName:full_name, email, mobile, role, status,
                        username, jobLocation:job_location, reportingManager:reporting_manager,
                        permissions, remarks, profilePicUrl:profile_pic_url,
                        suspendedUntil:suspended_until, createdAt:created_at, updatedAt:updated_at,
                        position, monthlyTarget:monthly_target, awardedBadges:awarded_badges
                    `)
                    .ilike('reporting_manager', `%${rmName.trim()}%`)
                    .eq('role', 'teamLeader');

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
                const { data: riderData, error: riderError } = await supabase
                    .from('riders')
                    .select(`
                        id, trievId:triev_id, riderName:rider_name, mobileNumber:mobile_number,
                        teamLeaderId:team_leader_id, teamLeaderName:team_leader_name,
                        clientName:client_name, status, walletAmount:wallet_amount,
                        chassisNumber:chassis_number, vehicleType:vehicle_type,
                        createdAt:created_at, updatedAt:updated_at,
                        inactivatedAt:inactivated_at, lastStatusChangeAt:last_status_change_at
                    `)
                    .in('team_leader_id', tlIds);

                if (riderError) throw riderError;
                setRiders((riderData as unknown as Rider[]) || []);

                // 3. Fetch Leads created by these TLs
                const { data: leadData, error: leadError } = await supabase
                    .from('leads')
                    .select(`
                        id, leadId:lead_id, riderName:rider_name, mobileNumber:mobile_number,
                        city, status, score, category, source, createdAt:created_at,
                        drivingLicense:driving_license, clientInterested:client_interested,
                        location, createdBy:created_by, createdByName:created_by_name, remarks
                    `)
                    .in('created_by', tlIds)
                    .order('id', { ascending: false });

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
