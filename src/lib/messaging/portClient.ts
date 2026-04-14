// Popup-side consumer of the SW's timer-state port (ADR-008).
//
// The SW broadcasts a fresh `TimerState` snapshot on every mutation.
// The popup subscribes once, receives pushes with sub-100ms latency,
// and ticks the display locally from `endTime` between pushes.
//
// Reconnect behavior: if the SW goes to sleep the port disconnects; we
// attempt to reopen it with a short backoff and fall back to a one-shot
// `getState` if reconnecting is slow, so state stays fresh even during
// the gap.

import type { TimerState } from '@/shared/types';
import { sendMessage } from './client';

export const TIMER_PORT_NAME = 'timer-state';

type Listener = (state: TimerState) => void;
type StatusListener = (connected: boolean) => void;
type PortMessage = { type: 'timerState'; payload: TimerState };

interface SubscribeOptions {
  /** Called with `true` whenever a port delivers a snapshot, `false`
   *  when the port disconnects. Useful for a connection-lost banner. */
  onStatusChange?: StatusListener;
}

const RECONNECT_DELAY_MS = 500;
const RECONNECT_MAX_DELAY_MS = 5000;

interface Subscription {
  unsubscribe(): void;
}

/**
 * Subscribe to live timer-state pushes from the SW. The listener is
 * called:
 *   1. Immediately with a snapshot fetched via `getState` (seed), so
 *      consumers have data before the first push arrives.
 *   2. Every time the SW broadcasts a new snapshot.
 *   3. With a refreshed snapshot after any reconnect (the SW posts one
 *      immediately on connect).
 *
 * Errors during the seed are swallowed — the port itself is the
 * authoritative source; the seed just narrows the initial window.
 */
export function subscribeTimerState(
  listener: Listener,
  opts: SubscribeOptions = {},
): Subscription {
  const onStatusChange = opts.onStatusChange;
  let disposed = false;
  let port: chrome.runtime.Port | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectDelay = RECONNECT_DELAY_MS;

  function handleMessage(msg: unknown): void {
    if (disposed) return;
    if (
      typeof msg === 'object' &&
      msg !== null &&
      (msg as PortMessage).type === 'timerState'
    ) {
      listener((msg as PortMessage).payload);
      onStatusChange?.(true);
    }
  }

  function scheduleReconnect(): void {
    if (disposed || reconnectTimer !== null) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_DELAY_MS);
  }

  function handleDisconnect(): void {
    port = null;
    if (disposed) return;
    onStatusChange?.(false);
    // While waiting for reconnect, do a one-shot getState so the UI
    // doesn't go stale if the SW takes a moment to wake.
    sendMessage('getState')
      .then((snapshot) => {
        if (disposed) return;
        listener(snapshot);
        onStatusChange?.(true);
      })
      .catch(() => {
        // Ignored — the reconnect will refresh state once it lands.
      });
    scheduleReconnect();
  }

  function connect(): void {
    if (disposed) return;
    try {
      port = chrome.runtime.connect({ name: TIMER_PORT_NAME });
    } catch {
      scheduleReconnect();
      return;
    }
    reconnectDelay = RECONNECT_DELAY_MS;
    port.onMessage.addListener(handleMessage);
    port.onDisconnect.addListener(handleDisconnect);
  }

  // Seed with a one-shot read so consumers don't have to wait a round
  // trip for the port to post its initial snapshot.
  sendMessage('getState')
    .then((snapshot) => {
      if (!disposed) listener(snapshot);
    })
    .catch(() => {
      // Swallowed — the port connect will deliver the snapshot instead.
    });

  connect();

  return {
    unsubscribe() {
      disposed = true;
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (port) {
        try {
          port.disconnect();
        } catch {
          // port already dead — nothing to do.
        }
        port = null;
      }
    },
  };
}
