import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/config/supabase';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import {
    Users, UserCheck, Wallet, Inbox, UserPlus, Sparkles, Filter, TrendingUp, AlertTriangle, Coins
} from 'lucide-react';
import { Rider, User, Lead, Request } from '@/types';
import AINewsTicker from '@/components/AINewsTicker';
import Leaderboard from '@/components/Leaderboard';
import { AIService } from '@/services/AIService';
import SmartMetricCard from '@/components/dashboard/SmartMetricCard';
import DashboardCharts from '@/components/dashboard/DashboardCharts';
import RecentActivity from '@/components/dashboard/RecentActivity';
import { startOfWeek, startOfMonth } from 'date-fns';

type DateFilter = 'all' | 'month' | 'week';

const Dashboard: React.FC = () => {
    const { userData } = useSupabaseAuth();
    const navigate = useNavigate();
    const [dateFilter, setDateFilter] = useState<DateFilter>('month');
    const [loading, setLoading] = useState(true);
    const [aiInsight, setAiInsight] = useState<string>('');

    // Raw Data State
    const [rawData, setRawData] = useState({
        riders: [] as Rider[],
        leads: [] as Lead[],
        requests: [] as Request[],
        teamLeaders: [] as User[]
    });

    // --- Data Fetching ---
    // --- Data Fetching & Real-time ---
    const fetchDashboardData = React.useCallback(async (isInitial = false) => {
        if (!userData) return;
        if (isInitial) setLoading(true);

        try {
            const [ridersRes, leadsRes, requestsRes, usersRes] = await Promise.all([
                supabase.from('riders').select('*'),
                supabase.from('leads').select('*'),
                supabase.from('requests').select('*'),
                supabase.from('users').select('*').eq('role', 'teamLeader')
            ]);

            if (ridersRes.error) throw ridersRes.error;

            setRawData({
                riders: ridersRes.data as Rider[] || [],
                leads: leadsRes.data as Lead[] || [],
                requests: requestsRes.data as Request[] || [],
                teamLeaders: usersRes.data as User[] || []
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
                console.log('Rider update detected');
                fetchDashboardData();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
                console.log('Lead update detected');
                fetchDashboardData();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => {
                console.log('Request update detected');
                fetchDashboardData();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
                console.log('User update detected');
                fetchDashboardData();
            })
            .subscribe((status) => {
                console.log('Dashboard Realtime Status:', status);
            });

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
        const positiveWallet = riders.reduce((sum, r) => r.walletAmount > 0 ? sum + r.walletAmount : sum, 0);
        const negativeWallet = riders.reduce((sum, r) => r.walletAmount < 0 ? sum + r.walletAmount : sum, 0);
        const avgWallet = riders.length > 0 ? Math.round(totalWallet / riders.length) : 0;

        return {
            // Riders
            totalRiders: riders.length,
            activeRiders: riders.filter(r => r.status === 'active').length,
            inactiveRiders: riders.filter(r => r.status === 'inactive').length,
            deletedRiders: riders.filter(r => r.status === 'deleted').length,

            // Leads
            totalLeads: leads.length,
            convertedLeads: leads.filter(l => l.status === 'Convert').length,
            conversionRate: leads.length > 0 ? Math.round((leads.filter(l => l.status === 'Convert').length / leads.length) * 100) : 0,

            // Finance
            totalCollection: positiveWallet,
            outstandingDues: Math.abs(negativeWallet),
            netBalance: totalWallet,
            avgBalance: avgWallet,

            // Requests
            pendingRequests: requests.filter(r => r.status === 'pending').length,
            resolvedRequests: requests.filter(r => r.status === 'resolved').length,

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
                { name: 'Dues', value: stats.outstandingDues }
            ],
            leads: [
                { name: 'Converted', value: stats.convertedLeads, color: '#84cc16' },
                { name: 'Pipeline', value: stats.totalLeads - stats.convertedLeads, color: '#94a3b8' }
            ]
        };
    }, [filteredData, stats]);


    // --- AI Insight Generation ---
    useEffect(() => {
        if (!loading && rawData.riders.length > 0) {
            AIService.getDashboardInsights(stats, userData?.role || 'admin').then(setAiInsight);
        }
    }, [loading, dateFilter]);


    // --- Render Loading ---
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[600px]">
                <div className="text-center space-y-4">
                    <div className="relative w-16 h-16 mx-auto">
                        <div className="absolute inset-0 border-4 border-indigo-200 rounded-full animate-ping opacity-25"></div>
                        <div className="absolute inset-0 border-4 border-t-indigo-600 border-r-indigo-600 border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                    </div>
                    <p className="text-muted-foreground font-medium animate-pulse">Initializing Premium Commmand Center...</p>
                </div>
            </div>
        );
    }

    const isTL = userData?.role === 'teamLeader';

    return (
        <div className="space-y-8 pb-10">
            {/* Header Section */}
            <div className="space-y-6">
                <AINewsTicker />

                <div className="flex flex-col md:flex-row gap-6 justify-between items-end">
                    <div>
                        <h1 className="text-4xl font-extrabold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2 animate-in slide-in-from-left duration-500">
                            {isTL ? "Team Command Center" : "Admin Command Center"}
                        </h1>
                        <p className="text-muted-foreground font-medium flex items-center gap-2">
                            <Sparkles size={16} className="text-amber-500" />
                            {aiInsight || "System operating at peak efficiency..."}
                        </p>
                    </div>

                    {/* Date Filters */}
                    <div className="flex items-center gap-2 bg-muted/40 p-1.5 rounded-lg border">
                        <Filter size={16} className="text-muted-foreground ml-2" />
                        <span className="w-px h-4 bg-border mx-1"></span>
                        {(['all', 'month', 'week'] as DateFilter[]).map((filter) => (
                            <button
                                key={filter}
                                onClick={() => setDateFilter(filter)}
                                className={`
                                    px-3 py-1.5 rounded-md text-xs font-semibold transition-all
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

            {/* BENTO GRID: 8+ Smart Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 animate-in slide-in-from-bottom duration-700 delay-100">

                {/* --- ROW 1: CORE STATS --- */}
                {/* 1. Active Riders (Hero Card) */}
                <SmartMetricCard
                    title="Active Riders"
                    value={stats.activeRiders}
                    icon={UserCheck}
                    color="emerald"
                    trend={{ value: 5, label: 'growth', direction: 'up' }}
                    subtitle={`${stats.totalRiders} Total / ${stats.inactiveRiders} Inactive`}
                    onClick={() => navigate('/admin/riders?filter=active')}
                    className="md:col-span-2 lg:col-span-1 shadow-emerald-500/10"
                />

                {/* 2. Total Collections */}
                <SmartMetricCard
                    title="Total Collections"
                    value={`₹${(stats.totalCollection / 100000).toFixed(2)}L`}
                    icon={Wallet}
                    color="indigo"
                    trend={{ value: 12, label: 'revenue', direction: 'up' }}
                    subtitle="Positive Wallet Balance"
                    onClick={() => navigate('/admin/riders?filter=all')}
                />

                {/* 3. Outstanding Dues */}
                <SmartMetricCard
                    title="Outstanding Dues"
                    value={`₹${(stats.outstandingDues / 1000).toFixed(1)}k`}
                    icon={AlertTriangle}
                    color="rose"
                    trend={{ value: 8, label: 'risk', direction: 'down' }}
                    subtitle="Negative Wallet Balance"
                    onClick={() => navigate('/admin/riders?filter=all')}
                />

                {/* 4. Lead Efficiency */}
                <SmartMetricCard
                    title="Lead Conversion"
                    value={`${stats.conversionRate}%`}
                    icon={UserPlus}
                    color="purple"
                    trend={{ value: 2, label: 'rate', direction: stats.conversionRate > 20 ? 'up' : 'neutral' }}
                    subtitle={`${stats.convertedLeads} Converted Today`}
                    onClick={() => navigate('/admin/leads?status=Convert')}
                />

                {/* --- ROW 2: GRANULAR STATS --- */}

                {/* 5. Net Profit/Balance (Tall Card/Wide) */}
                <SmartMetricCard
                    title="Net Float"
                    value={`₹${(stats.netBalance / 1000).toFixed(2)}k`}
                    icon={Coins}
                    color="amber"
                    subtitle="Collections - Dues"
                    className="lg:col-span-1"
                    onClick={() => navigate('/admin/riders')}
                />

                {/* 6. Inactive/Deleted Riders */}
                <SmartMetricCard
                    title="Churn Monitors"
                    value={stats.inactiveRiders + stats.deletedRiders}
                    icon={Users}
                    color="orange"
                    subtitle={`${stats.deletedRiders} Deleted / ${stats.inactiveRiders} Inactive`}
                    onClick={() => navigate('/admin/riders?filter=inactive')}
                />

                {/* 7. Pending Requests */}
                <SmartMetricCard
                    title="Pending Ops"
                    value={stats.pendingRequests}
                    icon={Inbox}
                    color="blue"
                    subtitle="Unresolved Tickets"
                    onClick={() => navigate('/admin/requests')}
                />

                {/* 8. Avg Wallet Balance */}
                <SmartMetricCard
                    title="Avg Rider Wallet"
                    value={`₹${stats.avgBalance}`}
                    icon={TrendingUp}
                    color="cyan"
                    subtitle="Per Active Rider"
                    onClick={() => navigate('/admin/riders')}
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
                <div className="lg:col-span-1 h-[650px]">
                    <RecentActivity />
                </div>
            </div>

            {/* Leaderboard Section */}
            <div className="animate-in slide-in-from-bottom duration-700 delay-500">
                <Leaderboard
                    teamLeaders={rawData.teamLeaders}
                    riders={rawData.riders}
                    leads={rawData.leads}
                    action={
                        <button
                            onClick={() => navigate('/admin/leaderboard')}
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
