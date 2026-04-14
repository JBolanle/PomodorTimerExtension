// Port-based push updates (ADR-008). The popup opens a long-lived
// `chrome.runtime.Port` on mount; the SW broadcasts a fresh `TimerState`
// snapshot to every connected port whenever `persistState()` runs (i.e.
// after every mutation). This replaces the legacy 500ms polling loop.

import type { TimerState } from '@/shared/types';
import { timerState } from '../state';

export const TIMER_PORT_NAME = 'timer-state';

const connectedPorts: Set<chrome.runtime.Port> = new Set();

function snapshot(): TimerState {
  return { ...timerState };
}

function postSnapshot(port: chrome.runtime.Port): void {
  try {
    port.postMessage({ type: 'timerState', payload: snapshot() });
  } catch {
    // Port may have disconnected between set iteration and post; drop.
    connectedPorts.delete(port);
  }
}

export function registerPortConnections(): void {
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== TIMER_PORT_NAME) return;

    connectedPorts.add(port);
    postSnapshot(port);

    port.onDisconnect.addListener(() => {
      connectedPorts.delete(port);
    });
  });
}

/** Broadcast the current timer state to all connected popups. Called
 *  from `persistState()` — every mutation already persists, so piggy-
 *  backing here gives a single invariant: on-disk state == broadcast
 *  state. */
export function broadcastTimerState(): void {
  if (connectedPorts.size === 0) return;
  const payload = snapshot();
  for (const port of connectedPorts) {
    try {
      port.postMessage({ type: 'timerState', payload });
    } catch {
      connectedPorts.delete(port);
    }
  }
}
