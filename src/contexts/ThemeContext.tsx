// Theme context — single source of truth for `data-theme` on <html>.
// The provider sets the attribute once per theme change so individual
// consumers don't need their own `useEffect`.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import { themeRepo } from '@/lib/storage/client';
import type { Theme } from '@/shared/types';

const DEFAULT_THEME: Theme = 'arctic';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);

  useEffect(() => {
    themeRepo.get().then(setThemeState);
    return themeRepo.onChange((val) => {
      if (val) setThemeState(val);
    });
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const setTheme = useCallback(async (t: Theme) => {
    setThemeState(t);
    await themeRepo.set(t);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (ctx === null) {
    throw new Error('useTheme must be used within a ThemeProvider.');
  }
  return ctx;
}
