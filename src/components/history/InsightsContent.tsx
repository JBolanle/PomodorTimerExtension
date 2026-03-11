import { useMemo } from 'react';
import { SessionRecord } from '@/types';
import { StreakCard } from './StreakCard';
import { TrendComparison } from './TrendComparison';
import { WeeklyFocusChart } from './WeeklyFocusChart';
import { ProductiveHoursChart } from './ProductiveHoursChart';

interface InsightsContentProps {
  sessions: SessionRecord[];
}

export function InsightsContent({ sessions }: InsightsContentProps) {
  const workSessions = useMemo(
    () => sessions.filter(s => s.mode === 'work'),
    [sessions]
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StreakCard sessions={workSessions} />
        <TrendComparison sessions={workSessions} />
      </div>

      <WeeklyFocusChart sessions={workSessions} />

      <ProductiveHoursChart sessions={workSessions} />
    </div>
  );
}
