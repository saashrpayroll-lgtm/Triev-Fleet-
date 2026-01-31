import React, { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
}

interface ToastProps {
    toast: Toast;
    onClose: (id: string) => void;
}

const ToastItem: React.FC<ToastProps> = ({ toast, onClose }) => {
    const [progress, setProgress] = useState(100);
    const [isVisible, setIsVisible] = useState(false);

    // Default duration: 4000ms
    const duration = toast.duration || 4000;
    const updateInterval = 10;

    useEffect(() => {
        // Trigger enter animation
        const timer = setTimeout(() => setIsVisible(true), 10);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        const startTime = Date.now();
        const endTime = startTime + duration;

        const timer = setInterval(() => {
            const now = Date.now();
            const remaining = Math.max(0, endTime - now);
            const percentage = (remaining / duration) * 100;

            setProgress(percentage);

            if (remaining === 0) {
                clearInterval(timer);
                handleClose();
            }
        }, updateInterval);

        return () => clearInterval(timer);
    }, [toast.id, duration]);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(() => onClose(toast.id), 300); // Wait for exit animation
    };

    const getColors = () => {
        switch (toast.type) {
            case 'success':
                return {
                    bg: 'bg-emerald-50 dark:bg-emerald-950',
                    border: 'border-emerald-200 dark:border-emerald-900',
                    text: 'text-emerald-800 dark:text-emerald-100',
                    icon: <CheckCircle className="text-emerald-500 dark:text-emerald-400" size={20} />,
                    progress: 'bg-emerald-500 dark:bg-emerald-400'
                };
            case 'error':
                return {
                    bg: 'bg-red-50 dark:bg-red-950',
                    border: 'border-red-200 dark:border-red-900',
                    text: 'text-red-800 dark:text-red-100',
                    icon: <AlertCircle className="text-red-500 dark:text-red-400" size={20} />,
                    progress: 'bg-red-500 dark:bg-red-400'
                };
            case 'warning':
                return {
                    bg: 'bg-amber-50 dark:bg-amber-950',
                    border: 'border-amber-200 dark:border-amber-900',
                    text: 'text-amber-800 dark:text-amber-100',
                    icon: <AlertTriangle className="text-amber-500 dark:text-amber-400" size={20} />,
                    progress: 'bg-amber-500 dark:bg-amber-400'
                };
            default:
                return {
                    bg: 'bg-blue-50 dark:bg-blue-950',
                    border: 'border-blue-200 dark:border-blue-900',
                    text: 'text-blue-800 dark:text-blue-100',
                    icon: <Info className="text-blue-500 dark:text-blue-400" size={20} />,
                    progress: 'bg-blue-500 dark:bg-blue-400'
                };
        }
    };

    const colors = getColors();

    return (
        <div
            className={`
                relative overflow-hidden rounded-lg border shadow-lg p-4 mb-3 transition-all duration-300 ease-in-out transform
                ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
                ${colors.bg} ${colors.border} w-80 md:w-96
            `}
        >
            <div className="flex gap-3 items-start">
                <div className="flex-shrink-0 pt-0.5">
                    {colors.icon}
                </div>
                <div className={`flex-1 text-sm font-medium ${colors.text}`}>
                    {toast.message}
                </div>
                <button
                    onClick={handleClose}
                    className={`flex-shrink-0 p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors ${colors.text}`}
                >
                    <X size={14} />
                </button>
            </div>

            {/* Progress Bar */}
            <div className="absolute bottom-0 left-0 h-1 bg-black/5 dark:bg-white/5 w-full">
                <div
                    className={`h-full transition-all duration-linear ease-linear ${colors.progress}`}
                    style={{ width: `${progress}%` }}
                />
            </div>
        </div>
    );
};

export default ToastItem;
