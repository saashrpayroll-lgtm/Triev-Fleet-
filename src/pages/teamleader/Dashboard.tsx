import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/config/supabase';
import { Star, Users, Wallet, Zap, Activity, Shield, UserCheck, UserX, Sparkles, AlertTriangle, FileText, TrendingUp } from 'lucide-react';
import { Rider, User, Lead } from '@/types';
import Leaderboard from '@/components/Leaderboard';
import SmartMetricCard from '@/components/dashboard/SmartMetricCard';
import TodaysCollectionCard from '@/components/dashboard/TodaysCollectionCard';
import DashboardCharts from '@/components/dashboard/DashboardCharts';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { mapLeadFromDB } from '@/utils/leadUtils';
import { safeRender } from '@/utils/safeRender';
import ComponentErrorBoundary from '@/components/ComponentErrorBoundary';
import DebtRecoveryTasks from '@/components/dashboard/DebtRecoveryTasks';
import { resolvePerformancePeriod, DateFilterType } from '@/utils/dateUtils';

interface DashboardStats {
    // Riders
    totalRiders: number;
    activeRiders: number;
    inactiveRiders: number;
    deletedRiders: number;
    lowBalanceCount: number;
    // Wallet
    positiveWallet: number;
    negativeWallet: number;
    zeroWallet: number;
    totalPositiveAmount: number;
    totalNegativeAmount: number;
    // Leads
    totalLeads: number;
    newLeads: number;
    convertedLeads: number;
    notConvertedLeads: number;
}

const Dashboard: React.FC = () => {
    const { userData } = useSupabaseAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);

    // Stats State
    const [stats, setStats] = useState<DashboardStats>({
        totalRiders: 0, activeRiders: 0, inactiveRiders: 0, deletedRiders: 0, lowBalanceCount: 0,
        positiveWallet: 0, negativeWallet: 0, zeroWallet: 0, totalPositiveAmount: 0, totalNegativeAmount: 0,
        totalLeads: 0, newLeads: 0, convertedLeads: 0, notConvertedLeads: 0
    });
    const [dateFilter] = useState<DateFilterType>('day');
    const [aiInsight, setAiInsight] = useState<string>('');

    // Leaderboard Data State
    const [leaderboardData, setLeaderboardData] = useState<{ teamLeaders: User[], riders: Rider[], leads: Lead[] }>({
        teamLeaders: [], riders: [], leads: []
    });

    // Collections State for Leaderboard
    const [tlCollections, setTlCollections] = useState<Record<string, number>>({});

    // --- Data Fetching & Real-time ---
    const fetchStats = React.useCallback(async () => {
        if (!userData) return;

        try {
            // 1. Fetch My Riders
            const { data: myRidersData, error: myRidersError } = await supabase
                .from('riders')
                .select('id, triev_id, rider_name, mobile_number, status, wallet_amount, team_leader_id')
                .eq('team_leader_id', userData.id);

            if (myRidersError) throw myRidersError;

            const myRiders = (myRidersData || []).map((r: any) => ({
                id: r.id,
                trievId: r.triev_id,
                riderName: r.rider_name,
                mobileNumber: r.mobile_number,
                status: r.status,
                walletAmount: r.status === 'active' ? r.wallet_amount : 0,
                teamLeaderId: r.team_leader_id
            })) as Rider[];

            // 2. Fetch My Leads
            const { data: myLeadsData, error: myLeadsError } = await supabase
                .from('leads')
                .select('*')
                .eq('created_by', userData.id);

            if (myLeadsError) throw myLeadsError;

            const myLeads = ((myLeadsData || [])).map(mapLeadFromDB);

            // Calculate Stats
            const newStats: DashboardStats = {
                // Rider Stats
                totalRiders: myRiders.length,
                activeRiders: myRiders.filter(r => r.status === 'active').length,
                inactiveRiders: myRiders.filter(r => r.status === 'inactive').length,
                deletedRiders: myRiders.filter(r => r.status === 'deleted').length,
                lowBalanceCount: myRiders.filter(r => r.status === 'active' && r.walletAmount >= 0 && r.walletAmount <= 250).length,

                // Wallet Stats
                positiveWallet: myRiders.filter(r => r.status === 'active' && r.walletAmount > 0).length,
                negativeWallet: myRiders.filter(r => r.status === 'active' && r.walletAmount < 0).length,
                zeroWallet: myRiders.filter(r => r.status === 'active' && r.walletAmount === 0).length,
                totalPositiveAmount: myRiders.reduce((sum, r) => r.walletAmount > 0 ? sum + r.walletAmount : sum, 0),
                totalNegativeAmount: myRiders.reduce((sum, r) => r.walletAmount < 0 ? sum + r.walletAmount : sum, 0),

                // Lead Stats
                totalLeads: myLeads.length,
                newLeads: myLeads.filter(l => l.status === 'New').length,
                convertedLeads: myLeads.filter(l => l.status === 'Convert').length,
                notConvertedLeads: myLeads.filter(l => l.status === 'Not Convert').length,
            };

            setStats(newStats);

            // 3. Global Leaderboard Data
            const { data: tlsData } = await supabase.from('users').select('id, full_name, email, role, profile_pic_url').eq('role', 'teamLeader');
            const allTls = (tlsData || []).map((u: any) => ({
                id: u.id,
                fullName: u.full_name,
                email: u.email,
                role: u.role,
                profilePicUrl: u.profile_pic_url || undefined
            })) as User[];

            const { data: allRidersData } = await supabase
                .from('riders')
                .select('id, status, rider_name, mobile_number, wallet_amount, team_leader_id, allotment_date, inactivated_at, created_at, updated_at');
            const allRiders = (allRidersData || []).map((r: any) => ({
                id: r.id,
                status: r.status,
                riderName: r.rider_name,
                mobileNumber: r.mobile_number,
                walletAmount: r.status === 'active' ? r.wallet_amount : 0,
                teamLeaderId: r.team_leader_id,
                allotmentDate: r.allotment_date,
                inactivatedAt: r.inactivated_at,
                createdAt: r.created_at,
                updatedAt: r.updated_at
            })) as Rider[];

            const { data: allLeadsData } = await supabase.from('leads').select('*');
            const allLeads = ((allLeadsData || [])).map(mapLeadFromDB);

            setLeaderboardData({ teamLeaders: allTls, riders: allRiders, leads: allLeads });

            // 4. Fetch Collections for Leaderboard (History + Today)
            // 4. Fetch Collections for Leaderboard
            const [dailyRes] = await Promise.all([
                supabase.from('daily_collections').select('team_leader_id, total_collection')
            ]);

            const collections: Record<string, number> = {};

            // Add Historical
            (dailyRes.data || []).forEach((d: any) => {
                const tlId = d.team_leader_id;
                const amt = Number(d.total_collection) || 0;
                collections[tlId] = (collections[tlId] || 0) + amt;
            });

            // Add Today - REMOVED
            // logic is now handled by DB Trigger updating daily_collections automatically.

            setTlCollections(collections);

        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
        } finally {
            setLoading(false);
        }
    }, [userData]);

    useEffect(() => {
        fetchStats();

        // Real-time Collections Update via daily_collections table
        const channel = supabase
            .channel('tl-dashboard-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'riders' }, () => { fetchStats(); })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => { fetchStats(); })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => { fetchStats(); })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_collections' }, () => { fetchStats(); })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userData]);

    useEffect(() => {
        if (!loading && stats.totalRiders > 0) {
            import('@/services/AIService').then(({ AIService }) => {
                AIService.getDashboardInsights(stats, 'teamLeader').then(setAiInsight);
            });
        }
    }, [loading, stats]);

    const handleNavigate = (path: string, state?: any) => {
        navigate(path, { state });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[600px]">
                <div className="flex flex-col items-center gap-4">
                    <div className="relative w-16 h-16">
                        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-violet-500 to-indigo-500 opacity-20 animate-ping" />
                        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-violet-500 border-r-indigo-400 animate-spin" />
                        <div className="absolute inset-2 rounded-full bg-gradient-to-br from-violet-500/20 to-indigo-500/20 backdrop-blur-sm" />
                    </div>
                    <div className="text-center">
                        <p className="text-sm font-black text-foreground">Loading Dashboard</p>
                        <p className="text-[10px] text-muted-foreground font-medium animate-pulse mt-0.5">Fetching real-time fleet data...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!userData) return null;
    const canViewDashboard = userData?.permissions?.dashboard?.view ?? true;
    if (!canViewDashboard) return <div className="p-10 text-center text-red-500 font-bold">Access Restricted</div>;

    // TEMPORARY: Removed useMemo to test if the hook is causing the error
    let chartData;
    try {
        // FORCE all values to be numbers to prevent React Error #310
        // This ensures potential objects/nulls are converted to 0 or primitives
        const s = {
            activeRiders: Number(stats?.activeRiders || 0),
            inactiveRiders: Number(stats?.inactiveRiders || 0),
            deletedRiders: Number(stats?.deletedRiders || 0),
            totalPositiveAmount: Number(stats?.totalPositiveAmount || 0),
            totalNegativeAmount: Number(stats?.totalNegativeAmount || 0),
            convertedLeads: Number(stats?.convertedLeads || 0),
            totalLeads: Number(stats?.totalLeads || 0),
            lowBalanceCount: Number(stats?.lowBalanceCount || 0)
        };

        chartData = {
            riders: [
                { name: 'Active', value: s.activeRiders, color: '#10b981' },
                { name: 'Inactive', value: s.inactiveRiders, color: '#f59e0b' },
                { name: 'Deleted', value: s.deletedRiders, color: '#f43f5e' }
            ],
            wallet: [
                { name: 'Collections', value: s.totalPositiveAmount },
                { name: 'Risk / Dues', value: s.totalNegativeAmount }
            ],
            leads: [
                { name: 'Converted', value: s.convertedLeads, color: '#84cc16' },
                { name: 'Pipeline', value: Math.max(0, s.totalLeads - s.convertedLeads), color: '#94a3b8' }
            ]
        };
    } catch (error) {
        console.error('Error generating chart data:', error);
        // safe fallback
        chartData = { riders: [], wallet: [], leads: [] };
    }



    return (
        <div className="space-y-5 pb-10">

            {/* ─── HEADER ─── */}
            <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-2"
            >
                <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-violet-600 via-indigo-500 to-cyan-500 bg-clip-text text-transparent">
                        Welcome back, {safeRender(userData?.fullName, 'Leader').split(' ')[0]}! 👋
                    </h1>
                    <p className="text-muted-foreground text-xs mt-0.5 font-medium flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        {format(new Date(), 'EEEE, MMMM do, yyyy')} &mdash; Live
                    </p>
                </div>
                <div className="px-3 py-1.5 bg-gradient-to-r from-violet-500/10 to-indigo-500/10 border border-violet-400/20 rounded-full text-[10px] font-black flex items-center gap-1.5">
                    <Shield size={10} className="text-violet-500" />
                    <span className="text-violet-600 dark:text-violet-400">Team Leader</span>
                </div>
            </motion.div>

            {/* ─── Fleet & Operations ─── */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }} className="space-y-2.5">
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-lg bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                        <UserCheck size={10} className="text-emerald-500" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">Fleet & Operations</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-emerald-500/30 to-transparent" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 animate-in slide-in-from-bottom duration-700 font-jakarta">
                    {(userData.permissions?.dashboard?.statsCards?.activeRiders ?? true) && (
                        <SmartMetricCard
                            title="Fleet Strength"
                            value={String(stats.activeRiders)}
                            icon={UserCheck}
                            color="emerald"
                            trend={{ value: 98, label: 'health', direction: 'up' }}
                            subtitle={`${stats.totalRiders} Total Assigned`}
                            progress={stats.totalRiders > 0 ? (stats.activeRiders / stats.totalRiders) * 100 : 0}
                            onClick={() => handleNavigate('/team-leader/riders', { filter: 'active' })}
                            isCurrency={false}
                        />
                    )}
                    <SmartMetricCard
                        title="Churn Rider Monitor"
                        value={String(stats.inactiveRiders + stats.deletedRiders)}
                        icon={UserX}
                        color="slate"
                        trend={{ value: Math.round(((stats.inactiveRiders + stats.deletedRiders) / stats.totalRiders) * 100) || 0, label: 'churn rate', direction: 'down' }}
                        subtitle={`${stats.inactiveRiders} Inactive | ${stats.deletedRiders} Deleted`}
                        progress={stats.totalRiders > 0 ? ((stats.inactiveRiders + stats.deletedRiders) / stats.totalRiders) * 100 : 0}
                        onClick={() => handleNavigate('/team-leader/riders', { filter: 'inactive' })}
                        isCurrency={false}
                    />
                    {(userData.permissions?.dashboard?.statsCards?.totalLeads ?? true) && (
                        <SmartMetricCard
                            title="Lead Pipeline"
                            value={`${stats.totalLeads > 0 ? Math.round((stats.convertedLeads / stats.totalLeads) * 100) : 0}% `}
                            icon={Sparkles}
                            color="fuchsia"
                            trend={{ value: 12, label: 'velocity', direction: 'up' }}
                            subtitle={`${stats.convertedLeads} Successful Converts`}
                            progress={stats.totalLeads > 0 ? Math.round((stats.convertedLeads / stats.totalLeads) * 100) : 0}
                            onClick={() => handleNavigate('/team-leader/leads?status=New')}
                            isCurrency={false}
                        />
                    )}
                    {(userData.permissions?.dashboard?.statsCards?.revenue ?? true) && (
                        <SmartMetricCard
                            title="Revenue Collected"
                            value={stats.totalPositiveAmount}
                            icon={Wallet}
                            color="indigo"
                            trend={{ value: 24, label: 'growth', direction: 'up' }}
                            subtitle={`${stats.positiveWallet} Riders Positive`}
                            progress={stats.totalRiders > 0 ? (stats.positiveWallet / stats.totalRiders) * 100 : 0}
                            onClick={() => handleNavigate('/team-leader/reports', { template: 'wallet_summary' })}
                        />
                    )}
                </div>
            </motion.div>

            {/* --- Wallet Health --- */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="space-y-2.5">
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-lg bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                        <Wallet size={10} className="text-indigo-500" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">Wallet Health</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-indigo-500/30 to-transparent" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 font-jakarta">
                    <TodaysCollectionCard teamLeaderId={userData.id} />
                    <SmartMetricCard
                        title="Positive Riders"
                        value={String(stats.positiveWallet)}
                        icon={Users}
                        color="emerald"
                        trend={{ value: Math.round((stats.positiveWallet / stats.totalRiders) * 100) || 0, label: 'of team', direction: 'up' }}
                        subtitle="Wallet > 0"
                        progress={stats.totalRiders > 0 ? (stats.positiveWallet / stats.totalRiders) * 100 : 0}
                        onClick={() => handleNavigate('/team-leader/riders', { filter: 'positive_wallet' })}
                        isCurrency={false}
                    />
                    <SmartMetricCard
                        title="Negative Riders"
                        value={String(stats.negativeWallet)}
                        icon={Users}
                        color="rose"
                        trend={{ value: Math.round((stats.negativeWallet / stats.totalRiders) * 100) || 0, label: 'of team', direction: 'down' }}
                        subtitle="Wallet < 0"
                        progress={stats.totalRiders > 0 ? (stats.negativeWallet / stats.totalRiders) * 100 : 0}
                        onClick={() => handleNavigate('/team-leader/riders', { filter: 'negative_wallet' })}
                        isCurrency={false}
                    />
                    <SmartMetricCard
                        title="Low Balance (0-250)"
                        value={String(stats.lowBalanceCount)}
                        icon={AlertTriangle}
                        color="orange"
                        className={stats.lowBalanceCount > 0 ? 'animate-pulse ring-1 ring-orange-500/30' : ''}
                        subtitle="At-Risk of Rejection"
                        onClick={() => handleNavigate('/team-leader/riders', { filter: 'low_balance' })}
                        isCurrency={false}
                    />
                    {(userData.permissions?.dashboard?.statsCards?.walletNegative ?? true) && (
                        <SmartMetricCard
                            title="Payment Dues"
                            value={Math.abs(stats.totalNegativeAmount)}
                            icon={AlertTriangle}
                            color="rose"
                            aiInsight={stats.negativeWallet > 0 ? `${stats.negativeWallet} riders owe payments.` : undefined}
                            subtitle={`${stats.negativeWallet} Riders in Debt`}
                            progress={stats.totalRiders > 0 ? (stats.negativeWallet / stats.totalRiders) * 100 : 0}
                            onClick={() => handleNavigate('/team-leader/riders', { filter: 'negative_wallet' })}
                        />
                    )}
                </div>
            </motion.div>


            {/* --- Debt Recovery Tasks --- */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="space-y-2.5">
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-lg bg-rose-500/15 border border-rose-500/20 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle size={10} className="text-rose-500" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">Debt Recovery Tasks</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-rose-500/30 to-transparent" />
                </div>
                <ComponentErrorBoundary name="Debt Recovery Tasks">
                    <DebtRecoveryTasks riders={leaderboardData.riders.filter(r => r.teamLeaderId === userData.id)} />
                </ComponentErrorBoundary>
            </motion.div>

            {/* --- Analytics & AI Coach --- */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="space-y-2.5">
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-lg bg-violet-500/15 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                        <Sparkles size={10} className="text-violet-500" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">Analytics & AI Coach</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-violet-500/30 to-transparent" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    {/* Charts (2/3 width) */}
                    <div className="lg:col-span-2">
                        {(userData.permissions?.dashboard?.charts?.onboarding ?? true) ? (
                            <ComponentErrorBoundary name="Dashboard Charts">
                                <DashboardCharts
                                    riderData={chartData.riders}
                                    walletData={chartData.wallet}
                                    leadData={chartData.leads}
                                />
                            </ComponentErrorBoundary>
                        ) : (
                            <div className="h-full bg-card/40 border border-dashed rounded-xl flex items-center justify-center text-muted-foreground p-8 min-h-[250px]">
                                Charts access restricted
                            </div>
                        )}
                    </div>

                    {/* AI Panel (1/3 width) */}
                    <div className="space-y-3">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-2xl p-4 text-white shadow-xl relative overflow-hidden border border-white/5"
                        >
                            <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" />
                            <div className="relative z-10">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="p-2 bg-indigo-500/30 rounded-lg backdrop-blur-xl border border-white/10">
                                        <Zap className="text-indigo-300 fill-indigo-300" size={14} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black tracking-tight">AI Team Coach</h3>
                                        <p className="text-[9px] uppercase font-black tracking-widest text-indigo-300/80">Performance Engine</p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    {aiInsight ? (
                                        <div className="p-3 rounded-xl bg-white/10 border border-white/20">
                                            <div className="flex items-center gap-1.5 mb-1.5 text-indigo-200 text-[9px] font-bold uppercase tracking-wider">
                                                <Sparkles size={9} className="text-yellow-400 animate-pulse" />
                                                Live Insight
                                            </div>
                                            <p className="text-xs font-medium leading-relaxed text-white">"{safeRender(aiInsight)}"</p>
                                            <button
                                                onClick={() => handleNavigate('/team-leader/riders')}
                                                className="mt-2 text-[9px] font-black uppercase tracking-widest bg-white text-indigo-900 px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
                                            >
                                                View Details
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                                            <p className="text-[10px] font-bold leading-relaxed text-indigo-100">
                                                "3 Riders in your team have not updated their wallets in 48h. Consider sending a reminder."
                                            </p>
                                            <button className="mt-2 text-[9px] font-black uppercase tracking-widest bg-indigo-500 px-2 py-1 rounded">Action Now</button>
                                        </div>
                                    )}
                                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                                        <p className="text-[10px] font-bold leading-relaxed text-emerald-100">
                                            "Your lead conversion speed is 15% higher than the fleet average this week. Keep it up!"
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        <div className="bg-card/50 backdrop-blur-sm border rounded-2xl p-4 shadow-lg">
                            <div className="flex items-center gap-2 mb-3">
                                <Activity size={13} className="text-primary" />
                                <h3 className="font-black tracking-tight text-xs">Recent Performance</h3>
                            </div>
                            <div className="space-y-2.5">
                                {[
                                    { label: 'Fleet Utilization', value: '94.2%', color: 'bg-emerald-500', pct: 94 },
                                    { label: 'Lead Quality', value: 'High', color: 'bg-indigo-500', pct: 82 },
                                ].map(item => (
                                    <div key={item.label}>
                                        <div className="flex justify-between items-center text-[10px] font-bold mb-1">
                                            <span className="text-muted-foreground">{item.label}</span>
                                            <span className={item.color.replace('bg-', 'text-')}>{item.value}</span>
                                        </div>
                                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1 rounded-full">
                                            <div className={`${item.color} h-1 rounded-full transition-all`} style={{ width: `${item.pct}%` }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* --- Quick Actions --- */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="space-y-2">
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-lg bg-cyan-500/15 border border-cyan-500/20 flex items-center justify-center flex-shrink-0">
                        <Zap size={10} className="text-cyan-500" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">Quick Actions</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-cyan-500/30 to-transparent" />
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {[
                        { id: 'addRider', label: 'Add Rider', icon: Users, path: '/team-leader/riders?action=new', color: 'text-blue-500', bg: 'bg-blue-500/10', permission: userData.permissions?.riders?.create },
                        { id: 'newLead', label: 'New Lead', icon: Zap, path: '/team-leader/leads', color: 'text-yellow-500', bg: 'bg-yellow-500/10', permission: userData.permissions?.leads?.create },
                        { id: 'reports', label: 'Reports', icon: FileText, path: '/team-leader/reports', color: 'text-purple-500', bg: 'bg-purple-500/10', permission: userData.permissions?.modules?.reports },
                        { id: 'collections', label: 'Collections', icon: Wallet, path: '/team-leader/collections', color: 'text-emerald-500', bg: 'bg-emerald-500/10', permission: true },
                        { id: 'performance', label: 'Performance', icon: TrendingUp, path: '/team-leader/performance', color: 'text-indigo-500', bg: 'bg-indigo-500/10', permission: true },
                        { id: 'activity', label: 'My Activity', icon: Activity, path: '/team-leader/activity-log', color: 'text-orange-500', bg: 'bg-orange-500/10', permission: userData.permissions?.modules?.activityLog },
                    ].filter(action => action.permission ?? true).map((action, idx) => (
                        <motion.button
                            key={idx}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.05 * idx }}
                            whileHover={{ scale: 1.06, y: -2 }}
                            whileTap={{ scale: 0.94 }}
                            onClick={() => handleNavigate(action.path)}
                            className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-card/70 border border-border/60 hover:border-primary/40 shadow-sm hover:shadow-lg hover:shadow-primary/10 transition-all group gap-2 backdrop-blur-sm"
                        >
                            <div className={`p-2.5 rounded-xl ${action.bg} ${action.color} group-hover:scale-110 transition-transform duration-200 ring-1 ring-current/20`}>
                                <action.icon size={14} />
                            </div>
                            <span className="font-black text-[9px] text-foreground leading-tight text-center uppercase tracking-wide">{action.label}</span>
                        </motion.button>
                    ))}
                </div>
            </motion.div>

            {/* --- Fleet Champions Leaderboard --- */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="relative rounded-2xl sm:rounded-3xl p-[3px] bg-gradient-to-br from-primary/20 via-violet-500/20 to-indigo-500/20 shadow-2xl overflow-hidden"
            >
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                <div className="bg-card/80 dark:bg-slate-950/70 backdrop-blur-2xl rounded-2xl sm:rounded-3xl p-4 sm:p-8 border border-white/10">
                    {/* Leaderboard Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
                        <div className="flex items-center gap-3">
                            <motion.div
                                whileHover={{ rotate: [0, -8, 8, 0] }}
                                className="p-2.5 bg-gradient-to-br from-primary/20 to-violet-500/20 rounded-xl border border-primary/30"
                            >
                                <Star size={22} className="text-primary fill-primary/30 animate-pulse" />
                            </motion.div>
                            <div>
                                <h2 className="text-xl sm:text-2xl font-black tracking-tight bg-gradient-to-br from-slate-900 via-slate-600 to-slate-400 dark:from-white dark:via-slate-200 dark:to-slate-400 bg-clip-text text-transparent">
                                    Fleet Champions
                                </h2>
                                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/40">Live Performance Network</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-black/90 border border-white/20 rounded-full shadow-xl">
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                            </span>
                            <span className="text-[9px] font-black tracking-widest text-white uppercase">Neural Realtime Sync</span>
                        </div>
                    </div>

                    {/* Leaderboard */}
                    <div className="relative z-10">
                        {(userData.permissions?.dashboard?.statsCards?.leaderboard ?? true) ? (
                            <ComponentErrorBoundary name="Leaderboard">
                                <Leaderboard
                                    teamLeaders={leaderboardData.teamLeaders}
                                    riders={leaderboardData.riders}
                                    leads={leaderboardData.leads}
                                    collections={tlCollections}
                                    disableClick={true}
                                    period={resolvePerformancePeriod(dateFilter)}
                                />
                            </ComponentErrorBoundary>
                        ) : (
                            <div className="p-16 text-center text-muted-foreground border-4 border-dashed rounded-2xl bg-slate-500/5">
                                <Shield className="mx-auto mb-4 opacity-10" size={48} />
                                <p className="font-black uppercase tracking-widest text-sm italic">Leaderboard Intelligence Restricted</p>
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default Dashboard;
