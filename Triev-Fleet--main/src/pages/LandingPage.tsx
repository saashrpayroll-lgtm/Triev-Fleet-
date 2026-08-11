import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import {
    Users, BarChart3, Bot, Target, Trophy, ShieldAlert, Zap, Shield,
    ArrowRight, ChevronDown, Star, CheckCircle2, Sparkles, Globe,
    Wallet, Bell, LogIn, Lock, Activity, Play, X, LayoutDashboard, Home
} from 'lucide-react';

// ─── Animated Aurora Background ───────────────────────────────────────────────
const LandingBackground: React.FC = () => {
    const particles = Array.from({ length: 40 }, (_, i) => i);
    return (
        <div className="fixed inset-0 -z-10 overflow-hidden"
            style={{ background: 'linear-gradient(160deg, #030310 0%, #07072a 40%, #050518 70%, #020210 100%)' }}>
            {/* Aurora blobs */}
            <motion.div className="absolute -top-1/3 -left-1/4 w-[100vw] h-[100vh] rounded-full"
                style={{ background: 'radial-gradient(ellipse, rgba(79,70,229,0.22) 0%, rgba(124,58,237,0.1) 40%, transparent 70%)', filter: 'blur(80px)' }}
                animate={{ x: [0, 80, -30, 0], y: [0, -50, 60, 0], scale: [1, 1.2, 0.9, 1] }}
                transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }} />
            <motion.div className="absolute top-1/3 -right-1/3 w-[80vw] h-[80vh] rounded-full"
                style={{ background: 'radial-gradient(ellipse, rgba(16,185,129,0.14) 0%, rgba(5,150,105,0.07) 40%, transparent 70%)', filter: 'blur(90px)' }}
                animate={{ x: [0, -70, 50, 0], y: [0, 60, -40, 0], scale: [1, 0.85, 1.15, 1] }}
                transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut', delay: 6 }} />
            <motion.div className="absolute -bottom-1/4 left-1/4 w-[70vw] h-[70vh] rounded-full"
                style={{ background: 'radial-gradient(ellipse, rgba(245,158,11,0.1) 0%, rgba(217,119,6,0.05) 40%, transparent 70%)', filter: 'blur(100px)' }}
                animate={{ x: [0, 60, -40, 0], y: [0, -60, 30, 0], scale: [1, 1.1, 0.95, 1] }}
                transition={{ duration: 32, repeat: Infinity, ease: 'easeInOut', delay: 12 }} />

            {/* Grid */}
            <div className="absolute inset-0 opacity-[0.035]"
                style={{ backgroundImage: 'linear-gradient(rgba(99,102,241,1) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,1) 1px, transparent 1px)', backgroundSize: '64px 64px' }} />

            {/* Particles */}
            {particles.map((i) => (
                <motion.div key={i}
                    className="absolute rounded-full"
                    style={{
                        width: i % 5 === 0 ? 3 : i % 3 === 0 ? 2 : 1.5,
                        height: i % 5 === 0 ? 3 : i % 3 === 0 ? 2 : 1.5,
                        left: `${(i * 2.6 + 3) % 96}%`,
                        top: `${(i * 3.7 + 2) % 96}%`,
                        background: i % 4 === 0 ? '#818cf8' : i % 4 === 1 ? '#34d399' : i % 4 === 2 ? '#fbbf24' : '#6366f1',
                        boxShadow: `0 0 ${i % 3 === 0 ? 10 : 6}px currentColor`,
                    }}
                    animate={{ opacity: [0.15, 0.9, 0.15], scale: [1, 1.8, 1], y: [0, -(10 + i * 1.2), 0] }}
                    transition={{ duration: 4 + i * 0.28, repeat: Infinity, ease: 'easeInOut', delay: i * 0.15 }} />
            ))}

            {/* Scanline */}
            <motion.div className="absolute left-0 right-0 h-[1px] pointer-events-none"
                style={{ background: 'linear-gradient(90deg, transparent 5%, rgba(99,102,241,0.2) 30%, rgba(16,185,129,0.25) 50%, rgba(245,158,11,0.2) 70%, transparent 95%)' }}
                animate={{ top: ['-2%', '102%'] }}
                transition={{ duration: 6, repeat: Infinity, ease: 'linear', repeatDelay: 2 }} />

            <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 40%, transparent 30%, rgba(3,3,16,0.9) 100%)' }} />
        </div>
    );
};

// ─── Feature Card with 3D Tilt ────────────────────────────────────────────────
interface FeatureCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    gradient: string;
    glow: string;
    delay: number;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ icon, title, description, gradient, glow, delay }) => {
    const [tilt, setTilt] = useState({ x: 0, y: 0 });
    const cardRef = useRef<HTMLDivElement>(null);

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!cardRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        setTilt({
            x: ((e.clientY - cy) / (rect.height / 2)) * -8,
            y: ((e.clientX - cx) / (rect.width / 2)) * 8,
        });
    };

    return (
        <motion.div
            ref={cardRef}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformStyle: 'preserve-3d', perspective: 800 }}
            animate={{ rotateX: tilt.x, rotateY: tilt.y }}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setTilt({ x: 0, y: 0 })}
            className="group relative"
        >
            {/* Glow on hover */}
            <div className="absolute -inset-[1px] rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: `linear-gradient(135deg, ${glow}40, transparent 60%)` }} />

            <div className="relative h-full rounded-2xl p-6 border border-white/[0.06] hover:border-white/[0.12] transition-all duration-300"
                style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)' }}>
                {/* Icon */}
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 shadow-lg"
                    style={{ background: gradient }}>
                    {icon}
                </div>
                <h3 className="font-black text-base text-white mb-2">{title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{description}</p>

                {/* Bottom accent */}
                <div className="absolute bottom-0 left-6 right-6 h-[1px] scale-x-0 group-hover:scale-x-100 transition-transform duration-500"
                    style={{ background: `linear-gradient(90deg, transparent, ${glow}, transparent)` }} />
            </div>
        </motion.div>
    );
};

// ─── Counter ──────────────────────────────────────────────────────────────────
const Counter: React.FC<{ target: number; suffix?: string; prefix?: string; duration?: number }> = ({
    target, suffix = '', prefix = '', duration = 2
}) => {
    const [count, setCount] = useState(0);
    const ref = useRef<HTMLSpanElement>(null);
    const [started, setStarted] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(([e]) => { if (e.isIntersecting && !started) setStarted(true); }, { threshold: 0.5 });
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, [started]);

    useEffect(() => {
        if (!started) return;
        const steps = 60;
        const increment = target / steps;
        let current = 0;
        const timer = setInterval(() => {
            current += increment;
            if (current >= target) { setCount(target); clearInterval(timer); }
            else setCount(Math.floor(current));
        }, (duration * 1000) / steps);
        return () => clearInterval(timer);
    }, [started, target, duration]);

    return <span ref={ref}>{prefix}{count.toLocaleString('en-IN')}{suffix}</span>;
};

// ─── Login Modal ──────────────────────────────────────────────────────────────
const LoginChoiceModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
    <motion.div className="fixed inset-0 z-[99999] flex items-center justify-center px-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <motion.div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
        <motion.div
            className="relative w-full max-w-sm rounded-3xl p-8 border border-white/10 shadow-2xl"
            style={{ background: 'rgba(8,8,28,0.95)', backdropFilter: 'blur(40px)' }}
            initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        >
            <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-xl hover:bg-white/10 text-white/50 hover:text-white transition-all">
                <X size={18} />
            </button>
            <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #7c3aed)' }}>
                    <Lock size={24} className="text-white" />
                </div>
                <h3 className="text-xl font-black text-white">Choose Portal</h3>
                <p className="text-slate-400 text-sm mt-1">Select your access level</p>
            </div>
            <div className="space-y-3">
                <Link to="/login" className="flex items-center gap-4 p-4 rounded-2xl border border-amber-500/20 hover:border-amber-500/50 bg-amber-500/5 hover:bg-amber-500/10 transition-all group">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: 'linear-gradient(135deg, #f59e0b, #ea580c)' }}>
                        <Users size={18} className="text-white" />
                    </div>
                    <div>
                        <p className="font-black text-white text-sm">Team Portal</p>
                        <p className="text-slate-400 text-[11px]">Team Leader · RM · City Ops</p>
                    </div>
                    <ArrowRight size={16} className="ml-auto text-slate-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
                </Link>
                <Link to="/admin-login" className="flex items-center gap-4 p-4 rounded-2xl border border-indigo-500/20 hover:border-indigo-500/50 bg-indigo-500/5 hover:bg-indigo-500/10 transition-all group">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: 'linear-gradient(135deg, #6366f1, #7c3aed)' }}>
                        <Shield size={18} className="text-white" />
                    </div>
                    <div>
                        <p className="font-black text-white text-sm">Admin Console</p>
                        <p className="text-slate-400 text-[11px]">Super Admin Access Only</p>
                    </div>
                    <ArrowRight size={16} className="ml-auto text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                </Link>
            </div>
        </motion.div>
    </motion.div>
);

// ─── Main Landing Page ────────────────────────────────────────────────────────
const FEATURES = [
    { icon: <Users size={22} className="text-white" />, title: 'Rider Management', description: 'Complete EV rider lifecycle — onboarding, wallet tracking, performance scoring, and AI-powered collection calls.', gradient: 'linear-gradient(135deg, #6366f1, #7c3aed)', glow: '#6366f1', delay: 0 },
    { icon: <BarChart3 size={22} className="text-white" />, title: 'Analytics Dashboard', description: 'Real-time collection charts, leaderboards, and revenue trends across all team levels with drill-down views.', gradient: 'linear-gradient(135deg, #10b981, #059669)', glow: '#10b981', delay: 0.08 },
    { icon: <Bot size={22} className="text-white" />, title: 'AI Call Center', description: 'ElevenLabs-powered outbound AI voice calls to negative-balance riders — automated follow-ups with live status tracking.', gradient: 'linear-gradient(135deg, #f59e0b, #d97706)', glow: '#f59e0b', delay: 0.16 },
    { icon: <Target size={22} className="text-white" />, title: 'Lead Management', description: 'Sales pipeline tracking from prospect to onboarded rider — assign, track, and convert leads across your team.', gradient: 'linear-gradient(135deg, #ef4444, #dc2626)', glow: '#ef4444', delay: 0.24 },
    { icon: <ShieldAlert size={22} className="text-white" />, title: 'Support & Requests', description: 'Rider request ticketing system with priority queues, status tracking, and team escalation workflows.', gradient: 'linear-gradient(135deg, #ec4899, #db2777)', glow: '#ec4899', delay: 0.32 },
    { icon: <Trophy size={22} className="text-white" />, title: 'Performance Board', description: 'TL, RM, and City Ops ranking boards with collection targets, achievement badges, and trend indicators.', gradient: 'linear-gradient(135deg, #14b8a6, #0d9488)', glow: '#14b8a6', delay: 0.40 },
];

const ROLES = [
    { label: 'Admin', sub: 'Super control', icon: Shield, color: '#6366f1', gradient: 'from-indigo-600 to-violet-700', features: ['Full portal access', 'Staff & role management', 'AI Call Center', 'All analytics', 'System configuration'], path: '/admin-login' },
    { label: 'City Ops', sub: 'City-level oversight', icon: Globe, color: '#10b981', gradient: 'from-emerald-600 to-teal-700', features: ['RM/TL performance', 'Rider & lead overview', 'Wallet history', 'Leaderboard', 'City reports'], path: '/login' },
    { label: 'Rep. Manager', sub: 'Team management', icon: Activity, color: '#f59e0b', gradient: 'from-amber-500 to-orange-600', features: ['TL performance view', 'Rider overview', 'Lead pipeline', 'Collection history', 'Team reports'], path: '/login' },
    { label: 'Team Leader', sub: 'Ground operations', icon: Users, color: '#ec4899', gradient: 'from-pink-600 to-rose-700', features: ['My riders management', 'Wallet & collections', 'Support tickets', 'Lead tracking', 'Personal performance'], path: '/login' },
];

const STATS = [
    { value: 500, suffix: '+', label: 'Active Riders', icon: Users, color: '#6366f1' },
    { value: 4, suffix: '', label: 'Portal Levels', icon: Shield, color: '#10b981' },
    { value: 99, suffix: '.9%', label: 'Uptime', icon: Zap, color: '#f59e0b' },
    { value: 24, suffix: '/7', label: 'AI Support', icon: Bot, color: '#ec4899' },
];

const LandingPage: React.FC = () => {
    const [loginModalOpen, setLoginModalOpen] = useState(false);
    const [navScrolled, setNavScrolled] = useState(false);
    const { scrollY } = useScroll();
    const heroY = useTransform(scrollY, [0, 600], [0, -120]);
    const mockupY = useTransform(scrollY, [0, 500], [0, -60]);
    const mockupRotate = useTransform(scrollY, [0, 500], [-6, 0]);

    useEffect(() => {
        const unsub = scrollY.on('change', v => setNavScrolled(v > 20));
        return () => unsub();
    }, [scrollY]);

    return (
        <div className="min-h-[100dvh] text-white selection:bg-indigo-500/30 overflow-x-hidden">
            <LandingBackground />

            {/* ── Navbar ─────────────────────────────────────────────────────── */}
            <motion.nav
                className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 lg:px-8 transition-all duration-300"
                style={{ background: navScrolled ? 'rgba(5,5,20,0.85)' : 'transparent', backdropFilter: navScrolled ? 'blur(20px)' : 'none', borderBottom: navScrolled ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
                initial={{ y: -60, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
                <div className="max-w-7xl mx-auto flex items-center justify-between h-16">
                    {/* Logo */}
                    <a href="#" className="flex items-center gap-3 group">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-base shadow-lg transition-transform group-hover:scale-105"
                            style={{ background: 'linear-gradient(135deg, #6366f1, #7c3aed)' }}>T</div>
                        <div>
                            <span className="font-black text-base text-white">Triev Fleet</span>
                            <span className="ml-2 text-[9px] font-black uppercase tracking-widest text-indigo-400/70 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">v2.5</span>
                        </div>
                    </a>

                    {/* Nav links — including Home */}
                    <div className="hidden md:flex items-center gap-6 text-sm">
                        <a href="#" className="flex items-center gap-1.5 text-white font-medium hover:text-indigo-400 transition-colors">
                            <Home size={15} />
                            Home
                        </a>
                        {['Features', 'Portals', 'Security'].map(link => (
                            <a key={link} href={`#${link.toLowerCase()}`}
                                className="text-white/50 hover:text-white transition-colors font-medium">{link}</a>
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 sm:gap-3">
                        <button
                            onClick={() => setLoginModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl font-black text-sm text-white transition-all hover:scale-105 active:scale-95 shadow-lg"
                            style={{ background: 'linear-gradient(135deg, #6366f1, #7c3aed)', boxShadow: '0 4px 16px rgba(99,102,241,0.35)' }}
                        >
                            <LogIn size={15} />
                            Sign In
                        </button>
                    </div>
                </div>
            </motion.nav>

            {/* ── HERO ───────────────────────────────────────────────────────── */}
            <section className="min-h-[100dvh] flex flex-col items-center justify-center px-4 sm:px-6 pt-24 pb-16 relative overflow-hidden">
                <motion.div className="text-center max-w-4xl mx-auto relative z-10" style={{ y: heroY }}>
                    {/* Badge */}
                    <motion.div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] mb-6 backdrop-blur-sm"
                        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
                        <motion.div className="w-2 h-2 rounded-full bg-emerald-400"
                            animate={{ scale: [1, 1.5, 1], opacity: [0.7, 1, 0.7] }} transition={{ duration: 2, repeat: Infinity }} />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">EV Fleet Management Platform</span>
                    </motion.div>

                    {/* Headline */}
                    <motion.h1
                        className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.05] mb-6"
                        initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}
                    >
                        Smart Fleet<br />
                        <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">Management</span><br />
                        <span className="text-white/90">Powered by AI</span>
                    </motion.h1>

                    {/* Sub */}
                    <motion.p className="text-slate-400 text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 0.7 }}>
                        Complete EV rider lifecycle platform — wallet management, AI outbound calls, multi-level performance dashboards, and real-time analytics for your entire fleet.
                    </motion.p>

                    {/* CTA Buttons */}
                    <motion.div className="flex flex-col sm:flex-row items-center justify-center gap-4"
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.6 }}>
                        <button
                            onClick={() => setLoginModalOpen(true)}
                            className="flex items-center gap-2.5 px-8 py-4 rounded-2xl font-black text-base text-white shadow-2xl transition-all hover:scale-105 active:scale-95 group relative overflow-hidden"
                            style={{ background: 'linear-gradient(135deg, #6366f1, #7c3aed)', boxShadow: '0 8px 32px rgba(99,102,241,0.45)' }}
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                            <LogIn size={18} />
                            Access Portal
                            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                        <a href="#features"
                            className="flex items-center gap-2 px-6 py-4 rounded-2xl font-bold text-sm text-white/70 hover:text-white border border-white/10 hover:border-white/20 bg-white/[0.03] hover:bg-white/[0.06] transition-all">
                            <Play size={15} className="text-indigo-400" />
                            See Features
                        </a>
                    </motion.div>

                    {/* Trust badges */}
                    <motion.div className="flex items-center justify-center gap-6 mt-8 flex-wrap"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
                        {['Supabase Secured', 'Role-Based Access', 'Real-time Sync', 'PWA Ready'].map(badge => (
                            <div key={badge} className="flex items-center gap-1.5 text-[11px] text-white/35 font-medium">
                                <CheckCircle2 size={11} className="text-emerald-500/60" />
                                {badge}
                            </div>
                        ))}
                    </motion.div>
                </motion.div>

                {/* 3D Dashboard Mockup */}
                <motion.div
                    className="relative mt-16 w-full max-w-4xl mx-auto"
                    style={{ y: mockupY, rotateX: mockupRotate, transformStyle: 'preserve-3d', perspective: 1200 }}
                    initial={{ opacity: 0, y: 60, rotateX: -15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
                >
                    {/* Glow under */}
                    <div className="absolute -bottom-8 left-1/4 right-1/4 h-16 blur-3xl"
                        style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.4), rgba(124,58,237,0.4))' }} />
                    <div className="absolute -inset-[1px] rounded-2xl"
                        style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.4), rgba(16,185,129,0.2), rgba(245,158,11,0.2))' }} />

                    {/* Dashboard Preview (CSS only — no real screenshot needed) */}
                    <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] shadow-2xl"
                        style={{ background: 'rgba(8,8,30,0.9)', backdropFilter: 'blur(20px)' }}>
                        {/* Window bar */}
                        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.05]"
                            style={{ background: 'rgba(255,255,255,0.02)' }}>
                            <div className="w-3 h-3 rounded-full bg-red-500/70" />
                            <div className="w-3 h-3 rounded-full bg-amber-500/70" />
                            <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
                            <div className="flex-1 mx-3 h-5 rounded-full border border-white/[0.06] flex items-center px-3">
                                <span className="text-[9px] text-white/20 font-mono">fleet.triev.in/portal</span>
                            </div>
                        </div>

                        {/* Mock dashboard content */}
                        <div className="flex h-[320px] sm:h-[400px]">
                            {/* Sidebar */}
                            <div className="hidden sm:flex w-16 flex-col items-center py-4 gap-4 border-r border-white/[0.04]"
                                style={{ background: 'rgba(6,6,22,0.8)' }}>
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#6366f1,#7c3aed)' }}>
                                    <span className="text-white font-black text-xs">A</span>
                                </div>
                                {[LayoutDashboard, Users, BarChart3, Bot, Trophy].map((Icon, i) => (
                                    <div key={i} className={`w-8 h-8 rounded-lg flex items-center justify-center ${i === 0 ? 'bg-indigo-500/20' : 'hover:bg-white/5'}`}>
                                        <Icon size={15} className={i === 0 ? 'text-indigo-400' : 'text-white/20'} />
                                    </div>
                                ))}
                            </div>

                            {/* Main area */}
                            <div className="flex-1 p-4 overflow-hidden">
                                {/* Stats row */}
                                <div className="grid grid-cols-3 gap-3 mb-4">
                                    {[
                                        { label: 'Active Riders', val: '142', color: '#6366f1', icon: Users },
                                        { label: 'Collection', val: '₹2.4L', color: '#10b981', icon: Wallet },
                                        { label: 'AI Calls', val: '38 Today', color: '#f59e0b', icon: Bot },
                                    ].map((s, i) => (
                                        <motion.div key={i}
                                            className="rounded-xl p-3 border border-white/[0.04]"
                                            style={{ background: `${s.color}0d` }}
                                            animate={{ opacity: [0.7, 1, 0.7] }}
                                            transition={{ duration: 3 + i, repeat: Infinity, ease: 'easeInOut' }}>
                                            <s.icon size={14} style={{ color: s.color }} className="mb-1" />
                                            <p className="text-white font-black text-sm">{s.val}</p>
                                            <p className="text-white/30 text-[9px]">{s.label}</p>
                                        </motion.div>
                                    ))}
                                </div>

                                {/* Mock table */}
                                <div className="rounded-xl border border-white/[0.04] overflow-hidden">
                                    <div className="px-3 py-2 border-b border-white/[0.04] flex items-center gap-2"
                                        style={{ background: 'rgba(255,255,255,0.02)' }}>
                                        <span className="text-white/40 text-[10px] font-black uppercase tracking-widest">Rider Management</span>
                                        <div className="ml-auto flex gap-1">
                                            <div className="w-12 h-4 rounded-full bg-white/[0.04]" />
                                            <div className="w-8 h-4 rounded-full bg-indigo-500/20" />
                                        </div>
                                    </div>
                                    {[
                                        { name: 'Ravi Kumar', id: 'TR-001', balance: '+₹1,200', active: true, color: '#22c55e' },
                                        { name: 'Suresh Yadav', id: 'TR-002', balance: '-₹450', active: false, color: '#ef4444' },
                                        { name: 'Amit Singh', id: 'TR-003', balance: '+₹890', active: true, color: '#22c55e' },
                                        { name: 'Prakash Verma', id: 'TR-004', balance: '₹120', active: true, color: '#f59e0b' },
                                    ].map((r, i) => (
                                        <div key={i} className="flex items-center gap-3 px-3 py-2 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                                            <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[9px] font-black shrink-0"
                                                style={{ background: `hsl(${r.name.charCodeAt(0) * 40 % 360}, 60%, 40%)` }}>
                                                {r.name.charAt(0)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-white/80 text-[10px] font-bold truncate">{r.name}</p>
                                                <p className="text-white/25 text-[8px]">{r.id}</p>
                                            </div>
                                            <span className="text-[10px] font-black" style={{ color: r.color }}>{r.balance}</span>
                                            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: r.active ? '#22c55e' : '#ef4444' }} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Scroll indicator */}
                <motion.div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
                    animate={{ y: [0, 8, 0] }} transition={{ duration: 2, repeat: Infinity }}>
                    <span className="text-[10px] text-white/30 font-mono uppercase tracking-widest">Scroll to explore</span>
                    <ChevronDown size={16} className="text-white/20" />
                </motion.div>
            </section>

            {/* ── STATS ──────────────────────────────────────────────────────── */}
            <section className="py-16 px-4 sm:px-6 relative">
                <div className="max-w-5xl mx-auto">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {STATS.map((stat, i) => (
                            <motion.div key={i}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1, duration: 0.5 }}
                                className="text-center p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02]"
                            >
                                <div className="w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center"
                                    style={{ background: `${stat.color}20`, border: `1px solid ${stat.color}30` }}>
                                    <stat.icon size={18} style={{ color: stat.color }} />
                                </div>
                                <p className="text-3xl font-black text-white mb-1" style={{ color: stat.color }}>
                                    <Counter target={stat.value} suffix={stat.suffix} />
                                </p>
                                <p className="text-white/40 text-xs font-medium">{stat.label}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── FEATURES ───────────────────────────────────────────────────── */}
            <section id="features" className="py-20 px-4 sm:px-6 relative">
                <div className="max-w-6xl mx-auto">
                    <motion.div className="text-center mb-14"
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-widest mb-4">
                            <Sparkles size={10} /> Platform Features
                        </div>
                        <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">Everything You Need to Manage Your Fleet</h2>
                        <p className="text-slate-400 max-w-xl mx-auto">From rider onboarding to AI-powered collection calls — every tool your operations team needs, unified in one platform.</p>
                    </motion.div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {FEATURES.map((feat, i) => (
                            <FeatureCard key={i} {...feat} />
                        ))}
                    </div>
                </div>
            </section>

            {/* ── PORTALS ────────────────────────────────────────────────────── */}
            <section id="portals" className="py-20 px-4 sm:px-6 relative">
                <div className="max-w-6xl mx-auto">
                    <motion.div className="text-center mb-14"
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-widest mb-4">
                            <Shield size={10} /> Role-Based Portals
                        </div>
                        <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">One Platform, Four Power Levels</h2>
                        <p className="text-slate-400 max-w-xl mx-auto">Each role gets exactly the tools and visibility they need — no more, no less.</p>
                    </motion.div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                        {ROLES.map((role, i) => (
                            <motion.div key={i}
                                initial={{ opacity: 0, y: 40 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                                className="group relative rounded-2xl p-5 border border-white/[0.06] hover:border-white/[0.14] transition-all duration-300 flex flex-col"
                                style={{ background: 'rgba(255,255,255,0.025)' }}
                            >
                                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${role.gradient} flex items-center justify-center mb-4 shadow-lg`}>
                                    <role.icon size={22} className="text-white" />
                                </div>
                                <h3 className="font-black text-white text-lg mb-0.5">{role.label}</h3>
                                <p className="text-xs font-medium mb-4" style={{ color: role.color }}>{role.sub}</p>
                                <ul className="space-y-1.5 flex-1 mb-5">
                                    {role.features.map((f, j) => (
                                        <li key={j} className="flex items-center gap-2 text-[11px] text-slate-400">
                                            <CheckCircle2 size={10} style={{ color: role.color }} className="shrink-0" />
                                            {f}
                                        </li>
                                    ))}
                                </ul>
                                <Link to={role.path}
                                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-xs text-white transition-all hover:opacity-90"
                                    style={{ background: `linear-gradient(135deg, ${role.color}cc, ${role.color}99)` }}
                                >
                                    Access Portal <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                                </Link>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── SECURITY SECTION ───────────────────────────────────────────── */}
            <section id="security" className="py-20 px-4 sm:px-6 relative">
                <div className="max-w-4xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="rounded-3xl p-8 sm:p-12 border border-white/[0.07] relative overflow-hidden"
                        style={{ background: 'rgba(99,102,241,0.05)' }}
                    >
                        <div className="absolute top-0 left-1/4 right-1/4 h-[1px]"
                            style={{ background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.5), transparent)' }} />

                        <div className="text-center mb-8">
                            <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                                style={{ background: 'linear-gradient(135deg, #6366f1, #7c3aed)' }}>
                                <Shield size={26} className="text-white" />
                            </div>
                            <h2 className="text-3xl font-black text-white mb-3">Enterprise-Grade Security</h2>
                            <p className="text-slate-400">Your fleet data is protected at every layer.</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {[
                                { icon: Lock, title: 'Supabase RLS', desc: 'Row-Level Security enforced at database level — each user sees only their authorized data' },
                                { icon: Shield, title: 'Role-Based Access', desc: 'Strict permissions — Admin, City Ops, RM, TL each have scoped access only' },
                                { icon: Zap, title: 'JWT Auth Sessions', desc: 'Secure Supabase JWT tokens with auto-refresh and session expiry management' },
                                { icon: Globe, title: 'HTTPS Enforced', desc: 'All traffic encrypted via Vercel HTTPS — no plain HTTP connections allowed' },
                                { icon: Bell, title: 'Audit Logs', desc: 'Complete activity logging — every critical action is timestamped and stored' },
                                { icon: Star, title: 'No Data Leaks', desc: 'Diagnostic info removed from production; register page disabled by default' },
                            ].map((item, i) => (
                                <motion.div key={i}
                                    initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: i * 0.08 }}
                                    className="flex items-start gap-3 p-4 rounded-xl border border-white/[0.05] bg-white/[0.02]"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center shrink-0">
                                        <item.icon size={15} className="text-indigo-400" />
                                    </div>
                                    <div>
                                        <p className="font-black text-sm text-white mb-0.5">{item.title}</p>
                                        <p className="text-[11px] text-slate-500 leading-relaxed">{item.desc}</p>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* ── CTA SECTION ────────────────────────────────────────────────── */}
            <section className="py-20 px-4 sm:px-6">
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="max-w-2xl mx-auto text-center"
                >
                    <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">Ready to Take Control of Your Fleet?</h2>
                    <p className="text-slate-400 mb-8">Join the Triev ecosystem — smarter fleet management starts here.</p>
                    <button
                        onClick={() => setLoginModalOpen(true)}
                        className="inline-flex items-center gap-3 px-10 py-4 rounded-2xl font-black text-base text-white shadow-2xl transition-all hover:scale-105 active:scale-95 group relative overflow-hidden"
                        style={{ background: 'linear-gradient(135deg, #6366f1, #7c3aed)', boxShadow: '0 12px 40px rgba(99,102,241,0.45)' }}
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                        <LogIn size={20} />
                        Sign In to Your Portal
                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                </motion.div>
            </section>

            {/* ── FOOTER ─────────────────────────────────────────────────────── */}
            <footer className="py-8 px-4 sm:px-6 border-t border-white/[0.05]">
                <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-black text-xs"
                            style={{ background: 'linear-gradient(135deg, #6366f1, #7c3aed)' }}>T</div>
                        <span className="text-white/40 text-xs font-medium">Triev Fleet Manager</span>
                    </div>
                    <p className="text-white/20 text-[10px] font-mono">© 2026 Triev Rider Technologies · v2.5.0 · All rights reserved</p>
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span className="text-[10px] text-emerald-500/50 font-mono uppercase tracking-widest">All Systems Online</span>
                    </div>
                </div>
            </footer>

            {/* Login Modal */}
            <AnimatePresence>
                {loginModalOpen && <LoginChoiceModal onClose={() => setLoginModalOpen(false)} />}
            </AnimatePresence>
        </div>
    );
};

export default LandingPage;
