import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ClearHistoryModalProps {
  sessionCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ClearHistoryModal({ sessionCount, onConfirm, onCancel }: ClearHistoryModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative z-50 w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">Clear Session History</h3>
            <p className="text-sm text-muted-foreground">
              This will permanently delete {sessionCount} recorded {sessionCount === 1 ? 'session' : 'sessions'} and reset all statistics.
            </p>
            <p className="text-sm font-medium text-destructive">This action cannot be undone.</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm}>Clear History</Button>
        </div>
      </div>
    </div>
  );
}
