import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical, Eye, Edit, Repeat, Trash2, RotateCcw, XCircle, X } from 'lucide-react';
import { Rider } from '@/types';

interface ActionPermissions {
    view?: boolean;
    edit?: boolean;
    statusChange?: boolean;
    softDelete?: boolean;
    hardDelete?: boolean;
}

interface ActionDropdownMenuProps {
    rider: Rider;
    onView: () => void;
    onEdit: () => void;
    onStatusChange: (status: 'active' | 'inactive') => void;
    onDelete: () => void;
    onReassign?: () => void;
    onRestore?: () => void;
    onPermanentDelete?: () => void;
    onAdjustWallet?: () => void;
    userRole: 'admin' | 'teamLeader';
    permissions?: ActionPermissions;
}

const WalletIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
);

const ActionDropdownMenu: React.FC<ActionDropdownMenuProps> = ({
    rider, onView, onEdit, onStatusChange, onDelete,
    onReassign, onRestore, onPermanentDelete, onAdjustWallet,
    userRole,
    permissions = { view: true, edit: true, statusChange: true, softDelete: true, hardDelete: true }
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Detect mobile
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    const open = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (!isMobile && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            // Using viewport coordinates for Portal placement
            setMenuPos({
                top: rect.bottom + window.scrollY + 6,
                right: window.innerWidth - (rect.right + window.scrollX)
            });
        }
        setIsOpen(true);
    };

    const close = () => setIsOpen(false);

    // Close on outside click / scroll
    useEffect(() => {
        if (!isOpen) return;
        const onOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
                buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
                close();
            }
        };
        const onScroll = () => {
            if (!isMobile) close();
        };

        document.addEventListener('mousedown', onOutside);
        window.addEventListener('scroll', onScroll, true);
        return () => {
            document.removeEventListener('mousedown', onOutside);
            window.removeEventListener('scroll', onScroll, true);
        };
    }, [isOpen, isMobile]);

    const isDeleted = rider.status === 'deleted';
    const can = (a: keyof ActionPermissions) => permissions[a] !== false;

    const act = (fn: () => void) => (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        close();
        setTimeout(fn, 50);
    };

    const MenuItems = () => (
        <div className="py-1 px-1 space-y-0.5">
            <div className="px-3 py-2 border-b border-border/50 mb-1">
                <p className="text-xs font-black text-foreground truncate">{rider.riderName}</p>
                <p className="text-[10px] text-muted-foreground font-mono">{rider.trievId}</p>
            </div>

            {can('view') && (
                <button onClick={act(onView)} className="w-full px-3 py-2.5 text-left hover:bg-primary/10 hover:text-primary rounded-lg transition-colors flex items-center gap-3 group text-sm font-medium">
                    <Eye size={15} className="text-muted-foreground group-hover:text-primary" /> View Details
                </button>
            )}
            {!isDeleted && can('edit') && (
                <button onClick={act(onEdit)} className="w-full px-3 py-2.5 text-left hover:bg-primary/10 hover:text-primary rounded-lg transition-colors flex items-center gap-3 group text-sm font-medium">
                    <Edit size={15} className="text-muted-foreground group-hover:text-primary" /> Edit Rider
                </button>
            )}
            {!isDeleted && onAdjustWallet && (
                <button onClick={act(onAdjustWallet)} className="w-full px-3 py-2.5 text-left hover:bg-primary/10 hover:text-primary rounded-lg transition-colors flex items-center gap-3 group text-sm font-medium">
                    <WalletIcon /> Adjust Wallet
                </button>
            )}

            {!isDeleted && can('statusChange') && (
                <div className="my-1">
                    <div className="px-3 py-1 text-[9px] uppercase tracking-widest text-muted-foreground font-black">Set Status</div>
                    <div className="grid grid-cols-2 gap-1 px-1">
                        {rider.status !== 'active' && (
                            <button onClick={act(() => onStatusChange('active'))}
                                className="px-2 py-2 hover:bg-green-500/10 hover:text-green-600 rounded-lg border border-transparent hover:border-green-200 transition-colors flex items-center justify-center gap-1.5">
                                <span className="text-xs font-bold text-green-600">Active</span>
                            </button>
                        )}
                        {rider.status !== 'inactive' && (
                            <button onClick={act(() => onStatusChange('inactive'))}
                                className="px-2 py-2 hover:bg-amber-500/10 hover:text-amber-600 rounded-lg border border-transparent hover:border-amber-200 transition-colors flex items-center justify-center gap-1.5">
                                <span className="text-xs font-bold text-amber-600">Inactive</span>
                            </button>
                        )}
                    </div>
                </div>
            )}

            {userRole === 'admin' && !isDeleted && onReassign && (
                <button onClick={act(onReassign)} className="w-full px-3 py-2.5 text-left hover:bg-blue-500/10 hover:text-blue-600 rounded-lg transition-colors flex items-center gap-3 group text-sm font-medium">
                    <Repeat size={15} className="text-muted-foreground group-hover:text-blue-600" /> Transfer Rider
                </button>
            )}

            <div className="my-1 border-t border-border/50" />

            {!isDeleted ? (
                can('softDelete') && (
                    <button onClick={act(onDelete)} className="w-full px-3 py-2.5 text-left hover:bg-destructive/10 text-destructive rounded-lg transition-colors flex items-center gap-3 text-sm font-medium">
                        <Trash2 size={15} /> Delete Rider
                    </button>
                )
            ) : (
                <>
                    {onRestore && can('softDelete') && (
                        <button onClick={act(onRestore)} className="w-full px-3 py-2.5 text-left hover:bg-green-500/10 text-green-600 rounded-lg transition-colors flex items-center gap-3 text-sm font-medium">
                            <RotateCcw size={15} /> Restore
                        </button>
                    )}
                    {onPermanentDelete && can('hardDelete') && (
                        <button onClick={act(onPermanentDelete)} className="w-full px-3 py-2.5 text-left hover:bg-destructive/10 text-destructive rounded-lg transition-colors flex items-center gap-3 text-sm font-medium">
                            <XCircle size={15} /> Delete Permanently
                        </button>
                    )}
                </>
            )}
        </div>
    );

    return (
        <>
            <button
                ref={buttonRef}
                onClick={open}
                className="p-2 hover:bg-accent rounded-lg transition-colors"
                title="Actions"
            >
                <MoreVertical size={18} />
            </button>

            {isOpen && createPortal(
                <div className="fixed inset-0 z-[50000]">
                    {/* Backdrop for mobile / Click away for desktop */}
                    <div className={`absolute inset-0 ${isMobile ? 'bg-black/50 backdrop-blur-sm' : ''}`} onClick={close} />

                    {isMobile ? (
                        <div className="absolute bottom-0 inset-x-0 z-10 bg-card rounded-t-3xl shadow-2xl border-t border-border animate-in slide-in-from-bottom-4 duration-300 pb-safe">
                            <div className="flex justify-center pt-3 pb-1">
                                <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
                            </div>
                            <button onClick={close} className="absolute top-3 right-4 p-1.5 rounded-full hover:bg-muted transition-colors">
                                <X size={18} className="text-muted-foreground" />
                            </button>
                            <div className="max-h-[75vh] overflow-y-auto pb-6">
                                <MenuItems />
                            </div>
                        </div>
                    ) : (
                        menuPos && (
                            <div
                                ref={menuRef}
                                className="absolute w-60 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-white/20 dark:border-slate-800/50 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] z-[50001] animate-in fade-in zoom-in-95 duration-150 overflow-hidden"
                                style={{ top: menuPos.top, right: menuPos.right }}
                                onClick={e => e.stopPropagation()}
                            >
                                <MenuItems />
                            </div>
                        )
                    )}
                </div>,
                document.body
            )}
        </>
    );
};

export default ActionDropdownMenu;
