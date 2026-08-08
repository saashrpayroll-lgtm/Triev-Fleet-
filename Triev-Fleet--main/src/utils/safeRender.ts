/**
 * Safely converts any value to a string for React rendering.
 * Prevents "Objects are not valid as a React child" (Error #310).
 */
export const safeRender = (value: any, fallback: string = ''): string => {
    if (value === null || value === undefined) return fallback;

    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'; // Or empty string, depends on use case

    // Handle Dates
    if (value instanceof Date) return value.toLocaleString();

    // Handle Objects (including Errors and Arrays)
    if (typeof value === 'object') {
        try {
            // If it's an Error object, show the message
            if (value instanceof Error) return value.message;
            if (value.message) return String(value.message);

            // If it has a custom toString that isn't the default Object one
            const str = String(value);
            if (str !== '[object Object]') return str;

            return JSON.stringify(value);
        } catch (e) {
            return 'Invalid Data';
        }
    }

    return String(value);
};
