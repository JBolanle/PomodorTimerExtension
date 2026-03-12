import { useMemo } from 'react';
import type { Session } from '@/types';

interface StatsOverviewProps {
  filteredSessions: Session[];
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
    const totalFocusMs = filteredSessions.reduce((sum, s) => sum + s.totalFocusMs, 0);
    const totalFocusMin = Math.round(totalFocusMs / 60000);
    const completed = filteredSessions.filter((s) => s.status === 'completed');
    const completionRate = filteredSessions.length > 0
      ? Math.round((completed.length / filteredSessions.length) * 100)
      : 0;
    const avgFocusMin = filteredSessions.length > 0
      ? Math.round(totalFocusMin / filteredSessions.length)
      : 0;

    return {
      totalFocusTime: formatDuration(totalFocusMin),
      sessionCount: filteredSessions.length,
      avgSession: `${avgFocusMin}m`,
      completionRate: `${completionRate}%`,
    };
  }, [filteredSessions]);

  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
      <StatCard label="Focus Time" value={stats.totalFocusTime} detail="total work time" />
      <StatCard label="Sessions" value={String(stats.sessionCount)} detail="total sessions" />
      <StatCard label="Avg Focus" value={stats.avgSession} detail="per session" />
      <StatCard label="Completion" value={stats.completionRate} detail="completed naturally" />
    </div>
  );
}
