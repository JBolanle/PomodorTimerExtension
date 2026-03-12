import { useState, useEffect, useCallback } from 'react';
import {
  getTimerState,
  startTimer as chromeStartTimer,
  pauseTimer as chromePauseTimer,
  resumeTimer as chromeResumeTimer,
  skipPhase as chromeSkipPhase,
  endActivity as chromeEndActivity,
  startNext as chromeStartNext,
} from '@/lib/chrome';
import type { TimerState, TimerMode } from '@/types';

const POLL_INTERVAL = 500;

const INITIAL_STATE: TimerState = {
  state: 'idle',
  endTime: null,
  remainingMs: null,
  sessionStartedAt: null,
  currentPhase: 'work',
  workSessionsCompleted: 0,
  suggestedNext: null,
  lastCompletedDurationMs: null,
  activePresetId: 'default',
  autoStartNext: false,
  totalPausedMs: 0,
  pausedAt: null,
};

export function useTimerState() {
  const [timerState, setTimerState] = useState<TimerState>(INITIAL_STATE);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let active = true;

    const poll = async () => {
      try {
        const s = await getTimerState();
        if (active) {
          setTimerState(s);
          setInitialized(true);
        }
      } catch {
        // Service worker may not be ready
      }
    };

    poll();
    const id = setInterval(poll, POLL_INTERVAL);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const startTimer = useCallback(async (phase: TimerMode, minutes: number, focusMode?: boolean) => {
    await chromeStartTimer(phase, minutes, focusMode);
  }, []);

  const pauseTimer = useCallback(async () => {
    await chromePauseTimer();
  }, []);

  const resumeTimer = useCallback(async () => {
    await chromeResumeTimer();
  }, []);

  const skipPhase = useCallback(async () => {
    await chromeSkipPhase();
  }, []);

  const endActivity = useCallback(async () => {
    await chromeEndActivity();
  }, []);

  const startNext = useCallback(async (phase?: TimerMode, minutes?: number) => {
    await chromeStartNext(phase, minutes);
  }, []);

  const remainingSeconds =
    timerState.state === 'running' && timerState.endTime
      ? Math.max(0, Math.ceil((timerState.endTime - Date.now()) / 1000))
      : timerState.state === 'paused' && timerState.remainingMs
        ? Math.max(0, Math.ceil(timerState.remainingMs / 1000))
        : 0;

  return {
    ...timerState,
    initialized,
    remainingSeconds,
    startTimer,
    pauseTimer,
    resumeTimer,
    skipPhase,
    endActivity,
    startNext,
  };
}
