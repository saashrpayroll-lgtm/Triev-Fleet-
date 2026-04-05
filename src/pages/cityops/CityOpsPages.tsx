/**
 * City Ops placeholder page - will be connected to scoped data in next phase.
 * Pattern: Each City Ops page wraps an Admin-equivalent component with scope filtering.
 */
import React from 'react';
import GlassCard from '@/components/GlassCard';
import { useCityOpsScope } from '@/hooks/useCityOpsScope';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { Construction } from 'lucide-react';
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

interface ScopedPageProps {
    title: string;
    description: string;
}

const ScopedPageShell: React.FC<ScopedPageProps> = ({ title, description }) => {
    const { cityOpsId, rmIds, tlIds, isLoading } = useCityOpsScope();

    if (isLoading) {
        return (
            <div className="space-y-4 animate-pulse">
                <div className="h-8 bg-muted rounded w-1/3" />
                <div className="h-4 bg-muted rounded w-1/2" />
                <div className="h-64 bg-muted rounded" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">
                    {title}
                </h1>
                <p className="text-muted-foreground mt-1">{description}</p>
            </div>
            <GlassCard className="p-8 text-center">
                <Construction size={48} className="mx-auto text-amber-500 mb-4" />
                <h3 className="text-lg font-bold mb-2">Module Under Construction</h3>
                <p className="text-muted-foreground text-sm max-w-md mx-auto">
                    This module is being connected to your scoped data.
                    Your team: {rmIds.length} RMs, {tlIds.length} TLs.
                </p>
                <p className="text-xs text-muted-foreground mt-3 font-mono">
                    Scope ID: {cityOpsId}
                </p>
            </GlassCard>
        </div>
    );
};

// ── Export all City Ops page stubs ──────────────────────────────────────────

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

export const CityOpsReports: React.FC = () => (
    <ScopedPageShell title="Reports" description="Generate and export reports for your team" />
);

export const CityOpsActivityLog: React.FC = () => (
    <ScopedPageShell title="Activity Logs" description="Track all actions performed in your panel" />
);

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
