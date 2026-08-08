import React from 'react';
import { RiskLevel, riskLevelColors } from '@/utils/riskScore';
import { ShieldAlert, ShieldCheck, AlertTriangle, AlertOctagon } from 'lucide-react';

interface RiskBadgeProps {
    level: RiskLevel;
    score: number;
    size?: 'sm' | 'md';
    showScore?: boolean;
    className?: string;
}

const levelIcons: Record<RiskLevel, React.ElementType> = {
    low: ShieldCheck,
    medium: AlertTriangle,
    high: AlertOctagon,
    critical: ShieldAlert,
};

const levelLabels: Record<RiskLevel, string> = {
    low: 'Low Risk',
    medium: 'Medium',
    high: 'High Risk',
    critical: 'Critical',
};

/**
 * Compact risk badge for inline display in tables and cards.
 * Shows colored icon + label + optional numeric score.
 */
const RiskBadge: React.FC<RiskBadgeProps> = ({
    level,
    score,
    size = 'sm',
    showScore = false,
    className = '',
}) => {
    const colors = riskLevelColors[level];
    const Icon = levelIcons[level];
    const isSmall = size === 'sm';

    return (
        <span
            className={`
                inline-flex items-center gap-1 rounded-full border font-bold
                ${colors.text} ${colors.bg} ${colors.border}
                ${isSmall ? 'px-2 py-0.5 text-[9px]' : 'px-2.5 py-1 text-[10px]'}
                ${level === 'critical' ? 'animate-pulse' : ''}
                ${className}
            `}
        >
            <Icon size={isSmall ? 10 : 12} />
            <span className="uppercase tracking-wider">{levelLabels[level]}</span>
            {showScore && (
                <span className="ml-0.5 opacity-70">{score}</span>
            )}
        </span>
    );
};

export default RiskBadge;
