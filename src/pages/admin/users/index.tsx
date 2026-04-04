import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, Search, RefreshCw, ArchiveRestore, Download, Users, KeyRound, X } from 'lucide-react';
import { useUsers } from './hooks/useUsers';
import UserTable from './components/UserTable';
import UserFormModal from './components/UserFormModal';
import BulkActionsBar from './components/BulkActionsBar';
import PermissionsEditor from '@/components/PermissionsEditor';
import SuspendUserModal from '@/components/SuspendUserModal';
import UserDetailModal from './components/UserDetailModal';
import { User, PasswordResetRequest, UserFormData, UserPermissions } from '@/types';
import { exportToExcel } from '@/utils/exportUtils';
import { useToast } from '@/contexts/ToastContext';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/config/supabase';

const UserManagementPage: React.FC = () => {
    const {
        users, loading, createUser, updateUser,
        toggleStatus, suspendUser, deleteUser,
        restoreUser, permanentDeleteUser, bulkDeleteUsers, bulkSuspendUsers, bulkToggleStatus,
        getNextId, loadMore, hasMore, refreshUsers
    } = useUsers();
    const { userData } = useSupabaseAuth();

    const toast = useToast();
    const location = useLocation();

    // Local State
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState<'all' | 'admin' | 'teamLeader' | 'reportingManager'>('all');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'suspended'>('all');
    const [showDeleted, setShowDeleted] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingPermissions, setEditingPermissions] = useState<User | null>(null);
    const [suspendingUser, setSuspendingUser] = useState<User | null>(null);
    const [viewingUser, setViewingUser] = useState<User | null>(null);
    const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [passwordResetRequests, setPasswordResetRequests] = useState<PasswordResetRequest[]>([]);

    // Effect to parse URL params
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const roleParam = params.get('role');
        const statusParam = params.get('status');

        if (roleParam) {
            setFilterRole(roleParam as 'all' | 'admin' | 'teamLeader' | 'reportingManager');
        }

        if (statusParam) {
            if (statusParam === 'deleted') {
                setShowDeleted(true);
            } else {
                setFilterStatus(statusParam as 'all' | 'active' | 'inactive' | 'suspended');
                setShowDeleted(false);
            }
        }
    }, [location.search]);

    // Visibility change: re-fetch when tab regains focus
    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState === 'visible' && refreshUsers) {
                refreshUsers(true);
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, [refreshUsers]);

    // Fetch password reset requests
    useEffect(() => {
        const fetchResetRequests = async () => {
            const { data, error } = await supabase
                .from('password_reset_requests')
                .select('*')
                .eq('status', 'pending');

            if (!error && data) {
                setPasswordResetRequests(data as PasswordResetRequest[]);
            }
        };

        fetchResetRequests();

        const subscription = supabase
            .channel('password_reset_requests_changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'password_reset_requests'
            }, () => {
                fetchResetRequests();
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    // Handlers
    const toggleSelect = (id: string) => {
        setSelectedUserIds(prev =>
            prev.includes(id) ? prev.filter(uid => uid !== id) : [...prev, id]
        );
    };

    const handleBulkDelete = async () => {
        if (userData?.permissions?.users?.delete === false) {
            toast.error("Permission Denied: You cannot delete users.");
            return;
        }
        setIsSubmittingBulk(true);
        const usersToDelete = users.filter(u => selectedUserIds.includes(u.id));
        await bulkDeleteUsers(usersToDelete);
        setSelectedUserIds([]);
        setIsSubmittingBulk(false);
    };

    const handleBulkSuspend = async () => {
        if (userData?.permissions?.users?.suspend === false) {
            toast.error("Permission Denied: You cannot suspend users.");
            return;
        }
        setIsSubmittingBulk(true);
        const usersToSuspend = users.filter(u => selectedUserIds.includes(u.id));
        await bulkSuspendUsers(usersToSuspend);
        setSelectedUserIds([]);
        setIsSubmittingBulk(false);
    };

    const handleBulkToggleStatus = async () => {
        if (userData?.permissions?.users?.edit === false) {
            toast.error("Permission Denied: You cannot change user status.");
            return;
        }
        setIsSubmittingBulk(true);
        const usersToToggle = users.filter(u => selectedUserIds.includes(u.id));
        await bulkToggleStatus(usersToToggle);
        setSelectedUserIds([]);
        setIsSubmittingBulk(false);
    };

    const handleExport = () => {
        if (userData?.permissions?.reports?.generate === false) {
            toast.error("Permission Denied: You cannot export data.");
            return;
        }

        if (filteredUsers.length === 0) {
            toast.warning("No users to export");
            return;
        }

        const data = filteredUsers.map(u => ({
            Name: u.fullName,
            Email: u.email,
            Role: u.role,
            Status: u.status,
            Mobile: u.mobile,
            'Job Location': u.jobLocation || 'N/A',
            'Reporting Manager': u.reportingManager || 'N/A',
            'Joined Date': u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'
        }));

        const success = exportToExcel(data, 'User_List');
        if (success) toast.success("User list exported successfully");
        else toast.error("Failed to export user list");
    };

    const handleCreateUser = async (data: UserFormData) => {
        setIsSubmitting(true);
        const success = await createUser(data, data.password);
        setIsSubmitting(false);
        if (success) setShowCreateModal(false);
    };

    const handleUpdateUser = async (data: UserFormData) => {
        if (!editingUser) return;
        setIsSubmitting(true);
        const success = await updateUser(editingUser.id, data);
        setIsSubmitting(false);
        if (success) setEditingUser(null);
    };

    // Handle password reset by admin
    const handleAdminResetPassword = async (user: User) => {
        if (userData?.permissions?.users?.edit === false) {
            toast.error("Permission Denied: You cannot reset passwords.");
            return;
        }

        try {
            // Set force_password_change flag — user will be prompted to change password on next login
            const { error: updateError } = await supabase
                .from('users')
                .update({
                    force_password_change: true,
                    last_password_change: new Date().toISOString()
                })
                .eq('id', user.id);

            if (updateError) {
                console.error('Error updating user record:', updateError);
                toast.error('Failed to reset password: ' + updateError.message);
                return;
            }

            // Mark all pending reset requests for this user as approved
            await supabase
                .from('password_reset_requests')
                .update({
                    status: 'approved',
                    processed_at: new Date().toISOString(),
                    processed_by: userData?.id
                })
                .eq('user_id', user.id)
                .eq('status', 'pending');

            // Log activity
            await supabase.from('activity_logs').insert({
                user_id: userData?.id,
                user_name: userData?.fullName,
                user_role: userData?.role,
                action_type: 'password_reset',
                target_type: 'user',
                target_id: user.id,
                details: `Admin flagged ${user.fullName} for forced password change on next login`,
                timestamp: new Date().toISOString()
            });

            toast.success(`${user.fullName} will be forced to change password on next login.`);
            await refreshUsers();
        } catch (err) {
            console.error('Error:', err);
            toast.error('Failed to reset password');
        }
    };

    // Derived Logic
    const filteredUsers = useMemo(() => {
        return users.filter(user => {
            if (!user) return false;

            if (showDeleted) {
                if (user.status !== 'deleted') return false;
            } else {
                if (user.status === 'deleted') return false;
            }

            const matchesSearch =
                (user.fullName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (user.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (user.userId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (user.jobLocation || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (user.reportingManager || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (user.mobile || '').includes(searchTerm);

            const matchesRole = filterRole === 'all' || user.role === filterRole;
            const matchesStatus = filterStatus === 'all' || user.status === filterStatus;

            return matchesSearch && matchesRole && matchesStatus;
        });
    }, [users, searchTerm, filterRole, showDeleted, filterStatus]);

    // Stats Logic
    const stats = useMemo(() => {
        const nonDeleted = users.filter(u => u.status !== 'deleted');
        const active = nonDeleted.filter(u => u.status === 'active').length;
        const inactive = nonDeleted.filter(u => u.status === 'inactive').length;
        const suspended = nonDeleted.filter(u => u.status === 'suspended').length;
        const admins = nonDeleted.filter(u => u.role === 'admin').length;
        const teamLeaders = nonDeleted.filter(u => u.role === 'teamLeader').length;
        const reportingManagers = nonDeleted.filter(u => u.role === 'reportingManager').length;
        const pendingResets = passwordResetRequests.length;
        const forceChange = nonDeleted.filter(u => u.force_password_change).length;
        return { active, inactive, suspended, admins, teamLeaders, reportingManagers, pendingResets, forceChange, total: nonDeleted.length };
    }, [users, passwordResetRequests]);

    const activeFilterCount = [filterRole !== 'all', filterStatus !== 'all', searchTerm.length > 0].filter(Boolean).length;

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-24">
            {/* ── PREMIUM HEADER ── */}
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-800 via-slate-700 to-zinc-800 rounded-2xl p-6 text-white shadow-xl">
                <div className="absolute top-0 right-0 w-[350px] h-[350px] bg-blue-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/4 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-[250px] h-[250px] bg-purple-500/10 rounded-full blur-[80px] translate-y-1/3 -translate-x-1/4 pointer-events-none" />
                <div className="relative z-10">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h1 className="text-2xl font-black flex items-center gap-3">
                                <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-sm border border-white/10">
                                    <Users size={22} />
                                </div>
                                Staff & Roles
                            </h1>
                            <p className="text-slate-300 mt-1.5 text-sm">Manage all users, permissions, and access control</p>
                        </div>

                        {/* Quick Stats in Header */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/10 text-center min-w-[60px]">
                                <p className="text-xl font-black">{stats.total}</p>
                                <p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Total</p>
                            </div>
                            <div className="bg-emerald-500/15 backdrop-blur-sm rounded-xl px-3 py-2 border border-emerald-400/20 text-center min-w-[60px]">
                                <p className="text-xl font-black text-emerald-400">{stats.active}</p>
                                <p className="text-[8px] font-bold uppercase tracking-wider text-emerald-300/70">Active</p>
                            </div>
                            <div className="bg-purple-500/15 backdrop-blur-sm rounded-xl px-3 py-2 border border-purple-400/20 text-center min-w-[60px]">
                                <p className="text-xl font-black text-purple-400">{stats.admins}</p>
                                <p className="text-[8px] font-bold uppercase tracking-wider text-purple-300/70">Admins</p>
                            </div>
                            <div className="bg-blue-500/15 backdrop-blur-sm rounded-xl px-3 py-2 border border-blue-400/20 text-center min-w-[60px]">
                                <p className="text-xl font-black text-blue-400">{stats.teamLeaders}</p>
                                <p className="text-[8px] font-bold uppercase tracking-wider text-blue-300/70">TLs</p>
                            </div>
                            <div className="bg-teal-500/15 backdrop-blur-sm rounded-xl px-3 py-2 border border-teal-400/20 text-center min-w-[60px]">
                                <p className="text-xl font-black text-teal-400">{stats.reportingManagers}</p>
                                <p className="text-[8px] font-bold uppercase tracking-wider text-teal-300/70">RMs</p>
                            </div>
                            {stats.pendingResets > 0 && (
                                <div className="bg-amber-500/15 backdrop-blur-sm rounded-xl px-3 py-2 border border-amber-400/20 text-center min-w-[60px] animate-pulse">
                                    <p className="text-xl font-black text-amber-400">{stats.pendingResets}</p>
                                    <p className="text-[8px] font-bold uppercase tracking-wider text-amber-300/70">Resets</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sub Stats Row */}
                    <div className="flex items-center gap-4 mt-4 text-xs text-slate-400">
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 bg-red-400 rounded-full" />
                            {stats.suspended} Suspended
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 bg-gray-400 rounded-full" />
                            {stats.inactive} Inactive
                        </span>
                        {stats.forceChange > 0 && (
                            <span className="flex items-center gap-1.5">
                                <KeyRound size={12} className="text-amber-400" />
                                {stats.forceChange} pending password change
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* ── TOOLBAR ── */}
            <div className="bg-card border border-border/40 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 flex flex-wrap gap-3 items-center justify-between bg-gradient-to-r from-slate-500/5 via-transparent to-zinc-500/5">
                    <div className="flex flex-wrap items-center gap-2.5">
                        {/* Search */}
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={16} />
                            <input
                                type="text"
                                placeholder="Search name, email, ID, location..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 pr-4 py-2.5 bg-background border border-border/60 rounded-2xl focus:ring-2 focus:ring-primary/20 w-72 transition-all outline-none text-sm font-medium"
                            />
                            {searchTerm && (
                                <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        {/* Role Filter */}
                        <div className="flex bg-muted/50 p-0.5 rounded-xl border border-border/40 overflow-hidden">
                            {([
                                { value: 'all', label: 'All' },
                                { value: 'admin', label: 'Admin' },
                                { value: 'teamLeader', label: 'TL' },
                                { value: 'reportingManager', label: 'RM' },
                            ] as const).map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => setFilterRole(opt.value)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterRole === opt.value ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>

                        {/* Status Filter */}
                        <div className="flex bg-muted/50 p-0.5 rounded-xl border border-border/40 overflow-hidden">
                            {([
                                { value: 'all', label: 'All', count: stats.total },
                                { value: 'active', label: 'Active', count: stats.active },
                                { value: 'inactive', label: 'Inactive', count: stats.inactive },
                                { value: 'suspended', label: 'Suspend', count: stats.suspended },
                            ] as const).map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => { setFilterStatus(opt.value); if (opt.value !== 'all') setShowDeleted(false); }}
                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${filterStatus === opt.value && !showDeleted ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
                                >
                                    {opt.label}
                                    <span className={`text-[9px] px-1 py-0 rounded-full font-black ${filterStatus === opt.value && !showDeleted ? 'bg-primary-foreground/20' : 'bg-muted'}`}>
                                        {opt.count}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* Active Filter count */}
                        {activeFilterCount > 0 && (
                            <button
                                onClick={() => { setSearchTerm(''); setFilterRole('all'); setFilterStatus('all'); setShowDeleted(false); }}
                                className="text-xs font-bold text-rose-500 hover:text-rose-600 flex items-center gap-1 px-2 py-1.5"
                            >
                                <X size={12} /> Clear {activeFilterCount}
                            </button>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={() => refreshUsers && refreshUsers(true)}
                            className="p-2.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-colors"
                            title="Refresh"
                        >
                            <RefreshCw size={16} />
                        </button>

                        <button
                            onClick={handleExport}
                            className="flex items-center gap-2 px-3.5 py-2.5 bg-background border border-border/60 hover:bg-accent rounded-2xl transition-colors text-xs font-bold shadow-sm"
                        >
                            <Download size={14} /> Export
                        </button>

                        <button
                            onClick={() => setShowDeleted(!showDeleted)}
                            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl transition-colors text-xs font-bold border ${showDeleted ? 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 border-rose-200 dark:border-rose-800/30' : 'bg-background border-border/60 hover:bg-accent'}`}
                        >
                            <ArchiveRestore size={14} />
                            {showDeleted ? "Hide Trash" : "Trash"}
                        </button>

                        <button
                            onClick={() => setShowCreateModal(true)}
                            disabled={userData?.permissions?.users?.create === false}
                            className={`flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-2xl transition-all shadow-lg font-bold text-xs whitespace-nowrap ${userData?.permissions?.users?.create === false
                                ? 'opacity-50 cursor-not-allowed'
                                : 'hover:bg-primary/90 hover:shadow-primary/25 active:scale-95'
                                }`}
                        >
                            <Plus size={16} /> Add User
                        </button>
                    </div>
                </div>

                {/* Results count */}
                <div className="px-4 py-2 border-t border-border/30 bg-muted/10 flex items-center justify-between">
                    <p className="text-[11px] text-muted-foreground font-medium">
                        Showing <span className="font-black text-foreground">{filteredUsers.length}</span> of {stats.total} users
                        {searchTerm && <span> matching "<span className="font-bold">{searchTerm}</span>"</span>}
                    </p>
                    {selectedUserIds.length > 0 && (
                        <p className="text-[11px] text-primary font-bold">
                            {selectedUserIds.length} selected
                        </p>
                    )}
                </div>
            </div>

            {/* Content */}
            <UserTable
                users={filteredUsers}
                loading={loading}
                onEdit={setEditingUser}
                onPermissions={setEditingPermissions}
                onSuspend={setSuspendingUser}
                onResetPassword={handleAdminResetPassword}
                onToggleStatus={toggleStatus}
                onDelete={showDeleted ? restoreUser : deleteUser}
                onPermanentDelete={permanentDeleteUser}
                onView={setViewingUser}
                selectedUsers={selectedUserIds}
                onToggleSelect={toggleSelect}
                onSelectAll={setSelectedUserIds}
                passwordResetRequests={passwordResetRequests}
            />

            {/* Pagination / Load More */}
            {hasMore && !loading && (
                <div className="flex justify-center pt-2">
                    <button
                        onClick={loadMore}
                        className="px-6 py-2.5 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground rounded-2xl text-sm font-bold transition-colors shadow-sm"
                    >
                        Load More Users
                    </button>
                </div>
            )}

            {loading && users.length > 0 && (
                <div className="flex justify-center pt-4">
                    <span className="text-sm text-muted-foreground animate-pulse">Loading more...</span>
                </div>
            )}

            {/* Modals */}
            <UserFormModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSubmit={handleCreateUser}
                onGenerateId={getNextId}
                isSubmitting={isSubmitting}
                initialData={null}
            />

            {editingUser && (
                <UserFormModal
                    isOpen={!!editingUser}
                    onClose={() => setEditingUser(null)}
                    onSubmit={handleUpdateUser}
                    onGenerateId={getNextId}
                    initialData={editingUser}
                    isSubmitting={isSubmitting}
                />
            )}

            {editingPermissions && (
                <PermissionsEditor
                    isOpen={!!editingPermissions}
                    onClose={() => setEditingPermissions(null)}
                    currentPermissions={editingPermissions.permissions}
                    userName={editingPermissions.fullName}
                    onSave={async (perms: UserPermissions) => {
                        if (editingPermissions) {
                            await updateUser(editingPermissions.id, { permissions: perms });
                        }
                    }}
                />
            )}

            {suspendingUser && (
                <SuspendUserModal
                    user={suspendingUser}
                    onClose={() => setSuspendingUser(null)}
                    onSuspend={(duration) => suspendUser(suspendingUser, duration).then(() => setSuspendingUser(null))}
                />
            )}

            <UserDetailModal
                user={viewingUser}
                onClose={() => setViewingUser(null)}
            />

            <BulkActionsBar
                selectedCount={selectedUserIds.length}
                onClearSelection={() => setSelectedUserIds([])}
                onDelete={handleBulkDelete}
                onSuspend={handleBulkSuspend}
                onToggleStatus={handleBulkToggleStatus}
                onSelectAll={() => setSelectedUserIds(filteredUsers.map(u => u.id))}
                totalCount={filteredUsers.length}
                isProcessing={isSubmittingBulk}
            />
        </div>
    );
};

export default UserManagementPage;
