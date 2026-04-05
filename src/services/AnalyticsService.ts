import { supabase } from '@/config/supabase';
import { fetchAllRidersPaginated } from '@/utils/dbUtils';
import { format, subMonths, eachMonthOfInterval } from 'date-fns';

export interface AnalyticsData {
    riderGrowth: { name: string; riders: number }[];
    leadFunnel: { name: string; value: number }[];
    clientDistribution: { name: string; value: number }[];
    walletHealth: { name: string; value: number; color: string }[];
    revenueTrend: { name: string; amount: number }[]; // Mocked for now or based on wallet inputs
    tlPerformance: {
        tlId: string;
        tlName: string;
        activeRiders: number;
        totalCollection: number; // 30-day window
        arpu: number; // Avg Revenue Per User (Total / Active)
        totalDebt: number; // Sum of negative wallets
    }[];
    kpis: {
        totalRiders: number;
        activeRiders: number;
        totalLeads: number;
        conversionRate: number;
    };
}

export interface AnalyticsConfig {
    scopedCityOpsId?: string;
    scopedRmIds?: string[];
    scopedTlIds?: string[];
}

export const AnalyticsService = {
    fetchDashboardAnalytics: async (_config?: AnalyticsConfig): Promise<AnalyticsData> => {
        if (_config) {
            console.debug('Analytics Scope Config:', _config);
        }
        
        const today = new Date();
        const sixMonthsAgo = subMonths(today, 5);

        try {
            // Parallel Fetching
            const [ridersRes, leadsRes] = await Promise.all([
                fetchAllRidersPaginated('id, created_at, client_name, wallet_amount, status, team_leader_id'),
                supabase.from('leads').select('id, status, created_at')
            ]);

            if (ridersRes.error) throw ridersRes.error;
            if (leadsRes.error) throw leadsRes.error;

            const riders = ridersRes.data || [];
            const leads = leadsRes.data || [];

            // 1. Rider Growth (Last 6 Months)
            const months = eachMonthOfInterval({ start: sixMonthsAgo, end: today });
            const riderGrowth = months.map(date => {
                const monthKey = format(date, 'MMM yyyy');
                // Count riders created in this month or before? usually growth implies total active or new. 
                // Let's do "New Riders" per month for trend.
                const count = riders.filter(r => {
                    const rDate = new Date(r.created_at);
                    return format(rDate, 'MMM yyyy') === monthKey;
                }).length;

                return { name: format(date, 'MMM'), riders: count };
            });

            // 2. Lead Funnel
            const leadFunnelMap = {
                'New': 0,
                'Convert': 0,
                'Not Convert': 0
            };
            leads.forEach(l => {
                const s = l.status as keyof typeof leadFunnelMap;
                if (leadFunnelMap[s] !== undefined) leadFunnelMap[s]++;
            });
            const leadFunnel = [
                { name: 'New Leads', value: leadFunnelMap['New'] },
                { name: 'Converted', value: leadFunnelMap['Convert'] },
                { name: 'Lost', value: leadFunnelMap['Not Convert'] }
            ];

            // 3. Client Distribution
            const clientMap: Record<string, number> = {};
            riders.forEach(r => {
                const client = r.client_name || 'Unassigned';
                clientMap[client] = (clientMap[client] || 0) + 1;
            });
            const clientDistribution = Object.entries(clientMap)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 5); // Top 5

            // 4. Wallet Health
            // ✅ CRITICAL: Only active riders count toward wallet health.
            // Inactive riders are excluded entirely — their balance is no longer tracked.
            // Aligns with TLPerformance.tsx which maps: wallet_amount = status==='active' ? wallet_amount : 0
            let positive = 0;
            let negative = 0;
            let zero = 0;
            const activeRidersList = riders.filter(r => r.status === 'active');
            activeRidersList.forEach(r => {
                const w = r.wallet_amount || 0;
                if (w > 0) positive++;
                else if (w < 0) negative++;
                else zero++;
            });
            const walletHealth = [
                { name: 'Positive Balance', value: positive, color: '#22c55e' }, // Green
                { name: 'Negative Balance', value: negative, color: '#ef4444' }, // Red
                { name: 'Zero Balance', value: zero, color: '#94a3b8' } // Gray
            ];

            // 5. KPIs
            const totalRiders = riders.length;
            const activeRiders = riders.filter(r => r.status === 'active').length;
            const totalLeads = leads.length;
            const converted = leadFunnelMap['Convert'];
            const conversionRate = totalLeads > 0 ? Math.round((converted / totalLeads) * 100) : 0;

            // 6. TL Performance (ARPU & Debt)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const thirtyDaysAgoStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(thirtyDaysAgo);

            const [tlsRes, collectionsRes] = await Promise.all([
                supabase.from('users').select('id, full_name').eq('role', 'teamLeader'),
                supabase.from('daily_collections')
                    .select('team_leader_id, total_collection, date')
                    .gte('date', thirtyDaysAgoStr)
            ]);

            const tls = tlsRes.data || [];
            const collections = collectionsRes.data || [];

            const tlPerformance = tls.map(tl => {
                const tlRiders = activeRidersList.filter(r => r.team_leader_id === tl.id);
                const activeCount = tlRiders.length;

                // Sum 30-day collections
                const tlColls = collections.filter(c => c.team_leader_id === tl.id);
                const totalCol = tlColls.reduce((sum, current) => sum + (Number(current.total_collection) || 0), 0);

                // Calculate ARPU (Total Collection / Active Riders)
                const arpu = activeCount > 0 ? Math.round(totalCol / activeCount) : 0;

                // Calculate Debt (Sum of negative wallets)
                const totalDebt = tlRiders.reduce((sum, r) => {
                    const w = r.wallet_amount || 0;
                    return w < 0 ? sum + Math.abs(w) : sum;
                }, 0);

                return {
                    tlId: tl.id,
                    tlName: tl.full_name || 'Unknown TL',
                    activeRiders: activeCount,
                    totalCollection: totalCol,
                    arpu,
                    totalDebt
                };
            }).sort((a, b) => b.totalCollection - a.totalCollection);

            return {
                riderGrowth,
                leadFunnel,
                clientDistribution,
                walletHealth,
                revenueTrend: [], // Placeholder
                tlPerformance,
                kpis: {
                    totalRiders,
                    activeRiders,
                    totalLeads,
                    conversionRate
                }
            };

        } catch (error) {
            console.error("Analytics Error:", error);
            throw error;
        }
    }
};
