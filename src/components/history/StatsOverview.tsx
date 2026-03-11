import { useMemo } from 'react';
import type { SessionRecord } from '@/types';

interface StatsOverviewProps {
  filteredSessions: SessionRecord[];
}

function formatDuration(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function StatCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
        {label}
      </h3>
      <p className="text-3xl font-bold text-foreground">{value}</p>
      <p className="text-sm text-muted-foreground mt-1">{detail}</p>
    </div>
  );
}

export function StatsOverview({ filteredSessions }: StatsOverviewProps) {
  const stats = useMemo(() => {
    const workSessions = filteredSessions.filter((s) => s.mode === 'work');
    const completedWork = workSessions.filter((s) => s.completionType === 'completed');
    const breakSessions = filteredSessions.filter((s) => s.mode !== 'work');

    const totalFocusMs = workSessions.reduce((sum, s) => sum + s.actualDurationMs, 0);
    const totalFocusMin = Math.round(totalFocusMs / 60000);
    const avgSessionMin = workSessions.length > 0 ? Math.round(totalFocusMin / workSessions.length) : 0;
    const completionRate = workSessions.length > 0 ? Math.round((completedWork.length / workSessions.length) * 100) : 0;

    return {
      totalFocusTime: formatDuration(totalFocusMin),
      completedCount: completedWork.length,
      avgSession: `${avgSessionMin}m`,
      completionRate: `${completionRate}%`,
      breaksTaken: breakSessions.length,
    };
  }, [filteredSessions]);

  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
      <StatCard label="Focus Time" value={stats.totalFocusTime} detail="total work time" />
      <StatCard label="Completed" value={String(stats.completedCount)} detail="work sessions" />
      <StatCard label="Avg Session" value={stats.avgSession} detail="per work session" />
      <StatCard label="Completion" value={stats.completionRate} detail="of work sessions" />
    </div>
  );
}
