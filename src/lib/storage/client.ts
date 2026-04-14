// React-side entry point to the typed storage layer. Re-exports the
// same `StorageAdapter` repos the background uses, plus a small React
// hook for subscribing a component to a single key.
//
// Both contexts share the repo instances at module level; the class
// itself holds no mutable state, so concurrent use from popup +
// options + SW (in Phase 3) is fine.

import { useEffect, useState } from 'react';

import type { StorageAdapter } from '@/background/storage';

export {
  StorageAdapter,
  currentSessionRepo,
  focusModeRepo,
  presetsRepo,
  sessionHistoryRepo,
  sessionsRepo,
  settingsRepo,
  tagHistoryRepo,
  themeRepo,
} from '@/background/storage';

import type { StorageKey, StorageSchema } from '@/shared/schema';

/**
 * Subscribe a component to a storage repo. Returns the latest value
 * (initially the default until the first `get()` resolves). Callers
 * that need to write still use the repo's `set()` directly.
 */
export function useStorageValue<K extends StorageKey>(
  repo: StorageAdapter<K>,
): StorageSchema[K] | undefined {
  const [value, setValue] = useState<StorageSchema[K] | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    repo.get().then((v) => {
      if (!cancelled) setValue(v);
    });
    const unsubscribe = repo.onChange((v) => {
      if (!cancelled) setValue(v);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [repo]);

  return value;
}
