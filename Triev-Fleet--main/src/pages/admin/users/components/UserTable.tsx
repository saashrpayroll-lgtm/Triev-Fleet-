import React from 'react';
import { User, PasswordResetRequest } from '@/types';
import ActionMenu from './ActionMenu';
import { UserX, Clock, ShieldAlert, Users, Briefcase, KeyRound, Globe } from 'lucide-react';
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
    selectedUsers: string[];
    onToggleSelect: (userId: string) => void;
    onSelectAll: (userIds: string[]) => void;
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
    const allSelected = users.length > 0 && users.every(u => selectedUsers.includes(u.id));

    const handleSelectAll = () => {
        if (allSelected) {
            onSelectAll([]);
        } else {
            onSelectAll(users.map(u => u.id));
        }
    };

    if (loading) {
        return (
            <div className="space-y-3 p-4">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-16 w-full bg-muted/30 animate-pulse rounded-xl" style={{ animationDelay: `${i * 100}ms` }} />
                ))}
            </div>
        );
    }

    if (users.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-16 text-muted-foreground">
                <div className="w-16 h-16 bg-muted/30 rounded-2xl flex items-center justify-center mb-4">
                    <UserX size={28} className="opacity-40" />
                </div>
                <h3 className="text-lg font-bold">No Users Found</h3>
                <p className="text-sm mt-1">Try adjusting your search or filters.</p>
            </div>
        );
    }

    const getRoleIcon = (role: string) => {
        switch (role) {
            case 'admin': return <ShieldAlert size={13} className="text-purple-500" />;
            case 'cityOps': return <Globe size={13} className="text-orange-500" />;
            case 'teamLeader': return <Users size={13} className="text-blue-500" />;
            case 'reportingManager': return <Briefcase size={13} className="text-teal-500" />;
            default: return null;
        }
    };

    const getRoleLabel = (role: string) => {
        switch (role) {
            case 'admin': return 'Admin';
            case 'cityOps': return 'City Ops';
            case 'teamLeader': return 'Team Leader';
            case 'reportingManager': return 'RM';
            default: return role;
        }
    };

    const getStatusBadge = (user: User) => {
        switch (user.status) {
            case 'active':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active
                    </span>
                );
            case 'inactive':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-gray-500/10 text-gray-500 border border-gray-500/20">
                        <UserX size={10} /> Inactive
                    </span>
                );
            case 'suspended': {
                let timeRemaining = "Indefinitely";
                if (user.suspendedUntil) {
                    const now = new Date();
                    const end = new Date(user.suspendedUntil);
                    const diffMs = end.getTime() - now.getTime();

                    if (diffMs > 0) {
                        const mins = Math.ceil(diffMs / 60000);
                        if (mins < 60) timeRemaining = `${mins}m`;
                        else {
                            const hours = Math.ceil(mins / 60);
                            if (hours < 24) timeRemaining = `${hours}h`;
                            else timeRemaining = `${Math.ceil(hours / 24)}d`;
                        }
                    } else {
                        timeRemaining = "Expiring";
                    }
                }
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20" title={user.suspendedUntil ? `Until: ${new Date(user.suspendedUntil).toLocaleString()}` : 'Indefinitely'}>
                        <Clock size={10} /> {timeRemaining}
                    </span>
                );
            }
            default:
                return <span className="text-[10px] font-bold text-muted-foreground">{user.status}</span>;
        }
    };

    return (
        <div className="overflow-x-auto rounded-2xl border border-border/40 shadow-sm bg-card/50 backdrop-blur-sm">
            <table className="w-full text-sm">
                <thead className="bg-muted/30 text-muted-foreground sticky top-0 z-10 backdrop-blur-md">
                    <tr>
                        <th className="px-4 py-3.5 w-10">
                            <input
                                type="checkbox"
                                checked={allSelected}
                                onChange={handleSelectAll}
                                className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                            />
                        </th>
                        <th className="px-4 py-3.5 text-left font-black text-[10px] uppercase tracking-widest">User</th>
                        <th className="px-4 py-3.5 text-left font-black text-[10px] uppercase tracking-widest">Role & Location</th>
                        <th className="px-4 py-3.5 text-left font-black text-[10px] uppercase tracking-widest">Status</th>
                        <th className="px-4 py-3.5 text-left font-black text-[10px] uppercase tracking-widest">Reporting Manager</th>
                        <th className="px-4 py-3.5 text-right font-black text-[10px] uppercase tracking-widest">Joined</th>
                        <th className="px-4 py-3.5 text-right font-black text-[10px] uppercase tracking-widest w-12"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                    {users.map((user) => (
                        <tr
                            key={user.id}
                            className={`group transition-colors ${selectedUsers.includes(user.id) ? 'bg-primary/5' : 'hover:bg-muted/20'}`}
                        >
                            <td className="px-4 py-3.5">
                                <input
                                    type="checkbox"
                                    checked={selectedUsers.includes(user.id)}
                                    onChange={() => onToggleSelect(user.id)}
                                    className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                                />
                            </td>
                            <td className="px-4 py-3.5">
                                <div className="flex items-center gap-3">
                                    <div
                                        onClick={() => onView(user)}
                                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm cursor-pointer hover:shadow-md transition-all uppercase border ${
                                            user.role === 'admin' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                                            : user.role === 'cityOps' ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20'
                                            : user.role === 'teamLeader' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                                            : 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20'
                                        }`}
                                    >
                                        {(user.fullName || user.email || '?').charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span
                                                onClick={() => onView(user)}
                                                className="font-semibold text-foreground cursor-pointer hover:text-primary transition-colors truncate"
                                            >
                                                {user.fullName || 'No Name'}
                                            </span>
                                            {/* Pending password reset request */}
                                            {passwordResetRequests.some(req => req.userId === user.id) && (
                                                <PasswordResetIndicator
                                                    hasPendingReset={true}
                                                    onClick={() => onResetPassword(user)}
                                                />
                                            )}
                                            {/* Force password change badge */}
                                            {user.force_password_change && (
                                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" title="Pending password change on next login">
                                                    <KeyRound size={8} /> PW
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                            <span className="font-mono truncate">{user.email}</span>
                                            {user.userId && (
                                                <>
                                                    <span className="text-border">•</span>
                                                    <span className="font-mono font-bold text-primary/60">{user.userId}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-4 py-3.5">
                                <div className="flex flex-col gap-1">
                                    <span className="capitalize font-medium text-foreground flex items-center gap-1.5 text-xs">
                                        {getRoleIcon(user.role)}
                                        {getRoleLabel(user.role)}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">{user.jobLocation || 'Remote'}</span>
                                </div>
                            </td>
                            <td className="px-4 py-3.5">
                                {getStatusBadge(user)}
                            </td>
                            <td className="px-4 py-3.5 text-xs text-muted-foreground">
                                {user.reportingManager || <span className="text-muted-foreground/40">—</span>}
                            </td>
                            <td className="px-4 py-3.5 text-right text-muted-foreground font-mono text-[10px]">
                                {user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '-'}
                            </td>
                            <td className="px-4 py-3.5 text-right">
                                <ActionMenu
                                    user={user}
                                    onEdit={onEdit}
                                    onPermissions={onPermissions}
                                    onSuspend={onSuspend}
                                    onResetPassword={onResetPassword}
                                    onToggleStatus={onToggleStatus}
                                    onDelete={onDelete}
                                    onPermanentDelete={onPermanentDelete}
                                    onView={onView}
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
