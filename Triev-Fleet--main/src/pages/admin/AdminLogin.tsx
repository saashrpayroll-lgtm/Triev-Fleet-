import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/config/supabase';
import { Link, useNavigate } from 'react-router-dom';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { Eye, EyeOff, ShieldCheck, Lock, AlertTriangle, User, Fingerprint, Cpu, Activity, Zap, CheckCircle2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import ForcePasswordChangeModal from '@/components/ForcePasswordChangeModal';
import { sanitizeInput, checkRateLimit, recordFailedAttempt, resetRateLimit } from '@/utils/securityUtils';

// ─── Aurora Animated Background ───────────────────────────────────────────────
const AuroraBackground: React.FC = () => {
    const nodes = Array.from({ length: 24 }, (_, i) => i);
    const orbitRings = [320, 480, 640];

    return (
        <div className="fixed inset-0 -z-10 overflow-hidden" style={{ background: 'linear-gradient(145deg, #06061a 0%, #0c0c2e 35%, #080818 70%, #03030f 100%)' }}>
            {/* Deep aurora layers */}
            <motion.div
                className="absolute -top-1/2 -left-1/4 w-[90vw] h-[90vh] rounded-full"
                style={{ background: 'radial-gradient(ellipse at center, rgba(79,70,229,0.25) 0%, rgba(124,58,237,0.12) 40%, transparent 70%)', filter: 'blur(70px)' }}
                animate={{ x: [0, 70, -30, 0], y: [0, -50, 40, 0], scale: [1, 1.15, 0.92, 1] }}
                transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
                className="absolute top-1/3 -right-1/3 w-[80vw] h-[80vh] rounded-full"
                style={{ background: 'radial-gradient(ellipse at center, rgba(139,92,246,0.2) 0%, rgba(167,139,250,0.08) 40%, transparent 70%)', filter: 'blur(90px)' }}
                animate={{ x: [0, -60, 40, 0], y: [0, 60, -40, 0], scale: [1, 0.88, 1.12, 1] }}
                transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut', delay: 5 }}
            />
            <motion.div
                className="absolute -bottom-1/3 left-1/4 w-[70vw] h-[70vh] rounded-full"
                style={{ background: 'radial-gradient(ellipse at center, rgba(6,182,212,0.15) 0%, rgba(8,145,178,0.06) 40%, transparent 70%)', filter: 'blur(100px)' }}
                animate={{ x: [0, 50, -40, 0], y: [0, -60, 30, 0], scale: [1, 1.2, 0.9, 1] }}
                transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut', delay: 10 }}
            />
            {/* Bright center accent glow */}
            <motion.div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full"
                style={{ background: 'radial-gradient(ellipse at center, rgba(99,102,241,0.08) 0%, transparent 70%)', filter: 'blur(40px)' }}
                animate={{ scale: [0.9, 1.1, 0.9], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            />

            {/* ── Orbit rings (3D depth effect) ── */}
            {orbitRings.map((size, i) => (
                <motion.div
                    key={i}
                    className="absolute top-1/2 left-1/2 rounded-full border"
                    style={{
                        width: size,
                        height: size,
                        marginLeft: -size / 2,
                        marginTop: -size / 2,
                        borderColor: `rgba(99,102,241,${0.12 - i * 0.03})`,
                        transform: `perspective(800px) rotateX(${65 + i * 5}deg)`,
                    }}
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 20 + i * 8, repeat: Infinity, ease: 'linear' }}
                >
                    {/* Orbit dot */}
                    <motion.div
                        className="absolute w-2 h-2 rounded-full -top-1 left-1/2 -translate-x-1/2"
                        style={{
                            background: `rgba(${i === 0 ? '99,102,241' : i === 1 ? '139,92,246' : '6,182,212'},0.9)`,
                            boxShadow: `0 0 12px rgba(${i === 0 ? '99,102,241' : i === 1 ? '139,92,246' : '6,182,212'},0.8)`,
                        }}
                    />
                </motion.div>
            ))}

            {/* ── Floating diamond shapes ── */}
            {[0, 1, 2, 3].map((i) => (
                <motion.div
                    key={`diamond-${i}`}
                    className="absolute border border-indigo-500/15"
                    style={{
                        width: 40 + i * 20,
                        height: 40 + i * 20,
                        left: `${15 + i * 22}%`,
                        top: `${10 + i * 20}%`,
                        rotate: 45,
                    }}
                    animate={{
                        rotate: [45, 90, 45],
                        opacity: [0.1, 0.3, 0.1],
                        scale: [1, 1.1, 1],
                        y: [0, -15, 0],
                    }}
                    transition={{ duration: 5 + i * 1.5, repeat: Infinity, ease: 'easeInOut', delay: i * 0.8 }}
                />
            ))}

            {/* ── Fine mesh grid ── */}
            <motion.div
                className="absolute inset-0"
                style={{
                    backgroundImage: 'linear-gradient(rgba(99,102,241,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.05) 1px, transparent 1px)',
                    backgroundSize: '60px 60px',
                    maskImage: 'radial-gradient(ellipse at center, white 20%, transparent 75%)',
                }}
                animate={{ backgroundPosition: ['0px 0px', '60px 60px'] }}
                transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
            />

            {/* ── Floating nodes (network particles) ── */}
            {nodes.map((i) => (
                <motion.div
                    key={i}
                    className="absolute rounded-full"
                    style={{
                        width: i % 3 === 0 ? 2.5 : 1.5,
                        height: i % 3 === 0 ? 2.5 : 1.5,
                        left: `${(i * 4.3 + 8) % 88}%`,
                        top: `${(i * 6.7 + 5) % 90}%`,
                        background: i % 4 === 0 ? '#818cf8' : i % 4 === 1 ? '#a78bfa' : i % 4 === 2 ? '#22d3ee' : '#6366f1',
                        boxShadow: `0 0 ${i % 3 === 0 ? 10 : 6}px currentColor`,
                    }}
                    animate={{
                        opacity: [0.15, 0.9, 0.15],
                        scale: [1, 1.8, 1],
                        y: [0, -(12 + i * 2), 0],
                        x: [0, i % 2 === 0 ? 8 : -8, 0],
                    }}
                    transition={{ duration: 4 + i * 0.35, repeat: Infinity, ease: 'easeInOut', delay: i * 0.18 }}
                />
            ))}

            {/* ── Horizontal scanline glitch ── */}
            <motion.div
                className="absolute left-0 right-0 h-[1px] pointer-events-none"
                style={{ background: 'linear-gradient(90deg, transparent 5%, rgba(99,102,241,0.25) 30%, rgba(139,92,246,0.35) 50%, rgba(6,182,212,0.25) 70%, transparent 95%)' }}
                animate={{ top: ['-2%', '102%'] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: 'linear', repeatDelay: 1.5 }}
            />

            {/* Vignette */}
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(4,4,20,0.85) 100%)' }} />
        </div>
    );
};

// ─── Status Indicator ─────────────────────────────────────────────────────────
const SystemStatus: React.FC = () => (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 backdrop-blur-sm">
        <motion.div
            className="w-1.5 h-1.5 rounded-full bg-emerald-400"
            animate={{ opacity: [0.4, 1, 0.4], scale: [0.8, 1.2, 0.8] }}
            transition={{ duration: 1.5, repeat: Infinity }}
        />
        <span className="text-[10px] font-bold text-emerald-400 tracking-widest uppercase">Systems Online</span>
    </div>
);

// ─── Main Admin Login ──────────────────────────────────────────────────────────
const AdminLogin: React.FC = () => {
    const navigate = useNavigate();
    const { login, refreshUserData } = useSupabaseAuth();
    const [loginInput, setLoginInput] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showForcePasswordChange, setShowForcePasswordChange] = useState(false);
    const [loggedInUserId, setLoggedInUserId] = useState<string | null>(null);
    const [focusedField, setFocusedField] = useState<string | null>(null);
    const [loginTime, setLoginTime] = useState('');

    // Rate limiting: max 5 attempts, then 60s lockout (persisted)
    const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
    const [lockoutCountdown, setLockoutCountdown] = useState(0);
    const [botHoneypot, setBotHoneypot] = useState('');

    useEffect(() => {
        const initialStatus = checkRateLimit('admin_login');
        if (initialStatus.isLocked) {
            setLockoutCountdown(initialStatus.remainingSeconds);
            setLockoutUntil(Date.now() + initialStatus.remainingSeconds * 1000);
            setError(`Security Lockout: Admin portal locked. Wait ${initialStatus.remainingSeconds}s.`);
        }
    }, []);

    useEffect(() => {
        if (!lockoutUntil) return;
        const tick = setInterval(() => {
            const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
            if (remaining <= 0) {
                setLockoutUntil(null);
                setLockoutCountdown(0);
                resetRateLimit('admin_login');
                clearInterval(tick);
            } else {
                setLockoutCountdown(remaining);
            }
        }, 1000);
        return () => clearInterval(tick);
    }, [lockoutUntil]);

    useEffect(() => {
        const tick = () => setLoginTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Bot Honeypot Trap
        if (botHoneypot) {
            setLoading(false);
            return;
        }

        // Persistent Rate limit check
        const currentLimit = checkRateLimit('admin_login');
        if (currentLimit.isLocked) {
            setLockoutCountdown(currentLimit.remainingSeconds);
            setError(`Security Lockout: Too many failed admin attempts. Wait ${currentLimit.remainingSeconds}s.`);
            return;
        }

        setError('');
        setLoading(true);

        try {
            let emailToLogin = sanitizeInput(loginInput);
            const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailToLogin);

            if (!isEmail) {
                const { data: resolvedEmail, error: resolutionError } = await supabase
                    .rpc('resolve_login_identifier', { p_identifier: emailToLogin });

                if (resolutionError || !resolvedEmail) {
                    throw new Error("Account not found. Please check your credentials.");
                } else {
                    emailToLogin = resolvedEmail;
                }
            }

            await login(emailToLogin, password);
            resetRateLimit('admin_login');

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Authentication failed.");

            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('id, role, force_password_change')
                .eq('id', user.id)
                .single();

            if (userError || !userData || userData.role !== 'admin') {
                await supabase.auth.signOut();
                throw new Error("ACCESS DENIED: Administrative privileges required.");
            }

            try { localStorage.setItem('user_role', 'admin'); } catch {}

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
            await refreshUserData();
            navigate('/portal', { replace: true });

            // Safety fallback
            setTimeout(() => {
                if (window.location.pathname.includes('login')) {
                    window.location.replace('/portal');
                }
            }, 250);

        } catch (err: any) {
            const limitStatus = recordFailedAttempt('admin_login');
            if (limitStatus.isLocked) {
                const until = Date.now() + limitStatus.remainingSeconds * 1000;
                setLockoutUntil(until);
                setLockoutCountdown(limitStatus.remainingSeconds);
                setError(`Security Lockout: Admin portal locked for ${limitStatus.remainingSeconds} seconds.`);
            } else {
                setError(err.message || "Authentication failed. Access denied.");
            }
            toast.error(err.message || "Login failed");
            if (err.message && err.message.includes("DENIED")) {
                await supabase.auth.signOut();
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[100dvh] relative flex items-center justify-center p-4 sm:p-6 selection:bg-indigo-500/30">
            <AuroraBackground />

            {/* ── Top Left Back to Landing Page Button ── */}
            <motion.div
                className="fixed top-4 left-4 sm:top-6 sm:left-6 z-30"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
            >
                <Link
                    to="/"
                    className="group inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl backdrop-blur-2xl border border-white/15 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-bold shadow-xl transition-all duration-300 hover:scale-105 active:scale-95"
                    title="Back to Landing Page"
                >
                    <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform text-indigo-400" />
                    <span>Back to Home</span>
                </Link>
            </motion.div>

            {/* ── Two-column Layout ─────────────────────────────────────── */}
            <div className="w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">

                {/* ── Left Panel — Branding ─────────────────────────────── */}
                <motion.div
                    className="hidden lg:flex flex-col gap-8"
                    initial={{ opacity: 0, x: -40 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                >
                    {/* Logo */}
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <motion.div
                                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                                animate={{ boxShadow: ['0 0 20px rgba(99,102,241,0.3)', '0 0 40px rgba(99,102,241,0.6)', '0 0 20px rgba(99,102,241,0.3)'] }}
                                transition={{ duration: 2.5, repeat: Infinity }}
                            >
                                <ShieldCheck className="w-7 h-7 text-white" />
                            </motion.div>
                            {/* Orbit ring */}
                            <motion.div
                                className="absolute -inset-3 rounded-3xl border border-indigo-500/30"
                                animate={{ rotate: 360 }}
                                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                            />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-white tracking-tight">Triev Fleet</h1>
                            <p className="text-indigo-400/70 text-xs font-mono tracking-widest uppercase">Command Center v2.5</p>
                        </div>
                    </div>

                    {/* Tagline */}
                    <div className="space-y-3">
                        <motion.h2
                            className="text-4xl xl:text-5xl font-black text-white leading-tight"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3, duration: 0.8 }}
                        >
                            Manage Your Fleet
                            <br />
                            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                                Like a Pro.
                            </span>
                        </motion.h2>
                        <motion.p
                            className="text-slate-400 text-sm leading-relaxed max-w-sm"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5 }}
                        >
                            Full-stack EV fleet intelligence — real-time rider tracking, wallet management, AI-powered collections, and team performance at your fingertips.
                        </motion.p>
                    </div>

                    {/* Feature pills */}
                    <motion.div
                        className="flex flex-wrap gap-2"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                    >
                        {[
                            { icon: Activity, label: 'Live Fleet Tracking' },
                            { icon: Zap, label: 'AI Voice Calls' },
                            { icon: Cpu, label: 'Smart Analytics' },
                        ].map(({ icon: Icon, label }) => (
                            <div key={label} className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm">
                                <Icon size={12} className="text-indigo-400" />
                                <span className="text-xs text-slate-300 font-medium">{label}</span>
                            </div>
                        ))}
                    </motion.div>

                    {/* Live clock */}
                    <motion.div
                        className="flex items-center gap-3 pt-4 border-t border-white/5"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8 }}
                    >
                        <SystemStatus />
                        <span className="font-mono text-xs text-slate-500">{loginTime} IST</span>
                    </motion.div>
                </motion.div>

                {/* ── Right Panel — Login Card ───────────────────────────── */}
                <motion.div
                    initial={{ opacity: 0, y: 30, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
                    className="relative"
                >
                    {/* Card outer glow */}
                    <motion.div
                        className="absolute -inset-[1px] rounded-[28px] opacity-60"
                        style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.4), rgba(139,92,246,0.2), rgba(6,182,212,0.1))' }}
                        animate={{ opacity: [0.4, 0.7, 0.4] }}
                        transition={{ duration: 4, repeat: Infinity }}
                    />

                    <div
                        className="relative rounded-[26px] p-7 sm:p-9 overflow-hidden"
                        style={{
                            background: 'rgba(12, 12, 30, 0.85)',
                            backdropFilter: 'blur(40px)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,102,241,0.1) inset',
                        }}
                    >
                        {/* Inner shimmer top */}
                        <div className="absolute top-0 left-1/4 right-1/4 h-[1px]" style={{ background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.5), transparent)' }} />

                        {/* Scan line animation */}
                        <motion.div
                            className="absolute left-0 right-0 h-[1px] pointer-events-none"
                            style={{ background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.15), transparent)' }}
                            animate={{ top: ['0%', '100%'] }}
                            transition={{ duration: 5, repeat: Infinity, ease: 'linear', repeatDelay: 2 }}
                        />

                        {/* Mobile logo (only visible on mobile) */}
                        <div className="lg:hidden flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                                <ShieldCheck className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <p className="text-white font-black text-lg">Triev Fleet</p>
                                <p className="text-indigo-400/60 text-[10px] font-mono tracking-widest uppercase">Admin Command Center</p>
                            </div>
                        </div>

                        {/* Card header */}
                        <div className="mb-7">
                            <div className="flex items-center justify-between mb-1">
                                <h2 className="text-xl font-black text-white">Secure Sign-in</h2>
                                <SystemStatus />
                            </div>
                            <p className="text-slate-500 text-xs">Administrative access only — all sessions are logged.</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
                            {/* Error */}
                            <AnimatePresence>
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0, y: -10 }}
                                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-3.5 flex items-start gap-2.5">
                                            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                            <p className="text-sm text-red-300 font-medium leading-snug">{error}</p>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Identity Field */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-indigo-400/60 uppercase tracking-[0.2em] flex items-center gap-1.5">
                                    <User size={9} className="text-indigo-400/50" />
                                    Identity / Username
                                </label>
                                <div className="relative group">
                                    <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-300 ${focusedField === 'id' ? 'text-indigo-400' : 'text-slate-600'}`}>
                                        <User size={16} />
                                    </div>
                                    <input
                                        type="text"
                                        value={loginInput}
                                        onChange={(e) => setLoginInput(e.target.value)}
                                        onFocus={() => setFocusedField('id')}
                                        onBlur={() => setFocusedField(null)}
                                        className="w-full pl-11 pr-4 py-3.5 rounded-xl text-white placeholder-slate-600 font-mono text-sm focus:outline-none transition-all duration-300"
                                        style={{
                                            background: focusedField === 'id' ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.03)',
                                            border: `1px solid ${focusedField === 'id' ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.06)'}`,
                                            boxShadow: focusedField === 'id' ? '0 0 0 3px rgba(99,102,241,0.1), 0 0 20px rgba(99,102,241,0.05)' : 'none',
                                        }}
                                        placeholder="Enter ID, email or username"
                                        required
                                        autoComplete="username"
                                    />
                                    {/* Bottom underline sweep */}
                                    <div className="absolute bottom-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent scale-x-0 group-focus-within:scale-x-100 transition-transform duration-500" />
                                </div>
                            </div>

                            {/* Password Field */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-indigo-400/60 uppercase tracking-[0.2em] flex items-center gap-1.5">
                                    <Lock size={9} className="text-indigo-400/50" />
                                    Access Key
                                </label>
                                <div className="relative group">
                                    <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-300 ${focusedField === 'pass' ? 'text-indigo-400' : 'text-slate-600'}`}>
                                        <Lock size={16} />
                                    </div>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        onFocus={() => setFocusedField('pass')}
                                        onBlur={() => setFocusedField(null)}
                                        className="w-full pl-11 pr-14 py-3.5 rounded-xl text-white placeholder-slate-600 font-mono tracking-widest text-lg focus:outline-none transition-all duration-300 [&::-ms-reveal]:hidden [&::-webkit-credentials-auto-fill-button]:hidden"
                                        style={{
                                            background: focusedField === 'pass' ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.03)',
                                            border: `1px solid ${focusedField === 'pass' ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.06)'}`,
                                            boxShadow: focusedField === 'pass' ? '0 0 0 3px rgba(99,102,241,0.1), 0 0 20px rgba(99,102,241,0.05)' : 'none',
                                        }}
                                        placeholder="••••••••"
                                        required
                                        autoComplete="current-password"
                                    />
                                    <button
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={(e) => { e.preventDefault(); setShowPassword(!showPassword); }}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 hover:bg-indigo-500/20 text-slate-500 hover:text-indigo-300 transition-all duration-300"
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                    <div className="absolute bottom-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent scale-x-0 group-focus-within:scale-x-100 transition-transform duration-500" />
                                </div>
                            </div>

                            {/* Hidden Honeypot Field for Automated Bot Trap */}
                            <input
                                type="text"
                                name="hp_admin_validation"
                                value={botHoneypot}
                                onChange={e => setBotHoneypot(e.target.value)}
                                style={{ display: 'none', position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                                tabIndex={-1}
                                autoComplete="off"
                            />

                            {/* Security Badging */}
                            <div className="flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-bold text-indigo-300">
                                <ShieldCheck size={12} className="text-indigo-400" />
                                <span>AES-256 Cryptographic Channel · Hardened Admin Gateway</span>
                            </div>

                            {/* Submit Button */}
                            <motion.button
                                type="submit"
                                disabled={loading || !!lockoutUntil}
                                className="w-full relative rounded-xl py-4 font-black text-sm tracking-wide overflow-hidden group/btn disabled:opacity-60 disabled:cursor-not-allowed"
                                style={{ background: lockoutUntil ? 'linear-gradient(135deg, #6b7280, #4b5563)' : 'linear-gradient(135deg, #6366f1, #7c3aed)', boxShadow: lockoutUntil ? '0 4px 12px rgba(0,0,0,0.3)' : '0 8px 24px rgba(99,102,241,0.4)' }}
                                whileHover={!loading && !lockoutUntil ? { scale: 1.02, y: -1 } : {}}
                                whileTap={!loading && !lockoutUntil ? { scale: 0.98 } : {}}
                            >
                                {/* Shimmer */}
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700" />
                                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                                <div className="relative z-10 flex items-center justify-center gap-2.5 text-white">
                                    {lockoutUntil ? (
                                        <>
                                            <motion.div
                                                className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                                                animate={{ rotate: 360 }}
                                                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                                            />
                                            <span>Admin Console Locked ({lockoutCountdown}s)</span>
                                        </>
                                    ) : loading ? (
                                        <>
                                            <motion.div
                                                className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                                                animate={{ rotate: 360 }}
                                                transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                                            />
                                            <span>Authenticating...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Fingerprint size={17} />
                                            <span>Initialize Secure Access</span>
                                        </>
                                    )}
                                </div>
                            </motion.button>
                        </form>

                        {/* Footer chips */}
                        <div className="mt-6 pt-5 border-t border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                                <CheckCircle2 size={12} className="text-emerald-400" />
                                <span className="text-[10px] text-slate-600 font-mono">End-to-End Encrypted</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <CheckCircle2 size={12} className="text-emerald-400" />
                                <span className="text-[10px] text-slate-600 font-mono">Session Logged</span>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>

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
