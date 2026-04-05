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
    Target,
    Trophy,
    TrendingUp,
    Layout,
    type LucideIcon
} from 'lucide-react';
import NotificationsDropdown from '@/components/NotificationsDropdown';
import { ThemeToggle } from '@/components/ThemeToggle';
import BottomNav from '@/components/layout/BottomNav';
import { supabase } from '@/config/supabase';

interface NavItem {
    path: string;
    icon: LucideIcon;
    label: string;
    visible?: boolean;
    badge?: number;
    badgeColor?: string;
}

interface NavGroup {
    title: string;
    items: NavItem[];
}

const CityOpsLayout: React.FC = () => {
    const { userData, signOut } = useSupabaseAuth();
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(true);

    // Live Badges State
    const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

    const fetchCounts = React.useCallback(async () => {
        if (!userData) return;
        try {
            const { count: notifCount } = await supabase
                .from('notifications')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userData.id)
                .eq('is_read', false);
            setUnreadNotificationsCount(notifCount || 0);
        } catch (e) {
            console.error("Failed to fetch sidebar counts:", e);
        }
    }, [userData]);

    React.useEffect(() => {
        if (!userData) return;
        fetchCounts();

        const notifChannel = supabase.channel('cityops-notif-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userData.id}` }, () => fetchCounts())
            .subscribe();

        return () => {
            supabase.removeChannel(notifChannel);
        };
    }, [userData, fetchCounts]);

    const handleLogout = async () => {
        try {
            await signOut();
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const perms = userData?.permissions?.cityOpsPanel as any;

    const navGroups: NavGroup[] = [
        {
            title: 'Overview',
            items: [
                { path: '/city-ops', icon: LayoutDashboard, label: 'Dashboard', visible: perms?.dashboard?.view ?? perms?.dashboard ?? true },
                { path: '/city-ops/analytics', icon: TrendingUp, label: 'Analytics', visible: perms?.analytics ?? true },
                { path: '/city-ops/leaderboard', icon: Trophy, label: 'Leaderboard', visible: perms?.leaderboard ?? true },
            ].filter(item => item.visible)
        },
        {
            title: 'Operations',
            items: [
                { path: '/city-ops/riders', icon: Users, label: 'Riders', visible: perms?.riderManagement ?? true },
                { path: '/city-ops/leads', icon: Target, label: 'Leads', visible: perms?.leadManagement ?? true },
            ].filter(item => item.visible)
        },
        {
            title: 'Performance',
            items: [
                { path: '/city-ops/rm-performance', icon: Activity, label: 'RM Performance', visible: perms?.rmPerformance ?? true },
                { path: '/city-ops/tl-performance', icon: Activity, label: 'TL Performance', visible: perms?.tlPerformance ?? true },
                { path: '/city-ops/tl-allotment', icon: Layout, label: 'Allotment System', visible: perms?.allotmentSystem ?? true },
                { path: '/city-ops/forms', icon: FileText, label: 'Company Forms', visible: perms?.companyForms ?? true },
            ].filter(item => item.visible)
        },
        {
            title: 'Data & Finance',
            items: [
                { path: '/city-ops/data', icon: Database, label: 'Data Hub', visible: perms?.dataManagement?.bulkRiderImport ?? true },
                { path: '/city-ops/wallet-history', icon: Database, label: 'Wallet Logs', visible: perms?.walletLedger ?? true },
                { path: '/city-ops/reports', icon: FileText, label: 'Reports', visible: perms?.reports ?? true },
            ].filter(item => item.visible)
        },
        {
            title: 'System',
            items: [
                { path: '/city-ops/users', icon: UserCog, label: 'Staff & Roles', visible: perms?.staffRoles ?? true },
                { path: '/city-ops/activity-log', icon: Activity, label: 'Activity Logs', visible: perms?.activityLog ?? true },
                {
                    path: '/city-ops/notifications',
                    icon: Bell,
                    label: 'Notifications',
                    visible: perms?.notifications ?? true,
                    badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined,
                    badgeColor: 'bg-red-500 text-white'
                },
                { path: '/city-ops/profile', icon: User, label: 'My Profile', visible: perms?.profile ?? true },
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
                {/* Toggle Button */}
                <button
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    className="absolute -right-3 top-6 bg-amber-500 text-white p-1.5 rounded-full shadow-lg hover:scale-110 transition-transform z-50 border-2 border-background"
                >
                    {sidebarOpen ? <X size={14} /> : <Menu size={14} />}
                </button>

                <div className={`p-6 flex items-center gap-3 ${sidebarOpen ? 'justify-start' : 'justify-center'} border-b border-border/50`}>
                    <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-lg shrink-0">
                        C
                    </div>
                    <h1 className={`font-bold text-lg bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent whitespace-nowrap transition-all duration-300 ${sidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0 overflow-hidden'}`}>
                        City Ops Panel
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
                                const isActive = location.pathname === item.path ||
                                    (item.path !== '/city-ops' && location.pathname.startsWith(item.path));

                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        className={`group relative flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                                            ${isActive
                                                ? 'bg-gradient-to-r from-amber-500/15 to-orange-500/10 text-amber-600 dark:text-amber-400 shadow-sm'
                                                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                                            }
                                            ${!sidebarOpen ? 'justify-center' : ''}
                                        `}
                                        title={!sidebarOpen ? item.label : undefined}
                                    >
                                        {isActive && (
                                            <motion.div
                                                layoutId="cityops-sidebar-indicator"
                                                className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-amber-500 rounded-r-full"
                                            />
                                        )}
                                        <Icon size={20} className={`shrink-0 transition-transform duration-200 ${isActive ? 'text-amber-500' : 'group-hover:scale-110'}`} />
                                        <span className={`transition-all duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
                                            {item.label}
                                        </span>
                                        {item.badge && sidebarOpen && (
                                            <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full ${item.badgeColor}`}>
                                                {item.badge}
                                            </span>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    ))}
                </nav>

                {/* User Info + Logout */}
                <div className="border-t border-border/50 p-4">
                    <div className={`flex items-center gap-3 ${!sidebarOpen ? 'justify-center' : ''}`}>
                        <div className="w-9 h-9 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
                            {userData?.fullName?.charAt(0) || 'C'}
                        </div>
                        {sidebarOpen && (
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold truncate">{userData?.fullName || 'City Ops'}</p>
                                <p className="text-[10px] text-amber-500 font-medium">{userData?.userId || 'City Ops'}</p>
                            </div>
                        )}
                        <button
                            onClick={handleLogout}
                            className={`p-2 hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors ${!sidebarOpen ? 'mt-2' : ''}`}
                            title="Logout"
                        >
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Top Navbar - Mobile */}
                <header className="md:hidden flex items-center justify-between p-4 bg-card border-b border-border shadow-sm z-[9999]">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center text-white font-bold">
                            C
                        </div>
                        <span className="font-bold text-lg bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">City Ops</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        <NotificationsDropdown userId={userData?.id || ''} userRole="cityOps" />
                    </div>
                </header>

                {/* Desktop Top Bar */}
                <header className="hidden md:flex items-center justify-between px-8 py-3 bg-card/80 backdrop-blur-lg border-b border-border/50 z-[9998]">
                    <div>
                        <h2 className="text-base font-bold text-foreground">
                            Welcome, {userData?.fullName || 'City Ops'}
                        </h2>
                        <p className="text-xs text-muted-foreground">
                            City Operations • {userData?.jobLocation || 'All Locations'}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <ThemeToggle />
                        <NotificationsDropdown userId={userData?.id || ''} userRole="cityOps" />
                    </div>
                </header>

                {/* Scrollable Content */}
                <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-20 md:pb-8">
                    <Outlet />
                </main>
            </div>

            {/* Bottom Navigation - Mobile Only */}
            <BottomNav items={flatNavItems} />
        </div>
    );
};

export default CityOpsLayout;
