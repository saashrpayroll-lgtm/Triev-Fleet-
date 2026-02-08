import React, { useEffect, useState } from 'react';
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { TrendingUp, Users, Filter, Wallet, RefreshCw } from 'lucide-react';
import { AnalyticsService, AnalyticsData } from '@/services/AnalyticsService';
import { toast } from 'sonner';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const Analytics: React.FC = () => {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            const result = await AnalyticsService.fetchDashboardAnalytics();
            setData(result);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load analytics data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="space-y-8 pb-10 animate-in fade-in duration-500">
            <div className="flex justify-between items-start">
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                        Analytics & Reports
                    </h1>
                    <p className="text-muted-foreground">Real-time performance metrics and business insights.</p>
                </div>
                <button onClick={fetchData} className="p-2 hover:bg-muted rounded-full transition-colors">
                    <RefreshCw size={20} className="text-muted-foreground" />
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-card border rounded-xl p-5 shadow-sm">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Total Riders</p>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-3xl font-bold">{data.kpis.totalRiders}</span>
                        <span className="text-xs text-green-500 font-medium">Active: {data.kpis.activeRiders}</span>
                    </div>
                </div>
                <div className="bg-card border rounded-xl p-5 shadow-sm">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Total Leads</p>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-3xl font-bold">{data.kpis.totalLeads}</span>
                    </div>
                </div>
                <div className="bg-card border rounded-xl p-5 shadow-sm">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Conversion Rate</p>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-3xl font-bold">{data.kpis.conversionRate}%</span>
                        <span className="text-xs text-muted-foreground">Lead to Rider</span>
                    </div>
                </div>
                <div className="bg-card border rounded-xl p-5 shadow-sm">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Wallet Health</p>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-xs font-medium text-emerald-600">
                            {data.walletHealth.find(w => w.name.includes('Positive'))?.value || 0} Positive
                        </span>
                        <span className="text-xs font-medium text-red-500">
                            {data.walletHealth.find(w => w.name.includes('Negative'))?.value || 0} Negative
                        </span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Rider Growth */}
                <div className="bg-card border rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="p-2 bg-indigo-500/10 rounded-lg">
                            <TrendingUp className="text-indigo-500" size={20} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg">Rider Growth Trend</h3>
                            <p className="text-xs text-muted-foreground">New riders onboarded (Last 6 Months)</p>
                        </div>
                    </div>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data.riderGrowth}>
                                <defs>
                                    <linearGradient id="colorRiders" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                />
                                <Area type="monotone" dataKey="riders" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorRiders)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Lead Funnel */}
                <div className="bg-card border rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="p-2 bg-amber-500/10 rounded-lg">
                            <Filter className="text-amber-500" size={20} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg">Lead Conversion Funnel</h3>
                            <p className="text-xs text-muted-foreground">Lead status distribution</p>
                        </div>
                    </div>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.leadFunnel} layout="horizontal">
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                <Tooltip
                                    cursor={{ fill: 'transparent' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                />
                                <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={50} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Client Distribution */}
                <div className="bg-card border rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <Users className="text-blue-500" size={20} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg">Client Distribution</h3>
                            <p className="text-xs text-muted-foreground">Top 5 Clients by Rider Count</p>
                        </div>
                    </div>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data.clientDistribution}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {data.clientDistribution.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Wallet Health */}
                <div className="bg-card border rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="p-2 bg-emerald-500/10 rounded-lg">
                            <Wallet className="text-emerald-600" size={20} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg">Wallet Health</h3>
                            <p className="text-xs text-muted-foreground">Rider Balance Analysis</p>
                        </div>
                    </div>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data.walletHealth}
                                    cx="50%"
                                    cy="50%"
                                    startAngle={180}
                                    endAngle={0}
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {data.walletHealth.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="text-center -mt-10">
                            <p className="text-sm font-medium text-muted-foreground">Total Balance Liability</p>
                            {/* Placeholder for total amount if we had it */}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Analytics;
