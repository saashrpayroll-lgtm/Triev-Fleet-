import React, { useState } from 'react';
import { UserX } from 'lucide-react';
import { User } from '@/types';

interface SuspendUserModalProps {
    user: User;
    onClose: () => void;
    onSuspend: (durationMinutes: number) => Promise<void>;
}

const SuspendUserModal: React.FC<SuspendUserModalProps> = ({ user, onClose, onSuspend }) => {
    const [selectedDuration, setSelectedDuration] = useState<number>(60); // Default 1 hour
    const [loading, setLoading] = useState(false);

    const handleConfirm = async () => {
        setLoading(true);
        try {
            await onSuspend(selectedDuration);
            // Force close on success
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const durations = [
        { label: '30 Minutes', value: 30 },
        { label: '1 Hour', value: 60 },
        { label: '3 Hours', value: 180 },
        { label: '1 Day', value: 1440 },
        { label: '3 Days', value: 4320 },
        { label: '7 Days', value: 10080 },
        { label: 'Permanent', value: -1 },
    ];

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-card border border-border rounded-lg shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                        <UserX size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">Suspend User</h2>
                        <p className="text-sm text-muted-foreground">Action required for <strong>{user.fullName}</strong></p>
                    </div>
                </div>

                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium mb-2">Select Suspension Duration</label>
                        <div className="relative">
                            <select
                                value={selectedDuration}
                                onChange={(e) => setSelectedDuration(Number(e.target.value))}
                                className="w-full px-4 py-3 border border-input rounded-lg appearance-none bg-background focus:ring-2 focus:ring-primary focus:border-primary transition-all cursor-pointer"
                            >
                                {durations.map(opt => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                            The user will be automatically reactivated after this duration. Permanent suspension requires manual reactivation.
                        </p>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                            onClick={onClose}
                            disabled={loading}
                            className="px-4 py-2.5 border border-input rounded-lg hover:bg-accent transition-colors text-sm font-medium disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={loading}
                            className="px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all shadow-md hover:shadow-red-600/20 text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    Suspending...
                                </>
                            ) : (
                                <>
                                    <UserX size={18} />
                                    Confirm Suspension
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SuspendUserModal;
