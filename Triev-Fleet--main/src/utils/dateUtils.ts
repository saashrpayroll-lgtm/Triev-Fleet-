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
 * Standardized Universal Date Parser for Google Sheets, Forms, and Excel Dates
 * Handles M/D/YYYY (Google Sheet/Form source format), DD/MM/YYYY, ISO, and Excel serial numbers.
 * e.g. "9/3/2026 12:25:04 PM" -> Month 9 (September), Day 3, Year 2026
 * e.g. "9/25/2026" -> Month 9 (September), Day 25, Year 2026
 * e.g. "25/09/2026" -> Day 25, Month 9 (September), Year 2026
 * e.g. "2026-09-03" -> Year 2026, Month 9, Day 3
 */
export const parseIndianDate = (dateRaw: any): string | null => {
    if (!dateRaw) return null;

    // 1. Check if it's an Excel serial number date (e.g. 46246)
    if (typeof dateRaw === 'number' || (typeof dateRaw === 'string' && !isNaN(Number(dateRaw)) && Number(dateRaw) > 20000 && Number(dateRaw) < 80000)) {
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

    // 2. ISO or YYYY-MM-DD or YYYY/MM/DD (e.g., "2026-09-03" or "2026-09-03T12:25:04.000Z")
    const yyyymmddMatch = cleanDate.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?(?:\.\d+)?(?:Z|[\+\-]\d{2}:\d{2})?)?$/);
    if (yyyymmddMatch) {
        const [, yearStr, monthStr, dayStr, h, m, s] = yyyymmddMatch;
        const yearNum = parseInt(yearStr, 10);
        let monthNum = parseInt(monthStr, 10);
        let dayNum = parseInt(dayStr, 10);

        // Auto-fix inverted YYYY-DD-MM where month > 12 (e.g. 2026-25-09 -> 2026-09-25)
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

    // 3. M/D/YYYY or D/M/YYYY with optional time and AM/PM
    // Matches "9/3/2026 12:25:04 PM", "9/3/2026", "25/09/2026", "09/25/2026"
    const slashMatch = cleanDate.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?(?:\s*(AM|PM|am|pm))?/i);
    if (slashMatch) {
        const [, firstStr, secondStr, yearStr, hourStr, minStr, secStr, ampm] = slashMatch;

        const firstNum = parseInt(firstStr, 10);
        const secondNum = parseInt(secondStr, 10);
        const yearNum = yearStr.length === 2 ? 2000 + parseInt(yearStr, 10) : parseInt(yearStr, 10);

        let monthNum: number;
        let dayNum: number;

        if (firstNum > 12 && secondNum <= 12) {
            // First number > 12 -> cannot be month, MUST be Day (DD/MM/YYYY)
            // e.g. "25/09/2026" -> Day: 25, Month: 9
            dayNum = firstNum;
            monthNum = secondNum;
        } else if (secondNum > 12 && firstNum <= 12) {
            // Second number > 12 -> cannot be month, MUST be Day (MM/DD/YYYY)
            // e.g. "09/25/2026" -> Month: 9, Day: 25
            monthNum = firstNum;
            dayNum = secondNum;
        } else {
            // Both <= 12 (e.g. "9/3/2026 12:25:04 PM" or "9/3/2026"):
            // Google Sheets & Forms exports in M/D/YYYY format (Month 9 = September, Day 3 = 3rd).
            monthNum = firstNum;
            dayNum = secondNum;
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

    // 4. Fallback to native Date parsing, forcing Noon IST
    const d = new Date(cleanDate);
    if (!isNaN(d.getTime())) {
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T12:00:00.000+05:30`;
    }

    return null;
};

/**
 * Universal Date Display Formatter
 * Formats any date string/object to "03 Sep 2026" or "12 Aug 2026" (DD MMM YYYY)
 * Correctly interprets Google Sheet M/D/YYYY and standard ISO formats.
 */
export const formatDateDisplay = (dateRaw: any, fallback = 'N/A'): string => {
    if (!dateRaw || dateRaw === 'N/A' || dateRaw === 'null' || dateRaw === 'undefined') return fallback;

    let clean = String(dateRaw).trim();
    if (!clean) return fallback;

    const pad = (n: any) => String(n).padStart(2, '0');
    const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // 1. First parse using universal date parser
    const isoParsed = parseIndianDate(clean);
    if (isoParsed) {
        const datePart = isoParsed.split('T')[0];
        const parts = datePart.split('-');
        if (parts.length === 3) {
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10);
            const d = parseInt(parts[2], 10);
            if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
                return `${pad(d)} ${monthsShort[m - 1]} ${y}`;
            }
        }
    }

    // 2. Fallback to native Date if clean is a non-standard string
    const d = new Date(clean);
    if (!isNaN(d.getTime())) {
        return `${pad(d.getDate())} ${monthsShort[d.getMonth()]} ${d.getFullYear()}`;
    }

    return clean;
};

/**
 * Extracts a valid YYYY-MM-DD IST string for historical calculations.
 * Automatically un-inverts historical dates if month and day were swapped.
 */
export const getValidHistoricalDate = (dateRaw: string | null | undefined, fallbackDate?: string | null): string | null => {
    if (!dateRaw) return fallbackDate ? getValidHistoricalDate(fallbackDate) : null;

    try {
        const parsed = parseIndianDate(dateRaw);
        if (parsed) {
            let resultDate = parsed.split('T')[0];

            // Heuristic un-inversion: If created_at is provided, check if allotment was inverted
            // e.g. allotment_date is 2026-03-09, but created_at is in September (month 9)
            if (fallbackDate) {
                const parsedFallback = parseIndianDate(fallbackDate);
                if (parsedFallback) {
                    const [ay, am, ad] = resultDate.split('-').map(Number);
                    const [cy, cm] = parsedFallback.split('T')[0].split('-').map(Number);
                    if (ay === cy && ad === cm && am !== cm && am <= 12) {
                        resultDate = `${ay}-${String(cm).padStart(2, '0')}-${String(am).padStart(2, '0')}`;
                    }
                }
            }

            const todayIst = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
            if (resultDate > todayIst) {
                const [y, m, d] = resultDate.split('-');
                const fixed = `${y}-${d}-${m}`;
                if (fixed <= todayIst) {
                    resultDate = fixed;
                } else {
                    resultDate = todayIst;
                }
            }

            return resultDate;
        }

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
 * If allotmentDate is missing or in the future relative to today,
 * it safely falls back to created_at (or today's ISO).
 * Properly preserves re-allotments and manually updated allotment dates.
 */
export const getValidAllotmentDate = (allotmentDateRaw: any, createdAtRaw?: any): string => {
    let parsedAllotment = parseIndianDate(allotmentDateRaw);
    const parsedCreated = parseIndianDate(createdAtRaw);

    // Heuristic un-inversion: If created_at is provided, check if allotment was inverted
    // e.g. allotment_date is 2026-03-09, but created_at is in September (month 9)
    if (parsedAllotment && parsedCreated) {
        const [ay, am, ad] = parsedAllotment.split('T')[0].split('-').map(Number);
        const [cy, cm] = parsedCreated.split('T')[0].split('-').map(Number);
        if (ay === cy && ad === cm && am !== cm && am <= 12) {
            parsedAllotment = `${ay}-${String(cm).padStart(2, '0')}-${String(am).padStart(2, '0')}T12:00:00.000+05:30`;
        }
    }

    const now = Date.now();
    const allotmentTime = parsedAllotment ? new Date(parsedAllotment).getTime() : 0;

    // If no allotment date, fallback to created_at or today
    if (!parsedAllotment || !allotmentTime) {
        return parsedCreated || new Date().toISOString();
    }

    // Guard: If allotment date is in the future relative to today + 1 day
    if (allotmentTime > (now + 86400000)) {
        return parsedCreated || new Date().toISOString();
    }

    return parsedAllotment;
};


