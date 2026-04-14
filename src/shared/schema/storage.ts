// Registry of every `chrome.storage.local` key the extension uses,
// paired with its on-disk value type. Phase 2 will build the typed
// storage adapter (`StorageAdapter<T>`) on top of this. For Phase 1,
// this is the single source of truth for key names and value shapes
// so both the background SW and React side can reference it.
//
// Source of truth: `public/background/service-worker.js` — STATE_KEYS
// (lines 170-175) persists each timerState field as its own top-level
// key (historical choice; Phase 2 may consolidate).

import type {
  FocusModeSettings,
  Preset,
  Session,
  Settings,
  Theme,
  TimerMode,
  TimerStateEnum,
} from '@/shared/types';

/** Persisted session-grouping record kept by the SW while a session is
 *  active. Same shape as a closed `Session` (it becomes one on close);
 *  typed via intersection so all Session fields are available while the
 *  SW mutates it in flight. */
export type CurrentSessionRecord = Session;

export interface StorageSchema {
  // --- User-facing settings ---
  settings: Settings;
  theme: Theme;
  presets: Preset[];
  focusModeSettings: FocusModeSettings;

  // --- Session history ---
  sessions: Session[];          // active grouped sessions (capped at 200 today)
  sessionHistory: Session[];    // legacy key used by import/export
  tagHistory: string[];

  // --- Timer state (each field persisted as its own top-level key) ---
  state: TimerStateEnum;
  endTime: number | null;
  remainingMs: number | null;
  sessionStartedAt: number | null;
  currentPhase: TimerMode;
  workSessionsCompleted: number;
  suggestedNext: TimerMode | null;
  lastCompletedDurationMs: number | null;
  activePresetId: string;
  autoStartNext: boolean;
  totalPausedMs: number;
  pausedAt: number | null;
  currentNote: string | null;
  currentTags: string[];

  // --- In-progress session grouping ---
  currentSession: CurrentSessionRecord | null;
}

export type StorageKey = keyof StorageSchema;

/** The subset of keys that make up the SW's in-memory `timerState`. */
export const TIMER_STATE_KEYS = [
  'state',
  'endTime',
  'remainingMs',
  'sessionStartedAt',
  'currentPhase',
  'workSessionsCompleted',
  'suggestedNext',
  'lastCompletedDurationMs',
  'activePresetId',
  'autoStartNext',
  'totalPausedMs',
  'pausedAt',
  'currentNote',
  'currentTags',
] as const satisfies readonly StorageKey[];

export type TimerStateKey = (typeof TIMER_STATE_KEYS)[number];
