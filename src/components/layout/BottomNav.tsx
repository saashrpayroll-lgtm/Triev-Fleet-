import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LucideIcon } from 'lucide-react';

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

    // Filter visible items and take only top 5 for mobile to fit nicely
    const visibleItems = items.filter(item => item.visible !== false).slice(0, 5);

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 pb-safe">
            <div className="flex items-center justify-around h-16 px-2">
                {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;

                    return (
                        <Link
                            key={item.path}
                            to={item.path}
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
            </div>
        </div>
    );
};

export default BottomNav;
