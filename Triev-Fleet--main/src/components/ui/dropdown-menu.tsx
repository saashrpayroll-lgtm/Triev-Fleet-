import React, { useState, useRef, useEffect, useContext } from 'react';

// Simple utility to join classes, replacing 'cn' from lib/utils
function cn(...classes: (string | undefined | null | false)[]) {
    return classes.filter(Boolean).join(' ');
}

interface DropdownContextType {
    open: boolean;
    setOpen: (open: boolean) => void;
}

const DropdownContext = React.createContext<DropdownContextType>({ open: false, setOpen: () => { } });

export const DropdownMenu: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <DropdownContext.Provider value={{ open, setOpen }}>
            <div ref={ref} className="relative inline-block text-left">
                {children}
            </div>
        </DropdownContext.Provider>
    );
};

export const DropdownMenuTrigger: React.FC<{ children: React.ReactNode; className?: string; asChild?: boolean }> = ({ children, className }) => {
    const { open, setOpen } = useContext(DropdownContext);

    // If asChild is true, we should strictly clone the element, but for now wrapping is safer for a quick fix
    // unless the formatting is strict. Let's just wrap in a div that handles the click.
    // To match Radix behavior better without 'asChild' complexity, we'll just require it to be a wrapper.

    return (
        <div onClick={(e) => { e.stopPropagation(); setOpen(!open); }} className={cn("cursor-pointer", className)}>
            {children}
        </div>
    );
};

interface DropdownMenuContentProps {
    children: React.ReactNode;
    align?: 'start' | 'end' | 'center';
    className?: string;
}

export const DropdownMenuContent: React.FC<DropdownMenuContentProps> = ({ children, align = 'start', className }) => {
    const { open } = useContext(DropdownContext);
    if (!open) return null;

    const alignClass = align === 'end' ? 'right-0' : align === 'center' ? 'left-1/2 -translate-x-1/2' : 'left-0';

    return (
        <div className={cn(
            "absolute z-50 mt-2 w-48 rounded-md shadow-lg ring-1 ring-black/5 focus:outline-none",
            "bg-white dark:bg-zinc-950 border border-border",
            alignClass,
            className
        )}>
            <div className="py-1" role="menu" aria-orientation="vertical">
                {children}
            </div>
        </div>
    );
};

interface DropdownMenuItemProps {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
}

export const DropdownMenuItem: React.FC<DropdownMenuItemProps> = ({ children, onClick, className }) => {
    const { setOpen } = useContext(DropdownContext);
    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onClick) onClick();
        setOpen(false);
    };

    return (
        <button
            onClick={handleClick}
            className={cn(
                "block w-full text-left px-4 py-2 text-sm transition-colors",
                "text-slate-700 dark:text-slate-200",
                "hover:bg-slate-100 dark:hover:bg-slate-800",
                className
            )}
            role="menuitem"
        >
            {children}
        </button>
    );
};
