import React, { useState } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { Eye, EyeOff, LogIn, Sparkles, Mail, Lock, AlertTriangle } from 'lucide-react';
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

            const { data: resolvedEmail, error: resolutionError } = await supabase
                .rpc('resolve_login_identifier', { p_identifier: loginInput.trim() });

            if (resolutionError || !resolvedEmail) {
                const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginInput.trim());
                if (isEmail) {
                    emailToLogin = loginInput.trim();
                } else {
                    throw new Error('Account not found. Please check your credentials.');
                }
            } else {
                emailToLogin = resolvedEmail;
            }

            await login(emailToLogin, password);

            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                // Check if user is using default password "123456"
                const isDefaultPassword = password === '123456';

                const { data: userRecord } = await supabase
                    .from('users')
                    .select('id, force_password_change')
                    .eq('id', user.id)
                    .single();

                if (isDefaultPassword || userRecord?.force_password_change) {
                    // If using default password, ensure the flag is set in the database for future logins too
                    if (isDefaultPassword && !userRecord?.force_password_change) {
                        await supabase
                            .from('users')
                            .update({ force_password_change: true })
                            .eq('id', user.id);
                    }

                    setLoggedInUserId(user.id);
                    setShowForcePasswordChange(true);
                }
            }
        } catch (err: any) {
            setError(err.message || 'Failed to login. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen relative flex items-center justify-center p-6 selection:bg-orange-500/30">
            <AnimatedBackground variant="login" />

            <div className="w-full max-w-lg relative">
                {/* Brand Identity Section */}
                <div className="text-center mb-10 space-y-6 animate-in fade-in slide-in-from-top-4 duration-1000">
                    <div className="relative inline-block">
                        <div className="absolute inset-0 bg-orange-500/20 blur-[50px] rounded-full"></div>
                        <div className="w-32 h-32 bg-white/10 backdrop-blur-3xl rounded-[40px] border border-white/20 shadow-2xl flex items-center justify-center p-6 ring-1 ring-white/30 transform hover:scale-110 transition-transform duration-500">
                            <img
                                src="/triev_logo.png"
                                alt="Triev Logo"
                                className="w-full h-full object-contain drop-shadow-2xl"
                            />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">
                            TRIEV <span className="text-orange-500 not-italic">Rider's</span>
                        </h1>
                        <p className="text-green-100/40 text-xs font-semibold uppercase tracking-[0.2em]">#JoinTheEVTrive</p>
                    </div>
                </div>

                {/* Login Card */}
                <div className="bg-white/10 backdrop-blur-[40px] border border-white/20 rounded-[45px] p-10 shadow-[0_20px_50px_rgba(0,0,0,0.3)] relative overflow-hidden group animate-in slide-in-from-bottom-6 duration-700">
                    {/* Inner Shadow Decor */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>

                    <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-100 p-4 rounded-2xl text-sm font-medium flex items-center gap-3 animate-in shake duration-500">
                                <AlertTriangle className="w-5 h-5 text-red-500" />
                                {error}
                            </div>
                        )}

                        <div className="space-y-6">
                            {/* Identifier Input */}
                            <div className="space-y-3">
                                <label className="text-xs font-black text-orange-100/60 uppercase tracking-widest ml-2">Secure ID</label>
                                <div className="relative group/field">
                                    <div className="absolute left-6 top-1/2 -translate-y-1/2 text-orange-500/50 group-focus-within/field:text-orange-500 transition-colors">
                                        <Mail size={18} />
                                    </div>
                                    <input
                                        type="text"
                                        value={loginInput}
                                        onChange={(e) => setLoginInput(e.target.value)}
                                        className="w-full pl-16 pr-6 py-5 bg-black/20 border border-white/5 rounded-3xl text-white placeholder-white/20 focus:outline-none focus:border-orange-500/50 focus:ring-4 focus:ring-orange-500/5 transition-all font-medium"
                                        placeholder="Email, Mobile or Username"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Password Input */}
                            <div className="space-y-3">
                                <label className="text-xs font-black text-orange-100/60 uppercase tracking-widest ml-2">Passkey</label>
                                <div className="relative group/field">
                                    <div className="absolute left-6 top-1/2 -translate-y-1/2 text-orange-500/50 group-focus-within/field:text-orange-500 transition-colors">
                                        <Lock size={18} />
                                    </div>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full pl-16 pr-14 py-5 bg-black/20 border border-white/5 rounded-3xl text-white placeholder-white/20 focus:outline-none focus:border-orange-500/50 focus:ring-4 focus:ring-orange-500/5 transition-all font-medium"
                                        placeholder="••••••••"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-6 top-1/2 -translate-y-1/2 text-white/20 hover:text-orange-500 transition-colors p-1"
                                    >
                                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Options */}
                        <div className="flex items-center justify-between px-2">
                            <label className="flex items-center gap-3 text-orange-100/60 cursor-pointer group">
                                <div className="relative flex items-center justify-center">
                                    <input
                                        type="checkbox"
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                        className="peer w-5 h-5 opacity-0 absolute cursor-pointer"
                                    />
                                    <div className="w-5 h-5 rounded-md border-2 border-white/10 peer-checked:bg-orange-600 peer-checked:border-orange-600 transition-all flex items-center justify-center">
                                        <Sparkles className="w-3 h-3 text-white opacity-0 peer-checked:opacity-100" />
                                    </div>
                                </div>
                                <span className="text-xs font-bold uppercase tracking-wider group-hover:text-white transition-colors">Stay Active</span>
                            </label>
                            <button
                                type="button"
                                onClick={() => setShowForgotPassword(true)}
                                className="text-xs font-black text-orange-500 hover:text-orange-400 transition-all hover:tracking-widest uppercase"
                            >
                                Recover Passkey
                            </button>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-5 rounded-[22px] transition-all duration-500 flex items-center justify-center gap-3 shadow-[0_10px_30px_rgba(234,88,12,0.3)] hover:shadow-[0_15px_40px_rgba(234,88,12,0.4)] disabled:opacity-50 group/btn overflow-hidden relative"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000"></div>
                            {loading ? (
                                <>
                                    <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span className="tracking-[0.2em] font-black uppercase">Verifying...</span>
                                </>
                            ) : (
                                <>
                                    <LogIn size={20} className="group-hover/btn:translate-x-1 transition-transform" />
                                    <span className="tracking-[0.2em] font-black uppercase italic">Access Portal</span>
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Footer Section */}
                <div className="mt-10 text-center space-y-4">
                    <p className="text-white/20 text-[10px] font-bold tracking-[0.3em] uppercase">
                        © 2026 Triev Rider Technologies • Secure Node V2.5
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
        </div>
    );
};

export default LoginPage;
