import React, { useState, useRef, useEffect, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';

const TooltipContext = createContext<{
    open: boolean;
    setOpen: (open: boolean) => void;
    triggerRef: React.RefObject<HTMLElement>;
}>({
    open: false,
    setOpen: () => { },
    triggerRef: { current: null } as any
});

export const TooltipProvider = ({ children }: { children: React.ReactNode; delayDuration?: number }) => {
    return <>{children}</>;
};

export const Tooltip = ({ children }: { children: React.ReactNode }) => {
    const [open, setOpen] = useState(false);
    const triggerRef = useRef<HTMLElement>(null);

    return (
        <TooltipContext.Provider value={{ open, setOpen, triggerRef: triggerRef as any }}>
            {children}
        </TooltipContext.Provider>
    );
};

export const TooltipTrigger = ({ children, className }: { children: React.ReactNode; className?: string; asChild?: boolean }) => {
    const { setOpen, triggerRef } = useContext(TooltipContext);

    return (
        <div
            ref={triggerRef as any}
            className={className}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
        >
            {children}
        </div>
    );
};

export const TooltipContent = ({ children, className, side = 'top' }: { children: React.ReactNode; className?: string; side?: 'top' | 'bottom' | 'left' | 'right' }) => {
    const { open, triggerRef } = useContext(TooltipContext);
    const [position, setPosition] = useState({ top: 0, left: 0 });

    useEffect(() => {
        if (open && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            const scrollY = window.scrollY;
            const scrollX = window.scrollX;

            let top = rect.top + scrollY;
            let left = rect.left + scrollX + rect.width / 2;

            if (side === 'top') {
                top -= 10;
            } else if (side === 'bottom') {
                top += rect.height + 10;
            }

            setPosition({ top, left });
        }
    }, [open, side, triggerRef]);

    if (!open) return null;

    return createPortal(
        <div
            className={`fixed z-50 px-3 py-1.5 text-xs text-white bg-black rounded-md shadow-md animate-in fade-in zoom-in-95 duration-200 ${className}`}
            style={{
                top: position.top,
                left: position.left,
                transform: 'translate(-50%, -50%)', // Centered horizontally usually, but vertical depends
                marginTop: side === 'bottom' ? '0' : '-100%', // Simple hack for positioning
            }}
        >
            {children}
        </div>,
        document.body
    );
};
