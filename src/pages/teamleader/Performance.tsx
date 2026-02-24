import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/config/supabase';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { Calendar, ChevronDown, Activity, ArrowUpRight, ArrowDownRight, Users, Wallet, Target } from 'lucide-react';
import { toast } from 'sonner';

const TLPersonalPerformance: React.FC = () => {
    const { userData } = useSupabaseAuth();
    const [loading, setLoading] = useState(true);

    // Data State
    const [riders, setRiders] = useState<any[]>([]);
    const [leads, setLeads] = useState<any[]>([]);
    const [collections, setCollections] = useState<any[]>([]);

    // Date Filter State
    const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'custom'>('month');
    const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });

    useEffect(() => {
        const fetchUserData = async () => {
            if (!userData) return;
            try {
                const [ridersRes, leadsRes, collectionsRes] = await Promise.all([
                    supabase.from('riders').select('status, allotment_date, inactivated_at').eq('team_leader_id', userData.id),
                    supabase.from('leads').select('status, created_at').eq('created_by', userData.id),
                    supabase.from('daily_collections').select('total_collection, date').eq('team_leader_id', userData.id)
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

    const metrics = useMemo(() => {
        const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
        const nowISTStr = formatter.format(new Date());
        const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));

        let startDateStr = nowISTStr;
        let endDateStr = nowISTStr;

        if (dateFilter === 'week') {
            const weekStart = new Date(nowIST);
            weekStart.setDate(nowIST.getDate() - nowIST.getDay() + (nowIST.getDay() === 0 ? -6 : 1));
            startDateStr = formatter.format(weekStart);
        } else if (dateFilter === 'month') {
            const monthStart = new Date(nowIST.getFullYear(), nowIST.getMonth(), 1);
            startDateStr = formatter.format(monthStart);
        } else if (dateFilter === 'custom' && customDateRange.start && customDateRange.end) {
            startDateStr = customDateRange.start;
            endDateStr = customDateRange.end;
        }

        // 1. Fleet Strength Metrics (Allotments, Submissions, Net Growth)
        const allotments = riders.filter(r => {
            if (!r.allotment_date) return false;
            const adStr = typeof r.allotment_date === 'string' ? r.allotment_date.split('T')[0] : formatter.format(new Date(r.allotment_date));
            return adStr >= startDateStr && adStr <= endDateStr;
        }).length;

        const submissions = riders.filter(r => {
            if (r.status !== 'inactive' || !r.inactivated_at) return false;
            const sdStr = typeof r.inactivated_at === 'string' ? r.inactivated_at.split('T')[0] : formatter.format(new Date(r.inactivated_at));
            return sdStr >= startDateStr && sdStr <= endDateStr;
        }).length;

        const netGrowth = allotments - submissions;

        // 2. Total Collections for Period
        const totalCollections = collections.filter(c => {
            if (!c.date) return false;
            const cdStr = typeof c.date === 'string' ? c.date.split('T')[0] : formatter.format(new Date(c.date));
            return cdStr >= startDateStr && cdStr <= endDateStr;
        }).reduce((sum, c) => sum + (Number(c.total_collection) || 0), 0);

        // 3. Lead Conversions for Period
        const periodLeads = leads.filter(l => {
            if (!l.created_at) return false;
            const ldStr = typeof l.created_at === 'string' ? l.created_at.split('T')[0] : formatter.format(new Date(l.created_at));
            return ldStr >= startDateStr && ldStr <= endDateStr;
        });

        const newLeadsCount = periodLeads.length;
        const convertedCount = periodLeads.filter(l => l.status === 'Convert').length;
        const conversionRate = newLeadsCount > 0 ? Math.round((convertedCount / newLeadsCount) * 100) : 0;

        return {
            allotments,
            submissions,
            netGrowth,
            totalCollections,
            newLeadsCount,
            convertedCount,
            conversionRate
        };
    }, [riders, leads, collections, dateFilter, customDateRange]);

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
        <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto min-h-screen pb-24">
            {/* Header & Filter */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-card border rounded-3xl p-6 md:p-8 shadow-sm relative overflow-hidden">
                {/* Decorative background accent */}
                <div className="absolute -top-10 -right-10 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                        <Activity className="text-primary w-5 h-5" />
                        <h1 className="text-2xl font-black bg-gradient-to-r from-primary to-indigo-600 bg-clip-text text-transparent tracking-tight">Performance Matrix</h1>
                    </div>
                    <p className="text-sm text-muted-foreground font-medium max-w-md leading-relaxed">
                        Your personalized operational scorecard. Analyze your fleet dynamics, total collections, and lead conversion rates for the selected timeframe.
                    </p>
                </div>

                <div className="relative z-10 w-full md:w-auto flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1 sm:flex-none">
                        <select
                            value={dateFilter}
                            onChange={(e: any) => setDateFilter(e.target.value)}
                            className="w-full sm:w-auto pl-10 pr-10 py-3 bg-background border border-border rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none shadow-sm cursor-pointer hover:bg-muted/50 transition-colors"
                        >
                            <option value="today">Today's Pulse</option>
                            <option value="week">This Week</option>
                            <option value="month">This Month</option>
                            <option value="custom">Custom Range...</option>
                        </select>
                        <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-primary pointer-events-none" />
                        <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    </div>

                    {dateFilter === 'custom' && (
                        <div className="flex items-center gap-2 bg-background border rounded-xl p-1.5 shadow-sm overflow-hidden auto-cols-auto">
                            <input
                                type="date"
                                className="text-xs py-1.5 px-3 focus:outline-none bg-transparent font-medium"
                                value={customDateRange.start}
                                onChange={(e) => setCustomDateRange({ ...customDateRange, start: e.target.value })}
                            />
                            <span className="text-muted-foreground text-xs font-black px-1">-</span>
                            <input
                                type="date"
                                className="text-xs py-1.5 px-3 focus:outline-none bg-transparent font-medium"
                                value={customDateRange.end}
                                onChange={(e) => setCustomDateRange({ ...customDateRange, end: e.target.value })}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                {/* Fleet Strength */}
                <div className="bg-card border rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:transform group-hover:scale-110 transition-transform duration-500">
                        <Users size={80} className="text-indigo-600" />
                    </div>

                    <div className="relative z-10 flex flex-col h-full justify-between gap-6">
                        <div>
                            <div className="flex items-center gap-2 mb-1 text-indigo-500 font-bold uppercase tracking-wider text-[10px]">
                                <Users size={12} />
                                Fleet Flow
                            </div>
                            <h3 className="text-xl font-black text-foreground">Net Growth</h3>
                        </div>

                        <div>
                            <div className="flex items-end gap-3 mb-2">
                                <span className={`text-5xl font-black tracking-tighter ${metrics.netGrowth >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    {metrics.netGrowth > 0 ? '+' : ''}{metrics.netGrowth}
                                </span>
                                <span className="text-sm font-bold text-muted-foreground mb-1">Riders</span>
                            </div>

                            <div className="flex items-center justify-between mt-6 p-3 bg-muted/40 rounded-2xl border border-border/50">
                                <div className="text-center flex-1">
                                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mb-1">Alloted</p>
                                    <p className="text-lg font-black text-indigo-600">+{metrics.allotments}</p>
                                </div>
                                <div className="w-px h-8 bg-border/80"></div>
                                <div className="text-center flex-1">
                                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mb-1">Submitted</p>
                                    <p className="text-lg font-black text-rose-500">-{metrics.submissions}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Total Collections */}
                <div className="bg-card border rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group bg-gradient-to-br from-card to-emerald-500/5">
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:transform group-hover:scale-110 transition-transform duration-500">
                        <Wallet size={80} className="text-emerald-600" />
                    </div>

                    <div className="relative z-10 flex flex-col h-full justify-between gap-6">
                        <div>
                            <div className="flex items-center gap-2 mb-1 text-emerald-500 font-bold uppercase tracking-wider text-[10px]">
                                <Wallet size={12} />
                                Revenue
                            </div>
                            <h3 className="text-xl font-black text-foreground">Total Collections</h3>
                        </div>

                        <div>
                            <div className="flex items-end gap-1 mb-2">
                                <span className="text-3xl font-black text-emerald-500/50 mb-1 leading-none">₹</span>
                                <span className="text-5xl font-black tracking-tighter text-emerald-500">
                                    {metrics.totalCollections.toLocaleString()}
                                </span>
                            </div>

                            <div className="mt-6 flex items-center justify-between p-3 border border-emerald-500/20 bg-emerald-500/5 rounded-2xl">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-emerald-500/20 rounded-lg">
                                        <ArrowUpRight className="text-emerald-600 w-4 h-4" />
                                    </div>
                                    <span className="text-[11px] font-bold text-emerald-700">Verified Cash Flow</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Lead Pipeline */}
                <div className="bg-card border rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:transform group-hover:scale-110 transition-transform duration-500">
                        <Target size={80} className="text-amber-500" />
                    </div>

                    <div className="relative z-10 flex flex-col h-full justify-between gap-6">
                        <div>
                            <div className="flex items-center gap-2 mb-1 text-amber-500 font-bold uppercase tracking-wider text-[10px]">
                                <Target size={12} />
                                Pipeline
                            </div>
                            <h3 className="text-xl font-black text-foreground">Lead Conversion</h3>
                        </div>

                        <div>
                            <div className="flex items-end gap-2 mb-2">
                                <span className="text-5xl font-black tracking-tighter text-amber-500">
                                    {metrics.conversionRate}%
                                </span>
                                <span className="text-sm font-bold text-muted-foreground mb-1.5">Win Rate</span>
                            </div>

                            <div className="flex items-center justify-between mt-6 p-3 bg-muted/40 rounded-2xl border border-border/50">
                                <div className="text-center flex-1">
                                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mb-1">Sourced</p>
                                    <p className="text-lg font-black text-primary">{metrics.newLeadsCount}</p>
                                </div>
                                <div className="w-px h-8 bg-border/80"></div>
                                <div className="text-center flex-1">
                                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mb-1">Converted</p>
                                    <p className="text-lg font-black text-amber-500">{metrics.convertedCount}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default TLPersonalPerformance;
