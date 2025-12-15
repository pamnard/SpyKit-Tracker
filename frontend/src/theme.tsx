import { createContext, useContext, useEffect, useMemo, useState } from 'react';

type Theme = 'light' | 'dark';

type ThemeContextValue = {
    theme: Theme;
    toggle: () => void;
    setTheme: (t: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const storageKey = 'theme';

const getInitial = (): Theme => {
    if (typeof window === 'undefined') return 'light';
    try {
        const stored = window.localStorage.getItem(storageKey);
        if (stored === 'light' || stored === 'dark') return stored;
    } catch {
        /* no-op */
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const applyTheme = (theme: Theme) => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.dataset.theme = theme;
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>(getInitial);

    useEffect(() => {
        applyTheme(theme);
        try {
            window.localStorage.setItem(storageKey, theme);
        } catch {
            /* ignore */
        }
    }, [theme]);

    const setTheme = (t: Theme) => setThemeState(t);
    const toggle = () => setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));

    const value = useMemo(() => ({ theme, toggle, setTheme }), [theme]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
    return ctx;
}
