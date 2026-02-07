import React, { useState, useMemo } from 'react';
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    AreaChart, Area
} from 'recharts';
import { User, Rider, Lead } from '@/types';
import { format, subDays, isSameDay } from 'date-fns';
import { Users, BarChart2, TrendingUp } from 'lucide-react';

interface TLPerformanceAnalyticsProps {
    teamLeaders: User[];
    riders: Rider[];
    leads: Lead[];
}

type TimeRange = '7d' | '30d' | '3m';
type ComparisonMetric = 'revenue' | 'leads' | 'active_riders';

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe', '#00C49F'];

const TLPerformanceAnalytics: React.FC<TLPerformanceAnalyticsProps> = ({ teamLeaders, riders, leads }) => {
    const [activeTab, setActiveTab] = useState<'individual' | 'comparison'>('individual');

    // -- Individual State --
    const [selectedTLId, setSelectedTLId] = useState<string>(teamLeaders[0]?.id || '');
    const [timeRange, setTimeRange] = useState<TimeRange>('30d');

    // -- Comparison State --
    const [selectedTLs, setSelectedTLs] = useState<string[]>(teamLeaders.slice(0, 3).map(u => u.id));
    const [compMetric, setCompMetric] = useState<ComparisonMetric>('revenue');

    // --- Helpers ---
    const getTLName = (id: string) => teamLeaders.find(u => u.id === id)?.fullName || 'Unknown';

    // --- Individual Data Processing ---
    const individualData = useMemo(() => {
        if (!selectedTLId) return [];

        const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
        const data = [];
        const now = new Date();

        for (let i = days - 1; i >= 0; i--) {
            const date = subDays(now, i);
            // dayStart removed as it was unused

            // Filter riders/leads for this TL up to this day (cumulative or daily?)
            // Let's do daily snapshots for "Leads Generated" and "Revenue Collected" (approx)
            // Note: We don't have transaction history in this mocked context, so we'll estimate "Active Riders" history via created_at

            const daysLeads = leads.filter(l =>
                l.createdBy === selectedTLId &&
                isSameDay(new Date(l.createdAt), date)
            ).length;

            // Approximate "Active Riders" on this day (cumulative)
            const activeRiders = riders.filter(r =>
                (r.teamLeaderId === selectedTLId || r.teamLeaderId === selectedTLId) && // Handle both field styles if inconsistent
                new Date(r.createdAt) <= date &&
                r.status === 'active'
            ).length;

            data.push({
                date: format(date, 'MMM dd'),
                leads: daysLeads,
                activeRiders: activeRiders
            });
        }
        return data;
    }, [selectedTLId, timeRange, leads, riders]);

    // --- Comparison Data Processing ---
    const comparisonData = useMemo(() => {
        const days = 14; // Last 2 weeks for comparison
        const data = [];
        const now = new Date();

        // X-Axis tokens (Dates)
        for (let i = days - 1; i >= 0; i--) {
            const date = subDays(now, i);
            const point: any = { date: format(date, 'MMM dd') };

            selectedTLs.forEach(tlId => {
                const tlName = getTLName(tlId);

                if (compMetric === 'leads') {
                    point[tlName] = leads.filter(l =>
                        l.createdBy === tlId && isSameDay(new Date(l.createdAt), date)
                    ).length;
                } else if (compMetric === 'active_riders') {
                    point[tlName] = riders.filter(r =>
                        r.teamLeaderId === tlId &&
                        new Date(r.createdAt) <= date &&
                        r.status === 'active'
                    ).length;
                } else {
                    // Revenue (Simulated as Active Riders * Avg Ticket or just Wallet Sum logic)
                    // Since we don't have daily wallet snapshots, we'll use "Total Wallet of Riders Active on that day"
                    const tlRiders = riders.filter(r =>
                        r.teamLeaderId === tlId && new Date(r.createdAt) <= date
                    );
                    point[tlName] = tlRiders.reduce((sum, r) => sum + (r.walletAmount > 0 ? r.walletAmount : 0), 0);
                }
            });
            data.push(point);
        }
        return data;
    }, [selectedTLs, compMetric, leads, riders, teamLeaders]);


    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Header / Tabs */}
            <div className="border-b px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50/50">
                <div className="flex items-center gap-2">
                    <BarChart2 className="text-indigo-600" size={20} />
                    <h3 className="font-bold text-gray-800">Performance Analytics</h3>
                </div>

                <div className="flex bg-gray-200/50 p-1 rounded-lg">
                    <button
                        onClick={() => setActiveTab('individual')}
                        className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${activeTab === 'individual'
                            ? 'bg-white text-indigo-600 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Individual Deep Dive
                    </button>
                    <button
                        onClick={() => setActiveTab('comparison')}
                        className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${activeTab === 'comparison'
                            ? 'bg-white text-indigo-600 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Comparison
                    </button>
                </div>
            </div>

            <div className="p-6">
                {/* --- INDIVIDUAL TAB --- */}
                {activeTab === 'individual' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                        {/* Filters */}
                        <div className="flex flex-wrap items-center gap-4 mb-6">
                            <select
                                value={selectedTLId}
                                onChange={(e) => setSelectedTLId(e.target.value)}
                                className="px-3 py-2 border rounded-lg bg-white text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="">Select Team Leader</option>
                                {teamLeaders.map(tl => (
                                    <option key={tl.id} value={tl.id}>{tl.fullName}</option>
                                ))}
                            </select>

                            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                                {(['7d', '30d', '3m'] as TimeRange[]).map(r => (
                                    <button
                                        key={r}
                                        onClick={() => setTimeRange(r)}
                                        className={`px-3 py-1 text-xs font-medium rounded-md ${timeRange === r ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500'
                                            }`}
                                    >
                                        {r === '3m' ? '90 Days' : r === '30d' ? '30 Days' : '7 Days'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Charts Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="h-[300px] border rounded-xl p-4 bg-white">
                                <h4 className="text-sm font-semibold text-gray-500 mb-4 flex items-center gap-2">
                                    <Users size={16} /> Active Riders Growth
                                </h4>
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={individualData}>
                                        <defs>
                                            <linearGradient id="colorRiders" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                                                <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis fontSize={12} tickLine={false} axisLine={false} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                        />
                                        <Area type="monotone" dataKey="activeRiders" stroke="#8884d8" fillOpacity={1} fill="url(#colorRiders)" name="Active Riders" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="h-[300px] border rounded-xl p-4 bg-white">
                                <h4 className="text-sm font-semibold text-gray-500 mb-4 flex items-center gap-2">
                                    <TrendingUp size={16} /> Lead Conversion Trend
                                </h4>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={individualData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis fontSize={12} tickLine={false} axisLine={false} />
                                        <Tooltip
                                            cursor={{ fill: '#f3f4f6' }}
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                        />
                                        <Bar dataKey="leads" fill="#82ca9d" radius={[4, 4, 0, 0]} name="New Leads" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- COMPARISON TAB --- */}
                {activeTab === 'comparison' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        {/* Controls */}
                        <div className="flex flex-wrap justify-between gap-4 mb-6">
                            <div className="flex flex-wrap gap-2">
                                {teamLeaders.map(tl => (
                                    <button
                                        key={tl.id}
                                        onClick={() => {
                                            if (selectedTLs.includes(tl.id)) {
                                                setSelectedTLs(selectedTLs.filter(id => id !== tl.id));
                                            } else {
                                                if (selectedTLs.length < 5) setSelectedTLs([...selectedTLs, tl.id]);
                                            }
                                        }}
                                        className={`px-3 py-1 text-xs font-semibold rounded-full border transition-all ${selectedTLs.includes(tl.id)
                                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                            : 'bg-white border-gray-200 text-gray-500 hover:border-indigo-300'
                                            }`}
                                    >
                                        {tl.fullName}
                                    </button>
                                ))}
                                <span className="text-xs text-gray-400 self-center ml-2">(Max 5)</span>
                            </div>

                            <select
                                value={compMetric}
                                onChange={(e) => setCompMetric(e.target.value as ComparisonMetric)}
                                className="px-3 py-2 border rounded-lg bg-white text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="revenue">Total Collections</option>
                                <option value="active_riders">Active Riders</option>
                                <option value="leads">Leads Generated</option>
                            </select>
                        </div>

                        {/* Comparison Chart */}
                        <div className="h-[400px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={comparisonData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    />
                                    <Legend />
                                    {selectedTLs.map((tlId, index) => (
                                        <Line
                                            key={tlId}
                                            type="monotone"
                                            dataKey={getTLName(tlId)}
                                            stroke={COLORS[index % COLORS.length]}
                                            strokeWidth={3}
                                            dot={{ r: 4 }}
                                            activeDot={{ r: 6 }}
                                        />
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TLPerformanceAnalytics;
