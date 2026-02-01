// Password utility functions for the password reset system

// Default password for reset
export const DEFAULT_RESET_PASSWORD = '123456';

// Simple hash function (in production, use bcrypt or similar)
// For now, we'll use a simple approach since Supabase handles auth
export const hashPassword = async (password: string): Promise<string> => {
    // In a real app, use bcrypt or similar
    // For this implementation, we'll rely on Supabase's built-in password hashing
    return password;
};

// Verify password
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
    // In a real app, use bcrypt.compare
    // For this implementation, we'll rely on Supabase's built-in verification
    return password === hash;
};

// Password validation rules
export interface PasswordValidation {
    isValid: boolean;
    errors: string[];
}

export const validatePassword = (password: string): PasswordValidation => {
    const errors: string[] = [];

    if (!password || password.length < 6) {
        errors.push('Password must be at least 6 characters long');
    }

    if (!/\d/.test(password)) {
        errors.push('Password must contain at least one number');
    }

    if (!/[a-zA-Z]/.test(password)) {
        errors.push('Password must contain at least one letter');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

// Validate mobile number (Indian format)
export const validateMobileNumber = (mobile: string): boolean => {
    // Remove any spaces or special characters
    const cleaned = mobile.replace(/\D/g, '');

    // Check if it's 10 digits
    if (cleaned.length !== 10) {
        return false;
    }

    // Check if it starts with 6, 7, 8, or 9
    const firstDigit = cleaned.charAt(0);
    return ['6', '7', '8', '9'].includes(firstDigit);
};

// Format mobile number for display
export const formatMobileNumber = (mobile: string): string => {
    const cleaned = mobile.replace(/\D/g, '');
    if (cleaned.length === 10) {
        return `${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
    }
    return mobile;
};
