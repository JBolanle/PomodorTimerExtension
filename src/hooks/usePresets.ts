import { useState, useEffect, useCallback } from 'react';
import {
  getPresets as chromeGetPresets,
  savePreset as chromeSavePreset,
  deletePreset as chromeDeletePreset,
  setActivePreset as chromeSetActivePreset,
} from '@/lib/chrome';
import { DEFAULT_PRESET } from '@/lib/constants';
import type { Preset } from '@/types';

export function usePresets() {
  const [presets, setPresets] = useState<Preset[]>([DEFAULT_PRESET]);
  const [activePresetId, setActivePresetId] = useState('default');

  useEffect(() => {
    chromeGetPresets().then((data) => {
      setPresets(data.presets);
      setActivePresetId(data.activePresetId);
    }).catch(() => {
      // Service worker may not be ready
    });
  }, []);

  const activePreset = presets.find((p) => p.id === activePresetId) || presets[0] || DEFAULT_PRESET;

  const savePreset = useCallback(async (preset: Preset) => {
    await chromeSavePreset(preset);
    const data = await chromeGetPresets();
    setPresets(data.presets);
  }, []);

  const removePreset = useCallback(async (presetId: string) => {
    await chromeDeletePreset(presetId);
    const data = await chromeGetPresets();
    setPresets(data.presets);
    setActivePresetId(data.activePresetId);
  }, []);

  const selectPreset = useCallback(async (presetId: string) => {
    await chromeSetActivePreset(presetId);
    setActivePresetId(presetId);
  }, []);

  return { presets, activePreset, activePresetId, savePreset, removePreset, selectPreset };
}
