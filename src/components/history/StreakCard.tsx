import { useMemo } from 'react';
import { Flame, Trophy } from 'lucide-react';
import type { Session } from '@/types';

interface StreakCardProps {
  sessions: Session[];
}

export function StreakCard({ sessions }: StreakCardProps) {
  const { currentStreak, bestStreak, isActiveToday } = useMemo(
    () => calculateStreaks(sessions),
    [sessions]
  );

  return (
    <div className="bg-muted/30 rounded-lg p-4">
      <h3 className="text-sm font-medium text-muted-foreground mb-3">
        Focus Streaks
      </h3>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full ${
            currentStreak > 0 ? 'bg-orange-500/20' : 'bg-muted'
          }`}>
            <Flame className={`w-5 h-5 ${
              currentStreak > 0 ? 'text-orange-500' : 'text-muted-foreground'
            }`} aria-hidden="true" />
          </div>
          <div>
            <div className="text-2xl font-bold">
              {currentStreak}
              <span className="text-sm font-normal text-muted-foreground ml-1">
                day{currentStreak !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {isActiveToday ? 'Current streak' : 'Streak paused'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-yellow-500/20">
            <Trophy className="w-5 h-5 text-yellow-500" aria-hidden="true" />
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">
              {bestStreak}
              <span className="text-sm font-normal text-muted-foreground ml-1">
                day{bestStreak !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">Best streak</div>
          </div>
        </div>
      </div>

      {currentStreak > 0 && currentStreak === bestStreak && (
        <div className="mt-3 text-xs text-center text-yellow-500 bg-yellow-500/10 py-1 rounded">
          You're on your best streak!
        </div>
      )}
      {currentStreak > 0 && currentStreak < bestStreak && (
        <div className="mt-3 text-xs text-center text-muted-foreground">
          {bestStreak - currentStreak} more day{bestStreak - currentStreak !== 1 ? 's' : ''} to beat your record
        </div>
      )}
    </div>
  );
}

interface StreakResult {
  currentStreak: number;
  bestStreak: number;
  isActiveToday: boolean;
}

function calculateStreaks(sessions: Session[]): StreakResult {
  if (sessions.length === 0) {
    return { currentStreak: 0, bestStreak: 0, isActiveToday: false };
  }

  const daysWithActivity = getUniqueDays(sessions);

  if (daysWithActivity.length === 0) {
    return { currentStreak: 0, bestStreak: 0, isActiveToday: false };
  }

  const today = getDateKey(new Date());
  const yesterday = getDateKey(new Date(Date.now() - 86400000));

  const mostRecentDay = daysWithActivity[0];
  const isActiveToday = mostRecentDay === today;
  const streakActive = mostRecentDay === today || mostRecentDay === yesterday;

  let currentStreak = 0;
  if (streakActive) {
    currentStreak = 1;
    for (let i = 1; i < daysWithActivity.length; i++) {
      const prevDay = daysWithActivity[i - 1];
      const currDay = daysWithActivity[i];

      if (isConsecutive(currDay, prevDay)) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  let bestStreak = 0;
  let tempStreak = 1;

  for (let i = 1; i < daysWithActivity.length; i++) {
    const prevDay = daysWithActivity[i - 1];
    const currDay = daysWithActivity[i];

    if (isConsecutive(currDay, prevDay)) {
      tempStreak++;
    } else {
      bestStreak = Math.max(bestStreak, tempStreak);
      tempStreak = 1;
    }
  }
  bestStreak = Math.max(bestStreak, tempStreak, currentStreak);

  return { currentStreak, bestStreak, isActiveToday };
}

function getUniqueDays(sessions: Session[]): string[] {
  const days = new Set<string>();
  for (const session of sessions) {
    if (session.totalFocusMs > 0) {
      days.add(getDateKey(new Date(session.startedAt)));
    }
  }
  return Array.from(days).sort().reverse();
}

function getDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

function isConsecutive(earlier: string, later: string): boolean {
  const d1 = new Date(earlier);
  const d2 = new Date(later);
  const diffDays = Math.round((d2.getTime() - d1.getTime()) / 86400000);
  return diffDays === 1;
}
