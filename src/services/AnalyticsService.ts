import { supabase } from '@/config/supabase';
import { startOfMonth, format, subMonths, eachMonthOfInterval, startOfYear, endOfMonth } from 'date-fns';

export interface AnalyticsData {
    riderGrowth: { name: string; riders: number }[];
    leadFunnel: { name: string; value: number }[];
    clientDistribution: { name: string; value: number }[];
    walletHealth: { name: string; value: number; color: string }[];
    revenueTrend: { name: string; amount: number }[]; // Mocked for now or based on wallet inputs
    kpis: {
        totalRiders: number;
        activeRiders: number;
        totalLeads: number;
        conversionRate: number;
    };
}

export const AnalyticsService = {
    fetchDashboardAnalytics: async (): Promise<AnalyticsData> => {
        const today = new Date();
        const sixMonthsAgo = subMonths(today, 5);

        try {
            // Parallel Fetching
            const [ridersRes, leadsRes] = await Promise.all([
                supabase.from('riders').select('id, created_at, client_name, wallet_amount, status'),
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
            let positive = 0;
            let negative = 0;
            let zero = 0;
            riders.forEach(r => {
                if (r.wallet_amount > 0) positive++;
                else if (r.wallet_amount < 0) negative++;
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

            // 6. Mock Revenue Trend (Since we don't have transaction history yet)
            // We'll mimic it based on rider growth * avg wallet recharge assumption or just random for demo
            // requested by user "More advanced reports ... coming soon" -> we are implementing them now.
            // Let's use Rider Count * 500 (avg rent/week) purely for visualization if no real data
            // OR better: Leave it empty if no data. User asked to "Complete" it. 
            // Let's use "Estimated Revenue" based on Active Riders * arbitrary avg 
            // Actually, let's skip "Revenue" if we can't calculate it real. 
            // Instead, let's show "Wallet Liability" trend? No history.
            // Let's stick to "New Riders" trend which is real.

            return {
                riderGrowth,
                leadFunnel,
                clientDistribution,
                walletHealth,
                revenueTrend: [], // Placeholder
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
