import React from 'react';
import { motion } from 'framer-motion';

interface AnimatedBackgroundProps {
    variant?: 'login' | 'register' | 'admin' | 'rm';
}

const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({ variant = 'login' }) => {
    const colorMap = {
        login:    { orb1: '#ea580c', orb2: '#d946ef', orb3: '#2563eb', orb4: '#fb923c', particle: '#f97316', accent: '#fb923c' },
        register: { orb1: '#ea580c', orb2: '#d946ef', orb3: '#2563eb', orb4: '#fb923c', particle: '#f97316', accent: '#fb923c' },
        admin:    { orb1: '#b91c1c', orb2: '#7f1d1d', orb3: '#450a0a', orb4: '#dc2626', particle: '#ef4444', accent: '#f87171' },
        rm:       { orb1: '#0d9488', orb2: '#0f766e', orb3: '#134e4a', orb4: '#14b8a6', particle: '#2dd4bf', accent: '#5eead4' },
    };
    const colors = colorMap[variant] || colorMap.login;

    const meshGradients: Record<string, string> = {
        login:    'bg-[radial-gradient(at_0%_0%,_#ea580c_0,_transparent_50%),_radial-gradient(at_80%_10%,_#d946ef_0,_transparent_40%),_radial-gradient(at_30%_100%,_#1d4ed8_0,_transparent_50%)]',
        register: 'bg-[radial-gradient(at_0%_0%,_#ea580c_0,_transparent_50%),_radial-gradient(at_80%_10%,_#d946ef_0,_transparent_40%),_radial-gradient(at_30%_100%,_#1d4ed8_0,_transparent_50%)]',
        admin:    'bg-[radial-gradient(at_0%_0%,_#b91c1c_0,_transparent_50%),_radial-gradient(at_80%_0%,_#7f1d1d_0,_transparent_40%),_radial-gradient(at_50%_100%,_#1c1917_0,_transparent_60%)]',
        rm:       'bg-[radial-gradient(at_0%_20%,_#0d9488_0,_transparent_50%),_radial-gradient(at_80%_0%,_#0f766e_0,_transparent_40%),_radial-gradient(at_40%_100%,_#042f2e_0,_transparent_55%)]',
    };

    const particles = Array.from({ length: 30 }, (_, i) => i);

    return (
        <div className="fixed inset-0 -z-10 overflow-hidden bg-slate-950">
            {/* Mesh Gradient Layer */}
            <div className={`absolute inset-0 opacity-50 ${meshGradients[variant] || meshGradients.login}`} />

            {/* Animated Orb 1 — top-left */}
            <motion.div
                className="absolute -top-40 -left-40 rounded-full filter blur-[100px] opacity-25"
                style={{ width: 600, height: 600, background: colors.orb1 }}
                animate={{ x: [0, 60, -20, 0], y: [0, -40, 60, 0], scale: [1, 1.15, 0.95, 1] }}
                transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
            />
            {/* Animated Orb 2 — mid-right */}
            <motion.div
                className="absolute top-1/3 -right-32 rounded-full filter blur-[90px] opacity-20"
                style={{ width: 500, height: 500, background: colors.orb2 }}
                animate={{ x: [0, -50, 30, 0], y: [0, 60, -30, 0], scale: [1, 0.9, 1.1, 1] }}
                transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
            />
            {/* Animated Orb 3 — bottom-center */}
            <motion.div
                className="absolute -bottom-40 left-1/4 rounded-full filter blur-[120px] opacity-15"
                style={{ width: 700, height: 700, background: colors.orb3 }}
                animate={{ x: [0, 80, -40, 0], y: [0, -60, 20, 0], scale: [1, 1.2, 0.9, 1] }}
                transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut', delay: 7 }}
            />
            {/* Animated Orb 4 — subtle center float */}
            <motion.div
                className="absolute top-1/4 left-1/3 rounded-full filter blur-[140px] opacity-10 pointer-events-none"
                style={{ width: 800, height: 800, background: colors.orb4 }}
                animate={{ x: [0, -60, 40, 0], y: [0, 50, -50, 0], scale: [1, 1.3, 0.8, 1] }}
                transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut', delay: 10 }}
            />

            {/* Glowing accent ring */}
            <motion.div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border opacity-10"
                style={{ width: 800, height: 800, borderColor: colors.accent }}
                animate={{ scale: [0.8, 1.1, 0.8], opacity: [0.05, 0.12, 0.05], rotate: [0, 180, 360] }}
                transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
            />

            {/* Floating Particles */}
            {particles.map((i) => (
                <motion.div
                    key={i}
                    className="absolute rounded-full"
                    style={{
                        width: Math.random() * 3 + 1.5,
                        height: Math.random() * 3 + 1.5,
                        left: `${(i * 5 + Math.random() * 5) % 100}%`,
                        top: `${(i * 5.5 + Math.random() * 10) % 100}%`,
                        background: colors.particle,
                        boxShadow: `0 0 10px ${colors.particle}`,
                        opacity: 0.3 + Math.random() * 0.4,
                    }}
                    animate={{
                        y: [0, -(35 + i * 4), 0],
                        x: [0, (i % 2 === 0 ? 15 : -15), 0],
                        opacity: [0.15, 0.75, 0.15],
                        scale: [1, 1.8, 1],
                    }}
                    transition={{
                        duration: 5 + i * 0.4,
                        repeat: Infinity,
                        ease: 'easeInOut',
                        delay: i * 0.25,
                    }}
                />
            ))}

            {/* Fine Grid Pattern (Animated) */}
            <motion.div 
                className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,white_30%,transparent_80%)]" 
                animate={{ backgroundPosition: ['0px 0px', '64px 64px'] }}
                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            />

            {/* Bottom Vignette */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-70" />
            {/* Top Vignette */}
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/40 via-transparent to-transparent" />
        </div>
    );
};

export default AnimatedBackground;
