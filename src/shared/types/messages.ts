// Discriminated-union map of all runtime messages between UI and SW.
// Every entry is `{ request, response }`. Request is the payload shape
// *excluding* the `action` field (which the client injects). Response is
// the exact shape the SW's handler resolves with today — including its
// `{ success: false }` early-returns, which the typed client still rejects
// via `ExtensionError`.
//
// Source of truth: `public/background/service-worker.js` messageHandlers
// (lines ~553-672), locked in by characterization tests in
// `src/test/characterization.test.ts`.

import type {
  FocusModeSettings,
  FocusModeStatus,
  Preset,
  TimerMode,
  TimerState,
} from './entities';

export type OpResult =
  | { success: true }
  | { success: false; error?: string };

export interface MessageMap {
  // --- Timer control (7) ---
  startTimer: {
    request: { phase: TimerMode; minutes: number; focusMode?: boolean };
    response: OpResult;
  };
  pauseTimer: {
    request: Record<string, never>;
    response: OpResult;
  };
  resumeTimer: {
    request: Record<string, never>;
    response: OpResult;
  };
  skipPhase: {
    request: Record<string, never>;
    response: OpResult;
  };
  endActivity: {
    request: Record<string, never>;
    response: OpResult;
  };
  startNext: {
    request: { phase?: TimerMode; minutes?: number };
    response: OpResult;
  };
  getState: {
    request: Record<string, never>;
    response: TimerState;
  };

  // --- Presets (4) ---
  getPresets: {
    request: Record<string, never>;
    response: { presets: Preset[]; activePresetId: string };
  };
  savePreset: {
    request: { preset: Preset };
    response: OpResult;
  };
  deletePreset: {
    request: { presetId: string };
    response: OpResult;
  };
  setActivePreset: {
    request: { presetId: string };
    response: OpResult;
  };

  // --- Session metadata (3) ---
  setSessionMeta: {
    request: { note?: string; tags?: string[] };
    response: OpResult;
  };
  getSessionMeta: {
    // NOTE: on fresh install the SW returns `{ note: undefined, tags: undefined }`
    // (see memory/rewrite_sw_quirks.md). Phase 2+ should normalize this.
    request: Record<string, never>;
    response: { note: string | undefined; tags: string[] | undefined };
  };
  getTagHistory: {
    request: Record<string, never>;
    response: string[];
  };

  // --- Focus mode (4) ---
  getFocusModeSettings: {
    request: Record<string, never>;
    response: { settings: FocusModeSettings };
  };
  updateFocusModeSettings: {
    request: { settings: Partial<FocusModeSettings> };
    response: OpResult;
  };
  allowOnce: {
    request: { domain: string; minutes?: number };
    response: OpResult;
  };
  getFocusModeStatus: {
    request: Record<string, never>;
    response: FocusModeStatus;
  };

  // --- Health (1) ---
  ping: {
    request: Record<string, never>;
    response: { success: true; timestamp: number };
  };
}

export type MessageAction = keyof MessageMap;

export type MessageRequest<K extends MessageAction> = MessageMap[K]['request'];
export type MessageResponse<K extends MessageAction> = MessageMap[K]['response'];

/** Wire shape: request payload plus the `action` discriminator. */
export type WireMessage<K extends MessageAction = MessageAction> = {
  [A in K]: { action: A } & MessageRequest<A>;
}[K];
