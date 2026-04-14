// Timer operations invoked by the message router: start / pause /
// resume / skip / endActivity. Each mutates `timerState`, persists,
// and drives side effects (alarms, badge, focus mode, notifications).

import type { OpResult, TimerMode } from '@/shared/types';
import {
  AUTO_START_ALARM,
  AUTO_START_DELAY_SEC,
  POMODORO_ALARM,
} from '../constants';
import { clearBadgeAlarm, startBadgeAlarm, updateBadge } from '../badge';
import { disableFocusMode, enableFocusMode } from '../focusMode/controller';
import { getCompletionMessage, getSkipMessage, sendNotification } from '../notifications';
import { persistState } from '../persist';
import { getActivePreset, getMinutesForPhase } from '../presets/store';
import {
  addPhaseToCurrentSession,
  closeCurrentSession,
  createNewSession,
} from '../sessions/store';
import { playNotificationSound } from '../sound';
import { assignTimerState, resetTimerState, runtime, timerState } from '../state';
import { calculateElapsedMs, computeSuggestion } from './cycle';

export async function doStartTimer(
  phase: TimerMode,
  minutes: number,
  focusMode?: boolean,
): Promise<OpResult> {
  const sessionTotalMs = minutes * 60000;
  const endTime = Date.now() + sessionTotalMs;

  if (runtime.currentSession === null) {
    const preset = await getActivePreset();
    createNewSession(preset);
  }

  assignTimerState({
    state: 'running',
    currentPhase: phase,
    endTime,
    remainingMs: null,
    sessionStartedAt: Date.now(),
    suggestedNext: null,
    lastCompletedDurationMs: null,
    totalPausedMs: 0,
    pausedAt: null,
  });

  await persistState();
  try {
    await chrome.alarms.create(POMODORO_ALARM, { delayInMinutes: minutes });
  } catch (err) {
    console.error('[Pomodoro] Failed to create timer alarm:', err);
    assignTimerState({ state: 'idle', endTime: null, sessionStartedAt: null });
    await persistState().catch(() => {});
    return { success: false, error: 'Failed to create alarm' };
  }
  chrome.alarms.clear(AUTO_START_ALARM).catch(() => {});
  startBadgeAlarm();
  if (phase === 'work' && focusMode !== false) {
    void enableFocusMode();
  }
  return { success: true };
}

export async function doPause(): Promise<OpResult> {
  const remaining = Math.max(0, (timerState.endTime ?? 0) - Date.now());
  assignTimerState({
    state: 'paused',
    endTime: null,
    remainingMs: remaining,
    pausedAt: Date.now(),
  });
  await persistState();
  chrome.alarms.clear(POMODORO_ALARM).catch(() => {});
  clearBadgeAlarm();
  updateBadge();
  return { success: true };
}

export async function doResume(): Promise<OpResult> {
  const remaining = timerState.remainingMs ?? 0;
  const endTime = Date.now() + remaining;

  const totalPausedMs =
    timerState.pausedAt !== null
      ? timerState.totalPausedMs + (Date.now() - timerState.pausedAt)
      : timerState.totalPausedMs;

  assignTimerState({
    state: 'running',
    endTime,
    remainingMs: null,
    totalPausedMs,
    pausedAt: null,
  });

  await persistState();
  try {
    await chrome.alarms.create(POMODORO_ALARM, { delayInMinutes: remaining / 60000 });
  } catch (err) {
    console.error('[Pomodoro] Failed to create alarm on resume:', err);
    assignTimerState({ state: 'paused', endTime: null, remainingMs: remaining });
    await persistState().catch(() => {});
    return { success: false, error: 'Failed to create alarm' };
  }
  startBadgeAlarm();
  if (timerState.currentPhase === 'work') {
    void enableFocusMode();
  }
  return { success: true };
}

export async function doSkip(): Promise<OpResult> {
  const elapsedMs = calculateElapsedMs();
  const preset = await getActivePreset();
  const plannedMs = getMinutesForPhase(timerState.currentPhase, preset) * 60000;

  addPhaseToCurrentSession(
    timerState.currentPhase,
    plannedMs,
    elapsedMs,
    'skipped',
    timerState.sessionStartedAt ?? Date.now(),
  );

  if (timerState.currentPhase === 'work') {
    timerState.workSessionsCompleted += 1;
  }

  const suggestion = computeSuggestion();
  if (timerState.currentPhase === 'work') {
    await disableFocusMode();
  }

  assignTimerState({
    state: 'transition',
    endTime: null,
    remainingMs: null,
    suggestedNext: suggestion,
    lastCompletedDurationMs: elapsedMs,
  });

  await persistState();
  chrome.alarms.clear(POMODORO_ALARM).catch(() => {});
  clearBadgeAlarm();
  updateBadge();

  await sendNotification(getSkipMessage());
  await playNotificationSound(timerState.currentPhase);

  if (timerState.autoStartNext) {
    chrome.alarms
      .create(AUTO_START_ALARM, { delayInMinutes: AUTO_START_DELAY_SEC / 60 })
      .catch(() => {});
  }
  return { success: true };
}

export async function doEndActivity(): Promise<OpResult> {
  const elapsedMs = calculateElapsedMs();

  if (timerState.state === 'running' || timerState.state === 'paused') {
    const preset = await getActivePreset();
    const plannedMs = getMinutesForPhase(timerState.currentPhase, preset) * 60000;
    addPhaseToCurrentSession(
      timerState.currentPhase,
      plannedMs,
      elapsedMs,
      'ended',
      timerState.sessionStartedAt ?? Date.now(),
    );
  }

  await disableFocusMode();
  await closeCurrentSession('ended');

  resetTimerState();

  await persistState();
  chrome.alarms.clear(POMODORO_ALARM).catch(() => {});
  chrome.alarms.clear(AUTO_START_ALARM).catch(() => {});
  clearBadgeAlarm();
  updateBadge();
  return { success: true };
}
