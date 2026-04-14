// Session grouping: records a session covering one or more phases.
// Persists closed sessions to `sessionsRepo` (capped at MAX_SESSIONS).

import type { CompletionType, PhaseRecord, Preset, TimerMode } from '@/shared/types';
import { MAX_SESSIONS } from '../constants';
import { sessionsRepo, tagHistoryRepo } from '../storage/repos';
import { runtime, timerState } from '../state';

export function createNewSession(preset: Preset): void {
  runtime.currentSession = {
    id: crypto.randomUUID(),
    startedAt: Date.now(),
    endedAt: null,
    status: 'active',
    phases: [],
    totalFocusMs: 0,
    totalBreakMs: 0,
    presetId: preset.id,
    presetName: preset.name,
    ...(timerState.currentNote ? { note: timerState.currentNote } : {}),
    ...(timerState.currentTags.length > 0 ? { tags: timerState.currentTags } : {}),
  };
}

export function addPhaseToCurrentSession(
  mode: TimerMode,
  plannedMs: number,
  actualMs: number,
  completionType: CompletionType,
  startedAt: number,
): void {
  if (!runtime.currentSession) return;
  const phase: PhaseRecord = {
    id: crypto.randomUUID(),
    mode,
    plannedDurationMs: plannedMs,
    actualDurationMs: Math.max(0, actualMs),
    completionType,
    startedAt,
    completedAt: Date.now(),
  };
  runtime.currentSession.phases.push(phase);
  if (mode === 'work') {
    runtime.currentSession.totalFocusMs += phase.actualDurationMs;
  } else {
    runtime.currentSession.totalBreakMs += phase.actualDurationMs;
  }
}

export async function closeCurrentSession(
  status: 'completed' | 'ended',
): Promise<void> {
  if (!runtime.currentSession) return;
  runtime.currentSession.endedAt = Date.now();
  runtime.currentSession.status = status;
  try {
    const stored = await sessionsRepo.get();
    stored.push(runtime.currentSession);
    if (stored.length > MAX_SESSIONS) {
      stored.splice(0, stored.length - MAX_SESSIONS);
    }
    await sessionsRepo.set(stored);
    if (runtime.currentSession.tags && runtime.currentSession.tags.length > 0) {
      await addTagsToHistory(runtime.currentSession.tags);
    }
  } catch (err) {
    console.error('[Pomodoro] Failed to save session:', err);
  }
  runtime.currentSession = null;
  timerState.currentNote = null;
  timerState.currentTags = [];
}

export async function addTagsToHistory(tags: string[]): Promise<void> {
  if (tags.length === 0) return;
  const existing = await tagHistoryRepo.get();
  const updated = [...new Set([...tags, ...existing])].slice(0, 50);
  await tagHistoryRepo.set(updated);
}
