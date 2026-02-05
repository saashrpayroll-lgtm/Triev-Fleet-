import React, { useState } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { Eye, EyeOff, LogIn, Sparkles, Mail, Lock } from 'lucide-react';
import { supabase } from '@/config/supabase';
import ForgotPasswordModal from '@/components/ForgotPasswordModal';
import ForcePasswordChangeModal from '@/components/ForcePasswordChangeModal';
import AnimatedBackground from '@/components/auth/AnimatedBackground';

const LoginPage: React.FC = () => {
    const [loginInput, setLoginInput] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [showForcePasswordChange, setShowForcePasswordChange] = useState(false);
    const [loggedInUserId, setLoggedInUserId] = useState<string | null>(null);
    const [rememberMe, setRememberMe] = useState(false);

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
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-orange-50 to-red-50 relative overflow-hidden">
            {/* Background Decor */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute -top-20 -left-20 w-96 h-96 bg-orange-300/20 rounded-full blur-3xl animate-blob"></div>
                <div className="absolute top-1/2 right-0 w-80 h-80 bg-amber-300/20 rounded-full blur-3xl animate-blob animation-delay-2000"></div>
                <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-red-300/20 rounded-full blur-3xl animate-blob animation-delay-4000"></div>
            </div>

            <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700 relative z-10">
                {/* Logo and Title */}
                <div className="text-center mb-8 flex flex-col items-center">
                    <div className="w-40 h-40 bg-white rounded-full shadow-xl flex items-center justify-center mb-6 p-4 ring-4 ring-white/50 relative overflow-hidden">
                        <img
                            src="/triev_logo.png"
                            alt="Triev Logo"
                            className="w-full h-full object-contain"
                        />
                    </div>
                    {/* Hiding text title as requested logo should be prominent, but keeping accessible text */}
                    <h1 className="sr-only">Triev Rider Pro</h1>
                    <p className="text-gray-600 text-lg font-medium">Welcome back! Please sign in to continue</p>
                </div>

                {/* Login Card */}
                <div className="bg-white rounded-3xl p-8 shadow-2xl border border-orange-100">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300 flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-red-500 fill-red-500" />
                                {error}
                            </div>
                        )}

                        {/* Email/Mobile/Username Input */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                <Mail className="w-4 h-4 text-orange-500" />
                                Email, Mobile or Username
                            </label>
                            <input
                                type="text"
                                value={loginInput}
                                onChange={(e) => setLoginInput(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all duration-300 font-medium"
                                placeholder="Enter your email, mobile or username"
                                required
                            />
                        </div>

                        {/* Password Input */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                <Lock className="w-4 h-4 text-orange-500" />
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all duration-300 font-medium pr-12"
                                    placeholder="Enter your password"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-orange-600 transition-colors p-1"
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        {/* Remember Me & Forgot Password */}
                        <div className="flex items-center justify-between text-sm">
                            <label className="flex items-center gap-2 text-gray-600 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                                />
                                <span className="group-hover:text-gray-900 transition-colors font-medium">Remember me</span>
                            </label>
                            <button
                                type="button"
                                onClick={() => setShowForgotPassword(true)}
                                className="text-orange-600 hover:text-orange-700 transition-colors font-bold hover:underline"
                            >
                                Forgot Password?
                            </button>
                        </div>

                        {/* Login Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold py-3.5 px-6 rounded-xl hover:from-orange-600 hover:to-red-600 focus:outline-none focus:ring-4 focus:ring-orange-500/20 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-orange-500/30 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                        >
                            {loading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Signing in...</span>
                                </>
                            ) : (
                                <>
                                    <LogIn size={20} />
                                    <span>Sign In</span>
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Footer */}
                <p className="text-center text-sm text-gray-500 mt-6 font-medium">
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
