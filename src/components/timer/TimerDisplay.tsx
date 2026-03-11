import { formatTime } from '@/lib/utils';
import type { TimerMode, TimerStateEnum, Preset } from '@/types';

interface TimerDisplayProps {
  remainingSeconds: number;
  mode: TimerMode;
  timerState: TimerStateEnum;
  activePreset: Preset;
  suggestedNext: TimerMode | null;
}

function getDefaultSeconds(mode: TimerMode, preset: Preset): number {
  switch (mode) {
    case 'work':
      return preset.workMinutes * 60;
    case 'shortBreak':
      return preset.shortBreakMinutes * 60;
    case 'longBreak':
      return preset.longBreakMinutes * 60;
  }
}

export function TimerDisplay({ remainingSeconds, mode, timerState, activePreset, suggestedNext }: TimerDisplayProps) {
  let displaySeconds: number;

  switch (timerState) {
    case 'running':
    case 'paused':
      displaySeconds = remainingSeconds;
      break;
    case 'transition':
      displaySeconds = suggestedNext ? getDefaultSeconds(suggestedNext, activePreset) : 0;
      break;
    case 'idle':
    default:
      displaySeconds = getDefaultSeconds(mode, activePreset);
      break;
  }

  const formatted = formatTime(displaySeconds);
  const [minutes, seconds] = formatted.split(':');

  return (
    <div className="timer-wrap flex items-center justify-center py-6 select-none">
      <span className="timer-text text-7xl font-bold tracking-tight tabular-nums">
        {minutes}
      </span>
      <span className="timer-text text-7xl font-bold tracking-tight colon-pulse mx-0.5">
        :
      </span>
      <span className="timer-text text-7xl font-bold tracking-tight tabular-nums">
        {seconds}
      </span>
    </div>
  );
}
