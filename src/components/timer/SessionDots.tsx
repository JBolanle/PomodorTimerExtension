import { cn } from '@/lib/utils';

interface SessionDotsProps {
  completedSessions: number;
  total: number;
}

export function SessionDots({ completedSessions, total }: SessionDotsProps) {
  const filledCount = completedSessions % total;
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            'h-2.5 w-2.5 rounded-full transition-all',
            i < filledCount
              ? 'bg-primary session-dot-active'
              : 'bg-muted-foreground/25'
          )}
        />
      ))}
    </div>
  );
}
