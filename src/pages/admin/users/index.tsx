import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, Search, RefreshCw, ArchiveRestore, Download, Users, UserCheck, UserX, ShieldAlert } from 'lucide-react';
import { useUsers } from './hooks/useUsers';
import UserTable from './components/UserTable';
import UserFormModal from './components/UserFormModal';
import BulkActionsBar from './components/BulkActionsBar';
import PermissionsEditor from '@/components/PermissionsEditor';
import SuspendUserModal from '@/components/SuspendUserModal';
import UserDetailModal from './components/UserDetailModal';
import { User } from '@/types';
import { exportToExcel } from '@/utils/exportUtils';
import { useToast } from '@/contexts/ToastContext';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';

// Stats Card Component
const StatCard = ({ title, value, icon: Icon, color, bg }: { title: string, value: number, icon: any, color: string, bg: string }) => (
    <div className="bg-card/50 backdrop-blur-sm border border-border p-4 rounded-xl flex items-center gap-4 hover:shadow-md transition-all duration-300">
        <div className={`p-3 rounded-lg ${bg} ${color}`}>
            <Icon size={24} />
        </div>
        <div>
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <h3 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">{value}</h3>
        </div>
    </div>
);

const UserManagementPage: React.FC = () => {
    const {
        users, loading, createUser, updateUser,
        toggleStatus, suspendUser, sendResetEmail, deleteUser,
        restoreUser, syncUsernames, permanentDeleteUser, bulkDeleteUsers, bulkSuspendUsers, bulkToggleStatus,
        getNextId, loadMore, hasMore
    } = useUsers();
    const { userData } = useSupabaseAuth();

    // Toast context returns the toaster methods directly
    const toast = useToast();
    const location = useLocation();

    // Local State
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState<'all' | 'admin' | 'teamLeader'>('all');
    // New status filter
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'suspended'>('all');
    const [showDeleted, setShowDeleted] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingPermissions, setEditingPermissions] = useState<User | null>(null);
    const [suspendingUser, setSuspendingUser] = useState<User | null>(null);
    const [viewingUser, setViewingUser] = useState<User | null>(null);
    const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);

    // New: Selected Users for Bulk
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

    // Effect to parse URL params
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const roleParam = params.get('role');
        const statusParam = params.get('status');

        if (roleParam) {
            setFilterRole(roleParam as 'all' | 'admin' | 'teamLeader');
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
            'Joined Date': u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'
        }));

        const success = exportToExcel(data, 'User_List');
        if (success) toast.success("User list exported successfully");
        else toast.error("Failed to export user list");
    };

    const handleCreateUser = async (data: any) => {
        setIsSubmitting(true);
        const success = await createUser(data, data.password); // Password from form
        setIsSubmitting(false);
        if (success) setShowCreateModal(false);
    };

    const handleUpdateUser = async (data: any) => {
        if (!editingUser) return;
        setIsSubmitting(true);
        const success = await updateUser(editingUser.id, data);
        setIsSubmitting(false);
        if (success) setEditingUser(null);
    };

    // Derived Logic
    const filteredUsers = useMemo(() => {
        return users.filter(user => {
            if (!user) return false; // Safety check

            if (showDeleted) {
                if (user.status !== 'deleted') return false;
            } else {
                if (user.status === 'deleted') return false;
            }

            const matchesSearch =
                (user.fullName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (user.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (user.jobLocation || '').toLowerCase().includes(searchTerm.toLowerCase());

            const matchesRole = filterRole === 'all' || user.role === filterRole;
            const matchesStatus = filterStatus === 'all' || user.status === filterStatus;

            return matchesSearch && matchesRole && matchesStatus;
        });
    }, [users, searchTerm, filterRole, showDeleted, filterStatus]);

    // Stats Logic
    const stats = useMemo(() => {
        const active = users.filter(u => u.status === 'active').length;
        const suspended = users.filter(u => u.status === 'suspended').length;
        const admins = users.filter(u => u.role === 'admin').length;
        return { active, suspended, admins, total: users.length };
    }, [users]);

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-24">
            {/* Header & Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Total Users"
                    value={stats.total}
                    icon={Users}
                    color="text-blue-500"
                    bg="bg-blue-500/10"
                />
                <StatCard
                    title="Active Users"
                    value={stats.active}
                    icon={UserCheck}
                    color="text-green-500"
                    bg="bg-green-500/10"
                />
                <StatCard
                    title="Suspended"
                    value={stats.suspended}
                    icon={UserX}
                    color="text-red-500"
                    bg="bg-red-500/10"
                />
                <StatCard
                    title="Administrators"
                    value={stats.admins}
                    icon={ShieldAlert}
                    color="text-purple-500"
                    bg="bg-purple-500/10"
                />
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap gap-4 items-center justify-between bg-card/30 p-4 rounded-xl border border-border backdrop-blur-sm">
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Search users..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary w-64 transitioning-all outline-none shadow-sm"
                        />
                    </div>

                    <div className="flex bg-muted/50 p-1 rounded-lg border border-border overflow-hidden">
                        <button
                            onClick={() => setFilterRole('all')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${filterRole === 'all' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            All
                        </button>
                        <button
                            onClick={() => setFilterRole('admin')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${filterRole === 'admin' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Admins
                        </button>
                        <button
                            onClick={() => setFilterRole('teamLeader')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${filterRole === 'teamLeader' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Leaders
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={syncUsernames}
                        className="p-2.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-colors"
                        title="Sync Usernames"
                    >
                        <RefreshCw size={20} />
                    </button>

                    <div className="h-6 w-px bg-border hidden sm:block"></div>

                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-2.5 bg-background border border-border hover:bg-accent rounded-xl transition-colors text-sm font-medium shadow-sm hover:shadow-md"
                    >
                        <Download size={18} />
                        <span className="hidden sm:inline">Export</span>
                    </button>

                    <button
                        onClick={() => setShowDeleted(!showDeleted)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-colors text-sm font-medium shadow-sm hover:shadow-md border border-transparent ${showDeleted ? 'bg-red-50 text-red-600 border-red-200' : 'bg-background border-border hover:bg-accent'}`}
                    >
                        <ArchiveRestore size={18} />
                        <span className="hidden sm:inline">{showDeleted ? "Hide Trash" : "Trash"}</span>
                    </button>

                    <button
                        onClick={() => setShowCreateModal(true)}
                        disabled={userData?.permissions?.users?.create === false}
                        className={`flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl transition-all shadow-lg font-medium whitespace-nowrap ${userData?.permissions?.users?.create === false
                            ? 'opacity-50 cursor-not-allowed'
                            : 'hover:bg-primary/90 hover:shadow-primary/25 active:scale-95'
                            }`}
                        title={userData?.permissions?.users?.create === false ? "Permission Denied" : "Add New User"}
                    >
                        <Plus size={20} />
                        <span>Add User</span>
                    </button>
                </div>
            </div>

            {/* Content */}
            <UserTable
                users={filteredUsers}
                loading={loading}
                onEdit={setEditingUser}
                onPermissions={setEditingPermissions}
                onSuspend={setSuspendingUser}
                onResetPassword={(u) => sendResetEmail(u.email)}
                onToggleStatus={toggleStatus}
                onDelete={showDeleted ? restoreUser : deleteUser}
                onPermanentDelete={permanentDeleteUser}
                onView={setViewingUser}
                selectedUsers={selectedUserIds}
                onToggleSelect={toggleSelect}
                onSelectAll={setSelectedUserIds}
            />

            {/* Pagination / Load More */}
            {hasMore && !loading && (
                <div className="flex justify-center pt-4">
                    <button
                        onClick={loadMore}
                        className="px-6 py-2 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground rounded-full text-sm font-medium transition-colors shadow-sm"
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
                    onSave={async (perms: any) => {
                        if (editingPermissions) {
                            await updateUser(editingPermissions.id, { permissions: perms });
                            // Do not close modal to allow real-time toggles
                            // setEditingPermissions(null); 
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
                isProcessing={isSubmittingBulk}
            />
        </div>
    );
};

export default UserManagementPage;
