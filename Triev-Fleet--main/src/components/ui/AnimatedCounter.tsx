import React, { useEffect, useState } from 'react';

interface AnimatedCounterProps {
    value: number;
    prefix?: string;
    suffix?: string;
    decimals?: number;
    className?: string;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
    value,
    prefix = '',
    suffix = '',
    decimals = 0,
    className = ''
}) => {
    const [displayValue, setDisplayValue] = useState(value);

    useEffect(() => {
        let startTimestamp: number | null = null;
        const duration = 800; // 0.8s
        const startValue = displayValue;
        const endValue = value;

        if (startValue === endValue) return;

        const step = (timestamp: number) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            const current = startValue + (endValue - startValue) * easeProgress;

            setDisplayValue(current);

            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };

        const animationFrame = window.requestAnimationFrame(step);
        return () => window.cancelAnimationFrame(animationFrame);
    }, [value]);

    const formattedNumber = displayValue.toLocaleString('en-IN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });

    return (
        <span className={`inline-block font-mono tracking-tight ${className}`}>
            {prefix}{formattedNumber}{suffix}
        </span>
    );
};

export default AnimatedCounter;
