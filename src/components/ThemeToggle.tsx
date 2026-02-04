
import { Moon, Sun, Palette } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();

    const cycleTheme = () => {
        if (theme === 'dark') setTheme('light');
        else if (theme === 'light') setTheme('orange');
        else setTheme('dark');
    };

    return (
        <button
            onClick={cycleTheme}
            className="p-2 rounded-lg hover:bg-accent transition-all duration-300 relative overflow-hidden group"
            title={`Current: ${theme.charAt(0).toUpperCase() + theme.slice(1)} Mode. Click to cycle.`}
        >
            <div className="relative z-10 w-[1.2rem] h-[1.2rem]">
                {/* Dark Mode Icon */}
                <Moon
                    className={`absolute inset-0 w-full h-full transition-all transform duration-500 ${theme === 'dark' ? 'rotate-0 scale-100 opacity-100' : 'rotate-90 scale-0 opacity-0'
                        }`}
                />

                {/* Light Mode Icon */}
                <Sun
                    className={`absolute inset-0 w-full h-full transition-all transform duration-500 ${theme === 'light' ? 'rotate-0 scale-100 opacity-100' : 'rotate-90 scale-0 opacity-0'
                        }`}
                />

                {/* Orange Mode Icon */}
                <Palette
                    className={`absolute inset-0 w-full h-full transition-all transform duration-500 ${theme === 'orange' ? 'rotate-0 scale-100 opacity-100' : 'rotate-[-90deg] scale-0 opacity-0'
                        }`}
                />
            </div>
            <span className="sr-only">Toggle theme</span>
        </button>
    );
}
