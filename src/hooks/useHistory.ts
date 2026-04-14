import { useCallback, useMemo, useState } from 'react';

import { sessionStore, useSessions } from '@/lib/sessions/client';
import type { DateFilterOption } from '@/shared/types';

function startOfToday(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

function getDateRange(filter: DateFilterOption): { start: number; end: number } | null {
  const now = Date.now();
  const today = startOfToday();
  switch (filter) {
    case 'today':
      return { start: today, end: now };
    case 'week':
      return { start: today - 7 * 24 * 60 * 60 * 1000, end: now };
    case 'month':
      return { start: today - 30 * 24 * 60 * 60 * 1000, end: now };
    case 'all':
    case 'custom':
      return null;
  }
}

export function useHistory() {
  const [filter, setFilter] = useState<DateFilterOption>('all');
  const [customRange, setCustomRange] = useState<{ start: Date; end: Date } | null>(null);

  // Load everything and filter in-memory. The filter surface (today /
  // week / month / custom / all) is small enough that index-scoped
  // queries would complicate the reactive cache without meaningful gain.
  const { sessions, refresh } = useSessions();

  const clearHistory = useCallback(async () => {
    await sessionStore.clear();
    refresh();
  }, [refresh]);

  const filteredSessions = useMemo(() => {
    if (filter === 'custom' && customRange) {
      const start = customRange.start.getTime();
      const end = customRange.end.getTime();
      return sessions.filter((s) => s.startedAt >= start && s.startedAt <= end);
    }
    const range = getDateRange(filter);
    if (!range) return sessions;
    return sessions.filter((s) => s.startedAt >= range.start && s.startedAt <= range.end);
  }, [sessions, filter, customRange]);

  const handleFilterChange = useCallback(
    (newFilter: DateFilterOption, range?: { start: Date; end: Date }) => {
      setFilter(newFilter);
      if (newFilter === 'custom' && range) {
        setCustomRange(range);
      }
    },
    [],
  );

  return { sessions, filteredSessions, clearHistory, filter, setFilter: handleFilterChange };
}
