import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { Eye, EyeOff, Mail, Lock, AlertTriangle, CheckCircle, Zap, Shield, Users, BarChart3, Headphones, Sparkles, ArrowRight, ArrowLeft, Globe } from 'lucide-react';
import { supabase } from '@/config/supabase';
import ForgotPasswordModal from '@/components/ForgotPasswordModal';
import ForcePasswordChangeModal from '@/components/ForcePasswordChangeModal';
import { toast } from 'sonner';

// ─── Role chips data ──────────────────────────────────────────────────────────
const ROLE_CHIPS = [
    { key: 'admin', label: 'Admin', icon: Shield, gradient: 'from-red-500 to-rose-600', glow: 'rgba(239,68,68,0.4)' },
    { key: 'cityOps', label: 'City Ops', icon: BarChart3, gradient: 'from-blue-500 to-indigo-600', glow: 'rgba(99,102,241,0.4)' },
    { key: 'rm', label: 'Rep. Manager', icon: Headphones, gradient: 'from-emerald-500 to-teal-600', glow: 'rgba(16,185,129,0.4)' },
    { key: 'teamLeader', label: 'Team Leader', icon: Users, gradient: 'from-amber-500 to-orange-600', glow: 'rgba(245,158,11,0.4)' },
];

// ─── Cyber Grid + Warp Background ────────────────────────────────────────────
const CyberBackground: React.FC = () => {
    const hexagons = Array.from({ length: 18 }, (_, i) => i);
    const beams = Array.from({ length: 6 }, (_, i) => i);
    return (
        <div className="fixed inset-0 -z-10 overflow-hidden"
            style={{ background: 'linear-gradient(160deg, #050510 0%, #090924 30%, #06061a 60%, #020210 100%)' }}>
            {/* Primary aurora blobs */}
            <motion.div className="absolute -top-40 -left-40 w-[700px] h-[700px] rounded-full"
                style={{ background: 'radial-gradient(ellipse, rgba(249,115,22,0.18) 0%, rgba(234,88,12,0.08) 45%, transparent 70%)', filter: 'blur(80px)' }}
                animate={{ x: [0, 80, -30, 0], y: [0, -50, 60, 0], scale: [1, 1.2, 0.9, 1] }}
                transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }} />
            <motion.div className="absolute top-1/2 -right-40 w-[600px] h-[600px] rounded-full"
                style={{ background: 'radial-gradient(ellipse, rgba(217,70,239,0.18) 0%, rgba(168,85,247,0.08) 45%, transparent 70%)', filter: 'blur(90px)' }}
                animate={{ x: [0, -70, 50, 0], y: [0, 60, -40, 0], scale: [1, 0.85, 1.15, 1] }}
                transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut', delay: 6 }} />
            <motion.div className="absolute -bottom-60 left-1/4 w-[800px] h-[500px] rounded-full"
                style={{ background: 'radial-gradient(ellipse, rgba(6,182,212,0.12) 0%, rgba(8,145,178,0.05) 45%, transparent 70%)', filter: 'blur(100px)' }}
                animate={{ x: [0, 60, -40, 0], y: [0, -60, 30, 0], scale: [1, 1.1, 0.95, 1] }}
                transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut', delay: 12 }} />

            {/* Perspective grid floor */}
            <div className="absolute bottom-0 left-0 right-0 h-[45vh]"
                style={{
                    backgroundImage: 'linear-gradient(rgba(249,115,22,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(249,115,22,0.15) 1px, transparent 1px)',
                    backgroundSize: '60px 60px',
                    transform: 'perspective(400px) rotateX(55deg)',
                    transformOrigin: 'bottom center',
                    maskImage: 'linear-gradient(to top, white 0%, transparent 100%)',
                }} />

            {/* Light beams from top */}
            {beams.map((i) => (
                <motion.div key={i}
                    className="absolute top-0 w-[1px]"
                    style={{
                        left: `${10 + i * 15}%`,
                        height: `${30 + i * 10}%`,
                        background: `linear-gradient(to bottom, rgba(${i % 2 === 0 ? '249,115,22' : '217,70,239'},0.3), transparent)`,
                    }}
                    animate={{ opacity: [0, 0.6, 0], scaleY: [0.5, 1, 0.5] }}
                    transition={{ duration: 3 + i * 0.5, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }} />
            ))}

            {/* Hexagonal grid elements */}
            {hexagons.map((i) => (
                <motion.div key={i}
                    className="absolute border border-orange-500/10 rounded-xl"
                    style={{
                        width: 30 + (i % 4) * 15,
                        height: 30 + (i % 4) * 15,
                        left: `${(i * 5.8 + 5) % 90}%`,
                        top: `${(i * 7.1 + 5) % 85}%`,
                        rotate: `${i * 20}deg`,
                    }}
                    animate={{ rotate: [`${i * 20}deg`, `${i * 20 + 180}deg`, `${i * 20 + 360}deg`], opacity: [0.05, 0.2, 0.05], scale: [1, 1.05, 1] }}
                    transition={{ duration: 8 + i * 0.8, repeat: Infinity, ease: 'linear', delay: i * 0.3 }} />
            ))}

            {/* Floating particles */}
            {Array.from({ length: 30 }).map((_, i) => (
                <motion.div key={`p-${i}`}
                    className="absolute rounded-full"
                    style={{
                        width: i % 5 === 0 ? 3 : 1.5,
                        height: i % 5 === 0 ? 3 : 1.5,
                        left: `${(i * 3.7) % 95}%`,
                        top: `${(i * 4.3) % 95}%`,
                        background: i % 3 === 0 ? '#fb923c' : i % 3 === 1 ? '#d946ef' : '#22d3ee',
                        boxShadow: `0 0 8px currentColor`,
                    }}
                    animate={{ opacity: [0.1, 0.8, 0.1], scale: [1, 2, 1], y: [0, -(10 + i * 1.5), 0] }}
                    transition={{ duration: 3 + i * 0.28, repeat: Infinity, ease: 'easeInOut', delay: i * 0.15 }} />
            ))}

            {/* Diagonal scanline */}
            <motion.div className="absolute inset-0 pointer-events-none"
                style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(249,115,22,0.012) 3px, rgba(249,115,22,0.012) 4px)' }} />

            {/* Vignette */}
            <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 40%, transparent 25%, rgba(4,4,16,0.9) 100%)' }} />
        </div>
    );
};

// ─── Magnetic Card Wrapper ────────────────────────────────────────────────────
const MagneticCard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const rotateX = useSpring(useMotionValue(0), { stiffness: 120, damping: 20 });
    const rotateY = useSpring(useMotionValue(0), { stiffness: 120, damping: 20 });

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!cardRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = (e.clientX - cx) / (rect.width / 2);
        const dy = (e.clientY - cy) / (rect.height / 2);
        rotateX.set(-dy * 6);
        rotateY.set(dx * 6);
    };

    const handleMouseLeave = () => {
        rotateX.set(0);
        rotateY.set(0);
    };

    return (
        <motion.div
            ref={cardRef}
            style={{ rotateX, rotateY, transformStyle: 'preserve-3d', perspective: 1000 }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            animate={{ y: [0, -8, 0] }}
            transition={{ y: { duration: 5, repeat: Infinity, ease: 'easeInOut' } }}
        >
            {children}
        </motion.div>
    );
};

// ─── Main Login Page ──────────────────────────────────────────────────────────
const LoginPage: React.FC = () => {
    const navigate = useNavigate();
    const { login, refreshUserData } = useSupabaseAuth();
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

    // Rate limiting: max 5 attempts, then 60s lockout
    const [failedAttempts, setFailedAttempts] = useState(0);
    const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
    const [lockoutCountdown, setLockoutCountdown] = useState(0);

    useEffect(() => {
        if (!lockoutUntil) return;
        const tick = setInterval(() => {
            const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
            if (remaining <= 0) {
                setLockoutUntil(null);
                setLockoutCountdown(0);
                setFailedAttempts(0);
                clearInterval(tick);
            } else {
                setLockoutCountdown(remaining);
            }
        }, 1000);
        return () => clearInterval(tick);
    }, [lockoutUntil]);

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveRoleHint(prev => (prev + 1) % ROLE_CHIPS.length);
        }, 3500);
        return () => clearInterval(interval);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Rate limit check
        if (lockoutUntil && Date.now() < lockoutUntil) {
            setError(`Too many failed attempts. Please wait ${lockoutCountdown}s before trying again.`);
            return;
        }

        setError('');
        setLoading(true);

        try {
            let emailToLogin = loginInput.trim();
            const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailToLogin);

            if (!isEmail) {
                const { data: resolvedEmail, error: resolutionError } = await supabase
                    .rpc('resolve_login_identifier', { p_identifier: emailToLogin });

                if (resolutionError || !resolvedEmail) {
                    throw new Error('Account not found. Please check your credentials.');
                } else {
                    emailToLogin = resolvedEmail;
                }
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
                    .select('id, role, force_password_change')
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

                const role = userRecord?.role || 'teamLeader';
                try { localStorage.setItem('user_role', role); } catch {}

                const redirectPath = role === 'admin' ? '/portal'
                                   : role === 'cityOps' ? '/city-ops'
                                   : role === 'reportingManager' ? '/rm-panel'
                                   : '/team-leader';

                toast.success('Login successful! Redirecting...');
                await refreshUserData();
                navigate(redirectPath, { replace: true });

                setTimeout(() => {
                    if (window.location.pathname.includes('login')) {
                        window.location.replace(redirectPath);
                    }
                }, 250);
                return;
            }

            toast.success('Login successful! Redirecting...');
            await refreshUserData();
            navigate('/team-leader', { replace: true });

            setTimeout(() => {
                if (window.location.pathname.includes('login')) {
                    window.location.replace('/team-leader');
                }
            }, 250);
        } catch (err: any) {
            const newAttempts = failedAttempts + 1;
            setFailedAttempts(newAttempts);
            if (newAttempts >= 5) {
                const until = Date.now() + 60000;
                setLockoutUntil(until);
                setLockoutCountdown(60);
                setError('Too many failed attempts. Account locked for 60 seconds.');
            } else {
                setError(err.message || 'Failed to login. Please check your credentials.');
            }
            toast.error(err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    const activeChip = ROLE_CHIPS[activeRoleHint];

    return (
        <div className="min-h-[100dvh] relative flex items-center justify-center p-4 sm:p-6 selection:bg-orange-500/30">
            <CyberBackground />

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
                    <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform text-orange-400" />
                    <span>Back to Home</span>
                </Link>
            </motion.div>

            <div className="w-full max-w-[440px] relative">
                {/* ── Top badge ─── */}
                <motion.div
                    className="flex justify-center mb-5"
                    initial={{ opacity: 0, y: -16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full backdrop-blur-xl border"
                        style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}>
                        <motion.div
                            className="w-2 h-2 rounded-full bg-gradient-to-r from-orange-500 to-fuchsia-500"
                            animate={{ scale: [1, 1.5, 1], opacity: [0.7, 1, 0.7] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] bg-gradient-to-r from-orange-300 to-fuchsia-300 bg-clip-text text-transparent">
                            Triev Fleet v2.5 — PWA Ready
                        </span>
                    </div>
                </motion.div>

                {/* ── Logo ─── */}
                <motion.div
                    className="text-center mb-7"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                >
                    <div className="relative inline-block">
                        {/* Multi-ring glow */}
                        <motion.div className="absolute -inset-8 rounded-full"
                            style={{ background: `radial-gradient(ellipse, ${activeChip.glow} 0%, transparent 70%)`, filter: 'blur(20px)' }}
                            animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.4, 0.8, 0.4] }}
                            transition={{ duration: 3, repeat: Infinity }}
                        />
                        <motion.div className="relative w-24 h-24 rounded-[28px] flex items-center justify-center p-5 shadow-2xl"
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(30px)' }}
                            whileHover={{ scale: 1.08, rotate: [0, -4, 4, 0] }}
                            transition={{ duration: 0.5 }}
                        >
                            <img src="/triev_logo.png" alt="Triev Logo" className="w-full h-full object-contain drop-shadow-2xl" />
                        </motion.div>
                        <motion.div
                            className="absolute top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-black/50"
                            animate={{ scale: [1, 1.3, 1], boxShadow: ['0 0 8px #22c55e', '0 0 16px #22c55e', '0 0 8px #22c55e'] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        />
                    </div>

                    <motion.h1
                        className="text-3xl sm:text-4xl font-black text-white tracking-tighter mt-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                    >
                        TRIEV <span className="bg-gradient-to-r from-orange-400 via-rose-400 to-fuchsia-400 bg-clip-text text-transparent">Portal</span>
                    </motion.h1>
                    <p className="text-slate-500 text-[11px] font-mono tracking-widest uppercase mt-1">Fleet Management System</p>
                </motion.div>

                {/* ── Role Chip Switcher ─── */}
                <motion.div
                    className="flex items-center justify-center gap-1.5 flex-wrap mb-5"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                >
                    {ROLE_CHIPS.map((chip, idx) => {
                        const Icon = chip.icon;
                        const isActive = activeRoleHint === idx;
                        return (
                            <motion.button
                                key={chip.key}
                                type="button"
                                onClick={() => setActiveRoleHint(idx)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-wider transition-all duration-400`}
                                style={{
                                    background: isActive ? `linear-gradient(135deg, var(--from), var(--to))` : 'rgba(255,255,255,0.04)',
                                    backgroundImage: isActive ? `linear-gradient(135deg, ${chip.gradient.includes('red') ? '#ef4444,#e11d48' : chip.gradient.includes('blue') ? '#3b82f6,#4f46e5' : chip.gradient.includes('emerald') ? '#10b981,#0d9488' : '#f59e0b,#ea580c'})` : undefined,
                                    borderColor: isActive ? 'transparent' : 'rgba(255,255,255,0.08)',
                                    color: isActive ? 'white' : 'rgba(255,255,255,0.35)',
                                    boxShadow: isActive ? `0 4px 16px ${chip.glow}` : 'none',
                                }}
                                animate={isActive ? { scale: [1, 1.06, 1] } : { scale: 1 }}
                                transition={{ duration: 0.5 }}
                            >
                                <Icon size={10} />
                                {chip.label}
                            </motion.button>
                        );
                    })}
                </motion.div>

                {/* ── 3D Magnetic Login Card ─── */}
                <MagneticCard>
                    <motion.div
                        className="relative"
                        initial={{ opacity: 0, y: 24, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
                    >
                        {/* Multi-layer glow border */}
                        <motion.div
                            className="absolute -inset-[1px] rounded-[28px]"
                            style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.4), rgba(217,70,239,0.25), rgba(6,182,212,0.2))' }}
                            animate={{ opacity: [0.5, 0.85, 0.5] }}
                            transition={{ duration: 4, repeat: Infinity }}
                        />
                        <div className="absolute -inset-[3px] rounded-[30px] blur-md"
                            style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.15), rgba(217,70,239,0.1), rgba(6,182,212,0.08))' }} />

                        <div className="relative rounded-[26px] p-6 sm:p-8 overflow-hidden"
                            style={{
                                background: 'rgba(8, 8, 24, 0.88)',
                                backdropFilter: 'blur(50px)',
                                border: '1px solid rgba(255,255,255,0.06)',
                                boxShadow: '0 32px 100px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.06)',
                                transformStyle: 'preserve-3d',
                            }}
                        >
                            {/* Top shimmer */}
                            <div className="absolute top-0 left-1/4 right-1/4 h-[1px]"
                                style={{ background: 'linear-gradient(90deg, transparent, rgba(249,115,22,0.5), rgba(217,70,239,0.5), transparent)' }} />

                            {/* Moving scanline */}
                            <motion.div
                                className="absolute left-0 right-0 h-[2px] pointer-events-none"
                                style={{ background: 'linear-gradient(90deg, transparent, rgba(249,115,22,0.12), rgba(217,70,239,0.12), transparent)' }}
                                animate={{ top: ['0%', '100%'] }}
                                transition={{ duration: 5, repeat: Infinity, ease: 'linear', repeatDelay: 2 }}
                            />

                            <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
                                {/* Error */}
                                <AnimatePresence>
                                    {error && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
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
                                    <label className="text-[10px] font-black text-orange-400/60 uppercase tracking-[0.2em] flex items-center gap-1.5">
                                        <Mail size={9} /> Secure Identity
                                    </label>
                                    <div className="relative group">
                                        <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-300 ${focusedField === 'id' ? 'text-orange-400' : 'text-slate-600'}`}>
                                            <Mail size={16} />
                                        </div>
                                        <input
                                            type="text"
                                            value={loginInput}
                                            onChange={(e) => setLoginInput(e.target.value)}
                                            onFocus={() => setFocusedField('id')}
                                            onBlur={() => setFocusedField(null)}
                                            className="w-full pl-11 pr-4 py-3.5 rounded-xl text-white placeholder-slate-600 text-sm focus:outline-none transition-all duration-300"
                                            style={{
                                                background: focusedField === 'id' ? 'rgba(249,115,22,0.07)' : 'rgba(255,255,255,0.03)',
                                                border: `1px solid ${focusedField === 'id' ? 'rgba(249,115,22,0.5)' : 'rgba(255,255,255,0.06)'}`,
                                                boxShadow: focusedField === 'id' ? '0 0 0 3px rgba(249,115,22,0.1), 0 0 20px rgba(249,115,22,0.05)' : 'none',
                                            }}
                                            placeholder="Email, Mobile or Username"
                                            required
                                            autoComplete="username"
                                        />
                                        <div className="absolute bottom-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-orange-500/60 to-transparent scale-x-0 group-focus-within:scale-x-100 transition-transform duration-500" />
                                    </div>
                                </div>

                                {/* Password Field */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-orange-400/60 uppercase tracking-[0.2em] flex items-center gap-1.5">
                                        <Lock size={9} /> Passkey
                                    </label>
                                    <div className="relative group">
                                        <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-300 ${focusedField === 'pass' ? 'text-orange-400' : 'text-slate-600'}`}>
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
                                                background: focusedField === 'pass' ? 'rgba(249,115,22,0.07)' : 'rgba(255,255,255,0.03)',
                                                border: `1px solid ${focusedField === 'pass' ? 'rgba(249,115,22,0.5)' : 'rgba(255,255,255,0.06)'}`,
                                                boxShadow: focusedField === 'pass' ? '0 0 0 3px rgba(249,115,22,0.1)' : 'none',
                                            }}
                                            placeholder="••••••••"
                                            required
                                            autoComplete="current-password"
                                        />
                                        <button
                                            type="button"
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={(e) => { e.preventDefault(); setShowPassword(!showPassword); }}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 hover:bg-orange-500/20 text-slate-500 hover:text-orange-300 transition-all duration-300"
                                        >
                                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                        <div className="absolute bottom-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-orange-500/60 to-transparent scale-x-0 group-focus-within:scale-x-100 transition-transform duration-500" />
                                    </div>
                                </div>

                                {/* Options row */}
                                <div className="flex items-center justify-between">
                                    <label className="flex items-center gap-2 text-slate-500 cursor-pointer group/chk select-none">
                                        <div className="relative flex items-center justify-center">
                                            <input
                                                type="checkbox"
                                                checked={rememberMe}
                                                onChange={(e) => setRememberMe(e.target.checked)}
                                                className="peer w-4 h-4 opacity-0 absolute cursor-pointer"
                                            />
                                            <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center transition-all duration-200 ${rememberMe ? 'bg-orange-500 border-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)]' : 'border-white/15 group-hover/chk:border-white/30'}`}>
                                                {rememberMe && <CheckCircle className="w-2.5 h-2.5 text-white" />}
                                            </div>
                                        </div>
                                        <span className="text-[11px] font-bold uppercase tracking-wider group-hover/chk:text-orange-300 transition-colors">Stay Active</span>
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setShowForgotPassword(true)}
                                        className="text-[11px] font-black text-orange-500 hover:text-orange-300 transition-colors uppercase tracking-wider hover:underline underline-offset-2"
                                    >
                                        Recover Passkey →
                                    </button>
                                </div>

                                {/* Submit */}
                                <motion.button
                                    type="submit"
                                    disabled={loading || !!lockoutUntil}
                                    className="w-full relative rounded-xl py-4 font-black text-sm tracking-wide text-white overflow-hidden group/btn disabled:opacity-60 disabled:cursor-not-allowed"
                                    style={{ background: lockoutUntil ? 'linear-gradient(135deg, #6b7280, #4b5563)' : 'linear-gradient(135deg, #f97316, #ea580c, #dc2626)', boxShadow: lockoutUntil ? '0 4px 12px rgba(0,0,0,0.3)' : '0 8px 24px rgba(249,115,22,0.4)' }}
                                    whileHover={!loading && !lockoutUntil ? { scale: 1.02, y: -1, boxShadow: '0 12px 36px rgba(249,115,22,0.6)' } : {}}
                                    whileTap={!loading && !lockoutUntil ? { scale: 0.98 } : {}}
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700" />
                                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                                    <div className="relative z-10 flex items-center justify-center gap-2.5">
                                        {lockoutUntil ? (
                                            <>
                                                <motion.div
                                                    className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                                                    animate={{ rotate: 360 }}
                                                    transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                                                />
                                                <span>Locked — retry in {lockoutCountdown}s</span>
                                            </>
                                        ) : loading ? (
                                            <>
                                                <motion.div
                                                    className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                                                    animate={{ rotate: 360 }}
                                                    transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                                                />
                                                <span>Verifying Identity...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles size={16} className="group-hover/btn:rotate-12 transition-transform" />
                                                <span>Access Fleet Portal</span>
                                                <ArrowRight size={15} className="group-hover/btn:translate-x-1 transition-transform" />
                                            </>
                                        )}
                                    </div>
                                </motion.button>
                            </form>

                            {/* Back to Landing Page Link */}
                            <div className="mt-4 pt-3 border-t border-white/10 text-center">
                                <Link
                                    to="/"
                                    className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-orange-400 transition-colors font-medium group/link"
                                >
                                    <Globe size={13} className="text-orange-400 group-hover/link:rotate-45 transition-transform" />
                                    <span>Back to Landing Page</span>
                                </Link>
                            </div>
                        </div>
                    </motion.div>
                </MagneticCard>

                {/* ── Footer ─── */}
                <motion.div
                    className="mt-6 text-center space-y-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                >
                    <p className="text-white/10 text-[10px] font-bold tracking-[0.25em] uppercase">
                        © 2026 Triev Rider Technologies
                    </p>
                    <div className="flex items-center justify-center gap-2">
                        <motion.div
                            className="w-1.5 h-1.5 rounded-full bg-green-500"
                            animate={{ opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        />
                        <span className="text-[9px] font-mono uppercase tracking-widest text-green-500/40 flex items-center gap-1">
                            <Zap size={8} /> All Systems Online · v2.5
                        </span>
                    </div>
                </motion.div>
            </div>

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
