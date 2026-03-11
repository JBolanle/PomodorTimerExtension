import { PageHeader } from '@/components/layout/PageHeader';
import { History } from 'lucide-react';

export function HistoryPage() {
  return (
    <div>
      <PageHeader title="History" description="View your completed sessions." />
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <History className="h-12 w-12 mb-4 opacity-30" />
        <p className="text-sm">Session history coming soon.</p>
      </div>
    </div>
  );
}
