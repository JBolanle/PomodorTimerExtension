// Persistence helpers — thin layer over `timerStateRepo` and
// `currentSessionRepo` that captures the SW's current persistence
// pattern: every field in `timerState` plus `currentSession` written
// together after each operation.

import { broadcastTimerState } from './messaging/portConnection';
import { currentSessionRepo, timerStateRepo } from './storage/repos';
import { runtime, timerState } from './state';

export async function persistState(): Promise<void> {
  try {
    await timerStateRepo.set(timerState);
    await currentSessionRepo.set(runtime.currentSession);
  } catch (err) {
    console.error('[Pomodoro] Failed to persist state:', err);
  }
  // Push the fresh snapshot to any connected popups. Runs even when
  // the write above failed so the UI sees the in-memory truth.
  broadcastTimerState();
}
