// Popup ↔ SW connection health, driven by the timer-state port. When
// the SW is reachable the port delivers snapshots; when it dies the
// port disconnects. We surface those transitions directly rather than
// polling with an explicit ping (ADR-008: react to port events; don't
// keep the SW alive just to prove it's alive).

import { useEffect, useState } from 'react';

import { subscribeTimerState } from '@/lib/messaging/portClient';

export function useConnectionStatus(): boolean {
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    const sub = subscribeTimerState(
      () => {
        // Snapshots only arrive when the port is healthy — no-op on the
        // payload itself; the timer-state context already consumes it.
      },
      { onStatusChange: setConnected },
    );
    return () => sub.unsubscribe();
  }, []);

  return connected;
}
