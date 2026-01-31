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
    ShieldAlert
} from 'lucide-react';
import { User } from '@/types';

interface ActionMenuProps {
    user: User;
    onEdit: (user: User) => void;
    onPermissions: (user: User) => void;
    onSuspend: (user: User) => void;
    onResetPassword: (user: User) => void;
    onToggleStatus: (user: User) => void;
    onDelete: (user: User) => void;
    onPermanentDelete?: (user: User) => void;
}

import { createPortal } from 'react-dom';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';

/* ... imports ... */

const ActionMenu: React.FC<ActionMenuProps> = ({
    user,
    onEdit,
    onPermissions,
    onSuspend,
    onResetPassword,
    onToggleStatus,
    onDelete,
    onPermanentDelete
}) => {
    const { userData } = useSupabaseAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const buttonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                buttonRef.current &&
                !buttonRef.current.contains(event.target as Node) &&
                !(event.target as Element).closest('.action-menu-dropdown')
            ) {
                // console.log("ActionMenu: Closing via Outside Click"); // Debug
                setIsOpen(false);
            }
        };

        // Handle scroll to close menu (simpler than repositionings)
        const handleScroll = () => {
            if (isOpen) setIsOpen(false);
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
            // Decide if we should show up or down based on screen space
            const spaceBelow = window.innerHeight - rect.bottom;
            const showUp = spaceBelow < 250; // If less than 250px below, show up

            setPosition({
                top: showUp ? rect.top - 8 : rect.bottom + 8, // 8px buffer using transform later
                left: rect.left - 180 + rect.width // Align right edge approximately
            });
        }
        setIsOpen(!isOpen);
    };

    const handleAction = (action: () => void) => {
        console.error("ActionMenu: handleAction triggered");
        try {
            action();
            console.error("ActionMenu: action() executed");
        } catch (e) {
            console.error("ActionMenu: action() failed", e);
        }
        setIsOpen(false);
    };

    const MenuContent = (
        <div
            className="action-menu-dropdown fixed w-52 bg-card border border-border rounded-lg shadow-xl z-[9999] overflow-hidden animate-enter"
            style={{
                top: position.top,
                left: position.left,
                transform: position.top > (window.innerHeight / 2) ? 'translateY(-100%)' : 'none'
            }}
        >
            <div className="p-1 space-y-0.5">
                {(userData?.permissions?.users?.edit ?? true) && (
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleAction(() => onEdit(user)); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent rounded-md transition-colors"
                    >
                        <Edit2 size={16} className="text-blue-500" /> Edit Details
                    </button>
                )}
                {(userData?.permissions?.users?.managePermissions ?? true) && (
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleAction(() => onPermissions(user)); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent rounded-md transition-colors"
                    >
                        <Shield size={16} className="text-purple-500" /> Permissions
                    </button>
                )}
                <div className="h-px bg-border my-1" />
                {(userData?.permissions?.users?.suspend ?? true) && (
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleAction(() => onSuspend(user)); }}
                        disabled={user.status === 'suspended'}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent rounded-md transition-colors disabled:opacity-50"
                    >
                        <Clock size={16} className="text-orange-500" /> Suspend
                    </button>
                )}
                {(userData?.permissions?.system?.resetUserPassword ?? true) && (
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleAction(() => onResetPassword(user)); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent rounded-md transition-colors"
                    >
                        <Lock size={16} className="text-amber-500" /> Reset Password
                    </button>
                )}
                {(userData?.permissions?.users?.edit ?? true) && (
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleAction(() => onToggleStatus(user)); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent rounded-md transition-colors"
                    >
                        {user.status === 'active' ? (
                            <>
                                <UserX size={16} className="text-red-500" /> Deactivate
                            </>
                        ) : (
                            <>
                                <UserCheck size={16} className="text-green-500" /> Activate
                            </>
                        )}
                    </button>
                )}
                <div className="h-px bg-border my-1" />
                {(userData?.permissions?.users?.delete ?? true) && (
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleAction(() => onDelete(user)); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent rounded-md transition-colors"
                    >
                        {user.status === 'deleted' ? <UserCheck size={16} /> : <Trash2 size={16} />} {user.status === 'deleted' ? 'Restore User' : 'Soft Delete'}
                    </button>
                )}
                {onPermanentDelete && userData?.role === 'admin' && (
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleAction(() => onPermanentDelete(user)); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30 rounded-md transition-colors font-medium border-t border-red-100 dark:border-red-900/30 mt-1"
                    >
                        <ShieldAlert size={16} /> Permanent Delete
                    </button>
                )}
            </div>
        </div>
    );

    return (
        <div className="relative">
            <button
                ref={buttonRef}
                onClick={toggleMenu}
                className="p-2 hover:bg-muted/50 rounded-full transition-colors text-muted-foreground hover:text-foreground"
            >
                <MoreVertical size={18} />
            </button>

            {isOpen && createPortal(MenuContent, document.body)}
        </div>
    );
};

export default ActionMenu;
