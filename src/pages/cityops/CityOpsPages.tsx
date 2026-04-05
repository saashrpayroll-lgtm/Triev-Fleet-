/**
 * City Ops placeholder page - will be connected to scoped data in next phase.
 * Pattern: Each City Ops page wraps an Admin-equivalent component with scope filtering.
 */
import React from 'react';
import { useCityOpsScope } from '@/hooks/useCityOpsScope';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import AdminLeads from '../admin/AdminLeads';
import RiderManagement from '../admin/RiderManagement';
import WalletHistory from '../admin/WalletHistory';
import RMPerformance from '../admin/RMPerformance';
import TLPerformance from '../admin/TLPerformance';
import LeaderboardPage from '../admin/LeaderboardPage';
import Analytics from '../admin/Analytics';
import TLAllotment from '../admin/TLAllotment';
import AdminForms from '../admin/AdminForms';
import Profile from '../admin/Profile';
import AdminNotificationsPage from '../admin/AdminNotificationsPage';
import DataManagement from '../admin/DataManagement';
import UserManagementPage from '../admin/users/index';

import Reports from '../admin/Reports';
import ActivityLog from '../admin/ActivityLog';

// ── Export all City Ops page components ─────────────────────────────────────


export const CityOpsRiderManagement: React.FC = () => {
    const { cityOpsId, isLoading } = useCityOpsScope();
    if (isLoading) return <div className="p-8 text-center animate-pulse">Loading localized scope...</div>;
    return <RiderManagement scopedCityOpsId={cityOpsId} />;
};

export const CityOpsLeads: React.FC = () => {
    const { tlIds, isLoading } = useCityOpsScope();
    if (isLoading) return <div className="p-8 text-center animate-pulse">Loading localized scope...</div>;
    return <AdminLeads scopedTlIds={tlIds} />;
};

export const CityOpsWalletHistory: React.FC = () => {
    const { cityOpsId, isLoading } = useCityOpsScope();
    if (isLoading) return <div className="p-8 text-center animate-pulse">Loading localized scope...</div>;
    return <WalletHistory scopedCityOpsId={cityOpsId} />;
};

export const CityOpsRMPerformance: React.FC = () => {
    const { rmIds, isLoading } = useCityOpsScope();
    if (isLoading) return <div className="p-8 text-center animate-pulse">Loading localized scope...</div>;
    return <RMPerformance scopedRmIds={rmIds} />;
};

export const CityOpsTLPerformance: React.FC = () => {
    const { tlIds, isLoading } = useCityOpsScope();
    if (isLoading) return <div className="p-8 text-center animate-pulse">Loading localized scope...</div>;
    return <TLPerformance scopedTlIds={tlIds} />;
};

export const CityOpsTLAllotment: React.FC = () => {
    const { tlIds, isLoading } = useCityOpsScope();
    if (isLoading) return <div className="p-8 text-center animate-pulse">Loading localized scope...</div>;
    return <TLAllotment scopedTlIds={tlIds} />;
};

export const CityOpsLeaderboard: React.FC = () => {
    const { tlIds, isLoading } = useCityOpsScope();
    if (isLoading) return <div className="p-8 text-center animate-pulse">Loading localized scope...</div>;
    return <LeaderboardPage scopedTlIds={tlIds} />;
};

export const CityOpsDataManagement: React.FC = () => {
    const { user } = useSupabaseAuth();
    if (!user?.id) return null;
    return <DataManagement scopedCityOpsId={user.id} />;
};

export const CityOpsReports: React.FC = () => {
    const { tlIds, isLoading } = useCityOpsScope();
    if (isLoading) return <div className="p-8 text-center animate-pulse">Loading localized scope...</div>;
    return <Reports scopedTlIds={tlIds} />;
};

export const CityOpsActivityLog: React.FC = () => {
    const { rmIds, tlIds, isLoading } = useCityOpsScope();
    const [scopedUserNames, setScopedUserNames] = React.useState<string[]>([]);
    const [namesLoading, setNamesLoading] = React.useState(true);

    React.useEffect(() => {
        if (isLoading) return;
        const fetchNames = async () => {
            try {
                const allIds = [...rmIds, ...tlIds];
                if (allIds.length === 0) { setScopedUserNames([]); setNamesLoading(false); return; }
                const { data } = await import('@/config/supabase').then(m =>
                    m.supabase.from('users').select('full_name').in('id', allIds)
                );
                setScopedUserNames((data || []).map((u: { full_name: string }) => u.full_name).filter(Boolean));
            } catch { /* ignore */ }
            finally { setNamesLoading(false); }
        };
        fetchNames();
    }, [rmIds, tlIds, isLoading]);

    if (isLoading || namesLoading) return <div className="p-8 text-center animate-pulse">Loading localized scope...</div>;
    return <ActivityLog scopedUserNames={scopedUserNames.length > 0 ? scopedUserNames : undefined} />;
};

export const CityOpsAnalytics: React.FC = () => {
    const { cityOpsId, rmIds, tlIds, isLoading } = useCityOpsScope();
    if (isLoading) return <div className="p-8 text-center animate-pulse">Loading localized scope...</div>;
    return <Analytics scopedCityOpsId={cityOpsId} scopedRmIds={rmIds} scopedTlIds={tlIds} />;
};

export const CityOpsForms: React.FC = () => {
    return <AdminForms />;
};

export const CityOpsStaffRoles: React.FC = () => {
    const { cityOpsId, rmIds, tlIds, isLoading } = useCityOpsScope();
    if (isLoading) return <div>Loading Staff...</div>;
    return <UserManagementPage scopedCityOpsId={cityOpsId!} scopedRmIds={rmIds} scopedTlIds={tlIds} />;
};

export const CityOpsNotifications: React.FC = () => {
    return <AdminNotificationsPage />;
};

export const CityOpsProfile: React.FC = () => {
    return <Profile />;
};
