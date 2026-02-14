import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/config/supabase';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import {
    Users, UserCheck, Wallet, Inbox, UserPlus, Sparkles, Filter, TrendingUp, TrendingDown, AlertTriangle, Coins, Activity, Smartphone
} from 'lucide-react';
import { Rider, User, Lead, Request } from '@/types';
import Leaderboard from '@/components/Leaderboard';

import SmartMetricCard from '@/components/dashboard/SmartMetricCard';
import DashboardCharts from '@/components/dashboard/DashboardCharts';
import RecentActivity from '@/components/dashboard/RecentActivity';
import TodaysCollectionCard from '@/components/dashboard/TodaysCollectionCard';
import WeeklyCollectionChart from '@/components/dashboard/WeeklyCollectionChart';
import TeamLeaderPerformanceTable, { TLSnapshot } from '@/components/dashboard/TeamLeaderPerformanceTable';
import { startOfWeek, startOfMonth } from 'date-fns';
import { sanitizeArray } from '@/utils/sanitizeData';

type DateFilter = 'all' | 'month' | 'week';

const Dashboard: React.FC = () => {
    const { userData } = useSupabaseAuth();
    const navigate = useNavigate();
    const [dateFilter, setDateFilter] = useState<DateFilter>('month');
    const [loading, setLoading] = useState(true);


    // Raw Data State
    const [rawData, setRawData] = useState({
        riders: [] as Rider[],
        leads: [] as Lead[],
        requests: [] as Request[],
        teamLeaders: [] as User[]
    });
    const [tlCollections, setTlCollections] = useState<Record<string, number>>({});

    // --- Data Fetching ---
    // --- Data Fetching & Real-time ---
    const fetchDashboardData = React.useCallback(async (isInitial = false) => {
        if (!userData) return;
        if (isInitial) setLoading(true);

        try {
            const [ridersRes, leadsRes, requestsRes, usersRes, dailyRes] = await Promise.all([
                supabase.from('riders').select(`
                    id,
                    trievId:triev_id,
                    riderName:rider_name,
                    mobileNumber:mobile_number,
                    chassisNumber:chassis_number,
                    clientName:client_name,
                    walletAmount:wallet_amount,
                    allotmentDate:allotment_date,
                    status,
                    teamLeaderId:team_leader_id,
                    createdAt:created_at
                `),
                supabase.from('leads').select(`
                    id,
                    leadId:lead_id,
                    riderName:rider_name,
                    status,
                    createdBy:created_by,
                    createdAt:created_at
                `),
                supabase.from('requests').select(`
                    id,
                    status,
                    createdAt:created_at
                `),
                supabase.from('users').select(`
                    id,
                    fullName:full_name,
                    email,
                    status,
                    role
                `).eq('role', 'teamLeader'),
                supabase.from('daily_collections').select('team_leader_id, total_collection')
            ]);

            // Note: Removed wallet_transactions fetch to avoid double counting. 
            // daily_collections now authoritative source.

            if (ridersRes.error) throw ridersRes.error;

            // Process Collections
            const collections: Record<string, number> = {};

            // 1. Add Historical Data
            const dailyData = dailyRes.data || [];
            dailyData.forEach((d: any) => {
                const tlId = d.team_leader_id;
                const amt = Number(d.total_collection) || 0;
                collections[tlId] = (collections[tlId] || 0) + amt;
            });

            // 2. Add Recent Transactions (Today) - REMOVED
            // logic is now handled by DB Trigger updating daily_collections automatically.
            setTlCollections(collections);

            setRawData({
                riders: ridersRes.data as Rider[] || [],
                leads: leadsRes.data as Lead[] || [],
                requests: requestsRes.data as Request[] || [],
                teamLeaders: sanitizeArray(usersRes.data as User[] || [])
            });
        } catch (error) {
            console.error('Data Load Error:', error);
        } finally {
            if (isInitial) setLoading(false);
        }
    }, [userData]);

    useEffect(() => {
        fetchDashboardData(true);

        const channel = supabase
            .channel('dashboard-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'riders' }, () => {
                fetchDashboardData();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
                fetchDashboardData();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => {
                fetchDashboardData();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
                fetchDashboardData();
            })
            // Real-time Collections Update
            // Real-time Collections Update via daily_collections table
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'daily_collections' },
                () => {
                    // Refresh dashboard when collection totals change
                    fetchDashboardData();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchDashboardData]);


    // --- Filtering Logic (Date & Role) ---
    const filteredData = useMemo(() => {
        let { riders, leads, requests, teamLeaders } = rawData;
        const now = new Date();
        const filterDate = dateFilter === 'week' ? startOfWeek(now) :
            dateFilter === 'month' ? startOfMonth(now) : null;

        // 1. Role-Based Filtering
        if (userData?.role === 'teamLeader') {
            // const tlId = userData.id;
            // Filter riders assigned to this TL
            // Note: Assuming 'team_leader_id' or similar exists, otherwise showing all for now or empty
            // In a real scenario, we'd filter by riders where team_leader_id == tlId
            // riders = riders.filter(r => r.team_leader_id === tlId);
        }

        // 2. Date Filtering (Applied to CreatedAt fields)
        if (filterDate) {
            // riders = riders.filter(r => new Date(r.created_at) >= filterDate);
            leads = leads.filter(l => new Date(l.createdAt) >= filterDate);
            requests = requests.filter(r => new Date(r.createdAt) >= filterDate);
        }

        return { riders, leads, requests, teamLeaders };
    }, [rawData, dateFilter, userData]);


    // --- Derived Statistics ---
    const stats = useMemo(() => {
        const { riders, leads, requests, teamLeaders } = filteredData;

        // Wallet Calcs
        const totalWallet = riders.reduce((sum, r) => sum + r.walletAmount, 0);
        const positiveWalletData = riders.filter(r => r.walletAmount > 0);
        const negativeWalletData = riders.filter(r => r.walletAmount < 0);
        const zeroWalletData = riders.filter(r => r.walletAmount === 0);

        const positiveSum = positiveWalletData.reduce((sum, r) => sum + r.walletAmount, 0);
        const negativeSum = negativeWalletData.reduce((sum, r) => sum + r.walletAmount, 0);
        const avgWallet = riders.length > 0 ? Math.round(totalWallet / riders.length) : 0;

        // Critical Monitors
        const highDebtRiders = negativeWalletData.filter(r => r.walletAmount < -3000);
        const criticalRequests = requests.filter(r => r.priority === 'high');

        return {
            // Riders
            totalRiders: riders.length,
            activeRiders: riders.filter(r => r.status === 'active').length,
            inactiveRiders: riders.filter(r => r.status === 'inactive').length,
            deletedRiders: riders.filter(r => r.status === 'deleted').length,

            // Wallet Counts
            positiveWalletCount: positiveWalletData.length,
            negativeWalletCount: negativeWalletData.length,
            zeroWalletCount: zeroWalletData.length,
            highDebtCount: highDebtRiders.length,

            // Finance Amounts
            totalCollection: positiveSum,
            outstandingDues: Math.abs(negativeSum),
            netBalance: totalWallet,
            avgBalance: avgWallet,

            // Leads
            totalLeads: leads.length,
            convertedLeads: leads.filter(l => l.status === 'Convert').length,
            newLeadsToday: leads.filter(l => new Date(l.createdAt).toDateString() === new Date().toDateString()).length,
            conversionRate: leads.length > 0 ? Math.round((leads.filter(l => l.status === 'Convert').length / leads.length) * 100) : 0,

            // Requests
            pendingRequests: requests.filter(r => r.status === 'pending').length,
            resolvedRequests: requests.filter(r => r.status === 'resolved').length,
            criticalRequests: criticalRequests.length,

            // TL Stats (Admin Only)
            totalTLs: teamLeaders.length,
            activeTLs: teamLeaders.filter(u => u.status === 'active').length
        };
    }, [filteredData]);

    // --- Chart Data ---
    const chartData = useMemo(() => {
        const { riders } = filteredData;

        return {
            riders: [
                { name: 'Active', value: riders.filter(r => r.status === 'active').length, color: '#10b981' },
                { name: 'Inactive', value: riders.filter(r => r.status === 'inactive').length, color: '#f59e0b' },
                { name: 'Deleted', value: riders.filter(r => r.status === 'deleted').length, color: '#f43f5e' }
            ],
            wallet: [
                { name: 'Collections', value: stats.totalCollection },
                { name: 'Risk / Dues', value: stats.outstandingDues }
            ],
            leads: [
                { name: 'Converted', value: stats.convertedLeads, color: '#84cc16' },
                { name: 'Pipeline', value: stats.totalLeads - stats.convertedLeads, color: '#94a3b8' }
            ]
        };
    }, [filteredData, stats]);

    // --- TL Performance Stats ---
    const tlStats: TLSnapshot[] = useMemo(() => {
        const { teamLeaders, riders, leads } = rawData;

        return teamLeaders.map(tl => {
            const tlRiders = riders.filter(r => r.teamLeaderId === tl.id || (r as any).team_leader_id === tl.id);
            const tlLeads = leads.filter(l => l.createdBy === tl.id || (l as any).created_by === tl.id);

            const activeRiders = tlRiders.filter(r => r.status === 'active').length;

            const wallet = tlRiders.reduce((acc, r) => ({
                total: acc.total + r.walletAmount,
                positiveCount: acc.positiveCount + (r.walletAmount > 0 ? 1 : 0),
                negativeCount: acc.negativeCount + (r.walletAmount < 0 ? 1 : 0),
                negativeAmount: acc.negativeAmount + (r.walletAmount < 0 ? r.walletAmount : 0)
            }), { total: 0, positiveCount: 0, negativeCount: 0, negativeAmount: 0 });

            const converted = tlLeads.filter(l => l.status === 'Convert').length;
            const conversionRate = tlLeads.length > 0 ? Math.round((converted / tlLeads.length) * 100) : 0;

            return {
                id: tl.id,
                name: tl.fullName || 'Unknown',
                email: tl.email,
                totalRiders: tlRiders.length,
                activeRiders,
                wallet,
                leads: {
                    total: tlLeads.length,
                    converted,
                    conversionRate
                },
                status: tl.status,
                totalCollection: tlCollections[tl.id] || 0
            };
        });
    }, [rawData, tlCollections]);

    // --- Render Loading ---
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[600px]">
                <div className="text-center space-y-4">
                    <div className="relative w-16 h-16 mx-auto">
                        <div className="absolute inset-0 border-4 border-indigo-200 rounded-full animate-ping opacity-25"></div>
                        <div className="absolute inset-0 border-4 border-t-indigo-600 border-r-indigo-600 border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                    </div>
                    <p className="text-muted-foreground font-medium animate-pulse">Initializing Premium Command Center...</p>
                </div>
            </div>
        );
    }

    const isTL = userData?.role === 'teamLeader';

    return (
        <div className="space-y-3 pb-6">
            {/* Header Section */}
            <div className="space-y-2">


                <div className="flex flex-col md:flex-row gap-3 justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-extrabold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-1 animate-in slide-in-from-left duration-500">
                            {isTL ? "Team Command Center" : "Admin Command Center"}
                        </h1>

                    </div>

                    {/* Date Filters */}
                    <div className="flex items-center gap-2 bg-muted/40 p-1 rounded-lg border">
                        <Filter size={14} className="text-muted-foreground ml-2" />
                        <span className="w-px h-3 bg-border mx-1"></span>
                        {(['all', 'month', 'week'] as DateFilter[]).map((filter) => (
                            <button
                                key={filter}
                                onClick={() => setDateFilter(filter)}
                                className={`
                                    px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all
                                    ${dateFilter === filter
                                        ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5 dark:bg-zinc-800 dark:text-indigo-400'
                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                    }
                                `}
                            >
                                {filter === 'all' ? 'All Time' : filter === 'month' ? 'This Month' : 'This Week'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* BENTO GRID: 12+ Smart Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 animate-in slide-in-from-bottom duration-700 delay-100 font-jakarta">

                {/* --- ROW 1: MISSION CRITICAL --- */}
                <SmartMetricCard
                    title="System Health"
                    value={`${stats.activeRiders}/${stats.totalRiders}`}
                    icon={Activity}
                    color="emerald"
                    trend={{ value: 94, label: 'uptime', direction: 'up' }}
                    subtitle="Active Riders Ratio"
                    className="shadow-emerald-500/10"
                    onClick={() => navigate('/portal/riders', { state: { filter: 'active' } })}
                />

                <SmartMetricCard
                    title="Total Collections"
                    value={stats.totalCollection}
                    icon={Wallet}
                    color="indigo"
                    trend={{ value: 12, label: 'revenue', direction: 'up' }}
                    subtitle={`${stats.positiveWalletCount} Positive Wallets`}
                    onClick={() => navigate('/portal/data', { state: { tab: 'import' } })}
                />

                <TodaysCollectionCard />

                <SmartMetricCard
                    title="Outstanding Risk"
                    value={stats.outstandingDues}
                    icon={AlertTriangle}
                    color="rose"
                    aiInsight={stats.highDebtCount > 0 ? `${stats.highDebtCount} riders need immediate collection.` : undefined}
                    subtitle={`${stats.negativeWalletCount} Negative Wallets`}
                    onClick={() => navigate('/portal/riders', { state: { filter: 'negative_wallet' } })}
                />

                <SmartMetricCard
                    title="Growth Engine"
                    value={`${stats.conversionRate}%`}
                    icon={UserPlus}
                    color="fuchsia"
                    trend={{ value: 5, label: 'velocity', direction: 'up' }}
                    subtitle={`${stats.newLeadsToday} New Leads Today`}
                    onClick={() => navigate('/portal/leads')}
                />

                {/* --- ROW 2: WALLET GRANULARITY --- */}
                <SmartMetricCard
                    title="Zero Balance"
                    value={stats.zeroWalletCount}
                    icon={Coins}
                    color="amber"
                    subtitle="Dormant Wallets"
                    onClick={() => navigate('/portal/riders', { state: { filter: 'zero_balance' } })}
                />

                <SmartMetricCard
                    title="Highly Indebted"
                    value={stats.highDebtCount}
                    icon={TrendingDown}
                    color="red"
                    className={stats.highDebtCount > 5 ? 'animate-pulse ring-2 ring-red-500/50' : ''}
                    subtitle="Debt > ₹3000"
                    onClick={() => navigate('/portal/riders', { state: { filter: 'high_debt' } })}
                />

                <SmartMetricCard
                    title="Avg Wallet"
                    value={stats.avgBalance}
                    icon={TrendingUp}
                    color="cyan"
                    subtitle="Mean Fleet Balance"
                    onClick={() => navigate('/portal/riders')}
                />

                <SmartMetricCard
                    title="Net Liquidity"
                    value={stats.netBalance}
                    icon={Smartphone}
                    color="violet"
                    subtitle="Total System Value"
                    onClick={() => navigate('/portal/riders')}
                />

                {/* --- ROW 3: OPS & TEAM --- */}
                <SmartMetricCard
                    title="Pending Ops"
                    value={stats.pendingRequests}
                    icon={Inbox}
                    color="blue"
                    aiInsight={stats.criticalRequests > 0 ? `${stats.criticalRequests} critical tickets open.` : undefined}
                    subtitle={`${stats.criticalRequests} High Priority`}
                    onClick={() => navigate('/portal/requests')}
                />

                <SmartMetricCard
                    title="Team Strength"
                    value={stats.totalTLs}
                    icon={Users}
                    color="orange"
                    subtitle={`${stats.activeTLs} Active Leaders`}
                    onClick={() => navigate('/portal/users', { state: { filter: 'teamLeader' } })}
                />

                <SmartMetricCard
                    title="Conversion"
                    value={stats.convertedLeads}
                    icon={Sparkles}
                    color="lime"
                    subtitle="Last 30 Days"
                    onClick={() => navigate('/portal/leads', { state: { filter: 'Convert' } })}
                />

                <SmartMetricCard
                    title="Churn Monitor"
                    value={stats.inactiveRiders}
                    icon={UserCheck}
                    color="slate"
                    subtitle={`${stats.deletedRiders} Permanently Deleted`}
                    onClick={() => navigate('/portal/riders', { state: { filter: 'inactive' } })}
                />

            </div>

            {/* Charts & Activity Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 animate-in slide-in-from-bottom duration-700 delay-300">
                {/* Charts Area (2/3 width) */}
                <div className="lg:col-span-2">
                    <DashboardCharts
                        riderData={chartData.riders}
                        walletData={chartData.wallet.filter(d => d.value !== 0)}
                        leadData={chartData.leads}
                    />
                </div>

                {/* Activity Feed (1/3 width) */}
                <div className="lg:col-span-1 h-[650px] flex flex-col gap-2">
                    <div className="h-[300px]">
                        <WeeklyCollectionChart />
                    </div>
                    <div className="flex-grow">
                        <RecentActivity />
                    </div>
                </div>
            </div>

            {/* TL Performance Table (Admin Only) */}
            {!isTL && (
                <div className="animate-in slide-in-from-bottom duration-700 delay-400">
                    <TeamLeaderPerformanceTable data={tlStats} />
                </div>
            )}

            {/* Leaderboard Section */}
            <div className="animate-in slide-in-from-bottom duration-700 delay-500">
                <Leaderboard
                    teamLeaders={rawData.teamLeaders}
                    riders={rawData.riders}
                    leads={rawData.leads}
                    collections={tlCollections}
                    action={
                        <button
                            onClick={() => navigate('/portal/leaderboard')}
                            className="text-[10px] text-muted-foreground hover:text-primary transition-colors font-medium flex items-center gap-1 bg-muted/30 px-2.5 py-1 rounded-full border border-transparent hover:border-primary/20"
                        >
                            View Full Leaderboard
                        </button>
                    }
                />
            </div>
        </div>
    );
};

export default Dashboard;
