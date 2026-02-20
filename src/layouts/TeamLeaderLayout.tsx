import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { LayoutDashboard, Users, FileText, Activity, LogOut, Menu, X, HelpCircle, Wallet } from 'lucide-react';
import NotificationsDropdown from '@/components/NotificationsDropdown';
import { ThemeToggle } from '@/components/ThemeToggle';
import { safeRender } from '@/utils/safeRender';
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

const TeamLeaderLayout: React.FC = () => {
    const { userData, signOut } = useSupabaseAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(true);

    // Live Badges State
    const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

    React.useEffect(() => {
        if (!userData) return;
        fetchCounts();

        // Subscriptions
        const reqChannel = supabase.channel('tl-requests-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'requests', filter: `user_id=eq.${userData.id}` }, () => fetchCounts())
            .subscribe();

        return () => {
            supabase.removeChannel(reqChannel);
        };
    }, [userData]);

    const fetchCounts = async () => {
        if (!userData) return;
        try {
            const { count: reqCount } = await supabase.from('requests').select('*', { count: 'exact', head: true }).eq('user_id', userData.id).in('status', ['pending', 'open']); // Track their pending requests
            setPendingRequestsCount(reqCount || 0);
        } catch (e) {
            console.error("Failed to fetch TL sidebar counts:", e);
        }
    };

    // DEBUG: Monitor permissions

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
                { path: '/team-leader', icon: LayoutDashboard, label: 'Dashboard', visible: userData?.permissions?.dashboard?.view ?? true },
            ].filter(item => { if (item.visible === undefined) return true; return item.visible; })
        },
        {
            title: 'My Team',
            items: [
                { path: '/team-leader/riders', icon: Users, label: 'My Riders', visible: userData?.permissions?.modules?.riders ?? true },
                { path: '/team-leader/leads', icon: Users, label: 'My Leads', visible: userData?.permissions?.modules?.leads ?? true },
                {
                    path: '/team-leader/requests',
                    icon: HelpCircle,
                    label: 'My Requests',
                    visible: userData?.permissions?.modules?.requests ?? true,
                    badge: pendingRequestsCount > 0 ? pendingRequestsCount : undefined,
                    badgeColor: 'bg-orange-500 text-white'
                },
            ].filter(item => { if (item.visible === undefined) return true; return item.visible; })
        },
        {
            title: 'Financials & Logs',
            items: [
                { path: '/team-leader/wallet-history', icon: Wallet, label: 'Wallet History', visible: userData?.permissions?.wallet?.viewHistory ?? true },
                { path: '/team-leader/reports', icon: FileText, label: 'Reports', visible: userData?.permissions?.modules?.reports ?? true },
                { path: '/team-leader/activity-log', icon: Activity, label: 'Activity Log', visible: userData?.permissions?.modules?.activityLog ?? true },
            ].filter(item => { if (item.visible === undefined) return true; return item.visible; })
        }
    ].filter(group => group.items.length > 0);

    // Flatten for BottomNav
    const flatNavItems = navGroups.flatMap(g => g.items);

    return (
        <div className="flex h-screen bg-background">
            {/* Sidebar - Hidden on Mobile */}
            <aside
                className={`hidden md:flex ${sidebarOpen ? 'w-64' : 'w-20'
                    } bg-card border-r border-border transition-all duration-300 flex-col shadow-lg z-20`}
            >
                <div className="p-4 border-b border-border flex items-center justify-between bg-primary/5">
                    {sidebarOpen && (
                        <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                            Triev Rider Pro
                        </h1>
                    )}
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="p-2 hover:bg-accent rounded-md transition-colors"
                    >
                        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>

                <nav className="flex-1 px-3 py-6 space-y-6 overflow-y-auto custom-scrollbar">
                    {navGroups.map((group, groupIndex) => (
                        <div key={groupIndex} className="space-y-1 relative">
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
                                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                            }`}
                                    >
                                        <div className={`relative shrink-0 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                                            <Icon size={20} />
                                            {!sidebarOpen && item.badge !== undefined && (
                                                <span className={`absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${item.badgeColor}`}>
                                                    {item.badge}
                                                </span>
                                            )}
                                        </div>

                                        {sidebarOpen && (
                                            <span className="flex-1 whitespace-nowrap transition-all duration-300">
                                                {item.label}
                                            </span>
                                        )}

                                        {sidebarOpen && item.badge !== undefined && (
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${item.badgeColor} ml-auto shrink-0 animate-in zoom-in`}>
                                                {item.badge}
                                            </span>
                                        )}

                                        {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1/2 w-1 bg-primary rounded-r-full" />}
                                    </Link>
                                );
                            })}
                        </div>
                    ))}
                </nav>

                <div className="p-4 border-t border-border">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-4 py-3 rounded-md bg-red-500/10 text-red-600 hover:bg-red-600 hover:text-white transition-all w-full text-left shadow-sm group"
                    >
                        <LogOut size={20} className="group-hover:rotate-180 transition-transform duration-500" />
                        {sidebarOpen && <span className="font-bold">Logout</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden mb-24 md:mb-0">
                {/* Header */}
                <header className="bg-card border-b border-border px-4 md:px-6 py-4 flex items-center justify-between sticky top-0 z-10">
                    <div>
                        <h2 className="text-lg md:text-2xl font-semibold flex items-center gap-2">
                            {/* Mobile Logo */}
                            <div className="md:hidden w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold shadow-sm">
                                T
                            </div>
                            <span className="hidden md:inline">{sidebarOpen ? '' : 'Triev Rider Pro'}</span>
                            <span className="md:hidden">Triev Rider Pro</span>
                        </h2>
                    </div>

                    <div className="flex items-center gap-3 md:gap-4">
                        <ThemeToggle />
                        {/* Notifications */}
                        {userData && (
                            <NotificationsDropdown
                                userId={userData.id}
                                userRole={userData.role}
                            />
                        )}

                        {/* User Info - Compact on Mobile */}
                        <div className="flex items-center gap-2 md:gap-3">
                            <div className="text-right hidden md:block">
                                <p className="font-medium text-sm">{safeRender(userData?.fullName, 'Leader')}</p>
                                <p className="text-xs text-muted-foreground capitalize">{safeRender(userData?.role)}</p>
                            </div>
                            <div className="w-8 h-8 md:w-10 md:h-10 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-semibold">
                                {safeRender(userData?.fullName || 'L').charAt(0).toUpperCase()}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-background">
                    <Outlet />
                </main>
            </div>

            {/* Bottom Nav */}
            <BottomNav items={flatNavItems} />
        </div>
    );
};

export default TeamLeaderLayout;
