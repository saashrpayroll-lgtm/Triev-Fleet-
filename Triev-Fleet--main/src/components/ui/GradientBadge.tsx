import React from 'react';

interface GradientBadgeProps {
    children: React.ReactNode;
    variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'violet' | 'amber';
    size?: 'sm' | 'md' | 'lg';
    pulse?: boolean;
    className?: string;
}

export const GradientBadge: React.FC<GradientBadgeProps> = ({
    children,
    variant = 'primary',
    size = 'md',
    pulse = false,
    className = ''
}) => {
    const variants = {
        primary: 'bg-gradient-to-r from-indigo-500/15 via-purple-500/15 to-violet-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
        success: 'bg-gradient-to-r from-emerald-500/15 to-teal-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
        warning: 'bg-gradient-to-r from-amber-500/15 to-orange-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
        danger: 'bg-gradient-to-r from-rose-500/15 to-red-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
        info: 'bg-gradient-to-r from-sky-500/15 to-blue-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30',
        violet: 'bg-gradient-to-r from-violet-600/20 to-purple-600/20 text-violet-600 dark:text-violet-300 border-violet-500/40',
        amber: 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40',
    };

    const sizes = {
        sm: 'px-2 py-0.5 text-[10px]',
        md: 'px-2.5 py-1 text-xs',
        lg: 'px-3.5 py-1.5 text-sm',
    };

    return (
        <span
            className={`inline-flex items-center gap-1.5 font-bold uppercase tracking-wider rounded-full border backdrop-blur-md shadow-sm transition-all duration-200 ${variants[variant]} ${sizes[size]} ${
                pulse ? 'animate-pulse' : ''
            } ${className}`}
        >
            {children}
        </span>
    );
};

export default GradientBadge;
