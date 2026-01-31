import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Eye, Edit, Repeat, Trash2, RotateCcw, XCircle } from 'lucide-react';
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
    userRole: 'admin' | 'teamLeader';
    permissions?: ActionPermissions;
}

const ActionDropdownMenu: React.FC<ActionDropdownMenuProps> = ({
    rider,
    onView,
    onEdit,
    onStatusChange,
    onDelete,
    onReassign,
    onRestore,
    onPermanentDelete,
    userRole,
    permissions = {
        view: true,
        edit: true,
        statusChange: true,
        softDelete: true,
        hardDelete: true
    }
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    const toggleMenu = () => {
        if (!isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setMenuPosition({
                top: rect.bottom + 8, // Add a small gap
                right: window.innerWidth - rect.right
            });
        }
        setIsOpen(!isOpen);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
                buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        const handleScroll = () => {
            if (isOpen) setIsOpen(false);
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            window.addEventListener('scroll', handleScroll, true); // Capture phase to detect all scrolling
            window.addEventListener('resize', handleScroll);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', handleScroll);
        };
    }, [isOpen]);

    const isDeleted = rider.status === 'deleted';

    // Helper to check permission
    const can = (action: keyof ActionPermissions) => permissions[action] !== false;

    return (
        <div className="relative">
            <button
                ref={buttonRef}
                onClick={toggleMenu}
                className="p-2 hover:bg-accent rounded-lg transition-colors"
                title="Actions"
            >
                <MoreVertical size={18} />
            </button>

            {isOpen && menuPosition && (
                <div
                    ref={dropdownRef}
                    className="fixed w-64 bg-card/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50 animate-in zoom-in-95 duration-200 overflow-hidden ring-1 ring-black/5"
                    style={{
                        top: `${menuPosition.top}px`,
                        right: `${menuPosition.right}px`
                    }}
                >
                    <div className="p-1">
                        {/* View Details */}
                        {can('view') && (
                            <button
                                onClick={() => { onView(); setIsOpen(false); }}
                                className="w-full px-3 py-2.5 text-left hover:bg-primary/10 hover:text-primary rounded-lg transition-colors flex items-center gap-3 group"
                            >
                                <Eye size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
                                <span className="font-medium text-sm">View Details</span>
                            </button>
                        )}

                        {/* Edit Rider - Only for non-deleted */}
                        {!isDeleted && can('edit') && (
                            <button
                                onClick={() => { onEdit(); setIsOpen(false); }}
                                className="w-full px-3 py-2.5 text-left hover:bg-primary/10 hover:text-primary rounded-lg transition-colors flex items-center gap-3 group"
                            >
                                <Edit size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
                                <span className="font-medium text-sm">Edit Rider</span>
                            </button>
                        )}

                        {/* Status Change Submenu - Only for non-deleted */}
                        {!isDeleted && can('statusChange') && (
                            <div className="my-1">
                                <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                                    Set Status
                                </div>

                                <div className="grid grid-cols-2 gap-1 px-1">
                                    {rider.status !== 'active' && (
                                        <button
                                            onClick={() => { onStatusChange('active'); setIsOpen(false); }}
                                            className="px-2 py-2 hover:bg-green-500/10 hover:text-green-600 rounded-md transition-colors flex items-center gap-2 justify-center border border-transparent hover:border-green-200"
                                        >
                                            <div className="w-2 h-2 rounded-full bg-green-500 shadow-sm" />
                                            <span className="text-xs font-semibold">Active</span>
                                        </button>
                                    )}

                                    {rider.status !== 'inactive' && (
                                        <button
                                            onClick={() => { onStatusChange('inactive'); setIsOpen(false); }}
                                            className="px-2 py-2 hover:bg-amber-500/10 hover:text-amber-600 rounded-md transition-colors flex items-center gap-2 justify-center border border-transparent hover:border-amber-200"
                                        >
                                            <div className="w-2 h-2 rounded-full bg-amber-500 shadow-sm" />
                                            <span className="text-xs font-semibold">Inactive</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Re-assign - Only for admin and non-deleted */}
                        {userRole === 'admin' && !isDeleted && onReassign && (
                            <button
                                onClick={() => { onReassign(); setIsOpen(false); }}
                                className="w-full px-3 py-2.5 text-left hover:bg-blue-500/10 hover:text-blue-600 rounded-lg transition-colors flex items-center gap-3 group"
                            >
                                <Repeat size={16} className="text-muted-foreground group-hover:text-blue-600 transition-colors" />
                                <span className="font-medium text-sm">Transfer Rider</span>
                            </button>
                        )}

                        <div className="my-1 border-t border-border/50"></div>

                        {/* Delete or Restore based on status */}
                        {!isDeleted ? (
                            can('softDelete') && (
                                <button
                                    onClick={() => { onDelete(); setIsOpen(false); }}
                                    className="w-full px-3 py-2.5 text-left hover:bg-destructive/10 text-destructive rounded-lg transition-colors flex items-center gap-3"
                                >
                                    <Trash2 size={16} />
                                    <span className="font-medium text-sm">Delete Rider</span>
                                </button>
                            )
                        ) : (
                            <>
                                {/* Restore */}
                                {onRestore && can('softDelete') && (
                                    <button
                                        onClick={() => { onRestore(); setIsOpen(false); }}
                                        className="w-full px-3 py-2.5 text-left hover:bg-green-500/10 text-green-600 rounded-lg transition-colors flex items-center gap-3"
                                    >
                                        <RotateCcw size={16} />
                                        <span className="font-medium text-sm">Restore</span>
                                    </button>
                                )}

                                {/* Permanent Delete */}
                                {onPermanentDelete && can('hardDelete') && (
                                    <button
                                        onClick={() => { onPermanentDelete(); setIsOpen(false); }}
                                        className="w-full px-3 py-2.5 text-left hover:bg-destructive/10 text-destructive rounded-lg transition-colors flex items-center gap-3"
                                    >
                                        <XCircle size={16} />
                                        <span className="font-medium text-sm">Delete Permanently</span>
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ActionDropdownMenu;
