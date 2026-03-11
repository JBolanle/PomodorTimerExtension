import { PageHeader } from '@/components/layout/PageHeader';
import { StatsOverview } from '@/components/history/StatsOverview';
import { useHistory } from '@/hooks/useHistory';

export function StatsPage() {
  const { stats } = useHistory();

  return (
    <div>
      <PageHeader title="Stats" description="Track your productivity over time." />
      <StatsOverview stats={stats} />
    </div>
  );
}
