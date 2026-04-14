// React-side entry point to the IndexedDB-backed session store.
// Re-exports the `sessionStore` singleton plus a React hook that
// subscribes to the shared `BroadcastChannel` and refetches on changes.
//
// IndexedDB is same-origin shared across extension contexts, so the
// popup and options can read directly — no SW round-trip required.

import { useEffect, useState } from 'react';

import type { Session } from '@/shared/types';
import {
  SESSIONS_CHANNEL,
  sessionStore,
  type SessionQuery,
} from '@/background/sessions/sessionStore';

export { sessionStore, SESSIONS_CHANNEL };
export type { SessionQuery };

/**
 * Subscribe a component to the full session list. Refetches whenever
 * the SW posts a change on the `pomodoro-sessions` broadcast channel.
 */
export function useSessions(query?: SessionQuery): {
  sessions: Session[];
  loading: boolean;
  refresh: () => void;
} {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  // Serialize query for dependency tracking. Stable for objectless calls.
  const querySig = query ? JSON.stringify(query) : '';

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      setLoading(true);
      sessionStore
        .query(query ?? {})
        .then((rows) => {
          if (!cancelled) {
            setSessions(rows);
            setLoading(false);
          }
        })
        .catch((err) => {
          console.error('[Pomodoro] Failed to query sessions:', err);
          if (!cancelled) setLoading(false);
        });
    };

    load();

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(SESSIONS_CHANNEL);
      channel.onmessage = () => {
        if (!cancelled) load();
      };
    } catch {
      /* BroadcastChannel unavailable — leave sessions static until next mount */
    }

    return () => {
      cancelled = true;
      channel?.close();
    };
    // `tick` lets callers force a refresh; `querySig` re-fetches on query change.
  }, [querySig, tick]);

  return { sessions, loading, refresh: () => setTick((t) => t + 1) };
}
