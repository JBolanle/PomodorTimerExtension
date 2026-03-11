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

  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    const updated = { ...settings, ...patch };
    setSettingsState(updated);
    await setStorage(STORAGE_KEY, updated);
  }, [settings]);

  return { settings, updateSettings };
}
