// Phase 7 coverage — typed StorageAdapter and React-side useStorageValue.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StorageAdapter } from '@/background/storage/adapter';
import {
  getMocks,
  installChromeMocks,
  uninstallChromeMocks,
} from './chromeMocks';

beforeEach(() => {
  installChromeMocks();
});

afterEach(() => {
  uninstallChromeMocks();
});

describe('StorageAdapter', () => {
  it('returns the default when the key is unset', async () => {
    const repo = new StorageAdapter('theme', 'arctic');
    expect(await repo.get()).toBe('arctic');
  });

  it('persists a set value and returns it on subsequent get', async () => {
    const repo = new StorageAdapter('theme', 'arctic');
    await repo.set('obsidian');
    expect(await repo.get()).toBe('obsidian');
  });

  it('remove() clears the key so the default is returned again', async () => {
    const repo = new StorageAdapter('theme', 'arctic');
    await repo.set('ember');
    await repo.remove();
    expect(await repo.get()).toBe('arctic');
  });

  it('onChange fires with the new value on matching key mutations and ignores unrelated keys', async () => {
    const repo = new StorageAdapter('theme', 'arctic');
    const received: unknown[] = [];
    const unsubscribe = repo.onChange((v) => received.push(v));

    await repo.set('ember');
    // Write an unrelated key — callback should not fire.
    await chrome.storage.local.set({ tagHistory: ['focus'] });
    await repo.remove();

    expect(received).toEqual(['ember', undefined]);

    unsubscribe();
    await repo.set('obsidian');
    expect(received).toEqual(['ember', undefined]); // no new entries after unsubscribe
  });

  it('does not report changes from other storage areas', async () => {
    const repo = new StorageAdapter('theme', 'arctic');
    const received: unknown[] = [];
    repo.onChange((v) => received.push(v));

    // Call listeners directly with area='sync' to simulate a foreign-area change.
    const mocks = getMocks();
    for (const listener of mocks.onStorageChangedListeners) {
      listener({ theme: { oldValue: 'arctic', newValue: 'ember' } }, 'sync');
    }
    expect(received).toHaveLength(0);
  });
});
