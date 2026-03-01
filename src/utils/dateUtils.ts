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

    // A robust way to get current IST Date components
    const now = new Date();
    const istDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
    const [year, month, day] = istDateStr.split('-').map(Number);

    // Create a working Date object set exactly to Midnight IST for today, but represented in the local time 
    // to allow safe use of .getDate(), .getDay(), etc., without timezone shift issues.
    // Actually, the simplest foolproof way to do date math without external libraries is to use UTC.
    // We treat the IST year/month/day as a UTC date, do the math, and extract the string.
    const workingDateUTC = new Date(Date.UTC(year, month - 1, day));

    let start = istDateStr;
    let end = istDateStr;

    switch (filter) {
        case 'day':
            // Already set to today
            break;
        case 'week':
            // ISO Week (Monday start)
            const weekDay = workingDateUTC.getUTCDay();
            const diff = workingDateUTC.getUTCDate() - weekDay + (weekDay === 0 ? -6 : 1);
            const weekStartUTC = new Date(workingDateUTC);
            weekStartUTC.setUTCDate(diff);
            start = weekStartUTC.toISOString().split('T')[0];
            break;
        case 'month':
            const monthStartUTC = new Date(Date.UTC(year, month - 1, 1));
            start = monthStartUTC.toISOString().split('T')[0];
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
