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
