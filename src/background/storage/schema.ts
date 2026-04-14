// Default values for each storage key, keyed by `StorageKey`. The
// shared schema (`@/shared/schema`) defines value types; this module
// supplies the runtime defaults that the adapter returns when a key
// has not yet been written.
//
// Keys with intrinsically-null / empty defaults (e.g. `endTime`,
// `currentSession`) live here too so every adapter has a single
// source of truth for "what should I return on a fresh install?".

import {
  DEFAULT_FOCUS_MODE_SETTINGS,
  DEFAULT_PRESET,
  DEFAULT_SETTINGS,
} from '@/shared/constants';
import type { StorageSchema } from '@/shared/schema';

export const STORAGE_DEFAULTS: {
  [K in keyof StorageSchema]: StorageSchema[K];
} = {
  // --- User-facing settings ---
  settings: DEFAULT_SETTINGS,
  theme: 'arctic',
  presets: [DEFAULT_PRESET],
  focusModeSettings: DEFAULT_FOCUS_MODE_SETTINGS,

  // --- Session history (sessions moved to IDB in Phase 5) ---
  sessionHistory: [],
  tagHistory: [],

  // --- Timer state (SW keeps each field as a top-level key) ---
  state: 'idle',
  endTime: null,
  remainingMs: null,
  sessionStartedAt: null,
  currentPhase: 'work',
  workSessionsCompleted: 0,
  suggestedNext: null,
  lastCompletedDurationMs: null,
  activePresetId: 'default',
  autoStartNext: false,
  totalPausedMs: 0,
  pausedAt: null,
  currentNote: null,
  currentTags: [],

  // --- In-progress session grouping ---
  currentSession: null,
};
