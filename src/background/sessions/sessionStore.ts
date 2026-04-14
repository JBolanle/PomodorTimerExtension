// IndexedDB-backed store for closed sessions. Replaces the
// `sessionsRepo` + MAX_SESSIONS cap approach; sessions can now grow
// beyond 200. The same store is used from the service worker (writes)
// and directly from the React contexts (reads via `@/lib/sessions`),
// since IDB is same-origin-shared across extension contexts.
//
// Any write through this module also posts a change notification on a
// shared `BroadcastChannel` so popup/options can refresh their views
// without going through chrome.runtime messaging.

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Session } from '@/shared/types';

export const SESSIONS_DB_NAME = 'pomodoro';
export const SESSIONS_DB_VERSION = 1;
export const SESSIONS_STORE = 'sessions';
export const SESSIONS_CHANNEL = 'pomodoro-sessions';

interface SessionsDB extends DBSchema {
  sessions: {
    key: string;
    value: Session;
    indexes: { 'by-startedAt': number; 'by-tags': string };
  };
}

let dbPromise: Promise<IDBPDatabase<SessionsDB>> | null = null;

function getDb(): Promise<IDBPDatabase<SessionsDB>> {
  if (!dbPromise) {
    dbPromise = openDB<SessionsDB>(SESSIONS_DB_NAME, SESSIONS_DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
          const store = db.createObjectStore(SESSIONS_STORE, { keyPath: 'id' });
          store.createIndex('by-startedAt', 'startedAt');
          store.createIndex('by-tags', 'tags', { multiEntry: true });
        }
      },
    });
  }
  return dbPromise;
}

/** Test hook: drop the cached connection so a fresh `open()` runs. */
export function _resetSessionStore(): void {
  dbPromise = null;
}

function notifyChange(type: 'put' | 'putMany' | 'clear'): void {
  // BroadcastChannel is available in SW + popup + options. Failures
  // (e.g. older mock environments) must not break the write path.
  try {
    const ch = new BroadcastChannel(SESSIONS_CHANNEL);
    ch.postMessage({ type, at: Date.now() });
    ch.close();
  } catch {
    /* no-op */
  }
}

export interface SessionQuery {
  dateRange?: { start: number; end: number } | null;
  tags?: string[];
}

export const sessionStore = {
  async put(session: Session): Promise<void> {
    const db = await getDb();
    await db.put(SESSIONS_STORE, session);
    notifyChange('put');
  },

  async putMany(sessions: Session[]): Promise<void> {
    if (sessions.length === 0) return;
    const db = await getDb();
    const tx = db.transaction(SESSIONS_STORE, 'readwrite');
    await Promise.all([...sessions.map((s) => tx.store.put(s)), tx.done]);
    notifyChange('putMany');
  },

  async getAll(): Promise<Session[]> {
    const db = await getDb();
    return db.getAll(SESSIONS_STORE);
  },

  async query(q: SessionQuery = {}): Promise<Session[]> {
    const db = await getDb();

    // Tag path: use the multiEntry index, union results, apply date filter in JS.
    if (q.tags && q.tags.length > 0) {
      const tx = db.transaction(SESSIONS_STORE);
      const index = tx.store.index('by-tags');
      const seen = new Map<string, Session>();
      for (const tag of q.tags) {
        const matches = await index.getAll(tag);
        for (const s of matches) seen.set(s.id, s);
      }
      let results = [...seen.values()];
      if (q.dateRange) {
        const { start, end } = q.dateRange;
        results = results.filter((s) => s.startedAt >= start && s.startedAt <= end);
      }
      return results.sort((a, b) => a.startedAt - b.startedAt);
    }

    // Date-only path: use the startedAt index directly.
    if (q.dateRange) {
      const range = IDBKeyRange.bound(q.dateRange.start, q.dateRange.end);
      return db.getAllFromIndex(SESSIONS_STORE, 'by-startedAt', range);
    }

    return db.getAll(SESSIONS_STORE);
  },

  async clear(): Promise<void> {
    const db = await getDb();
    await db.clear(SESSIONS_STORE);
    notifyChange('clear');
  },

  async count(): Promise<number> {
    const db = await getDb();
    return db.count(SESSIONS_STORE);
  },
};
