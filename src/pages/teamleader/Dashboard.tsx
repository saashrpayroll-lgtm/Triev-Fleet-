import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/config/supabase';
import {
    Users, UserCheck, Wallet, Activity, Zap, Star, Shield, Sparkles, AlertTriangle, FileText
} from 'lucide-react';
import { Rider, User, Lead } from '@/types';
import Leaderboard from '@/components/Leaderboard';
import SmartMetricCard from '@/components/dashboard/SmartMetricCard';
import TodaysCollectionCard from '@/components/dashboard/TodaysCollectionCard';
import DashboardCharts from '@/components/dashboard/DashboardCharts';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { mapLeadFromDB } from '@/utils/leadUtils';
import { safeRender } from '@/utils/safeRender';
import { sanitizeArray } from '@/utils/sanitizeData';
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
                .select(`
                    id,
                    trievId:triev_id,
                    riderName:rider_name,
                    mobileNumber:mobile_number,
                    status,
                    walletAmount:wallet_amount,
                    teamLeaderId:team_leader_id
                `)
                .eq('team_leader_id', userData.id);

            if (myRidersError) throw myRidersError;

            const myRiders = (myRidersData || []) as Rider[];

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
                positiveWallet: myRiders.filter(r => r.walletAmount > 0).length,
                negativeWallet: myRiders.filter(r => r.walletAmount < 0).length,
                zeroWallet: myRiders.filter(r => r.walletAmount === 0).length,
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
            const { data: tlsData } = await supabase.from('users').select(`
                id,
                fullName:full_name,
                email,
                role
            `).eq('role', 'teamLeader');
            const allTls = sanitizeArray((tlsData || []) as User[]);

            const { data: allRidersData } = await supabase.from('riders').select(`
                id,
                status,
                riderName:rider_name,
                mobileNumber:mobile_number,
                walletAmount:wallet_amount,
                teamLeaderId:team_leader_id
            `);
            const allRiders = (allRidersData || []) as Rider[];

            const { data: allLeadsData } = await supabase.from('leads').select('*');
            const allLeads = ((allLeadsData || [])).map(mapLeadFromDB);

            setLeaderboardData({ teamLeaders: allTls, riders: allRiders, leads: allLeads });

            // 4. Fetch Collections for Leaderboard (History + Today)
            const [dailyRes, todayRes] = await Promise.all([
                supabase.from('daily_collections').select('team_leader_id, total_collection'),
                supabase.from('wallet_transactions')
                    .select('amount, team_leader_id')
                    .eq('type', 'credit')
                    .gte('timestamp', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
            ]);

            const collections: Record<string, number> = {};

            // Add Historical
            (dailyRes.data || []).forEach((d: any) => {
                const tlId = d.team_leader_id;
                const amt = Number(d.total_collection) || 0;
                collections[tlId] = (collections[tlId] || 0) + amt;
            });

            // Add Today
            (todayRes.data || []).forEach((txn: any) => {
                const tlId = txn.team_leader_id;
                const amt = Number(txn.amount) || 0;
                if (tlId) {
                    collections[tlId] = (collections[tlId] || 0) + amt;
                }
            });

            setTlCollections(collections);

        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
        } finally {
            setLoading(false);
        }
    }, [userData]);

    useEffect(() => {
        fetchStats();

        // Real-time Subscriptions
        // Real-time Subscriptions
        const channel = supabase
            .channel('tl-dashboard-realtime')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'wallet_transactions', filter: 'type=eq.credit' },
                (payload: any) => {
                    const newTxn = payload.new as any;
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
        <div className="space-y-8 pb-20">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-end gap-4">
                <div>
                    <h1 className="text-4xl font-extrabold bg-gradient-to-r from-primary to-violet-600 bg-clip-text text-transparent">
                        Welcome back, {safeRender(userData?.fullName, 'Leader').split(' ')[0]}!
                    </h1>
                    <p className="text-muted-foreground text-lg mt-1 font-medium flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        {format(new Date(), 'EEEE, MMMM do, yyyy')}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="px-4 py-2 bg-card border rounded-full text-sm font-semibold shadow-sm flex items-center gap-2">
                        <Shield size={14} className="text-primary" />
                        Team Leader View
                    </div>
                </div>
            </div>







            {/* BENTO GRID: Premium Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 animate-in slide-in-from-bottom duration-700 delay-100 font-jakarta">

                {/* Rider Stats */}
                {(userData.permissions?.dashboard?.statsCards?.activeRiders ?? true) && (
                    <SmartMetricCard
                        title="Fleet Strength"
                        value={stats.activeRiders}
                        icon={UserCheck}
                        color="emerald"
                        trend={{ value: 98, label: 'health', direction: 'up' }}
                        subtitle={`${stats.totalRiders} Total Assigned`}
                        onClick={() => handleNavigate('/team-leader/riders', { filter: 'active' })}
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
                        onClick={() => handleNavigate('/team-leader/reports', { template: 'wallet_summary' })}
                    />
                )}

                <TodaysCollectionCard teamLeaderId={userData.id} />

                {(userData.permissions?.dashboard?.statsCards?.walletNegative ?? true) && (
                    <SmartMetricCard
                        title="Payment Dues"
                        value={Math.abs(stats.totalNegativeAmount)}
                        icon={AlertTriangle}
                        color="rose"
                        aiInsight={stats.negativeWallet > 0 ? `${stats.negativeWallet} riders owe payments.` : undefined}
                        subtitle={`${stats.negativeWallet} Riders in Debt`}
                        onClick={() => handleNavigate('/team-leader/reports', { template: 'negative_wallet' })}
                    />
                )}

                {(userData.permissions?.dashboard?.statsCards?.totalLeads ?? true) && (
                    <SmartMetricCard
                        title="Lead Pipeline"
                        value={`${stats.totalLeads > 0 ? Math.round((stats.convertedLeads / stats.totalLeads) * 100) : 0}%`}
                        icon={Sparkles}
                        color="fuchsia"
                        trend={{ value: 12, label: 'velocity', direction: 'up' }}
                        subtitle={`${stats.convertedLeads} Successful Converts`}
                        onClick={() => handleNavigate('/team-leader/leads')}
                    />
                )}

            </div>

            {/* RECOVERY TASKS SECTION (New) */}
            <div className="animate-in slide-in-from-bottom duration-700 delay-200">
                <ComponentErrorBoundary name="Debt Recovery Tasks">
                    {/* We pass the 'myRiders' derived from leaderboardData (which is actually all riders, wait - 
                         the stats logic fetches 'myRiders' but leaderboardData fetches 'allRiders'. 
                         We need 'myRiders' for this component. 
                         Looking at the fetchStats logic:
                         The 'myRiders' data isn't stored in a state variable accessible here directly except inside 'stats'.
                         Wait, 'leaderboardData' has 'riders' which IS 'allRiders'. 
                         Ideally this component should take 'myRiders'. 
                         I see 'leaderboardData' state variable. 
                         Let's see where 'myRiders' went.
                         It was used to calculate stats but not stored in state.
                         
                         CORRECTION: I need to store 'myRiders' in state to pass it to this component.
                         Or, I can filter 'leaderboardData.riders' if it contains everyone and I know my ID.
                         But 'leaderboardData.riders' is ALL riders.
                         'userData.id' is available.
                         So I can filter: leaderboardData.riders.filter(r => r.teamLeaderId === userData.id)
                     */}
                    <DebtRecoveryTasks
                        riders={leaderboardData.riders.filter(r => r.teamLeaderId === userData.id)}
                    />
                </ComponentErrorBoundary>
            </div>

            {/* AI Coaching Segment */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                        <div className="h-full bg-card/40 border border-dashed rounded-[2.5rem] flex items-center justify-center text-muted-foreground p-10 min-h-[300px]">
                            Charts access restricted
                        </div>
                    )}
                </div>

                <div className="space-y-6">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden border border-white/5"
                    >
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" />
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-3 bg-indigo-500/30 rounded-2xl backdrop-blur-xl border border-white/10">
                                    <Zap className="text-indigo-300 fill-indigo-300" size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black tracking-tighter">AI Team Coach</h3>
                                    <p className="text-[10px] uppercase font-black tracking-[0.2em] text-indigo-300/80">Performance Engine</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {aiInsight ? (
                                    <div className="p-4 rounded-2xl bg-white/10 border border-white/20 hover:bg-white/15 transition-colors">
                                        <div className="flex items-center gap-2 mb-2 text-indigo-200 text-xs font-bold uppercase tracking-wider">
                                            <Sparkles size={12} className="text-yellow-400 animate-pulse" />
                                            Live Insight
                                        </div>
                                        <p className="text-sm font-medium leading-relaxed text-white">
                                            "{safeRender(aiInsight)}"
                                        </p>
                                        <div className="mt-3 flex gap-2">
                                            <button
                                                onClick={() => handleNavigate('/team-leader/riders')}
                                                className="text-[10px] font-black uppercase tracking-widest bg-white text-indigo-900 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
                                            >
                                                View Details
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                                        <p className="text-xs font-bold leading-relaxed text-indigo-100">
                                            "3 Riders in your team have not updated their wallets in 48h. Consider sending a WhatsApp reminder."
                                        </p>
                                        <div className="mt-3 flex gap-2">
                                            <button className="text-[10px] font-black uppercase tracking-widest bg-indigo-500 px-3 py-1 rounded-lg">Action Now</button>
                                        </div>
                                    </div>
                                )}

                                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                                    <p className="text-xs font-bold leading-relaxed text-emerald-100">
                                        "Your lead conversion speed is 15% higher than the fleet average this week. Keep it up!"
                                    </p>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    <div className="bg-card/50 backdrop-blur-sm border rounded-3xl p-6 shadow-xl">
                        <div className="flex items-center gap-2 mb-4">
                            <Activity size={18} className="text-primary" />
                            <h3 className="font-black tracking-tight">Recent Performance</h3>
                        </div>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-sm font-bold">
                                <span className="text-muted-foreground">Fleet Utilization</span>
                                <span className="text-emerald-500">94.2%</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full">
                                <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: '94%' }} />
                            </div>

                            <div className="flex justify-between items-center text-sm font-bold pt-2">
                                <span className="text-muted-foreground">Lead Quality</span>
                                <span className="text-indigo-500">High</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full">
                                <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: '82%' }} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions Tiles */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { id: 'addRider', label: 'Add Rider', icon: Users, path: '/team-leader/riders/new', color: 'text-blue-500', bg: 'bg-blue-500/10', permission: userData.permissions?.riders?.create },
                    { id: 'newLead', label: 'New Lead', icon: Zap, path: '/team-leader/leads', color: 'text-yellow-500', bg: 'bg-yellow-500/10', permission: userData.permissions?.leads?.create },
                    { id: 'reports', label: 'Reports', icon: FileText, path: '/team-leader/reports', color: 'text-purple-500', bg: 'bg-purple-500/10', permission: userData.permissions?.modules?.reports },
                    { id: 'activity', label: 'My Activity', icon: Activity, path: '/team-leader/activity-log', color: 'text-orange-500', bg: 'bg-orange-500/10', permission: userData.permissions?.modules?.activityLog },
                ].filter(action => action.permission ?? true).map((action, idx) => (
                    <motion.button
                        key={idx}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleNavigate(action.path)}
                        className="flex flex-col items-center justify-center p-4 rounded-2xl bg-card border hover:border-primary/50 shadow-sm transition-all group"
                    >
                        <div className={`p-3 rounded-full ${action.bg} ${action.color} mb-2 group-hover:scale-110 transition-transform`}>
                            <action.icon size={20} />
                        </div>
                        <span className="font-bold text-sm text-foreground">{action.label}</span>
                    </motion.button>
                ))}
            </div>

            {/* Top Performers Leaderboard (Moved to Bottom) */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="bg-card/50 backdrop-blur-sm border rounded-3xl p-6 shadow-lg relative overflow-hidden"
            >
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                    <Star size={200} />
                </div>
                <div className="mb-2 relative z-10">
                    {/* Header removed as requested */}
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
                        <div className="p-10 text-center text-muted-foreground border border-dashed rounded-2xl">
                            Leaderboard is restricted
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default Dashboard;
