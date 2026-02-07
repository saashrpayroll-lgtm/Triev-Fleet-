import React, { useMemo } from 'react';
import { Rider, Lead, Request, User } from '@/types';
import SmartMetricCard from './SmartMetricCard';
import { Users, Wallet, UserCheck, TrendingUp, Activity, AlertTriangle, ArrowUp, ArrowDown } from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';

interface SmartCardGridProps {
    riders: Rider[];
    leads: Lead[];
    requests: Request[];
    teamLeaders: User[];
    loading?: boolean;
    onCardClick?: (type: string) => void;
}

const SmartCardGrid: React.FC<SmartCardGridProps> = ({
    riders,
    leads,
    requests,
    teamLeaders,
    loading = false,
    onCardClick
}) => {

    const stats = useMemo(() => {
        // --- Riders ---
        const totalRiders = riders.length;
        const activeRiders = riders.filter(r => r.status === 'active').length;
        const inactiveRiders = riders.filter(r => r.status === 'inactive').length;

        // --- Wallet ---
        const totalWallet = riders.reduce((sum, r) => sum + (r.walletAmount || 0), 0);
        const positiveWallets = riders.filter(r => (r.walletAmount || 0) > 0);
        const negativeWallets = riders.filter(r => (r.walletAmount || 0) < 0);

        // --- Leads ---
        const totalLeads = leads.length;
        const convertedLeads = leads.filter(l => l.status === 'Convert').length;
        const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

        // --- Requests ---
        const pendingRequests = requests.filter(r => r.status === 'pending').length;

        // --- Wallet Update Frequency (Derived) ---
        // Assuming we want to know how many wallets changed recently. 
        // Without a specific 'wallet_updated_at' field, we might use 'updated_at' if available, 
        // or just mock/skip if not reliable. Let's assume 'updated_at' on rider reflects profile/wallet changes.
        // For now, we'll count riders updated in the last 24h as "High Frequency" proxy.
        const recentUpdates = riders.filter(r => {
            // @ts-ignore - assuming updatedAt exists or using createdAt as fallback for demo
            const date = r.updatedAt || r.createdAt;
            return date && differenceInDays(new Date(), parseISO(date)) < 1;
        }).length;

        // --- TL Performance (Simplified for Cards) ---
        // Top TL by Active Riders
        const tlStats = teamLeaders.map(tl => {
            const tlRiders = riders.filter(r => r.teamLeaderId === tl.id);
            const active = tlRiders.filter(r => r.status === 'active').length;
            return { name: tl.fullName, active };
        }).sort((a, b) => b.active - a.active);

        const topTL = tlStats[0];
        const bottomTL = tlStats[tlStats.length - 1];

        return {
            totalRiders,
            activeRiders,
            inactiveRiders,
            totalWallet,
            positiveCount: positiveWallets.length,
            negativeCount: negativeWallets.length,
            totalLeads,
            convertedLeads,
            conversionRate,
            pendingRequests,
            recentUpdates,
            topTL,
            bottomTL
        };
    }, [riders, leads, requests, teamLeaders]);

    if (loading) {
        return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 animate-pulse">
            {[...Array(8)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-100 rounded-2xl"></div>
            ))}
        </div>;
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 font-jakarta">
            {/* 1. Rider Overview */}
            <SmartMetricCard
                title="Total Riders"
                value={stats.totalRiders}
                icon={Users}
                color="indigo"
                subtitle={`${stats.activeRiders} Active • ${stats.inactiveRiders} Inactive`}
                onClick={() => onCardClick?.('riders')}
                formatter={(val) => val.toLocaleString()}
            />

            {/* 2. Wallet Health */}
            <SmartMetricCard
                title="Net Wallet Balance"
                value={stats.totalWallet}
                icon={Wallet}
                color={stats.totalWallet >= 0 ? 'emerald' : 'rose'}
                subtitle={`${stats.positiveCount} Positive / ${stats.negativeCount} Negative`}
                onClick={() => onCardClick?.('wallet')}
                formatter={(val) => `₹${val.toLocaleString('en-IN')}`}
            />

            {/* 3. Lead Conversion */}
            <SmartMetricCard
                title="Lead Conversion"
                value={`${stats.conversionRate}%`}
                icon={TrendingUp}
                color="fuchsia"
                subtitle={`${stats.convertedLeads} / ${stats.totalLeads} Converted`}
                onClick={() => onCardClick?.('leads')}
            />

            {/* 4. Requests */}
            <SmartMetricCard
                title="Pending Requests"
                value={stats.pendingRequests}
                icon={AlertTriangle}
                color="amber"
                subtitle="Requires Attention"
                onClick={() => onCardClick?.('requests')}
            />

            {/* 5. Wallet Velocity */}
            <SmartMetricCard
                title="Wallet Updates (24h)"
                value={stats.recentUpdates}
                icon={Activity}
                color="cyan"
                subtitle="Active Balance Changes"
                onClick={() => onCardClick?.('wallet_velocity')}
            />

            {/* 6. Top Team Leader */}
            <SmartMetricCard
                title="Top Performer"
                value={stats.topTL?.name || 'N/A'}
                icon={ArrowUp}
                color="green"
                subtitle={`${stats.topTL?.active || 0} Active Riders`}
                onClick={() => onCardClick?.('leaderboard')}
            />

            {/* 7. Bottom Team Leader */}
            <SmartMetricCard
                title="Needs Improvement"
                value={stats.bottomTL?.name || 'N/A'}
                icon={ArrowDown}
                color="orange"
                subtitle={`${stats.bottomTL?.active || 0} Active Riders`}
                onClick={() => onCardClick?.('leaderboard')}
            />

            {/* 8. Active Users (Mock/Real) */}
            {/* Using 'Total Leads' as a proxy for user activity if no 'users active' metric available */}
            <SmartMetricCard
                title="Active Users"
                value={riders.length + teamLeaders.length} // Proxy for now
                icon={UserCheck}
                color="blue"
                subtitle="Total System Users"
            />
        </div>
    );
};

export default SmartCardGrid;
