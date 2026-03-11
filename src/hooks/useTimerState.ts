import { useState, useEffect, useCallback } from 'react';
import { getTimerState, startTimer as chromeStartTimer, stopTimer as chromeStopTimer } from '@/lib/chrome';
import type { TimerState } from '@/types';

const POLL_INTERVAL = 500;

export function useTimerState() {
  const [state, setState] = useState<TimerState>({
    endTime: null,
    running: false,
    completedSessions: 0,
  });

  useEffect(() => {
    let active = true;

    const poll = async () => {
      try {
        const s = await getTimerState();
        if (active) setState(s);
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

  const startTimer = useCallback(async (minutes: number) => {
    await chromeStartTimer(minutes);
  }, []);

  const stopTimer = useCallback(async () => {
    await chromeStopTimer();
  }, []);

  const remainingSeconds = state.running && state.endTime
    ? Math.max(0, Math.ceil((state.endTime - Date.now()) / 1000))
    : 0;

  return {
    ...state,
    remainingSeconds,
    startTimer,
    stopTimer,
  };
}
