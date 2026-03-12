import { Button } from '@/components/ui/button';
import type { TimerStateEnum, TimerMode } from '@/types';

const PHASE_LABELS: Record<TimerMode, string> = {
  work: 'Work',
  shortBreak: 'Short Break',
  longBreak: 'Long Break',
};

interface TimerControlsProps {
  timerState: TimerStateEnum;
  suggestedNext: TimerMode | null;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onSkip: () => void;
  onEndActivity: () => void;
  onStartNext: () => void;
}

export function TimerControls({
  timerState,
  suggestedNext,
  onStart,
  onPause,
  onResume,
  onSkip,
  onEndActivity,
  onStartNext,
}: TimerControlsProps) {
  if (timerState === 'idle') {
    return (
      <div className="flex flex-col items-center gap-2">
        <Button size="lg" className="min-w-[120px] btn-press" onClick={onStart} aria-label="Start timer">
          Start
        </Button>
      </div>
    );
  }

  if (timerState === 'transition') {
    const nextLabel = suggestedNext ? PHASE_LABELS[suggestedNext] : 'Next';
    return (
      <div className="flex flex-col items-center gap-2">
        <Button size="lg" className="min-w-[120px] btn-press" onClick={onStartNext} aria-label={`Start ${nextLabel}`}>
          Start {nextLabel}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground"
          onClick={onEndActivity}
          aria-label="End activity"
        >
          End Activity
        </Button>
      </div>
    );
  }

  // RUNNING or PAUSED
  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        size="lg"
        className="min-w-[120px] btn-press"
        onClick={timerState === 'running' ? onPause : onResume}
        aria-label={timerState === 'running' ? 'Pause timer' : 'Resume timer'}
      >
        {timerState === 'running' ? 'Pause' : 'Resume'}
      </Button>
      <div className="flex gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground"
          onClick={onSkip}
          aria-label={`Skip to ${suggestedNext ? PHASE_LABELS[suggestedNext] : 'next phase'}`}
        >
          Skip
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground"
          onClick={onEndActivity}
          aria-label="End activity"
        >
          End Activity
        </Button>
      </div>
    </div>
  );
}
