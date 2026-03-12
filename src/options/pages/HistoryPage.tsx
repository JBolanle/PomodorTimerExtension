import { useState, useMemo } from 'react';
import { Trash2, Upload } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { CollapsibleSection } from '@/components/history/CollapsibleSection';
import { StatsOverview } from '@/components/history/StatsOverview';
import { InsightsContent } from '@/components/history/InsightsContent';
import { HistoryList } from '@/components/history/HistoryList';
import { DateFilter } from '@/components/history/DateFilter';
import { ExportDropdown } from '@/components/history/ExportDropdown';
import { ImportModal } from '@/components/history/ImportModal';
import { TagFilter } from '@/components/history/TagFilter';
import { ClearHistoryModal } from '@/components/history/ClearHistoryModal';
import { useHistory } from '@/hooks/useHistory';
import { usePresets } from '@/hooks/usePresets';
import { Button } from '@/components/ui/button';
import { useAnnounce } from '@/components/Announcer';

export function HistoryPage() {
  const { sessions, filteredSessions, clearHistory, filter, setFilter } = useHistory();
  const { presets } = usePresets();
  const announce = useAnnounce();
  const [showClearModal, setShowClearModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const filteredByTags = useMemo(() => {
    if (selectedTags.length === 0) return filteredSessions;
    return filteredSessions.filter((s) => s.tags?.some((t) => selectedTags.includes(t)));
  }, [filteredSessions, selectedTags]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <PageHeader title="History & Stats" description="View your completed sessions and productivity stats." />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowImportModal(true)}>
            <Upload className="mr-1 h-4 w-4" aria-hidden="true" />
            Import
          </Button>
          <ExportDropdown sessions={sessions} presets={presets} disabled={sessions.length === 0} />
        </div>
      </div>

      <CollapsibleSection title="Statistics" badge={`${filteredSessions.length} sessions`}>
        <StatsOverview filteredSessions={filteredSessions} />
      </CollapsibleSection>

      <CollapsibleSection title="Insights" defaultOpen={true}>
        <InsightsContent sessions={sessions} />
      </CollapsibleSection>

      <CollapsibleSection title="Session History">
        <div className="mb-4 flex items-center justify-between">
          <DateFilter value={filter} onChange={setFilter} />
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            disabled={sessions.length === 0}
            onClick={() => setShowClearModal(true)}
          >
            <Trash2 className="mr-1 h-4 w-4" aria-hidden="true" />
            Clear
          </Button>
        </div>
        <TagFilter sessions={sessions} selectedTags={selectedTags} onChange={setSelectedTags} />
        <HistoryList sessions={filteredByTags} />
      </CollapsibleSection>

      {showClearModal && (
        <ClearHistoryModal
          sessionCount={sessions.length}
          onConfirm={() => { clearHistory(); setShowClearModal(false); announce('History cleared'); }}
          onCancel={() => setShowClearModal(false)}
        />
      )}

      {showImportModal && (
        <ImportModal onClose={() => setShowImportModal(false)} />
      )}
    </div>
  );
}
