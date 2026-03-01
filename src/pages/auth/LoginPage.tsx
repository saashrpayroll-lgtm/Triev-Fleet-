import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { Eye, EyeOff, LogIn, Sparkles, Mail, Lock, AlertTriangle, CheckCircle } from 'lucide-react';
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
                const isDefaultPassword = password === '123456';

                const { data: userRecord } = await supabase
                    .from('users')
                    .select('id, force_password_change')
                    .eq('id', user.id)
                    .single();

                if (isDefaultPassword || userRecord?.force_password_change) {
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

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.15, delayChildren: 0.1 } },
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 24 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
    };

    return (
        <div className="min-h-screen relative flex items-center justify-center p-4 sm:p-6 selection:bg-orange-500/30">
            <AnimatedBackground variant="login" />

            <motion.div
                className="w-full max-w-md relative"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                {/* Brand Header */}
                <motion.div variants={itemVariants} className="text-center mb-8 space-y-5">
                    {/* Logo */}
                    <div className="relative inline-block">
                        {/* Glow rings */}
                        <motion.div
                            className="absolute inset-0 rounded-[40px] bg-orange-500/30 blur-2xl"
                            animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.8, 0.4] }}
                            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                        />
                        <motion.div
                            className="relative w-28 h-28 sm:w-32 sm:h-32 bg-white/8 backdrop-blur-3xl rounded-[32px] sm:rounded-[40px] border border-white/15 shadow-2xl flex items-center justify-center p-5 sm:p-6 ring-1 ring-white/20"
                            whileHover={{ scale: 1.08, rotate: [0, -2, 2, 0] }}
                            transition={{ duration: 0.4 }}
                        >
                            <img
                                src="/triev_logo.png"
                                alt="Triev Logo"
                                className="w-full h-full object-contain drop-shadow-2xl"
                            />
                        </motion.div>
                        {/* Orbit dot */}
                        <motion.div
                            className="absolute top-2 -right-1 w-3 h-3 bg-orange-500 rounded-full shadow-[0_0_10px_#f97316]"
                            animate={{ scale: [1, 1.4, 1], opacity: [0.8, 1, 0.8] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        />
                    </div>

                    <div className="space-y-1">
                        <motion.h1
                            className="text-3xl sm:text-4xl font-black text-white tracking-tighter uppercase italic"
                            initial={{ opacity: 0, letterSpacing: '0.3em' }}
                            animate={{ opacity: 1, letterSpacing: '-0.02em' }}
                            transition={{ duration: 0.8, delay: 0.3 }}
                        >
                            TRIEV <span className="text-orange-500 not-italic">Rider's</span>
                        </motion.h1>
                        <p className="text-orange-100/40 text-[10px] sm:text-xs font-semibold uppercase tracking-[0.25em]">#JoinTheEVTrive</p>
                    </div>
                </motion.div>

                {/* Login Card */}
                <motion.div
                    variants={itemVariants}
                    className="relative"
                >
                    {/* Card glow border */}
                    <div className="absolute -inset-[1px] rounded-[36px] sm:rounded-[44px] bg-gradient-to-br from-orange-500/30 via-fuchsia-500/15 to-blue-600/20 opacity-60" />

                    <div className="relative bg-slate-900/40 backdrop-blur-[50px] border border-white/10 rounded-[34px] sm:rounded-[42px] p-6 sm:p-10 shadow-[0_25px_60px_rgba(0,0,0,0.5)] overflow-hidden">
                        {/* Subtle top shimmer line */}
                        <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                        {/* Inner gradient */}
                        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] via-transparent to-orange-500/[0.03] pointer-events-none rounded-[42px]" />

                        <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-7 relative z-10">
                            {/* Error Alert */}
                            <AnimatePresence>
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0, y: -10 }}
                                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.3 }}
                                        className="bg-red-500/10 border border-red-500/25 text-red-100 p-4 rounded-2xl text-sm font-medium flex items-center gap-3"
                                    >
                                        <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                                        <span>{error}</span>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="space-y-4 sm:space-y-5">
                                {/* Identifier Input */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-orange-300/60 uppercase tracking-[0.2em] ml-1 flex items-center gap-1.5">
                                        <Mail size={9} className="text-orange-500/60" />
                                        Secure ID
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-orange-500/40 group-focus-within:text-orange-400 transition-colors duration-300">
                                            <Mail size={17} />
                                        </div>
                                        <input
                                            type="text"
                                            value={loginInput}
                                            onChange={(e) => setLoginInput(e.target.value)}
                                            className="w-full pl-14 pr-5 py-4 sm:py-[18px] bg-black/25 border border-white/8 rounded-2xl text-white placeholder-white/18 focus:outline-none focus:border-orange-500/50 focus:ring-[3px] focus:ring-orange-500/10 transition-all duration-300 font-medium text-sm sm:text-base"
                                            placeholder="Email, Mobile or Username"
                                            required
                                        />
                                        {/* Focus underline effect */}
                                        <div className="absolute bottom-0 left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-orange-500/50 to-transparent scale-x-0 group-focus-within:scale-x-100 transition-transform duration-500" />
                                    </div>
                                </div>

                                {/* Password Input */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-orange-300/60 uppercase tracking-[0.2em] ml-1 flex items-center gap-1.5">
                                        <Lock size={9} className="text-orange-500/60" />
                                        Passkey
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-orange-500/40 group-focus-within:text-orange-400 transition-colors duration-300">
                                            <Lock size={17} />
                                        </div>
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full pl-14 pr-14 py-4 sm:py-[18px] bg-black/25 border border-white/8 rounded-2xl text-white placeholder-white/18 focus:outline-none focus:border-orange-500/50 focus:ring-[3px] focus:ring-orange-500/10 transition-all duration-300 font-medium tracking-widest"
                                            placeholder="••••••••"
                                            required
                                        />
                                        <motion.button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-5 top-1/2 -translate-y-1/2 text-white/25 hover:text-orange-400 transition-colors p-1.5"
                                            whileTap={{ scale: 0.85 }}
                                        >
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </motion.button>
                                        <div className="absolute bottom-0 left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-orange-500/50 to-transparent scale-x-0 group-focus-within:scale-x-100 transition-transform duration-500" />
                                    </div>
                                </div>
                            </div>

                            {/* Options */}
                            <div className="flex items-center justify-between px-1">
                                <label className="flex items-center gap-2.5 text-orange-100/50 cursor-pointer group/chk">
                                    <div className="relative flex items-center justify-center">
                                        <input
                                            type="checkbox"
                                            checked={rememberMe}
                                            onChange={(e) => setRememberMe(e.target.checked)}
                                            className="peer w-4 h-4 opacity-0 absolute cursor-pointer"
                                        />
                                        <motion.div
                                            className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all duration-300 ${rememberMe ? 'bg-orange-600 border-orange-600' : 'border-white/15'}`}
                                            whileTap={{ scale: 0.8 }}
                                        >
                                            {rememberMe && <CheckCircle className="w-2.5 h-2.5 text-white" />}
                                        </motion.div>
                                    </div>
                                    <span className="text-[11px] font-bold uppercase tracking-wider group-hover/chk:text-orange-200 transition-colors">Stay Active</span>
                                </label>
                                <motion.button
                                    type="button"
                                    onClick={() => setShowForgotPassword(true)}
                                    className="text-[11px] font-black text-orange-500 hover:text-orange-300 transition-colors uppercase tracking-wider"
                                    whileHover={{ x: 2 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    Recover Passkey →
                                </motion.button>
                            </div>

                            {/* Submit Button */}
                            <motion.button
                                type="submit"
                                disabled={loading}
                                className="w-full relative bg-gradient-to-r from-orange-600 to-orange-500 text-white font-black py-4 sm:py-5 rounded-2xl transition-all duration-300 flex items-center justify-center gap-3 shadow-[0_8px_25px_rgba(234,88,12,0.35)] disabled:opacity-50 overflow-hidden group/btn"
                                whileHover={!loading ? { scale: 1.02, shadow: '0 12px 35px rgba(234,88,12,0.45)' } : {}}
                                whileTap={!loading ? { scale: 0.98 } : {}}
                            >
                                {/* Shimmer sweep */}
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700" />
                                {/* Top highlight */}
                                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

                                {loading ? (
                                    <>
                                        <motion.div
                                            className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                                        />
                                        <span className="tracking-[0.15em] text-sm font-black uppercase">Verifying...</span>
                                    </>
                                ) : (
                                    <>
                                        <LogIn size={18} className="group-hover/btn:translate-x-0.5 transition-transform" />
                                        <span className="tracking-[0.15em] text-sm font-black uppercase italic">Access Portal</span>
                                    </>
                                )}
                            </motion.button>
                        </form>
                    </div>
                </motion.div>

                {/* Footer */}
                <motion.div variants={itemVariants} className="mt-8 text-center space-y-2">
                    <p className="text-white/15 text-[10px] font-bold tracking-[0.3em] uppercase">
                        © 2026 Triev Rider Technologies • Secure Node V2.5
                    </p>
                    <div className="flex items-center justify-center gap-2 text-white/10">
                        <motion.div
                            className="w-1.5 h-1.5 rounded-full bg-green-500"
                            animate={{ opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        />
                        <span className="text-[9px] font-mono uppercase tracking-widest text-green-500/30">Systems Online</span>
                    </div>
                </motion.div>
            </motion.div>

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
