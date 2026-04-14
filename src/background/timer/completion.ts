// Timer completion: fired by the pomodoro alarm (or recovered at SW
// boot when the alarm elapsed while the SW was asleep). Also handles
// the auto-start-next alarm that follows the inter-phase delay.

import { AUTO_START_ALARM, AUTO_START_DELAY_SEC } from '../constants';
import { clearBadgeAlarm, updateBadge } from '../badge';
import { disableFocusMode } from '../focusMode/controller';
import { getCompletionMessage, sendNotification } from '../notifications';
import { persistState } from '../persist';
import { getActivePreset, getMinutesForPhase } from '../presets/store';
import {
  addPhaseToCurrentSession,
  closeCurrentSession,
} from '../sessions/store';
import { playNotificationSound } from '../sound';
import { settingsRepo } from '../storage/repos';
import { assignTimerState, timerState } from '../state';
import { doStartTimer } from './operations';
import { computeSuggestion } from './cycle';

export async function handleTimerComplete(): Promise<void> {
  if (timerState.state !== 'running') return;

  const preset = await getActivePreset();
  const plannedMs = getMinutesForPhase(timerState.currentPhase, preset) * 60000;
  let actualMs = timerState.sessionStartedAt
    ? Date.now() - timerState.sessionStartedAt - (timerState.totalPausedMs || 0)
    : plannedMs;
  actualMs = Math.min(actualMs, plannedMs); // Cap for SW wake latency

  addPhaseToCurrentSession(
    timerState.currentPhase,
    plannedMs,
    actualMs,
    'completed',
    timerState.sessionStartedAt ?? Date.now(),
  );

  if (timerState.currentPhase === 'work') {
    timerState.workSessionsCompleted += 1;
  } else if (timerState.currentPhase === 'longBreak') {
    timerState.workSessionsCompleted = 0;
    // Long break completion = natural end of a Pomodoro cycle
    await closeCurrentSession('completed');
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
    lastCompletedDurationMs: actualMs,
  });

  await persistState();
  clearBadgeAlarm();
  updateBadge();

  const settings = await settingsRepo.get();
  if (settings.notificationsEnabled ?? true) {
    await sendNotification(getCompletionMessage());
  }
  await playNotificationSound(timerState.currentPhase);

  const autoStart = settings.autoStartNext ?? false;
  timerState.autoStartNext = autoStart;
  if (autoStart) {
    chrome.alarms
      .create(AUTO_START_ALARM, { delayInMinutes: AUTO_START_DELAY_SEC / 60 })
      .catch(() => {});
  }
}

export async function handleAutoStart(): Promise<void> {
  if (timerState.state !== 'transition' || !timerState.suggestedNext) return;

  const phase = timerState.suggestedNext;
  const preset = await getActivePreset();
  const minutes = getMinutesForPhase(phase, preset);
  await doStartTimer(phase, minutes);
}
