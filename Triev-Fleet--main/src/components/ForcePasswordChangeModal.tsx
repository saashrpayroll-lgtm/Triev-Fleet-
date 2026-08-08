import React, { useState } from 'react';
import { Lock, Eye, EyeOff, AlertTriangle, CheckCircle2, ShieldCheck, KeyRound } from 'lucide-react';
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

    // Only allow digits
    const handlePasswordInput = (value: string, setter: (v: string) => void) => {
        const digitsOnly = value.replace(/\D/g, '');
        setter(digitsOnly);
    };

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

        if (newPassword === '123456') {
            setErrors(['New password cannot be the default "123456". Please choose a different password.']);
            return;
        }

        setLoading(true);

        try {
            // First, ensure the auth session is active
            const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
            
            if (sessionError || !sessionData.session) {
                const { error: refreshError } = await supabase.auth.refreshSession();
                if (refreshError) {
                    setErrors([
                        'Your session has expired. Please close this dialog, sign out, and log in again.',
                        `Technical: ${refreshError.message}`
                    ]);
                    setLoading(false);
                    return;
                }
            }

            // Update password in Supabase Auth
            const { error: authError } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (authError) {
                console.error('Error updating password:', authError);
                setErrors([`Password update failed: ${authError.message}`]);
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

            // Log activity (non-blocking)
            supabase.from('activity_logs').insert({
                user_id: userId,
                action_type: 'password_changed',
                target_type: 'user',
                target_id: userId,
                details: 'User changed password after forced reset',
                timestamp: new Date().toISOString()
            }).then(({ error }) => {
                if (error) console.warn('Activity log failed (non-critical):', error);
            });

            toast.success('Password changed successfully!');
            onPasswordChanged();

        } catch (err: any) {
            console.error('Error:', err);
            setErrors([`An unexpected error occurred: ${err?.message || 'Please try again.'}`]);
        } finally {
            setLoading(false);
        }
    };

    const isLengthValid = newPassword.length >= 6;
    const isNumericOnly = newPassword.length > 0 && /^\d+$/.test(newPassword);
    const isNotDefault = newPassword.length > 0 && newPassword !== '123456';
    const passwordsMatch = newPassword === confirmPassword && newPassword.length > 0;

    // Password strength indicator
    const getStrength = () => {
        if (newPassword.length === 0) return { label: '', color: '', width: '0%' };
        if (newPassword.length < 6) return { label: 'Too Short', color: 'bg-rose-500', width: '20%' };
        if (newPassword === '123456') return { label: 'Default (Not Allowed)', color: 'bg-rose-500', width: '30%' };
        if (newPassword.length < 8) return { label: 'Fair', color: 'bg-amber-500', width: '50%' };
        if (newPassword.length < 10) return { label: 'Good', color: 'bg-emerald-500', width: '75%' };
        return { label: 'Strong', color: 'bg-emerald-600', width: '100%' };
    };

    const strength = getStrength();

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-background rounded-2xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-300 overflow-hidden">
                {/* ── Premium Header ── */}
                <div className="relative overflow-hidden bg-gradient-to-br from-amber-600 via-orange-500 to-rose-500 p-6 text-white">
                    <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-white/10 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/4 pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-[150px] h-[150px] bg-rose-300/20 rounded-full blur-[40px] translate-y-1/3 -translate-x-1/4 pointer-events-none" />
                    <div className="relative z-10">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-white/15 rounded-xl backdrop-blur-sm border border-white/20">
                                <KeyRound size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-black">Password Change Required</h2>
                                <p className="text-amber-100 text-sm mt-0.5">Set a new secure password to continue</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Content ── */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="p-3.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 rounded-xl">
                        <p className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed">
                            <strong className="text-amber-700 dark:text-amber-300">🔒 Security Alert:</strong> You are using a default password.
                            Create a new <strong>numeric password (minimum 6 digits)</strong> to secure your account.
                        </p>
                    </div>

                    {/* New Password */}
                    <div>
                        <label className="block text-sm font-bold mb-2 text-foreground">
                            New Password (Numeric)
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                            <input
                                type={showNewPassword ? 'text' : 'password'}
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={newPassword}
                                onChange={(e) => handlePasswordInput(e.target.value, setNewPassword)}
                                placeholder="Enter 6+ digit password"
                                className="w-full pl-11 pr-11 py-3 border border-border bg-background text-foreground rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all text-lg tracking-widest font-mono"
                                required
                                disabled={loading}
                                autoComplete="new-password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                        {/* Strength bar */}
                        {newPassword.length > 0 && (
                            <div className="mt-2">
                                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full transition-all duration-300 ${strength.color}`} style={{ width: strength.width }} />
                                </div>
                                <p className={`text-[10px] font-bold mt-1 ${strength.color.replace('bg-', 'text-')}`}>{strength.label}</p>
                            </div>
                        )}
                    </div>

                    {/* Confirm Password */}
                    <div>
                        <label className="block text-sm font-bold mb-2 text-foreground">
                            Confirm Password
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                            <input
                                type={showConfirmPassword ? 'text' : 'password'}
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={confirmPassword}
                                onChange={(e) => handlePasswordInput(e.target.value, setConfirmPassword)}
                                placeholder="Re-enter password"
                                className="w-full pl-11 pr-11 py-3 border border-border bg-background text-foreground rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all text-lg tracking-widest font-mono"
                                required
                                disabled={loading}
                                autoComplete="new-password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    {/* Password Requirements */}
                    <div className="p-3.5 bg-muted/50 rounded-xl border border-border/50">
                        <p className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-2.5">Password Requirements</p>
                        <ul className="space-y-2">
                            <li className="flex items-center gap-2.5 text-xs">
                                <CheckCircle2 size={15} className={`flex-shrink-0 transition-colors ${isLengthValid ? 'text-emerald-500' : 'text-muted-foreground/30'}`} />
                                <span className={isLengthValid ? 'text-foreground font-medium' : 'text-muted-foreground'}>Minimum 6 digits</span>
                            </li>
                            <li className="flex items-center gap-2.5 text-xs">
                                <CheckCircle2 size={15} className={`flex-shrink-0 transition-colors ${isNumericOnly ? 'text-emerald-500' : 'text-muted-foreground/30'}`} />
                                <span className={isNumericOnly ? 'text-foreground font-medium' : 'text-muted-foreground'}>Numbers only (0-9)</span>
                            </li>
                            <li className="flex items-center gap-2.5 text-xs">
                                <CheckCircle2 size={15} className={`flex-shrink-0 transition-colors ${isNotDefault ? 'text-emerald-500' : 'text-muted-foreground/30'}`} />
                                <span className={isNotDefault ? 'text-foreground font-medium' : 'text-muted-foreground'}>Not the default "123456"</span>
                            </li>
                            <li className="flex items-center gap-2.5 text-xs">
                                <CheckCircle2 size={15} className={`flex-shrink-0 transition-colors ${passwordsMatch ? 'text-emerald-500' : 'text-muted-foreground/30'}`} />
                                <span className={passwordsMatch ? 'text-foreground font-medium' : 'text-muted-foreground'}>Passwords match</span>
                            </li>
                        </ul>
                    </div>

                    {/* Errors */}
                    {errors.length > 0 && (
                        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/30 rounded-xl">
                            {errors.map((error, index) => (
                                <p key={index} className="text-sm text-rose-600 dark:text-rose-400 flex items-start gap-2">
                                    <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                                    {error}
                                </p>
                            ))}
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        className="w-full px-4 py-3.5 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl hover:from-amber-700 hover:to-orange-700 transition-all font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
                        disabled={loading || !isLengthValid || !isNumericOnly || !passwordsMatch || !isNotDefault}
                    >
                        {loading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Changing Password...
                            </>
                        ) : (
                            <>
                                <ShieldCheck size={18} />
                                Set New Password
                            </>
                        )}
                    </button>

                    <p className="text-[10px] text-center text-muted-foreground font-medium">
                        🔒 This dialog cannot be closed until you change your password
                    </p>
                </form>
            </div>
        </div>
    );
};

export default ForcePasswordChangeModal;
