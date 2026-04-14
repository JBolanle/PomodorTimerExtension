// In-memory SW state. Module-singleton — restored from storage on boot
// by `initialize.ts`, mutated by `timer/`, `focusMode/`, and `sessions/`.
//
// Intentionally mutable: the legacy JS SW kept state in module-level
// `let` bindings and every operation reassigns specific fields. This
// preserves that pattern with explicit types so the rest of the
// decomposition can read from a single place.

import type {
  CurrentSessionRecord,
  StorageSchema,
  TimerStateKey,
} from '@/shared/schema';

/** Persisted timer-state fields (14 split keys) plus derived metadata. */
export type TimerStatePersisted = { [K in TimerStateKey]: StorageSchema[K] };

export const timerState: TimerStatePersisted = {
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
};

export const focusRuleMap = new Map<string, number>();
export const temporaryAllows = new Map<string, { ruleId: number | undefined; expiresAt: number }>();

/** Cached badge setting — avoids reading storage on every 30s update. */
export const runtime = {
  showBadge: true,
  currentSession: null as CurrentSessionRecord | null,
};

/** Replace every timerState field in place. */
export function assignTimerState(patch: Partial<TimerStatePersisted>): void {
  for (const key of Object.keys(patch) as (keyof TimerStatePersisted)[]) {
    const value = patch[key];
    if (value !== undefined) {
      (timerState as Record<string, unknown>)[key] = value;
    }
  }
}

/** Reset timerState to idle defaults (used by endActivity). */
export function resetTimerState(): void {
  assignTimerState({
    state: 'idle',
    endTime: null,
    remainingMs: null,
    sessionStartedAt: null,
    currentPhase: 'work',
    workSessionsCompleted: 0,
    suggestedNext: null,
    lastCompletedDurationMs: null,
    totalPausedMs: 0,
    pausedAt: null,
    currentNote: null,
    currentTags: [],
  });
}
