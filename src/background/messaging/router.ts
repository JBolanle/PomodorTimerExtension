// Typed message router. Every entry satisfies `MessageMap[K]` — the
// compiler guarantees the request and response shapes match the
// contract in `src/shared/types/messages.ts`.

import type {
  FocusModeStatus,
  MessageMap,
  OpResult,
  TimerState,
} from '@/shared/types';
import { FOCUS_RULE_ID_BASE, FOCUS_RULE_ID_MAX } from '../constants';
import { focusAllowOnce } from '../focusMode/ruleManager';
import { enableFocusMode } from '../focusMode/controller';
import { persistState } from '../persist';
import {
  deletePreset as deletePresetStore,
  getMinutesForPhase,
  loadPresets,
  getActivePreset,
  savePreset as savePresetStore,
} from '../presets/store';
import {
  doEndActivity,
  doPause,
  doResume,
  doSkip,
  doStartTimer,
} from '../timer/operations';
import { focusModeRepo, tagHistoryRepo } from '../storage/repos';
import { temporaryAllows, timerState } from '../state';

type Handlers = {
  [K in keyof MessageMap]: (
    req: MessageMap[K]['request'],
  ) => Promise<MessageMap[K]['response']>;
};

export const handlers: Handlers = {
  startTimer: async ({ phase, minutes, focusMode }) => {
    if (timerState.state !== 'idle') return { success: false };
    return doStartTimer(phase, minutes, focusMode);
  },

  pauseTimer: async () => {
    if (timerState.state !== 'running') return { success: false };
    return doPause();
  },

  resumeTimer: async () => {
    if (timerState.state !== 'paused') return { success: false };
    return doResume();
  },

  skipPhase: async () => {
    if (timerState.state !== 'running' && timerState.state !== 'paused') {
      return { success: false };
    }
    return doSkip();
  },

  endActivity: async () => {
    if (timerState.state === 'idle') return { success: false };
    return doEndActivity();
  },

  startNext: async ({ phase, minutes }) => {
    if (timerState.state !== 'transition') return { success: false };
    const nextPhase = phase ?? timerState.suggestedNext ?? 'work';
    const preset = await getActivePreset();
    const nextMinutes = minutes ?? getMinutesForPhase(nextPhase, preset);
    return doStartTimer(nextPhase, nextMinutes);
  },

  getState: async () => ({ ...timerState }) as TimerState,

  // --- Presets ---
  getPresets: async () => {
    const presets = await loadPresets();
    return { presets, activePresetId: timerState.activePresetId };
  },

  savePreset: async ({ preset }) => {
    await savePresetStore(preset);
    return { success: true };
  },

  deletePreset: async ({ presetId }) => {
    const removed = await deletePresetStore(presetId);
    if (!removed) return { success: false };
    if (timerState.activePresetId === presetId) {
      timerState.activePresetId = 'default';
      await persistState();
    }
    return { success: true };
  },

  setActivePreset: async ({ presetId }) => {
    timerState.activePresetId = presetId;
    await persistState();
    return { success: true };
  },

  // --- Session metadata ---
  setSessionMeta: async ({ note, tags }) => {
    if (note !== undefined) timerState.currentNote = note;
    if (tags !== undefined) timerState.currentTags = tags;
    await persistState();
    return { success: true };
  },

  getSessionMeta: async () => ({
    note: timerState.currentNote ?? undefined,
    tags: timerState.currentTags.length > 0 ? timerState.currentTags : undefined,
  }),

  getTagHistory: async () => tagHistoryRepo.get(),

  // --- Focus mode ---
  getFocusModeSettings: async () => ({ settings: await focusModeRepo.get() }),

  updateFocusModeSettings: async ({ settings }) => {
    const current = await focusModeRepo.get();
    const updated = { ...current, ...settings };
    await focusModeRepo.set(updated);
    if (
      (timerState.state === 'running' || timerState.state === 'paused') &&
      timerState.currentPhase === 'work'
    ) {
      await enableFocusMode();
    }
    return { success: true };
  },

  allowOnce: async ({ domain, minutes }) => focusAllowOnce(domain, minutes),

  getFocusModeStatus: async (): Promise<FocusModeStatus> => {
    try {
      const rules = await chrome.declarativeNetRequest.getDynamicRules();
      const focusRules = rules.filter(
        (r) => r.id >= FOCUS_RULE_ID_BASE && r.id < FOCUS_RULE_ID_MAX,
      );
      return {
        active: focusRules.length > 0,
        blockedCount: focusRules.length,
        temporaryAllows: Array.from(temporaryAllows.keys()),
      };
    } catch {
      return { active: false, blockedCount: 0, temporaryAllows: [] };
    }
  },

  ping: async () => ({ success: true, timestamp: Date.now() }),
};

/** Dispatch a wire message to its typed handler. Returns `undefined`
 *  when the action is unknown so the `onMessage` listener can fall
 *  through without calling sendResponse. */
export async function dispatchMessage(
  message: { action: string } & Record<string, unknown>,
): Promise<unknown> {
  const action = message.action as keyof MessageMap;
  const handler = handlers[action] as
    | ((req: unknown) => Promise<unknown>)
    | undefined;
  if (!handler) return undefined;
  return handler(message as unknown);
}

// Unused-import guard (OpResult is referenced via MessageMap but TS may
// drop the import without this).
export type { OpResult };
