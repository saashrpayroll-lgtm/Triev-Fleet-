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
    autoRotate30Min: boolean;
    setAutoRotate30Min: (enabled: boolean) => void;
}

const initialState: ThemeProviderState = {
    theme: 'system',
    setTheme: () => null,
    autoRotate30Min: false,
    setAutoRotate30Min: () => null,
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
    const [autoRotate30Min, setAutoRotate30MinState] = useState<boolean>(
        () => localStorage.getItem('auto-theme-rotate-30m') === 'true'
    );

    const setAutoRotate30Min = (enabled: boolean) => {
        setAutoRotate30MinState(enabled);
        localStorage.setItem('auto-theme-rotate-30m', enabled ? 'true' : 'false');
    };

    // Auto rotate every 30 minutes if enabled
    useEffect(() => {
        if (!autoRotate30Min) return;

        const themesList: Theme[] = ['dark', 'orange', 'light'];
        const interval = setInterval(() => {
            setTheme((prevTheme) => {
                const currentIndex = themesList.indexOf(prevTheme);
                const nextTheme = themesList[(currentIndex + 1) % themesList.length];
                localStorage.setItem(storageKey, nextTheme);
                return nextTheme;
            });
        }, 30 * 60 * 1000); // 30 minutes

        return () => clearInterval(interval);
    }, [autoRotate30Min, storageKey]);

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
        autoRotate30Min,
        setAutoRotate30Min,
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

