import { useEffect, useRef } from 'react';
import { useHistory } from './useHistory';
import type { TimerMode, Settings } from '@/types';

export function useSessionRecorder(
  mode: TimerMode,
  completedSessions: number,
  settings: Settings
) {
  const { addRecord } = useHistory();
  const prevSessions = useRef(completedSessions);

  useEffect(() => {
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
  }, [completedSessions, mode, settings, addRecord]);
}
