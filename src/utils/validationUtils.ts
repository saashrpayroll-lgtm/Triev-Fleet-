/**
 * Validation and sanitization utility functions
 */

/**
 * Validate phone number (E.164 format with +91 prefix)
 */
export const validatePhoneNumber = (phone: string): boolean => {
    const phoneRegex = /^\+91[6-9]\d{9}$/;
    return phoneRegex.test(phone);
};

/**
 * Format phone number to E.164 format
 */
export const formatPhoneNumber = (phone: string): string => {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');

    // If starts with 91, add +
    if (digits.startsWith('91') && digits.length === 12) {
        return `+${digits}`;
    }

    // If 10 digits, add +91
    if (digits.length === 10) {
        return `+91${digits}`;
    }

    return phone;
};

/**
 * Validate email format
 */
export const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

/**
 * Validate chassis number format (alphanumeric, 17 characters typical VIN)
 */
export const validateChassisNumber = (chassis: string): boolean => {
    // Accept alphanumeric, 6-17 characters
    const chassisRegex = /^[A-Z0-9]{6,17}$/i;
    return chassisRegex.test(chassis);
};

/**
 * Validate Triev ID format
 */
export const validateTrievId = (trievId: string): boolean => {
    // Format: TR followed by digits (e.g., TR001, TR123456)
    const trievIdRegex = /^TR\d+$/i;
    return trievIdRegex.test(trievId);
};

/**
 * Generate unique Triev ID
 */
export const generateTrievId = (prefix: string = 'TR'): string => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}${timestamp}${random}`;
};

/**
 * Generate unique User ID for Team Leaders
 */
export const generateUserId = (existingCount: number = 0): string => {
    const nextNumber = existingCount + 1;
    return `TRIEV_TL${nextNumber.toString().padStart(4, '0')}`;
};

/**
 * Sanitize input to prevent XSS and injection
 */
export const sanitizeInput = (text: string): string => {
    return text
        .replace(/[<>]/g, '') // Remove angle brackets
        .replace(/['"]/g, '') // Remove quotes
        .trim();
};

/**
 * Validate wallet amount
 */
export const validateWalletAmount = (amount: number): boolean => {
    return !isNaN(amount) && isFinite(amount);
};

/**
 * Validate date is not in future
 */
export const validatePastDate = (date: Date): boolean => {
    return date <= new Date();
};

/**
 * Validate import row against schema
 */
export interface ImportRowValidation {
    isValid: boolean;
    errors: string[];
}

export const validateImportRow = (row: any, rowIndex: number): ImportRowValidation => {
    const errors: string[] = [];

    // Required fields
    if (!row['Rider Name'] || row['Rider Name'].trim() === '') {
        errors.push(`Row ${rowIndex + 1}: Rider Name is required`);
    }

    if (!row['Mobile Number']) {
        errors.push(`Row ${rowIndex + 1}: Mobile Number is required`);
    } else if (!validatePhoneNumber(formatPhoneNumber(row['Mobile Number']))) {
        errors.push(`Row ${rowIndex + 1}: Invalid mobile number format`);
    }

    if (!row['Chassis Number']) {
        errors.push(`Row ${rowIndex + 1}: Chassis Number is required`);
    }

    if (!row['Client Name']) {
        errors.push(`Row ${rowIndex + 1}: Client Name is required`);
    }

    // Optional but validated if present
    if (row['Triev ID'] && !validateTrievId(row['Triev ID'])) {
        errors.push(`Row ${rowIndex + 1}: Invalid Triev ID format (should be TR followed by numbers)`);
    }

    if (row['Wallet Amount'] !== undefined && row['Wallet Amount'] !== '') {
        const amount = parseFloat(row['Wallet Amount']);
        if (!validateWalletAmount(amount)) {
            errors.push(`Row ${rowIndex + 1}: Invalid wallet amount`);
        }
    }

    if (row['Status'] && !['active', 'inactive', 'deleted'].includes(row['Status'].toLowerCase())) {
        errors.push(`Row ${rowIndex + 1}: Status must be active, inactive, or deleted`);
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * Clean and normalize text input
 */
export const normalizeText = (text: string): string => {
    return text.trim().replace(/\s+/g, ' ');
};

/**
 * Validate password strength
 */
export const validatePasswordStrength = (password: string): { isValid: boolean; message: string } => {
    if (password.length < 8) {
        return { isValid: false, message: 'Password must be at least 8 characters long' };
    }

    if (!/[A-Z]/.test(password)) {
        return { isValid: false, message: 'Password must contain at least one uppercase letter' };
    }

    if (!/[a-z]/.test(password)) {
        return { isValid: false, message: 'Password must contain at least one lowercase letter' };
    }

    if (!/[0-9]/.test(password)) {
        return { isValid: false, message: 'Password must contain at least one number' };
    }

    return { isValid: true, message: 'Password is strong' };
};
