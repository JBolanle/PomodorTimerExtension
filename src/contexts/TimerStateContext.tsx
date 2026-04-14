// Timer state context — single port subscription for the whole React
// tree. Replaces the legacy per-component `setInterval` polling. Every
// consumer of `useTimerState()` shares the same subscription and the
// same `remainingSeconds` tick so renders stay in lockstep.
//
// See ADR-007 (React state) and ADR-008 (port-based updates).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import { sendMessage } from '@/lib/messaging/client';
import { subscribeTimerState } from '@/lib/messaging/portClient';
import type { TimerMode, TimerState } from '@/shared/types';

const INITIAL_STATE: TimerState = {
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

// How often to re-render the popup display while the timer is running.
// Second-precision MM:SS → 250ms is comfortably under a second and
// smoother than lining up every whole-second boundary.
const TICK_INTERVAL_MS = 250;

interface TimerStateContextValue extends TimerState {
  initialized: boolean;
  remainingSeconds: number;
  startTimer: (phase: TimerMode, minutes: number, focusMode?: boolean) => Promise<void>;
  pauseTimer: () => Promise<void>;
  resumeTimer: () => Promise<void>;
  skipPhase: () => Promise<void>;
  endActivity: () => Promise<void>;
  startNext: (phase?: TimerMode, minutes?: number) => Promise<void>;
}

const TimerStateContext = createContext<TimerStateContextValue | null>(null);

export function TimerStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TimerState>(INITIAL_STATE);
  const [initialized, setInitialized] = useState(false);
  // Tick counter forces remainingSeconds recomputation while running.
  // The actual value doesn't matter — we read Date.now() inside useMemo.
  const [, setNowTick] = useState(0);

  useEffect(() => {
    const sub = subscribeTimerState((snapshot) => {
      setState(snapshot);
      setInitialized(true);
    });
    return () => sub.unsubscribe();
  }, []);

  // Local display tick: only runs while the timer is running (there's
  // nothing to animate when paused/idle/transition — the displayed
  // number is stable until the next push).
  useEffect(() => {
    if (state.state !== 'running') return;
    const id = setInterval(() => {
      setNowTick((n) => n + 1);
    }, TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [state.state]);

  // Computed fresh on every render. The tick effect forces re-renders
  // while running so this value stays current.
  const remainingSeconds = (() => {
    if (state.state === 'running' && state.endTime) {
      return Math.max(0, Math.ceil((state.endTime - Date.now()) / 1000));
    }
    if (state.state === 'paused' && state.remainingMs) {
      return Math.max(0, Math.ceil(state.remainingMs / 1000));
    }
    return 0;
  })();

  const startTimer = useCallback(
    async (phase: TimerMode, minutes: number, focusMode?: boolean) => {
      await sendMessage('startTimer', { phase, minutes, focusMode });
    },
    [],
  );
  const pauseTimer = useCallback(async () => {
    await sendMessage('pauseTimer');
  }, []);
  const resumeTimer = useCallback(async () => {
    await sendMessage('resumeTimer');
  }, []);
  const skipPhase = useCallback(async () => {
    await sendMessage('skipPhase');
  }, []);
  const endActivity = useCallback(async () => {
    await sendMessage('endActivity');
  }, []);
  const startNext = useCallback(
    async (phase?: TimerMode, minutes?: number) => {
      await sendMessage('startNext', { phase, minutes });
    },
    [],
  );

  const value: TimerStateContextValue = {
    ...state,
    initialized,
    remainingSeconds,
    startTimer,
    pauseTimer,
    resumeTimer,
    skipPhase,
    endActivity,
    startNext,
  };

  return (
    <TimerStateContext.Provider value={value}>
      {children}
    </TimerStateContext.Provider>
  );
}

/** Consume the shared timer state. Must be used inside `TimerStateProvider`. */
export function useTimerStateContext(): TimerStateContextValue {
  const ctx = useContext(TimerStateContext);
  if (ctx === null) {
    throw new Error(
      'useTimerState must be used within a TimerStateProvider (mount one at the popup / options root).',
    );
  }
  return ctx;
}
