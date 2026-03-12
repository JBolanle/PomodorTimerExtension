import type { Session, PhaseRecord, TimerMode } from '@/types';

const MODE_COLORS: Record<TimerMode, string> = {
  work: 'bg-red-500',
  shortBreak: 'bg-green-500',
  longBreak: 'bg-blue-500',
};

const MODE_LABELS: Record<TimerMode, string> = {
  work: 'Work',
  shortBreak: 'Short Break',
  longBreak: 'Long Break',
};

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-green-500/15 text-green-600',
  ended: 'bg-muted text-muted-foreground',
  active: 'bg-primary/15 text-primary',
};

function getDayKey(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDayLabel(dateKey: string): string {
  const today = getDayKey(Date.now());
  const yesterday = getDayKey(Date.now() - 86400000);
  if (dateKey === today) return 'Today';
  if (dateKey === yesterday) return 'Yesterday';
  const d = new Date(dateKey + 'T12:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function formatDurationMs(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 60) return `${totalMin}m`;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function formatShortDuration(ms: number): string {
  const min = Math.round(ms / 60000);
  return `${min}m`;
}

function TimelineBar({ phases }: { phases: PhaseRecord[] }) {
  const totalMs = phases.reduce((sum, p) => sum + p.actualDurationMs, 0);
  if (totalMs === 0) return null;

  return (
    <div className="flex w-full h-6 rounded overflow-hidden">
      {phases.map((phase) => {
        const widthPercent = (phase.actualDurationMs / totalMs) * 100;
        if (widthPercent < 1) return null;
        const isIncomplete = phase.completionType !== 'completed';

        return (
          <div
            key={phase.id}
            className={`${MODE_COLORS[phase.mode]} ${isIncomplete ? 'opacity-50' : ''} relative flex items-center justify-center min-w-[24px]`}
            style={{ width: `${widthPercent}%` }}
            title={`${MODE_LABELS[phase.mode]}: ${formatShortDuration(phase.actualDurationMs)}`}
          >
            {widthPercent > 12 && (
              <span className="text-[10px] font-medium text-white truncate px-1">
                {formatShortDuration(phase.actualDurationMs)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SessionCard({ session }: { session: Session }) {
  const endTime = session.endedAt || (session.phases.length > 0
    ? session.phases[session.phases.length - 1].completedAt
    : session.startedAt);

  const focusMinutes = Math.round(session.totalFocusMs / 60000);
  const statusLabel = session.status === 'completed' ? 'Completed' : session.status === 'ended' ? 'Ended' : 'Active';

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {formatTime(session.startedAt)} – {formatTime(endTime)}
          </span>
          <span className="text-sm font-medium text-foreground">
            {formatDurationMs(session.totalFocusMs)} focus
          </span>
        </div>
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[session.status]}`}>
          {statusLabel}
        </span>
      </div>

      <TimelineBar phases={session.phases} />

      <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-sm bg-red-500" /> Work
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-sm bg-green-500" /> Short Break
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-sm bg-blue-500" /> Long Break
        </span>
        {focusMinutes > 0 && (
          <span className="ml-auto">
            {session.phases.filter(p => p.mode === 'work').length} work · {session.phases.filter(p => p.mode !== 'work').length} break
          </span>
        )}
      </div>
    </div>
  );
}

function DayGroup({ dateKey, sessions }: { dateKey: string; sessions: Session[] }) {
  const totalFocusMin = Math.round(sessions.reduce((sum, s) => sum + s.totalFocusMs, 0) / 60000);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {getDayLabel(dateKey)}
        </h4>
        <span className="text-xs text-muted-foreground">
          {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'} &middot; {totalFocusMin}m focus
        </span>
      </div>
      <div className="space-y-3">
        {sessions.map((s) => <SessionCard key={s.id} session={s} />)}
      </div>
    </div>
  );
}

interface HistoryListProps {
  sessions: Session[];
}

export function HistoryList({ sessions }: HistoryListProps) {
  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p className="text-sm">No sessions found for this time period.</p>
      </div>
    );
  }

  const sorted = [...sessions].sort((a, b) => b.startedAt - a.startedAt);

  const groups: { key: string; sessions: Session[] }[] = [];
  const groupMap = new Map<string, Session[]>();
  for (const session of sorted) {
    const key = getDayKey(session.startedAt);
    if (!groupMap.has(key)) {
      const arr: Session[] = [];
      groupMap.set(key, arr);
      groups.push({ key, sessions: arr });
    }
    groupMap.get(key)!.push(session);
  }

  return (
    <div className="space-y-6">
      {groups.map((g) => <DayGroup key={g.key} dateKey={g.key} sessions={g.sessions} />)}
    </div>
  );
}
