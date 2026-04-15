// Phase 7 — migration from a legacy (pre-rewrite) chrome.storage.local
// snapshot. Verifies `runMigrations()` walks the full chain end-to-end:
//
//   1. `legacy-boolean-state-v1` — booleans → `state` enum + preset/settings
//      reshape + sessionHistory duration→plannedDurationMs rewrite.
//   2. `sessions-to-idb-v1` — `chrome.storage.local.sessions` → IndexedDB,
//      source key removed.
//
// Both migrations should leave behind their `__backup_before_<id>` entries
// so the user's data is recoverable if something misbehaves.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getMocks,
  installChromeMocks,
  uninstallChromeMocks,
} from './chromeMocks';

// A plausible pre-rewrite storage snapshot. Fields mirror what the
// legacy service-worker.js persisted circa the boolean-state era:
// - top-level `running`/`paused` booleans (no `state` enum yet)
// - flat settings with durations (before the preset split)
// - `sessions` array (pre-Phase-5, chrome.storage-backed)
// - `sessionHistory` with the old `duration` (minutes) shape
const LEGACY_SNAPSHOT = {
  running: true,
  paused: false,
  endTime: 1_700_000_000_000,
  remainingMs: null,
  completedSessions: 3,
  settings: {
    workMinutes: 50,
    shortBreakMinutes: 10,
    longBreakMinutes: 20,
    sessionsBeforeLongBreak: 3,
    notificationsEnabled: false,
  },
  sessionHistory: [
    {
      id: 's-legacy-1',
      mode: 'work',
      duration: 25,
      completedAt: 1_699_000_000_000,
    },
  ],
  sessions: [
    {
      id: 'session-legacy-a',
      startedAt: 1_699_000_000_000,
      endedAt: 1_699_001_500_000,
      status: 'completed',
      phases: [],
      totalFocusMs: 1_500_000,
      totalBreakMs: 0,
      presetId: 'default',
      presetName: 'Default',
    },
    {
      id: 'session-legacy-b',
      startedAt: 1_699_002_000_000,
      endedAt: 1_699_003_500_000,
      status: 'completed',
      phases: [],
      totalFocusMs: 1_500_000,
      totalBreakMs: 0,
      presetId: 'default',
      presetName: 'Default',
    },
  ],
  theme: 'obsidian',
};

beforeEach(() => {
  installChromeMocks();
  vi.resetModules();
  const mocks = getMocks();
  for (const [k, v] of Object.entries(LEGACY_SNAPSHOT)) {
    mocks.storage.set(k, v);
  }
});

afterEach(() => {
  uninstallChromeMocks();
});

describe('runMigrations against a legacy storage snapshot', () => {
  it('migrates boolean state + reshapes preset/settings + rewrites sessionHistory + moves sessions to IDB', async () => {
    const { runMigrations } = await import('@/background/storage/migrations');
    const { sessionStore } = await import('@/background/sessions/sessionStore');
    const mocks = getMocks();

    await runMigrations();

    // --- legacy-boolean-state-v1 ---
    expect(mocks.storage.get('state')).toBe('running');
    expect(mocks.storage.get('endTime')).toBe(1_700_000_000_000);
    expect(mocks.storage.get('workSessionsCompleted')).toBe(3);
    expect(mocks.storage.get('currentPhase')).toBe('work');
    expect(mocks.storage.get('activePresetId')).toBe('default');
    expect(mocks.storage.has('running')).toBe(false);
    expect(mocks.storage.has('paused')).toBe(false);
    expect(mocks.storage.has('completedSessions')).toBe(false);

    // Preset derived from old flat settings.
    const presets = mocks.storage.get('presets') as Array<Record<string, unknown>>;
    expect(presets).toHaveLength(1);
    expect(presets[0].workMinutes).toBe(50);
    expect(presets[0].shortBreakMinutes).toBe(10);
    expect(presets[0].longBreakMinutes).toBe(20);
    expect(presets[0].sessionsBeforeLongBreak).toBe(3);

    // Settings narrowed to the current shape (duration fields gone).
    const settings = mocks.storage.get('settings') as Record<string, unknown>;
    expect(settings.notificationsEnabled).toBe(false);
    expect(settings.autoStartNext).toBe(false);
    expect(settings.workMinutes).toBeUndefined();

    // sessionHistory duration (minutes) → plannedDurationMs/actualDurationMs.
    const hist = mocks.storage.get('sessionHistory') as Array<Record<string, unknown>>;
    expect(hist).toHaveLength(1);
    expect(hist[0].plannedDurationMs).toBe(25 * 60_000);
    expect(hist[0].actualDurationMs).toBe(25 * 60_000);
    expect(hist[0].completionType).toBe('completed');
    expect(hist[0].duration).toBeUndefined();

    // --- sessions-to-idb-v1 ---
    expect(mocks.storage.has('sessions')).toBe(false);
    const idbSessions = await sessionStore.getAll();
    expect(idbSessions).toHaveLength(2);
    const ids = idbSessions.map((s) => s.id).sort();
    expect(ids).toEqual(['session-legacy-a', 'session-legacy-b']);

    // --- backups for both migrations were written ---
    const legacyBackup = mocks.storage.get('__backup_before_legacy-boolean-state-v1') as
      | { at: number; data: Record<string, unknown> }
      | undefined;
    expect(legacyBackup).toBeDefined();
    expect(legacyBackup!.data.running).toBe(true);
    expect(legacyBackup!.data.sessions).toHaveLength(2);

    const sessionsBackup = mocks.storage.get('__backup_before_sessions-to-idb-v1') as
      | { at: number; data: Record<string, unknown> }
      | undefined;
    expect(sessionsBackup).toBeDefined();
    expect(sessionsBackup!.data.sessions).toHaveLength(2);
    // Backup snapshot strips prior __backup_before_ keys so they don't nest.
    expect(
      Object.keys(sessionsBackup!.data).some((k) => k.startsWith('__backup_before_')),
    ).toBe(false);

    // Unrelated keys (theme) pass through untouched.
    expect(mocks.storage.get('theme')).toBe('obsidian');
  });

  it('is idempotent — a second runMigrations() is a no-op', async () => {
    const { runMigrations } = await import('@/background/storage/migrations');
    const mocks = getMocks();

    await runMigrations();
    const stateAfterFirst = mocks.storage.get('state');
    const backupTs = (
      mocks.storage.get('__backup_before_legacy-boolean-state-v1') as { at: number }
    ).at;

    // Second run should not re-trigger either migration because their
    // shouldRun() guards now fail (state enum present, sessions key gone).
    await runMigrations();
    expect(mocks.storage.get('state')).toBe(stateAfterFirst);
    // Backup timestamp unchanged — backup was not rewritten.
    expect(
      (mocks.storage.get('__backup_before_legacy-boolean-state-v1') as { at: number }).at,
    ).toBe(backupTs);
  });
});
