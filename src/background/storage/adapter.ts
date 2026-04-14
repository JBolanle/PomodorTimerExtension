// Typed wrapper around a single `chrome.storage.local` key. All reads,
// writes, and change subscriptions for a key go through this adapter;
// no code outside `src/background/storage/` or `src/lib/storage/` is
// permitted to touch `chrome.storage.local` directly (ADR-005).
//
// Each adapter is parameterized by a key from `StorageSchema`, so the
// value type is enforced structurally: `new StorageAdapter('theme',
// 'arctic')` yields an adapter whose get/set traffic is `Theme`.

import type { StorageKey, StorageSchema } from '@/shared/schema';

export class StorageAdapter<K extends StorageKey> {
  constructor(
    public readonly key: K,
    private readonly defaultValue: StorageSchema[K],
  ) {}

  async get(): Promise<StorageSchema[K]> {
    const result = await chrome.storage.local.get(this.key);
    const stored = result[this.key];
    return stored === undefined ? this.defaultValue : (stored as StorageSchema[K]);
  }

  async set(value: StorageSchema[K]): Promise<void> {
    await chrome.storage.local.set({ [this.key]: value });
  }

  async remove(): Promise<void> {
    await chrome.storage.local.remove(this.key);
  }

  /**
   * Subscribe to changes for this key. The callback receives the new
   * value (or `undefined` on removal). Returns an unsubscribe function.
   */
  onChange(callback: (newValue: StorageSchema[K] | undefined) => void): () => void {
    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: chrome.storage.AreaName,
    ) => {
      if (area !== 'local') return;
      if (!(this.key in changes)) return;
      const change = changes[this.key];
      callback(change.newValue as StorageSchema[K] | undefined);
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }
}
