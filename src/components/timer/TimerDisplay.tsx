import { formatTime } from '@/lib/utils';
import type { TimerMode } from '@/types';
import type { Settings } from '@/types';

interface TimerDisplayProps {
  remainingSeconds: number;
  mode: TimerMode;
  settings: Settings;
  running: boolean;
}

function getDefaultSeconds(mode: TimerMode, settings: Settings): number {
  switch (mode) {
    case 'work':
      return settings.workMinutes * 60;
    case 'shortBreak':
      return settings.shortBreakMinutes * 60;
    case 'longBreak':
      return settings.longBreakMinutes * 60;
  }
}

export function TimerDisplay({ remainingSeconds, mode, settings, running }: TimerDisplayProps) {
  const displaySeconds = running ? remainingSeconds : getDefaultSeconds(mode, settings);
  const formatted = formatTime(displaySeconds);
  const [minutes, seconds] = formatted.split(':');

  return (
    <div className="flex items-center justify-center py-6 select-none">
      <span className="text-7xl font-bold tracking-tight text-foreground tabular-nums">
        {minutes}
      </span>
      <span className="text-7xl font-bold tracking-tight text-foreground animate-pulse mx-0.5">
        :
      </span>
      <span className="text-7xl font-bold tracking-tight text-foreground tabular-nums">
        {seconds}
      </span>
    </div>
  );
}
