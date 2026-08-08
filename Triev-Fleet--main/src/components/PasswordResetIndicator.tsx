import React from 'react';
import { Key } from 'lucide-react';

interface PasswordResetIndicatorProps {
    hasPendingReset: boolean;
    onClick?: () => void;
}

const PasswordResetIndicator: React.FC<PasswordResetIndicatorProps> = ({ hasPendingReset, onClick }) => {
    if (!hasPendingReset) return null;

    return (
        <button
            onClick={onClick}
            className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 hover:bg-yellow-200 border border-yellow-300 rounded-md transition-colors"
            title="Password reset requested - Click to reset"
        >
            <Key size={16} className="text-yellow-700" />
            <span className="text-xs font-medium text-yellow-700">Reset Pending</span>
        </button>
    );
};

export default PasswordResetIndicator;
