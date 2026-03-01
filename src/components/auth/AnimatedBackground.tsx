import React from 'react';
import { motion } from 'framer-motion';

interface AnimatedBackgroundProps {
    variant?: 'login' | 'register' | 'admin';
}

const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({ variant = 'login' }) => {
    const isAdmin = variant === 'admin';
    const colors = isAdmin
        ? { orb1: '#b91c1c', orb2: '#7f1d1d', orb3: '#450a0a', particle: '#ef4444' }
        : { orb1: '#ea580c', orb2: '#d946ef', orb3: '#2563eb', particle: '#f97316' };

    const particles = Array.from({ length: 18 }, (_, i) => i);

    return (
        <div className="fixed inset-0 -z-10 overflow-hidden bg-slate-950">
            {/* Mesh Gradient Layer */}
            <div className={`absolute inset-0 opacity-50 ${isAdmin
                ? 'bg-[radial-gradient(at_0%_0%,_#b91c1c_0,_transparent_50%),_radial-gradient(at_80%_0%,_#7f1d1d_0,_transparent_40%),_radial-gradient(at_50%_100%,_#1c1917_0,_transparent_60%)]'
                : 'bg-[radial-gradient(at_0%_0%,_#ea580c_0,_transparent_50%),_radial-gradient(at_80%_10%,_#d946ef_0,_transparent_40%),_radial-gradient(at_30%_100%,_#1d4ed8_0,_transparent_50%)]'
                }`} />

            {/* Animated Orb 1 */}
            <motion.div
                className="absolute -top-40 -left-40 rounded-full filter blur-[100px] opacity-25"
                style={{ width: 600, height: 600, background: colors.orb1 }}
                animate={{ x: [0, 60, -20, 0], y: [0, -40, 60, 0], scale: [1, 1.15, 0.95, 1] }}
                transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
            />
            {/* Animated Orb 2 */}
            <motion.div
                className="absolute top-1/3 -right-32 rounded-full filter blur-[90px] opacity-20"
                style={{ width: 500, height: 500, background: colors.orb2 }}
                animate={{ x: [0, -50, 30, 0], y: [0, 60, -30, 0], scale: [1, 0.9, 1.1, 1] }}
                transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
            />
            {/* Animated Orb 3 */}
            <motion.div
                className="absolute -bottom-40 left-1/4 rounded-full filter blur-[120px] opacity-15"
                style={{ width: 700, height: 700, background: colors.orb3 }}
                animate={{ x: [0, 80, -40, 0], y: [0, -60, 20, 0], scale: [1, 1.2, 0.9, 1] }}
                transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut', delay: 7 }}
            />

            {/* Floating Particles */}
            {particles.map((i) => (
                <motion.div
                    key={i}
                    className="absolute rounded-full"
                    style={{
                        width: Math.random() * 3 + 1,
                        height: Math.random() * 3 + 1,
                        left: `${(i * 5.5 + Math.random() * 5) % 100}%`,
                        top: `${(i * 7 + Math.random() * 10) % 100}%`,
                        background: colors.particle,
                        opacity: 0.3 + Math.random() * 0.4,
                    }}
                    animate={{
                        y: [0, -(30 + i * 4), 0],
                        opacity: [0.2, 0.7, 0.2],
                        scale: [1, 1.5, 1],
                    }}
                    transition={{
                        duration: 4 + i * 0.5,
                        repeat: Infinity,
                        ease: 'easeInOut',
                        delay: i * 0.3,
                    }}
                />
            ))}

            {/* Fine Grid Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,white_30%,transparent_80%)]" />

            {/* Subtle Noise */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.025] mix-blend-overlay" />

            {/* Bottom Vignette */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-70" />
            {/* Top Vignette */}
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/40 via-transparent to-transparent" />
        </div>
    );
};

export default AnimatedBackground;
