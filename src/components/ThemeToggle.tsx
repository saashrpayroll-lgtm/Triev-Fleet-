
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();

    return (
        <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-lg hover:bg-accent transition-all duration-300 relative overflow-hidden group"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
            <div className="relative z-10">
                <Sun
                    className={`h-[1.2rem] w-[1.2rem] transition-all transform duration-500 ${theme === 'dark' ? 'rotate-[-90deg] scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'
                        }`}
                />
                <Moon
                    className={`absolute top-0 h-[1.2rem] w-[1.2rem] transition-all transform duration-500 ${theme === 'dark' ? 'rotate-0 scale-100 opacity-100' : 'rotate-90 scale-0 opacity-0'
                        }`}
                />
            </div>
            <span className="sr-only">Toggle theme</span>
        </button>
    );
}
