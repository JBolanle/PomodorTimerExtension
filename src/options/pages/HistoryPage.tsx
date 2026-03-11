import { PageHeader } from '@/components/layout/PageHeader';
import { StatsOverview } from '@/components/history/StatsOverview';
import { HistoryList } from '@/components/history/HistoryList';
import { useHistory } from '@/hooks/useHistory';

export function HistoryPage() {
  const { records, clearHistory, stats } = useHistory();

  return (
    <div className="space-y-8">
      <PageHeader title="History & Stats" description="View your completed sessions and productivity stats." />
      <StatsOverview stats={stats} />
      <HistoryList records={records} onClear={clearHistory} />
    </div>
  );
}
