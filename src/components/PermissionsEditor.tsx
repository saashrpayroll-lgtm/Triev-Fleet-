import React, { useState } from 'react';
import { X, CheckSquare, Layers, User, Wallet, MessageSquare, Shield, Brain, LayoutDashboard, Users, Settings, BarChart3, Radio, UserCog, Search } from 'lucide-react';
import { UserPermissions } from '@/types';

interface PermissionsEditorProps {
    isOpen: boolean;
    onClose: () => void;
    currentPermissions: UserPermissions;
    onSave: (permissions: UserPermissions) => Promise<void>;
    userName: string;
}

type RiskLevel = 'low' | 'medium' | 'high';

interface PermissionConfig {
    id: string;
    label: string;
    description: string;
    risk: RiskLevel;
    path: string; // Dot notation path in UserPermissions object
}

interface TabConfig {
    id: string;
    label: string;
    icon: React.ElementType;
    permissions: PermissionConfig[];
    badgeCount?: number;
}

const PermissionsEditor: React.FC<PermissionsEditorProps> = ({
    isOpen,
    onClose,
    currentPermissions,
    onSave,
    userName,
}) => {

    // --- State ---
    const defaultPermissions: UserPermissions = {
        dashboard: {
            view: false,
            statsCards: {
                totalRiders: false, activeRiders: false, inactiveRiders: false, deletedRiders: false,
                teamLeaders: false, revenue: false,
                totalLeads: false, newLeads: false, convertedLeads: false, notConvertedLeads: false,
                walletPositive: false, walletNegative: false, walletZero: false, walletAverage: false,
                leaderboard: false
            },
            charts: { revenue: false, onboarding: false },
            recentActivity: false
        },
        modules: {
            leads: false, riders: false, users: false, notifications: false,
            requests: false, dataManagement: false, activityLog: false, reports: false, profile: false
        },
        riders: {
            view: false, create: false, edit: false, delete: false, hardDelete: false, statusChange: false, export: false,
            bulkActions: { statusChange: false, delete: false, sendReminders: false, assignTeamLeader: false, export: false },
            fields: { viewSensitive: false }
        },
        leads: { view: false, create: false, edit: false, delete: false, statusChange: false, export: false },
        users: { view: false, create: false, edit: false, delete: false, managePermissions: false, suspend: false },
        wallet: { view: false, addFunds: false, deductFunds: false, viewHistory: false, bulkUpdate: false },
        notifications: { view: false, broadcast: false, delete: false },
        requests: { view: false, resolve: false, delete: false },
        reports: { view: false, generate: false, export: false },
        profile: { view: false, editPersonalDetails: false, editBankDetails: false, changePassword: false },
        system: { resetUserPassword: false }
    };

    const mergePermissions = (current: any, defaults: any): any => {
        const result = { ...defaults };
        for (const key in current) {
            if (current[key] && typeof current[key] === 'object' && !Array.isArray(current[key])) {
                result[key] = mergePermissions(current[key], defaults[key] || {});
            } else {
                result[key] = current[key];
            }
        }
        return result;
    };

    const [permissions, setPermissions] = useState<UserPermissions>(() => {
        return mergePermissions(currentPermissions, defaultPermissions);
    });

    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [searchQuery, setSearchQuery] = useState('');

    // --- Helpers ---
    const getNestedValue = (obj: any, path: string) => {
        return path.split('.').reduce((o, i) => (o ? o[i] : undefined), obj);
    };

    const setNestedValue = (obj: any, path: string, value: boolean) => {
        const newObj = JSON.parse(JSON.stringify(obj)); // Deep clone
        const parts = path.split('.');
        let current = newObj;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) current[parts[i]] = {};
            current = current[parts[i]];
        }
        current[parts[parts.length - 1]] = value;
        return newObj;
    };

    const handleToggle = async (path: string, currentValue: boolean) => {
        const newPermissions = setNestedValue(permissions, path, !currentValue);
        setPermissions(newPermissions);

        // Auto-save immediately
        setIsSaving(true);
        try {
            await onSave(newPermissions);
        } catch (error) {
            console.error('Error auto-saving permissions:', error);
            // Revert on error? For now just log
        } finally {
            setIsSaving(false);
        }
    };

    const handleBulkToggle = async (targetValue: boolean) => {
        const currentTabConfig = tabs.find(t => t.id === activeTab);
        if (!currentTabConfig) return;

        let newPermissions = { ...permissions };
        const permsToToggle = searchQuery
            ? currentTabConfig.permissions.filter(p => p.label.toLowerCase().includes(searchQuery.toLowerCase()) || p.description.toLowerCase().includes(searchQuery.toLowerCase()))
            : currentTabConfig.permissions;

        permsToToggle.forEach(perm => {
            newPermissions = setNestedValue(newPermissions, perm.path, targetValue);
        });
        setPermissions(newPermissions);

        // Auto-save Bulk
        setIsSaving(true);
        try {
            await onSave(newPermissions);
        } catch (error) {
            console.error('Error auto-saving bulk permissions:', error);
        } finally {
            setIsSaving(false);
        }
    };

    // No longer needed manual save action, but keeping for reset/close check logic if needed

    // --- Configuration ---
    const tabs: TabConfig[] = [
        {
            id: 'dashboard',
            label: 'Dashboard & Analytics',
            icon: LayoutDashboard,
            permissions: [
                { id: 'dash_view', label: 'View Dashboard', description: 'Access the main dashboard overview', risk: 'low', path: 'dashboard.view' },
                { id: 'dash_revenue', label: 'View Revenue Stats', description: 'See financial metrics and revenue charts', risk: 'medium', path: 'dashboard.statsCards.revenue' },
                { id: 'dash_recent', label: 'Recent Activity', description: 'View latest system actions log', risk: 'low', path: 'dashboard.recentActivity' },
                { id: 'dash_charts', label: 'View Growth Charts', description: 'Access rider onboarding and performance charts', risk: 'low', path: 'dashboard.charts.onboarding' },
                { id: 'dash_leaderboard', label: 'Leaderboard Stats', description: 'View leaderboard toplist', risk: 'low', path: 'dashboard.statsCards.leaderboard' },

                // Rider Stats
                { id: 'dash_total_riders', label: 'Total Riders Card', description: 'View total riders count', risk: 'low', path: 'dashboard.statsCards.totalRiders' },
                { id: 'dash_active_riders', label: 'Active Riders Card', description: 'View active riders count', risk: 'low', path: 'dashboard.statsCards.activeRiders' },
                { id: 'dash_inactive_riders', label: 'Inactive Riders Card', description: 'View inactive riders count', risk: 'low', path: 'dashboard.statsCards.inactiveRiders' },
                { id: 'dash_deleted_riders', label: 'Deleted Riders Card', description: 'View deleted riders count', risk: 'low', path: 'dashboard.statsCards.deletedRiders' },

                // Lead Stats
                { id: 'dash_total_leads', label: 'Total Leads Card', description: 'View total leads count', risk: 'low', path: 'dashboard.statsCards.totalLeads' },
                { id: 'dash_new_leads', label: 'New Leads Card', description: 'View new leads count', risk: 'low', path: 'dashboard.statsCards.newLeads' },
                { id: 'dash_conv_leads', label: 'Converted Leads Card', description: 'View converted leads count', risk: 'low', path: 'dashboard.statsCards.convertedLeads' },
                { id: 'dash_nonconv_leads', label: 'Not Converted Leads Card', description: 'View not converted leads count', risk: 'low', path: 'dashboard.statsCards.notConvertedLeads' },

                // Wallet Stats
                { id: 'dash_wallet_pos', label: 'Positive Wallet Card', description: 'View positive wallet stats', risk: 'medium', path: 'dashboard.statsCards.walletPositive' },
                { id: 'dash_wallet_neg', label: 'Negative Wallet Card', description: 'View negative wallet stats', risk: 'medium', path: 'dashboard.statsCards.walletNegative' },
                { id: 'dash_wallet_zero', label: 'Zero Wallet Card', description: 'View zero wallet stats', risk: 'medium', path: 'dashboard.statsCards.walletZero' },
                { id: 'dash_wallet_avg', label: 'Average Wallet Card', description: 'View average wallet stats', risk: 'medium', path: 'dashboard.statsCards.walletAverage' },
            ]
        },
        {
            id: 'modules',
            label: 'Sidebar Modules',
            icon: Layers,
            permissions: [
                { id: 'mod_leads', label: 'Leads Module', description: 'Show Leads in sidebar', risk: 'low', path: 'modules.leads' },
                { id: 'mod_riders', label: 'Riders Module', description: 'Show Riders in sidebar', risk: 'low', path: 'modules.riders' },
                { id: 'mod_users', label: 'Users Module', description: 'Show Users in sidebar', risk: 'low', path: 'modules.users' },
                { id: 'mod_reports', label: 'Reports Module', description: 'Show Reports in sidebar', risk: 'low', path: 'modules.reports' },
                { id: 'mod_data', label: 'Data/Wallet Module', description: 'Show Wallet/Data in sidebar', risk: 'low', path: 'modules.dataManagement' },
                { id: 'mod_activity', label: 'Activity Module', description: 'Show Activity Log in sidebar', risk: 'low', path: 'modules.activityLog' },
                { id: 'mod_notif', label: 'Notifications Module', description: 'Show Notifications in sidebar', risk: 'low', path: 'modules.notifications' },
                { id: 'mod_req', label: 'Requests Module', description: 'Show Requests in sidebar', risk: 'low', path: 'modules.requests' },
            ]
        },
        {
            id: 'riders',
            label: 'Rider Management',
            icon: Users,
            permissions: [
                { id: 'riders_view', label: 'View Rider List', description: 'See all registered riders', risk: 'low', path: 'riders.view' },
                { id: 'riders_create', label: 'Add New Riders', description: 'Register new riders into the system', risk: 'medium', path: 'riders.create' },
                { id: 'riders_edit', label: 'Edit Rider Details', description: 'Modify rider profiles and information', risk: 'medium', path: 'riders.edit' },
                { id: 'riders_sensitive', label: 'View Sensitive Data', description: 'Access bank details and documents', risk: 'high', path: 'riders.fields.viewSensitive' },
                { id: 'riders_delete', label: 'Delete Riders (Soft)', description: 'Mark riders as deleted (recoverable)', risk: 'high', path: 'riders.delete' },
                { id: 'riders_hard_delete', label: 'Hard Delete Riders', description: 'Permanently remove rider data', risk: 'high', path: 'riders.hardDelete' },
                { id: 'riders_export', label: 'Export Data', description: 'Download rider lists as CSV/Excel', risk: 'medium', path: 'riders.export' },
                { id: 'riders_status', label: 'Change Status', description: 'Activate or deactivate riders', risk: 'medium', path: 'riders.statusChange' },
            ]
        },
        {
            id: 'leads',
            label: 'Lead Management',
            icon: CheckSquare,
            permissions: [
                { id: 'leads_view', label: 'View Leads', description: 'Browse and search leads', risk: 'low', path: 'leads.view' },
                { id: 'leads_create', label: 'Create Leads', description: 'Add new potential riders', risk: 'low', path: 'leads.create' },
                { id: 'leads_status', label: 'Change Status', description: 'Update lead progress (e.g. New -> Contacted)', risk: 'medium', path: 'leads.statusChange' },
                { id: 'leads_delete', label: 'Delete Leads', description: 'Remove leads from the system', risk: 'high', path: 'leads.delete' },
            ]
        },
        {
            id: 'wallet',
            label: 'Wallet & Finance',
            icon: Wallet,
            permissions: [
                { id: 'wallet_view', label: 'View Wallets', description: 'See rider wallet balances', risk: 'medium', path: 'wallet.view' },
                { id: 'wallet_add', label: 'Add Funds', description: 'Credit amounts to rider wallets', risk: 'high', path: 'wallet.addFunds' },
                { id: 'wallet_deduct', label: 'Deduct Funds', description: 'Debit amounts from rider wallets', risk: 'high', path: 'wallet.deductFunds' },
                { id: 'wallet_bulk', label: 'Bulk Update', description: 'Bulk wallet operations', risk: 'high', path: 'wallet.bulkUpdate' },
            ]
        },
        {
            id: 'users',
            label: 'User Management',
            icon: User,
            permissions: [
                { id: 'users_view', label: 'View Users', description: 'See list of admins and team leaders', risk: 'low', path: 'users.view' },
                { id: 'users_create', label: 'Create Users', description: 'Add new staff members', risk: 'high', path: 'users.create' },
                { id: 'users_perms', label: 'Manage Permissions', description: 'Grant or revoke system access', risk: 'high', path: 'users.managePermissions' },
                { id: 'users_suspend', label: 'Suspend Users', description: 'Temporarily block access', risk: 'high', path: 'users.suspend' },
                { id: 'system_pass', label: 'Reset Passwords', description: 'Force reset other users\' passwords', risk: 'high', path: 'system.resetUserPassword' },
            ]
        },
        {
            id: 'reports',
            label: 'Reports & Export',
            icon: BarChart3,
            permissions: [
                { id: 'reports_gen', label: 'Generate Reports', description: 'Create custom analytics reports', risk: 'low', path: 'reports.generate' },
                { id: 'reports_export', label: 'Export Data', description: 'Download system-wide data', risk: 'medium', path: 'reports.export' },
            ]
        },
        {
            id: 'communication',
            label: 'Communication',
            icon: MessageSquare,
            permissions: [
                { id: 'notif_broadcast', label: 'Broadcast Messages', description: 'Send push notifications to all users', risk: 'high', path: 'notifications.broadcast' },
                { id: 'requests_resolve', label: 'Resolve Requests', description: 'Mark tickets as completed', risk: 'medium', path: 'requests.resolve' },
                { id: 'requests_delete', label: 'Delete Requests', description: 'Remove tickets', risk: 'medium', path: 'requests.delete' },
            ]
        },
        {
            id: 'profile',
            label: 'Profile Permissions',
            icon: UserCog,
            permissions: [
                { id: 'prof_edit', label: 'Edit Personal Details', description: 'Change name, email, etc.', risk: 'medium', path: 'profile.editPersonalDetails' },
                { id: 'prof_bank', label: 'Edit Bank Details', description: 'Update bank info', risk: 'high', path: 'profile.editBankDetails' },
                { id: 'prof_pass', label: 'Change Password', description: 'Change own password', risk: 'medium', path: 'profile.changePassword' },
            ]
        },
        {
            id: 'system',
            label: 'System Settings',
            icon: Settings,
            permissions: [
                { id: 'data_module', label: 'Data Management Access', description: 'Access bulk data tools', risk: 'high', path: 'modules.dataManagement' },
            ]
        }
    ];

    if (!isOpen) return null;

    const currentTab = tabs.find(t => t.id === activeTab);
    const displayedPermissions = currentTab?.permissions.filter(p =>
        p.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-background w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl flex flex-col border border-border overflow-hidden">

                {/* --- Header --- */}
                <div className="flex items-center justify-between p-5 border-b border-border bg-card">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/20">
                            <Shield className="text-white" size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-foreground relative flex items-center gap-2">
                                Permission Manager
                                {isSaving && <span className="text-xs font-normal text-muted-foreground animate-pulse bg-muted px-2 py-0.5 rounded">Saving changes...</span>}
                            </h2>
                            <p className="text-sm text-muted-foreground flex items-center gap-2">
                                Configuration for <span className="font-semibold text-foreground bg-accent/50 px-2 py-0.5 rounded">{userName}</span>
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Search Bar */}
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search permissions..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 pr-4 py-2 w-64 bg-accent/20 border border-border rounded-xl text-sm focus:w-80 transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                            />
                        </div>

                        <button onClick={onClose} className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-full transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* --- Main Content Layout --- */}
                <div className="flex-1 flex overflow-hidden">

                    {/* --- Sidebar Navigation --- */}
                    <div className="w-64 bg-card border-r border-border flex flex-col overflow-y-auto py-4">
                        <div className="px-4 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Modules
                        </div>
                        {tabs.map(tab => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            // Calculate active count
                            const activeCount = tab.permissions.filter(p => !!getNestedValue(permissions, p.path)).length;

                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => { setActiveTab(tab.id); setSearchQuery(''); }}
                                    className={`w-full text-left px-6 py-3 flex items-center gap-3 border-l-4 transition-all hover:bg-accent/50 group ${isActive
                                        ? 'border-primary bg-primary/5 text-primary font-medium'
                                        : 'border-transparent text-muted-foreground hover:text-foreground'
                                        }`}
                                >
                                    <Icon size={18} className={isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'} />
                                    <span className="flex-1 truncate">{tab.label}</span>
                                    {activeCount > 0 && (
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isActive ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
                                            }`}>
                                            {activeCount}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* --- Permission Content Area --- */}
                    <div className="flex-1 flex flex-col bg-accent/5 relative">

                        {/* AI Insight Banner */}
                        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-3 flex items-center justify-between shadow-md z-10">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <Brain size={16} className="animate-pulse" />
                                <span>AI Security Analysis Ready</span>
                            </div>
                            <button className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded-md transition-colors font-semibold backdrop-blur-sm">
                                Analyze Permissions
                            </button>
                        </div>

                        {/* Sticky Toolbar for Tab Actions */}
                        <div className="bg-background border-b border-border p-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
                            <div>
                                <h3 className="text-lg font-bold flex items-center gap-2">
                                    {currentTab?.icon && <currentTab.icon size={20} className="text-primary" />}
                                    {currentTab?.label}
                                </h3>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Manage access for {currentTab?.label} capabilities
                                </p>
                            </div>
                            <div className="flex items-center gap-2 bg-accent/20 p-1.5 rounded-lg border border-border">
                                <button
                                    onClick={() => handleBulkToggle(true)}
                                    className="px-3 py-1.5 rounded-md bg-white hover:bg-blue-50 text-blue-700 text-xs font-bold border border-transparent hover:border-blue-200 transition-all shadow-sm flex items-center gap-1.5"
                                >
                                    <CheckSquare size={14} className="text-blue-600" /> ENABLE ALL
                                </button>
                                <div className="w-px h-6 bg-border mx-1" />
                                <button
                                    onClick={() => handleBulkToggle(false)}
                                    className="px-3 py-1.5 rounded-md bg-white hover:bg-red-50 text-red-700 text-xs font-bold border border-transparent hover:border-red-200 transition-all shadow-sm flex items-center gap-1.5"
                                >
                                    <X size={14} className="text-red-600" /> DISABLE ALL
                                </button>
                            </div>
                        </div>

                        {/* Scrolling Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {displayedPermissions.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground opacity-50">
                                    <Search size={48} className="mb-4" />
                                    <p>No permissions match "{searchQuery}"</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {displayedPermissions.map(perm => {
                                        const val = getNestedValue(permissions, perm.path);
                                        const isChecked = !!val;
                                        const badgeConfig = {
                                            low: 'bg-green-100 text-green-700 border-green-200',
                                            medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
                                            high: 'bg-red-100 text-red-700 border-red-200',
                                        }[perm.risk] || 'bg-gray-100 text-gray-700';

                                        return (
                                            <div key={perm.id} className={`bg-card rounded-xl p-4 border transition-all hover:shadow-md flex items-start gap-4 ${isChecked ? 'border-primary/40 shadow-sm' : 'border-border'}`}>
                                                {/* Toggle Control Area */}
                                                <div className="mt-1">
                                                    {/* Robust Toggle Switch (Div based) */}
                                                    <div
                                                        className={`relative w-11 h-6 rounded-full cursor-pointer transition-colors duration-200 ease-in-out ${isChecked ? 'bg-blue-600' : 'bg-gray-300'}`}
                                                        onClick={() => !isSaving && handleToggle(perm.path, isChecked)}
                                                    >
                                                        <div
                                                            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform duration-200 ease-in-out ${isChecked ? 'translate-x-5' : 'translate-x-0'}`}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                        <span className={`font-semibold text-sm ${isChecked ? 'text-foreground' : 'text-muted-foreground'}`}>{perm.label}</span>
                                                        <span className={`text-[10px] uppercase font-bold px-1.5 py-0 rounded border ${badgeConfig}`}>
                                                            {perm.risk}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground leading-relaxed">{perm.description}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* --- Footer --- */}
                <div className="p-4 border-t border-border bg-card flex justify-between items-center z-30">
                    <button
                        onClick={() => {
                            if (window.confirm('Reset all changes to default? (This will also save defaults)')) {
                                setPermissions(mergePermissions(currentPermissions, defaultPermissions));
                                handleToggle('reset', false).catch(() => { }); // Hack or just call onSave directly?
                                // Better:
                                const resetPerms = mergePermissions(currentPermissions, defaultPermissions);
                                setPermissions(resetPerms);
                                onSave(resetPerms);
                            }
                        }}
                        className="text-sm font-medium text-muted-foreground hover:text-foreground flex items-center gap-2 px-4 py-2 hover:bg-accent rounded-lg transition-colors"
                    >
                        <Radio size={16} /> Reset
                    </button>

                    <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                            <div className="text-xs font-bold text-foreground">
                                {Object.values(permissions).reduce((acc, val) => acc + (typeof val === 'object' ? Object.values(val).filter(b => b === true).length : 0), 0)} Permissions Active
                            </div>
                            <div className="text-[10px] text-muted-foreground">Changes saved automatically</div>
                        </div>
                        <button
                            onClick={onClose}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-2.5 rounded-lg font-bold shadow-lg shadow-primary/25 flex items-center gap-2 transition-all active:scale-95"
                        >
                            Done
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default PermissionsEditor;
