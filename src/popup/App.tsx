import { useCallback } from 'react';
import { useTimerState } from '@/hooks/useTimerState';
import { useTheme } from '@/hooks/useTheme';
import { usePresets } from '@/hooks/usePresets';
import { TimerDisplay } from '@/components/timer/TimerDisplay';
import { PresetSelector } from '@/components/timer/PresetSelector';
import { TimerControls } from '@/components/timer/TimerControls';
import { SessionDots } from '@/components/timer/SessionDots';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { THEMES, THEME_META } from '@/lib/constants';

const PHASE_LABELS = {
  work: 'Work',
  shortBreak: 'Short Break',
  longBreak: 'Long Break',
} as const;

export default function App() {
  const {
    state: timerState,
    currentPhase,
    workSessionsCompleted,
    suggestedNext,
    remainingSeconds,
    startTimer,
    pauseTimer,
    resumeTimer,
    skipPhase,
    endActivity,
    startNext,
  } = useTimerState();

  const { theme, setTheme } = useTheme();
  const { presets, activePreset, activePresetId, selectPreset } = usePresets();

  const handleStart = useCallback(() => {
    startTimer('work', activePreset.workMinutes);
  }, [activePreset, startTimer]);

  const handleStartNext = useCallback(() => {
    startNext();
  }, [startNext]);

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
      {timerState === 'idle' && (
        <PresetSelector
          presets={presets}
          activePresetId={activePresetId}
          onSelect={selectPreset}
          disabled={false}
        />
      )}

      {timerState === 'transition' && (
        <p className="text-sm text-muted-foreground text-center">
          {PHASE_LABELS[currentPhase]} complete! Up next: {suggestedNext ? PHASE_LABELS[suggestedNext] : 'Work'}
        </p>
      )}

      {(timerState === 'running' || timerState === 'paused') && (
        <p className="text-sm font-medium text-foreground">
          {PHASE_LABELS[currentPhase]}
        </p>
      )}

      <TimerDisplay
        remainingSeconds={remainingSeconds}
        mode={currentPhase}
        timerState={timerState}
        activePreset={activePreset}
        suggestedNext={suggestedNext}
      />

      <TimerControls
        timerState={timerState}
        suggestedNext={suggestedNext}
        onStart={handleStart}
        onPause={pauseTimer}
        onResume={resumeTimer}
        onSkip={skipPhase}
        onEndActivity={endActivity}
        onStartNext={handleStartNext}
      />

      <SessionDots
        completedSessions={workSessionsCompleted}
        total={activePreset.sessionsBeforeLongBreak}
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
