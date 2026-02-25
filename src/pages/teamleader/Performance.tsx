import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/config/supabase';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import {
    Calendar, ChevronDown, Activity, Users, Wallet, Target,
    TrendingUp, TrendingDown, Clock, Info, Search
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { format, subDays, startOfMonth, eachDayOfInterval } from 'date-fns';

interface DailyPerformance {
    date: string;
    collections: number;
    activeRiders: number;
    allotments: number;
    submissions: number;
    netGrowth: number;
    leads: number;
    conversions: number;
}

const TLPersonalPerformance: React.FC = () => {
    const { userData } = useSupabaseAuth();
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Data State
    const [riders, setRiders] = useState<any[]>([]);
    const [leads, setLeads] = useState<any[]>([]);
    const [collections, setCollections] = useState<any[]>([]);

    // Date Filter State
    const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'custom'>('month');
    const [customDateRange, setCustomDateRange] = useState({
        start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
        end: format(new Date(), 'yyyy-MM-dd')
    });

    useEffect(() => {
        const fetchUserData = async () => {
            if (!userData) return;
            try {
                const [ridersRes, leadsRes, collectionsRes] = await Promise.all([
                    supabase.from('riders')
                        .select('status, allotment_date, inactivated_at, wallet_amount')
                        .eq('team_leader_id', userData.id),
                    supabase.from('leads')
                        .select('status, created_at')
                        .eq('created_by', userData.id),
                    supabase.from('daily_collections')
                        .select('total_collection, date, active_riders_count')
                        .eq('team_leader_id', userData.id)
                        .order('date', { ascending: false })
                ]);

                if (ridersRes.error) throw ridersRes.error;
                if (leadsRes.error) throw leadsRes.error;
                if (collectionsRes.error) throw collectionsRes.error;

                setRiders(ridersRes.data || []);
                setLeads(leadsRes.data || []);
                setCollections(collectionsRes.data || []);
            } catch (error: any) {
                toast.error('Failed to load performance data: ' + error.message);
            } finally {
                setLoading(false);
            }
        };

        fetchUserData();
    }, [userData]);

    const { summary, ledger } = useMemo(() => {
        const now = new Date();
        const start = dateFilter === 'today' ? now :
            dateFilter === 'week' ? subDays(now, 7) :
                dateFilter === 'month' ? startOfMonth(now) :
                    new Date(customDateRange.start);

        const end = dateFilter === 'custom' ? new Date(customDateRange.end) : now;

        // 1. Generate Daily Ledger
        const days = eachDayOfInterval({ start, end }).reverse();
        const dailyLedger: DailyPerformance[] = days.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');

            // Collections & Active Riders from history
            const dayCollection = collections.find(c => c.date === dateStr);

            // Allotments
            const dayAllotments = riders.filter(r =>
                r.allotment_date && format(new Date(r.allotment_date), 'yyyy-MM-dd') === dateStr
            ).length;

            // Submissions (Inactivations)
            const daySubmissions = riders.filter(r =>
                r.status === 'inactive' &&
                r.inactivated_at &&
                format(new Date(r.inactivated_at), 'yyyy-MM-dd') === dateStr
            ).length;

            // Leads
            const dayLeads = leads.filter(l =>
                l.created_at && format(new Date(l.created_at), 'yyyy-MM-dd') === dateStr
            );

            return {
                date: dateStr,
                collections: dayCollection?.total_collection || 0,
                activeRiders: dayCollection?.active_riders_count || 0,
                allotments: dayAllotments,
                submissions: daySubmissions,
                netGrowth: dayAllotments - daySubmissions,
                leads: dayLeads.length,
                conversions: dayLeads.filter(l => l.status === 'Convert').length
            };
        });

        // 2. Calculate Summary
        const periodCollections = dailyLedger.reduce((sum, d) => sum + d.collections, 0);
        const periodLeads = dailyLedger.reduce((sum, d) => sum + d.leads, 0);
        const periodConversions = dailyLedger.reduce((sum, d) => sum + d.conversions, 0);
        const activeFleet = riders.filter(r => r.status === 'active').length;
        const totalWallet = riders.reduce((sum, r) => sum + (r.wallet_amount || 0), 0);
        const avgWallet = riders.length > 0 ? Math.round(totalWallet / riders.length) : 0;

        return {
            summary: {
                activeFleet,
                totalRiders: riders.length,
                periodCollections,
                conversionRate: periodLeads > 0 ? Math.round((periodConversions / periodLeads) * 100) : 0,
                avgWallet,
                totalLeads: periodLeads,
                netGrowth: dailyLedger.reduce((sum, d) => sum + d.netGrowth, 0)
            },
            ledger: dailyLedger
        };
    }, [riders, leads, collections, dateFilter, customDateRange]);

    const filteredLedger = useMemo(() => {
        if (!searchQuery) return ledger;
        return ledger.filter(row =>
            row.date.includes(searchQuery) ||
            row.collections.toString().includes(searchQuery)
        );
    }, [ledger, searchQuery]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-muted-foreground font-medium animate-pulse">Computing Matrix...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 space-y-8 max-w-7xl mx-auto min-h-screen pb-24">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-primary/10 rounded-xl">
                            <Activity className="text-primary w-6 h-6" />
                        </div>
                        <h1 className="text-3xl font-black bg-gradient-to-r from-primary to-indigo-600 bg-clip-text text-transparent tracking-tight">Personal Performance</h1>
                    </div>
                    <p className="text-muted-foreground font-medium max-w-md">
                        Real-time visibility into your fleet strength, collections, and operational efficiency.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <div className="relative group">
                        <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-primary z-10" />
                        <select
                            value={dateFilter}
                            onChange={(e: any) => setDateFilter(e.target.value)}
                            className="pl-10 pr-10 py-3 bg-card border rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none shadow-sm cursor-pointer hover:bg-muted/50 transition-all border-border/50 min-w-[160px]"
                        >
                            <option value="today">Today's Pulse</option>
                            <option value="week">Past 7 Days</option>
                            <option value="month">This Month</option>
                            <option value="custom">Custom Range</option>
                        </select>
                        <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none group-hover:text-primary transition-colors" />
                    </div>

                    {dateFilter === 'custom' && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-center gap-2 bg-card border border-border/50 rounded-2xl p-1.5 shadow-sm"
                        >
                            <input
                                type="date"
                                className="text-xs py-1.5 px-3 focus:outline-none bg-transparent font-bold text-foreground"
                                value={customDateRange.start}
                                onChange={(e) => setCustomDateRange({ ...customDateRange, start: e.target.value })}
                            />
                            <div className="w-4 h-px bg-border"></div>
                            <input
                                type="date"
                                className="text-xs py-1.5 px-3 focus:outline-none bg-transparent font-bold text-foreground"
                                value={customDateRange.end}
                                onChange={(e) => setCustomDateRange({ ...customDateRange, end: e.target.value })}
                            />
                        </motion.div>
                    )}
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Active Fleet', value: summary.activeFleet, total: summary.totalRiders, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
                    { label: 'Collections', value: `₹${summary.periodCollections.toLocaleString()}`, icon: Wallet, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                    { label: 'Conversion', value: `${summary.conversionRate}%`, icon: Target, color: 'text-amber-500', bg: 'bg-amber-500/10' },
                    { label: 'Avg Wallet', value: `₹${summary.avgWallet.toLocaleString()}`, icon: Wallet, color: 'text-indigo-500', bg: 'bg-indigo-500/10' }
                ].map((stat, i) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-card border border-border/50 rounded-[2rem] p-6 shadow-sm relative overflow-hidden group"
                    >
                        <div className={`absolute -right-4 -top-4 w-24 h-24 ${stat.bg} rounded-full blur-3xl opacity-50 group-hover:opacity-80 transition-opacity`} />
                        <div className="relative z-10 flex flex-col gap-4">
                            <div className={`p-3 rounded-2xl ${stat.bg} w-fit`}>
                                <stat.icon className={`w-6 h-6 ${stat.color}`} />
                            </div>
                            <div>
                                <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-1">{stat.label}</p>
                                <div className="flex items-baseline gap-2">
                                    <h2 className="text-3xl font-black tracking-tighter">{stat.value}</h2>
                                    {stat.total && <span className="text-xs font-bold text-muted-foreground">/ {stat.total}</span>}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Performance Ledger */}
            <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-primary" />
                        <h2 className="text-xl font-black tracking-tight">Daily Operations Ledger</h2>
                    </div>

                    <div className="relative hidden sm:block">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search records..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-card border border-border/50 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 w-[200px]"
                        />
                    </div>
                </div>

                <div className="bg-card border border-border/50 rounded-[2.5rem] overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-muted/30 border-b border-border/50">
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Date</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">Collections</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">Active Fleet</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">Alloted</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">Churn</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">Net Growth</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">Leads:Conv</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/30">
                                {filteredLedger.length > 0 ? filteredLedger.map((row, i) => (
                                    <motion.tr
                                        key={row.date}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: i * 0.05 }}
                                        className="hover:bg-primary/[0.02] transition-colors"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-black text-foreground">{format(new Date(row.date), 'dd MMM yyyy')}</span>
                                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{format(new Date(row.date), 'EEEE')}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`text-sm font-black ${row.collections > 0 ? 'text-emerald-500' : 'text-muted-foreground/40'}`}>
                                                ₹{row.collections.toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <span className="text-sm font-black">{row.activeRiders}</span>
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500/40" />
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`text-xs font-bold ${row.allotments > 0 ? 'text-indigo-500' : 'text-muted-foreground/30'}`}>
                                                {row.allotments > 0 ? `+${row.allotments}` : '-'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`text-xs font-bold ${row.submissions > 0 ? 'text-rose-500' : 'text-muted-foreground/30'}`}>
                                                {row.submissions > 0 ? `-${row.submissions}` : '-'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex items-center justify-center gap-1.5">
                                                {row.netGrowth > 0 ? (
                                                    <TrendingUp size={14} className="text-emerald-500" />
                                                ) : row.netGrowth < 0 ? (
                                                    <TrendingDown size={14} className="text-rose-500" />
                                                ) : null}
                                                <span className={`text-sm font-black ${row.netGrowth > 0 ? 'text-emerald-500' :
                                                    row.netGrowth < 0 ? 'text-rose-500' :
                                                        'text-muted-foreground/30'
                                                    }`}>
                                                    {row.netGrowth > 0 ? `+${row.netGrowth}` : row.netGrowth === 0 ? '0' : row.netGrowth}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className="text-sm font-black">{row.leads} : {row.conversions}</span>
                                                <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden mt-1 mt-auto">
                                                    <div
                                                        className="h-full bg-amber-500"
                                                        style={{ width: `${row.leads > 0 ? (row.conversions / row.leads) * 100 : 0}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                    </motion.tr>
                                )) : (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-20 text-center">
                                            <div className="flex flex-col items-center gap-4 opacity-20">
                                                <Activity size={48} />
                                                <p className="text-sm font-black uppercase tracking-widest">No matrix data available</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer Insight */}
                <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-2xl border border-border/50">
                    <Info className="w-5 h-5 text-primary shrink-0" />
                    <p className="text-xs font-medium text-muted-foreground leading-relaxed">
                        Data is aggregated in real-time. Performance scores are recalculated at every refresh based on your fleet flow, cash collections, and pipeline conversion metrics.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default TLPersonalPerformance;
