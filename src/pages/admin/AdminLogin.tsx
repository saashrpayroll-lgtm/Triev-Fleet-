import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/config/supabase';
import { Eye, EyeOff, ShieldCheck, Lock, AlertTriangle, User } from 'lucide-react';
import AnimatedBackground from '@/components/auth/AnimatedBackground';
import { toast } from 'sonner';
import ForcePasswordChangeModal from '@/components/ForcePasswordChangeModal';

const AdminLogin: React.FC = () => {
    const [loginInput, setLoginInput] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showForcePasswordChange, setShowForcePasswordChange] = useState(false);
    const [loggedInUserId, setLoggedInUserId] = useState<string | null>(null);

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
                    throw new Error("Account not found. Please check your credentials.");
                }
            } else {
                emailToLogin = resolvedEmail;
            }

            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: emailToLogin,
                password
            });

            if (authError) throw authError;
            if (!authData.user) throw new Error("Authentication failed.");

            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('id, role, force_password_change')
                .eq('id', authData.user.id)
                .single();

            if (userError || !userData || userData.role !== 'admin') {
                await supabase.auth.signOut();
                throw new Error("ACCESS DENIED: Administrative privileges required.");
            }

            // Check for default password or manual force flag
            const isDefaultPassword = password === '123456';
            if (isDefaultPassword || userData.force_password_change) {
                if (isDefaultPassword && !userData.force_password_change) {
                    await supabase.from('users').update({ force_password_change: true }).eq('id', userData.id);
                }
                setLoggedInUserId(userData.id);
                setShowForcePasswordChange(true);
                setLoading(false);
                return;
            }

            toast.success("Security Clearance Verified.");
            window.location.href = '/portal';

        } catch (err: any) {
            setError(err.message || 'Authentication failed');
            if (err.message && err.message.includes("DENIED")) {
                await supabase.auth.signOut();
            }
        } finally {
            setLoading(false);
        }
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } },
    };

    return (
        <div className="min-h-screen relative flex items-center justify-center p-4 sm:p-6 selection:bg-red-500/30">
            <AnimatedBackground variant="admin" />

            <motion.div
                className="w-full max-w-md relative"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                {/* Header */}
                <motion.div variants={itemVariants} className="text-center mb-8 space-y-5">
                    {/* Shield Icon */}
                    <div className="relative inline-block">
                        {/* Pulsing glow rings */}
                        <motion.div
                            className="absolute inset-0 rounded-3xl bg-red-600/40 blur-2xl"
                            animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.7, 0.3] }}
                            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                        />
                        <motion.div
                            className="absolute -inset-3 rounded-[36px] border border-red-500/20"
                            animate={{ opacity: [0.2, 0.5, 0.2], scale: [0.95, 1.05, 0.95] }}
                            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                        />
                        <motion.div
                            className="relative inline-flex p-5 rounded-3xl bg-slate-900/70 backdrop-blur-2xl border border-red-500/25 shadow-[0_0_40px_rgba(239,68,68,0.2)]"
                            whileHover={{ scale: 1.1, rotate: [0, -5, 5, 0] }}
                            transition={{ duration: 0.5 }}
                        >
                            <ShieldCheck className="w-10 h-10 sm:w-12 sm:h-12 text-red-500" />
                        </motion.div>
                    </div>

                    <div className="space-y-1.5">
                        <motion.h1
                            className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tighter"
                            initial={{ opacity: 0, letterSpacing: '0.2em' }}
                            animate={{ opacity: 1, letterSpacing: '-0.03em' }}
                            transition={{ duration: 0.8, delay: 0.3 }}
                        >
                            COMMAND{' '}
                            <span className="text-red-600 bg-red-600/10 px-2 rounded-lg inline-block">CENTER</span>
                        </motion.h1>
                        <p className="text-red-400/50 font-mono text-[10px] uppercase tracking-[0.3em]">
                            Authorized Personnel Only • Tier 1 Access
                        </p>
                    </div>
                </motion.div>

                {/* Login Card */}
                <motion.div variants={itemVariants} className="relative">
                    {/* Glowing border */}
                    <div className="absolute -inset-[1px] rounded-[36px] sm:rounded-[44px] bg-gradient-to-br from-red-600/25 via-red-900/10 to-transparent opacity-70" />

                    <div className="relative bg-slate-900/50 backdrop-blur-[50px] border border-white/8 rounded-[34px] sm:rounded-[42px] p-6 sm:p-10 shadow-[0_25px_60px_rgba(0,0,0,0.6)] overflow-hidden">
                        {/* Top shimmer line */}
                        <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-red-500/40 to-transparent" />
                        {/* Inner gradient */}
                        <div className="absolute inset-0 bg-gradient-to-br from-red-600/[0.04] via-transparent to-transparent pointer-events-none" />
                        {/* Scan line effect */}
                        <motion.div
                            className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-500/20 to-transparent"
                            animate={{ top: ['0%', '100%'] }}
                            transition={{ duration: 5, repeat: Infinity, ease: 'linear', repeatDelay: 3 }}
                        />

                        <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-7 relative z-10">
                            {/* Error Alert */}
                            <AnimatePresence>
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0, y: -10 }}
                                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.3 }}
                                        className="bg-red-950/50 border-l-4 border-red-600 p-4 rounded-2xl"
                                    >
                                        <div className="flex gap-3">
                                            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                                            <p className="text-sm text-red-200 font-medium">{error}</p>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="space-y-4 sm:space-y-5">
                                {/* Identifier Input */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-red-500/70 uppercase tracking-[0.2em] ml-1 flex items-center gap-1.5">
                                        <User size={9} className="text-red-500/60" />
                                        Terminal Identity
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-red-500/35 group-focus-within:text-red-400 transition-colors duration-300">
                                            <User size={17} />
                                        </div>
                                        <input
                                            type="text"
                                            value={loginInput}
                                            onChange={(e) => setLoginInput(e.target.value)}
                                            className="w-full pl-14 pr-5 py-4 sm:py-[18px] bg-black/35 border border-white/6 rounded-2xl text-white placeholder-white/12 focus:outline-none focus:border-red-500/50 focus:ring-[3px] focus:ring-red-500/8 transition-all duration-300 font-mono text-sm"
                                            placeholder="Enter Credentials"
                                            required
                                        />
                                        <div className="absolute bottom-0 left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-red-500/50 to-transparent scale-x-0 group-focus-within:scale-x-100 transition-transform duration-500" />
                                    </div>
                                </div>

                                {/* Password Input */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-red-500/70 uppercase tracking-[0.2em] ml-1 flex items-center gap-1.5">
                                        <Lock size={9} className="text-red-500/60" />
                                        Access Key
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-red-500/35 group-focus-within:text-red-400 transition-colors duration-300">
                                            <Lock size={17} />
                                        </div>
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full pl-14 pr-14 py-4 sm:py-[18px] bg-black/35 border border-white/6 rounded-2xl text-white placeholder-white/12 focus:outline-none focus:border-red-500/50 focus:ring-[3px] focus:ring-red-500/8 transition-all duration-300 font-mono text-lg tracking-widest"
                                            placeholder="••••••••"
                                            required
                                        />
                                        <motion.button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-5 top-1/2 -translate-y-1/2 text-white/20 hover:text-red-400 transition-colors p-1.5"
                                            whileTap={{ scale: 0.85 }}
                                        >
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </motion.button>
                                        <div className="absolute bottom-0 left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-red-500/50 to-transparent scale-x-0 group-focus-within:scale-x-100 transition-transform duration-500" />
                                    </div>
                                </div>
                            </div>

                            {/* Submit Button */}
                            <motion.button
                                type="submit"
                                disabled={loading}
                                className="w-full relative bg-gradient-to-r from-red-700 to-red-600 text-white font-black py-4 sm:py-5 rounded-2xl transition-all duration-300 flex items-center justify-center gap-3 shadow-[0_8px_25px_rgba(220,38,38,0.35)] disabled:opacity-50 overflow-hidden group/btn"
                                whileHover={!loading ? { scale: 1.02 } : {}}
                                whileTap={!loading ? { scale: 0.98 } : {}}
                            >
                                {/* Shimmer sweep */}
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700" />
                                {/* Top highlight */}
                                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

                                {loading ? (
                                    <>
                                        <motion.div
                                            className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                                        />
                                        <span className="tracking-[0.2em] text-sm font-black uppercase italic">Encrypting...</span>
                                    </>
                                ) : (
                                    <>
                                        <Lock size={16} className="group-hover/btn:scale-110 transition-transform" />
                                        <span className="tracking-[0.15em] text-sm font-black uppercase">Initialize Access</span>
                                    </>
                                )}
                            </motion.button>
                        </form>
                    </div>
                </motion.div>

                {/* Footer */}
                <motion.div variants={itemVariants} className="mt-8 text-center space-y-2">
                    <p className="text-red-500/30 text-[10px] font-mono tracking-[0.25em] flex items-center justify-center gap-2">
                        <motion.span
                            className="w-1.5 h-1.5 bg-red-500 rounded-full inline-block"
                            animate={{ opacity: [0.4, 1, 0.4] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                        />
                        Protocol Activated: Enhanced Logging Enabled
                    </p>
                </motion.div>
            </motion.div>

            {showForcePasswordChange && loggedInUserId && (
                <ForcePasswordChangeModal
                    userId={loggedInUserId}
                    onPasswordChanged={() => {
                        setShowForcePasswordChange(false);
                        window.location.href = '/portal';
                    }}
                />
            )}
        </div>
    );
};

export default AdminLogin;
