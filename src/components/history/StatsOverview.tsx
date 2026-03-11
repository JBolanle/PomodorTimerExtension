interface StatsOverviewProps {
  stats: {
    todaySessions: number;
    weekSessions: number;
    totalSessions: number;
    todayMinutes: number;
    weekMinutes: number;
    totalMinutes: number;
  };
}

function StatCard({ label, sessions, minutes }: { label: string; sessions: number; minutes: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">
        {label}
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-3xl font-bold text-foreground">{sessions}</p>
          <p className="text-sm text-muted-foreground">sessions</p>
        </div>
        <div>
          <p className="text-3xl font-bold text-foreground">{minutes}</p>
          <p className="text-sm text-muted-foreground">minutes</p>
        </div>
      </div>
    </div>
  );
}

export function StatsOverview({ stats }: StatsOverviewProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard label="Today" sessions={stats.todaySessions} minutes={stats.todayMinutes} />
      <StatCard label="This Week" sessions={stats.weekSessions} minutes={stats.weekMinutes} />
      <StatCard label="All Time" sessions={stats.totalSessions} minutes={stats.totalMinutes} />
    </div>
  );
}
