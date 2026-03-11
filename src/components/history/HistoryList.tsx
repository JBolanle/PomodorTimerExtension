import type { SessionRecord, TimerMode } from '@/types';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

const MODE_LABELS: Record<TimerMode, string> = {
  work: 'Work',
  shortBreak: 'Short Break',
  longBreak: 'Long Break',
};

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

interface HistoryListProps {
  records: SessionRecord[];
  onClear: () => void;
}

export function HistoryList({ records, onClear }: HistoryListProps) {
  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p className="text-sm">No sessions recorded yet. Start a timer to begin tracking.</p>
      </div>
    );
  }

  const sorted = [...records].sort((a, b) => b.completedAt - a.completedAt);

  // Group by date
  const groups: Record<string, SessionRecord[]> = {};
  for (const record of sorted) {
    const dateKey = formatDate(record.completedAt);
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(record);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={onClear} className="text-muted-foreground">
          <Trash2 className="h-4 w-4 mr-1" />
          Clear history
        </Button>
      </div>

      {Object.entries(groups).map(([date, items]) => (
        <div key={date}>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
            {date}
          </h3>
          <div className="space-y-2">
            {items.map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      record.mode === 'work'
                        ? 'bg-primary'
                        : record.mode === 'shortBreak'
                          ? 'bg-green-500'
                          : 'bg-blue-500'
                    }`}
                  />
                  <span className="text-sm font-medium text-foreground">
                    {MODE_LABELS[record.mode]}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {Math.round(record.actualDurationMs / 60000)} min
                  </span>
                  {record.completionType !== 'completed' && (
                    <span className="text-xs text-muted-foreground/60 italic">
                      {record.completionType}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">{timeAgo(record.completedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
