import { useEffect, useRef } from 'react';
import { useHistory } from './useHistory';
import type { TimerMode, Settings } from '@/types';

export function useSessionRecorder(
  mode: TimerMode,
  completedSessions: number,
  settings: Settings,
  initialized: boolean
) {
  const { addRecord } = useHistory();
  const prevSessions = useRef<number | null>(null);

  useEffect(() => {
    if (!initialized) return;

    if (prevSessions.current === null) {
      // First value after initialization — store as baseline, don't record
      prevSessions.current = completedSessions;
      return;
    }

    if (completedSessions > prevSessions.current) {
      const duration =
        mode === 'work'
          ? settings.workMinutes
          : mode === 'shortBreak'
            ? settings.shortBreakMinutes
            : settings.longBreakMinutes;

      addRecord({ mode, duration, completedAt: Date.now() });
    }
    prevSessions.current = completedSessions;
  }, [completedSessions, initialized, mode, settings, addRecord]);
}
