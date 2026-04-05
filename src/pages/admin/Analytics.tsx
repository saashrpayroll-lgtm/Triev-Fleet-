import React, { useEffect, useState } from 'react';
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
    TrendingUp, Users, Filter, Wallet, RefreshCw,
    Activity, ArrowUpRight, ArrowDownRight, UserCheck,
    UserX, BarChart2, Target, Zap, AlertCircle, Trophy
} from 'lucide-react';
import { AnalyticsService, AnalyticsData } from '@/services/AnalyticsService';
import { supabase } from '@/config/supabase';
import { toast } from 'sonner';
import AdminWalletBifurcation from '@/components/dashboard/AdminWalletBifurcation';

// Premium color palette
const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];
const GRADIENT_COLORS = [
    { from: '#6366f1', to: '#818cf8' },
    { from: '#22c55e', to: '#4ade80' },
    { from: '#f59e0b', to: '#fcd34d' },
    { from: '#ef4444', to: '#f87171' },
    { from: '#8b5cf6', to: '#a78bfa' },
];

// Custom tooltip for charts
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-popover border border-border rounded-xl px-4 py-3 shadow-xl text-sm">
                <p className="font-semibold text-foreground mb-1">{label}</p>
                {payload.map((entry: any, i: number) => (
                    <p key={i} style={{ color: entry.color || entry.fill }} className="font-medium">
                        {entry.name}: <span className="font-bold">{entry.value}</span>
                    </p>
                ))}
            </div>
        );
    }
    return null;
};


// Section header
const SectionHeader = ({ icon, title, subtitle, color }: { icon: React.ReactNode; title: string; subtitle: string; color: string }) => (
    <div className="flex items-center gap-3 mb-5">
        <div className={`p-2.5 rounded-xl ${color}`}>
            {icon}
        </div>
        <div>
            <h3 className="font-bold text-base text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
    </div>
);

interface AnalyticsProps {
    scopedCityOpsId?: string;
    scopedRmIds?: string[];
    scopedTlIds?: string[];
}

const Analytics: React.FC<AnalyticsProps> = ({ scopedCityOpsId, scopedRmIds, scopedTlIds }) => {
    const { userData } = useSupabaseAuth();
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const result = await AnalyticsService.fetchDashboardAnalytics();
            setData(result);
            setLastUpdated(new Date());
        } catch (error) {
            console.error(error);
            toast.error("Failed to load analytics data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        
        let debounceTimer: ReturnType<typeof setTimeout> | null = null;
        const fetchDebounced = () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => fetchData(), 1000);
        };

        // ✅ Real-time subscriptions — auto-refresh when riders/leads change
        const ridersChannel = supabase
            .channel('analytics-riders')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'riders' }, fetchDebounced)
            .subscribe();

        const leadsChannel = supabase
            .channel('analytics-leads')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, fetchDebounced)
            .subscribe();

        return () => {
            supabase.removeChannel(ridersChannel);
            supabase.removeChannel(leadsChannel);
            if (debounceTimer) clearTimeout(debounceTimer);
        };
    }, []);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-96 gap-4">
                <div className="relative">
                    <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                    <div className="w-10 h-10 rounded-full border-4 border-purple-400/20 border-t-purple-500 animate-spin absolute top-3 left-3" />
                </div>
                <p className="text-muted-foreground text-sm font-medium animate-pulse">Loading Analytics...</p>
            </div>
        );
    }

    if (!data) return null;

    const positiveWallet = data.walletHealth.find(w => w.name.includes('Positive'))?.value || 0;
    const negativeWallet = data.walletHealth.find(w => w.name.includes('Negative'))?.value || 0;
    const zeroWallet = data.walletHealth.find(w => w.name.includes('Zero'))?.value || 0;
    const totalWalletRiders = positiveWallet + negativeWallet + zeroWallet;
    const walletHealthPct = totalWalletRiders > 0 ? Math.round((positiveWallet / totalWalletRiders) * 100) : 0;

    const convertedLeads = data.leadFunnel.find(l => l.name === 'Converted')?.value || 0;
    const lostLeads = data.leadFunnel.find(l => l.name === 'Lost')?.value || 0;
    const newLeads = data.leadFunnel.find(l => l.name === 'New Leads')?.value || 0;

    const inactiveRiders = data.kpis.totalRiders - data.kpis.activeRiders;
    const activeRiderPct = data.kpis.totalRiders > 0
        ? Math.round((data.kpis.activeRiders / data.kpis.totalRiders) * 100) : 0;


    return (
        <div className="space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* ─── PAGE HEADER ─── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                        Analytics &amp; Reports
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                        <Activity size={13} className="text-green-500" />
                        Real-time performance metrics &amp; business intelligence
                        {lastUpdated && (
                            <span className="ml-2 text-xs text-muted-foreground/70">
                                · Last updated {lastUpdated.toLocaleTimeString()}
                            </span>
                        )}
                    </p>
                </div>
                <button
                    onClick={fetchData}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium shadow-md hover:opacity-90 transition-all hover:shadow-lg active:scale-95"
                >
                    <RefreshCw size={14} />
                    Refresh Data
                </button>
            </div>

            {/* ─── KPI CARDS ─── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

                {/* Total Riders */}
                <div className="relative overflow-hidden bg-gradient-to-br from-indigo-500 to-indigo-700 text-white rounded-2xl p-5 shadow-lg">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-8 translate-x-8" />
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-widest text-white/70">Total Riders</p>
                            <p className="text-4xl font-black mt-2 leading-none">{data.kpis.totalRiders}</p>
                        </div>
                        <div className="p-2.5 bg-white/20 rounded-xl">
                            <Users size={22} className="text-white" />
                        </div>
                    </div>
                    <div className="flex items-center gap-3 mt-4 text-xs font-medium">
                        <span className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded-full">
                            <UserCheck size={11} /> Active: {data.kpis.activeRiders}
                        </span>
                        <span className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded-full">
                            <UserX size={11} /> Inactive: {inactiveRiders}
                        </span>
                    </div>
                    <div className="mt-3 h-1.5 bg-white/20 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-white rounded-full transition-all duration-1000"
                            style={{ width: `${activeRiderPct}%` }}
                        />
                    </div>
                    <p className="text-xs text-white/60 mt-1">{activeRiderPct}% Active Rate</p>
                </div>

                {/* Total Leads */}
                <div className="relative overflow-hidden bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-2xl p-5 shadow-lg">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-8 translate-x-8" />
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-widest text-white/70">Total Leads</p>
                            <p className="text-4xl font-black mt-2 leading-none">{data.kpis.totalLeads}</p>
                        </div>
                        <div className="p-2.5 bg-white/20 rounded-xl">
                            <Target size={22} className="text-white" />
                        </div>
                    </div>
                    <div className="flex items-center gap-3 mt-4 text-xs font-medium">
                        <span className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded-full">
                            <Zap size={11} /> New: {newLeads}
                        </span>
                        <span className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded-full">
                            <ArrowDownRight size={11} /> Lost: {lostLeads}
                        </span>
                    </div>
                    <div className="mt-3 h-1.5 bg-white/20 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-white rounded-full transition-all duration-1000"
                            style={{ width: `${data.kpis.totalLeads > 0 ? Math.round((convertedLeads / data.kpis.totalLeads) * 100) : 0}%` }}
                        />
                    </div>
                    <p className="text-xs text-white/60 mt-1">{convertedLeads} Converted</p>
                </div>

                {/* Conversion Rate */}
                <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-2xl p-5 shadow-lg">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-8 translate-x-8" />
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-widest text-white/70">Conversion Rate</p>
                            <p className="text-4xl font-black mt-2 leading-none">{data.kpis.conversionRate}<span className="text-xl">%</span></p>
                        </div>
                        <div className="p-2.5 bg-white/20 rounded-xl">
                            <BarChart2 size={22} className="text-white" />
                        </div>
                    </div>
                    <div className="mt-4 h-1.5 bg-white/20 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-white rounded-full transition-all duration-1000"
                            style={{ width: `${data.kpis.conversionRate}%` }}
                        />
                    </div>
                    <p className="text-xs text-white/60 mt-1">Lead → Rider Conversion</p>
                    <div className="mt-2 text-xs font-medium">
                        {data.kpis.conversionRate >= 30 ? (
                            <span className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded-full w-fit">
                                <ArrowUpRight size={11} /> Performing Well
                            </span>
                        ) : (
                            <span className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded-full w-fit">
                                <AlertCircle size={11} /> Needs Attention
                            </span>
                        )}
                    </div>
                </div>

                {/* Wallet Health */}
                <div className="relative overflow-hidden bg-gradient-to-br from-purple-500 to-violet-700 text-white rounded-2xl p-5 shadow-lg">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-8 translate-x-8" />
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-widest text-white/70">Wallet Health</p>
                            <p className="text-4xl font-black mt-2 leading-none">{walletHealthPct}<span className="text-xl">%</span></p>
                        </div>
                        <div className="p-2.5 bg-white/20 rounded-xl">
                            <Wallet size={22} className="text-white" />
                        </div>
                    </div>
                    <div className="flex items-center gap-2 mt-4 text-xs font-medium flex-wrap">
                        <span className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded-full">
                            🟢 +ve: {positiveWallet}
                        </span>
                        <span className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded-full">
                            🔴 -ve: {negativeWallet}
                        </span>
                        <span className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded-full">
                            ⚪ Zero: {zeroWallet}
                        </span>
                    </div>
                </div>
            </div>

            {/* ─── QUICK STATS ROW ─── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm">
                    <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                        <UserCheck size={17} className="text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">Active Riders</p>
                        <p className="text-lg font-bold text-foreground">{data.kpis.activeRiders}</p>
                    </div>
                </div>
                <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm">
                    <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                        <UserX size={17} className="text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">Inactive Riders</p>
                        <p className="text-lg font-bold text-foreground">{inactiveRiders}</p>
                    </div>
                </div>
                <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm">
                    <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                        <Zap size={17} className="text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">Converted Leads</p>
                        <p className="text-lg font-bold text-foreground">{convertedLeads}</p>
                    </div>
                </div>
                <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm">
                    <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                        <TrendingUp size={17} className="text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">Wallet +ve</p>
                        <p className="text-lg font-bold text-foreground">{positiveWallet}</p>
                    </div>
                </div>
            </div>

            {/* ─── MAIN CHARTS ROW ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* Rider Growth Trend */}
                <div className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                    <SectionHeader
                        icon={<TrendingUp className="text-indigo-500" size={18} />}
                        title="Rider Growth Trend"
                        subtitle="New riders onboarded — Last 6 Months"
                        color="bg-indigo-100 dark:bg-indigo-900/30"
                    />
                    <div className="h-[260px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data.riderGrowth} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorRiders" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.2)" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 12, fontWeight: 600, fill: 'var(--muted-foreground)' }}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                                    allowDecimals={false}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Area
                                    type="monotone"
                                    dataKey="riders"
                                    name="New Riders"
                                    stroke="#6366f1"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorRiders)"
                                    dot={{ fill: '#6366f1', r: 4, strokeWidth: 2, stroke: '#fff' }}
                                    activeDot={{ r: 6, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Lead Conversion Funnel */}
                <div className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                    <SectionHeader
                        icon={<Filter className="text-amber-500" size={18} />}
                        title="Lead Conversion Funnel"
                        subtitle="Status breakdown of all leads"
                        color="bg-amber-100 dark:bg-amber-900/30"
                    />
                    <div className="h-[260px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={data.leadFunnel}
                                margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.2)" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 12, fontWeight: 600, fill: 'var(--muted-foreground)' }}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                                    allowDecimals={false}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="value" name="Count" radius={[8, 8, 0, 0]} barSize={52}>
                                    {data.leadFunnel.map((_, i) => (
                                        <Cell key={i} fill={['#6366f1', '#22c55e', '#ef4444'][i] || '#f59e0b'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    {/* Lead Summary below chart */}
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-lg bg-indigo-50 dark:bg-indigo-900/20 py-2">
                            <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">{newLeads}</p>
                            <p className="text-xs text-muted-foreground font-medium">New</p>
                        </div>
                        <div className="rounded-lg bg-green-50 dark:bg-green-900/20 py-2">
                            <p className="text-lg font-black text-green-600 dark:text-green-400">{convertedLeads}</p>
                            <p className="text-xs text-muted-foreground font-medium">Converted</p>
                        </div>
                        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 py-2">
                            <p className="text-lg font-black text-red-600 dark:text-red-400">{lostLeads}</p>
                            <p className="text-xs text-muted-foreground font-medium">Lost</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── PIE CHARTS ROW ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* Client Distribution */}
                <div className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                    <SectionHeader
                        icon={<Users className="text-blue-500" size={18} />}
                        title="Client Distribution"
                        subtitle="Top 5 clients by rider count"
                        color="bg-blue-100 dark:bg-blue-900/30"
                    />
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="h-[220px] w-full sm:w-[220px] flex-shrink-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <defs>
                                        {GRADIENT_COLORS.map((g, i) => (
                                            <linearGradient key={i} id={`cGrad${i}`} x1="0" y1="0" x2="1" y2="1">
                                                <stop offset="0%" stopColor={g.from} />
                                                <stop offset="100%" stopColor={g.to} />
                                            </linearGradient>
                                        ))}
                                    </defs>
                                    <Pie
                                        data={data.clientDistribution}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={55}
                                        outerRadius={90}
                                        paddingAngle={4}
                                        dataKey="value"
                                    >
                                        {data.clientDistribution.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={`url(#cGrad${index % 5})`} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        {/* Legend as table */}
                        <div className="w-full space-y-2">
                            {data.clientDistribution.map((item, i) => {
                                const pct = data.kpis.totalRiders > 0
                                    ? Math.round((item.value / data.kpis.totalRiders) * 100) : 0;
                                return (
                                    <div key={i} className="flex items-center gap-2">
                                        <span
                                            className="w-3 h-3 rounded-full flex-shrink-0"
                                            style={{ backgroundColor: COLORS[i % COLORS.length] }}
                                        />
                                        <span className="text-sm font-medium text-foreground truncate flex-1">{item.name}</span>
                                        <span className="text-sm font-bold text-foreground">{item.value}</span>
                                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full"
                                                style={{
                                                    width: `${pct}%`,
                                                    backgroundColor: COLORS[i % COLORS.length]
                                                }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Wallet Health */}
                <div className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                    <SectionHeader
                        icon={<Wallet className="text-emerald-500" size={18} />}
                        title="Wallet Health Overview"
                        subtitle="Rider balance distribution analysis"
                        color="bg-emerald-100 dark:bg-emerald-900/30"
                    />
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="h-[220px] w-full sm:w-[220px] flex-shrink-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={data.walletHealth.filter(w => w.value > 0)}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={55}
                                        outerRadius={90}
                                        paddingAngle={4}
                                        dataKey="value"
                                    >
                                        {data.walletHealth.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="w-full space-y-3">
                            {/* Positive */}
                            <div className="flex flex-col gap-1">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-semibold text-green-600 dark:text-green-400 flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> Positive Balance
                                    </span>
                                    <span className="text-sm font-bold text-foreground">{positiveWallet} riders</span>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-green-500 rounded-full transition-all duration-700"
                                        style={{ width: `${totalWalletRiders > 0 ? Math.round((positiveWallet / totalWalletRiders) * 100) : 0}%` }} />
                                </div>
                                <p className="text-xs text-muted-foreground text-right">
                                    {totalWalletRiders > 0 ? Math.round((positiveWallet / totalWalletRiders) * 100) : 0}% of total
                                </p>
                            </div>
                            {/* Negative */}
                            <div className="flex flex-col gap-1">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-semibold text-red-600 dark:text-red-400 flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Negative Balance
                                    </span>
                                    <span className="text-sm font-bold text-foreground">{negativeWallet} riders</span>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-red-500 rounded-full transition-all duration-700"
                                        style={{ width: `${totalWalletRiders > 0 ? Math.round((negativeWallet / totalWalletRiders) * 100) : 0}%` }} />
                                </div>
                                <p className="text-xs text-muted-foreground text-right">
                                    {totalWalletRiders > 0 ? Math.round((negativeWallet / totalWalletRiders) * 100) : 0}% of total
                                </p>
                            </div>
                            {/* Zero */}
                            <div className="flex flex-col gap-1">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-semibold text-slate-500 flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block" /> Zero Balance
                                    </span>
                                    <span className="text-sm font-bold text-foreground">{zeroWallet} riders</span>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-slate-400 rounded-full transition-all duration-700"
                                        style={{ width: `${totalWalletRiders > 0 ? Math.round((zeroWallet / totalWalletRiders) * 100) : 0}%` }} />
                                </div>
                                <p className="text-xs text-muted-foreground text-right">
                                    {totalWalletRiders > 0 ? Math.round((zeroWallet / totalWalletRiders) * 100) : 0}% of total
                                </p>
                            </div>
                            {/* Health Score */}
                            <div className="mt-2 pt-3 border-t border-border flex justify-between items-center">
                                <span className="text-sm text-muted-foreground font-medium">Wallet Health Score</span>
                                <span className={`text-lg font-black ${walletHealthPct >= 60 ? 'text-green-600' : walletHealthPct >= 30 ? 'text-amber-500' : 'text-red-600'}`}>
                                    {walletHealthPct}%
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── ADVANCED WALLET BIFURCATION ─── */}
            <AdminWalletBifurcation />

            {/* ─── TL PERFORMANCE & DEBT HEATMAP (ARPU) ─── */}
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm mb-6">
                <SectionHeader
                    icon={<Trophy className="text-pink-500" size={18} />}
                    title="Team Leader Performance (30 Days)"
                    subtitle="ARPU (Average Revenue Per User) & Debt Liability Matrix"
                    color="bg-pink-100 dark:bg-pink-900/30"
                />
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-border/50 text-xs font-black uppercase text-muted-foreground tracking-wider">
                                <th className="pb-3 px-4">Team Leader</th>
                                <th className="pb-3 px-4 text-center">Active Riders</th>
                                <th className="pb-3 px-4 text-center">30D Collection</th>
                                <th className="pb-3 px-4 text-center">ARPU <span className="text-[10px] font-medium lowercase">(per rider)</span></th>
                                <th className="pb-3 px-4 text-right">Outstanding Debt</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                            {data.tlPerformance.map((tl, i) => {
                                // Debt Heatmap styling
                                let debtBg = 'bg-transparent';
                                let debtText = 'text-foreground';
                                if (tl.totalDebt > 50000) { debtBg = 'bg-red-50 dark:bg-red-900/20'; debtText = 'text-red-600 dark:text-red-400 font-bold'; }
                                else if (tl.totalDebt > 20000) { debtBg = 'bg-orange-50 dark:bg-orange-900/20'; debtText = 'text-orange-600 dark:text-orange-400 font-bold'; }
                                else if (tl.totalDebt > 0) { debtBg = 'bg-amber-50 dark:bg-amber-900/10'; debtText = 'text-amber-600 dark:text-amber-400 font-medium'; }

                                // ARPU Health Score
                                const arpuHealth = tl.arpu >= 2000 ? 'text-green-600' : tl.arpu >= 1000 ? 'text-amber-600' : 'text-red-600';

                                return (
                                    <tr key={tl.tlId} className="hover:bg-muted/30 transition-colors">
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                                    {i + 1}
                                                </div>
                                                <span className="font-semibold text-sm">{tl.tlName}</span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-center font-medium text-sm text-muted-foreground">
                                            {tl.activeRiders}
                                        </td>
                                        <td className="py-3 px-4 text-center font-bold text-sm text-foreground">
                                            ₹{tl.totalCollection.toLocaleString('en-IN')}
                                        </td>
                                        <td className={`py-3 px-4 text-center font-bold text-sm ${arpuHealth}`}>
                                            ₹{tl.arpu.toLocaleString('en-IN')}
                                        </td>
                                        <td className={`py-3 px-4 text-right rounded-r-xl ${debtBg}`}>
                                            <span className={`${debtText} text-sm`}>
                                                {tl.totalDebt > 0 ? `₹${tl.totalDebt.toLocaleString('en-IN')}` : '₹0'}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                            {data.tlPerformance.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="py-8 text-center text-muted-foreground text-sm">
                                        No Team Leader performance data available for the last 30 days.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ─── INSIGHTS / SUMMARY FOOTER ─── */}
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border border-indigo-200/50 dark:border-indigo-800/40 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl">
                        <Activity size={18} className="text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-base text-foreground">Business Insights Summary</h3>
                        <p className="text-xs text-muted-foreground">Key takeaways from your analytics</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-white dark:bg-card rounded-xl px-4 py-3 border border-border flex items-start gap-3">
                        <div className={`mt-0.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${activeRiderPct >= 70 ? 'bg-green-500' : 'bg-amber-500'}`} />
                        <div>
                            <p className="text-sm font-semibold text-foreground">Rider Activity</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {activeRiderPct}% of riders are currently active.{' '}
                                {activeRiderPct >= 70 ? '✅ Healthy fleet utilization.' : '⚠️ Consider reducing inactive riders.'}
                            </p>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-card rounded-xl px-4 py-3 border border-border flex items-start gap-3">
                        <div className={`mt-0.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${data.kpis.conversionRate >= 30 ? 'bg-green-500' : 'bg-red-500'}`} />
                        <div>
                            <p className="text-sm font-semibold text-foreground">Lead Performance</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {data.kpis.conversionRate}% conversion rate.{' '}
                                {data.kpis.conversionRate >= 30 ? '✅ Above benchmark.' : '⚠️ Improve follow-up process.'}
                            </p>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-card rounded-xl px-4 py-3 border border-border flex items-start gap-3">
                        <div className={`mt-0.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${walletHealthPct >= 60 ? 'bg-green-500' : negativeWallet > positiveWallet ? 'bg-red-500' : 'bg-amber-500'}`} />
                        <div>
                            <p className="text-sm font-semibold text-foreground">Wallet Risk</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {negativeWallet} riders with negative balances.{' '}
                                {negativeWallet === 0 ? '✅ No outstanding liabilities.' : `⚠️ ₹ liability risk across ${negativeWallet} accounts.`}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Analytics;
