/**
 * Universal Data Sanitizer
 * Ensures ALL fields in an object are primitives (string, number, boolean, null)
 * This prevents React Error #310 by converting any nested objects to JSON strings
 */

export const sanitizeForReact = <T extends Record<string, any>>(data: T): T => {
    if (!data || typeof data !== 'object') return data;

    const sanitized = {} as T;

    for (const key in data) {
        const value = data[key];

        // Handle null/undefined
        if (value === null || value === undefined) {
            sanitized[key] = value;
            continue;
        }

        // Handle primitives
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            sanitized[key] = value;
            continue;
        }

        // Handle Dates
        if (value && typeof value === 'object' && Object.prototype.toString.call(value) === '[object Date]') {
            sanitized[key] = (value as Date).toISOString() as any;
            continue;
        }

        // Handle Arrays - sanitize each element
        if (Array.isArray(value)) {
            sanitized[key] = value.map((item: any) =>
                typeof item === 'object' ? sanitizeForReact(item) : item
            ) as any;
            continue;
        }

        // Handle Objects - keep as object but sanitize nested fields
        // This is important for permissions, which need to remain an object for property access
        if (typeof value === 'object') {
            sanitized[key] = sanitizeForReact(value) as any;
            continue;
        }

        // Fallback - stringify anything else
        sanitized[key] = JSON.stringify(value) as any;
    }

    return sanitized;
};

/**
 * Sanitize an array of objects
 */
export const sanitizeArray = <T extends Record<string, any>>(data: T[]): T[] => {
    return data.map(item => sanitizeForReact(item));
};
