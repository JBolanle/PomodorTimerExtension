import { useState, useEffect, useCallback } from 'react';
import { getStorage, setStorage, onStorageChanged } from '@/lib/storage';
import { DEFAULTS } from '@/lib/constants';
import type { Settings } from '@/types';

const STORAGE_KEY = 'settings';

export function useSettings() {
  const [settings, setSettingsState] = useState<Settings>(DEFAULTS);

  useEffect(() => {
    getStorage<Settings>(STORAGE_KEY, DEFAULTS).then(setSettingsState);
    return onStorageChanged(STORAGE_KEY, (val) => setSettingsState(val as Settings));
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettingsState((prev) => {
      const updated = { ...prev, ...patch };
      setStorage(STORAGE_KEY, updated);
      return updated;
    });
  }, []);

  const resetSettings = useCallback(() => {
    setSettingsState(DEFAULTS);
    setStorage(STORAGE_KEY, DEFAULTS);
  }, []);

  return { settings, updateSettings, resetSettings };
}
