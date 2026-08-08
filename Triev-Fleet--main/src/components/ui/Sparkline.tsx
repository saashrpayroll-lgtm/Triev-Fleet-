import React from 'react';

interface SparklineProps {
    data: number[];
    color?: string;
    width?: number;
    height?: number;
    strokeWidth?: number;
    showDot?: boolean;
    showArea?: boolean;
    className?: string;
}

/**
 * A tiny SVG sparkline chart for stat cards.
 * Pure SVG, zero dependencies, dark-mode compatible.
 */
const Sparkline: React.FC<SparklineProps> = ({
    data,
    color = 'currentColor',
    width = 60,
    height = 24,
    strokeWidth = 1.5,
    showDot = true,
    showArea = true,
    className = '',
}) => {
    if (!data || data.length < 2) return null;

    const padding = 2;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const points = data.map((value, index) => ({
        x: padding + (index / (data.length - 1)) * chartWidth,
        y: padding + chartHeight - ((value - min) / range) * chartHeight,
    }));

    const linePath = points
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
        .join(' ');

    const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${height - padding} L ${points[0].x.toFixed(1)} ${height - padding} Z`;

    const lastPoint = points[points.length - 1];
    const gradientId = `sparkline-grad-${Math.random().toString(36).slice(2, 8)}`;

    return (
        <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className={`flex-shrink-0 ${className}`}
            aria-hidden="true"
        >
            <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
            </defs>

            {showArea && (
                <path
                    d={areaPath}
                    fill={`url(#${gradientId})`}
                />
            )}

            <path
                d={linePath}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {showDot && lastPoint && (
                <>
                    <circle
                        cx={lastPoint.x}
                        cy={lastPoint.y}
                        r={2.5}
                        fill={color}
                        opacity={0.3}
                    >
                        <animate
                            attributeName="r"
                            values="2.5;4;2.5"
                            dur="2s"
                            repeatCount="indefinite"
                        />
                    </circle>
                    <circle
                        cx={lastPoint.x}
                        cy={lastPoint.y}
                        r={1.5}
                        fill={color}
                    />
                </>
            )}
        </svg>
    );
};

export default Sparkline;
