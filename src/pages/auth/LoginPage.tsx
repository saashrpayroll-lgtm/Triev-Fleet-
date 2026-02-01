import React, { useState } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { supabase } from '@/config/supabase';
import ForgotPasswordModal from '@/components/ForgotPasswordModal';
import ForcePasswordChangeModal from '@/components/ForcePasswordChangeModal';

const LoginPage: React.FC = () => {
    const [loginInput, setLoginInput] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [showForcePasswordChange, setShowForcePasswordChange] = useState(false);
    const [loggedInUserId, setLoggedInUserId] = useState<string | null>(null);

    const { login } = useSupabaseAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            let emailToLogin = loginInput;

            // Check if input looks like an email
            const cleanedInput = loginInput.trim();
            const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanedInput);

            if (!isEmail) {
                // If not email, it could be a username or a mobile number
                const isMobile = /^\d+$/.test(cleanedInput); // Simple check for digits

                if (isMobile) {
                    // Lookup email by mobile
                    const { data, error } = await supabase
                        .rpc('get_email_by_mobile', { mobile_input: cleanedInput });

                    if (error || !data) {
                        console.error("Mobile lookup failed:", error);
                        throw new Error('Mobile number not registered or incorrect.');
                    }
                    emailToLogin = data;
                } else {
                    // Lookup email by username
                    const { data, error } = await supabase
                        .rpc('get_email_by_username', { username_input: cleanedInput });

                    if (error || !data) {
                        console.error("Username lookup failed:", error);
                        throw new Error('Username not found');
                    }
                    emailToLogin = data;
                }
            } else {
                emailToLogin = cleanedInput;
            }

            await login(emailToLogin, password);

            // Check if user needs to change password
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: userRecord } = await supabase
                    .from('users')
                    .select('id, force_password_change')
                    .eq('id', user.id)
                    .single();

                if (userRecord?.force_password_change) {
                    setLoggedInUserId(userRecord.id);
                    setShowForcePasswordChange(true);
                }
            }

            // Navigation is handled by App.tsx redirect based on auth state
        } catch (err: unknown) {
            console.error('Login error:', err);

            if (err instanceof Error) {
                setError(err.message || 'Failed to login. Please check your credentials.');
            } else {
                setError('Failed to login. Please check your credentials.');
            }
        } finally {
            setLoading(false);
        }
    };


    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
            <div className="w-full max-w-md">
                {/* Logo and Title */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent mb-2">
                        Triev Rider Pro
                    </h1>
                    <p className="text-muted-foreground">Comprehensive Rider & Team Management</p>
                </div>

                {/* Login Card */}
                <div className="bg-card border border-border rounded-lg shadow-lg p-8">
                    <h2 className="text-2xl font-semibold mb-6 text-center">Welcome Back</h2>

                    {error && (
                        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="loginInput" className="block text-sm font-medium mb-2">
                                Email, Username or Mobile
                            </label>
                            <input
                                id="loginInput"
                                type="text"
                                value={loginInput}
                                onChange={(e) => setLoginInput(e.target.value)}
                                className="w-full px-4 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                                placeholder="Enter email, username or mobile"
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background pr-10"
                                    placeholder="Enter your password"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <label className="flex items-center space-x-2 cursor-pointer">
                                {/* Remember me - Removed for now or can be reimplemented */}
                            </label>

                            <button
                                type="button"
                                onClick={() => setShowForgotPassword(true)}
                                className="text-sm text-primary hover:underline transition-all"
                            >
                                Forgot Password?
                            </button>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary text-primary-foreground py-2.5 rounded-md font-medium hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"></div>
                                    Logging in...
                                </>
                            ) : (
                                <>
                                    <LogIn size={18} />
                                    Login
                                </>
                            )}
                        </button>
                    </form>
                </div>

                <p className="text-center text-sm text-muted-foreground mt-6">
                    © 2026 Triev Rider Pro. All rights reserved.
                </p>
            </div>

            {/* Modals */}
            {showForgotPassword && (
                <ForgotPasswordModal onClose={() => setShowForgotPassword(false)} />
            )}

            {showForcePasswordChange && loggedInUserId && (
                <ForcePasswordChangeModal
                    userId={loggedInUserId}
                    onPasswordChanged={() => {
                        setShowForcePasswordChange(false);
                        window.location.reload();
                    }}
                />
            )}
        </div>
    );
};

export default LoginPage;
