import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import {
    LayoutDashboard, Users, FileText, Activity, LogOut, Menu,
    X, Wallet, User, Target, ShieldAlert, Bell, RefreshCw, Search, ChevronRight, Sliders
} from 'lucide-react';
import NotificationsDropdown from '@/components/NotificationsDropdown';
import { ThemeToggle } from '@/components/ThemeToggle';
import { safeRender } from '@/utils/safeRender';
import BottomNav from '@/components/layout/BottomNav';
import GlobalSearch from '@/components/GlobalSearch';
import { supabase } from '@/config/supabase';
import { toast } from 'sonner';

interface NavItem {
    path: string;
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

const TeamLeaderLayout: React.FC = () => {
    const { userData, signOut } = useSupabaseAuth();
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [searchOpen, setSearchOpen] = useState(false);

    // Live Badges State
    const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

    const fetchCounts = useCallback(async () => {
        if (!userData) return;
        try {
            const { count: reqCount } = await supabase.from('requests').select('*', { count: 'exact', head: true }).eq('user_id', userData.id).in('status', ['pending', 'open']);
            setPendingRequestsCount(reqCount || 0);
        } catch (e) {
            console.error("Failed to fetch TL sidebar counts:", e);
        }
    }, [userData]);

    React.useEffect(() => {
        if (!userData) return;
        fetchCounts();

        const reqChannel = supabase.channel('tl-requests-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'requests', filter: `user_id=eq.${userData.id}` }, () => fetchCounts())
            .subscribe();

        const notifChannel = supabase.channel('tl-notifications-popup')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, (payload) => {
                const n = payload.new;
                const isForMe = n.target_role === 'all' ||
                    n.target_role === 'teamLeader' ||
                    (n.target_role === 'single_user' && n.target_id === userData.id);

                if (isForMe) {
                    toast.custom(() => (
                        <div className={`p-4 rounded-xl border-l-4 shadow-2xl bg-background border whitespace-pre-wrap ${n.priority === 'high' ? 'border-l-red-500' : 'border-l-primary'}`}>
                            <div className="flex items-center gap-2 mb-1">
                                {n.priority === 'high' ? <ShieldAlert size={16} className="text-red-500" /> : <Bell size={16} className="text-primary" />}
                                <span className="font-bold text-sm text-foreground">{n.title}</span>
                            </div>
                            <p className="text-xs text-muted-foreground ml-6">{n.body}</p>
                        </div>
                    ), { duration: n.priority === 'high' ? 10000 : 6000, position: 'top-center' });
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(reqChannel);
            supabase.removeChannel(notifChannel);
        };
    }, [userData, fetchCounts]);


    // Cmd+K
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
            color: 'text-amber-400',
            items: [
                { path: '/team-leader', icon: LayoutDashboard, label: 'Dashboard', emoji: '📊', visible: userData?.permissions?.dashboard?.view ?? true },
            ].filter(item => { if (item.visible === undefined) return true; return item.visible; })
        },
        {
            title: 'Operations',
            color: 'text-emerald-400',
            items: [
                { path: '/team-leader/riders', icon: Users, label: 'My Riders', emoji: '🛵', visible: userData?.permissions?.modules?.riders ?? true },
                { path: '/team-leader/leads', icon: Target, label: 'My Leads', emoji: '🎯', visible: userData?.permissions?.modules?.leads ?? true },
                { path: '/team-leader/forms', icon: FileText, label: 'Company Forms', emoji: '📄', visible: true },
                {
                    path: '/team-leader/requests',
                    icon: ShieldAlert,
                    label: 'Support Tickets',
                    emoji: '🎫',
                    visible: userData?.permissions?.modules?.requests ?? true,
                    badge: pendingRequestsCount > 0 ? pendingRequestsCount : undefined,
                    badgeColor: 'bg-orange-500 text-white'
                },
            ].filter(item => { if (item.visible === undefined) return true; return item.visible; })
        },
        {
            title: 'Logs & Reports',
            color: 'text-indigo-400',
            items: [
                { path: '/team-leader/wallet-history', icon: Wallet, label: 'Wallet Logs', emoji: '💰', visible: userData?.permissions?.wallet?.viewHistory ?? true },
                { path: '/team-leader/risk-matrix', icon: Sliders, label: 'TL Risk Matrix', emoji: '🧮', visible: true },
                { path: '/team-leader/reports', icon: FileText, label: 'Reports', emoji: '📑', visible: userData?.permissions?.modules?.reports ?? true },
                { path: '/team-leader/activity-log', icon: Activity, label: 'Activity Logs', emoji: '🗒️', visible: userData?.permissions?.modules?.activityLog ?? true },
            ].filter(item => { if (item.visible === undefined) return true; return item.visible; })
        },
        {
            title: 'Settings',
            color: 'text-slate-400',
            items: [
                { path: '/team-leader/notifications', icon: Bell, label: 'Notifications', emoji: '🔔', visible: userData?.permissions?.modules?.notifications ?? true },
                { path: '/team-leader/profile', icon: User, label: 'My Profile', emoji: '👤', visible: userData?.permissions?.modules?.profile ?? true },
            ].filter(item => { if (item.visible === undefined) return true; return item.visible; })
        }
    ].filter(group => group.items.length > 0);

    const flatNavItems = navGroups.flatMap(g => g.items);

    // Breadcrumb
    const pathParts = location.pathname.replace('/team-leader', '').split('/').filter(Boolean);
    const breadcrumb = pathParts.length === 0 ? ['Dashboard'] : pathParts.map(p => p.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));

    return (
        <div className="flex h-screen bg-background">
            <GlobalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} portalBase="/team-leader" />

            {/* ── Sidebar ─────────────────────────────────────────────── */}
            <aside className={`hidden md:flex ${sidebarOpen ? 'w-64' : 'w-20'} transition-all duration-300 flex-col shadow-lg z-[10000] relative`}
                style={{ background: 'hsl(var(--card))', borderRight: '1px solid hsl(var(--border)/0.5)' }}>

                {/* Amber gradient accent stripe */}
                <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-amber-400 via-orange-400 to-rose-400 rounded-r-full" />

                {/* Brand Header */}
                <div className={`p-4 flex items-center ${sidebarOpen ? 'gap-3 justify-start' : 'justify-center'} border-b border-border/40 relative`}>
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="absolute -right-3 top-4 bg-amber-500 text-white p-1.5 rounded-full shadow-lg hover:scale-110 transition-transform z-50 border-2 border-background"
                    >
                        {sidebarOpen ? <X size={13} /> : <Menu size={13} />}
                    </button>

                    <motion.div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-base shadow shrink-0"
                        style={{ background: 'linear-gradient(135deg, #f59e0b, #ea580c)' }}
                        animate={{ boxShadow: ['0 0 10px rgba(245,158,11,0.3)', '0 0 20px rgba(245,158,11,0.5)', '0 0 10px rgba(245,158,11,0.3)'] }}
                        transition={{ duration: 3, repeat: Infinity }}
                    >
                        T
                    </motion.div>
                    <AnimatePresence>
                        {sidebarOpen && (
                            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
                                <h1 className="font-black text-sm bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent whitespace-nowrap">Triev Rider Pro</h1>
                                <p className="text-[9px] text-muted-foreground/40 font-mono tracking-widest uppercase">Team Leader Panel</p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Search shortcut */}
                {sidebarOpen && (
                    <div className="px-3 pt-3 pb-1">
                        <button onClick={() => setSearchOpen(true)}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-border/50 bg-muted/30 hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-all text-xs">
                            <Search size={13} className="shrink-0" />
                            <span className="flex-1 text-left text-[11px]">Search riders...</span>
                            <kbd className="hidden sm:inline-flex text-[9px] font-mono bg-background border border-border px-1.5 py-0.5 rounded-md">⌘K</kbd>
                        </button>
                    </div>
                )}
                {!sidebarOpen && (
                    <div className="px-2 pt-3 pb-1">
                        <button onClick={() => setSearchOpen(true)} className="w-full flex items-center justify-center p-2 rounded-xl hover:bg-muted/50 text-muted-foreground hover:text-amber-500 transition-all" title="Search (Ctrl+K)">
                            <Search size={17} />
                        </button>
                    </div>
                )}

                {/* Nav */}
                <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto custom-scrollbar">
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
                                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative overflow-hidden ${isActive ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-muted-foreground hover:text-foreground'}`}
                                    >
                                        <div className={`absolute inset-0 rounded-xl transition-all duration-200 ${isActive ? 'bg-amber-500/10' : 'opacity-0 group-hover:opacity-100 bg-muted/60'}`} />

                                        {isActive && (
                                            <motion.div
                                                layoutId="tl-active-pill"
                                                className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 bg-amber-500 rounded-r-full shadow-[0_0_8px_rgba(245,158,11,0.6)]"
                                            />
                                        )}

                                        <div className={`relative shrink-0 transition-all duration-200 ${isActive ? 'text-amber-500 scale-110' : 'group-hover:text-amber-500 group-hover:scale-105'}`}>
                                            <Icon size={17} />
                                            {!sidebarOpen && item.badge !== undefined && (
                                                <span className={`absolute -top-2 -right-2 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[7px] font-black shadow-lg ${item.badgeColor}`}>
                                                    {item.badge > 9 ? '9+' : item.badge}
                                                </span>
                                            )}
                                        </div>

                                        <AnimatePresence>
                                            {sidebarOpen && (
                                                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative flex-1 text-[13px] font-medium whitespace-nowrap">
                                                    {item.label}
                                                </motion.span>
                                            )}
                                        </AnimatePresence>

                                        {sidebarOpen && item.badge !== undefined && (
                                            <span className={`relative px-1.5 py-0.5 rounded-lg text-[9px] font-black ${item.badgeColor} ml-auto shrink-0 shadow-sm`}>
                                                {item.badge}
                                            </span>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    ))}
                </nav>

                {/* Logout */}
                <div className="p-3 border-t border-border/40">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 w-full text-left group text-muted-foreground hover:text-red-500 hover:bg-red-500/8"
                    >
                        <LogOut size={17} className="shrink-0 group-hover:rotate-12 group-hover:text-red-500 transition-transform duration-300" />
                        <AnimatePresence>
                            {sidebarOpen && (
                                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="font-medium text-[13px]">Logout</motion.span>
                            )}
                        </AnimatePresence>
                    </button>
                    {sidebarOpen && (
                        <div className="mt-2 text-[9px] text-center text-muted-foreground/30 font-mono tracking-widest uppercase">Triev Rider Pro v2.5</div>
                    )}
                </div>
            </aside>

            {/* ── Main Content ─────────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col overflow-hidden mb-24 md:mb-0 max-w-full">
                {/* Header */}
                <header className="bg-card/80 backdrop-blur-md border-b border-border/50 px-4 md:px-6 py-3.5 flex items-center justify-between sticky top-0 z-[9990]">
                    <div className="flex items-center gap-3">
                        <div className="md:hidden w-8 h-8 rounded-xl flex items-center justify-center text-white font-black shadow shrink-0"
                            style={{ background: 'linear-gradient(135deg, #f59e0b, #ea580c)' }}>
                            T
                        </div>
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
                        <span className="md:hidden text-base font-semibold">Triev Rider Pro</span>
                    </div>

                    <div className="flex items-center gap-2 md:gap-3">
                        <button
                            onClick={() => setSearchOpen(true)}
                            className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl border border-border/50 bg-muted/30 hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-all text-xs"
                        >
                            <Search size={14} />
                            <span className="hidden lg:inline">Search</span>
                            <kbd className="hidden lg:inline-flex text-[9px] font-mono bg-background border border-border px-1.5 py-0.5 rounded-md">⌘K</kbd>
                        </button>

                        <button
                            onClick={() => (window as any).forceAppUpdate?.()}
                            className="p-2 rounded-xl border border-border/50 hover:bg-muted/50 text-muted-foreground hover:text-amber-500 transition-all flex items-center gap-1.5 text-xs font-semibold"
                            title="Force Sync & Clear Cache"
                        >
                            <RefreshCw size={15} />
                            <span className="hidden sm:inline">Sync</span>
                        </button>

                        <ThemeToggle />

                        {userData && (
                            <NotificationsDropdown userId={userData.id} userRole={userData.role} />
                        )}

                        <div className="flex items-center gap-2 pl-2 md:pl-3 border-l border-border/40">
                            <div className="text-right hidden md:block">
                                <p className="font-semibold text-sm leading-tight">{safeRender(userData?.fullName, 'Leader')}</p>
                                <p className="text-[10px] text-muted-foreground capitalize">{safeRender(userData?.role)}</p>
                            </div>
                            {userData?.permissions?.modules?.profile ? (
                                <Link to="/team-leader/profile" className="w-8 h-8 md:w-9 md:h-9 rounded-full overflow-hidden border-2 border-amber-500/30 hover:border-amber-500 transition-all flex items-center justify-center shrink-0"
                                    style={{ background: 'linear-gradient(135deg, #f59e0b, #ea580c)' }}>
                                    {userData?.profilePicUrl ? (
                                        <img src={userData.profilePicUrl} alt="avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-white font-bold text-sm">{safeRender(userData?.fullName || 'L').charAt(0).toUpperCase()}</span>
                                    )}
                                </Link>
                            ) : (
                                <div className="w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center text-white font-bold shrink-0"
                                    style={{ background: 'linear-gradient(135deg, #f59e0b, #ea580c)' }}>
                                    {safeRender(userData?.fullName || 'L').charAt(0).toUpperCase()}
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-background">
                    <Outlet />
                </main>
            </div>

            <BottomNav items={flatNavItems} />
        </div>
    );
};

export default TeamLeaderLayout;
