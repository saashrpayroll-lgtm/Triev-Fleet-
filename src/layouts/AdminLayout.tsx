import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import {
    LayoutDashboard,
    Users,
    UserCog,
    Database,
    FileText,
    Activity,
    User,
    LogOut,
    Menu,
    X,
    Bell,
    ShieldAlert,
    Target,
    Trophy
} from 'lucide-react';
import NotificationsDropdown from '@/components/NotificationsDropdown';
import { ThemeToggle } from '@/components/ThemeToggle';
import BottomNav from '@/components/layout/BottomNav';

const AdminLayout: React.FC = () => {
    const { userData, signOut } = useSupabaseAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(true);

    // DEBUG: Monitor permissions
    // React.useEffect(() => {
    //     if (userData) {
    //          // console.log('AdminLayout Permissions:', userData.permissions);
    //     }
    // }, [userData]);

    const handleLogout = async () => {
        try {
            await signOut();
            navigate('/login');
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    const navItems = [
        { path: '/portal', icon: LayoutDashboard, label: 'Dashboard', visible: userData?.permissions?.dashboard?.view ?? true },
        { path: '/portal/leads', icon: Target, label: 'Lead Management', visible: userData?.permissions?.modules?.leads ?? true },
        { path: '/portal/riders', icon: Users, label: 'Rider Management', visible: userData?.permissions?.modules?.riders ?? true },
        { path: '/portal/users', icon: UserCog, label: 'User Management', visible: userData?.permissions?.modules?.users ?? true },
        { path: '/portal/analytics', icon: Activity, label: 'Analytics', visible: userData?.permissions?.dashboard?.charts?.revenue ?? true },
        { path: '/portal/leaderboard', icon: Trophy, label: 'Leaderboard', visible: userData?.permissions?.dashboard?.view ?? true },
        { path: '/portal/notifications', icon: Bell, label: 'Notifications', visible: userData?.permissions?.modules?.notifications ?? true },
        { path: '/portal/requests', icon: ShieldAlert, label: 'Request Management', visible: userData?.permissions?.modules?.requests ?? true },
        { path: '/portal/data', icon: Database, label: 'Data Management', visible: userData?.permissions?.modules?.dataManagement ?? true },
        { path: '/portal/reports', icon: FileText, label: 'Reports Management', visible: userData?.permissions?.modules?.reports ?? true },
        { path: '/portal/activity-log', icon: Activity, label: 'Activity Log', visible: userData?.permissions?.modules?.activityLog ?? true },
        { path: '/portal/wallet-history', icon: Database, label: 'Wallet History', visible: userData?.permissions?.modules?.riders ?? true },
        { path: '/portal/profile', icon: User, label: 'Profile', visible: userData?.permissions?.modules?.profile ?? true },
    ].filter(item => item.visible);

    // ... existing code ...

    return (
        <div className="flex h-screen bg-background">
            {/* Sidebar - Hidden on Mobile, Visible on Desktop */}
            <aside
                className={`hidden md:flex ${sidebarOpen ? 'w-72' : 'w-20'} bg-card border-r border-border/50 transition-all duration-300 ease-in-out flex-col shadow-xl z-20 relative`}
            >
                {/* ... existing sidebar content ... */}
                {/* Toggle Button */}
                <button
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    className="absolute -right-3 top-6 bg-primary text-primary-foreground p-1.5 rounded-full shadow-lg hover:scale-110 transition-transform z-50 border-2 border-background"
                >
                    {sidebarOpen ? <X size={14} /> : <Menu size={14} />}
                </button>

                <div className={`p-6 flex items-center gap-3 ${sidebarOpen ? 'justify-start' : 'justify-center'} border-b border-border/50`}>
                    <div className="w-8 h-8 bg-gradient-to-br from-primary to-violet-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-lg shrink-0">
                        A
                    </div>
                    <h1 className={`font-bold text-lg bg-gradient-to-r from-primary to-violet-600 bg-clip-text text-transparent whitespace-nowrap transition-all duration-300 ${sidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0 overflow-hidden'}`}>
                        Admin Panel
                    </h1>
                </div>

                <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-x-hidden overflow-y-auto custom-scrollbar">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;

                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden ${isActive
                                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 font-medium translate-x-1'
                                    : 'text-muted-foreground hover:bg-violet-50 hover:text-violet-600 hover:shadow-sm dark:hover:bg-violet-900/20 dark:hover:text-violet-400'
                                    }`}
                            >
                                <Icon
                                    size={20}
                                    className={`shrink-0 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}
                                />
                                <span className={`whitespace-nowrap transition-all duration-300 ${sidebarOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 absolute left-12'}`}>
                                    {item.label}
                                </span>
                                {isActive && <div className="absolute right-0 top-0 h-full w-1 bg-white/20" />}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-border/50 bg-muted/5">
                    <button
                        onClick={handleLogout}
                        className={`flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all duration-300 w-full text-left group relative overflow-hidden
                            text-muted-foreground hover:bg-red-50 hover:text-red-600 hover:shadow-lg hover:shadow-red-500/10 hover:scale-[1.02] active:scale-95
                            dark:hover:bg-red-900/20 dark:hover:text-red-400
                        `}
                    >
                        <LogOut size={20} className="shrink-0 transition-transform duration-300 group-hover:rotate-12" />
                        <span className={`font-medium whitespace-nowrap transition-all duration-300 ${sidebarOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 absolute left-12'}`}>
                            Logout
                        </span>
                    </button>

                    {sidebarOpen && (
                        <div className="mt-4 text-xs text-center text-muted-foreground/50 font-medium whitespace-nowrap overflow-hidden">
                            v2.5.0 • Admin Console
                        </div>
                    )}
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden mb-24 md:mb-0">
                {/* Header - Make Sticky and Adjust Padding */}
                <header className="bg-card border-b border-border px-4 md:px-6 py-4 flex items-center justify-between sticky top-0 z-10">
                    <div>
                        {/* Mobile Logo/Title since Sidebar is hidden */}
                        <h2 className="text-xl md:text-2xl font-semibold flex items-center gap-2">
                            <div className="md:hidden w-8 h-8 bg-gradient-to-br from-primary to-violet-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-lg shrink-0">
                                A
                            </div>
                            {sidebarOpen ? <span className="md:hidden">Admin Panel</span> : 'Admin Panel'}
                        </h2>
                    </div>

                    {/* Right Side Actions */}
                    <div className="flex items-center gap-3 md:gap-6">
                        <div className="flex items-center gap-2">
                            <ThemeToggle />
                            {/* Notifications */}
                            {userData && (
                                <NotificationsDropdown
                                    userId={userData.id}
                                    userRole={userData.role}
                                />
                            )}
                        </div>

                        {/* User Info - Simplified on Mobile */}
                        <Link to="/portal/profile" className="flex items-center gap-3 pl-3 md:pl-6 border-l border-border hover:opacity-80 transition-opacity">
                            <div className="text-right hidden md:block">
                                <p className="font-medium text-sm">{typeof userData?.fullName === 'string' ? userData.fullName : 'Admin'}</p>
                                <p className="text-xs text-muted-foreground capitalize">{typeof userData?.role === 'string' ? userData.role : String(userData?.role || 'admin')}</p>
                            </div>
                            <div className="w-8 h-8 md:w-10 md:h-10 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-semibold overflow-hidden border border-primary/20">
                                {userData?.profilePicUrl ? (
                                    <img src={userData.profilePicUrl} alt="User" className="w-full h-full object-cover" />
                                ) : (
                                    typeof userData?.fullName === 'string' ? userData.fullName.charAt(0).toUpperCase() : String(userData?.fullName || 'A').charAt(0).toUpperCase()
                                )}
                            </div>
                        </Link>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-background">
                    <Outlet />
                </main>
            </div>

            {/* Bottom Nav for Mobile */}
            <BottomNav items={navItems} />
        </div>
    );
};


export default AdminLayout;
