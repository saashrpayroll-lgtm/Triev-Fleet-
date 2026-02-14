import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    Cell, PieChart, Pie, Legend
} from 'recharts';
import { safeRender } from '@/utils/safeRender';

interface DashboardChartsProps {
    riderData: { name: string; value: number; color: string }[]; // Active, Inactive, Deleted
    walletData: { name: string; value: number; color?: string }[]; // Inflow, Outflow
    leadData: { name: string; value: number; color: string }[]; // Converted, Lost
}

const DashboardCharts: React.FC<DashboardChartsProps> = ({ riderData, walletData, leadData }) => {

    // Prepare Lead Data for simpler display
    const totalLeads = leadData.reduce((sum, item) => sum + item.value, 0);
    const leadConversionRate = totalLeads > 0
        ? Math.round((leadData.find(d => d.name === 'Converted')?.value || 0) / totalLeads * 100)
        : 0;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-bottom duration-700 delay-300">

            {/* 1. Fleet Composition (Vibrant Donut Chart) */}
            <div className="bg-card/50 backdrop-blur-xl border rounded-3xl shadow-sm p-6 hover:shadow-2xl transition-all duration-500 border-t-zinc-200 dark:border-t-white/20 group">
                <div className="mb-6 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-black tracking-tighter text-foreground flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-indigo-500 rounded-full group-hover:scale-y-125 transition-transform" />
                            Fleet Status
                        </h3>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-3.5">Real-time Distribution</p>
                    </div>
                </div>
                <div className="h-[320px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <defs>
                                <filter id="shadow" height="200%">
                                    <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
                                    <feOffset dx="0" dy="4" result="offsetblur" />
                                    <feComponentTransfer>
                                        <feFuncA type="linear" slope="0.3" />
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
                                cy="50%"
                                innerRadius={70}
                                outerRadius={100}
                                paddingAngle={8}
                                dataKey="value"
                                stroke="none"
                                filter="url(#shadow)"
                            >
                                {riderData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} className="hover:opacity-80 transition-opacity cursor-pointer" />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold', backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
                                itemStyle={{ fontSize: '12px', color: 'var(--foreground)' }}
                            />
                            <Legend
                                verticalAlign="bottom"
                                height={36}
                                iconType="circle"
                                formatter={(value) => <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{value}</span>}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* 2. Financial Overview (Horizontal Bar Chart) */}
            <div className="bg-card/50 backdrop-blur-xl border rounded-3xl shadow-sm p-6 hover:shadow-2xl transition-all duration-500 border-t-zinc-200 dark:border-t-white/20 group">
                <div className="mb-6">
                    <h3 className="text-xl font-black tracking-tighter text-foreground flex items-center gap-2">
                        <span className="w-1.5 h-6 bg-emerald-500 rounded-full group-hover:scale-y-125 transition-transform" />
                        Wallet Dynamics
                    </h3>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-3.5">Inflow vs Risk Analysis</p>
                </div>
                <div className="h-[320px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            layout="vertical"
                            data={walletData}
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} strokeOpacity={0.1} stroke="var(--border)" />
                            <XAxis type="number" hide />
                            <YAxis
                                dataKey="name"
                                type="category"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 11, fontWeight: 'bold', fill: 'var(--foreground)' }} // Fixed visibility
                                width={80}
                            />
                            <Tooltip
                                cursor={{ fill: 'var(--muted/20)' }}
                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold', backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
                                formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, 'Amount']}
                                labelFormatter={(label) => safeRender(label)}
                            />
                            <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={32} label={{ position: 'insideRight', fill: '#fff', fontSize: 11, fontWeight: 'bold' }}>
                                {walletData.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={entry.name.includes('Collections') ? '#10b981' : '#f43f5e'}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* 3. Lead Conversion Analytics (Vibrant Progress View) */}
            <div className="col-span-1 md:col-span-2 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl shadow-xl p-8 text-white relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                    <svg width="200" height="200" viewBox="0 0 200 200" fill="none">
                        <circle cx="100" cy="100" r="80" stroke="white" strokeWidth="20" strokeDasharray="10 20" />
                    </svg>
                </div>

                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8 font-jakarta">
                    <div className="text-center md:text-left space-y-2 flex-grow">
                        <h3 className="text-2xl font-black tracking-tighter">Conversion Efficiency</h3>
                        <p className="text-indigo-100 text-sm font-medium">Your lead-to-rider pipeline is performing at <span className="bg-white/20 px-2 py-0.5 rounded font-black">{leadConversionRate}%</span></p>

                        <div className="mt-6 flex flex-wrap gap-4 justify-center md:justify-start">
                            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 min-w-[120px]">
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Total Leads</p>
                                <p className="text-2xl font-black">{totalLeads}</p>
                            </div>
                            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 min-w-[120px]">
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Converted</p>
                                <p className="text-2xl font-black text-emerald-300">{leadData.find(d => d.name === 'Converted')?.value || 0}</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex-shrink-0 relative w-40 h-40">
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-4xl font-black">{leadConversionRate}%</span>
                        </div>
                        <svg className="w-full h-full -rotate-90">
                            <circle cx="80" cy="80" r="70" className="stroke-white/10 fill-none" strokeWidth="12" />
                            <circle
                                cx="80" cy="80" r="70"
                                className="stroke-emerald-400 fill-none transition-all duration-1000"
                                strokeWidth="12"
                                strokeDasharray={440}
                                strokeDashoffset={440 - (440 * leadConversionRate) / 100}
                                strokeLinecap="round"
                            />
                        </svg>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default DashboardCharts;
