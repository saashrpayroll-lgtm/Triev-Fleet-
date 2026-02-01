import React, { useState } from 'react';
import { Lock, Eye, EyeOff, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/config/supabase';
import { validatePassword } from '@/utils/passwordUtils';
import { toast } from 'sonner';

interface ForcePasswordChangeModalProps {
    userId: string;
    onPasswordChanged: () => void;
}

const ForcePasswordChangeModal: React.FC<ForcePasswordChangeModalProps> = ({ userId, onPasswordChanged }) => {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<string[]>([]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrors([]);

        // Validate passwords match
        if (newPassword !== confirmPassword) {
            setErrors(['Passwords do not match']);
            return;
        }

        // Validate password strength
        const validation = validatePassword(newPassword);
        if (!validation.isValid) {
            setErrors(validation.errors);
            return;
        }

        setLoading(true);

        try {
            // Update password in Supabase Auth
            const { error: authError } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (authError) {
                console.error('Error updating password:', authError);
                setErrors(['Failed to update password. Please try again.']);
                setLoading(false);
                return;
            }

            // Update user record to remove force_password_change flag
            const { error: updateError } = await supabase
                .from('users')
                .update({
                    force_password_change: false,
                    last_password_change: new Date().toISOString()
                })
                .eq('id', userId);

            if (updateError) {
                console.error('Error updating user record:', updateError);
            }

            // Log activity
            await supabase.from('activity_logs').insert({
                user_id: userId,
                action_type: 'password_changed',
                target_type: 'user',
                target_id: userId,
                details: 'User changed password after reset',
                timestamp: new Date().toISOString()
            });

            toast.success('Password changed successfully!');
            onPasswordChanged();

        } catch (err) {
            console.error('Error:', err);
            setErrors(['An unexpected error occurred. Please try again.']);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-background rounded-xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-6 border-b bg-gradient-to-r from-orange-500/10 to-red-500/10">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-orange-100 rounded-full">
                            <AlertTriangle size={24} className="text-orange-600" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold">Password Change Required</h2>
                            <p className="text-sm text-muted-foreground">You must change your password to continue</p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-900">
                            <strong>Security Notice:</strong> Your password was reset by an administrator.
                            Please create a new secure password before continuing.
                        </p>
                    </div>

                    {/* New Password */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            New Password
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                            <input
                                type={showNewPassword ? 'text' : 'password'}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Enter new password"
                                className="w-full pl-11 pr-11 py-3 border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                                required
                                disabled={loading}
                            />
                            <button
                                type="button"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>

                    {/* Confirm Password */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Confirm Password
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                            <input
                                type={showConfirmPassword ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Confirm new password"
                                className="w-full pl-11 pr-11 py-3 border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                                required
                                disabled={loading}
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>

                    {/* Password Requirements */}
                    <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs font-medium mb-2">Password Requirements:</p>
                        <ul className="text-xs text-muted-foreground space-y-1">
                            <li className="flex items-center gap-2">
                                <CheckCircle2 size={14} className={newPassword.length >= 6 ? 'text-green-600' : 'text-gray-400'} />
                                At least 6 characters
                            </li>
                            <li className="flex items-center gap-2">
                                <CheckCircle2 size={14} className={/\d/.test(newPassword) ? 'text-green-600' : 'text-gray-400'} />
                                At least one number
                            </li>
                            <li className="flex items-center gap-2">
                                <CheckCircle2 size={14} className={/[a-zA-Z]/.test(newPassword) ? 'text-green-600' : 'text-gray-400'} />
                                At least one letter
                            </li>
                            <li className="flex items-center gap-2">
                                <CheckCircle2 size={14} className={newPassword === confirmPassword && newPassword.length > 0 ? 'text-green-600' : 'text-gray-400'} />
                                Passwords match
                            </li>
                        </ul>
                    </div>

                    {/* Errors */}
                    {errors.length > 0 && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                            {errors.map((error, index) => (
                                <p key={index} className="text-sm text-red-600 flex items-start gap-2">
                                    <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                                    {error}
                                </p>
                            ))}
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={loading || !newPassword || !confirmPassword}
                    >
                        {loading ? 'Changing Password...' : 'Change Password'}
                    </button>

                    <p className="text-xs text-center text-muted-foreground">
                        This dialog cannot be closed until you change your password
                    </p>
                </form>
            </div>
        </div>
    );
};

export default ForcePasswordChangeModal;
