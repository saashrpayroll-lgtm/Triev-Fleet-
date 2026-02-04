import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LucideIcon, Menu, X, User, LogOut } from 'lucide-react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';

interface NavItem {
    path: string;
    icon: LucideIcon;
    label: string;
    visible?: boolean;
}

interface BottomNavProps {
    items: NavItem[];
}

const BottomNav: React.FC<BottomNavProps> = ({ items }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { signOut } = useSupabaseAuth(); // Use context for logout

    const handleLogout = async () => {
        try {
            await signOut();
            navigate('/login');
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    // Filter visible items
    const visibleItems = items.filter(item => item.visible !== false);

    // Mobile View Logic: Show 4 items + "More" if there are many items
    const [isMoreOpen, setIsMoreOpen] = React.useState(false);
    const mainItems = visibleItems.slice(0, 4);
    const hasMore = visibleItems.length > 4;

    return (
        <>
            {/* Bottom Bar */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-[55] pb-safe">
                <div className="flex items-center justify-around h-16 px-2">
                    {mainItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;

                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                onClick={() => setIsMoreOpen(false)}
                                className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                <Icon
                                    size={24}
                                    className={`transition-all ${isActive ? 'scale-110' : ''}`}
                                    strokeWidth={isActive ? 2.5 : 2}
                                />
                                <span className="text-[10px] font-medium truncate max-w-[70px]">
                                    {item.label}
                                </span>
                                {isActive && (
                                    <div className="absolute top-0 w-8 h-1 bg-primary rounded-b-full" />
                                )}
                            </Link>
                        );
                    })}

                    {/* More Button */}
                    {hasMore && (
                        <button
                            onClick={() => setIsMoreOpen(true)}
                            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${isMoreOpen ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <div className="p-1 rounded-lg">
                                <Menu size={24} />
                            </div>
                            <span className="text-[10px] font-medium">More</span>
                        </button>
                    )}
                </div>
            </div>

            {/* "More" Drawer (Mobile Sidebar) */}
            {isMoreOpen && (
                <div className="md:hidden fixed inset-0 z-[100]">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
                        onClick={() => setIsMoreOpen(false)}
                    />

                    {/* Drawer Content */}
                    <div className="absolute right-0 top-0 bottom-0 w-[80%] max-w-[300px] bg-background border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                        {/* Header */}
                        <div className="p-4 border-b border-border flex items-center justify-between shrink-0 bg-muted/20">
                            <h3 className="font-bold text-lg">Menu</h3>
                            <button
                                onClick={() => setIsMoreOpen(false)}
                                className="p-2 hover:bg-muted rounded-full transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Scrollable Nav Items */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                            {visibleItems.map((item) => {
                                const Icon = item.icon;
                                const isActive = location.pathname === item.path;
                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        onClick={() => setIsMoreOpen(false)}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive
                                            ? 'bg-primary text-primary-foreground font-medium shadow-md'
                                            : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                                            }`}
                                    >
                                        <Icon size={20} />
                                        <span>{item.label}</span>
                                    </Link>
                                );
                            })}
                        </div>

                        {/* Footer Actions (Profile & Logout) */}
                        <div className="p-4 border-t border-border bg-muted/10 space-y-2 shrink-0">
                            {/* Profile Link (if not already in nav items, but good to have explicit) */}
                            <Link
                                to="/portal/profile"
                                onClick={() => setIsMoreOpen(false)}
                                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                            >
                                <User size={20} />
                                <span>My Profile</span>
                            </Link>

                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 w-full text-left transition-all"
                            >
                                <LogOut size={20} />
                                <span>Logout</span>
                            </button>
                            <p className="text-xs text-center text-muted-foreground mt-2">v2.5.0</p>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default BottomNav;
