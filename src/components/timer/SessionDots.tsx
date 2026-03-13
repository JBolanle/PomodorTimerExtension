import { cn } from '@/lib/utils';
import type { TimerMode, TimerStateEnum } from '@/types';

interface SessionDotsProps {
  completedSessions: number;
  total: number;
  currentPhase?: TimerMode;
  timerState?: TimerStateEnum;
}

export function SessionDots({ completedSessions, total, currentPhase, timerState }: SessionDotsProps) {
  const filledCount = completedSessions % total;

  function getDotLabel(index: number): string {
    if (index < filledCount) return `Session ${index + 1}: completed`;
    if (index === filledCount && currentPhase === 'work' && (timerState === 'running' || timerState === 'paused'))
      return `Session ${index + 1}: in progress`;
    return `Session ${index + 1}: not started`;
  }

  return (
    <div
      className="flex items-center gap-2"
      role="group"
      aria-label={`Work sessions: ${filledCount} of ${total} completed`}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          role="img"
          aria-label={getDotLabel(i)}
          className={cn(
            'h-2.5 w-2.5 rounded-full transition-all',
            i < filledCount
              ? 'bg-primary session-dot-active'
              : 'bg-muted-foreground/25'
          )}
        />
      ))}
    </div>
  );
}
