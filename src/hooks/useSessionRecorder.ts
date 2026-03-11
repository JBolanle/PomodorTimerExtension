import { useEffect, useRef } from 'react';
import { useTimerState } from './useTimerState';
import { useHistory } from './useHistory';
import { useSettings } from './useSettings';
import type { TimerMode } from '@/types';

export function useSessionRecorder(mode: TimerMode) {
  const { completedSessions } = useTimerState();
  const { addRecord } = useHistory();
  const { settings } = useSettings();
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
