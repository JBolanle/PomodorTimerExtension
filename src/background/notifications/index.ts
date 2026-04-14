// Chrome notifications + phase-completion / skip messages.

import { timerState } from '../state';

export async function sendNotification(message: string): Promise<void> {
  try {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: 'Pomodoro Timer',
      message,
    });
  } catch (err) {
    console.error('[Pomodoro] Notification failed (permission denied?):', err);
  }
}

export function getCompletionMessage(): string {
  switch (timerState.currentPhase) {
    case 'work':
      return 'Work session complete! Time for a break.';
    case 'shortBreak':
      return 'Break over! Ready to focus?';
    case 'longBreak':
      return 'Long break over! Starting a new cycle.';
    default:
      return 'Session complete!';
  }
}

export function getSkipMessage(): string {
  switch (timerState.currentPhase) {
    case 'work':
      return 'Work session skipped. Take a break!';
    case 'shortBreak':
      return 'Break skipped. Back to work!';
    case 'longBreak':
      return 'Long break skipped. Back to work!';
    default:
      return 'Session skipped.';
  }
}
