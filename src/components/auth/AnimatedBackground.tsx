import React from 'react';

interface AnimatedBackgroundProps {
    variant?: 'login' | 'register' | 'admin';
}

const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({ variant = 'login' }) => {
    return (
        <div className="fixed inset-0 -z-10 overflow-hidden">
            {/* Gradient Background */}
            <div className={`absolute inset-0 bg-gradient-to-br ${variant === 'login' ? 'from-indigo-500 via-purple-500 to-pink-500' :
                    variant === 'register' ? 'from-blue-500 via-cyan-500 to-teal-500' :
                        'from-red-900 via-red-800 to-black' // Admin
                }`} />

            {/* Animated Blobs */}
            <div className={`absolute top-0 -left-4 w-72 h-72 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob ${variant === 'admin' ? 'bg-red-500' : 'bg-purple-300'
                }`} />
            <div className={`absolute top-0 -right-4 w-72 h-72 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000 ${variant === 'admin' ? 'bg-orange-500' : 'bg-yellow-300'
                }`} />
            <div className={`absolute -bottom-8 left-20 w-72 h-72 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000 ${variant === 'admin' ? 'bg-red-700' : 'bg-pink-300'
                }`} />

            {/* Grid Pattern Overlay */}
            <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:50px_50px]" />

            {/* Noise Texture */}
            <div className="absolute inset-0 opacity-20 mix-blend-overlay">
                <svg className="w-full h-full">
                    <filter id="noise">
                        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" />
                    </filter>
                    <rect width="100%" height="100%" filter="url(#noise)" />
                </svg>
            </div>
        </div>
    );
};

export default AnimatedBackground;
