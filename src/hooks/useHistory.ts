import { useState, useEffect, useCallback, useMemo } from 'react';
import { getStorage, setStorage, onStorageChanged } from '@/lib/storage';
import type { SessionRecord, DateFilterOption } from '@/types';

const STORAGE_KEY = 'sessionHistory';

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
      return null;
    case 'custom':
      return null;
  }
}

export function useHistory() {
  const [records, setRecords] = useState<SessionRecord[]>([]);
  const [filter, setFilter] = useState<DateFilterOption>('all');
  const [customRange, setCustomRange] = useState<{ start: Date; end: Date } | null>(null);

  useEffect(() => {
    getStorage<SessionRecord[]>(STORAGE_KEY, []).then(setRecords);
    return onStorageChanged(STORAGE_KEY, (val) => setRecords(val as SessionRecord[]));
  }, []);

  const clearHistory = useCallback(async () => {
    await setStorage(STORAGE_KEY, []);
    setRecords([]);
  }, []);

  const filteredRecords = useMemo(() => {
    if (filter === 'custom' && customRange) {
      const start = customRange.start.getTime();
      const end = customRange.end.getTime();
      return records.filter((r) => r.completedAt >= start && r.completedAt <= end);
    }
    const range = getDateRange(filter);
    if (!range) return records;
    return records.filter((r) => r.completedAt >= range.start && r.completedAt <= range.end);
  }, [records, filter, customRange]);

  const handleFilterChange = useCallback((newFilter: DateFilterOption, range?: { start: Date; end: Date }) => {
    setFilter(newFilter);
    if (newFilter === 'custom' && range) {
      setCustomRange(range);
    }
  }, []);

  return { records, filteredRecords, clearHistory, filter, setFilter: handleFilterChange };
}
