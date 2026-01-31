import React from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    Cell, FunnelChart, Funnel, LabelList,
    Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';

interface DashboardChartsProps {
    riderData: { name: string; value: number; color: string }[]; // Active, Inactive, Deleted
    walletData: { name: string; value: number }[]; // Inflow, Outflow
    leadData: { name: string; value: number; color: string }[]; // Converted, Lost
}

const DashboardCharts: React.FC<DashboardChartsProps> = ({ riderData, walletData, leadData }) => {

    // Prepare Funnel Data (Total -> Converted)
    const totalLeads = leadData.reduce((sum, item) => sum + item.value, 0);
    const funnelData = [
        { name: 'Total Leads', value: totalLeads, fill: '#94a3b8' },
        { name: 'Converted', value: leadData.find(d => d.name === 'Converted')?.value || 0, fill: '#84cc16' }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-bottom duration-700 delay-300">

            {/* 1. Fleet Composition (Radar Chart - Premium Look) */}
            <div className="bg-card/50 backdrop-blur-sm border rounded-3xl shadow-sm p-6 hover:shadow-xl transition-all duration-300 border-t-white/10">
                <div className="mb-4">
                    <h3 className="text-lg font-black tracking-tight text-foreground flex items-center gap-2">
                        <span className="w-1 h-6 bg-indigo-500 rounded-full" />
                        Fleet Radar
                    </h3>
                    <p className="text-xs text-muted-foreground ml-3">Distribution Balance</p>
                </div>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={riderData}>
                            <PolarGrid strokeOpacity={0.2} />
                            <PolarAngleAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12, fontWeight: 'bold' }} />
                            <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
                            <Radar
                                name="Riders"
                                dataKey="value"
                                stroke="#6366f1"
                                strokeWidth={3}
                                fill="#6366f1"
                                fillOpacity={0.4}
                            />
                            <Tooltip
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                cursor={{ stroke: '#6366f1', strokeWidth: 1 }}
                            />
                        </RadarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* 2. Financial Health (Bar Chart) */}
            <div className="bg-card/50 backdrop-blur-sm border rounded-3xl shadow-sm p-6 hover:shadow-xl transition-all duration-300 border-t-white/10">
                <div className="mb-4">
                    <h3 className="text-lg font-black tracking-tight text-foreground flex items-center gap-2">
                        <span className="w-1 h-6 bg-emerald-500 rounded-full" />
                        Wallet Flow
                    </h3>
                    <p className="text-xs text-muted-foreground ml-3">Inflow vs Outflow</p>
                </div>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={walletData}
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                            barSize={40}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.5} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(value) => `₹${value / 1000}k`} />
                            <Tooltip
                                cursor={{ fill: '#f1f5f9', opacity: 0.4 }}
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                formatter={(value: number | string | undefined) => [`₹${Number(value || 0).toLocaleString()}`, 'Amount']}
                            />
                            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                                {walletData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.value > 0 ? 'url(#colorInflow)' : 'url(#colorOutflow)'} />
                                ))}
                            </Bar>
                            <defs>
                                <linearGradient id="colorInflow" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.6} />
                                </linearGradient>
                                <linearGradient id="colorOutflow" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#f43f5e" stopOpacity={1} />
                                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.6} />
                                </linearGradient>
                            </defs>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* 3. Lead Conversion Funnel (Funnel Chart) - Spans Full Width */}
            <div className="col-span-1 md:col-span-2 bg-card/50 backdrop-blur-sm border rounded-3xl shadow-sm p-6 hover:shadow-xl transition-all duration-300 border-t-white/10">
                <div className="mb-4 text-center">
                    <h3 className="text-lg font-black tracking-tight text-foreground inline-flex items-center gap-2">
                        <span className="w-1 h-6 bg-amber-500 rounded-full" />
                        Lead Conversion Funnel
                    </h3>
                    <p className="text-xs text-muted-foreground">Pipeline Efficiency</p>
                </div>
                <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <FunnelChart>
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                            <Funnel
                                data={funnelData}
                                dataKey="value"
                                isAnimationActive
                            >
                                <LabelList position="right" fill="#64748b" stroke="none" dataKey="name" />
                                {/* Funnel colors */}
                                <Cell fill="#94a3b8" />
                                <Cell fill="#84cc16" />
                            </Funnel>
                        </FunnelChart>
                    </ResponsiveContainer>
                </div>
            </div>

        </div>
    );
};

export default DashboardCharts;
