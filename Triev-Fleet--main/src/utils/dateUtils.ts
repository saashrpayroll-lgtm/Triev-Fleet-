// PerformancePeriod defined here to avoid circular dependency with performance.ts
export interface PerformancePeriod {
    start: string; // YYYY-MM-DD
    end: string;   // YYYY-MM-DD
}

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
 * Strictly handles DD/MM/YYYY and DD/MM/YYYY HH:mm:ss formats (Indian Google Sheet locale)
 * e.g. "4/6/2026 16:12:03" -> Day 4, Month 6 (June), Year 2026
 * e.g. "12/08/2026" -> Day 12, Month 8 (August), Year 2026
 * e.g. "13/08/2026" -> Day 13, Month 8 (August), Year 2026
 */
export const parseIndianDate = (dateRaw: any): string | null => {
    if (!dateRaw) return null;

    // 1. Check if it's an Excel serial number date (e.g. 46246)
    if (typeof dateRaw === 'number' || (typeof dateRaw === 'string' && !isNaN(Number(dateRaw)) && Number(dateRaw) > 20000)) {
        const days = Number(dateRaw);
        const msSince1900 = (days - (days > 59 ? 25569 : 25568)) * 86400 * 1000;
        const d = new Date(msSince1900);
        if (!isNaN(d.getTime())) {
            const pad = (n: any) => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T12:00:00.000+05:30`;
        }
        return null;
    }

    let cleanDate = String(dateRaw).trim();
    if (!cleanDate) return null;

    const pad = (n: any) => String(n).padStart(2, '0');

    // 2. PRIMARY: Strict DD/MM/YYYY or DD-MM-YYYY (Indian Google Sheet Locale)
    // Matches "4/6/2026 16:12:03", "12/08/2026", "13/08/2026", "04/06/2026"
    // Group 1 = DAY (DD), Group 2 = MONTH (MM), Group 3 = YEAR (YYYY)
    const ddmmyyyyMatch = cleanDate.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?(?:\s*(AM|PM|am|pm))?/i);
    if (ddmmyyyyMatch) {
        const [, dayStr, monthStr, yearStr, hourStr, minStr, secStr, ampm] = ddmmyyyyMatch;

        let dayNum = parseInt(dayStr, 10);
        let monthNum = parseInt(monthStr, 10);
        const yearNum = yearStr.length === 2 ? 2000 + parseInt(yearStr, 10) : parseInt(yearStr, 10);

        // Auto-fix inverted MM/DD/YYYY where month > 12
        if (monthNum > 12 && dayNum <= 12) {
            const temp = monthNum;
            monthNum = dayNum;
            dayNum = temp;
        }

        let hourNum = hourStr ? parseInt(hourStr, 10) : 12;
        if (ampm) {
            const isPM = ampm.toLowerCase() === 'pm';
            if (isPM && hourNum < 12) hourNum += 12;
            if (!isPM && hourNum === 12) hourNum = 0;
        }

        if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31 && yearNum > 1900) {
            return `${yearNum}-${pad(monthNum)}-${pad(dayNum)}T${pad(hourNum)}:${pad(minStr || '00')}:${pad(secStr || '00')}.000+05:30`;
        }
    }

    // 3. SECONDARY: ISO or YYYY-MM-DD or YYYY-DD-MM (e.g., "2026-16-03" or "2026-08-12")
    // Group 1 = YEAR (YYYY), Group 2 = MONTH (MM), Group 3 = DAY (DD)
    const yyyymmddMatch = cleanDate.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?(?:\.\d+)?(?:Z|[\+\-]\d{2}:\d{2})?)?$/);
    if (yyyymmddMatch) {
        const [, yearStr, monthStr, dayStr, h, m, s] = yyyymmddMatch;
        const yearNum = parseInt(yearStr, 10);
        let monthNum = parseInt(monthStr, 10);
        let dayNum = parseInt(dayStr, 10);

        // Auto-fix inverted YYYY-DD-MM where month > 12 (e.g. 2026-16-03 -> 2026-03-16)
        if (monthNum > 12 && dayNum <= 12) {
            const temp = monthNum;
            monthNum = dayNum;
            dayNum = temp;
        }

        const hr = h ? pad(h) : '12';
        const min = m ? pad(m) : '00';
        const sec = s ? pad(s) : '00';
        if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
            return `${yearNum}-${pad(monthNum)}-${pad(dayNum)}T${hr}:${min}:${sec}.000+05:30`;
        }
    }

    // 4. Fallback to native parsing, forcing Noon IST
    const d = new Date(cleanDate);
    if (!isNaN(d.getTime())) {
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T12:00:00.000+05:30`;
    }

    return null;
};

/**
 * Universal Indian Date Display Formatter
 * Formats any date string/object to "12 Aug 2026" or "04 Jun 2026" (DD MMM YYYY)
 * Strictly treats DD/MM/YYYY strings as Day/Month/Year.
 */
export const formatDateDisplay = (dateRaw: any, fallback = 'N/A'): string => {
    if (!dateRaw || dateRaw === 'N/A' || dateRaw === 'null' || dateRaw === 'undefined') return fallback;

    let clean = String(dateRaw).trim();
    if (!clean) return fallback;

    const pad = (n: any) => String(n).padStart(2, '0');
    const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // 1. Strict DD/MM/YYYY or DD-MM-YYYY
    const ddmmyyyyMatch = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (ddmmyyyyMatch) {
        const [, dayStr, monthStr, yearStr] = ddmmyyyyMatch;
        const dayNum = parseInt(dayStr, 10);
        const monthNum = parseInt(monthStr, 10);
        const yearNum = yearStr.length === 2 ? 2000 + parseInt(yearStr, 10) : parseInt(yearStr, 10);

        if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
            return `${pad(dayNum)} ${monthsShort[monthNum - 1]} ${yearNum}`;
        }
    }

    // 2. YYYY-MM-DD or ISO string (e.g. "2026-08-12")
    const yyyymmddMatch = clean.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (yyyymmddMatch) {
        const [, yearStr, monthStr, dayStr] = yyyymmddMatch;
        const yearNum = parseInt(yearStr, 10);
        const monthNum = parseInt(monthStr, 10);
        const dayNum = parseInt(dayStr, 10);

        if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
            return `${pad(dayNum)} ${monthsShort[monthNum - 1]} ${yearNum}`;
        }
    }

    // 3. Fallback to parseIndianDate
    const isoParsed = parseIndianDate(clean);
    if (isoParsed) {
        const parts = isoParsed.split('T')[0].split('-');
        if (parts.length === 3) {
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10);
            const d = parseInt(parts[2], 10);
            if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
                return `${pad(d)} ${monthsShort[m - 1]} ${y}`;
            }
        }
    }

    return clean;
};

/**
 * Extracts a valid YYYY-MM-DD IST string for historical calculations.
 * Automatically detects and fixes inverted DD/MM to MM/DD import bugs (dates in the future).
 */
export const getValidHistoricalDate = (dateRaw: string | null | undefined, fallbackDate?: string | null): string | null => {
    if (!dateRaw) return fallbackDate ? getValidHistoricalDate(fallbackDate) : null;

    try {
        const parsed = parseIndianDate(dateRaw);
        if (parsed) return parsed.split('T')[0];

        const d = new Date(dateRaw);
        if (isNaN(d.getTime())) return fallbackDate ? getValidHistoricalDate(fallbackDate) : null;

        let istStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
        const todayIst = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

        if (istStr > todayIst) {
            const [y, m, day] = istStr.split('-');
            const fixedDate = `${y}-${day}-${m}`;
            if (fixedDate <= todayIst) {
                istStr = fixedDate;
            } else {
                istStr = todayIst;
            }
        }
        return istStr;
    } catch {
        return fallbackDate ? getValidHistoricalDate(fallbackDate) : null;
    }
};
/**
 * Resolves a safe allotment date.
 * If allotmentDate is missing, in the future relative to today, or later than created_at + 1 day,
 * it safely falls back to created_at (or today's ISO).
 */
export const getValidAllotmentDate = (allotmentDateRaw: any, createdAtRaw?: any): string => {
    const parsedAllotment = parseIndianDate(allotmentDateRaw);
    const parsedCreated = parseIndianDate(createdAtRaw);

    const now = Date.now();
    const allotmentTime = parsedAllotment ? new Date(parsedAllotment).getTime() : 0;
    const createdTime = parsedCreated ? new Date(parsedCreated).getTime() : 0;

    // If no allotment date, fallback to created_at or today
    if (!parsedAllotment || !allotmentTime) {
        return parsedCreated || new Date().toISOString();
    }

    // Guard 1: If allotment date is in the future relative to today (e.g. Dec 2026 when today is Aug 2026)
    if (allotmentTime > (now + 86400000)) {
        return parsedCreated || new Date().toISOString();
    }

    // Guard 2: If allotment date is significantly later than created_at (e.g. created Aug 12, allotment Dec 08)
    if (createdTime > 0 && allotmentTime > (createdTime + 86400000)) {
        return parsedCreated || new Date().toISOString();
    }

    return parsedAllotment;
};


