import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/config/supabase';
import { Star, Users, Wallet, Zap, Activity, Shield, UserCheck, UserX, Sparkles, AlertTriangle, FileText } from 'lucide-react';
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

interface DashboardStats {
    // Riders
    totalRiders: number;
    activeRiders: number;
    inactiveRiders: number;
    deletedRiders: number;
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
        totalRiders: 0, activeRiders: 0, inactiveRiders: 0, deletedRiders: 0,
        positiveWallet: 0, negativeWallet: 0, zeroWallet: 0, totalPositiveAmount: 0, totalNegativeAmount: 0,
        totalLeads: 0, newLeads: 0, convertedLeads: 0, notConvertedLeads: 0
    });
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
                walletAmount: r.wallet_amount,
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

            const { data: allRidersData } = await supabase.from('riders').select('id, status, rider_name, mobile_number, wallet_amount, team_leader_id, allotment_date');
            const allRiders = (allRidersData || []).map((r: any) => ({
                id: r.id,
                status: r.status,
                riderName: r.rider_name,
                mobileNumber: r.mobile_number,
                walletAmount: r.wallet_amount,
                teamLeaderId: r.team_leader_id,
                allotmentDate: r.allotment_date
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
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'daily_collections' },
                () => {
                    // Refresh dashboard when collection totals change
                    fetchStats();
                }
            )
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
                <div className="flex flex-col items-center">
                    <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-muted-foreground font-medium animate-pulse">Loading Dashboard...</p>
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
            totalLeads: Number(stats?.totalLeads || 0)
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
        <div className="space-y-3 pb-6">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-end gap-2">
                <div>
                    <h1 className="text-3xl font-extrabold bg-gradient-to-r from-primary to-violet-600 bg-clip-text text-transparent">
                        Welcome back, {safeRender(userData?.fullName, 'Leader').split(' ')[0]}!
                    </h1>
                    <p className="text-muted-foreground text-xs mt-0.5 font-medium flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                        {format(new Date(), 'EEEE, MMMM do, yyyy')}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="px-3 py-1 bg-card border rounded-full text-[10px] font-semibold shadow-sm flex items-center gap-1.5">
                        <Shield size={10} className="text-primary" />
                        Team Leader View
                    </div>
                </div>
            </div>







            {/* BENTO GRID: Premium Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 animate-in slide-in-from-bottom duration-700 delay-100 font-jakarta">

                {/* --- ROW 1: MISSION CRITICAL & OPS --- */}
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

                {/* --- ROW 2: FINANCIAL PERFORMANCE --- */}
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

                <TodaysCollectionCard teamLeaderId={userData.id} />

                {/* --- ROW 3: RIDER WALLET HEALTH (COUNTS) --- */}
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

            {/* RECOVERY TASKS SECTION (New) */}
            <div className="animate-in slide-in-from-bottom duration-700 delay-200 mt-0.5">
                <ComponentErrorBoundary name="Debt Recovery Tasks">
                    <DebtRecoveryTasks
                        riders={leaderboardData.riders.filter(r => r.teamLeaderId === userData.id)}
                    />
                </ComponentErrorBoundary>
            </div>

            {/* AI Coaching Segment */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
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
                        <div className="h-full bg-card/40 border border-dashed rounded-[2rem] flex items-center justify-center text-muted-foreground p-8 min-h-[250px]">
                            Charts access restricted
                        </div>
                    )}
                </div>

                <div className="space-y-3">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-[1.5rem] p-5 text-white shadow-2xl relative overflow-hidden border border-white/5"
                    >
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" />
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="p-2 bg-indigo-500/30 rounded-lg backdrop-blur-xl border border-white/10">
                                    <Zap className="text-indigo-300 fill-indigo-300" size={16} />
                                </div>
                                <div>
                                    <h3 className="text-base font-black tracking-tighter">AI Team Coach</h3>
                                    <p className="text-[9px] uppercase font-black tracking-[0.2em] text-indigo-300/80">Performance Engine</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                {aiInsight ? (
                                    <div className="p-3 rounded-xl bg-white/10 border border-white/20 hover:bg-white/15 transition-colors">
                                        <div className="flex items-center gap-2 mb-1.5 text-indigo-200 text-[9px] font-bold uppercase tracking-wider">
                                            <Sparkles size={10} className="text-yellow-400 animate-pulse" />
                                            Live Insight
                                        </div>
                                        <p className="text-xs font-medium leading-relaxed text-white">
                                            "{safeRender(aiInsight)}"
                                        </p>
                                        <div className="mt-2 flex gap-2">
                                            <button
                                                onClick={() => handleNavigate('/team-leader/riders')}
                                                className="text-[9px] font-black uppercase tracking-widest bg-white text-indigo-900 px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
                                            >
                                                View Details
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                                        <p className="text-[10px] font-bold leading-relaxed text-indigo-100">
                                            "3 Riders in your team have not updated their wallets in 48h. Consider sending a WhatsApp reminder."
                                        </p>
                                        <div className="mt-2 flex gap-2">
                                            <button className="text-[9px] font-black uppercase tracking-widest bg-indigo-500 px-2 py-1 rounded">Action Now</button>
                                        </div>
                                    </div>
                                )}

                                <div className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                                    <p className="text-[10px] font-bold leading-relaxed text-emerald-100">
                                        "Your lead conversion speed is 15% higher than the fleet average this week. Keep it up!"
                                    </p>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    <div className="bg-card/50 backdrop-blur-sm border rounded-[1.5rem] p-4 shadow-xl">
                        <div className="flex items-center gap-2 mb-2">
                            <Activity size={14} className="text-primary" />
                            <h3 className="font-black tracking-tight text-xs">Recent Performance</h3>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center text-[10px] font-bold">
                                <span className="text-muted-foreground">Fleet Utilization</span>
                                <span className="text-emerald-500">94.2%</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1 rounded-full">
                                <div className="bg-emerald-500 h-1 rounded-full" style={{ width: '94%' }} />
                            </div>

                            <div className="flex justify-between items-center text-[10px] font-bold pt-1">
                                <span className="text-muted-foreground">Lead Quality</span>
                                <span className="text-indigo-500">High</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1 rounded-full">
                                <div className="bg-indigo-500 h-1 rounded-full" style={{ width: '82%' }} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions Tiles */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                    { id: 'addRider', label: 'Add Rider', icon: Users, path: '/team-leader/riders?action=new', color: 'text-blue-500', bg: 'bg-blue-500/10', permission: userData.permissions?.riders?.create },
                    { id: 'newLead', label: 'New Lead', icon: Zap, path: '/team-leader/leads', color: 'text-yellow-500', bg: 'bg-yellow-500/10', permission: userData.permissions?.leads?.create },
                    { id: 'reports', label: 'Reports', icon: FileText, path: '/team-leader/reports', color: 'text-purple-500', bg: 'bg-purple-500/10', permission: userData.permissions?.modules?.reports },
                    { id: 'collections', label: 'Collections', icon: Wallet, path: '/team-leader/collections', color: 'text-emerald-500', bg: 'bg-emerald-500/10', permission: true },
                    { id: 'activity', label: 'My Activity', icon: Activity, path: '/team-leader/activity-log', color: 'text-orange-500', bg: 'bg-orange-500/10', permission: userData.permissions?.modules?.activityLog },
                ].filter(action => action.permission ?? true).map((action, idx) => (
                    <motion.button
                        key={idx}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleNavigate(action.path)}
                        className="flex flex-col items-center justify-center p-3 rounded-2xl bg-card border hover:border-primary/50 shadow-sm transition-all group"
                    >
                        <div className={`p - 2 rounded - full ${action.bg} ${action.color} mb - 1 group - hover: scale - 110 transition - transform`}>
                            <action.icon size={16} />
                        </div>
                        <span className="font-bold text-[10px] text-foreground">{action.label}</span>
                    </motion.button>
                ))}
            </div>

            {/* Premium AI Leaderboard Section */}
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
                className="relative mt-12 rounded-[3.5rem] p-1 bg-gradient-to-br from-primary/20 via-violet-500/20 to-indigo-500/20 shadow-2xl overflow-hidden"
            >
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

                <div className="bg-white/40 dark:bg-slate-950/60 backdrop-blur-3xl rounded-[3.4rem] p-8 md:p-12 border border-white/20">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-10">
                        <div className="group cursor-default space-y-5">
                            <div className="flex items-center gap-6">
                                <motion.div
                                    whileHover={{ rotate: [0, -10, 10, 0] }}
                                    className="p-4 bg-gradient-to-br from-primary/20 to-violet-500/20 rounded-3xl border border-primary/30 shadow-[0_0_25px_rgba(99,102,241,0.2)]"
                                >
                                    <Star size={44} className="text-primary fill-primary/30 drop-shadow-[0_0_15px_rgba(99,102,241,0.6)] animate-pulse" />
                                </motion.div>
                                <div className="space-y-1">
                                    <h2 className="text-5xl font-black tracking-tighter bg-gradient-to-br from-slate-900 via-slate-600 to-slate-400 dark:from-white dark:via-slate-200 dark:to-slate-400 bg-clip-text text-transparent">
                                        Fleet Champions
                                    </h2>
                                    <p className="text-[12px] font-black uppercase tracking-[0.4em] text-muted-foreground/30">
                                        Live Performance Network
                                    </p>
                                </div>
                            </div>

                            {/* Neural Sync Pill - Refined Position */}
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-black/90 border border-white/20 rounded-full w-fit shadow-xl">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                                </span>
                                <span className="text-[10px] font-black tracking-[0.2em] text-white uppercase italic">Neural Realtime Sync</span>
                            </div>
                        </div>
                    </div>

                    <div className="relative z-10">
                        {(userData.permissions?.dashboard?.statsCards?.leaderboard ?? true) ? (
                            <ComponentErrorBoundary name="Leaderboard">
                                <Leaderboard
                                    teamLeaders={leaderboardData.teamLeaders}
                                    riders={leaderboardData.riders}
                                    leads={leaderboardData.leads}
                                    collections={tlCollections}
                                    disableClick={true}
                                />
                            </ComponentErrorBoundary>
                        ) : (
                            <div className="p-20 text-center text-muted-foreground border-4 border-dashed rounded-[3rem] bg-slate-500/5">
                                <Shield className="mx-auto mb-4 opacity-10" size={64} />
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
