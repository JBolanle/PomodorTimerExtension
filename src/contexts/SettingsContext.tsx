// Settings context — one storage subscription for the whole tree.
// Reads from `settingsRepo`, watches for external changes, and exposes
// the same `{settings, updateSettings, resetSettings}` shape the
// existing `useSettings()` hook used to return.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import { settingsRepo } from '@/lib/storage/client';
import { DEFAULT_SETTINGS } from '@/shared/constants';
import type { Settings } from '@/shared/types';

interface SettingsContextValue {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    settingsRepo.get().then((loaded) => {
      // Migrate records that predate the `mode` field (mirrors the
      // original hook's behavior).
      if (loaded.mode === undefined) {
        const migrated: Settings = { ...loaded, mode: 'advanced' };
        void settingsRepo.set(migrated);
        setSettings(migrated);
      } else {
        setSettings(loaded);
      }
    });
    return settingsRepo.onChange((val) => {
      if (val) setSettings(val);
    });
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...patch };
      void settingsRepo.set(updated);
      return updated;
    });
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    void settingsRepo.set(DEFAULT_SETTINGS);
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettingsContext(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (ctx === null) {
    throw new Error('useSettings must be used within a SettingsProvider.');
  }
  return ctx;
}
