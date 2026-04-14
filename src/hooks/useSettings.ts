import { useCallback, useEffect, useState } from 'react';

import { settingsRepo } from '@/lib/storage/client';
import { DEFAULT_SETTINGS } from '@/shared/constants';
import type { Settings } from '@/shared/types';

export function useSettings() {
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    settingsRepo.get().then((loaded) => {
      // Migrate legacy records that predate the `mode` field.
      if (loaded.mode === undefined) {
        const migrated: Settings = { ...loaded, mode: 'advanced' };
        void settingsRepo.set(migrated);
        setSettingsState(migrated);
      } else {
        setSettingsState(loaded);
      }
    });
    return settingsRepo.onChange((val) => {
      if (val) setSettingsState(val);
    });
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettingsState((prev) => {
      const updated = { ...prev, ...patch };
      void settingsRepo.set(updated);
      return updated;
    });
  }, []);

  const resetSettings = useCallback(() => {
    setSettingsState(DEFAULT_SETTINGS);
    void settingsRepo.set(DEFAULT_SETTINGS);
  }, []);

  return { settings, updateSettings, resetSettings };
}
