import type { SessionRecord, TimerMode } from '@/types';
import { Check, SkipForward, Square } from 'lucide-react';

const MODE_LABELS: Record<TimerMode, string> = {
  work: 'Work',
  shortBreak: 'Short Break',
  longBreak: 'Long Break',
};

const MODE_COLORS: Record<TimerMode, string> = {
  work: 'bg-primary/10 text-primary',
  shortBreak: 'bg-green-500/10 text-green-600',
  longBreak: 'bg-blue-500/10 text-blue-600',
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

function CompletionIcon({ type }: { type: string }) {
  switch (type) {
    case 'completed':
      return <Check className="h-4 w-4 text-green-500" />;
    case 'skipped':
      return <SkipForward className="h-4 w-4 text-muted-foreground" />;
    default:
      return <Square className="h-4 w-4 text-muted-foreground" />;
  }
}

function SessionItem({ session }: { session: SessionRecord }) {
  const plannedMin = Math.round(session.plannedDurationMs / 60000);
  const actualMin = Math.round(session.actualDurationMs / 60000);
  const durationText = plannedMin === actualMin ? `${actualMin}m` : `${actualMin}/${plannedMin}m`;

  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-3">
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${MODE_COLORS[session.mode]}`}>
          {MODE_LABELS[session.mode]}
        </span>
        <span className="text-sm text-muted-foreground">{formatTime(session.completedAt)}</span>
        <span className="text-sm font-medium text-foreground">{durationText}</span>
      </div>
      <CompletionIcon type={session.completionType} />
    </div>
  );
}

function DayGroup({ dateKey, sessions }: { dateKey: string; sessions: SessionRecord[] }) {
  const workSessions = sessions.filter((s) => s.mode === 'work');
  const totalFocusMin = Math.round(workSessions.reduce((sum, s) => sum + s.actualDurationMs, 0) / 60000);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {getDayLabel(dateKey)}
        </h4>
        <span className="text-xs text-muted-foreground">
          {workSessions.length} work {workSessions.length === 1 ? 'session' : 'sessions'} &middot; {totalFocusMin}m focus
        </span>
      </div>
      <div className="space-y-2">
        {sessions.map((s) => <SessionItem key={s.id} session={s} />)}
      </div>
    </div>
  );
}

interface HistoryListProps {
  sessions: SessionRecord[];
}

export function HistoryList({ sessions }: HistoryListProps) {
  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p className="text-sm">No sessions found for this time period.</p>
      </div>
    );
  }

  const sorted = [...sessions].sort((a, b) => b.completedAt - a.completedAt);

  const groups: { key: string; sessions: SessionRecord[] }[] = [];
  const groupMap = new Map<string, SessionRecord[]>();
  for (const record of sorted) {
    const key = getDayKey(record.completedAt);
    if (!groupMap.has(key)) {
      const arr: SessionRecord[] = [];
      groupMap.set(key, arr);
      groups.push({ key, sessions: arr });
    }
    groupMap.get(key)!.push(record);
  }

  return (
    <div className="space-y-6">
      {groups.map((g) => <DayGroup key={g.key} dateKey={g.key} sessions={g.sessions} />)}
    </div>
  );
}
