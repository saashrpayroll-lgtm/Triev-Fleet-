import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import {
    LayoutDashboard, Users, UserCog, Database, FileText, Activity, User,
    LogOut, Menu, X, Bell, ShieldAlert, Target, Trophy, TrendingUp,
    Layout, Bot, RefreshCw, Search, ChevronRight, Sliders
} from 'lucide-react';
import NotificationsDropdown from '@/components/NotificationsDropdown';
import { ThemeToggle } from '@/components/ThemeToggle';
import BottomNav from '@/components/layout/BottomNav';
import GlobalSearch from '@/components/GlobalSearch';
import { supabase } from '@/config/supabase';

interface NavItem {
    path: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    icon: any;
    label: string;
    visible?: boolean;
    badge?: number;
    badgeColor?: string;
    emoji?: string;
}

interface NavGroup {
    title: string;
    items: NavItem[];
    color?: string;
}

const AdminLayout: React.FC = () => {
    const { userData, signOut } = useSupabaseAuth();
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [searchOpen, setSearchOpen] = useState(false);

    // Live Badges State
    const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
    const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

    const fetchCounts = useCallback(async () => {
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
    }, [userData]);

    React.useEffect(() => {
        if (!userData) return;
        fetchCounts();

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
    }, [userData, fetchCounts]);

    // Cmd+K shortcut
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setSearchOpen(prev => !prev);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

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
            color: 'text-indigo-400',
            items: [
                { path: '/portal', icon: LayoutDashboard, label: 'Dashboard', emoji: '📊', visible: userData?.permissions?.dashboard?.view ?? true },
                { path: '/portal/analytics', icon: TrendingUp, label: 'Analytics', emoji: '📈', visible: userData?.permissions?.dashboard?.charts?.revenue ?? true },
                { path: '/portal/leaderboard', icon: Trophy, label: 'Leaderboard', emoji: '🏆', visible: userData?.permissions?.dashboard?.view ?? true },
            ].filter(item => item.visible)
        },
        {
            title: 'Operations',
            color: 'text-emerald-400',
            items: [
                { path: '/portal/riders', icon: Users, label: 'Riders', emoji: '🛵', visible: userData?.permissions?.modules?.riders ?? true },
                { path: '/portal/leads', icon: Target, label: 'Leads', emoji: '🎯', visible: userData?.permissions?.modules?.leads ?? true },
                {
                    path: '/portal/requests',
                    icon: ShieldAlert,
                    label: 'Requests',
                    emoji: '📋',
                    visible: userData?.permissions?.modules?.requests ?? true,
                    badge: pendingRequestsCount > 0 ? pendingRequestsCount : undefined,
                    badgeColor: 'bg-orange-500 text-white'
                },
            ].filter(item => item.visible)
        },
        {
            title: 'Management',
            color: 'text-violet-400',
            items: [
                { path: '/portal/cityops-performance', icon: Activity, label: 'CityOps Performance', emoji: '🏙️', visible: userData?.permissions?.dashboard?.view ?? true },
                { path: '/portal/rm-performance', icon: Activity, label: 'RM Performance', emoji: '📡', visible: userData?.permissions?.dashboard?.view ?? true },
                { path: '/portal/tl-performance', icon: Activity, label: 'TL Performance', emoji: '👥', visible: userData?.permissions?.dashboard?.view ?? true },
                { path: '/portal/risk-matrix', icon: Sliders, label: 'TL Risk Matrix', emoji: '🧮', visible: true },
                { path: '/portal/tl-allotment', icon: Layout, label: 'Allotment System', emoji: '🗂️', visible: userData?.permissions?.dashboard?.view ?? true },
                { path: '/portal/forms', icon: FileText, label: 'Company Forms', emoji: '📄', visible: userData?.permissions?.modules?.requests ?? true },
            ].filter(item => item.visible)
        },
        {
            title: 'Financials',
            color: 'text-amber-400',
            items: [
                { path: '/portal/data', icon: Database, label: 'Data Hub', emoji: '💾', visible: userData?.permissions?.modules?.dataManagement ?? true },
                { path: '/portal/wallet-history', icon: Database, label: 'Wallet Logs', emoji: '💰', visible: userData?.permissions?.modules?.riders ?? true },
                { path: '/portal/reports', icon: FileText, label: 'Reports', emoji: '📑', visible: userData?.permissions?.modules?.reports ?? true },
            ].filter(item => item.visible)
        },
        {
            title: 'System',
            color: 'text-rose-400',
            items: [
                { path: '/portal/ai-calling', icon: Bot, label: 'AI Call Center', emoji: '🤖', visible: userData?.permissions?.aiCalling?.enabled ?? true },
                { path: '/portal/users', icon: UserCog, label: 'Staff & Roles', emoji: '⚙️', visible: userData?.permissions?.modules?.users ?? true },
                { path: '/portal/broadcast', icon: ShieldAlert, label: 'Broadcast Center', emoji: '📢', visible: userData?.permissions?.notifications?.broadcast ?? true },
                { path: '/portal/activity-log', icon: Activity, label: 'Activity Logs', emoji: '🗒️', visible: userData?.permissions?.modules?.activityLog ?? true },
                {
                    path: '/portal/notifications',
                    icon: Bell,
                    label: 'Notifications',
                    emoji: '🔔',
                    visible: userData?.permissions?.modules?.notifications ?? true,
                    badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined,
                    badgeColor: 'bg-red-500 text-white'
                },
                { path: '/portal/profile', icon: User, label: 'My Profile', emoji: '👤', visible: userData?.permissions?.modules?.profile ?? true },
            ].filter(item => item.visible)
        }
    ].filter(group => group.items.length > 0);

    // Flatten for BottomNav
    const flatNavItems = navGroups.flatMap(g => g.items);

    // Breadcrumb from pathname
    const pathParts = location.pathname.replace('/portal', '').split('/').filter(Boolean);
    const breadcrumb = pathParts.length === 0 ? ['Dashboard'] : pathParts.map(p => p.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));

    return (
        <div className="flex h-screen bg-background">
            {/* Global Search */}
            <GlobalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} portalBase="/portal" />

            {/* ── Sidebar ──────────────────────────────────────────────────── */}
            <aside className={`hidden md:flex ${sidebarOpen ? 'w-72' : 'w-20'} transition-all duration-300 ease-in-out flex-col shadow-xl z-[10000] relative`}
                style={{ background: 'hsl(var(--card))', borderRight: '1px solid hsl(var(--border)/0.5)' }}>

                {/* Gradient accent stripe on left edge */}
                <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-indigo-500 via-violet-500 to-pink-500 rounded-r-full" />

                {/* Toggle Button */}
                <button
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    className="absolute -right-3 top-6 bg-primary text-primary-foreground p-1.5 rounded-full shadow-lg hover:scale-110 transition-transform z-50 border-2 border-background"
                >
                    {sidebarOpen ? <X size={14} /> : <Menu size={14} />}
                </button>

                {/* Brand Header */}
                <div className={`p-5 flex items-center gap-3 ${sidebarOpen ? 'justify-start' : 'justify-center'} border-b border-border/40`}>
                    <motion.div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-base shadow-lg shrink-0"
                        style={{ background: 'linear-gradient(135deg, #6366f1, #7c3aed)' }}
                        animate={{ boxShadow: ['0 0 10px rgba(99,102,241,0.3)', '0 0 20px rgba(99,102,241,0.5)', '0 0 10px rgba(99,102,241,0.3)'] }}
                        transition={{ duration: 3, repeat: Infinity }}
                    >
                        A
                    </motion.div>
                    <AnimatePresence>
                        {sidebarOpen && (
                            <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                transition={{ duration: 0.2 }}
                            >
                                <h1 className="font-black text-base bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-transparent whitespace-nowrap">Admin Panel</h1>
                                <p className="text-[9px] text-muted-foreground/50 font-mono tracking-widest uppercase">v2.5.0 • Command Center</p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Search shortcut */}
                {sidebarOpen && (
                    <div className="px-4 pt-4 pb-1">
                        <button
                            onClick={() => setSearchOpen(true)}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-border/50 bg-muted/30 hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-all group text-sm"
                        >
                            <Search size={14} className="shrink-0" />
                            <span className="flex-1 text-left text-[12px]">Search riders, pages...</span>
                            <kbd className="hidden sm:inline-flex text-[9px] font-mono bg-background border border-border px-1.5 py-0.5 rounded-md">⌘K</kbd>
                        </button>
                    </div>
                )}
                {!sidebarOpen && (
                    <div className="px-2 pt-4 pb-1">
                        <button onClick={() => setSearchOpen(true)} className="w-full flex items-center justify-center p-2 rounded-xl hover:bg-muted/50 text-muted-foreground hover:text-primary transition-all" title="Search (Ctrl+K)">
                            <Search size={18} />
                        </button>
                    </div>
                )}

                {/* Nav groups */}
                <nav className="flex-1 px-3 py-4 space-y-6 overflow-x-hidden overflow-y-auto custom-scrollbar">
                    {navGroups.map((group, groupIndex) => (
                        <div key={groupIndex} className="space-y-1">
                            {sidebarOpen && (
                                <motion.h3
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className={`px-3 text-[9px] font-black uppercase tracking-[0.2em] mb-2 flex items-center gap-2 ${group.color || 'text-muted-foreground/40'}`}
                                >
                                    {group.title}
                                    <div className="h-[1px] flex-1 bg-gradient-to-r from-current to-transparent opacity-20" />
                                </motion.h3>
                            )}
                            {group.items.map((item) => {
                                const Icon = item.icon;
                                const isActive = location.pathname === item.path;

                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        title={!sidebarOpen ? item.label : undefined}
                                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative overflow-hidden ${isActive
                                            ? 'text-primary font-bold'
                                            : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        {/* Active / hover bg */}
                                        <div className={`absolute inset-0 rounded-xl transition-all duration-200 ${isActive ? 'bg-primary/10' : 'opacity-0 group-hover:opacity-100 bg-muted/60'}`} />

                                        {/* Left accent pill */}
                                        {isActive && (
                                            <motion.div
                                                layoutId="admin-active-pill"
                                                className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 bg-primary rounded-r-full shadow-[0_0_8px_rgba(99,102,241,0.6)]"
                                            />
                                        )}

                                        <div className={`relative shrink-0 transition-all duration-200 ${isActive ? 'text-primary scale-110' : 'group-hover:text-primary group-hover:scale-105'}`}>
                                            <Icon size={17} />
                                            {!sidebarOpen && item.badge !== undefined && (
                                                <span className={`absolute -top-2 -right-2 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[7px] font-black shadow-lg ${item.badgeColor}`}>
                                                    {item.badge > 9 ? '9+' : item.badge}
                                                </span>
                                            )}
                                        </div>

                                        <AnimatePresence>
                                            {sidebarOpen && (
                                                <motion.span
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                    className="relative flex-1 text-[13px] font-medium whitespace-nowrap"
                                                >
                                                    {item.label}
                                                </motion.span>
                                            )}
                                        </AnimatePresence>

                                        {sidebarOpen && item.badge !== undefined && (
                                            <span className={`relative px-1.5 py-0.5 rounded-lg text-[9px] font-black ${item.badgeColor} ml-auto shrink-0 shadow-sm`}>
                                                {item.badge > 99 ? '99+' : item.badge}
                                            </span>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    ))}
                </nav>

                {/* Logout footer */}
                <div className="p-3 border-t border-border/40">
                    <button
                        onClick={handleLogout}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 w-full text-left group relative overflow-hidden text-muted-foreground hover:text-red-500 hover:bg-red-500/8`}
                    >
                        <LogOut size={17} className="shrink-0 transition-transform duration-300 group-hover:rotate-12 group-hover:text-red-500" />
                        <AnimatePresence>
                            {sidebarOpen && (
                                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="font-medium text-[13px] whitespace-nowrap">
                                    Logout
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </button>

                    {sidebarOpen && (
                        <div className="mt-3 text-[9px] text-center text-muted-foreground/30 font-mono tracking-widest uppercase">
                            Triev Admin v2.5.0
                        </div>
                    )}
                </div>
            </aside>

            {/* ── Main Content ─────────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col overflow-hidden mb-24 md:mb-0 max-w-full">
                {/* Header */}
                <header className="bg-card/80 backdrop-blur-md border-b border-border/50 px-4 md:px-6 py-3.5 flex items-center justify-between sticky top-0 z-[9990]">
                    {/* Left: Mobile logo + Breadcrumb */}
                    <div className="flex items-center gap-3">
                        <div className="md:hidden w-8 h-8 rounded-xl flex items-center justify-center text-white font-black text-sm shadow shrink-0"
                            style={{ background: 'linear-gradient(135deg, #6366f1, #7c3aed)' }}>
                            A
                        </div>
                        {/* Breadcrumb — desktop only */}
                        <div className="hidden md:flex items-center gap-1.5 text-sm">
                            <span className="text-muted-foreground/50 font-medium">Portal</span>
                            {breadcrumb.map((crumb, i) => (
                                <React.Fragment key={i}>
                                    <ChevronRight size={13} className="text-muted-foreground/30" />
                                    <span className={i === breadcrumb.length - 1 ? 'text-foreground font-semibold' : 'text-muted-foreground/60 font-medium'}>
                                        {crumb}
                                    </span>
                                </React.Fragment>
                            ))}
                        </div>
                        <span className="md:hidden text-base font-semibold">Admin Panel</span>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 md:gap-3">
                        {/* Search button */}
                        <button
                            onClick={() => setSearchOpen(true)}
                            className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl border border-border/50 bg-muted/30 hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-all text-xs group"
                            title="Global Search (Ctrl+K)"
                        >
                            <Search size={14} />
                            <span className="hidden lg:inline">Search</span>
                            <kbd className="hidden lg:inline-flex text-[9px] font-mono bg-background border border-border px-1.5 py-0.5 rounded-md">⌘K</kbd>
                        </button>

                        <button
                            onClick={() => (window as any).forceAppUpdate?.()}
                            className="p-2 rounded-xl border border-border/50 hover:bg-muted/50 text-muted-foreground hover:text-primary transition-all flex items-center gap-1.5 text-xs font-semibold"
                            title="Force Sync & Clear Cache"
                        >
                            <RefreshCw size={15} />
                            <span className="hidden sm:inline">Sync</span>
                        </button>

                        <ThemeToggle />

                        {userData && (
                            <NotificationsDropdown userId={userData.id} userRole={userData.role} />
                        )}

                        {/* Avatar */}
                        <Link to="/portal/profile" className="flex items-center gap-2.5 pl-2 md:pl-3 border-l border-border/40 hover:opacity-80 transition-opacity">
                            <div className="text-right hidden md:block">
                                <p className="font-semibold text-sm leading-tight">{typeof userData?.fullName === 'string' ? userData.fullName : 'Admin'}</p>
                                <p className="text-[10px] text-muted-foreground capitalize">{typeof userData?.role === 'string' ? userData.role : 'admin'}</p>
                            </div>
                            <div className="w-8 h-8 md:w-9 md:h-9 rounded-full overflow-hidden border-2 border-primary/30 flex items-center justify-center shrink-0"
                                style={{ background: 'linear-gradient(135deg, #6366f1, #7c3aed)' }}>
                                {userData?.profilePicUrl ? (
                                    <img src={userData.profilePicUrl} alt="User" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-white font-bold text-sm">
                                        {(typeof userData?.fullName === 'string' ? userData.fullName : 'A').charAt(0).toUpperCase()}
                                    </span>
                                )}
                            </div>
                        </Link>
                    </div>
                </header>

                {/* ── Quick Stats Bar — 1-glance KPIs ─────────────────────────── */}
                <div className="hidden md:flex items-center gap-3 px-6 py-2 border-b border-border/30 bg-muted/20 flex-wrap text-xs font-semibold overflow-x-auto">
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Active Riders: <span className="font-black">{/* fetched via AdminDashboard */}Live</span></span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        <span>Pending Requests: <span className="font-black">{pendingRequestsCount}</span></span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                        <span>Unread Notifications: <span className="font-black">{unreadNotificationsCount}</span></span>
                    </div>
                    <div className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-full bg-card border border-border text-muted-foreground whitespace-nowrap">
                        <span>📅</span>
                        <span>{new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                </div>

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
