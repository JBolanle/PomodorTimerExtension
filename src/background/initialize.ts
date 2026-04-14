// SW bootstrap: run migrations, hydrate in-memory state from storage,
// and recover any running timer / focus mode rules.

import { POMODORO_ALARM } from './constants';
import { startBadgeAlarm, updateBadge } from './badge';
import { disableFocusMode, enableFocusMode } from './focusMode/controller';
import { runMigrations } from './storage/migrations';
import {
  currentSessionRepo,
  sessionHistoryRepo,
  settingsRepo,
  timerStateRepo,
} from './storage/repos';
import { assignTimerState, runtime } from './state';
import { handleTimerComplete } from './timer/completion';
import { timerState } from './state';

async function loadState(): Promise<void> {
  try {
    await runMigrations();
  } catch (err) {
    console.error('[Pomodoro] Migration failed:', err);
  }

  try {
    const persisted = await timerStateRepo.get();
    assignTimerState(persisted);
  } catch (err) {
    console.error('[Pomodoro] Failed to load timer state:', err);
  }

  try {
    runtime.currentSession = await currentSessionRepo.get();
  } catch (err) {
    console.error('[Pomodoro] Failed to load current session:', err);
  }
}

export async function initialize(): Promise<void> {
  try {
    await loadState();
  } catch (err) {
    console.error('[Pomodoro] Failed to load state, using defaults:', err);
  }

  // One-time migration: clear legacy `sessionHistory` key once it has
  // been superseded by `sessions`. Mirrors the legacy SW behavior.
  try {
    const history = await sessionHistoryRepo.get();
    if (history.length > 0) {
      await sessionHistoryRepo.remove();
    }
  } catch (err) {
    console.error('[Pomodoro] Failed to clear old sessionHistory:', err);
  }

  // Load badge setting into cached runtime.
  try {
    const settings = await settingsRepo.get();
    runtime.showBadge = settings.showBadge ?? true;
  } catch (err) {
    console.error('[Pomodoro] Failed to load badge setting:', err);
  }

  // Timer recovery.
  if (timerState.state === 'running') {
    if (timerState.endTime && timerState.endTime <= Date.now()) {
      await handleTimerComplete().catch((err) =>
        console.error('[Pomodoro] Recovery handleTimerComplete failed:', err),
      );
    } else if (timerState.endTime) {
      const remainingMin = (timerState.endTime - Date.now()) / 60000;
      await chrome.alarms
        .create(POMODORO_ALARM, { delayInMinutes: Math.max(0.01, remainingMin) })
        .catch((err) =>
          console.error('[Pomodoro] Recovery alarm creation failed:', err),
        );
    }
  }

  if (timerState.state === 'running') {
    startBadgeAlarm();
  } else if (timerState.state === 'paused') {
    updateBadge();
  }

  // Focus mode recovery.
  const isWorkActive =
    (timerState.state === 'running' || timerState.state === 'paused') &&
    timerState.currentPhase === 'work';
  if (isWorkActive) {
    enableFocusMode().catch((err) =>
      console.error('[Pomodoro] Focus mode recovery failed:', err),
    );
  } else {
    disableFocusMode().catch((err) =>
      console.error('[Pomodoro] Focus mode cleanup failed:', err),
    );
  }
}
