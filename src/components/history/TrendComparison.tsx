import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { SessionRecord } from '@/types';

interface TrendComparisonProps {
  sessions: SessionRecord[];
}

export function TrendComparison({ sessions }: TrendComparisonProps) {
  const trends = useMemo(() => calculateTrends(sessions), [sessions]);

  return (
    <div className="bg-muted/30 rounded-lg p-4">
      <h3 className="text-sm font-medium text-muted-foreground mb-3">
        This Week vs Last Week
      </h3>

      <div className="space-y-3">
        <TrendRow
          label="Focus Time"
          current={formatMinutes(trends.thisWeekMinutes)}
          previous={formatMinutes(trends.lastWeekMinutes)}
          change={trends.minutesChange}
        />
        <TrendRow
          label="Sessions"
          current={trends.thisWeekSessions.toString()}
          previous={trends.lastWeekSessions.toString()}
          change={trends.sessionsChange}
        />
        <TrendRow
          label="Completion Rate"
          current={`${trends.thisWeekCompletionRate}%`}
          previous={`${trends.lastWeekCompletionRate}%`}
          change={trends.completionChange}
        />
      </div>
    </div>
  );
}

interface TrendRowProps {
  label: string;
  current: string;
  previous: string;
  change: number;
}

function TrendRow({ label, current, change }: TrendRowProps) {
  const isPositive = change > 0;
  const isNeutral = change === 0;

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{current}</span>
        <div className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${
          isNeutral
            ? 'bg-muted text-muted-foreground'
            : isPositive
              ? 'bg-green-500/20 text-green-500'
              : 'bg-red-500/20 text-red-400'
        }`}>
          {isNeutral ? (
            <Minus className="w-3 h-3" />
          ) : isPositive ? (
            <TrendingUp className="w-3 h-3" />
          ) : (
            <TrendingDown className="w-3 h-3" />
          )}
          <span>{isNeutral ? '0%' : `${isPositive ? '+' : ''}${change}%`}</span>
        </div>
      </div>
    </div>
  );
}

interface TrendData {
  thisWeekMinutes: number;
  lastWeekMinutes: number;
  minutesChange: number;
  thisWeekSessions: number;
  lastWeekSessions: number;
  sessionsChange: number;
  thisWeekCompletionRate: number;
  lastWeekCompletionRate: number;
  completionChange: number;
}

function calculateTrends(sessions: SessionRecord[]): TrendData {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayOfWeek = today.getDay();

  const thisWeekStart = new Date(today);
  thisWeekStart.setDate(today.getDate() - dayOfWeek);

  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(thisWeekStart);
  lastWeekEnd.setTime(lastWeekEnd.getTime() - 1);

  const thisWeekSessions = sessions.filter(s => {
    const date = new Date(s.completedAt);
    return date >= thisWeekStart && date <= now;
  });

  const lastWeekSessions = sessions.filter(s => {
    const date = new Date(s.completedAt);
    return date >= lastWeekStart && date <= lastWeekEnd;
  });

  const thisWeekMinutes = sumMinutes(thisWeekSessions);
  const lastWeekMinutes = sumMinutes(lastWeekSessions);

  const thisWeekCompleted = thisWeekSessions.filter(s => s.completionType === 'completed').length;
  const lastWeekCompleted = lastWeekSessions.filter(s => s.completionType === 'completed').length;

  const thisWeekCompletionRate = thisWeekSessions.length > 0
    ? Math.round((thisWeekCompleted / thisWeekSessions.length) * 100)
    : 0;
  const lastWeekCompletionRate = lastWeekSessions.length > 0
    ? Math.round((lastWeekCompleted / lastWeekSessions.length) * 100)
    : 0;

  return {
    thisWeekMinutes,
    lastWeekMinutes,
    minutesChange: calcPercentChange(lastWeekMinutes, thisWeekMinutes),
    thisWeekSessions: thisWeekSessions.length,
    lastWeekSessions: lastWeekSessions.length,
    sessionsChange: calcPercentChange(lastWeekSessions.length, thisWeekSessions.length),
    thisWeekCompletionRate,
    lastWeekCompletionRate,
    completionChange: thisWeekCompletionRate - lastWeekCompletionRate,
  };
}

function sumMinutes(sessions: SessionRecord[]): number {
  return Math.round(
    sessions.reduce((sum, s) => sum + s.actualDurationMs, 0) / 60000
  );
}

function calcPercentChange(previous: number, current: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
