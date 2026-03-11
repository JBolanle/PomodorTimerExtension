import { useState, useEffect, useCallback, useMemo } from 'react';
import { getStorage, setStorage, onStorageChanged } from '@/lib/storage';
import type { SessionRecord } from '@/types';

const STORAGE_KEY = 'sessionHistory';

function startOfToday(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

function sevenDaysAgo(): number {
  return startOfToday() - 7 * 24 * 60 * 60 * 1000;
}

export function useHistory() {
  const [records, setRecords] = useState<SessionRecord[]>([]);

  useEffect(() => {
    getStorage<SessionRecord[]>(STORAGE_KEY, []).then(setRecords);
    return onStorageChanged(STORAGE_KEY, (val) => setRecords(val as SessionRecord[]));
  }, []);

  const addRecord = useCallback(async (record: Omit<SessionRecord, 'id'>) => {
    const newRecord: SessionRecord = {
      ...record,
      id: crypto.randomUUID(),
    };
    const current = await getStorage<SessionRecord[]>(STORAGE_KEY, []);
    const updated = [...current, newRecord];
    await setStorage(STORAGE_KEY, updated);
    setRecords(updated);
  }, []);

  const clearHistory = useCallback(async () => {
    await setStorage(STORAGE_KEY, []);
    setRecords([]);
  }, []);

  const stats = useMemo(() => {
    const today = startOfToday();
    const weekStart = sevenDaysAgo();

    const todayRecords = records.filter((r) => r.completedAt >= today);
    const weekRecords = records.filter((r) => r.completedAt >= weekStart);

    return {
      todaySessions: todayRecords.length,
      weekSessions: weekRecords.length,
      totalSessions: records.length,
      todayMinutes: todayRecords.reduce((sum, r) => sum + r.duration, 0),
      weekMinutes: weekRecords.reduce((sum, r) => sum + r.duration, 0),
      totalMinutes: records.reduce((sum, r) => sum + r.duration, 0),
    };
  }, [records]);

  return { records, addRecord, clearHistory, stats };
}
