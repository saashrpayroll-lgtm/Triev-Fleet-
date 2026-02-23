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
import { supabase } from '@/config/supabase';

interface NavItem {
    path: string;
    icon: any;
    label: string;
    visible?: boolean;
    badge?: number;
    badgeColor?: string;
}

interface NavGroup {
    title: string;
    items: NavItem[];
}

const AdminLayout: React.FC = () => {
    const { userData, signOut } = useSupabaseAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(true);

    // Live Badges State
    const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
    const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

    React.useEffect(() => {
        if (!userData) return;
        fetchCounts();

        // Subscriptions
        const reqChannel = supabase.channel('requests-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => fetchCounts())
            .subscribe();

        const notifChannel = supabase.channel('notif-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userData.id}` }, () => fetchCounts())
            .subscribe();

        return () => {
            supabase.removeChannel(reqChannel);
            supabase.removeChannel(notifChannel);
        };
    }, [userData]);

    const fetchCounts = async () => {
        if (!userData) return;
        try {
            const [{ count: reqCount }, { count: notifCount }] = await Promise.all([
                supabase.from('requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
                supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', userData.id).eq('is_read', false)
            ]);
            setPendingRequestsCount(reqCount || 0);
            setUnreadNotificationsCount(notifCount || 0);
        } catch (e) {
            console.error("Failed to fetch sidebar counts:", e);
        }
    };

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

    const navGroups: NavGroup[] = [
        {
            title: 'Overview',
            items: [
                { path: '/portal', icon: LayoutDashboard, label: 'Dashboard', visible: userData?.permissions?.dashboard?.view ?? true },
                { path: '/portal/analytics', icon: Activity, label: 'Analytics', visible: userData?.permissions?.dashboard?.charts?.revenue ?? true },
                { path: '/portal/tl-performance', icon: Activity, label: 'TL Performance', visible: userData?.permissions?.dashboard?.view ?? true },
                { path: '/portal/tl-allotment', icon: Target, label: 'TL Allotment System', visible: userData?.permissions?.dashboard?.view ?? true },
                { path: '/portal/leaderboard', icon: Trophy, label: 'Leaderboard', visible: userData?.permissions?.dashboard?.view ?? true },
            ].filter(item => item.visible)
        },
        {
            title: 'Operations',
            items: [
                { path: '/portal/riders', icon: Users, label: 'Rider Management', visible: userData?.permissions?.modules?.riders ?? true },
                { path: '/portal/leads', icon: Target, label: 'Lead Management', visible: userData?.permissions?.modules?.leads ?? true },
                {
                    path: '/portal/requests',
                    icon: ShieldAlert,
                    label: 'Requests',
                    visible: userData?.permissions?.modules?.requests ?? true,
                    badge: pendingRequestsCount > 0 ? pendingRequestsCount : undefined,
                    badgeColor: 'bg-orange-500 text-white'
                },
                {
                    path: '/portal/notifications',
                    icon: Bell,
                    label: 'Notifications',
                    visible: userData?.permissions?.modules?.notifications ?? true,
                    badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined,
                    badgeColor: 'bg-red-500 text-white'
                },
            ].filter(item => item.visible)
        },
        {
            title: 'Financials',
            items: [
                { path: '/portal/data', icon: Database, label: 'Data Hub (Imports)', visible: userData?.permissions?.modules?.dataManagement ?? true },
                { path: '/portal/wallet-history', icon: Database, label: 'Wallet History', visible: userData?.permissions?.modules?.riders ?? true },
                { path: '/portal/reports', icon: FileText, label: 'Reports', visible: userData?.permissions?.modules?.reports ?? true },
            ].filter(item => item.visible)
        },
        {
            title: 'System & Admin',
            items: [
                { path: '/portal/users', icon: UserCog, label: 'Staff & Users', visible: userData?.permissions?.modules?.users ?? true },
                { path: '/portal/activity-log', icon: Activity, label: 'Activity Logs', visible: userData?.permissions?.modules?.activityLog ?? true },
                { path: '/portal/profile', icon: User, label: 'My Profile', visible: userData?.permissions?.modules?.profile ?? true },
            ].filter(item => item.visible)
        }
    ].filter(group => group.items.length > 0);

    // Flatten for BottomNav
    const flatNavItems = navGroups.flatMap(g => g.items);

    return (
        <div className="flex h-screen bg-background">
            {/* Sidebar - Hidden on Mobile, Visible on Desktop */}
            <aside
                className={`hidden md:flex ${sidebarOpen ? 'w-72' : 'w-20'} bg-card border-r border-border/50 transition-all duration-300 ease-in-out flex-col shadow-xl z-[10000] relative`}
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

                <nav className="flex-1 px-3 py-6 space-y-6 overflow-x-hidden overflow-y-auto custom-scrollbar">
                    {navGroups.map((group, groupIndex) => (
                        <div key={groupIndex} className="space-y-1">
                            {sidebarOpen && (
                                <h3 className="px-4 text-xs font-bold uppercase tracking-wider text-muted-foreground/60 mb-2">
                                    {group.title}
                                </h3>
                            )}
                            {group.items.map((item) => {
                                const Icon = item.icon;
                                const isActive = location.pathname === item.path;

                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-300 group relative overflow-hidden ${isActive
                                            ? 'bg-primary/10 text-primary font-medium'
                                            : 'text-muted-foreground hover:bg-violet-50 hover:text-violet-600 dark:hover:bg-violet-900/20 dark:hover:text-violet-400'
                                            }`}
                                    >
                                        <div className={`relative shrink-0 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                                            <Icon size={20} />
                                            {!sidebarOpen && item.badge !== undefined && (
                                                <span className={`absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${item.badgeColor}`}>
                                                    {item.badge > 99 ? '99+' : item.badge}
                                                </span>
                                            )}
                                        </div>

                                        <span className={`flex-1 whitespace-nowrap transition-all duration-300 ${sidebarOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 absolute left-12'}`}>
                                            {item.label}
                                        </span>

                                        {sidebarOpen && item.badge !== undefined && (
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${item.badgeColor} ml-auto shrink-0 animate-in zoom-in`}>
                                                {item.badge > 99 ? '99+' : item.badge}
                                            </span>
                                        )}

                                        {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1/2 w-1 bg-primary rounded-r-full" />}
                                    </Link>
                                );
                            })}
                        </div>
                    ))}
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
                <header className="bg-card border-b border-border px-4 md:px-6 py-4 flex items-center justify-between sticky top-0 z-[9990]">
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
            <BottomNav items={flatNavItems} />
        </div>
    );
};


export default AdminLayout;
