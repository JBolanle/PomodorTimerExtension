import type { TimerState, TimerMode, Preset } from '@/types';

export function getTimerState(): Promise<TimerState> {
  return chrome.runtime.sendMessage({ action: 'getState' });
}

export function startTimer(phase: TimerMode, minutes: number): Promise<{ success: boolean }> {
  return chrome.runtime.sendMessage({ action: 'startTimer', phase, minutes });
}

export function pauseTimer(): Promise<{ success: boolean }> {
  return chrome.runtime.sendMessage({ action: 'pauseTimer' });
}

export function resumeTimer(): Promise<{ success: boolean }> {
  return chrome.runtime.sendMessage({ action: 'resumeTimer' });
}

export function skipPhase(): Promise<{ success: boolean }> {
  return chrome.runtime.sendMessage({ action: 'skipPhase' });
}

export function endActivity(): Promise<{ success: boolean }> {
  return chrome.runtime.sendMessage({ action: 'endActivity' });
}

export function startNext(phase?: TimerMode, minutes?: number): Promise<{ success: boolean }> {
  return chrome.runtime.sendMessage({ action: 'startNext', phase, minutes });
}

export function getPresets(): Promise<{ presets: Preset[]; activePresetId: string }> {
  return chrome.runtime.sendMessage({ action: 'getPresets' });
}

export function savePreset(preset: Preset): Promise<{ success: boolean }> {
  return chrome.runtime.sendMessage({ action: 'savePreset', preset });
}

export function deletePreset(presetId: string): Promise<{ success: boolean }> {
  return chrome.runtime.sendMessage({ action: 'deletePreset', presetId });
}

export function setActivePreset(presetId: string): Promise<{ success: boolean }> {
  return chrome.runtime.sendMessage({ action: 'setActivePreset', presetId });
}
