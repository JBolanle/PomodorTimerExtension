// Phase 5 — IndexedDB session store and migration from chrome.storage.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@/shared/types';
import {
  getMocks,
  installChromeMocks,
  uninstallChromeMocks,
} from './chromeMocks';

function makeSession(over: Partial<Session> = {}): Session {
  return {
    id: over.id ?? crypto.randomUUID(),
    startedAt: over.startedAt ?? Date.now(),
    endedAt: over.endedAt ?? Date.now(),
    status: over.status ?? 'completed',
    phases: over.phases ?? [],
    totalFocusMs: over.totalFocusMs ?? 1500000,
    totalBreakMs: over.totalBreakMs ?? 0,
    presetId: over.presetId ?? 'default',
    presetName: over.presetName ?? 'Default',
    ...(over.tags ? { tags: over.tags } : {}),
    ...(over.note ? { note: over.note } : {}),
  };
}

beforeEach(() => {
  installChromeMocks();
  vi.resetModules();
});

afterEach(() => {
  uninstallChromeMocks();
});

describe('sessionStore (IDB)', () => {
  it('round-trips sessions through put/getAll', async () => {
    const { sessionStore } = await import('@/background/sessions/sessionStore');
    const s = makeSession({ id: 'abc' });
    await sessionStore.put(s);
    const all = await sessionStore.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('abc');
  });

  it('queries by date range using the by-startedAt index', async () => {
    const { sessionStore } = await import('@/background/sessions/sessionStore');
    const now = Date.now();
    await sessionStore.putMany([
      makeSession({ id: 'old', startedAt: now - 86400000 * 10 }),
      makeSession({ id: 'recent', startedAt: now - 3600000 }),
      makeSession({ id: 'now', startedAt: now }),
    ]);
    const result = await sessionStore.query({
      dateRange: { start: now - 86400000, end: now + 1000 },
    });
    const ids = result.map((s) => s.id).sort();
    expect(ids).toEqual(['now', 'recent']);
  });

  it('queries by tag using the multiEntry index', async () => {
    const { sessionStore } = await import('@/background/sessions/sessionStore');
    await sessionStore.putMany([
      makeSession({ id: 'a', tags: ['work', 'writing'] }),
      makeSession({ id: 'b', tags: ['work'] }),
      makeSession({ id: 'c', tags: ['hobby'] }),
    ]);
    const result = await sessionStore.query({ tags: ['writing'] });
    expect(result.map((s) => s.id)).toEqual(['a']);

    const union = await sessionStore.query({ tags: ['work', 'hobby'] });
    expect(union.map((s) => s.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('exceeds the old 200-session cap', async () => {
    const { sessionStore } = await import('@/background/sessions/sessionStore');
    const batch = Array.from({ length: 250 }, (_, i) =>
      makeSession({ id: `s-${i}`, startedAt: i }),
    );
    await sessionStore.putMany(batch);
    expect(await sessionStore.count()).toBe(250);
  });

  it('clear() empties the store', async () => {
    const { sessionStore } = await import('@/background/sessions/sessionStore');
    await sessionStore.put(makeSession({ id: 'x' }));
    await sessionStore.clear();
    expect(await sessionStore.count()).toBe(0);
  });
});

describe('sessionsToIdbMigration', () => {
  it('copies chrome.storage sessions into IDB and removes the source key', async () => {
    const mocks = getMocks();
    const legacy = [makeSession({ id: 'legacy-1' }), makeSession({ id: 'legacy-2' })];
    mocks.storage.set('sessions', legacy);

    const { runMigrations, MIGRATIONS } = await import('@/background/storage/migrations');
    const { sessionStore } = await import('@/background/sessions/sessionStore');

    // Run only the IDB migration so we don't trip the unrelated legacy-state one.
    const idbMigration = MIGRATIONS.find((m) => m.id === 'sessions-to-idb-v1');
    expect(idbMigration).toBeDefined();
    await runMigrations([idbMigration!]);

    const after = await sessionStore.getAll();
    expect(after.map((s) => s.id).sort()).toEqual(['legacy-1', 'legacy-2']);
    expect(mocks.storage.has('sessions')).toBe(false);
  });

  it('handles an empty sessions array by removing the key', async () => {
    const mocks = getMocks();
    mocks.storage.set('sessions', []);

    const { runMigrations, MIGRATIONS } = await import('@/background/storage/migrations');
    const idbMigration = MIGRATIONS.find((m) => m.id === 'sessions-to-idb-v1');
    await runMigrations([idbMigration!]);

    expect(mocks.storage.has('sessions')).toBe(false);
  });

  it('skips when no sessions key is present', async () => {
    const { MIGRATIONS } = await import('@/background/storage/migrations');
    const idbMigration = MIGRATIONS.find((m) => m.id === 'sessions-to-idb-v1');
    expect(idbMigration!.shouldRun({})).toBe(false);
  });
});
