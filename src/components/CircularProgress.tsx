import React from 'react';

interface CircularProgressProps {
    value: number;
    max: number;
    size?: number;
    strokeWidth?: number;
    color?: string; // Hex or tailwind class fragment
    label?: string;
    subLabel?: string;
    icon?: React.ReactNode;
}

const CircularProgress: React.FC<CircularProgressProps> = ({
    value,
    max,
    size = 120,
    strokeWidth = 10,
    color = "text-primary",
    label,
    subLabel,
    icon
}) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const progress = Math.min(Math.max(value / max, 0), 1);
    const dashoffset = circumference - progress * circumference;

    return (
        <div className="relative flex flex-col items-center justify-center p-4 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 group hover:-translate-y-1">
            <div className="relative" style={{ width: size, height: size }}>
                {/* Background Circle */}
                <svg width={size} height={size} className="transform -rotate-90">
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke="currentColor"
                        strokeWidth={strokeWidth}
                        fill="transparent"
                        className="text-muted/20"
                    />
                    {/* Progress Circle */}
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke="currentColor"
                        strokeWidth={strokeWidth}
                        fill="transparent"
                        strokeDasharray={circumference}
                        strokeDashoffset={dashoffset}
                        strokeLinecap="round"
                        className={`${color} transition-all duration-1000 ease-out`}
                    />
                </svg>

                {/* Center Content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    {icon && <div className={`mb-1 ${color} opacity-80`}>{icon}</div>}
                    <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                        {value}
                    </span>
                </div>
            </div>

            {/* Labels */}
            <div className="mt-3 text-center">
                <p className="font-semibold text-sm tracking-wide text-foreground/90">{label}</p>
                {subLabel && <p className="text-xs text-muted-foreground mt-0.5">{subLabel}</p>}
            </div>
        </div>
    );
};

export default CircularProgress;
