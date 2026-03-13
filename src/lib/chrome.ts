import type { TimerState, TimerMode, Preset } from '@/types';
import { sendMessage } from './messaging';

export function getTimerState(): Promise<TimerState> {
  return sendMessage<TimerState>('getState');
}

export function startTimer(phase: TimerMode, minutes: number, focusMode?: boolean): Promise<{ success: boolean }> {
  return sendMessage('startTimer', { phase, minutes, focusMode });
}

export function pauseTimer(): Promise<{ success: boolean }> {
  return sendMessage('pauseTimer');
}

export function resumeTimer(): Promise<{ success: boolean }> {
  return sendMessage('resumeTimer');
}

export function skipPhase(): Promise<{ success: boolean }> {
  return sendMessage('skipPhase');
}

export function endActivity(): Promise<{ success: boolean }> {
  return sendMessage('endActivity');
}

export function startNext(phase?: TimerMode, minutes?: number): Promise<{ success: boolean }> {
  return sendMessage('startNext', { phase, minutes });
}

export function getPresets(): Promise<{ presets: Preset[]; activePresetId: string }> {
  return sendMessage('getPresets');
}

export function savePreset(preset: Preset): Promise<{ success: boolean }> {
  return sendMessage('savePreset', { preset });
}

export function deletePreset(presetId: string): Promise<{ success: boolean }> {
  return sendMessage('deletePreset', { presetId });
}

export function setActivePreset(presetId: string): Promise<{ success: boolean }> {
  return sendMessage('setActivePreset', { presetId });
}
