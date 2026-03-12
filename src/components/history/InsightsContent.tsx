import type { Session } from '@/types';
import { StreakCard } from './StreakCard';
import { TrendComparison } from './TrendComparison';
import { WeeklyFocusChart } from './WeeklyFocusChart';
import { ProductiveHoursChart } from './ProductiveHoursChart';

interface InsightsContentProps {
  sessions: Session[];
}

export function InsightsContent({ sessions }: InsightsContentProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StreakCard sessions={sessions} />
        <TrendComparison sessions={sessions} />
      </div>

      <WeeklyFocusChart sessions={sessions} />

      <ProductiveHoursChart sessions={sessions} />
    </div>
  );
}
