import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/config/supabase';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { format } from 'date-fns';
import {
    Inbox, UserPlus, Smartphone, UserCheck
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

    // --- Data Fetching & Real-time ---
    const fetchDashboardData = React.useCallback(async (isInitial = false) => {
        if (!userData) return;
        if (isInitial) setLoading(true);

        try {
            const [ridersRes, leadsRes, requestsRes, usersRes, logsRes, dailyRes] = await Promise.all([
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
                supabase.from('wallet_transactions')
                    .select('amount, team_leader_id')
                    .eq('type', 'credit')
                    .gte('timestamp', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()), // Fetch TODAY's transactions
                supabase.from('daily_collections').select('team_leader_id, total_collection')
            ]);

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

            // 2. Add Recent Transactions (Today)
            const todayTxns = logsRes.data || [];
            todayTxns.forEach((txn: any) => {
                const tlId = txn.team_leader_id;
                const amt = Number(txn.amount) || 0;
                if (tlId) {
                    collections[tlId] = (collections[tlId] || 0) + amt;
                }
            });
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
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'wallet_transactions', filter: 'type=eq.credit' },
                (payload) => {
                    const newTxn = payload.new as any;
                    // Check if it's today's transaction (though INSERT implies new)
                    // Update state optimistically
                    if (newTxn.team_leader_id) {
                        setTlCollections(prev => ({
                            ...prev,
                            [newTxn.team_leader_id]: (prev[newTxn.team_leader_id] || 0) + Number(newTxn.amount)
                        }));
                    }
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
        <div className="space-y-8 pb-10">

            <div className="flex flex-col md:flex-row justify-between items-end gap-4 pb-2 border-b border-border/40">
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-violet-600 bg-clip-text text-transparent">
                        Admin Dashboard
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1 font-medium flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                        {format(new Date(), 'EEEE, MMMM do, yyyy')}
                    </p>
                </div>
                <div className="flex gap-2">
                    {/* Date Filters - Compact */}
                    <div className="flex bg-muted/50 p-1 rounded-lg">
                        <button
                            onClick={() => setDateFilter('week')}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${dateFilter === 'week' ? 'bg-white dark:bg-slate-800 text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            This Week
                        </button>
                        <button
                            onClick={() => setDateFilter('month')}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${dateFilter === 'month' ? 'bg-white dark:bg-slate-800 text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            This Month
                        </button>
                    </div>
                </div>
            </div>

            {/* Metric Cards Grid - Compact Gap */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <SmartMetricCard
                    title="Active Riders"
                    value={stats.activeRiders}
                    icon={Smartphone}
                    trend={{ value: 5, label: 'vs last month', direction: 'up' }}
                    color="blue"
                    onClick={() => navigate('/admin/riders', { state: { status: 'active' } })}
                    compact
                />
                <SmartMetricCard
                    title="Total Leads"
                    value={stats.totalLeads}
                    icon={UserPlus}
                    trend={{ value: stats.conversionRate, label: 'conv. rate', direction: 'up' }}
                    color="purple"
                    onClick={() => navigate('/admin/leads')}
                    compact
                />
                <TodaysCollectionCard compact />
                <SmartMetricCard
                    title="Pending Requests"
                    value={stats.pendingRequests}
                    icon={Inbox}
                    trend={stats.criticalRequests > 0 ? { value: stats.criticalRequests, label: 'critical', direction: 'down' } : undefined}
                    color="orange"
                    compact
                />
                <SmartMetricCard
                    title="Churn Monitor"
                    value={stats.inactiveRiders}
                    icon={UserCheck}
                    color="slate"
                    subtitle={`${stats.deletedRiders} Permanently Deleted`}
                    onClick={() => navigate('/portal/riders', { state: { filter: 'inactive' } })}
                    compact
                />

            </div>

            {/* Charts & Activity Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom duration-700 delay-300">
                {/* Charts Area (2/3 width) */}
                <div className="lg:col-span-2">
                    <DashboardCharts
                        riderData={chartData.riders}
                        walletData={chartData.wallet.filter(d => d.value !== 0)}
                        leadData={chartData.leads}
                    />
                </div>

                {/* Activity Feed (1/3 width) */}
                <div className="lg:col-span-1 h-[650px] flex flex-col gap-6">
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
                            className="text-xs text-muted-foreground hover:text-primary transition-colors font-medium flex items-center gap-1 bg-muted/30 px-3 py-1.5 rounded-full border border-transparent hover:border-primary/20"
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
