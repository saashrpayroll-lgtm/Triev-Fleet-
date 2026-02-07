import React, { useState, useMemo, useEffect } from 'react';
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    AreaChart, Area
} from 'recharts';
import { User, Rider, Lead } from '@/types';
import { format, subDays, isSameDay, parseISO } from 'date-fns';
import { Users, BarChart2, TrendingUp, Download, Grid, Table as TableIcon } from 'lucide-react';
import { DashboardService, DailyMetric } from '@/services/DashboardService';
import HeatmapChart from './HeatmapChart';

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
    const [historicalData, setHistoricalData] = useState<DailyMetric[]>([]);
    const [compareMode, setCompareMode] = useState(false);

    // -- Comparison State --
    const [selectedTLs, setSelectedTLs] = useState<string[]>(teamLeaders.slice(0, 3).map(u => u.id));
    const [compMetric, setCompMetric] = useState<ComparisonMetric>('revenue');

    // --- Helpers ---
    const getTLName = (id: string) => teamLeaders.find(u => u.id === id)?.fullName || 'Unknown';

    // --- Fetch Historical Data ---
    useEffect(() => {
        if (selectedTLId) {
            const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;

            // Fetch Current Period
            DashboardService.getHistoricalMetrics(selectedTLId, days).then(data => {
                setHistoricalData(data);
            });

            // Fetch Previous Period (if Compare Mode is on)
            if (compareMode) {
                DashboardService.getHistoricalMetrics(selectedTLId, days * 2).then(fullData => {
                    setHistoricalData(fullData);
                });
            }
        }
    }, [selectedTLId, timeRange, compareMode]);

    // --- Individual Data Processing ---
    const individualData = useMemo(() => {
        if (!selectedTLId) return [];

        const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
        const data = [];
        const now = new Date();

        for (let i = days - 1; i >= 0; i--) {
            // Current Period Date
            const date = subDays(now, i);
            const dateStr = format(date, 'yyyy-MM-dd');

            // Previous Period Date (shifted by 'days')
            const prevDate = subDays(date, days);
            const prevDateStr = format(prevDate, 'yyyy-MM-dd');

            // Find Metrics
            const currentEntry = historicalData.find(d => d.date === dateStr);
            const prevEntry = compareMode ? historicalData.find(d => d.date === prevDateStr) : null;

            // Current Values (Fallback to live data if today/recent)
            let currentLeads = currentEntry ? currentEntry.metrics.leads_generated : 0;
            let currentActive = currentEntry ? currentEntry.metrics.active_riders : 0;

            if (!currentEntry) {
                // Fallback calculation for metrics not yet in DB (e.g. Today)
                currentLeads = leads.filter(l => l.createdBy === selectedTLId && isSameDay(new Date(l.createdAt), date)).length;
                currentActive = riders.filter(r => (r.teamLeaderId === selectedTLId) && new Date(r.createdAt) <= date && r.status === 'active').length;
            }

            // Previous Values
            let prevLeads = prevEntry ? prevEntry.metrics.leads_generated : 0;
            let prevActive = prevEntry ? prevEntry.metrics.active_riders : 0;

            // Fallback for Previous if missing (simulated for demo if needed, or 0)
            if (!prevEntry && compareMode) {
                // Try calculating from raw data if within range?
                prevLeads = leads.filter(l => l.createdBy === selectedTLId && isSameDay(new Date(l.createdAt), prevDate)).length;
                prevActive = riders.filter(r => (r.teamLeaderId === selectedTLId) && new Date(r.createdAt) <= prevDate && r.status === 'active').length;
            }

            data.push({
                date: format(date, 'MMM dd'),
                activeRiders: currentActive,
                leads: currentLeads,
                // Previous Data
                prevActiveRiders: compareMode ? prevActive : undefined,
                prevLeads: compareMode ? prevLeads : undefined,
            });
        }
        return data;
    }, [selectedTLId, timeRange, leads, riders, historicalData, compareMode]);

    // --- Heatmap Data (Leads Activity) ---
    const heatmapData = useMemo(() => {
        if (!selectedTLId) return [];
        // Filter leads by selected TL
        const tlLeads = leads.filter(l => l.createdBy === selectedTLId);

        // Aggregate by date (just count for now, ignoring time for simplified daily heatmap)
        // If we want hourly, we'd need a different chart type or very dense grid
        const activityMap = new Map<string, number>();

        tlLeads.forEach(l => {
            const dateStr = format(parseISO(l.createdAt), 'yyyy-MM-dd');
            activityMap.set(dateStr, (activityMap.get(dateStr) || 0) + 1);
        });

        // Convert Map to Array
        return Array.from(activityMap.entries()).map(([dateStr, count]) => ({
            date: parseISO(dateStr),
            value: count
        }));
    }, [selectedTLId, leads]);


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

    // --- Export Function ---
    const handleExport = () => {
        const csvContent = "data:text/csv;charset=utf-8,"
            + ["Date", "Active Riders", "Leads"].join(",") + "\n"
            + individualData.map(e => `${e.date},${e.activeRiders},${e.leads}`).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `performance_export_${selectedTLId}_${timeRange}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Header / Tabs */}
            <div className="border-b px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50/50">
                <div className="flex items-center gap-2">
                    <BarChart2 className="text-indigo-600" size={20} />
                    <h3 className="font-bold text-gray-800">Performance Analytics</h3>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-indigo-600 bg-white border rounded-md shadow-sm transition-all"
                        title="Export CSV"
                    >
                        <Download size={14} /> Export
                    </button>
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

                            {/* Compare Mode Toggle */}
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-600 cursor-pointer select-none">
                                {/* Checkbox for Comparison Mode */}
                                <input
                                    type="checkbox"
                                    checked={compareMode}
                                    onChange={(e) => setCompareMode(e.target.checked)}
                                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300"
                                />
                                Compare with previous period
                            </label>
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

                        {/* Heatmap Section */}
                        <div className="border rounded-xl p-4 bg-white">
                            <h4 className="text-sm font-semibold text-gray-500 mb-4 flex items-center gap-2">
                                <Grid size={16} /> Activity Heatmap (Leads Generated)
                            </h4>
                            <HeatmapChart data={heatmapData} />
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
                        <div className="h-[400px] w-full border rounded-xl p-4">
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

                        {/* Comparison Table */}
                        <div className="border rounded-xl bg-white overflow-hidden">
                            <div className="px-4 py-3 bg-gray-50 border-b flex items-center gap-2">
                                <TableIcon size={16} className="text-gray-500" />
                                <h4 className="text-sm font-bold text-gray-700">Detailed Comparison</h4>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-gray-50/50 text-left border-b">
                                            <th className="px-4 py-3 font-medium text-gray-500">Metric</th>
                                            {selectedTLs.map(tlId => (
                                                <th key={tlId} className="px-4 py-3 font-bold text-gray-800">{getTLName(tlId)}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        <tr>
                                            <td className="px-4 py-3 font-medium text-gray-600">Total Rides (Active)</td>
                                            {selectedTLs.map(tlId => (
                                                <td key={tlId} className="px-4 py-3">
                                                    {riders.filter(r => r.teamLeaderId === tlId && r.status === 'active').length}
                                                </td>
                                            ))}
                                        </tr>
                                        <tr>
                                            <td className="px-4 py-3 font-medium text-gray-600">Total Leads</td>
                                            {selectedTLs.map(tlId => (
                                                <td key={tlId} className="px-4 py-3">
                                                    {leads.filter(l => l.createdBy === tlId).length}
                                                </td>
                                            ))}
                                        </tr>
                                        <tr>
                                            <td className="px-4 py-3 font-medium text-gray-600">Conversion Rate</td>
                                            {selectedTLs.map(tlId => {
                                                const total = leads.filter(l => l.createdBy === tlId).length;
                                                const converted = leads.filter(l => l.createdBy === tlId && l.status === 'Convert').length;
                                                const rate = total > 0 ? Math.round((converted / total) * 100) : 0;
                                                return <td key={tlId} className="px-4 py-3">{rate}%</td>
                                            })}
                                        </tr>
                                        <tr>
                                            <td className="px-4 py-3 font-medium text-gray-600">Avg Wallet Balance</td>
                                            {selectedTLs.map(tlId => {
                                                const tlRiders = riders.filter(r => r.teamLeaderId === tlId);
                                                const total = tlRiders.reduce((sum, r) => sum + r.walletAmount, 0);
                                                const avg = tlRiders.length > 0 ? Math.round(total / tlRiders.length) : 0;
                                                return (
                                                    <td key={tlId} className={`px-4 py-3 font-mono ${avg < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                        ₹{avg.toLocaleString()}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TLPerformanceAnalytics;
