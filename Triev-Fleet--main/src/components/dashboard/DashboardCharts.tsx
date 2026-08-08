import React from 'react';
import { motion } from 'framer-motion';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    Cell, PieChart, Pie, Legend
} from 'recharts';

interface DashboardChartsProps {
    riderData: { name: string; value: number; color: string }[];
    walletData: { name: string; value: number; color?: string }[];
    leadData: { name: string; value: number; color: string }[];
}

const CHART_GRADIENTS = [
    { id: 'grad0', from: '#6366f1', to: '#8b5cf6' },
    { id: 'grad1', from: '#f43f5e', to: '#fb923c' },
    { id: 'grad2', from: '#94a3b8', to: '#64748b' },
];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        // Recharts pie payload structure can be tricky, fill color might be in payload[0].fill
        const color = payload[0].fill || '#8b5cf6';
        return (
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl shadow-2xl p-3 sm:p-4 text-sm animate-in zoom-in-95 duration-200">
                <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-2.5 h-2.5 rounded-full shadow-sm ring-1 ring-black/10 dark:ring-white/10" style={{ background: color }} />
                    <p className="font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">{data.name}</p>
                </div>
                <p className="text-xl font-black tabular-nums tracking-tight text-slate-900 dark:text-white leading-none">
                    {data.value} <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest ml-1">Riders</span>
                </p>
            </div>
        );
    }
    return null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const isRisk = label.toLowerCase().includes('risk') || label.toLowerCase().includes('due');
        return (
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl shadow-2xl p-3 sm:p-4 text-sm animate-in zoom-in-95 duration-200">
                <p className="font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] mb-1">{label}</p>
                <div className="flex items-baseline gap-1">
                    <p className={`text-xl font-black tabular-nums tracking-tight leading-none ${isRisk ? 'text-rose-500' : 'text-emerald-500'}`}>
                        ₹{Number(payload[0].value).toLocaleString('en-IN')}
                    </p>
                </div>
            </div>
        );
    }
    return null;
};

const DashboardCharts: React.FC<DashboardChartsProps> = ({ riderData, walletData, leadData }) => {

    const totalLeads = leadData.reduce((sum, item) => sum + item.value, 0);
    const convertedCount = leadData.find(d => d.name === 'Converted')?.value || 0;
    const leadConversionRate = totalLeads > 0 ? Math.round((convertedCount / totalLeads) * 100) : 0;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-bottom duration-700 delay-300">

            {/* ── 1. Fleet Composition (Donut) ── */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-card/60 dark:bg-black/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-sm p-5 hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-500 group"
            >
                <div className="mb-4 flex items-center gap-2">
                    <div className="w-1 h-6 rounded-full bg-gradient-to-b from-indigo-400 to-violet-600 group-hover:scale-y-110 transition-transform" />
                    <div>
                        <h3 className="text-base font-black tracking-tight text-foreground">Fleet Status</h3>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Real-time distribution</p>
                    </div>
                </div>
                <div className="h-[260px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <defs>
                                {CHART_GRADIENTS.map((g) => (
                                    <linearGradient key={g.id} id={g.id} x1="0" y1="0" x2="1" y2="1">
                                        <stop offset="0%" stopColor={g.from} />
                                        <stop offset="100%" stopColor={g.to} />
                                    </linearGradient>
                                ))}
                                <filter id="pieShadow" height="200%">
                                    <feGaussianBlur in="SourceAlpha" stdDeviation="4" />
                                    <feOffset dx="0" dy="4" result="offsetblur" />
                                    <feComponentTransfer>
                                        <feFuncA type="linear" slope="0.25" />
                                    </feComponentTransfer>
                                    <feMerge>
                                        <feMergeNode />
                                        <feMergeNode in="SourceGraphic" />
                                    </feMerge>
                                </filter>
                            </defs>
                            <Pie
                                data={riderData}
                                cx="50%"
                                cy="46%"
                                innerRadius={60}
                                outerRadius={95}
                                paddingAngle={6}
                                dataKey="value"
                                stroke="none"
                                filter="url(#pieShadow)"
                                animationBegin={200}
                                animationDuration={900}
                            >
                                {riderData.map((_entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={`url(#grad${index % 3})`}
                                        className="hover:opacity-80 transition-opacity cursor-pointer"
                                    />
                                ))}
                            </Pie>
                            <Tooltip content={<CustomPieTooltip />} cursor={{ fill: 'transparent' }} />
                            <Legend
                                verticalAlign="bottom"
                                height={36}
                                iconType="circle"
                                iconSize={8}
                                formatter={(value) => (
                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{value}</span>
                                )}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </motion.div>

            {/* ── 2. Wallet Dynamics (Vertical Bar) ── */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-card/60 dark:bg-black/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-sm p-5 hover:shadow-xl hover:shadow-emerald-500/10 transition-all duration-500 group"
            >
                <div className="mb-4 flex items-center gap-2">
                    <div className="w-1 h-6 rounded-full bg-gradient-to-b from-emerald-400 to-teal-600 group-hover:scale-y-110 transition-transform" />
                    <div>
                        <h3 className="text-base font-black tracking-tight text-foreground">Wallet Dynamics</h3>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Inflow vs Risk analysis</p>
                    </div>
                </div>
                <div className="h-[260px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            layout="vertical"
                            data={walletData}
                            margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                        >
                            <defs>
                                <linearGradient id="barGreen" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stopColor="#34d399" />
                                    <stop offset="100%" stopColor="#10b981" />
                                </linearGradient>
                                <linearGradient id="barRed" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stopColor="#fb7185" />
                                    <stop offset="100%" stopColor="#f43f5e" />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} strokeOpacity={0.15} />
                            <XAxis type="number" hide />
                            <YAxis
                                dataKey="name"
                                type="category"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 10, fontWeight: 700, fill: 'hsl(var(--muted-foreground))' }}
                                width={90}
                            />
                            <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(99,102,241,0.05)' }} />
                            <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={28} animationDuration={800}>
                                {walletData.map((_entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={walletData[index].name.toLowerCase().includes('collection') ? 'url(#barGreen)' : 'url(#barRed)'}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </motion.div>

            {/* ── 3. Conversion Efficiency ── */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="col-span-1 md:col-span-2 relative overflow-hidden rounded-2xl shadow-xl group"
            >
                {/* Gradient bg */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700" />
                {/* Mesh overlay */}
                <div className="absolute inset-0 opacity-10">
                    <svg className="w-full h-full" viewBox="0 0 400 160" preserveAspectRatio="xMidYMid slice">
                        <defs>
                            <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                                <path d="M 30 0 L 0 0 0 30" fill="none" stroke="white" strokeWidth="0.5" />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#grid)" />
                    </svg>
                </div>
                {/* Glow orbs */}
                <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-700" />
                <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-purple-400/20 rounded-full blur-2xl" />

                <div className="relative z-10 p-6 sm:p-8 text-white">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">

                        {/* Left: stats */}
                        <div className="space-y-3 flex-grow">
                            <div>
                                <h3 className="text-xl sm:text-2xl font-black tracking-tight">Conversion Efficiency</h3>
                                <p className="text-indigo-200 text-xs font-medium mt-0.5">
                                    Lead-to-rider pipeline performing at{' '}
                                    <span className="bg-white/20 px-2 py-0.5 rounded-lg font-black text-white">{leadConversionRate}%</span>
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-3">
                                <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/15 min-w-[100px]">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-indigo-200 mb-1">Total Leads</p>
                                    <p className="text-2xl font-black tabular-nums">{totalLeads}</p>
                                </div>
                                <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/15 min-w-[100px]">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-indigo-200 mb-1">Converted</p>
                                    <p className="text-2xl font-black tabular-nums text-emerald-300">{convertedCount}</p>
                                </div>
                                <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/15 min-w-[100px]">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-indigo-200 mb-1">Lost</p>
                                    <p className="text-2xl font-black tabular-nums text-rose-300">
                                        {leadData.find(d => d.name === 'Not Convert')?.value || 0}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Right: radial progress */}
                        <div className="flex-shrink-0 relative w-28 h-28 sm:w-36 sm:h-36 self-center">
                            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                                <circle cx="60" cy="60" r="50" className="fill-none stroke-white/10" strokeWidth="10" />
                                <motion.circle
                                    cx="60" cy="60" r="50"
                                    className="fill-none stroke-emerald-400"
                                    strokeWidth="10"
                                    strokeLinecap="round"
                                    strokeDasharray={314}
                                    initial={{ strokeDashoffset: 314 }}
                                    animate={{ strokeDashoffset: 314 - (314 * leadConversionRate) / 100 }}
                                    transition={{ duration: 1.5, ease: 'easeOut', delay: 0.4 }}
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-2xl sm:text-3xl font-black tabular-nums">{leadConversionRate}%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default React.memo(DashboardCharts);
