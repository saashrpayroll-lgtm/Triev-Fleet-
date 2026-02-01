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
        <>
            <AnimatedBackground variant="login" />

            <div className="min-h-screen flex items-center justify-center p-4 relative z-10">
                <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {/* Logo and Title */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-xl border border-white/30 mb-4 shadow-2xl">
                            <Sparkles className="w-10 h-10 text-white" />
                        </div>
                        <h1 className="text-5xl font-bold text-white mb-2 drop-shadow-lg">
                            Triev Rider Pro
                        </h1>
                        <p className="text-white/80 text-lg">Welcome back! Please sign in to continue</p>
                    </div>

                    {/* Login Card */}
                    <div className="glass-morphism rounded-3xl p-8 shadow-2xl">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Error Message */}
                            {error && (
                                <div className="bg-red-500/10 backdrop-blur-sm border border-red-500/30 text-red-100 px-4 py-3 rounded-xl text-sm animate-in fade-in slide-in-from-top-2 duration-300">
                                    {error}
                                </div>
                            )}

                            {/* Email/Mobile/Username Input */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-white/90 flex items-center gap-2">
                                    <Mail className="w-4 h-4" />
                                    Email, Mobile or Username
                                </label>
                                <input
                                    type="text"
                                    value={loginInput}
                                    onChange={(e) => setLoginInput(e.target.value)}
                                    className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all duration-300"
                                    placeholder="Enter your email, mobile or username"
                                    required
                                />
                            </div>

                            {/* Password Input */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-white/90 flex items-center gap-2">
                                    <Lock className="w-4 h-4" />
                                    Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all duration-300 pr-12"
                                        placeholder="Enter your password"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors p-1"
                                    >
                                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                    </button>
                                </div>
                            </div>

                            {/* Remember Me & Forgot Password */}
                            <div className="flex items-center justify-between text-sm">
                                <label className="flex items-center gap-2 text-white/80 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                        className="w-4 h-4 rounded border-white/30 bg-white/10 text-white focus:ring-white/50 focus:ring-offset-0 cursor-pointer"
                                    />
                                    <span className="group-hover:text-white transition-colors">Remember me</span>
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setShowForgotPassword(true)}
                                    className="text-white/80 hover:text-white transition-colors font-medium"
                                >
                                    Forgot Password?
                                </button>
                            </div>

                            {/* Login Button */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-white text-purple-600 font-semibold py-3 px-6 rounded-xl hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-transparent transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-purple-600/30 border-t-purple-600 rounded-full animate-spin" />
                                        <span>Signing in...</span>
                                    </>
                                ) : (
                                    <>
                                        <LogIn size={20} />
                                        <span>Sign In</span>
                                    </>
                                )}
                            </button>

                            {/* Divider */}
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-white/20"></div>
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="px-4 bg-transparent text-white/60">Or continue with</span>
                                </div>
                            </div>

                            {/* Social Login Buttons */}
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    className="flex items-center justify-center gap-2 px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white hover:bg-white/20 transition-all duration-300 hover:scale-105 active:scale-95"
                                >
                                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                    </svg>
                                    <span className="font-medium">Google</span>
                                </button>
                                <button
                                    type="button"
                                    className="flex items-center justify-center gap-2 px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white hover:bg-white/20 transition-all duration-300 hover:scale-105 active:scale-95"
                                >
                                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                                        <path fill="currentColor" d="M11.4 24H0V8h11.4v16zM24 8v16h-11.4V8H24zm-1.2 1.2h-9v13.6h9V9.2zM1.2 9.2v13.6h9V9.2h-9zM22.6 0H1.4C.6 0 0 .6 0 1.4v5.2h24V1.4c0-.8-.6-1.4-1.4-1.4zM11.4 4.8H1.2V1.2h10.2v3.6zm11.4 0H12.6V1.2h10.2v3.6z" />
                                    </svg>
                                    <span className="font-medium">Microsoft</span>
                                </button>
                            </div>
                        </form>

                        {/* Sign Up Link */}
                        <div className="mt-6 text-center text-sm text-white/70">
                            Don't have an account?{' '}
                            <a href="/register" className="text-white font-semibold hover:underline">
                                Sign up now
                            </a>
                        </div>
                    </div>

                    {/* Footer */}
                    <p className="text-center text-sm text-white/50 mt-6">
                        © 2026 Triev Rider Pro. All rights reserved.
                    </p>
                </div>
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
        </>
    );
};

export default LoginPage;
