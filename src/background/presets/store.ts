// Preset CRUD + active-preset resolution for the SW.

import { DEFAULT_PRESET } from '@/shared/constants';
import type { Preset } from '@/shared/types';
import { presetsRepo } from '../storage/repos';
import { timerState } from '../state';

let cachedPresets: Preset[] | null = null;
let cachedActivePresetId: string | null = null;

export async function loadPresets(): Promise<Preset[]> {
  const list = await presetsRepo.get();
  return list.length > 0 ? list : [DEFAULT_PRESET];
}

export async function getActivePreset(): Promise<Preset> {
  const list = await loadPresets();
  cachedPresets = list;
  cachedActivePresetId = timerState.activePresetId;
  return (
    list.find((p) => p.id === timerState.activePresetId) ?? list[0] ?? DEFAULT_PRESET
  );
}

/** Sync accessor — returns last cached list, or DEFAULT_PRESET as fallback. */
export function getActivePresetSync(): Preset {
  if (cachedPresets && cachedActivePresetId === timerState.activePresetId) {
    return (
      cachedPresets.find((p) => p.id === timerState.activePresetId) ??
      cachedPresets[0] ??
      DEFAULT_PRESET
    );
  }
  return DEFAULT_PRESET;
}

export async function savePreset(preset: Preset): Promise<void> {
  const list = await loadPresets();
  const idx = list.findIndex((p) => p.id === preset.id);
  if (idx >= 0) {
    list[idx] = preset;
  } else {
    list.push(preset);
  }
  await presetsRepo.set(list);
  cachedPresets = list;
}

export async function deletePreset(presetId: string): Promise<boolean> {
  if (presetId === 'default') return false;
  const list = await loadPresets();
  const next = list.filter((p) => p.id !== presetId);
  await presetsRepo.set(next);
  cachedPresets = next;
  return true;
}

export function getMinutesForPhase(phase: string, preset: Preset): number {
  switch (phase) {
    case 'work':
      return preset.workMinutes;
    case 'shortBreak':
      return preset.shortBreakMinutes;
    case 'longBreak':
      return preset.longBreakMinutes;
    default:
      return 25;
  }
}
