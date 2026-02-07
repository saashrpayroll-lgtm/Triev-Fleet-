import { supabase } from '@/config/supabase';
import { format, subDays } from 'date-fns';

export interface DailyMetric {
    date: string;
    metrics: {
        wallet_balance: number;
        active_riders: number;
        leads_generated: number;
        leads_converted: number;
    };
}

export const DashboardService = {
    /**
     * Fetches historical performance metrics for a specific Team Leader or Entity.
     */
    getHistoricalMetrics: async (entityId: string, days: number = 30): Promise<DailyMetric[]> => {
        const endDate = new Date();
        const startDate = subDays(endDate, days);

        const { data, error } = await supabase
            .from('performance_metrics')
            .select('date, metrics')
            .eq('entity_id', entityId)
            .gte('date', format(startDate, 'yyyy-MM-dd'))
            .lte('date', format(endDate, 'yyyy-MM-dd'))
            .order('date', { ascending: true });

        if (error) {
            console.error('Error fetching historical metrics:', error);
            return [];
        }

        return data.map(row => ({
            date: row.date,
            metrics: row.metrics as any
        }));
    },

    /**
     * Fetches aggregated metrics for multiple Team Leaders for comparison.
     */
    getComparisonMetrics: async (entityIds: string[], days: number = 30) => {
        const endDate = new Date();
        const startDate = subDays(endDate, days);

        const { data, error } = await supabase
            .from('performance_metrics')
            .select('entity_id, date, metrics')
            .in('entity_id', entityIds)
            .gte('date', format(startDate, 'yyyy-MM-dd'))
            .lte('date', format(endDate, 'yyyy-MM-dd'))
            .order('date', { ascending: true });

        if (error) {
            console.error('Error fetching comparison metrics:', error);
            return [];
        }

        return data;
    }
};
