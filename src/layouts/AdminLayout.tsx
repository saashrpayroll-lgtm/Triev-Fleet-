import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
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
    Trophy,
    TrendingUp,
    Layout
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
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    const navGroups: NavGroup[] = [
        {
            title: 'Overview',
            items: [
                { path: '/portal', icon: LayoutDashboard, label: 'Dashboard', visible: userData?.permissions?.dashboard?.view ?? true },
                { path: '/portal/analytics', icon: TrendingUp, label: 'Analytics', visible: userData?.permissions?.dashboard?.charts?.revenue ?? true },
                { path: '/portal/leaderboard', icon: Trophy, label: 'Leaderboard', visible: userData?.permissions?.dashboard?.view ?? true },
            ].filter(item => item.visible)
        },
        {
            title: 'Operations',
            items: [
                { path: '/portal/riders', icon: Users, label: 'Riders', visible: userData?.permissions?.modules?.riders ?? true },
                { path: '/portal/leads', icon: Target, label: 'Leads', visible: userData?.permissions?.modules?.leads ?? true },
                {
                    path: '/portal/requests',
                    icon: ShieldAlert,
                    label: 'Requests',
                    visible: userData?.permissions?.modules?.requests ?? true,
                    badge: pendingRequestsCount > 0 ? pendingRequestsCount : undefined,
                    badgeColor: 'bg-orange-500 text-white'
                },
            ].filter(item => item.visible)
        },
        {
            title: 'Management',
            items: [
                { path: '/portal/tl-performance', icon: Activity, label: 'TL Performance', visible: userData?.permissions?.dashboard?.view ?? true },
                { path: '/portal/tl-allotment', icon: Layout, label: 'Allotment System', visible: userData?.permissions?.dashboard?.view ?? true },
                { path: '/portal/forms', icon: FileText, label: 'Company Forms', visible: userData?.permissions?.modules?.requests ?? true },
            ].filter(item => item.visible)
        },
        {
            title: 'Financials',
            items: [
                { path: '/portal/data', icon: Database, label: 'Data Hub', visible: userData?.permissions?.modules?.dataManagement ?? true },
                { path: '/portal/wallet-history', icon: Database, label: 'Wallet Logs', visible: userData?.permissions?.modules?.riders ?? true },
                { path: '/portal/reports', icon: FileText, label: 'Reports', visible: userData?.permissions?.modules?.reports ?? true },
            ].filter(item => item.visible)
        },
        {
            title: 'System',
            items: [
                { path: '/portal/users', icon: UserCog, label: 'Staff & Roles', visible: userData?.permissions?.modules?.users ?? true },
                { path: '/portal/broadcast', icon: ShieldAlert, label: 'Broadcast Center', visible: userData?.permissions?.notifications?.broadcast ?? true },
                { path: '/portal/activity-log', icon: Activity, label: 'Activity Logs', visible: userData?.permissions?.modules?.activityLog ?? true },
                {
                    path: '/portal/notifications',
                    icon: Bell,
                    label: 'Notifications',
                    visible: userData?.permissions?.modules?.notifications ?? true,
                    badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined,
                    badgeColor: 'bg-red-500 text-white'
                },
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

                <nav className="flex-1 px-3 py-6 space-y-7 overflow-x-hidden overflow-y-auto custom-scrollbar">
                    {navGroups.map((group, groupIndex) => (
                        <div key={groupIndex} className="space-y-2">
                            {sidebarOpen && (
                                <motion.h3
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="px-4 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/40 mb-3 flex items-center gap-2"
                                >
                                    {group.title}
                                    <div className="h-[1px] flex-1 bg-gradient-to-r from-border/50 to-transparent" />
                                </motion.h3>
                            )}
                            {group.items.map((item) => {
                                const Icon = item.icon;
                                const isActive = location.pathname === item.path;

                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-300 group relative overflow-hidden ${isActive
                                            ? 'text-primary font-bold'
                                            : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                    >
                                        {/* Hover background effect */}
                                        <div className={`absolute inset-0 transition-opacity duration-300 ${isActive
                                            ? 'bg-primary/10 opacity-100'
                                            : 'bg-primary/5 opacity-0 group-hover:opacity-100'
                                            }`} />

                                        {/* Activity Indicator */}
                                        {isActive && (
                                            <motion.div
                                                layoutId="active-pill"
                                                className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 bg-primary rounded-r-full shadow-[0_0_12px_rgba(var(--primary),0.5)]"
                                            />
                                        )}

                                        <div className={`relative shrink-0 transition-all duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110 group-hover:text-primary'}`}>
                                            <Icon size={18} className={isActive ? 'text-primary' : 'transition-colors duration-300'} />
                                            {!sidebarOpen && item.badge !== undefined && (
                                                <span className={`absolute -top-2 -right-2 flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-black shadow-lg ${item.badgeColor}`}>
                                                    {item.badge > 99 ? '99+' : item.badge}
                                                </span>
                                            )}
                                        </div>

                                        <span className={`relative flex-1 text-sm tracking-tight whitespace-nowrap transition-all duration-300 ${sidebarOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 absolute left-12'}`}>
                                            {item.label}
                                        </span>

                                        {sidebarOpen && item.badge !== undefined && (
                                            <span className={`relative px-2 py-0.5 rounded-lg text-[9px] font-black ${item.badgeColor} ml-auto shrink-0 animate-in zoom-in shadow-sm`}>
                                                {item.badge > 99 ? '99+' : item.badge}
                                            </span>
                                        )}
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
