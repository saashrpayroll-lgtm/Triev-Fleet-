import React from 'react';
// Utility import removed as it does not exist

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
    hoverEffect?: boolean;
    overflowVisible?: boolean;
}

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
    ({ children, className, onClick, hoverEffect = false, ...props }, ref) => {
        return (
            <div
                ref={ref}
                onClick={onClick}
                className={`
                    relative ${props.overflowVisible ? 'overflow-visible' : 'overflow-hidden'} rounded-xl border border-white/10 bg-white/5 backdrop-blur-md shadow-lg
                    ${hoverEffect ? 'hover:bg-white/10 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer' : ''}
                    ${className || ''}
                `}
                {...props}
            >
                {/* Optional: Add a subtle gradient overlay or noise texture here if desired for more "premium" feel */}
                <div className="relative z-10 p-6 h-full">
                    {children}
                </div>

                {/* Decorative blob for branding color hint (optional) */}
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
            </div>
        );
    }
);

GlassCard.displayName = 'GlassCard';

export default GlassCard;
