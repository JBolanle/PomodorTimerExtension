// Phase 7 coverage — `subscribeTimerState` popup-side port consumer.
//
// We stub `chrome.runtime.connect` + `sendMessage` to drive each state
// transition (seed, push, disconnect+reconnect, fallback getState, unsubscribe).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TimerState } from '@/shared/types';
import { subscribeTimerState } from '@/lib/messaging/portClient';

type Listener = (...args: any[]) => any;

interface FakePort {
  messageListeners: Listener[];
  disconnectListeners: Listener[];
  disconnected: boolean;
  onMessage: { addListener: (fn: Listener) => void };
  onDisconnect: { addListener: (fn: Listener) => void };
  disconnect: () => void;
}

function makePort(): FakePort {
  const port: FakePort = {
    messageListeners: [],
    disconnectListeners: [],
    disconnected: false,
    onMessage: {
      addListener: (fn) => {
        port.messageListeners.push(fn);
      },
    },
    onDisconnect: {
      addListener: (fn) => {
        port.disconnectListeners.push(fn);
      },
    },
    disconnect: () => {
      port.disconnected = true;
    },
  };
  return port;
}

const SEED_STATE: TimerState = {
  state: 'idle',
  endTime: null,
  remainingMs: null,
  sessionStartedAt: null,
  currentPhase: 'work',
  workSessionsCompleted: 0,
  suggestedNext: null,
  lastCompletedDurationMs: null,
  activePresetId: 'default',
  autoStartNext: false,
  totalPausedMs: 0,
  pausedAt: null,
};

let createdPorts: FakePort[];
let sendMessageMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  createdPorts = [];
  sendMessageMock = vi.fn((_msg, cb) => cb(SEED_STATE));
  (globalThis as any).chrome = {
    runtime: {
      connect: () => {
        const p = makePort();
        createdPorts.push(p);
        return p;
      },
      sendMessage: sendMessageMock,
      lastError: undefined,
    },
  };
});

afterEach(() => {
  vi.useRealTimers();
  delete (globalThis as any).chrome;
});

describe('subscribeTimerState', () => {
  it('seeds via getState and delivers port pushes', async () => {
    const seen: TimerState[] = [];
    const statuses: boolean[] = [];
    const sub = subscribeTimerState((s) => seen.push(s), {
      onStatusChange: (c) => statuses.push(c),
    });

    // Seed is delivered via the sendMessage callback (synchronous in our mock).
    await vi.waitFor(() => expect(seen.length).toBeGreaterThanOrEqual(1));
    expect(seen[0]).toEqual(SEED_STATE);

    // Push a snapshot through the port.
    const port = createdPorts[0];
    expect(port).toBeDefined();
    port.messageListeners[0]({
      type: 'timerState',
      payload: { ...SEED_STATE, state: 'running' },
    });
    expect(seen[seen.length - 1].state).toBe('running');
    expect(statuses.at(-1)).toBe(true);

    sub.unsubscribe();
    expect(port.disconnected).toBe(true);
  });

  it('ignores non-timerState messages', async () => {
    const seen: TimerState[] = [];
    subscribeTimerState((s) => seen.push(s));
    await vi.waitFor(() => expect(seen.length).toBe(1));

    const port = createdPorts[0];
    port.messageListeners[0]({ type: 'other', payload: {} });
    expect(seen).toHaveLength(1);
  });

  it('on disconnect emits status=false, does a fallback getState, and schedules a reconnect', async () => {
    const seen: TimerState[] = [];
    const statuses: boolean[] = [];
    subscribeTimerState((s) => seen.push(s), {
      onStatusChange: (c) => statuses.push(c),
    });
    await vi.waitFor(() => expect(seen.length).toBe(1));

    // Subsequent sendMessage calls return a different snapshot so we
    // can distinguish the fallback from the seed.
    const fallbackSnapshot: TimerState = { ...SEED_STATE, state: 'paused' };
    sendMessageMock.mockImplementation((_msg, cb) => cb(fallbackSnapshot));

    const port1 = createdPorts[0];
    port1.disconnectListeners[0]();

    expect(statuses.includes(false)).toBe(true);
    // Fallback getState delivered:
    await vi.waitFor(() =>
      expect(seen.some((s) => s.state === 'paused')).toBe(true),
    );

    // After the backoff elapses, a new port is opened.
    await vi.advanceTimersByTimeAsync(600);
    expect(createdPorts.length).toBe(2);
  });

  it('unsubscribe after disconnect cancels the pending reconnect', async () => {
    const seen: TimerState[] = [];
    const sub = subscribeTimerState((s) => seen.push(s));
    await vi.waitFor(() => expect(seen.length).toBe(1));

    createdPorts[0].disconnectListeners[0]();
    sub.unsubscribe();

    // No new ports should be created once unsubscribed, even after the backoff window.
    await vi.advanceTimersByTimeAsync(10_000);
    expect(createdPorts.length).toBe(1);
  });
});
