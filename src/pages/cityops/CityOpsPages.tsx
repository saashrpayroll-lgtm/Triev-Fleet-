/**
 * City Ops placeholder page - will be connected to scoped data in next phase.
 * Pattern: Each City Ops page wraps an Admin-equivalent component with scope filtering.
 */
import React from 'react';
import GlassCard from '@/components/GlassCard';
import { useCityOpsScope } from '@/hooks/useCityOpsScope';
import { Construction } from 'lucide-react';
import AdminLeads from '../admin/AdminLeads';
import RiderManagement from '../admin/RiderManagement';

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

export const CityOpsDataManagement: React.FC = () => (
    <ScopedPageShell title="Data Hub" description="Bulk imports, wallet updates, and rent collection" />
);

export const CityOpsWalletHistory: React.FC = () => (
    <ScopedPageShell title="Wallet Logs" description="Complete wallet ledger for your riders" />
);

export const CityOpsRMPerformance: React.FC = () => (
    <ScopedPageShell title="RM Performance" description="Performance metrics for your Reporting Managers" />
);

export const CityOpsTLPerformance: React.FC = () => (
    <ScopedPageShell title="TL Performance" description="Performance metrics for your Team Leaders" />
);

export const CityOpsTLAllotment: React.FC = () => (
    <ScopedPageShell title="Allotment System" description="Rider allotment tracking for your team" />
);

export const CityOpsLeaderboard: React.FC = () => (
    <ScopedPageShell title="Leaderboard" description="Team rankings and competition" />
);

export const CityOpsReports: React.FC = () => (
    <ScopedPageShell title="Reports" description="Generate and export reports for your team" />
);

export const CityOpsActivityLog: React.FC = () => (
    <ScopedPageShell title="Activity Logs" description="Track all actions performed in your panel" />
);

export const CityOpsAnalytics: React.FC = () => (
    <ScopedPageShell title="Analytics" description="Advanced analytics and insights for your team" />
);

export const CityOpsForms: React.FC = () => (
    <ScopedPageShell title="Company Forms" description="Standardized forms for your operations" />
);

export const CityOpsStaffRoles: React.FC = () => (
    <ScopedPageShell title="Staff & Roles" description="Create and manage RMs and TLs under your team" />
);

export const CityOpsNotifications: React.FC = () => (
    <ScopedPageShell title="Notifications" description="Your notifications and alerts" />
);

export const CityOpsProfile: React.FC = () => (
    <ScopedPageShell title="My Profile" description="View and edit your profile information" />
);
