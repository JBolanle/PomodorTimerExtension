// Concrete `StorageAdapter` instances for every persisted key. These
// module-singleton repos are the only supported way to read/write
// `chrome.storage.local` across the extension.
//
// `timerStateRepo` is a composite that fronts the 14 individual keys
// the service worker persists as split top-level entries (see
// `TIMER_STATE_KEYS` in `@/shared/schema/storage`). It's declared here
// so Phase 3's TS SW rewrite has a single typed entry point for timer
// state load/persist.

import {
  TIMER_STATE_KEYS,
  type CurrentSessionRecord,
  type StorageSchema,
  type TimerStateKey,
} from '@/shared/schema';
import type { Preset, Settings, Theme } from '@/shared/types';
import { StorageAdapter } from './adapter';
import { STORAGE_DEFAULTS } from './schema';

export const settingsRepo = new StorageAdapter('settings', STORAGE_DEFAULTS.settings);
export const presetsRepo = new StorageAdapter('presets', STORAGE_DEFAULTS.presets);
export const themeRepo = new StorageAdapter('theme', STORAGE_DEFAULTS.theme);
export const focusModeRepo = new StorageAdapter(
  'focusModeSettings',
  STORAGE_DEFAULTS.focusModeSettings,
);
export const tagHistoryRepo = new StorageAdapter('tagHistory', STORAGE_DEFAULTS.tagHistory);
export const sessionHistoryRepo = new StorageAdapter(
  'sessionHistory',
  STORAGE_DEFAULTS.sessionHistory,
);
export const currentSessionRepo = new StorageAdapter(
  'currentSession',
  STORAGE_DEFAULTS.currentSession,
);
export const focusRuleMapRepo = new StorageAdapter(
  'focusRuleMap',
  STORAGE_DEFAULTS.focusRuleMap,
);
export const focusTemporaryAllowsRepo = new StorageAdapter(
  'focusTemporaryAllows',
  STORAGE_DEFAULTS.focusTemporaryAllows,
);

/** Composite repo for the split `TIMER_STATE_KEYS` — reads and writes
 *  the 14 individual keys as a single object. */
type TimerStatePersisted = { [K in TimerStateKey]: StorageSchema[K] };

export const timerStateRepo = {
  async get(): Promise<TimerStatePersisted> {
    const result = await chrome.storage.local.get([...TIMER_STATE_KEYS]);
    const out = {} as TimerStatePersisted;
    for (const key of TIMER_STATE_KEYS) {
      const stored = result[key];
      (out as Record<string, unknown>)[key] =
        stored === undefined ? STORAGE_DEFAULTS[key] : stored;
    }
    return out;
  },
  async set(patch: Partial<TimerStatePersisted>): Promise<void> {
    const data: Record<string, unknown> = {};
    for (const key of TIMER_STATE_KEYS) {
      if (key in patch) {
        data[key] = patch[key];
      }
    }
    if (Object.keys(data).length > 0) {
      await chrome.storage.local.set(data);
    }
  },
};

// --- Sanity types: ensure schema and repo value types stay in lockstep ---
// These are purely compile-time checks; no runtime effect.
type _CheckSettings = StorageSchema['settings'] extends Settings ? true : never;
type _CheckTheme = StorageSchema['theme'] extends Theme ? true : never;
type _CheckPresets = StorageSchema['presets'] extends Preset[] ? true : never;
type _CheckCurrentSession = StorageSchema['currentSession'] extends CurrentSessionRecord | null
  ? true
  : never;
// Reference the checks so TS keeps them.
const _sanity: [
  _CheckSettings,
  _CheckTheme,
  _CheckPresets,
  _CheckCurrentSession,
] = [true, true, true, true];
void _sanity;
