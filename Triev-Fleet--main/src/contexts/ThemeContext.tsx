import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light' | 'orange' | 'system';

interface ThemeProviderProps {
    children: React.ReactNode;
    defaultTheme?: Theme;
    storageKey?: string;
}

interface ThemeProviderState {
    theme: Theme;
    setTheme: (theme: Theme) => void;
}

const initialState: ThemeProviderState = {
    theme: 'dark',
    setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
    children,
    defaultTheme = 'dark',
    storageKey = 'vite-ui-theme',
}: ThemeProviderProps) {
    const [theme, setTheme] = useState<Theme>(
        () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
    );

    // Fully automated 30-minute background theme shift
    useEffect(() => {
        const themesList: Theme[] = ['dark', 'orange', 'light'];

        const interval = setInterval(() => {
            setTheme((prevTheme) => {
                const currentIndex = themesList.indexOf(prevTheme);
                const nextTheme = themesList[(currentIndex + 1) % (themesList.length - 1)]; // rotates between dark & orange gracefully
                localStorage.setItem(storageKey, nextTheme);
                return nextTheme;
            });
        }, 30 * 60 * 1000); // 30 minutes automatic

        return () => clearInterval(interval);
    }, [storageKey]);

    useEffect(() => {
        const root = window.document.documentElement;

        // Remove all previous theme classes
        root.classList.remove('light', 'dark', 'orange');

        if (theme === 'system') {
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
                .matches
                ? 'dark'
                : 'light';

            root.classList.add(systemTheme);
            return;
        }

        root.classList.add(theme);
    }, [theme]);

    const value = {
        theme,
        setTheme: (newTheme: Theme) => {
            localStorage.setItem(storageKey, newTheme);
            setTheme(newTheme);
        },
    };

    return (
        <ThemeProviderContext.Provider value={value}>
            {children}
        </ThemeProviderContext.Provider>
    );
}

export const useTheme = () => {
    const context = useContext(ThemeProviderContext);

    if (context === undefined)
        throw new Error('useTheme must be used within a ThemeProvider');

    return context;
};


