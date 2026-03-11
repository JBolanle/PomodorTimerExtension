import type { TimerState } from '@/types';

export function getTimerState(): Promise<TimerState> {
  return chrome.runtime.sendMessage({ action: 'getState' });
}

export function startTimer(minutes: number): Promise<{ success: boolean }> {
  return chrome.runtime.sendMessage({ action: 'startTimer', minutes });
}

export function stopTimer(): Promise<{ success: boolean }> {
  return chrome.runtime.sendMessage({ action: 'stopTimer' });
}
