// Toolbar badge controller.

import {
  BADGE_ALARM,
  BADGE_COLORS,
  BADGE_NOTIFICATION_MS,
  BADGE_PERIOD_MINUTES,
} from '../constants';
import { runtime, timerState } from '../state';

export function updateBadge(): void {
  try {
    if (!runtime.showBadge) {
      chrome.action.setBadgeText({ text: '' });
      return;
    }

    let remainingMs = 0;

    if (timerState.state === 'running' && timerState.endTime) {
      remainingMs = Math.max(0, timerState.endTime - Date.now());
    } else if (timerState.state === 'paused' && timerState.remainingMs) {
      remainingMs = timerState.remainingMs;
    } else {
      chrome.action.setBadgeText({ text: '' });
      return;
    }

    const minutes = Math.ceil(remainingMs / 60000);
    const text = minutes < 1 ? '<1' : String(minutes);

    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({
      color: BADGE_COLORS[timerState.currentPhase] ?? BADGE_COLORS.work,
    });
  } catch (err) {
    console.error('[Pomodoro] Badge update failed:', err);
  }
}

export function startBadgeAlarm(): void {
  chrome.alarms.clear(BADGE_ALARM).catch(() => {});
  updateBadge();
  chrome.alarms.create(BADGE_ALARM, { periodInMinutes: BADGE_PERIOD_MINUTES }).catch(() => {});
}

export function clearBadgeAlarm(): void {
  chrome.alarms.clear(BADGE_ALARM).catch(() => {});
}

export function showBadgeNotification(emoji: string): void {
  chrome.action.setBadgeText({ text: emoji });
  chrome.action.setBadgeBackgroundColor({ color: '#333' });
  setTimeout(() => {
    updateBadge();
  }, BADGE_NOTIFICATION_MS);
}
