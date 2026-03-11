import { useState, useCallback } from 'react';
import { useTimerState } from '@/hooks/useTimerState';
import { useTheme } from '@/hooks/useTheme';
import { useSettings } from '@/hooks/useSettings';
import { useSessionRecorder } from '@/hooks/useSessionRecorder';
import { TimerDisplay } from '@/components/timer/TimerDisplay';
import { ModeSelector } from '@/components/timer/ModeSelector';
import { TimerControls } from '@/components/timer/TimerControls';
import { SessionDots } from '@/components/timer/SessionDots';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { THEMES, THEME_META } from '@/lib/constants';
import type { TimerMode } from '@/types';

export default function App() {
  const { running, remainingSeconds, completedSessions, startTimer, stopTimer } = useTimerState();
  const { theme, setTheme } = useTheme();
  const { settings } = useSettings();
  const [mode, setMode] = useState<TimerMode>('work');

  useSessionRecorder(mode, completedSessions, settings);

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

  const cycleTheme = useCallback(() => {
    const idx = THEMES.indexOf(theme);
    const next = THEMES[(idx + 1) % THEMES.length];
    setTheme(next);
  }, [theme, setTheme]);

  const handleOpenSettings = useCallback(() => {
    if (chrome?.runtime?.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    }
  }, []);

  return (
    <div className="w-[350px] p-6 flex flex-col items-center gap-4">
      <ModeSelector
        mode={mode}
        onModeChange={setMode}
        disabled={running}
      />

      <TimerDisplay
        remainingSeconds={remainingSeconds}
        mode={mode}
        settings={settings}
        running={running}
      />

      <TimerControls
        running={running}
        onStart={handleStart}
        onStop={handleStop}
      />

      <SessionDots
        completedSessions={completedSessions}
        total={settings.sessionsBeforeLongBreak}
      />

      <Separator className="my-1" />

      <footer className="w-full flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={cycleTheme}
          className="text-xs text-muted-foreground"
        >
          {THEME_META[theme].label}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleOpenSettings}
          className="text-xs text-muted-foreground"
        >
          Settings
        </Button>
      </footer>
    </div>
  );
}
