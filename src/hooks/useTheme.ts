import { useCallback, useEffect, useState } from 'react';

import { themeRepo } from '@/lib/storage/client';
import type { Theme } from '@/shared/types';

const DEFAULT_THEME: Theme = 'arctic';

export function useTheme() {
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

  return { theme, setTheme };
}
