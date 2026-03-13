import { useCallback } from 'react';
import { useTimerState } from '@/hooks/useTimerState';
import { usePresets } from '@/hooks/usePresets';
import { TimerDisplay } from '@/components/timer/TimerDisplay';
import { PresetSelector } from '@/components/timer/PresetSelector';
import { TimerControls } from '@/components/timer/TimerControls';
import { SessionDots } from '@/components/timer/SessionDots';
import { PageHeader } from '@/components/layout/PageHeader';

const PHASE_LABELS = {
  work: 'Work',
  shortBreak: 'Short Break',
  longBreak: 'Long Break',
} as const;

export function TimerPage() {
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

  const { presets, activePreset, activePresetId, selectPreset } = usePresets();

  const handleStart = useCallback(() => {
    startTimer('work', activePreset.workMinutes);
  }, [activePreset, startTimer]);

  const handleStartNext = useCallback(() => {
    startNext();
  }, [startNext]);

  return (
    <div>
      <PageHeader title="Timer" description="Focus on your work with timed sessions." />
      <div className="max-w-md mx-auto flex flex-col items-center gap-6">
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
          currentPhase={currentPhase}
          timerState={timerState}
        />
      </div>
    </div>
  );
}
