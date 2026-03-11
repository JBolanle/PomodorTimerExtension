import { PageHeader } from '@/components/layout/PageHeader';
import { BarChart3 } from 'lucide-react';

export function StatsPage() {
  return (
    <div>
      <PageHeader title="Stats" description="Track your productivity over time." />
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <BarChart3 className="h-12 w-12 mb-4 opacity-30" />
        <p className="text-sm">Statistics coming soon.</p>
      </div>
    </div>
  );
}
