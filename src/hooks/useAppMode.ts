import { useSettings } from '@/hooks/useSettings';
import type { AppMode } from '@/types';

export function useAppMode() {
  const { settings, updateSettings } = useSettings();
  return {
    mode: settings.mode,
    setMode: (mode: AppMode) => updateSettings({ mode }),
    isSimple: settings.mode === 'simple',
    isAdvanced: settings.mode === 'advanced',
  };
}
