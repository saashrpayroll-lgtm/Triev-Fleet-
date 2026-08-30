/**
 * Cryptographic & Client-Side Security Utilities
 * Protects login portals against automated brute-force attacks, XSS injection, and bot spam.
 */

// Simple sanitize utility to prevent XSS and malicious injection
export const sanitizeInput = (input: string): string => {
    if (!input) return '';
    return input
        .trim()
        .replace(/[<>]/g, '') // Strip angle brackets
        .slice(0, 150); // Hard length limit to prevent buffer/DoS payloads
};

// Rate limiter keys
const RATE_LIMIT_PREFIX = 'triev_sec_lock_';

export interface RateLimitStatus {
    isLocked: boolean;
    remainingSeconds: number;
    attempts: number;
}

/**
 * Checks if a login endpoint is currently rate-limited/locked.
 */
export const checkRateLimit = (actionKey: string): RateLimitStatus => {
    try {
        const storageKey = `${RATE_LIMIT_PREFIX}${actionKey}`;
        const rawData = localStorage.getItem(storageKey);
        if (!rawData) return { isLocked: false, remainingSeconds: 0, attempts: 0 };

        const { attempts, lockedUntil } = JSON.parse(rawData);
        const now = Date.now();

        if (lockedUntil && now < lockedUntil) {
            const remainingSeconds = Math.ceil((lockedUntil - now) / 1000);
            return { isLocked: true, remainingSeconds, attempts };
        }

        // If lock expired, reset
        if (lockedUntil && now >= lockedUntil) {
            localStorage.removeItem(storageKey);
            return { isLocked: false, remainingSeconds: 0, attempts: 0 };
        }

        return { isLocked: false, remainingSeconds: 0, attempts: attempts || 0 };
    } catch {
        return { isLocked: false, remainingSeconds: 0, attempts: 0 };
    }
};

/**
 * Records a failed attempt and activates a lockout if maxAttempts reached.
 */
export const recordFailedAttempt = (actionKey: string, maxAttempts = 5, lockDurationMs = 60000): RateLimitStatus => {
    try {
        const storageKey = `${RATE_LIMIT_PREFIX}${actionKey}`;
        const current = checkRateLimit(actionKey, maxAttempts, lockDurationMs);
        const newAttempts = current.attempts + 1;

        if (newAttempts >= maxAttempts) {
            const lockedUntil = Date.now() + lockDurationMs;
            localStorage.setItem(storageKey, JSON.stringify({ attempts: newAttempts, lockedUntil }));
            return { isLocked: true, remainingSeconds: Math.ceil(lockDurationMs / 1000), attempts: newAttempts };
        }

        localStorage.setItem(storageKey, JSON.stringify({ attempts: newAttempts, lockedUntil: null }));
        return { isLocked: false, remainingSeconds: 0, attempts: newAttempts };
    } catch {
        return { isLocked: false, remainingSeconds: 0, attempts: 1 };
    }
};

/**
 * Resets the rate limiter on successful authentication.
 */
export const resetRateLimit = (actionKey: string): void => {
    try {
        localStorage.removeItem(`${RATE_LIMIT_PREFIX}${actionKey}`);
    } catch {}
};
