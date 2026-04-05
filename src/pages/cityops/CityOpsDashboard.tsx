/**
 * City Ops Dashboard — Mirrors Admin Dashboard with strict data scoping.
 * Only shows stats, charts, and activity for the current City Ops' team.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useCityOpsScope } from '@/hooks/useCityOpsScope';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/config/supabase';
import GlassCard from '@/components/GlassCard';
import {
    Users, UserCheck, UserX, Trash2, TrendingUp, TrendingDown,
    Target, Wallet, ArrowUpRight, ArrowDownRight, RefreshCw
} from 'lucide-react';

interface StatCard {
    label: string;
    value: number | string;
    icon: React.ElementType;
    color: string;
    bgColor: string;
    trend?: string;
}

const CityOpsDashboard: React.FC = () => {
    const { userData } = useSupabaseAuth();
    const { cityOpsId, rmIds, tlIds, isLoading: scopeLoading } = useCityOpsScope();
    const [stats, setStats] = useState({
        totalRiders: 0,
        activeRiders: 0,
        inactiveRiders: 0,
        deletedRiders: 0,
        totalLeads: 0,
        newLeads: 0,
        convertedLeads: 0,
        walletPositive: 0,
        walletNegative: 0,
        walletZero: 0,
        totalRMs: 0,
        totalTLs: 0,
    });
    const [loading, setLoading] = useState(true);

    const fetchDashboardStats = useCallback(async () => {
        setLoading(true);
        try {
            // Riders scoped to this City Ops
            const { data: riders } = await supabase
                .from('riders')
                .select('id, status, wallet_amount')
                .eq('city_ops_id', cityOpsId);

            const riderList = riders || [];
            const active = riderList.filter(r => r.status === 'active');
            const inactive = riderList.filter(r => r.status === 'inactive');
            const deleted = riderList.filter(r => r.status === 'deleted');
            const walletPos = active.filter(r => (r.wallet_amount || 0) > 0);
            const walletNeg = active.filter(r => (r.wallet_amount || 0) < 0);
            const walletZero = active.filter(r => (r.wallet_amount || 0) === 0);

            // Leads scoped to this City Ops' TLs
            let totalLeads = 0, newLeads = 0, convertedLeads = 0;
            if (tlIds.length > 0) {
                const { data: leads } = await supabase
                    .from('leads')
                    .select('id, status')
                    .in('assigned_to', tlIds);
                const leadList = leads || [];
                totalLeads = leadList.length;
                newLeads = leadList.filter(l => l.status === 'new').length;
                convertedLeads = leadList.filter(l => l.status === 'converted').length;
            }

            setStats({
                totalRiders: riderList.length,
                activeRiders: active.length,
                inactiveRiders: inactive.length,
                deletedRiders: deleted.length,
                totalLeads,
                newLeads,
                convertedLeads,
                walletPositive: walletPos.length,
                walletNegative: walletNeg.length,
                walletZero: walletZero.length,
                totalRMs: rmIds.length,
                totalTLs: tlIds.length,
            });
        } catch (err) {
            console.error('[CityOps Dashboard] Error:', err);
        } finally {
            setLoading(false);
        }
    }, [cityOpsId, rmIds.length, tlIds]);

    useEffect(() => {
        if (scopeLoading || !cityOpsId) return;
        fetchDashboardStats();
    }, [scopeLoading, cityOpsId, fetchDashboardStats]);

    const statCards: StatCard[] = [
        { label: 'Total Riders', value: stats.totalRiders, icon: Users, color: 'text-blue-600', bgColor: 'bg-blue-500/10' },
        { label: 'Active Riders', value: stats.activeRiders, icon: UserCheck, color: 'text-emerald-600', bgColor: 'bg-emerald-500/10' },
        { label: 'Inactive Riders', value: stats.inactiveRiders, icon: UserX, color: 'text-orange-600', bgColor: 'bg-orange-500/10' },
        { label: 'Deleted Riders', value: stats.deletedRiders, icon: Trash2, color: 'text-red-600', bgColor: 'bg-red-500/10' },
        { label: 'My RMs', value: stats.totalRMs, icon: TrendingUp, color: 'text-violet-600', bgColor: 'bg-violet-500/10' },
        { label: 'My TLs', value: stats.totalTLs, icon: Target, color: 'text-indigo-600', bgColor: 'bg-indigo-500/10' },
        { label: 'Total Leads', value: stats.totalLeads, icon: Target, color: 'text-cyan-600', bgColor: 'bg-cyan-500/10' },
        { label: 'Converted Leads', value: stats.convertedLeads, icon: ArrowUpRight, color: 'text-green-600', bgColor: 'bg-green-500/10' },
        { label: 'Wallet (+)', value: stats.walletPositive, icon: Wallet, color: 'text-emerald-600', bgColor: 'bg-emerald-500/10', trend: 'positive' },
        { label: 'Wallet (−)', value: stats.walletNegative, icon: ArrowDownRight, color: 'text-red-600', bgColor: 'bg-red-500/10', trend: 'negative' },
        { label: 'Wallet (0)', value: stats.walletZero, icon: TrendingDown, color: 'text-amber-600', bgColor: 'bg-amber-500/10' },
        { label: 'New Leads', value: stats.newLeads, icon: Target, color: 'text-sky-600', bgColor: 'bg-sky-500/10' },
    ];

    if (scopeLoading || loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">
                            Dashboard
                        </h1>
                        <p className="text-muted-foreground mt-1">Loading your team data...</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} className="bg-card rounded-xl p-4 border border-border animate-pulse">
                            <div className="h-4 bg-muted rounded w-2/3 mb-3" />
                            <div className="h-8 bg-muted rounded w-1/2" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">
                        Dashboard
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        {userData?.fullName}'s Team Overview • {stats.totalRMs} RMs • {stats.totalTLs} TLs
                    </p>
                </div>
                <button
                    onClick={fetchDashboardStats}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-600 rounded-lg hover:bg-amber-500/20 transition-colors font-medium text-sm"
                >
                    <RefreshCw size={16} />
                    Refresh
                </button>
            </div>

            {/* Stats Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {statCards.map((card, index) => {
                    const Icon = card.icon;
                    return (
                        <GlassCard
                            key={index}
                            className="p-4 hover:scale-[1.02] transition-transform duration-200 cursor-default"
                        >
                            <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        {card.label}
                                    </p>
                                    <p className="text-2xl font-bold">{card.value}</p>
                                </div>
                                <div className={`p-2.5 rounded-xl ${card.bgColor}`}>
                                    <Icon size={20} className={card.color} />
                                </div>
                            </div>
                        </GlassCard>
                    );
                })}
            </div>

            {/* Team Composition Card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <GlassCard className="p-6">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <Users size={20} className="text-amber-500" />
                        Team Composition
                    </h3>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-violet-500/10 rounded-lg">
                            <span className="text-sm font-medium">Reporting Managers</span>
                            <span className="text-lg font-bold text-violet-600">{stats.totalRMs}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-indigo-500/10 rounded-lg">
                            <span className="text-sm font-medium">Team Leaders</span>
                            <span className="text-lg font-bold text-indigo-600">{stats.totalTLs}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-emerald-500/10 rounded-lg">
                            <span className="text-sm font-medium">Active Riders</span>
                            <span className="text-lg font-bold text-emerald-600">{stats.activeRiders}</span>
                        </div>
                    </div>
                </GlassCard>

                <GlassCard className="p-6">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <Wallet size={20} className="text-amber-500" />
                        Wallet Distribution
                    </h3>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-emerald-500/10 rounded-lg">
                            <span className="text-sm font-medium">Positive Balance</span>
                            <span className="text-lg font-bold text-emerald-600">{stats.walletPositive}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-red-500/10 rounded-lg">
                            <span className="text-sm font-medium">Negative Balance</span>
                            <span className="text-lg font-bold text-red-600">{stats.walletNegative}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-amber-500/10 rounded-lg">
                            <span className="text-sm font-medium">Zero Balance</span>
                            <span className="text-lg font-bold text-amber-600">{stats.walletZero}</span>
                        </div>
                    </div>
                </GlassCard>
            </div>
        </div>
    );
};

export default CityOpsDashboard;
