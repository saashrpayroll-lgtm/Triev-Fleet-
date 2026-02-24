import { PerformancePeriod } from './performance';

export type DateFilterType = 'day' | 'week' | 'month' | 'custom' | 'all';

export interface CustomDateRange {
    start: string;
    end: string;
}

/**
 * Standardized Date Resolver for Performance Metrics
 */
export const resolvePerformancePeriod = (
    filter: DateFilterType,
    customRange?: CustomDateRange
): PerformancePeriod | undefined => {
    if (filter === 'all') return undefined;

    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
    const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const nowISTStr = formatter.format(nowIST);

    let start = nowISTStr;
    let end = nowISTStr;

    switch (filter) {
        case 'day':
            // Already set to today
            break;
        case 'week':
            const weekStart = new Date(nowIST);
            // ISO Week (Monday start)
            const day = weekStart.getDay();
            const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
            weekStart.setDate(diff);
            start = formatter.format(weekStart);
            break;
        case 'month':
            const monthStart = new Date(nowIST.getFullYear(), nowIST.getMonth(), 1);
            start = formatter.format(monthStart);
            break;
        case 'custom':
            if (customRange?.start && customRange?.end) {
                start = customRange.start;
                end = customRange.end;
            }
            break;
        default:
            return undefined;
    }

    return { start, end };
};
