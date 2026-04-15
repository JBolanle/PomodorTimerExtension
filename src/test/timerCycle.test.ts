// Phase 7 coverage — pure cycle + elapsed-time math in `timer/cycle.ts`.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installChromeMocks, uninstallChromeMocks, getMocks } from './chromeMocks';

beforeEach(() => {
  installChromeMocks();
  vi.resetModules();
  // Seed presets repo with the default preset so getActivePresetSync has
  // something to resolve against once the presets module loads.
  const mocks = getMocks();
  mocks.storage.set('presets', [
    {
      id: 'default',
      name: 'Default',
      workMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      sessionsBeforeLongBreak: 4,
    },
  ]);
  mocks.storage.set('activePresetId', 'default');
});

afterEach(() => {
  uninstallChromeMocks();
  vi.useRealTimers();
});

async function loadCycle() {
  const cycle = await import('@/background/timer/cycle');
  const state = await import('@/background/state');
  const presets = await import('@/background/presets/store');
  // Force the presets cache to populate before we query it synchronously.
  await presets.getActivePreset();
  return { ...cycle, ...state };
}

describe('computeSuggestion', () => {
  it('suggests a short break when below the long-break threshold', async () => {
    const { computeSuggestion, assignTimerState } = await loadCycle();
    assignTimerState({ currentPhase: 'work', workSessionsCompleted: 2 });
    expect(computeSuggestion()).toBe('shortBreak');
  });

  it('suggests a long break when threshold reached', async () => {
    const { computeSuggestion, assignTimerState } = await loadCycle();
    assignTimerState({ currentPhase: 'work', workSessionsCompleted: 4 });
    expect(computeSuggestion()).toBe('longBreak');
  });

  it('suggests work after any break phase', async () => {
    const { computeSuggestion, assignTimerState } = await loadCycle();
    assignTimerState({ currentPhase: 'shortBreak' });
    expect(computeSuggestion()).toBe('work');
    assignTimerState({ currentPhase: 'longBreak' });
    expect(computeSuggestion()).toBe('work');
  });
});

describe('calculateElapsedMs', () => {
  it('returns zero when idle', async () => {
    const { calculateElapsedMs, assignTimerState } = await loadCycle();
    assignTimerState({ state: 'idle' });
    expect(calculateElapsedMs()).toBe(0);
  });

  it('while running, subtracts totalPausedMs from wall-clock elapsed', async () => {
    vi.useFakeTimers();
    const now = 1_700_000_000_000;
    vi.setSystemTime(now);
    const { calculateElapsedMs, assignTimerState } = await loadCycle();
    assignTimerState({
      state: 'running',
      sessionStartedAt: now - 10_000,
      totalPausedMs: 2_000,
    });
    expect(calculateElapsedMs()).toBe(8_000);
  });

  it('while paused, derives elapsed from planned duration - remaining', async () => {
    const { calculateElapsedMs, assignTimerState } = await loadCycle();
    assignTimerState({
      state: 'paused',
      currentPhase: 'work',
      sessionStartedAt: 123,
      remainingMs: 20 * 60_000, // 20 minutes left of a 25-minute work phase
    });
    expect(calculateElapsedMs()).toBe(5 * 60_000);
  });
});
