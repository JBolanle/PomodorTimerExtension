import type { TimerState, TimerMode, Preset } from '@/types';
import { sendMessage } from './messaging/client';

export function getTimerState(): Promise<TimerState> {
  return sendMessage('getState');
}

export function startTimer(
  phase: TimerMode,
  minutes: number,
  focusMode?: boolean,
): Promise<{ success: true }> {
  return sendMessage('startTimer', { phase, minutes, focusMode });
}

export function pauseTimer(): Promise<{ success: true }> {
  return sendMessage('pauseTimer');
}

export function resumeTimer(): Promise<{ success: true }> {
  return sendMessage('resumeTimer');
}

export function skipPhase(): Promise<{ success: true }> {
  return sendMessage('skipPhase');
}

export function endActivity(): Promise<{ success: true }> {
  return sendMessage('endActivity');
}

export function startNext(phase?: TimerMode, minutes?: number): Promise<{ success: true }> {
  return sendMessage('startNext', { phase, minutes });
}

export function getPresets(): Promise<{ presets: Preset[]; activePresetId: string }> {
  return sendMessage('getPresets');
}

export function savePreset(preset: Preset): Promise<{ success: true }> {
  return sendMessage('savePreset', { preset });
}

export function deletePreset(presetId: string): Promise<{ success: true }> {
  return sendMessage('deletePreset', { presetId });
}

export function setActivePreset(presetId: string): Promise<{ success: true }> {
  return sendMessage('setActivePreset', { presetId });
}
