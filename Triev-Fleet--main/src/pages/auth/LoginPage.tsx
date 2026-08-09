import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { Eye, EyeOff, LogIn, Mail, Lock, AlertTriangle, CheckCircle, Zap, Shield, Users, BarChart3, Headphones } from 'lucide-react';
import { supabase } from '@/config/supabase';
import ForgotPasswordModal from '@/components/ForgotPasswordModal';
import ForcePasswordChangeModal from '@/components/ForcePasswordChangeModal';
import AnimatedBackground from '@/components/auth/AnimatedBackground';
import { toast } from 'sonner';

const ROLE_CHIPS = [
    { key: 'admin', label: 'Admin', icon: Shield, color: 'from-red-500 to-rose-600', shadow: 'shadow-red-500/30', bgVariant: 'admin' as const },
    { key: 'cityOps', label: 'City Ops', icon: BarChart3, color: 'from-blue-500 to-indigo-600', shadow: 'shadow-blue-500/30', bgVariant: 'login' as const },
    { key: 'reportingManager', label: 'RM', icon: Headphones, color: 'from-emerald-500 to-teal-600', shadow: 'shadow-emerald-500/30', bgVariant: 'rm' as const },
    { key: 'teamLeader', label: 'Team Leader', icon: Users, color: 'from-amber-500 to-orange-600', shadow: 'shadow-amber-500/30', bgVariant: 'login' as const },
];

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
    const [focusedField, setFocusedField] = useState<string | null>(null);
    const [activeRoleHint, setActiveRoleHint] = useState<number>(0);

    // Auto-cycle role hint chips
    useEffect(() => {
        const interval = setInterval(() => {
            setActiveRoleHint(prev => (prev + 1) % ROLE_CHIPS.length);
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    const activeVariant = ROLE_CHIPS[activeRoleHint]?.bgVariant || 'login';

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

            if (rememberMe) {
                localStorage.setItem('stayActive', 'true');
            } else {
                localStorage.removeItem('stayActive');
            }

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
                    setLoading(false);
                    return;
                }
            }

            toast.success('Login successful! Redirecting...');
        } catch (err: any) {
            setError(err.message || 'Failed to login. Please check your credentials.');
            toast.error(err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 28, filter: 'blur(6px)' },
        visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const } },
    };

    return (
        <div className="min-h-[100dvh] relative flex items-center justify-center p-4 sm:p-6 selection:bg-orange-500/30">
            <AnimatedBackground variant={activeVariant} />

            <motion.div
                className="w-full max-w-[420px] relative"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                {/* v2.0 Badge */}
                <motion.div
                    variants={itemVariants}
                    className="flex justify-center mb-4"
                >
                    <motion.div
                        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.06] backdrop-blur-xl border border-white/[0.08] shadow-lg"
                        whileHover={{ scale: 1.05, borderColor: 'rgba(249,115,22,0.3)' }}
                    >
                        <motion.div
                            className="w-2 h-2 rounded-full bg-gradient-to-r from-orange-500 to-fuchsia-500"
                            animate={{ scale: [1, 1.4, 1], opacity: [0.7, 1, 0.7] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] bg-gradient-to-r from-orange-300 to-fuchsia-300 bg-clip-text text-transparent">
                            Version 2.0 — PWA Ready
                        </span>
                    </motion.div>
                </motion.div>

                {/* Brand Header */}
                <motion.div variants={itemVariants} className="text-center mb-6 sm:mb-8 space-y-4 sm:space-y-5">
                    {/* Logo */}
                    <div className="relative inline-block">
                        {/* Glow rings */}
                        <motion.div
                            className="absolute inset-0 rounded-[40px] bg-orange-500/30 blur-2xl"
                            animate={{ scale: [1, 1.25, 1], opacity: [0.3, 0.7, 0.3] }}
                            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                        />
                        <motion.div
                            className="absolute -inset-4 rounded-[48px] border border-orange-500/10"
                            animate={{ opacity: [0.1, 0.3, 0.1], scale: [0.96, 1.04, 0.96] }}
                            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                        />
                        <motion.div
                            className="relative w-24 h-24 sm:w-28 sm:h-28 bg-white/8 backdrop-blur-3xl rounded-[28px] sm:rounded-[36px] border border-white/15 shadow-2xl flex items-center justify-center p-4 sm:p-5 ring-1 ring-white/10"
                            whileHover={{ scale: 1.08, rotate: [0, -3, 3, 0] }}
                            transition={{ duration: 0.5 }}
                        >
                            <img
                                src="/triev_logo.png"
                                alt="Triev Logo"
                                className="w-full h-full object-contain drop-shadow-2xl"
                            />
                        </motion.div>
                        {/* Status dot */}
                        <motion.div
                            className="absolute top-1 -right-1 w-3 h-3 bg-green-500 rounded-full shadow-[0_0_12px_#22c55e] ring-2 ring-slate-950"
                            animate={{ scale: [1, 1.3, 1], opacity: [0.8, 1, 0.8] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <motion.h1
                            className="text-3xl sm:text-4xl font-black text-white tracking-tighter"
                            initial={{ opacity: 0, letterSpacing: '0.3em' }}
                            animate={{ opacity: 1, letterSpacing: '-0.03em', y: [0, -3, 0] }}
                            transition={{ duration: 0.8, delay: 0.3, y: { duration: 4, repeat: Infinity, ease: "easeInOut" } }}
                        >
                            TRIEV{' '}
                            <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
                                Rider's
                            </span>
                        </motion.h1>
                        <motion.p
                            className="text-orange-200/40 text-[10px] sm:text-xs font-bold uppercase tracking-[0.3em]"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5, duration: 0.6 }}
                        >
                            Fleet Management Portal
                        </motion.p>
                    </div>
                </motion.div>

                {/* Login Card */}
                <motion.div
                    variants={itemVariants}
                    className="relative"
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                >
                    {/* Card glow border */}
                    <motion.div
                        className="absolute -inset-[1px] rounded-[28px] sm:rounded-[36px] bg-gradient-to-br from-orange-500/40 via-fuchsia-500/20 to-blue-600/25 shadow-[0_0_15px_rgba(249,115,22,0.2)]"
                        animate={{ opacity: [0.5, 0.9, 0.5] }}
                        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                    />

                    <motion.div 
                        className="relative bg-slate-900/55 backdrop-blur-[40px] border border-white/[0.08] rounded-[26px] sm:rounded-[34px] p-5 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden"
                        whileHover={{ boxShadow: "0 25px 60px rgba(0,0,0,0.7)", borderColor: "rgba(255,255,255,0.12)" }}
                        transition={{ duration: 0.3 }}
                    >
                        {/* Top shimmer */}
                        <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                        {/* Inner glow */}
                        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] via-transparent to-orange-500/[0.02] pointer-events-none rounded-[34px]" />

                        <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6 relative z-10">
                            {/* Error Alert */}
                            <AnimatePresence>
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0, y: -10 }}
                                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.3 }}
                                        className="bg-red-500/10 border border-red-500/25 p-3.5 rounded-2xl"
                                    >
                                        <div className="flex items-start gap-2.5">
                                            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                            <p className="text-sm text-red-200 font-medium leading-snug">{error}</p>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="space-y-4">
                                {/* Identifier Input */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-orange-300/60 uppercase tracking-[0.2em] ml-1 flex items-center gap-1.5">
                                        <Mail size={9} className="text-orange-500/60" />
                                        Secure ID
                                    </label>
                                    <div className="relative group">
                                        <motion.div
                                            className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-500/40 transition-colors duration-300"
                                            animate={{ color: focusedField === 'id' ? '#fb923c' : 'rgba(249,115,22,0.4)' }}
                                        >
                                            <Mail size={17} />
                                        </motion.div>
                                        <input
                                            type="text"
                                            value={loginInput}
                                            onChange={(e) => setLoginInput(e.target.value)}
                                            onFocus={() => setFocusedField('id')}
                                            onBlur={() => setFocusedField(null)}
                                            className="w-full pl-12 pr-4 py-3.5 sm:py-4 bg-slate-900/60 border border-white/10 rounded-xl sm:rounded-2xl text-white placeholder-white/40 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:bg-slate-900/80 transition-all duration-300 font-medium text-sm sm:text-base shadow-inner"
                                            placeholder="Email, Mobile or Username"
                                            required
                                            autoComplete="username"
                                        />
                                        {/* Focus glow underline */}
                                        <div className="absolute bottom-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-orange-500/60 to-transparent scale-x-0 group-focus-within:scale-x-100 transition-transform duration-500" />
                                    </div>
                                </div>

                                {/* Password Input */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-orange-300/60 uppercase tracking-[0.2em] ml-1 flex items-center gap-1.5">
                                        <Lock size={9} className="text-orange-500/60" />
                                        Passkey
                                    </label>
                                    <div className="relative group">
                                        <motion.div
                                            className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-500/40 transition-colors duration-300"
                                            animate={{ color: focusedField === 'pass' ? '#fb923c' : 'rgba(249,115,22,0.4)' }}
                                        >
                                            <Lock size={17} />
                                        </motion.div>
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            onFocus={() => setFocusedField('pass')}
                                            onBlur={() => setFocusedField(null)}
                                            className="w-full pl-12 pr-12 py-3.5 sm:py-4 bg-slate-900/60 border border-white/10 rounded-xl sm:rounded-2xl text-white placeholder-white/40 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:bg-slate-900/80 transition-all duration-300 font-medium tracking-widest text-lg shadow-inner [&::-ms-reveal]:hidden [&::-webkit-credentials-auto-fill-button]:hidden"
                                            placeholder="••••••••"
                                            required
                                            autoComplete="current-password"
                                        />
                                        {/* Eye toggle */}
                                        <button
                                            type="button"
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                setShowPassword(!showPassword);
                                            }}
                                            className="absolute right-3 top-1/2 w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-orange-500/20 text-white/60 hover:text-orange-100 transition-all duration-300 border border-transparent hover:border-orange-500/30 group-hover:bg-white/10"
                                            title={showPassword ? 'Hide password' : 'Show password'}
                                            style={{ transform: 'translateY(-50%)' }}
                                        >
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                        <div className="absolute bottom-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-orange-500/60 to-transparent scale-x-0 group-focus-within:scale-x-100 transition-transform duration-500" />
                                    </div>
                                </div>
                            </div>

                            {/* Options Row */}
                            <div className="flex items-center justify-between px-0.5">
                                <label className="flex items-center gap-2 text-orange-100/50 cursor-pointer group/chk select-none">
                                    <div className="relative flex items-center justify-center">
                                        <input
                                            type="checkbox"
                                            checked={rememberMe}
                                            onChange={(e) => setRememberMe(e.target.checked)}
                                            className="peer w-4 h-4 opacity-0 absolute cursor-pointer"
                                        />
                                        <motion.div
                                            className={`w-4 h-4 rounded-md border-2 flex items-center justify-center transition-all duration-200 ${rememberMe ? 'bg-orange-600 border-orange-600 shadow-[0_0_8px_rgba(234,88,12,0.4)]' : 'border-white/20 group-hover/chk:border-white/40'}`}
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
                                className="w-full relative bg-gradient-to-r from-orange-600 to-orange-500 text-white font-black py-3.5 sm:py-4 rounded-xl sm:rounded-2xl transition-all duration-300 flex items-center justify-center gap-2.5 shadow-[0_6px_20px_rgba(234,88,12,0.4)] disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden group/btn"
                                whileHover={!loading ? { scale: 1.02, y: -2, boxShadow: "0 12px 35px rgba(234,88,12,0.6)" } : {}}
                                whileTap={!loading ? { scale: 0.98 } : {}}
                            >
                                {/* Background glow effect on button hover */}
                                <motion.div 
                                    className="absolute inset-0 bg-orange-400/20 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300 blur-xl"
                                />
                                {/* Shimmer sweep */}
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700 ease-in-out" />
                                {/* Top highlight */}
                                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

                                {loading ? (
                                    <>
                                        <motion.div
                                            className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full z-10 relative"
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                                        />
                                        <span className="tracking-[0.12em] text-sm font-black uppercase z-10 relative">Verifying...</span>
                                    </>
                                ) : (
                                    <>
                                        <LogIn size={17} className="group-hover/btn:translate-x-0.5 transition-transform z-10 relative" />
                                        <span className="tracking-[0.12em] text-sm font-black uppercase z-10 relative">Access Portal</span>
                                    </>
                                )}
                            </motion.button>
                        </form>
                    </motion.div>
                </motion.div>

                {/* Role Hint Chips — animated carousel */}
                <motion.div variants={itemVariants} className="mt-5 flex items-center justify-center gap-2 flex-wrap">
                    {ROLE_CHIPS.map((chip, idx) => {
                        const Icon = chip.icon;
                        const isActive = activeRoleHint === idx;
                        return (
                            <motion.button
                                key={chip.key}
                                type="button"
                                onClick={() => setActiveRoleHint(idx)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-wider transition-all duration-500 ${
                                    isActive
                                        ? `bg-gradient-to-r ${chip.color} text-white border-transparent shadow-lg ${chip.shadow}`
                                        : 'bg-white/[0.04] border-white/10 text-white/40 hover:text-white/60 hover:border-white/20'
                                }`}
                                animate={isActive ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                                transition={{ duration: 0.5 }}
                            >
                                <Icon size={10} />
                                {chip.label}
                            </motion.button>
                        );
                    })}
                </motion.div>

                {/* Footer */}
                <motion.div variants={itemVariants} className="mt-6 sm:mt-8 text-center space-y-2.5">
                    <p className="text-white/15 text-[10px] font-bold tracking-[0.25em] uppercase">
                        © 2026 Triev Rider Technologies
                    </p>
                    <div className="flex items-center justify-center gap-2">
                        <motion.div
                            className="w-1.5 h-1.5 rounded-full bg-green-500"
                            animate={{ opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        />
                        <span className="text-[9px] font-mono uppercase tracking-widest text-green-500/40 flex items-center gap-1">
                            <Zap size={8} /> Systems Online · v2.0
                        </span>
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
