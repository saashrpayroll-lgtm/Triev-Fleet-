import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import {
    LayoutDashboard, Users, Target, Trophy, FileText, LogOut, Menu,
    X, User, BarChart3, Wallet
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { safeRender } from '@/utils/safeRender';
import BottomNav from '@/components/layout/BottomNav';

interface NavItem {
    path: string;
    icon: any;
    label: string;
    visible?: boolean;
}

interface NavGroup {
    title: string;
    items: NavItem[];
}

const RMLayout: React.FC = () => {
    const { userData, signOut } = useSupabaseAuth();
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(true);

    const rmPerms = userData?.permissions?.rmPanel;

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
                { path: '/rm-panel', icon: LayoutDashboard, label: 'Dashboard', visible: rmPerms?.dashboard ?? true },
            ].filter(item => item.visible !== false)
        },
        {
            title: 'Team Performance',
            items: [
                { path: '/rm-panel/tl-performance', icon: BarChart3, label: 'TL Performance', visible: rmPerms?.tlPerformance ?? true },
                { path: '/rm-panel/leaderboard', icon: Trophy, label: 'Leaderboard', visible: rmPerms?.leaderboard ?? true },
            ].filter(item => item.visible !== false)
        },
        {
            title: 'Operations',
            items: [
                { path: '/rm-panel/riders', icon: Users, label: 'Rider Overview', visible: rmPerms?.riderOverview ?? true },
                { path: '/rm-panel/leads', icon: Target, label: 'Lead Overview', visible: rmPerms?.leadOverview ?? true },
            ].filter(item => item.visible !== false)
        },
        {
            title: 'Analytics',
            items: [
                { path: '/rm-panel/collections', icon: Wallet, label: 'Collection History', visible: rmPerms?.collectionHistory ?? true },
                { path: '/rm-panel/reports', icon: FileText, label: 'Reports', visible: rmPerms?.reports ?? true },
            ].filter(item => item.visible !== false)
        },
        {
            title: 'Account',
            items: [
                { path: '/rm-panel/profile', icon: User, label: 'My Profile', visible: true },
            ]
        }
    ].filter(group => group.items.length > 0);

    const flatNavItems = navGroups.flatMap(g => g.items);

    return (
        <div className="flex h-screen bg-background">
            {/* Sidebar */}
            <aside
                className={`hidden md:flex ${sidebarOpen ? 'w-64' : 'w-20'
                    } bg-card border-r border-border transition-all duration-300 flex-col shadow-lg z-[10000]`}
            >
                <div className="p-4 border-b border-border flex items-center justify-between bg-teal-500/5">
                    {sidebarOpen && (
                        <h1 className="text-xl font-bold bg-gradient-to-r from-teal-600 to-teal-400 bg-clip-text text-transparent">
                            RM Panel
                        </h1>
                    )}
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="p-2 hover:bg-accent rounded-md transition-colors"
                    >
                        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>

                <nav className="flex-1 px-3 py-6 space-y-7 overflow-y-auto custom-scrollbar">
                    {navGroups.map((group, groupIndex) => (
                        <div key={groupIndex} className="space-y-2 relative">
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
                                            ? 'text-teal-600 font-bold'
                                            : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                    >
                                        <div className={`absolute inset-0 transition-opacity duration-300 ${isActive
                                            ? 'bg-teal-500/10 opacity-100'
                                            : 'bg-teal-500/5 opacity-0 group-hover:opacity-100'
                                            }`} />

                                        {isActive && (
                                            <motion.div
                                                layoutId="rm-active-pill"
                                                className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 bg-teal-500 rounded-r-full shadow-[0_0_12px_rgba(20,184,166,0.5)]"
                                            />
                                        )}

                                        <div className={`relative shrink-0 transition-all duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110 group-hover:text-teal-500'}`}>
                                            <Icon size={18} className={isActive ? 'text-teal-500' : 'transition-colors duration-300'} />
                                        </div>

                                        {sidebarOpen && (
                                            <span className="relative flex-1 text-sm tracking-tight whitespace-nowrap transition-all duration-300">
                                                {item.label}
                                            </span>
                                        )}
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
            <div className="flex-1 flex flex-col overflow-hidden mb-24 md:mb-0 max-w-full">
                {/* Header */}
                <header className="bg-card border-b border-border px-4 md:px-6 py-4 flex items-center justify-between sticky top-0 z-[9990]">
                    <div>
                        <h2 className="text-lg md:text-2xl font-semibold flex items-center gap-2">
                            <div className="md:hidden w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center text-white font-bold shadow-sm">
                                R
                            </div>
                            <span className="hidden md:inline">{sidebarOpen ? '' : 'RM Panel'}</span>
                            <span className="md:hidden">RM Panel</span>
                        </h2>
                    </div>

                    <div className="flex items-center gap-3 md:gap-4">
                        <ThemeToggle />
                        <div className="flex items-center gap-2 md:gap-3">
                            <div className="text-right hidden md:block">
                                <p className="font-medium text-sm">{safeRender(userData?.fullName, 'Manager')}</p>
                                <p className="text-xs text-teal-600 dark:text-teal-400 font-bold">Reporting Manager</p>
                            </div>
                            <Link
                                to="/rm-panel/profile"
                                className="w-8 h-8 md:w-10 md:h-10 rounded-full overflow-hidden border-2 border-teal-500/30 hover:border-teal-500 transition-all flex items-center justify-center flex-shrink-0"
                            >
                                {userData?.profilePicUrl ? (
                                    <img src={userData.profilePicUrl} alt="avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-teal-500 flex items-center justify-center text-white font-semibold">
                                        {safeRender(userData?.fullName || 'R').charAt(0).toUpperCase()}
                                    </div>
                                )}
                            </Link>
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

export default RMLayout;
