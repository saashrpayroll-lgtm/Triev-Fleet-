import React from 'react';

interface AnimatedBackgroundProps {
    variant?: 'login' | 'register' | 'admin';
}

const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({ variant = 'login' }) => {
    return (
        <div className="fixed inset-0 -z-10 overflow-hidden bg-slate-950">
            {/* Dynamic Mesh Gradients */}
            <div className={`absolute inset-0 transition-opacity duration-1000 opacity-40 ${variant === 'login' ? 'bg-[radial-gradient(at_0%_0%,_#f97316_0,_transparent_50%),_radial-gradient(at_50%_0%,_#f43f5e_0,_transparent_50%),_radial-gradient(at_100%_0%,_#8b5cf6_0,_transparent_50%)]' :
                    variant === 'register' ? 'bg-[radial-gradient(at_0%_0%,_#06b6d4_0,_transparent_50%),_radial-gradient(at_50%_0%,_#3b82f6_0,_transparent_50%),_radial-gradient(at_100%_0%,_#10b981_0,_transparent_50%)]' :
                        'bg-[radial-gradient(at_0%_0%,_#b91c1c_0,_transparent_50%),_radial-gradient(at_50%_0%,_#7f1d1d_0,_transparent_50%),_radial-gradient(at_100%_0%,_#000000_0,_transparent_50%)]'
                }`} />

            {/* Floating Orbs with Blur */}
            <div className={`absolute -top-24 -left-20 w-[500px] h-[500px] rounded-full mix-blend-screen filter blur-[80px] opacity-20 animate-blob ${variant === 'admin' ? 'bg-red-600' : 'bg-orange-500'
                }`} />
            <div className={`absolute top-1/4 -right-20 w-[400px] h-[400px] rounded-full mix-blend-screen filter blur-[80px] opacity-20 animate-blob animation-delay-2000 ${variant === 'admin' ? 'bg-rose-900' : 'bg-fuchsia-600'
                }`} />
            <div className={`absolute -bottom-32 left-1/3 w-[600px] h-[600px] rounded-full mix-blend-screen filter blur-[100px] opacity-10 animate-blob animation-delay-4000 ${variant === 'admin' ? 'bg-zinc-900' : 'bg-blue-600'
                }`} />

            {/* Grid Pattern with Fade */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay"></div>
            <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:40px_40px] [mask-image:radial-gradient(white,transparent_85%)]"></div>

            {/* Glass Overlays */}
            <div className="absolute inset-0 backdrop-blur-[1px]"></div>

            {/* Dark Mask for Depth */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60"></div>
        </div>
    );
};

export default AnimatedBackground;
