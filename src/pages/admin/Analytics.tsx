import React from 'react';
import {
    LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { BadgeDollarSign, TrendingUp } from 'lucide-react';

const data = [
    { name: 'Jan', riders: 40, revenue: 2400 },
    { name: 'Feb', riders: 30, revenue: 1398 },
    { name: 'Mar', riders: 20, revenue: 9800 },
    { name: 'Apr', riders: 27, revenue: 3908 },
    { name: 'May', riders: 18, revenue: 4800 },
    { name: 'Jun', riders: 23, revenue: 3800 },
    { name: 'Jul', riders: 34, revenue: 4300 },
];

const Analytics: React.FC = () => {
    return (
        <div className="space-y-8 pb-10">
            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Analytics & Reports</h1>
                <p className="text-muted-foreground">Historical data and performance trends.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Rider Growth */}
                <div className="bg-card border rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-6">
                        <TrendingUp className="text-indigo-500" />
                        <h3 className="font-semibold">Rider Growth Trend</h3>
                    </div>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                <Tooltip />
                                <Line type="monotone" dataKey="riders" stroke="#6366f1" strokeWidth={3} dot={{ r: 4 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Revenue Trend */}
                <div className="bg-card border rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-6">
                        <BadgeDollarSign className="text-green-500" />
                        <h3 className="font-semibold">Revenue Trend</h3>
                    </div>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} tickFormatter={(val) => `₹${val / 1000}k`} />
                                <Tooltip formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, "Revenue"]} />
                                <Area type="monotone" dataKey="revenue" stroke="#22c55e" fill="#22c55e" fillOpacity={0.1} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="bg-muted/30 p-8 rounded-xl text-center border dashed border-2">
                <p className="text-muted-foreground">More advanced reports (Lead Funnels, Cohort Analysis) coming soon.</p>
            </div>
        </div>
    );
};

export default Analytics;
