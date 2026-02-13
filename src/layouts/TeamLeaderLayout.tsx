import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { LayoutDashboard, Users, FileText, Activity, User, LogOut, Menu, X, HelpCircle, Wallet } from 'lucide-react';
import NotificationsDropdown from '@/components/NotificationsDropdown';
import { ThemeToggle } from '@/components/ThemeToggle';
import { safeRender } from '@/utils/safeRender';
import BottomNav from '@/components/layout/BottomNav';

const TeamLeaderLayout: React.FC = () => {
    const { userData, signOut } = useSupabaseAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(true);

    // DEBUG: Monitor permissions
    // React.useEffect(() => {
    //     if (userData) {
    //         // console.group('TeamLeaderLayout Permission Check');
    //         // console.log('User ID:', userData.id);
    //         // console.log('Role:', userData.role);
    //         // console.log('Raw Permissions:', userData.permissions);
    //         // console.log('Modules Access:', userData.permissions?.modules);
    //         // console.groupEnd();
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
        { path: '/team-leader', icon: LayoutDashboard, label: 'Dashboard', visible: userData?.permissions?.dashboard?.view ?? true },
        { path: '/team-leader/leads', icon: Users, label: 'My Leads', visible: userData?.permissions?.modules?.leads ?? true },
        { path: '/team-leader/riders', icon: Users, label: 'My Riders', visible: userData?.permissions?.modules?.riders ?? true },
        { path: '/team-leader/reports', icon: FileText, label: 'Reports', visible: userData?.permissions?.modules?.reports ?? true },
        { path: '/team-leader/activity-log', icon: Activity, label: 'Activity Log', visible: userData?.permissions?.modules?.activityLog ?? true },
        { path: '/team-leader/requests', icon: HelpCircle, label: 'My Requests', visible: userData?.permissions?.modules?.requests ?? true },
        { path: '/team-leader/wallet-history', icon: Wallet, label: 'Wallet History', visible: userData?.permissions?.wallet?.viewHistory ?? true },
        { path: '/team-leader/profile', icon: User, label: 'Profile', visible: true }, // Profile should always be accessible
    ].filter(item => {
        // Double check against pure undefined if keys missing
        if (item.visible === undefined) return true;
        return item.visible;
    });

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

                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;

                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center gap-3 px-4 py-3 rounded-md transition-all ${isActive
                                    ? 'bg-primary text-primary-foreground shadow-md'
                                    : 'hover:bg-accent text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                <Icon size={20} />
                                {sidebarOpen && <span className="font-medium">{item.label}</span>}
                            </Link>
                        );
                    })}
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
            <BottomNav items={navItems} />
        </div>
    );
};

export default TeamLeaderLayout;
