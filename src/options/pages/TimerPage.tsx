import { useState, useCallback } from 'react';
import { useTimerState } from '@/hooks/useTimerState';
import { useSettings } from '@/hooks/useSettings';
import { useSessionRecorder } from '@/hooks/useSessionRecorder';
import { TimerDisplay } from '@/components/timer/TimerDisplay';
import { ModeSelector } from '@/components/timer/ModeSelector';
import { TimerControls } from '@/components/timer/TimerControls';
import { SessionDots } from '@/components/timer/SessionDots';
import { PageHeader } from '@/components/layout/PageHeader';
import type { TimerMode } from '@/types';

export function TimerPage() {
  const { running, remainingSeconds, completedSessions, startTimer, stopTimer } = useTimerState();
  const { settings } = useSettings();
  const [mode, setMode] = useState<TimerMode>('work');

  useSessionRecorder(mode);

  const handleStart = useCallback(() => {
    const minutes = mode === 'work'
      ? settings.workMinutes
      : mode === 'shortBreak'
        ? settings.shortBreakMinutes
        : settings.longBreakMinutes;
    startTimer(minutes);
  }, [mode, settings, startTimer]);

  const handleStop = useCallback(() => {
    stopTimer();
  }, [stopTimer]);

  return (
    <div>
      <PageHeader title="Timer" description="Focus on your work with timed sessions." />
      <div className="max-w-md mx-auto flex flex-col items-center gap-6">
        <ModeSelector mode={mode} onModeChange={setMode} disabled={running} />
        <TimerDisplay
          remainingSeconds={remainingSeconds}
          mode={mode}
          settings={settings}
          running={running}
        />
        <TimerControls running={running} onStart={handleStart} onStop={handleStop} />
        <SessionDots completedSessions={completedSessions} total={settings.sessionsBeforeLongBreak} />
      </div>
    </div>
  );
}
