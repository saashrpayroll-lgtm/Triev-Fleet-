import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/config/supabase';
import { Eye, EyeOff, ShieldCheck, Lock, AlertTriangle, User, Fingerprint } from 'lucide-react';
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
    const [focusedField, setFocusedField] = useState<string | null>(null);

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

            toast.success("Security Clearance Verified. Welcome back.");
            window.location.href = '/portal';

        } catch (err: any) {
            setError(err.message || 'Authentication failed');
            toast.error(err.message || 'Authentication failed');
            if (err.message && err.message.includes("DENIED")) {
                await supabase.auth.signOut();
            }
        } finally {
            setLoading(false);
        }
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.08 } },
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 24, filter: 'blur(6px)' },
        visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const } },
    };

    return (
        <div className="min-h-screen min-h-[100dvh] relative flex items-center justify-center p-4 sm:p-6 selection:bg-red-500/30">
            <AnimatedBackground variant="admin" />

            <motion.div
                className="w-full max-w-[420px] relative"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                {/* Header */}
                <motion.div variants={itemVariants} className="text-center mb-6 sm:mb-8 space-y-4 sm:space-y-5">
                    {/* Shield Icon */}
                    <div className="relative inline-block">
                        {/* Pulsing glow */}
                        <motion.div
                            className="absolute inset-0 rounded-3xl bg-red-600/40 blur-2xl"
                            animate={{ scale: [1, 1.3, 1], opacity: [0.25, 0.6, 0.25] }}
                            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                        />
                        {/* Outer ring */}
                        <motion.div
                            className="absolute -inset-4 rounded-[40px] border border-red-500/15"
                            animate={{ opacity: [0.15, 0.4, 0.15], scale: [0.95, 1.05, 0.95] }}
                            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                        />
                        <motion.div
                            className="relative inline-flex p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-slate-900/70 backdrop-blur-2xl border border-red-500/25 shadow-[0_0_40px_rgba(239,68,68,0.2)]"
                            whileHover={{ scale: 1.1, rotate: [0, -5, 5, 0] }}
                            transition={{ duration: 0.5 }}
                        >
                            <ShieldCheck className="w-9 h-9 sm:w-11 sm:h-11 text-red-500" />
                        </motion.div>
                    </div>

                    <div className="space-y-1.5">
                        <motion.h1
                            className="text-2xl sm:text-4xl font-black text-white tracking-tighter"
                            initial={{ opacity: 0, letterSpacing: '0.2em' }}
                            animate={{ opacity: 1, letterSpacing: '-0.03em', y: [0, -3, 0] }}
                            transition={{ duration: 0.8, delay: 0.3, y: { duration: 4, repeat: Infinity, ease: "easeInOut" } }}
                        >
                            COMMAND{' '}
                            <span className="bg-gradient-to-r from-red-500 to-red-700 bg-clip-text text-transparent px-1 relative">
                                CENTER
                                <motion.span 
                                    className="absolute -inset-1 bg-red-500/20 blur-xl rounded-full"
                                    animate={{ opacity: [0.5, 0.8, 0.5] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                />
                            </span>
                        </motion.h1>
                        <motion.p
                            className="text-red-400/40 font-mono text-[9px] sm:text-[10px] uppercase tracking-[0.25em]"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5, duration: 0.6 }}
                        >
                            Authorized Personnel Only • Tier 1 Access
                        </motion.p>
                    </div>
                </motion.div>

                {/* Login Card */}
                <motion.div
                    variants={itemVariants}
                    className="relative"
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                >
                    {/* Glowing border */}
                    <motion.div
                        className="absolute -inset-[1px] rounded-[28px] sm:rounded-[36px] bg-gradient-to-br from-red-600/35 via-red-900/15 to-transparent shadow-[0_0_15px_rgba(220,38,38,0.2)]"
                        animate={{ opacity: [0.5, 0.9, 0.5] }}
                        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                    />

                    <motion.div 
                        className="relative bg-slate-900/60 backdrop-blur-[40px] border border-white/[0.08] rounded-[26px] sm:rounded-[34px] p-5 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden"
                        whileHover={{ boxShadow: "0 25px 60px rgba(0,0,0,0.8)", borderColor: "rgba(255,255,255,0.12)" }}
                        transition={{ duration: 0.3 }}
                    >
                        {/* Top shimmer */}
                        <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
                        {/* Inner gradient */}
                        <div className="absolute inset-0 bg-gradient-to-br from-red-600/[0.04] via-transparent to-transparent pointer-events-none" />
                        {/* Scan line */}
                        <motion.div
                            className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-500/20 to-transparent"
                            animate={{ top: ['0%', '100%'] }}
                            transition={{ duration: 6, repeat: Infinity, ease: 'linear', repeatDelay: 3 }}
                        />

                        <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6 relative z-10">
                            {/* Error Alert */}
                            <AnimatePresence>
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0, y: -10 }}
                                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.3 }}
                                        className="bg-red-950/50 border-l-4 border-red-600 p-3.5 rounded-xl sm:rounded-2xl"
                                    >
                                        <div className="flex items-start gap-2.5">
                                            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                                            <p className="text-sm text-red-200 font-medium leading-snug">{error}</p>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="space-y-4">
                                {/* Identifier Input */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-red-500/60 uppercase tracking-[0.2em] ml-1 flex items-center gap-1.5">
                                        <User size={9} className="text-red-500/50" />
                                        Terminal Identity
                                    </label>
                                    <div className="relative group">
                                        <motion.div
                                            className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-300"
                                            animate={{ color: focusedField === 'id' ? '#f87171' : 'rgba(239,68,68,0.35)' }}
                                        >
                                            <User size={17} />
                                        </motion.div>
                                        <input
                                            type="text"
                                            value={loginInput}
                                            onChange={(e) => setLoginInput(e.target.value)}
                                            onFocus={() => setFocusedField('id')}
                                            onBlur={() => setFocusedField(null)}
                                            className="w-full pl-12 pr-4 py-3.5 sm:py-4 bg-slate-900/60 border border-white/10 rounded-xl sm:rounded-2xl text-white placeholder-white/40 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:bg-slate-900/80 transition-all duration-300 font-mono text-sm sm:text-base shadow-inner"
                                            placeholder="Enter Credentials"
                                            required
                                            autoComplete="username"
                                        />
                                        <div className="absolute bottom-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-red-500/60 to-transparent scale-x-0 group-focus-within:scale-x-100 transition-transform duration-500" />
                                    </div>
                                </div>

                                {/* Password Input */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-red-500/60 uppercase tracking-[0.2em] ml-1 flex items-center gap-1.5">
                                        <Lock size={9} className="text-red-500/50" />
                                        Access Key
                                    </label>
                                    <div className="relative group">
                                        <motion.div
                                            className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-300"
                                            animate={{ color: focusedField === 'pass' ? '#f87171' : 'rgba(239,68,68,0.35)' }}
                                        >
                                            <Lock size={17} />
                                        </motion.div>
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            onFocus={() => setFocusedField('pass')}
                                            onBlur={() => setFocusedField(null)}
                                            className="w-full pl-12 pr-14 py-3.5 sm:py-4 bg-slate-900/60 border border-white/10 rounded-xl sm:rounded-2xl text-white placeholder-white/40 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:bg-slate-900/80 transition-all duration-300 font-mono tracking-widest text-lg shadow-inner [&::-ms-reveal]:hidden [&::-webkit-credentials-auto-fill-button]:hidden"
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
                                            className="absolute right-3 top-1/2 w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-red-500/20 text-white/60 hover:text-red-100 transition-all duration-300 border border-transparent hover:border-red-500/30 group-hover:bg-white/10"
                                            title={showPassword ? 'Hide password' : 'Show password'}
                                            style={{ transform: 'translateY(-50%)' }}
                                        >
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                        <div className="absolute bottom-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-red-500/60 to-transparent scale-x-0 group-focus-within:scale-x-100 transition-transform duration-500" />
                                    </div>
                                </div>
                            </div>

                            {/* Submit Button */}
                            <motion.button
                                type="submit"
                                disabled={loading}
                                className="w-full relative bg-gradient-to-r from-red-700 to-red-600 text-white font-black py-3.5 sm:py-4 rounded-xl sm:rounded-2xl transition-all duration-300 flex items-center justify-center gap-2.5 shadow-[0_6px_20px_rgba(220,38,38,0.4)] disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden group/btn"
                                whileHover={!loading ? { scale: 1.02, y: -2, boxShadow: "0 12px 35px rgba(220,38,38,0.6)" } : {}}
                                whileTap={!loading ? { scale: 0.98 } : {}}
                            >
                                {/* Background glow effect on button hover */}
                                <motion.div 
                                    className="absolute inset-0 bg-red-500/20 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300 blur-xl"
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
                                        <span className="tracking-[0.15em] text-sm font-black uppercase z-10 relative">Encrypting...</span>
                                    </>
                                ) : (
                                    <>
                                        <Fingerprint size={17} className="group-hover/btn:scale-110 transition-transform z-10 relative" />
                                        <span className="tracking-[0.12em] text-sm font-black uppercase z-10 relative">Initialize Access</span>
                                    </>
                                )}
                            </motion.button>
                        </form>
                    </motion.div>
                </motion.div>

                {/* Footer */}
                <motion.div variants={itemVariants} className="mt-6 sm:mt-8 text-center space-y-2">
                    <p className="text-red-500/25 text-[9px] sm:text-[10px] font-mono tracking-[0.2em] flex items-center justify-center gap-2">
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
