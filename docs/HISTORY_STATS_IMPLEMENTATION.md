# Session History & Stats UI Implementation

## Overview

Enhance the existing combined History & Stats page with:
- Collapsible sections for Stats and History
- Date filtering (Today / This Week / This Month / All Time / Custom)
- Session list grouped by day
- Summary statistics
- Clear history with confirmation warning
- Export dropdown (JSON + CSV)

---

## Data Structure Reference

Current session record format (from `chrome.storage.local`):

```typescript
interface SessionRecord {
  id: string;
  mode: 'work' | 'shortBreak' | 'longBreak';
  plannedDurationMs: number;
  actualDurationMs: number;
  completionType: 'completed' | 'skipped' | 'ended';
  completedAt: number; // timestamp
}
```

Storage key: `sessionHistory` (array of SessionRecord)

---

## Component Structure

```
HistoryStatsPage
├── Header (title + Export dropdown)
├── CollapsibleSection (Stats)
│   └── StatsContent
│       ├── StatCard (Total Focus Time)
│       ├── StatCard (Sessions Completed)
│       ├── StatCard (Average Session)
│       └── StatCard (Completion Rate)
├── CollapsibleSection (History)
│   ├── FilterBar
│   │   ├── DateFilter (Today/Week/Month/All/Custom)
│   │   └── ClearHistoryButton
│   └── SessionList
│       └── DayGroup (repeated)
│           ├── DayHeader (date + day total)
│           └── SessionItem (repeated)
└── ClearHistoryModal (conditional)
```

---

## 1. Collapsible Section Component

Create a reusable collapsible section component:

```tsx
// components/CollapsibleSection.tsx
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: string; // optional badge like "5 sessions"
}

export function CollapsibleSection({ 
  title, 
  defaultOpen = true, 
  children,
  badge 
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
          <span className="font-medium">{title}</span>
          {badge && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {badge}
            </span>
          )}
        </div>
      </button>
      {isOpen && (
        <div className="p-4 border-t border-border">
          {children}
        </div>
      )}
    </div>
  );
}
```

---

## 2. Stats Section

### Stats Content Component

```tsx
// components/StatsContent.tsx
import { useMemo } from 'react';
import { SessionRecord } from '../types';

interface StatsContentProps {
  sessions: SessionRecord[];
  dateRange: { start: Date; end: Date } | null;
}

export function StatsContent({ sessions, dateRange }: StatsContentProps) {
  const stats = useMemo(() => {
    // Filter sessions by date range if specified
    let filtered = sessions;
    if (dateRange) {
      filtered = sessions.filter(s => {
        const date = new Date(s.completedAt);
        return date >= dateRange.start && date <= dateRange.end;
      });
    }

    const workSessions = filtered.filter(s => s.mode === 'work');
    const completedWork = workSessions.filter(s => s.completionType === 'completed');
    
    const totalFocusMs = workSessions.reduce((sum, s) => sum + s.actualDurationMs, 0);
    const totalFocusMinutes = Math.round(totalFocusMs / 60000);
    
    const avgSessionMs = workSessions.length > 0 
      ? totalFocusMs / workSessions.length 
      : 0;
    const avgSessionMinutes = Math.round(avgSessionMs / 60000);
    
    const completionRate = workSessions.length > 0
      ? Math.round((completedWork.length / workSessions.length) * 100)
      : 0;

    return {
      totalFocusMinutes,
      totalSessions: workSessions.length,
      completedSessions: completedWork.length,
      avgSessionMinutes,
      completionRate,
      totalBreaks: filtered.filter(s => s.mode !== 'work').length,
    };
  }, [sessions, dateRange]);

  // Format hours and minutes
  const formatFocusTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard
        label="Total Focus Time"
        value={formatFocusTime(stats.totalFocusMinutes)}
        sublabel={`${stats.totalSessions} work sessions`}
        icon="⏱️"
      />
      <StatCard
        label="Completed"
        value={stats.completedSessions.toString()}
        sublabel={`${stats.completionRate}% completion rate`}
        icon="✅"
      />
      <StatCard
        label="Average Session"
        value={`${stats.avgSessionMinutes}m`}
        sublabel="per work session"
        icon="📊"
      />
      <StatCard
        label="Breaks Taken"
        value={stats.totalBreaks.toString()}
        sublabel="short + long breaks"
        icon="☕"
      />
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  sublabel: string;
  icon: string;
}

function StatCard({ label, value, sublabel, icon }: StatCardProps) {
  return (
    <div className="bg-muted/30 rounded-lg p-4 flex flex-col">
      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{sublabel}</div>
    </div>
  );
}
```

---

## 3. Date Filter Component

```tsx
// components/DateFilter.tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Calendar, ChevronDown } from 'lucide-react';

type FilterOption = 'today' | 'week' | 'month' | 'all' | 'custom';

interface DateFilterProps {
  value: FilterOption;
  onChange: (filter: FilterOption, range?: { start: Date; end: Date }) => void;
  customRange?: { start: Date; end: Date };
}

const FILTER_LABELS: Record<FilterOption, string> = {
  today: 'Today',
  week: 'This Week',
  month: 'This Month',
  all: 'All Time',
  custom: 'Custom Range',
};

export function DateFilter({ value, onChange, customRange }: DateFilterProps) {
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  const handleSelect = (option: FilterOption) => {
    if (option === 'custom') {
      setShowCustomPicker(true);
      return;
    }
    
    const range = getDateRange(option);
    onChange(option, range);
  };

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Calendar className="w-4 h-4" />
            {FILTER_LABELS[value]}
            <ChevronDown className="w-3 h-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => handleSelect('today')}>
            Today
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleSelect('week')}>
            This Week
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleSelect('month')}>
            This Month
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleSelect('all')}>
            All Time
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleSelect('custom')}>
            Custom Range...
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Custom date picker modal - implement with your preferred date picker */}
      {showCustomPicker && (
        <CustomDateRangePicker
          initialRange={customRange}
          onConfirm={(range) => {
            onChange('custom', range);
            setShowCustomPicker(false);
          }}
          onCancel={() => setShowCustomPicker(false)}
        />
      )}
    </div>
  );
}

// Helper to calculate date ranges
function getDateRange(option: FilterOption): { start: Date; end: Date } | undefined {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (option) {
    case 'today':
      return {
        start: today,
        end: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1),
      };
    case 'week': {
      const dayOfWeek = today.getDay();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - dayOfWeek);
      return {
        start: startOfWeek,
        end: now,
      };
    }
    case 'month': {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      return {
        start: startOfMonth,
        end: now,
      };
    }
    case 'all':
      return undefined; // No filter
    default:
      return undefined;
  }
}

// Simple custom date range picker (you can enhance this)
function CustomDateRangePicker({ 
  initialRange, 
  onConfirm, 
  onCancel 
}: {
  initialRange?: { start: Date; end: Date };
  onConfirm: (range: { start: Date; end: Date }) => void;
  onCancel: () => void;
}) {
  const [start, setStart] = useState(
    initialRange?.start.toISOString().split('T')[0] || ''
  );
  const [end, setEnd] = useState(
    initialRange?.end.toISOString().split('T')[0] || ''
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border border-border rounded-lg p-6 w-80">
        <h3 className="font-medium mb-4">Select Date Range</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-muted-foreground">Start Date</label>
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-border rounded bg-background"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">End Date</label>
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-border rounded bg-background"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (start && end) {
                onConfirm({
                  start: new Date(start),
                  end: new Date(end + 'T23:59:59'),
                });
              }
            }}
            className="flex-1"
            disabled={!start || !end}
          >
            Apply
          </Button>
        </div>
      </div>
    </div>
  );
}
```

---

## 4. Session List Component (Grouped by Day)

```tsx
// components/SessionList.tsx
import { useMemo } from 'react';
import { SessionRecord } from '../types';

interface SessionListProps {
  sessions: SessionRecord[];
}

const MODE_LABELS = {
  work: 'Work',
  shortBreak: 'Short Break',
  longBreak: 'Long Break',
};

const MODE_COLORS = {
  work: 'bg-red-500/20 text-red-400',
  shortBreak: 'bg-green-500/20 text-green-400',
  longBreak: 'bg-blue-500/20 text-blue-400',
};

const COMPLETION_ICONS = {
  completed: '✓',
  skipped: '⏭',
  ended: '⏹',
};

export function SessionList({ sessions }: SessionListProps) {
  // Group sessions by day
  const groupedSessions = useMemo(() => {
    const groups: Map<string, SessionRecord[]> = new Map();
    
    // Sort by most recent first
    const sorted = [...sessions].sort((a, b) => b.completedAt - a.completedAt);
    
    for (const session of sorted) {
      const date = new Date(session.completedAt);
      const dayKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
      
      if (!groups.has(dayKey)) {
        groups.set(dayKey, []);
      }
      groups.get(dayKey)!.push(session);
    }
    
    return groups;
  }, [sessions]);

  if (sessions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg mb-2">No sessions yet</p>
        <p className="text-sm">Complete a Pomodoro to see your history here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Array.from(groupedSessions.entries()).map(([dayKey, daySessions]) => (
        <DayGroup key={dayKey} dateKey={dayKey} sessions={daySessions} />
      ))}
    </div>
  );
}

interface DayGroupProps {
  dateKey: string;
  sessions: SessionRecord[];
}

function DayGroup({ dateKey, sessions }: DayGroupProps) {
  const date = new Date(dateKey);
  const isToday = dateKey === new Date().toISOString().split('T')[0];
  const isYesterday = dateKey === new Date(Date.now() - 86400000).toISOString().split('T')[0];

  // Calculate day totals
  const workSessions = sessions.filter(s => s.mode === 'work');
  const totalFocusMs = workSessions.reduce((sum, s) => sum + s.actualDurationMs, 0);
  const totalFocusMinutes = Math.round(totalFocusMs / 60000);

  const formatDate = () => {
    if (isToday) return 'Today';
    if (isYesterday) return 'Yesterday';
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-sm">{formatDate()}</h3>
        <span className="text-xs text-muted-foreground">
          {workSessions.length} session{workSessions.length !== 1 ? 's' : ''} · {totalFocusMinutes}m focus
        </span>
      </div>
      <div className="space-y-2">
        {sessions.map((session) => (
          <SessionItem key={session.id} session={session} />
        ))}
      </div>
    </div>
  );
}

interface SessionItemProps {
  session: SessionRecord;
}

function SessionItem({ session }: SessionItemProps) {
  const time = new Date(session.completedAt).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  const actualMinutes = Math.round(session.actualDurationMs / 60000);
  const plannedMinutes = Math.round(session.plannedDurationMs / 60000);
  const wasShortened = actualMinutes < plannedMinutes;

  return (
    <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
      <div className="flex items-center gap-3">
        <span className={`text-xs px-2 py-1 rounded ${MODE_COLORS[session.mode]}`}>
          {MODE_LABELS[session.mode]}
        </span>
        <span className="text-sm text-muted-foreground">{time}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm">
          {actualMinutes}m
          {wasShortened && (
            <span className="text-muted-foreground text-xs ml-1">
              / {plannedMinutes}m
            </span>
          )}
        </span>
        <span className="text-xs" title={session.completionType}>
          {COMPLETION_ICONS[session.completionType]}
        </span>
      </div>
    </div>
  );
}
```

---

## 5. Clear History Modal

```tsx
// components/ClearHistoryModal.tsx
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface ClearHistoryModalProps {
  sessionCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ClearHistoryModal({ 
  sessionCount, 
  onConfirm, 
  onCancel 
}: ClearHistoryModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border border-border rounded-lg p-6 w-96 max-w-[90vw]">
        <div className="flex items-center gap-3 text-destructive mb-4">
          <AlertTriangle className="w-6 h-6" />
          <h3 className="font-semibold text-lg">Clear All History?</h3>
        </div>
        
        <div className="space-y-3 text-sm text-muted-foreground mb-6">
          <p>
            This will permanently delete <strong className="text-foreground">{sessionCount} sessions</strong> from your history.
          </p>
          <p className="p-3 bg-destructive/10 border border-destructive/20 rounded text-destructive">
            ⚠️ This will also reset all your statistics. This action cannot be undone.
          </p>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} className="flex-1">
            Clear History
          </Button>
        </div>
      </div>
    </div>
  );
}
```

---

## 6. Export Functionality

```tsx
// utils/export.ts

interface SessionRecord {
  id: string;
  mode: 'work' | 'shortBreak' | 'longBreak';
  plannedDurationMs: number;
  actualDurationMs: number;
  completionType: 'completed' | 'skipped' | 'ended';
  completedAt: number;
}

interface Preset {
  id: string;
  name: string;
  workMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  sessionsBeforeLongBreak: number;
}

// --- JSON Export ---

export function exportToJSON(sessions: SessionRecord[], presets: Preset[]): void {
  const data = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    app: 'Pomodoro Timer',
    sessions: sessions,
    presets: presets,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `pomodoro-export-${formatDateForFilename()}.json`);
}

// --- CSV Export ---

export function exportToCSV(sessions: SessionRecord[]): void {
  const headers = [
    'id',
    'mode',
    'planned_duration_min',
    'actual_duration_min',
    'completion_type',
    'completed_at',
  ];

  const rows = sessions.map(session => [
    session.id,
    session.mode,
    Math.round(session.plannedDurationMs / 60000),
    Math.round(session.actualDurationMs / 60000),
    session.completionType,
    new Date(session.completedAt).toISOString(),
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  downloadBlob(blob, `pomodoro-export-${formatDateForFilename()}.csv`);
}

// --- Helpers ---

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatDateForFilename(): string {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}
```

### Export Dropdown Component

```tsx
// components/ExportDropdown.tsx
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, ChevronDown } from 'lucide-react';
import { exportToJSON, exportToCSV } from '../utils/export';

interface ExportDropdownProps {
  sessions: SessionRecord[];
  presets: Preset[];
  disabled?: boolean;
}

export function ExportDropdown({ sessions, presets, disabled }: ExportDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} className="gap-2">
          <Download className="w-4 h-4" />
          Export
          <ChevronDown className="w-3 h-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => exportToJSON(sessions, presets)}>
          <span className="mr-2">📄</span>
          JSON (full backup)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportToCSV(sessions)}>
          <span className="mr-2">📊</span>
          CSV (spreadsheet)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

---

## 7. Main Page Assembly

```tsx
// pages/HistoryStatsPage.tsx
import { useState, useEffect, useMemo } from 'react';
import { CollapsibleSection } from '../components/CollapsibleSection';
import { StatsContent } from '../components/StatsContent';
import { SessionList } from '../components/SessionList';
import { DateFilter } from '../components/DateFilter';
import { ExportDropdown } from '../components/ExportDropdown';
import { ClearHistoryModal } from '../components/ClearHistoryModal';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

type FilterOption = 'today' | 'week' | 'month' | 'all' | 'custom';

export function HistoryStatsPage() {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [filter, setFilter] = useState<FilterOption>('all');
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date } | null>(null);
  const [showClearModal, setShowClearModal] = useState(false);

  // Load data from storage
  useEffect(() => {
    async function loadData() {
      const { sessionHistory, presets } = await chrome.storage.local.get([
        'sessionHistory',
        'presets',
      ]);
      setSessions(sessionHistory || []);
      setPresets(presets || []);
    }
    loadData();

    // Listen for changes
    const listener = (changes: any) => {
      if (changes.sessionHistory) {
        setSessions(changes.sessionHistory.newValue || []);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  // Filter sessions by date range
  const filteredSessions = useMemo(() => {
    if (!dateRange) return sessions;
    return sessions.filter(s => {
      const date = new Date(s.completedAt);
      return date >= dateRange.start && date <= dateRange.end;
    });
  }, [sessions, dateRange]);

  // Handle filter change
  const handleFilterChange = (
    newFilter: FilterOption,
    range?: { start: Date; end: Date }
  ) => {
    setFilter(newFilter);
    setDateRange(range || null);
  };

  // Handle clear history
  const handleClearHistory = async () => {
    await chrome.storage.local.set({ sessionHistory: [] });
    setSessions([]);
    setShowClearModal(false);
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">History & Stats</h1>
        <ExportDropdown
          sessions={sessions}
          presets={presets}
          disabled={sessions.length === 0}
        />
      </div>

      {/* Stats Section */}
      <CollapsibleSection 
        title="Statistics" 
        defaultOpen={true}
        badge={filter !== 'all' ? `Filtered: ${filter}` : undefined}
      >
        <StatsContent sessions={filteredSessions} dateRange={dateRange} />
      </CollapsibleSection>

      {/* History Section */}
      <CollapsibleSection
        title="Session History"
        defaultOpen={true}
        badge={`${filteredSessions.length} sessions`}
      >
        {/* Filter Bar */}
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-border">
          <DateFilter
            value={filter}
            onChange={handleFilterChange}
            customRange={filter === 'custom' ? dateRange : undefined}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowClearModal(true)}
            disabled={sessions.length === 0}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear History
          </Button>
        </div>

        {/* Session List */}
        <SessionList sessions={filteredSessions} />
      </CollapsibleSection>

      {/* Clear History Modal */}
      {showClearModal && (
        <ClearHistoryModal
          sessionCount={sessions.length}
          onConfirm={handleClearHistory}
          onCancel={() => setShowClearModal(false)}
        />
      )}
    </div>
  );
}
```

---

## 8. Type Definitions

Add to your types file if not already present:

```typescript
// types/index.ts

export interface SessionRecord {
  id: string;
  mode: 'work' | 'shortBreak' | 'longBreak';
  plannedDurationMs: number;
  actualDurationMs: number;
  completionType: 'completed' | 'skipped' | 'ended';
  completedAt: number;
}

export interface Preset {
  id: string;
  name: string;
  workMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  sessionsBeforeLongBreak: number;
}

export type DateFilterOption = 'today' | 'week' | 'month' | 'all' | 'custom';
```

---

## Summary Checklist

| Component | Purpose |
|-----------|---------|
| `CollapsibleSection` | Reusable expandable/collapsible container |
| `StatsContent` | Displays 4 stat cards with totals/averages |
| `DateFilter` | Dropdown for Today/Week/Month/All/Custom |
| `SessionList` | Sessions grouped by day with headers |
| `DayGroup` | Day header + list of sessions for that day |
| `SessionItem` | Single session row with mode, time, duration |
| `ClearHistoryModal` | Confirmation dialog with warning |
| `ExportDropdown` | JSON + CSV export options |
| `exportToJSON` | Generates JSON blob with sessions + presets |
| `exportToCSV` | Generates CSV blob with flattened session data |
| `HistoryStatsPage` | Main page assembling all components |

---

## Testing Checklist

1. ☐ Stats update when date filter changes
2. ☐ Sessions group correctly by day
3. ☐ "Today" and "Yesterday" labels work
4. ☐ Custom date range picker works
5. ☐ Export JSON downloads valid file with presets
6. ☐ Export CSV opens correctly in Excel/Sheets
7. ☐ Clear history shows warning modal
8. ☐ Clearing history resets stats to zero
9. ☐ Empty state shows when no sessions
10. ☐ Collapsible sections remember state (optional)
