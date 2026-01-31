import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/config/supabase';
import {
    Users, UserCheck, UserX, Wallet, TrendingUp, TrendingDown,
    AlertCircle, FileText, Activity, Zap, Star, Shield, Smartphone
} from 'lucide-react';
import { Rider, User, Lead } from '@/types';
import Leaderboard from '@/components/Leaderboard';
import AINewsTicker from '@/components/AINewsTicker';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { mapLeadFromDB } from '@/utils/leadUtils';

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

    // Leaderboard Data State
    const [leaderboardData, setLeaderboardData] = useState<{ teamLeaders: User[], riders: Rider[], leads: Lead[] }>({
        teamLeaders: [], riders: [], leads: []
    });

    useEffect(() => {
        const fetchStats = async () => {
            if (!userData) return;

            try {
                // 1. Fetch My Riders
                const { data: myRidersData, error: myRidersError } = await supabase
                    .from('riders')
                    .select('*')
                    .eq('team_leader_id', userData.id);

                if (myRidersError) throw myRidersError;

                const myRiders = ((myRidersData as any[]) || []).map(r => ({
                    ...r, walletAmount: r.wallet_amount, teamLeaderId: r.team_leader_id, status: r.status
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

                // 3. Global Leaderboard Data (Fetch all TLs and Riders for Leaderboard Algo)
                // Leaderboard shows everyone to encourage competition.
                const { data: tlsData } = await supabase.from('users').select('*').eq('role', 'teamLeader');
                const allTls = ((tlsData as any[]) || []).map(u => ({ ...u, fullName: u.full_name })) as User[];

                const { data: allRidersData } = await supabase.from('riders').select('*');
                const allRiders = ((allRidersData as any[]) || []).map(r => ({
                    ...r, walletAmount: r.wallet_amount, teamLeaderId: r.team_leader_id
                })) as Rider[];

                const { data: allLeadsData } = await supabase.from('leads').select('*');
                const allLeads = ((allLeadsData || [])).map(mapLeadFromDB);

                setLeaderboardData({ teamLeaders: allTls, riders: allRiders, leads: allLeads });

            } catch (error) {
                console.error('Error fetching dashboard stats:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();

        // Realtime Subscription
        const subscription = supabase
            .channel('tl-dashboard-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'riders' }, () => fetchStats())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => fetchStats())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchStats())
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [userData]);

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

    // Helper for Stat Card
    const StatCard = ({
        title, value, subtitle, icon: Icon, color, onClick, gradient
    }: {
        title: string, value: string | number, subtitle: string, icon: any, color: string, onClick?: () => void, gradient: string
    }) => (
        <motion.div
            whileHover={{ scale: 1.02, y: -5 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            className={`cursor-pointer relative overflow-hidden rounded-3xl p-6 border border-white/10 shadow-xl backdrop-blur-md ${gradient} group`}
        >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Icon size={80} />
            </div>
            <div className="relative z-10">
                <div className={`p-3 rounded-2xl w-fit mb-4 ${color} bg-white/10 backdrop-blur-sm shadow-inner`}>
                    <Icon size={24} className="text-white" />
                </div>
                <h3 className="text-3xl font-black text-white tracking-tight mb-1">{value}</h3>
                <p className="text-sm font-bold text-white/80 uppercase tracking-wider">{title}</p>
                <p className="text-xs text-white/60 mt-2 font-medium">{subtitle}</p>
            </div>
        </motion.div>
    );

    const perms = userData?.permissions?.dashboard?.statsCards || {};

    return (
        <div className="space-y-8 pb-20">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-end gap-4">
                <div>
                    <h1 className="text-4xl font-extrabold bg-gradient-to-r from-primary to-violet-600 bg-clip-text text-transparent">
                        Welcome back, {userData.fullName.split(' ')[0]}!
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

            <AINewsTicker />

            {/* Top Horizontal Leaderboard */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card/50 backdrop-blur-sm border rounded-3xl p-6 shadow-lg relative overflow-hidden"
            >
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                    <Star size={200} />
                </div>
                <div className="mb-6 flex items-center gap-2 relative z-10">
                    <Star className="text-yellow-500 fill-yellow-500 animate-pulse" size={24} />
                    <h2 className="text-xl font-bold">Top Earners Podium</h2>
                </div>
                <div className="relative z-10">
                    <Leaderboard
                        teamLeaders={leaderboardData.teamLeaders}
                        riders={leaderboardData.riders}
                        leads={leaderboardData.leads}
                    />
                </div>
            </motion.div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

                {/* Rider Stats */}
                {perms.totalRiders && (
                    <StatCard
                        title="Total Riders"
                        value={stats.totalRiders}
                        subtitle="Assigned to your team"
                        icon={Users}
                        color="text-blue-100"
                        gradient="bg-gradient-to-br from-blue-600 to-indigo-700"
                        onClick={() => handleNavigate('/team-leader/riders', { filter: 'all' })}
                    />
                )}
                {perms.activeRiders && (
                    <StatCard
                        title="Active Riders"
                        value={stats.activeRiders}
                        subtitle="Currently on duty"
                        icon={UserCheck}
                        color="text-emerald-100"
                        gradient="bg-gradient-to-br from-emerald-500 to-teal-600"
                        onClick={() => handleNavigate('/team-leader/riders', { filter: 'active' })}
                    />
                )}
                {perms.inactiveRiders && (
                    <StatCard
                        title="Inactive"
                        value={stats.inactiveRiders}
                        subtitle="Needs attention"
                        icon={AlertCircle}
                        color="text-amber-100"
                        gradient="bg-gradient-to-br from-amber-500 to-orange-600"
                        onClick={() => handleNavigate('/team-leader/riders', { filter: 'inactive' })}
                    />
                )}
                {perms.deletedRiders && (
                    <StatCard
                        title="Deleted"
                        value={stats.deletedRiders}
                        subtitle="Removed from fleet"
                        icon={UserX}
                        color="text-rose-100"
                        gradient="bg-gradient-to-br from-rose-500 to-pink-600"
                        onClick={() => handleNavigate('/team-leader/riders', { filter: 'deleted' })}
                    />
                )}

                {/* Revenue & Leads */}
                {perms.revenue && (
                    <>
                        <motion.div
                            whileHover={{ y: -5 }}
                            onClick={() => handleNavigate('/team-leader/reports', { template: 'wallet_summary' })}
                            className="cursor-pointer relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br from-violet-600 via-purple-700 to-fuchsia-800 text-white shadow-xl group border border-white/10"
                        >
                            <div className="absolute top-0 right-0 p-4 opacity-10"><Wallet size={100} /></div>
                            <div className="relative z-10 flex flex-col h-full justify-between">
                                <div>
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2 bg-white/20 rounded-xl"><Wallet size={24} /></div>
                                        <span className="font-bold uppercase tracking-wider text-sm opacity-80">Money Collected</span>
                                    </div>
                                    <h3 className="text-3xl font-black tracking-tight">₹{stats.totalPositiveAmount.toLocaleString('en-IN')}</h3>
                                    <div className="mt-4 flex items-center gap-2 text-sm font-medium bg-white/10 w-fit px-3 py-1 rounded-full">
                                        <TrendingUp size={14} /> {stats.positiveWallet} Riders
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        <motion.div
                            whileHover={{ y: -5 }}
                            onClick={() => handleNavigate('/team-leader/reports', { template: 'negative_wallet' })}
                            className="cursor-pointer relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br from-red-600 to-rose-700 text-white shadow-xl group border border-white/10"
                        >
                            <div className="absolute top-0 right-0 p-4 opacity-10"><AlertCircle size={100} /></div>
                            <div className="relative z-10 flex flex-col h-full justify-between">
                                <div>
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2 bg-white/20 rounded-xl"><TrendingDown size={24} /></div>
                                        <span className="font-bold uppercase tracking-wider text-sm opacity-80">Pending Dues</span>
                                    </div>
                                    <h3 className="text-3xl font-black tracking-tight">₹{Math.abs(stats.totalNegativeAmount).toLocaleString('en-IN')}</h3>
                                    <div className="mt-4 flex items-center gap-2 text-sm font-medium bg-white/10 w-fit px-3 py-1 rounded-full">
                                        <AlertCircle size={14} /> {stats.negativeWallet} Riders
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}

                {/* Lead Stats Card */}
                {(perms.totalLeads || perms.convertedLeads) && (
                    <motion.div
                        whileHover={{ y: -5 }}
                        onClick={() => handleNavigate('/team-leader/leads')}
                        className="cursor-pointer relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-xl border border-white/10"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-10"><Smartphone size={100} /></div>
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-white/20 rounded-xl"><Zap size={24} /></div>
                                <span className="font-bold uppercase tracking-wider text-sm opacity-80">Lead Performance</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs opacity-70 uppercase font-bold">Total</p>
                                    <p className="text-2xl font-black">{stats.totalLeads}</p>
                                </div>
                                <div>
                                    <p className="text-xs opacity-70 uppercase font-bold">Converted</p>
                                    <p className="text-2xl font-black">{stats.convertedLeads}</p>
                                </div>
                            </div>
                            <div className="mt-4 w-full bg-black/20 rounded-full h-2">
                                <div
                                    className="bg-white h-2 rounded-full transition-all duration-1000"
                                    style={{ width: `${stats.totalLeads > 0 ? (stats.convertedLeads / stats.totalLeads) * 100 : 0}%` }}
                                />
                            </div>
                            <p className="text-xs mt-2 text-white/70 text-right font-medium">
                                {stats.totalLeads > 0 ? Math.round((stats.convertedLeads / stats.totalLeads) * 100) : 0}% Conversion Rate
                            </p>
                        </div>
                    </motion.div>
                )}
            </div>

            {/* Quick Actions Tiles */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Add Rider', icon: Users, path: '/team-leader/riders/new', color: 'text-blue-500', bg: 'bg-blue-500/10' },
                    { label: 'New Lead', icon: Zap, path: '/team-leader/leads', color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
                    { label: 'Reports', icon: FileText, path: '/team-leader/reports', color: 'text-purple-500', bg: 'bg-purple-500/10' },
                    { label: 'My Activity', icon: Activity, path: '/team-leader/activity-log', color: 'text-orange-500', bg: 'bg-orange-500/10' },
                ].map((action, idx) => (
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
        </div>
    );
};

export default Dashboard;
