import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LucideIcon, Menu, X, User, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';

interface NavItem {
    path: string;
    icon: LucideIcon;
    label: string;
    visible?: boolean;
    badge?: number;
    badgeColor?: string;
}

interface BottomNavProps {
    items: NavItem[];
}

const BottomNav: React.FC<BottomNavProps> = ({ items }) => {
    const location = useLocation();
    const { signOut, userData } = useSupabaseAuth();
    const isAdmin = userData?.role === 'admin' || userData?.role === 'cityOps' || userData?.role === 'reportingManager';
    const accentColor = isAdmin ? '#6366f1' : '#f59e0b';

    const handleLogout = async () => {
        try {
            await signOut();
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    const visibleItems = items.filter(item => item.visible !== false);
    const [isMoreOpen, setIsMoreOpen] = React.useState(false);
    const mainItems = visibleItems.slice(0, 4);
    const hasMore = visibleItems.length > 4;

    return (
        <>
            {/* ── Bottom Bar ──────────────────────────────────────────── */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-[60] pb-safe">
                {/* Frosted glass bar */}
                <div
                    className="flex items-center justify-around h-16 px-1 mx-2 mb-2 rounded-2xl shadow-2xl border border-border/40"
                    style={{
                        background: 'rgba(var(--card-rgb, 255 255 255)/0.85)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                    }}
                >
                    {mainItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;

                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                onClick={() => setIsMoreOpen(false)}
                                className="relative flex flex-col items-center justify-center flex-1 h-full gap-0.5 group"
                            >
                                {/* Active pill indicator top */}
                                <AnimatePresence>
                                    {isActive && (
                                        <motion.div
                                            layoutId="bottom-nav-pill"
                                            className="absolute top-1 rounded-full h-1 w-8"
                                            style={{ background: accentColor }}
                                            initial={{ scaleX: 0 }}
                                            animate={{ scaleX: 1 }}
                                            exit={{ scaleX: 0 }}
                                            transition={{ duration: 0.25 }}
                                        />
                                    )}
                                </AnimatePresence>

                                {/* Icon container */}
                                <div className="relative">
                                    <motion.div
                                        className="w-10 h-7 flex items-center justify-center rounded-xl transition-all duration-200"
                                        animate={isActive ? {
                                            background: `${accentColor}18`,
                                            scale: 1.1
                                        } : { background: 'transparent', scale: 1 }}
                                    >
                                        <Icon
                                            size={20}
                                            strokeWidth={isActive ? 2.5 : 1.8}
                                            style={{ color: isActive ? accentColor : 'hsl(var(--muted-foreground))' }}
                                            className="transition-colors duration-200"
                                        />
                                    </motion.div>

                                    {/* Badge */}
                                    {item.badge !== undefined && (
                                        <span
                                            className={`absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full text-[8px] font-black px-0.5 shadow-lg ${item.badgeColor || 'bg-red-500 text-white'}`}
                                        >
                                            {item.badge > 9 ? '9+' : item.badge}
                                        </span>
                                    )}
                                </div>

                                <span
                                    className="text-[9px] font-bold truncate max-w-[60px] transition-colors duration-200"
                                    style={{ color: isActive ? accentColor : 'hsl(var(--muted-foreground))' }}
                                >
                                    {item.label}
                                </span>
                            </Link>
                        );
                    })}

                    {/* More Button */}
                    {hasMore && (
                        <button
                            onClick={() => setIsMoreOpen(true)}
                            className={`relative flex flex-col items-center justify-center flex-1 h-full gap-0.5`}
                        >
                            <div className="w-10 h-7 flex items-center justify-center rounded-xl hover:bg-muted/40 transition-colors">
                                <Menu size={20} strokeWidth={1.8} className="text-muted-foreground" />
                            </div>
                            <span className="text-[9px] font-bold text-muted-foreground">More</span>
                        </button>
                    )}
                </div>
            </div>

            {/* ── More Drawer ─────────────────────────────────────────── */}
            <AnimatePresence>
                {isMoreOpen && (
                    <div className="md:hidden fixed inset-0 z-[100]">
                        {/* Backdrop */}
                        <motion.div
                            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsMoreOpen(false)}
                        />

                        {/* Drawer */}
                        <motion.div
                            className="absolute right-0 top-0 bottom-0 w-[78%] max-w-[300px] bg-card border-l border-border/50 shadow-2xl flex flex-col"
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        >
                            {/* Drawer Header */}
                            <div className="p-4 border-b border-border/50 flex items-center justify-between shrink-0"
                                style={{ background: `${accentColor}0a` }}>
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-black text-sm"
                                        style={{ background: accentColor }}>
                                        {isAdmin ? 'A' : 'T'}
                                    </div>
                                    <div>
                                        <p className="font-black text-sm">{isAdmin ? 'Admin Panel' : 'Rider Pro'}</p>
                                        <p className="text-[9px] text-muted-foreground font-mono">v2.5.0</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsMoreOpen(false)} className="p-2 hover:bg-muted rounded-xl transition-colors">
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Nav Items */}
                            <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
                                {visibleItems.map((item, idx) => {
                                    const Icon = item.icon;
                                    const isActive = location.pathname === item.path;
                                    return (
                                        <motion.div
                                            key={item.path}
                                            initial={{ opacity: 0, x: 16 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.03 }}
                                        >
                                            <Link
                                                to={item.path}
                                                onClick={() => setIsMoreOpen(false)}
                                                className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all relative overflow-hidden"
                                                style={{
                                                    background: isActive ? `${accentColor}15` : undefined,
                                                    color: isActive ? accentColor : undefined,
                                                }}
                                            >
                                                {isActive && (
                                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full" style={{ background: accentColor }} />
                                                )}
                                                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                                    style={{ background: isActive ? `${accentColor}20` : 'hsl(var(--muted)/0.5)' }}>
                                                    <Icon size={16} style={{ color: isActive ? accentColor : 'hsl(var(--muted-foreground))' }} />
                                                </div>
                                                <span className={`text-sm font-medium flex-1 ${isActive ? 'font-bold' : 'text-foreground'}`}>{item.label}</span>
                                                {item.badge !== undefined && (
                                                    <span className={`px-1.5 py-0.5 rounded-lg text-[9px] font-black shadow-sm ${item.badgeColor || 'bg-red-500 text-white'}`}>
                                                        {item.badge}
                                                    </span>
                                                )}
                                            </Link>
                                        </motion.div>
                                    );
                                })}
                            </div>

                            {/* Footer */}
                            <div className="p-3 border-t border-border/50 space-y-1 shrink-0 bg-muted/10">
                                {!visibleItems.some(i => i.path.includes('profile')) && userData?.permissions?.modules?.profile && (
                                    <Link
                                        to={isAdmin ? '/portal/profile' : '/team-leader/profile'}
                                        onClick={() => setIsMoreOpen(false)}
                                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                                    >
                                        <User size={17} />
                                        <span className="text-sm font-medium">My Profile</span>
                                    </Link>
                                )}
                                <button
                                    onClick={handleLogout}
                                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-500 hover:bg-red-500/10 w-full text-left transition-all group"
                                >
                                    <LogOut size={17} className="group-hover:rotate-12 transition-transform duration-300" />
                                    <span className="text-sm font-medium">Logout</span>
                                </button>
                                <p className="text-[9px] text-center text-muted-foreground/30 font-mono tracking-widest">Triev Fleet v2.5.0</p>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
};

export default BottomNav;
