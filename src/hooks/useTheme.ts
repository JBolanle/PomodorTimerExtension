import { useState, useEffect, useCallback } from 'react';
import { getStorage, setStorage, onStorageChanged } from '@/lib/storage';
import type { Theme } from '@/types';

const STORAGE_KEY = 'theme';
const DEFAULT_THEME: Theme = 'arctic';

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);

  useEffect(() => {
    getStorage<Theme>(STORAGE_KEY, DEFAULT_THEME).then(setThemeState);
    return onStorageChanged(STORAGE_KEY, (val) => setThemeState(val as Theme));
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const setTheme = useCallback(async (t: Theme) => {
    setThemeState(t);
    await setStorage(STORAGE_KEY, t);
  }, []);

  return { theme, setTheme };
}
