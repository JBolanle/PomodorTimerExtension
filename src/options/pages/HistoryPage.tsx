import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { CollapsibleSection } from '@/components/history/CollapsibleSection';
import { StatsOverview } from '@/components/history/StatsOverview';
import { HistoryList } from '@/components/history/HistoryList';
import { DateFilter } from '@/components/history/DateFilter';
import { ExportDropdown } from '@/components/history/ExportDropdown';
import { ClearHistoryModal } from '@/components/history/ClearHistoryModal';
import { useHistory } from '@/hooks/useHistory';
import { usePresets } from '@/hooks/usePresets';
import { Button } from '@/components/ui/button';

export function HistoryPage() {
  const { records, filteredRecords, clearHistory, filter, setFilter } = useHistory();
  const { presets } = usePresets();
  const [showClearModal, setShowClearModal] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <PageHeader title="History & Stats" description="View your completed sessions and productivity stats." />
        <ExportDropdown sessions={records} presets={presets} disabled={records.length === 0} />
      </div>

      <CollapsibleSection title="Statistics" badge={`${filteredRecords.length} sessions`}>
        <StatsOverview filteredSessions={filteredRecords} />
      </CollapsibleSection>

      <CollapsibleSection title="Session History">
        <div className="mb-4 flex items-center justify-between">
          <DateFilter value={filter} onChange={setFilter} />
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            disabled={records.length === 0}
            onClick={() => setShowClearModal(true)}
          >
            <Trash2 className="mr-1 h-4 w-4" />
            Clear
          </Button>
        </div>
        <HistoryList sessions={filteredRecords} />
      </CollapsibleSection>

      {showClearModal && (
        <ClearHistoryModal
          sessionCount={records.length}
          onConfirm={() => { clearHistory(); setShowClearModal(false); }}
          onCancel={() => setShowClearModal(false)}
        />
      )}
    </div>
  );
}
