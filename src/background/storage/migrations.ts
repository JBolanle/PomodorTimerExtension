// Versioned storage migrations. Runs once at SW boot (will be wired in
// Phase 3 when the SW is rewritten in TS). Each migration decides
// whether it applies by inspecting a snapshot of `chrome.storage.local`.
// Before the first applicable migration runs on a given boot, the
// current storage contents are backed up to `__backup_before_<id>` so
// the user's data is recoverable if a migration misbehaves.
//
// The initial migration here is a direct port of the `loadState()`
// legacy-schema path in `public/background/service-worker.js` (the
// boolean `running`/`paused` → string `state` transition plus the
// preset/settings/sessionHistory adjustments that accompanied it).

import { DEFAULT_PRESET } from '@/shared/constants';
import type { Session } from '@/shared/types';
import { sessionStore } from '../sessions/sessionStore';

type StorageSnapshot = Record<string, unknown>;

export interface Migration {
  id: string;
  /** True if this migration needs to run against the given snapshot. */
  shouldRun(snapshot: StorageSnapshot): boolean;
  /** Apply the migration. May read/write storage freely. */
  run(snapshot: StorageSnapshot): Promise<void>;
}

async function writeBackup(snapshot: StorageSnapshot, migrationId: string): Promise<void> {
  const key = `__backup_before_${migrationId}`;
  // Strip prior backups from the snapshot we're about to persist, so
  // repeated migrations don't stack backup-of-backup entries.
  const clean: StorageSnapshot = {};
  for (const [k, v] of Object.entries(snapshot)) {
    if (!k.startsWith('__backup_before_')) clean[k] = v;
  }
  await chrome.storage.local.set({ [key]: { at: Date.now(), data: clean } });
}

/**
 * Legacy boolean-state migration. Converts `running`/`paused` booleans
 * and the old `sessionTotalMs`/`completedSessions` shape into the
 * current `state` enum plus split `STATE_KEYS`. Also:
 *   - Creates an initial preset from old `settings` fields if none exists
 *   - Reshapes `settings` to the current narrow shape
 *   - Rewrites `sessionHistory` entries whose `duration` (minutes) field
 *     predates the `{plannedDurationMs, actualDurationMs}` shape
 */
export const legacyBooleanStateMigration: Migration = {
  id: 'legacy-boolean-state-v1',
  shouldRun(snapshot) {
    // Only runs on stores that predate the `state` enum. Presence of
    // any state-enum key means we're already on the new schema.
    if (snapshot.state !== undefined) return false;
    return snapshot.running !== undefined || snapshot.paused !== undefined;
  },
  async run(snapshot) {
    const running = snapshot.running as boolean | undefined;
    const paused = snapshot.paused as boolean | undefined;
    const endTime = (snapshot.endTime as number | null | undefined) ?? null;
    const remainingMs = (snapshot.remainingMs as number | null | undefined) ?? null;
    const completedSessions = (snapshot.completedSessions as number | undefined) ?? 0;

    let state: 'idle' | 'running' | 'paused' = 'idle';
    if (running && endTime) state = 'running';
    else if (paused && remainingMs) state = 'paused';

    await chrome.storage.local.set({
      state,
      endTime,
      remainingMs,
      sessionStartedAt: null,
      currentPhase: 'work',
      workSessionsCompleted: completedSessions,
      suggestedNext: null,
      lastCompletedDurationMs: null,
      activePresetId: 'default',
      autoStartNext: false,
      totalPausedMs: 0,
      pausedAt: null,
      currentNote: null,
      currentTags: [],
    });
    await chrome.storage.local.remove(['running', 'paused', 'completedSessions', 'sessionTotalMs']);

    // Preset / settings reshape
    const presets = snapshot.presets as unknown[] | undefined;
    const oldSettings = snapshot.settings as Record<string, unknown> | undefined;
    if (!presets) {
      if (
        oldSettings &&
        (oldSettings.workMinutes !== undefined ||
          oldSettings.shortBreakMinutes !== undefined ||
          oldSettings.longBreakMinutes !== undefined)
      ) {
        const migratedPreset = {
          ...DEFAULT_PRESET,
          workMinutes: (oldSettings.workMinutes as number | undefined) ?? DEFAULT_PRESET.workMinutes,
          shortBreakMinutes:
            (oldSettings.shortBreakMinutes as number | undefined) ?? DEFAULT_PRESET.shortBreakMinutes,
          longBreakMinutes:
            (oldSettings.longBreakMinutes as number | undefined) ?? DEFAULT_PRESET.longBreakMinutes,
          sessionsBeforeLongBreak:
            (oldSettings.sessionsBeforeLongBreak as number | undefined) ??
            DEFAULT_PRESET.sessionsBeforeLongBreak,
        };
        await chrome.storage.local.set({
          presets: [migratedPreset],
          settings: {
            notificationsEnabled: (oldSettings.notificationsEnabled as boolean | undefined) ?? true,
            autoStartNext: false,
          },
        });
      } else {
        await chrome.storage.local.set({ presets: [DEFAULT_PRESET] });
      }
    }

    // sessionHistory shape migration (old: { duration, ... }, new: { plannedDurationMs, ... })
    const sessionHistory = snapshot.sessionHistory as Array<Record<string, unknown>> | undefined;
    if (
      sessionHistory &&
      sessionHistory.length > 0 &&
      sessionHistory[0].duration !== undefined
    ) {
      const migrated = sessionHistory.map((r) => ({
        id: r.id,
        mode: r.mode,
        plannedDurationMs: (r.duration as number) * 60000,
        actualDurationMs: (r.duration as number) * 60000,
        completionType: 'completed' as const,
        completedAt: r.completedAt,
      }));
      await chrome.storage.local.set({ sessionHistory: migrated });
    }
  },
};

/**
 * Phase 5: move the `sessions` array from `chrome.storage.local` into
 * IndexedDB so history can grow beyond the 200-session cap. After
 * copying, the source key is removed.
 */
export const sessionsToIdbMigration: Migration = {
  id: 'sessions-to-idb-v1',
  shouldRun(snapshot) {
    return Array.isArray(snapshot.sessions);
  },
  async run(snapshot) {
    const sessions = (snapshot.sessions as Session[] | undefined) ?? [];
    if (sessions.length > 0) {
      await sessionStore.putMany(sessions);
    }
    await chrome.storage.local.remove('sessions');
  },
};

export const MIGRATIONS: Migration[] = [
  legacyBooleanStateMigration,
  sessionsToIdbMigration,
];

/**
 * Run all applicable migrations against the current storage. Backs up
 * the pre-migration state once per applied migration.
 */
export async function runMigrations(migrations: Migration[] = MIGRATIONS): Promise<void> {
  for (const migration of migrations) {
    const snapshot = (await chrome.storage.local.get(null)) as StorageSnapshot;
    if (!migration.shouldRun(snapshot)) continue;
    try {
      await writeBackup(snapshot, migration.id);
      await migration.run(snapshot);
    } catch (err) {
      console.error(`[Pomodoro] Migration "${migration.id}" failed:`, err);
      throw err;
    }
  }
}
