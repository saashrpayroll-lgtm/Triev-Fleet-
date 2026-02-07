import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/config/supabase';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import {
    Users, UserCheck, Wallet, Inbox, UserPlus, Sparkles, Filter, TrendingUp, TrendingDown, AlertTriangle, Coins, Activity, Smartphone, Settings, Layout, X
} from 'lucide-react';
import { Rider, User, Lead, Request } from '@/types';
import Leaderboard from '@/components/Leaderboard';
import { AIService } from '@/services/AIService';
import SmartMetricCard from '@/components/dashboard/SmartMetricCard';
import DashboardCharts from '@/components/dashboard/DashboardCharts';
import RecentActivity from '@/components/dashboard/RecentActivity';
import TLPerformanceAnalytics from '@/components/dashboard/TLPerformanceAnalytics';
import AINewsTicker from '@/components/AINewsTicker';
import { startOfWeek, startOfMonth } from 'date-fns';
import { sanitizeArray } from '@/utils/sanitizeData';

type DateFilter = 'all' | 'month' | 'week';

interface DashboardSections {
    metrics: boolean;
    analytics: boolean;
    charts: boolean;
    activity: boolean;
    leaderboard: boolean;
    aiTicker: boolean;
}

const Dashboard: React.FC = () => {
    const { userData } = useSupabaseAuth();
    const navigate = useNavigate();
    const [dateFilter, setDateFilter] = useState<DateFilter>('month');
    const [loading, setLoading] = useState(true);
    const [aiInsight, setAiInsight] = useState<string>('');

    // Customization State
    const [showCustomizer, setShowCustomizer] = useState(false);
    const [visibleSections, setVisibleSections] = useState<DashboardSections>({
        metrics: true,
        analytics: true,
        charts: true,
        activity: true,
        leaderboard: true,
        aiTicker: true
    });

    // Raw Data State
    const [rawData, setRawData] = useState({
        riders: [] as Rider[],
        leads: [] as Lead[],
        requests: [] as Request[],
        teamLeaders: [] as User[]
    });

    // --- Data Fetching & Real-time ---
    const fetchDashboardData = React.useCallback(async (isInitial = false) => {
        if (!userData) return;
        if (isInitial) setLoading(true);

        try {
            const [ridersRes, leadsRes, requestsRes, usersRes] = await Promise.all([
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
                    createdAt:created_at,
                    priority
                `),
                supabase.from('users').select(`
                    id,
                    fullName:full_name,
                    email,
                    status,
                    role
                `).eq('role', 'teamLeader')
            ]);

            if (ridersRes.error) throw ridersRes.error;

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
            .on('postgres_changes', { event: '*', schema: 'public', table: 'riders' }, () => fetchDashboardData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchDashboardData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => fetchDashboardData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => fetchDashboardData())
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchDashboardData]);


    // --- Filtering Logic ---
    const filteredData = useMemo(() => {
        let { riders, leads, requests, teamLeaders } = rawData;
        const now = new Date();
        const filterDate = dateFilter === 'week' ? startOfWeek(now) :
            dateFilter === 'month' ? startOfMonth(now) : null;

        if (filterDate) {
            leads = leads.filter(l => new Date(l.createdAt) >= filterDate);
            requests = requests.filter(r => new Date(r.createdAt) >= filterDate);
            // Riders typically cumulative, but if we wanted "New Riders" only:
            // riders = riders.filter(r => new Date(r.createdAt) >= filterDate);
        }

        return { riders, leads, requests, teamLeaders };
    }, [rawData, dateFilter]);


    // --- Derived Statistics ---
    const stats = useMemo(() => {
        const { riders, leads, requests, teamLeaders } = filteredData;
        const totalWallet = riders.reduce((sum, r) => sum + r.walletAmount, 0);
        const positiveWalletData = riders.filter(r => r.walletAmount > 0);
        const negativeWalletData = riders.filter(r => r.walletAmount < 0);
        const zeroWalletData = riders.filter(r => r.walletAmount === 0);
        const positiveSum = positiveWalletData.reduce((sum, r) => sum + r.walletAmount, 0);
        const negativeSum = negativeWalletData.reduce((sum, r) => sum + r.walletAmount, 0);
        const avgWallet = riders.length > 0 ? Math.round(totalWallet / riders.length) : 0;
        const highDebtRiders = negativeWalletData.filter(r => r.walletAmount < -3000);
        const criticalReqs = requests.filter(r => r.priority === 'high');

        return {
            totalRiders: riders.length,
            activeRiders: riders.filter(r => r.status === 'active').length,
            inactiveRiders: riders.filter(r => r.status === 'inactive').length,
            deletedRiders: riders.filter(r => r.status === 'deleted').length,
            positiveWalletCount: positiveWalletData.length,
            negativeWalletCount: negativeWalletData.length,
            zeroWalletCount: zeroWalletData.length,
            highDebtCount: highDebtRiders.length,
            totalCollection: positiveSum,
            outstandingDues: Math.abs(negativeSum),
            netBalance: totalWallet,
            avgBalance: avgWallet,
            totalLeads: leads.length,
            convertedLeads: leads.filter(l => l.status === 'Convert').length,
            newLeadsToday: leads.filter(l => new Date(l.createdAt).toDateString() === new Date().toDateString()).length,
            conversionRate: leads.length > 0 ? Math.round((leads.filter(l => l.status === 'Convert').length / leads.length) * 100) : 0,
            pendingRequests: requests.filter(r => r.status === 'pending').length,
            resolvedRequests: requests.filter(r => r.status === 'resolved').length,
            criticalRequests: criticalReqs.length,
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


    // --- AI Insight Generation ---
    useEffect(() => {
        if (!loading && rawData.riders.length > 0) {
            AIService.getDashboardInsights(stats, userData?.role || 'admin').then(setAiInsight);
        }
    }, [loading, dateFilter]); // Reduced dependency churn


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
        <div className="space-y-8 pb-10 relative">
            {/* Customization Modal */}
            {showCustomizer && (
                <div className="fixed inset-0 z-50 flex items-start justify-end p-4 bg-black/20 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-xl shadow-2xl border w-80 mt-16 mr-4 overflow-hidden animate-in slide-in-from-right duration-300">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold flex items-center gap-2"><Layout size={18} /> Customize Layout</h3>
                            <button onClick={() => setShowCustomizer(false)} className="p-1 hover:bg-gray-200 rounded-full"><X size={18} /></button>
                        </div>
                        <div className="p-4 space-y-3">
                            {Object.entries(visibleSections).map(([key, isVisible]) => (
                                <label key={key} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                                    <span className="capitalize font-medium text-gray-700">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                    <input
                                        type="checkbox"
                                        checked={isVisible}
                                        onChange={() => setVisibleSections(prev => ({ ...prev, [key]: !prev[key as keyof DashboardSections] }))}
                                        className="h-5 w-5 accent-indigo-600 rounded"
                                    />
                                </label>
                            ))}
                        </div>
                        <div className="p-3 bg-gray-50 text-xs text-center text-gray-500">
                            Changes are saved for this session.
                        </div>
                    </div>
                </div>
            )}

            {/* Header Section */}
            <div className="space-y-4">
                <div className="flex flex-col md:flex-row gap-6 justify-between items-end">
                    <div>
                        <h1 className="text-4xl font-extrabold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-1 animate-in slide-in-from-left duration-500">
                            {isTL ? "Team Command Center" : "Admin Command Center"}
                        </h1>
                        <p className="text-muted-foreground font-medium text-sm">
                            Real-time fleet performance system.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Date Filters */}
                        <div className="flex items-center gap-2 bg-white p-1 rounded-lg border shadow-sm">
                            <Filter size={14} className="text-muted-foreground ml-2" />
                            <span className="w-px h-4 bg-gray-200 mx-1"></span>
                            {(['all', 'month', 'week'] as DateFilter[]).map((filter) => (
                                <button
                                    key={filter}
                                    onClick={() => setDateFilter(filter)}
                                    className={`
                                        px-3 py-1.5 rounded-md text-xs font-semibold transition-all
                                        ${dateFilter === filter
                                            ? 'bg-indigo-600 text-white shadow-md'
                                            : 'text-gray-500 hover:bg-gray-100'
                                        }
                                    `}
                                >
                                    {filter === 'all' ? 'All Time' : filter === 'month' ? 'This Month' : 'This Week'}
                                </button>
                            ))}
                        </div>

                        {/* Customize Button */}
                        <button
                            onClick={() => setShowCustomizer(!showCustomizer)}
                            className={`p-2 rounded-lg border transition-all ${showCustomizer ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white hover:bg-gray-50 text-gray-600'}`}
                            title="Customize Dashboard"
                        >
                            <Settings size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {/* AI Ticker (Relocated) */}
            {visibleSections.aiTicker && (
                <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                    <AINewsTicker />
                    {aiInsight && (
                        <div className="mt-2 text-sm text-indigo-600 font-medium bg-indigo-50 border border-indigo-100 px-4 py-2 rounded-lg flex items-center gap-2">
                            <Sparkles size={16} />
                            <span className="font-bold">Strategic Insight:</span> {aiInsight}
                        </div>
                    )}
                </div>
            )}

            {/* 1. SMART METRICS GRID */}
            {visibleSections.metrics && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 animate-in slide-in-from-bottom duration-700 delay-100 font-jakarta">
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
                    <SmartMetricCard
                        title="Outstanding Risk"
                        value={stats.outstandingDues}
                        icon={AlertTriangle}
                        color="rose"
                        aiInsight={stats.highDebtCount > 0 ? `${stats.highDebtCount} riders need immediate collection.` : undefined}
                        subtitle={`${stats.negativeWalletCount} Negative Wallets`}
                        onClick={() => navigate('/portal/riders', { state: { filter: 'high_debt' } })}
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

                    {/* Row 2 */}
                    <SmartMetricCard
                        title="Low Balance"
                        value={stats.zeroWalletCount}
                        icon={Coins}
                        color="amber"
                        subtitle="Zero or Low Wallets"
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
                    <SmartMetricCard
                        title="Pending Ops"
                        value={stats.pendingRequests}
                        icon={Inbox}
                        color="blue"
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
                        title="Churn Monitor"
                        value={stats.inactiveRiders}
                        icon={UserCheck}
                        color="slate"
                        subtitle={`${stats.deletedRiders} Permanently Deleted`}
                        onClick={() => navigate('/portal/riders', { state: { filter: 'inactive' } })}
                    />
                </div>
            )}

            {/* 2. TL PERFORMANCE ANALYTICS (NEW SECTION) */}
            {/* 2. TL PERFORMANCE ANALYTICS (NEW SECTION) */}
            {console.log('DEBUG: Rendering Analytics Section?', {
                isVisible: visibleSections.analytics,
                isIsNotTL: !isTL,
                tlCount: rawData.teamLeaders.length
            })}
            {visibleSections.analytics && !isTL && (
                <div className="animate-in slide-in-from-bottom duration-700 delay-200 border-2 border-red-500 m-4 relative">
                    <div className="absolute top-0 right-0 bg-red-500 text-white text-xs px-2">DEBUG MODE</div>
                    <TLPerformanceAnalytics
                        teamLeaders={rawData.teamLeaders}
                        riders={rawData.riders}
                        leads={rawData.leads}
                    />
                </div>
            )}

            {/* 3. CHARTS & ACTIVITY */}
            {(visibleSections.charts || visibleSections.activity) && (
                <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom duration-700 delay-300`}>
                    {visibleSections.charts && (
                        <div className="lg:col-span-2">
                            <DashboardCharts
                                riderData={chartData.riders}
                                walletData={chartData.wallet.filter(d => d.value !== 0)}
                                leadData={chartData.leads}
                            />
                        </div>
                    )}
                    {visibleSections.activity && (
                        <div className="lg:col-span-1 h-[650px]">
                            <RecentActivity />
                        </div>
                    )}
                </div>
            )}

            {/* 4. LEADERBOARD */}
            {visibleSections.leaderboard && (
                <div className="animate-in slide-in-from-bottom duration-700 delay-500">
                    <Leaderboard
                        teamLeaders={rawData.teamLeaders}
                        riders={rawData.riders}
                        leads={rawData.leads}
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
            )}
        </div>
    );
};

export default Dashboard;
