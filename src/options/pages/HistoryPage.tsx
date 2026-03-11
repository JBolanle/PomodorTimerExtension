import { PageHeader } from '@/components/layout/PageHeader';
import { HistoryList } from '@/components/history/HistoryList';
import { useHistory } from '@/hooks/useHistory';

export function HistoryPage() {
  const { records, clearHistory } = useHistory();

  return (
    <div>
      <PageHeader title="History" description="View your completed sessions." />
      <HistoryList records={records} onClear={clearHistory} />
    </div>
  );
}
