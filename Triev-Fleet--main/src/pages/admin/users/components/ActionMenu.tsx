import React, { useState, useRef, useEffect } from 'react';
import {
    MoreVertical,
    Edit2,
    Shield,
    Clock,
    Lock,
    UserX,
    UserCheck,
    Trash2,
    ShieldAlert,
    Eye,
    AlertTriangle,
    RotateCcw
} from 'lucide-react';
import { User } from '@/types';
import { createPortal } from 'react-dom';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';

interface ActionMenuProps {
    user: User;
    onEdit: (user: User) => void;
    onPermissions: (user: User) => void;
    onSuspend: (user: User) => void;
    onResetPassword: (user: User) => void;
    onToggleStatus: (user: User) => void;
    onDelete: (user: User) => void;
    onPermanentDelete?: (user: User) => void;
    onView?: (user: User) => void;
}

const ActionMenu: React.FC<ActionMenuProps> = ({
    user,
    onEdit,
    onPermissions,
    onSuspend,
    onResetPassword,
    onToggleStatus,
    onDelete,
    onPermanentDelete,
    onView
}) => {
    const { userData } = useSupabaseAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const [confirmAction, setConfirmAction] = useState<{ label: string; action: () => void; color: string } | null>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                buttonRef.current &&
                !buttonRef.current.contains(event.target as Node) &&
                !(event.target as Element).closest('.action-menu-dropdown')
            ) {
                setIsOpen(false);
                setConfirmAction(null);
            }
        };

        const handleScroll = () => {
            if (isOpen) { setIsOpen(false); setConfirmAction(null); }
        };

        window.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('scroll', handleScroll, true);
        return () => {
            window.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [isOpen]);

    const toggleMenu = () => {
        if (!isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const showUp = spaceBelow < 300;

            setPosition({
                top: showUp ? rect.top - 8 : rect.bottom + 8,
                left: rect.left - 220 + rect.width
            });
        }
        setConfirmAction(null);
        setIsOpen(!isOpen);
    };

    const handleAction = (action: () => void) => {
        try { action(); } catch (e) { console.error("ActionMenu: action failed", e); }
        setIsOpen(false);
        setConfirmAction(null);
    };

    const handleConfirmAction = (label: string, action: () => void, color: string) => {
        setConfirmAction({ label, action, color });
    };

    // Status‑aware labels
    const getStatusAction = () => {
        if (user.status === 'active') return { label: 'Deactivate', icon: UserX, color: 'text-red-500', destructive: true };
        if (user.status === 'suspended') return { label: 'Reactivate', icon: UserCheck, color: 'text-green-500', destructive: false };
        if (user.status === 'inactive') return { label: 'Activate', icon: UserCheck, color: 'text-green-500', destructive: false };
        return { label: 'Activate', icon: UserCheck, color: 'text-green-500', destructive: false };
    };

    const statusAction = getStatusAction();

    const getDeleteLabel = () => {
        if (user.status === 'deleted') return { label: 'Restore User', icon: RotateCcw, color: 'text-green-600' };
        return { label: 'Move to Trash', icon: Trash2, color: 'text-orange-600' };
    };

    const deleteAction = getDeleteLabel();

    const MenuContent = (
        <div
            className="action-menu-dropdown fixed w-60 bg-card border border-border rounded-xl shadow-2xl z-[9999] overflow-hidden animate-enter"
            style={{
                top: position.top,
                left: position.left,
                transform: position.top > (window.innerHeight / 2) ? 'translateY(-100%)' : 'none'
            }}
        >
            {/* Confirmation Overlay */}
            {confirmAction && (
                <div className="p-4 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-900/30 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center gap-2 mb-3 text-yellow-600 dark:text-yellow-400">
                        <AlertTriangle size={16} />
                        <span className="text-xs font-bold uppercase tracking-wide">Confirm Action</span>
                    </div>
                    <p className="text-sm text-foreground mb-3 leading-snug">
                        Are you sure you want to <strong>{confirmAction.label.toLowerCase()}</strong> <span className="font-semibold">{user.fullName || user.email}</span>?
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setConfirmAction(null)}
                            className="flex-1 px-3 py-2 text-xs font-bold rounded-lg border border-border hover:bg-accent transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => handleAction(confirmAction.action)}
                            className={`flex-1 px-3 py-2 text-xs font-bold rounded-lg text-white transition-all active:scale-95 ${confirmAction.color}`}
                        >
                            Confirm
                        </button>
                    </div>
                </div>
            )}

            {!confirmAction && (
                <div className="p-1.5 space-y-0.5">
                    {/* User Quick Info */}
                    <div className="px-3 py-2 mb-1 border-b border-border">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary font-bold text-xs uppercase">
                                {(user.fullName || user.email || '?').charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-foreground truncate">{user.fullName || 'No Name'}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                            </div>
                            <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                user.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                user.status === 'suspended' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                user.status === 'inactive' ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' :
                                'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                            }`}>
                                {user.status === 'active' && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
                                {user.status}
                            </span>
                        </div>
                    </div>

                    {/* View Profile */}
                    {onView && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleAction(() => onView(user)); }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-accent rounded-lg transition-colors"
                        >
                            <Eye size={16} className="text-sky-500" /> View Profile
                        </button>
                    )}

                    {/* Edit */}
                    {(userData?.permissions?.users?.edit ?? true) && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleAction(() => onEdit(user)); }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-accent rounded-lg transition-colors"
                        >
                            <Edit2 size={16} className="text-blue-500" /> Edit Details
                        </button>
                    )}

                    {/* Permissions */}
                    {(userData?.permissions?.users?.managePermissions ?? true) && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleAction(() => onPermissions(user)); }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-accent rounded-lg transition-colors"
                        >
                            <Shield size={16} className="text-purple-500" /> Manage Permissions
                        </button>
                    )}

                    <div className="h-px bg-border my-1.5 mx-2" />

                    {/* Suspend */}
                    {(userData?.permissions?.users?.suspend ?? true) && user.status !== 'suspended' && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleAction(() => onSuspend(user)); }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-accent rounded-lg transition-colors"
                        >
                            <Clock size={16} className="text-orange-500" /> Suspend User
                        </button>
                    )}

                    {/* Reset Password */}
                    {(userData?.permissions?.system?.resetUserPassword ?? true) && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleConfirmAction('Reset Password', () => onResetPassword(user), 'bg-amber-600 hover:bg-amber-700');
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-accent rounded-lg transition-colors"
                        >
                            <Lock size={16} className="text-amber-500" /> Reset Password
                        </button>
                    )}

                    {/* Toggle Status */}
                    {(userData?.permissions?.users?.edit ?? true) && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (statusAction.destructive) {
                                    handleConfirmAction(statusAction.label, () => onToggleStatus(user), 'bg-red-600 hover:bg-red-700');
                                } else {
                                    handleAction(() => onToggleStatus(user));
                                }
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-accent rounded-lg transition-colors"
                        >
                            <statusAction.icon size={16} className={statusAction.color} /> {statusAction.label}
                        </button>
                    )}

                    <div className="h-px bg-border my-1.5 mx-2" />

                    {/* Delete / Restore */}
                    {(userData?.permissions?.users?.delete ?? true) && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (user.status !== 'deleted') {
                                    handleConfirmAction(deleteAction.label, () => onDelete(user), 'bg-orange-600 hover:bg-orange-700');
                                } else {
                                    handleAction(() => onDelete(user));
                                }
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-accent rounded-lg transition-colors"
                        >
                            <deleteAction.icon size={16} className={deleteAction.color} /> {deleteAction.label}
                        </button>
                    )}

                    {/* Permanent Delete */}
                    {onPermanentDelete && userData?.role === 'admin' && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleConfirmAction('Permanently Delete', () => onPermanentDelete(user), 'bg-red-700 hover:bg-red-800');
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30 rounded-lg transition-colors font-medium border-t border-red-100 dark:border-red-900/30 mt-1"
                        >
                            <ShieldAlert size={16} /> Permanent Delete
                        </button>
                    )}
                </div>
            )}
        </div>
    );

    return (
        <div className="relative">
            <button
                ref={buttonRef}
                onClick={toggleMenu}
                className={`p-2 rounded-full transition-all ${isOpen ? 'bg-primary/10 text-primary shadow-sm' : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'}`}
                title="Actions"
            >
                <MoreVertical size={18} />
            </button>

            {isOpen && createPortal(MenuContent, document.body)}
        </div>
    );
};

export default ActionMenu;
