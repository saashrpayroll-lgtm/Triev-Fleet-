import React from 'react';
import { User, PasswordResetRequest } from '@/types';
import ActionMenu from './ActionMenu';
import { UserCheck, UserX, Clock, ShieldAlert } from 'lucide-react';
import PasswordResetIndicator from '@/components/PasswordResetIndicator';

interface UserTableProps {
    users: User[];
    loading: boolean;
    onEdit: (user: User) => void;
    onPermissions: (user: User) => void;
    onSuspend: (user: User) => void;
    onResetPassword: (user: User) => void;
    onToggleStatus: (user: User) => void;
    onDelete: (user: User) => void;
    onPermanentDelete?: (user: User) => void;
    onView: (user: User) => void;
    // Selection Props
    selectedUsers: string[];
    onToggleSelect: (userId: string) => void;
    onSelectAll: (userIds: string[]) => void;
    // Password Reset Props
    passwordResetRequests?: PasswordResetRequest[];
}

const UserTable: React.FC<UserTableProps> = ({
    users,
    loading,
    onEdit,
    onPermissions,
    onSuspend,
    onResetPassword,
    onToggleStatus,
    onDelete,
    onPermanentDelete,
    onView,
    selectedUsers = [],
    onToggleSelect,
    onSelectAll,
    passwordResetRequests = []
}) => {
    // Helper to check if all visible users are selected
    const allSelected = users.length > 0 && users.every(u => selectedUsers.includes(u.id));

    // Helper to toggle all
    const handleSelectAll = () => {
        if (allSelected) {
            onSelectAll([]);
        } else {
            onSelectAll(users.map(u => u.id));
        }
    };

    if (loading) {
        return (
            <div className="space-y-4 p-4">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-16 w-full bg-muted/40 animate-pulse rounded-xl" />
                ))}
            </div>
        );
    }

    if (users.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-4">
                    <UserX size={32} />
                </div>
                <h3 className="text-lg font-semibold">No Users Found</h3>
                <p className="text-sm">Try adjusting your search or filters.</p>
            </div>
        );
    }

    const getStatusBadge = (user: User) => {
        switch (user.status) {
            case 'active':
                return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-600 border border-green-500/20"><UserCheck size={12} /> Active</span>;
            case 'inactive':
                return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-500/10 text-gray-600 border border-gray-500/20"><UserX size={12} /> Inactive</span>;
            case 'suspended':
                // Calculate remaining time nicely
                let timeRemaining = "Indefinitely";
                if (user.suspendedUntil) {
                    const now = new Date();
                    const end = new Date(user.suspendedUntil);
                    const diffMs = end.getTime() - now.getTime();

                    if (diffMs > 0) {
                        const mins = Math.ceil(diffMs / 60000);
                        if (mins < 60) timeRemaining = `${mins}m left`;
                        else {
                            const hours = Math.ceil(mins / 60);
                            timeRemaining = `${hours}h left`;
                        }
                    } else {
                        timeRemaining = "Expiring...";
                    }
                }

                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-600 border border-red-500/20" title={user.suspendedUntil ? `Until: ${new Date(user.suspendedUntil).toLocaleString()}` : 'Indefinitely'}>
                        <Clock size={12} /> Suspended ({timeRemaining})
                    </span>
                );
            default:
                return null;
        }
    };

    return (
        <div className="overflow-x-auto rounded-xl border border-border shadow-sm bg-card/50 backdrop-blur-sm">
            <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 text-muted-foreground font-medium uppercase text-xs tracking-wider sticky top-0 z-10 backdrop-blur-md">
                    <tr>
                        <th className="px-6 py-4 w-12">
                            <input
                                type="checkbox"
                                checked={allSelected}
                                onChange={handleSelectAll}
                                className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                            />
                        </th>
                        <th className="px-6 py-4">User Details</th>
                        <th className="px-6 py-4">Role & Location</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Joined</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {users.map((user) => (
                        <tr
                            key={user.id}
                            className={`group transition-colors ${selectedUsers.includes(user.id) ? 'bg-primary/5' : 'hover:bg-muted/40'}`}
                        >
                            <td className="px-6 py-4">
                                <input
                                    type="checkbox"
                                    checked={selectedUsers.includes(user.id)}
                                    onChange={() => onToggleSelect(user.id)}
                                    className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                                />
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                    <div
                                        onClick={() => onView(user)}
                                        className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary font-bold cursor-pointer hover:shadow-md transition-all uppercase"
                                    >
                                        {(user.fullName || user.email || '?').charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <div
                                                onClick={() => onView(user)}
                                                className="font-semibold text-foreground cursor-pointer hover:text-primary transition-colors"
                                            >
                                                {user.fullName || 'No Name'}
                                            </div>
                                            {/* Show yellow key if user has pending reset request */}
                                            {passwordResetRequests.some(req => req.userId === user.id) && (
                                                <PasswordResetIndicator
                                                    hasPendingReset={true}
                                                    onClick={() => onResetPassword(user)}
                                                />
                                            )}
                                        </div>
                                        <div className="text-xs text-muted-foreground font-mono">{user.email}</div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex flex-col gap-1">
                                    <span className="capitalize font-medium text-foreground flex items-center gap-1.5">
                                        {user.role === 'admin' && <ShieldAlert size={14} className="text-purple-500" />}
                                        {user.role}
                                    </span>
                                    <span className="text-xs text-muted-foreground">{user.jobLocation || 'Remote'}</span>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                {getStatusBadge(user)}
                            </td>
                            <td className="px-6 py-4 text-right text-muted-foreground font-mono text-xs">
                                {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}
                            </td>
                            <td className="px-6 py-4 text-right">
                                <ActionMenu
                                    user={user}
                                    onEdit={onEdit}
                                    onPermissions={onPermissions}
                                    onSuspend={onSuspend}
                                    onResetPassword={onResetPassword}
                                    onToggleStatus={onToggleStatus}
                                    onDelete={onDelete}
                                    onPermanentDelete={onPermanentDelete}
                                />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default UserTable;
