// Phase 7 coverage — export/import JSON pipeline. Uses a stub File
// object so parseImportFile runs without touching the browser File API.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Preset, Session } from '@/shared/types';
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
    totalFocusMs: over.totalFocusMs ?? 1_500_000,
    totalBreakMs: over.totalBreakMs ?? 0,
    presetId: over.presetId ?? 'default',
    presetName: over.presetName ?? 'Default',
  };
}

function fakeFile(payload: unknown): File {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return { text: async () => text } as unknown as File;
}

beforeEach(() => {
  installChromeMocks();
  const mocks = getMocks();
  const DEFAULT_PRESET: Preset = {
    id: 'default',
    name: 'Default',
    workMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    sessionsBeforeLongBreak: 4,
  };
  mocks.storage.set('presets', [DEFAULT_PRESET]);
});

afterEach(() => {
  uninstallChromeMocks();
});

describe('parseImportFile', () => {
  it('parses a v2 JSON backup', async () => {
    const { parseImportFile } = await import('@/lib/import');
    const data = await parseImportFile(
      fakeFile({ version: 2, exportedAt: 'now', sessions: [makeSession({ id: 'a' })], presets: [] }),
    );
    expect(data.version).toBe(2);
    expect(data.sessions).toHaveLength(1);
    expect(data.presets).toEqual([]);
  });

  it('rejects invalid JSON', async () => {
    const { parseImportFile } = await import('@/lib/import');
    await expect(parseImportFile(fakeFile('{not json'))).rejects.toThrow(/Invalid JSON/);
  });

  it('rejects payloads missing the sessions array', async () => {
    const { parseImportFile } = await import('@/lib/import');
    await expect(parseImportFile(fakeFile({ version: 2 }))).rejects.toThrow(/sessions/);
  });

  it('rejects non-object top-level payloads', async () => {
    const { parseImportFile } = await import('@/lib/import');
    await expect(parseImportFile(fakeFile('null'))).rejects.toThrow(/Invalid file format/);
  });
});

describe('importData', () => {
  it('merges: dedupes by id and only writes new rows', async () => {
    const { importData } = await import('@/lib/import');
    const { sessionStore } = await import('@/background/sessions/sessionStore');

    await sessionStore.put(makeSession({ id: 'existing' }));

    const result = await importData(
      {
        version: 2,
        exportedAt: '',
        sessions: [makeSession({ id: 'existing' }), makeSession({ id: 'new' })],
        presets: [],
      },
      'merge',
    );

    expect(result.sessionsImported).toBe(1);
    expect(result.duplicatesSkipped).toBe(1);
    const all = await sessionStore.getAll();
    expect(all.map((s) => s.id).sort()).toEqual(['existing', 'new']);
  });

  it('replace: wipes the store before loading the import payload', async () => {
    const { importData } = await import('@/lib/import');
    const { sessionStore } = await import('@/background/sessions/sessionStore');

    await sessionStore.put(makeSession({ id: 'existing' }));

    const result = await importData(
      { version: 2, exportedAt: '', sessions: [makeSession({ id: 'x' })], presets: [] },
      'replace',
    );

    expect(result.sessionsImported).toBe(1);
    const all = await sessionStore.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('x');
  });

  it('merges presets by id, skipping existing ones', async () => {
    const { importData } = await import('@/lib/import');
    const result = await importData(
      {
        version: 2,
        exportedAt: '',
        sessions: [],
        presets: [
          {
            id: 'default',
            name: 'Default',
            workMinutes: 25,
            shortBreakMinutes: 5,
            longBreakMinutes: 15,
            sessionsBeforeLongBreak: 4,
          },
          {
            id: 'deep',
            name: 'Deep',
            workMinutes: 50,
            shortBreakMinutes: 10,
            longBreakMinutes: 20,
            sessionsBeforeLongBreak: 3,
          },
        ],
      },
      'merge',
    );

    expect(result.presetsImported).toBe(1); // only "deep" was new
    const mocks = getMocks();
    const stored = mocks.storage.get('presets') as Preset[];
    expect(new Set(stored.map((p) => p.id))).toEqual(new Set(['default', 'deep']));
  });
});
