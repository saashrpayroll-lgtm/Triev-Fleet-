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

/**
 * Standardized Date Parser for Excel/User Input Dates
 * Ensures robust handling of DD/MM/YYYY formats which
 * native JS `new Date()` wrongly interprets as MM/DD/YYYY
 */
export const parseIndianDate = (dateRaw: any): string | null => {
    if (!dateRaw) return null;

    // Check if it's an Excel serial number date
    if (typeof dateRaw === 'number' || (typeof dateRaw === 'string' && !isNaN(Number(dateRaw)) && Number(dateRaw) > 20000)) {
        // Excel serial dates: 1 = Jan 1, 1900.
        // JS Date uses ms from Jan 1, 1970
        // Approx 25569 days between 1900 and 1970 (depending on Excel 1900 leap year bug)
        const days = Number(dateRaw);
        // Correct for 1900 leap year bug by subtracting 1 more day if > 59 (Feb 28, 1900)
        const msSince1900 = (days - (days > 59 ? 25569 : 25568)) * 86400 * 1000;
        const d = new Date(msSince1900);
        if (!isNaN(d.getTime())) {
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T12:00:00.000+05:30`;
        }
        return null;
    }

    const cleanDate = String(dateRaw).trim();
    if (!cleanDate) return null;

    const pad = (n: any) => String(n).padStart(2, '0');

    // 1. Try ISO or YYYY-MM-DD
    const yyyymmddMatch = cleanDate.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?(?:\.\d+)?(?:Z|[\+\-]\d{2}:\d{2})?)?$/);
    if (yyyymmddMatch) {
        const [, year, month, day, h, m, s] = yyyymmddMatch;
        const hr = h ? pad(h) : '12';
        const min = m ? pad(m) : '00';
        const sec = s ? pad(s) : '00';
        // Validate month and day are logical
        if (Number(month) <= 12 && Number(day) <= 31) {
            return `${year}-${pad(month)}-${pad(day)}T${hr}:${min}:${sec}.000+05:30`;
        }
    }

    // 2. Try DD/MM/YYYY (Indian format)
    const ddmmyyyyMatch = cleanDate.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?(?:\s*(AM|PM|am|pm))?/);
    if (ddmmyyyyMatch) {
        const [, dayStr, monthStr, yearStr, hourStr, minStr, secStr, ampm] = ddmmyyyyMatch;

        const yearNum = yearStr.length === 2 ? 2000 + parseInt(yearStr, 10) : parseInt(yearStr, 10);
        const monthNum = parseInt(monthStr, 10);
        const dayNum = parseInt(dayStr, 10);

        let hourNum = hourStr ? parseInt(hourStr, 10) : 12;
        if (ampm) {
            const isPM = ampm.toLowerCase() === 'pm';
            if (isPM && hourNum < 12) hourNum += 12;
            if (!isPM && hourNum === 12) hourNum = 0;
        }

        // Must be a valid date
        if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31 && yearNum > 1900) {
            return `${yearNum}-${pad(monthNum)}-${pad(dayNum)}T${pad(hourNum)}:${pad(minStr || '00')}:${pad(secStr || '00')}.000+05:30`;
        }
    }

    // 3. Fallback to native parsing, but force to Noon IST
    const d = new Date(cleanDate);
    if (!isNaN(d.getTime())) {
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T12:00:00.000+05:30`;
    }

    return null;
};
