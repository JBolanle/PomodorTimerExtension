import { useState, useEffect } from 'react';
import { formatTime } from '@/lib/utils';
import type { TimerMode, TimerStateEnum, Preset } from '@/types';

const PHASE_LABELS: Record<TimerMode, string> = {
  work: 'Work',
  shortBreak: 'Short Break',
  longBreak: 'Long Break',
};

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
  const [minutesStr, secondsStr] = formatted.split(':');
  const minutes = Math.floor(displaySeconds / 60);
  const seconds = displaySeconds % 60;

  const [lastAnnounced, setLastAnnounced] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    if (timerState === 'running' && minutes !== lastAnnounced && seconds === 0 && minutes > 0) {
      setAnnouncement(`${minutes} minutes remaining`);
      setLastAnnounced(minutes);
    }
  }, [timerState, minutes, seconds, lastAnnounced]);

  useEffect(() => {
    if (timerState !== 'running') {
      setLastAnnounced(null);
      setAnnouncement('');
    }
  }, [timerState]);

  const phaseLabel = PHASE_LABELS[timerState === 'transition' && suggestedNext ? suggestedNext : mode];

  return (
    <div
      className="timer-wrap flex items-center justify-center py-6 select-none"
      role="timer"
      aria-label={`${phaseLabel} session timer`}
    >
      <time
        className="flex items-center"
        dateTime={`PT${minutes}M${seconds}S`}
        aria-hidden="true"
      >
        <span className="timer-text text-7xl font-bold tracking-tight tabular-nums">
          {minutesStr}
        </span>
        <span className="timer-text text-7xl font-bold tracking-tight colon-pulse mx-0.5">
          :
        </span>
        <span className="timer-text text-7xl font-bold tracking-tight tabular-nums">
          {secondsStr}
        </span>
      </time>

      <span className="sr-only">
        {minutes} minutes and {seconds} seconds remaining
      </span>

      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>
    </div>
  );
}
