// Pure cycle helpers: next-phase suggestion and elapsed-time math.

import type { TimerMode } from '@/shared/types';
import { getActivePresetSync, getMinutesForPhase } from '../presets/store';
import { timerState } from '../state';

export function computeSuggestion(): TimerMode {
  const preset = getActivePresetSync();
  const sessionsBeforeLong = preset?.sessionsBeforeLongBreak ?? 4;

  if (timerState.currentPhase === 'work') {
    return timerState.workSessionsCompleted >= sessionsBeforeLong ? 'longBreak' : 'shortBreak';
  }
  return 'work';
}

export function calculateElapsedMs(): number {
  if (timerState.state === 'running' && timerState.sessionStartedAt) {
    return Date.now() - timerState.sessionStartedAt - (timerState.totalPausedMs || 0);
  }
  if (
    timerState.state === 'paused' &&
    timerState.sessionStartedAt &&
    timerState.remainingMs != null
  ) {
    // When paused, endTime is null — use the planned duration minus what's left.
    const preset = getActivePresetSync();
    const plannedMs = getMinutesForPhase(timerState.currentPhase, preset) * 60000;
    return Math.max(0, plannedMs - timerState.remainingMs);
  }
  return 0;
}
