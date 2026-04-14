// Characterization test suite for the current service worker (Phase 0).
//
// Goal: lock in the behavior of the existing public messaging API so the
// Phase 3 TypeScript rewrite can prove feature parity. Each test runs the
// actual service worker source (public/background/service-worker.js) in a
// fresh vm context with the Chrome mock harness installed.
//
// Coverage: all 19 message actions listed in docs/planning/api-specification.md.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  fireAlarm,
  fireMessage,
  getMocks,
  installChromeMocks,
  uninstallChromeMocks,
} from "./chromeMocks";
import { flushMicrotasks, loadServiceWorker } from "./loadServiceWorker";

const DEFAULT_PRESET = {
  id: "default",
  name: "Default",
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
};

async function boot() {
  installChromeMocks();
  await loadServiceWorker();
  // Extra flush: initialize() chains several awaits.
  await flushMicrotasks();
}

afterEach(() => {
  uninstallChromeMocks();
});

// ---------- Timer Control ----------

describe("Timer control flow", () => {
  beforeEach(boot);

  it("getState returns idle defaults after a fresh load", async () => {
    const state = await fireMessage<any>("getState");
    expect(state.state).toBe("idle");
    expect(state.currentPhase).toBe("work");
    expect(state.workSessionsCompleted).toBe(0);
    expect(state.activePresetId).toBe("default");
    expect(state.endTime).toBeNull();
  });

  it("startTimer transitions idle → running and creates the alarm", async () => {
    const res = await fireMessage<{ success: boolean }>("startTimer", {
      phase: "work",
      minutes: 25,
    });
    expect(res).toEqual({ success: true });

    const state = await fireMessage<any>("getState");
    expect(state.state).toBe("running");
    expect(state.currentPhase).toBe("work");
    expect(state.endTime).toBeGreaterThan(Date.now());

    const mocks = getMocks();
    expect(mocks.alarms.has("pomodoro-timer")).toBe(true);
    // Starting work also starts the badge alarm.
    expect(mocks.alarms.has("pomodoro-badge")).toBe(true);
  });

  it("startTimer rejects when state is not idle", async () => {
    await fireMessage("startTimer", { phase: "work", minutes: 25 });
    const res = await fireMessage<{ success: boolean }>("startTimer", {
      phase: "work",
      minutes: 25,
    });
    expect(res).toEqual({ success: false });
  });

  it("pauseTimer captures remainingMs and clears the alarm", async () => {
    await fireMessage("startTimer", { phase: "work", minutes: 25 });
    const res = await fireMessage<{ success: boolean }>("pauseTimer");
    expect(res).toEqual({ success: true });

    const state = await fireMessage<any>("getState");
    expect(state.state).toBe("paused");
    expect(state.endTime).toBeNull();
    expect(state.remainingMs).toBeGreaterThan(0);
    expect(state.pausedAt).toBeGreaterThan(0);

    const mocks = getMocks();
    expect(mocks.alarms.has("pomodoro-timer")).toBe(false);
  });

  it("pauseTimer rejects when not running", async () => {
    const res = await fireMessage<{ success: boolean }>("pauseTimer");
    expect(res).toEqual({ success: false });
  });

  it("resumeTimer restores running state with a new endTime", async () => {
    await fireMessage("startTimer", { phase: "work", minutes: 25 });
    await fireMessage("pauseTimer");
    const res = await fireMessage<{ success: boolean }>("resumeTimer");
    expect(res).toEqual({ success: true });

    const state = await fireMessage<any>("getState");
    expect(state.state).toBe("running");
    expect(state.endTime).toBeGreaterThan(Date.now());
    expect(state.totalPausedMs).toBeGreaterThanOrEqual(0);

    expect(getMocks().alarms.has("pomodoro-timer")).toBe(true);
  });

  it("resumeTimer rejects when not paused", async () => {
    const res = await fireMessage<{ success: boolean }>("resumeTimer");
    expect(res).toEqual({ success: false });
  });

  it("skipPhase moves running → transition and increments completed work", async () => {
    await fireMessage("startTimer", { phase: "work", minutes: 25 });
    const res = await fireMessage<{ success: boolean }>("skipPhase");
    expect(res).toEqual({ success: true });

    const state = await fireMessage<any>("getState");
    expect(state.state).toBe("transition");
    expect(state.workSessionsCompleted).toBe(1);
    expect(state.suggestedNext).toBe("shortBreak");
    expect(state.lastCompletedDurationMs).toBeGreaterThanOrEqual(0);

    const mocks = getMocks();
    expect(mocks.alarms.has("pomodoro-timer")).toBe(false);
    // Skip triggers a notification.
    expect(mocks.notifications.length).toBeGreaterThan(0);
  });

  it("skipPhase rejects from idle", async () => {
    const res = await fireMessage<{ success: boolean }>("skipPhase");
    expect(res).toEqual({ success: false });
  });

  it("startNext launches the suggested phase from transition state", async () => {
    await fireMessage("startTimer", { phase: "work", minutes: 25 });
    await fireMessage("skipPhase");

    const res = await fireMessage<{ success: boolean }>("startNext");
    expect(res).toEqual({ success: true });

    const state = await fireMessage<any>("getState");
    expect(state.state).toBe("running");
    expect(state.currentPhase).toBe("shortBreak");
  });

  it("startNext rejects outside transition state", async () => {
    const res = await fireMessage<{ success: boolean }>("startNext");
    expect(res).toEqual({ success: false });
  });

  it("endActivity resets state, clears alarms, and persists defaults", async () => {
    await fireMessage("startTimer", { phase: "work", minutes: 25 });
    const res = await fireMessage<{ success: boolean }>("endActivity");
    expect(res).toEqual({ success: true });

    const state = await fireMessage<any>("getState");
    expect(state.state).toBe("idle");
    expect(state.currentPhase).toBe("work");
    expect(state.workSessionsCompleted).toBe(0);
    expect(state.endTime).toBeNull();

    const mocks = getMocks();
    expect(mocks.alarms.has("pomodoro-timer")).toBe(false);
    expect(mocks.alarms.has("pomodoro-badge")).toBe(false);
  });

  it("endActivity rejects from idle", async () => {
    const res = await fireMessage<{ success: boolean }>("endActivity");
    expect(res).toEqual({ success: false });
  });

  it("alarm firing drives running → transition with a completed phase in session", async () => {
    await fireMessage("startTimer", { phase: "work", minutes: 25 });
    await fireAlarm("pomodoro-timer");
    await flushMicrotasks();
    await flushMicrotasks();

    const state = await fireMessage<any>("getState");
    expect(state.state).toBe("transition");
    expect(state.workSessionsCompleted).toBe(1);
    expect(state.suggestedNext).toBe("shortBreak");
    expect(state.lastCompletedDurationMs).toBeGreaterThanOrEqual(0);

    // Session metadata persisted with a recorded phase.
    const stored = getMocks().storage.get("currentSession") as any;
    expect(stored).toBeTruthy();
    expect(stored.phases).toHaveLength(1);
    expect(stored.phases[0].completionType).toBe("completed");
  });
});

// ---------- Preset Management ----------

describe("Preset management", () => {
  beforeEach(boot);

  it("getPresets returns the default preset on a fresh install", async () => {
    const res = await fireMessage<any>("getPresets");
    expect(res.presets).toEqual([DEFAULT_PRESET]);
    expect(res.activePresetId).toBe("default");
  });

  it("savePreset upserts a new preset", async () => {
    const custom = { ...DEFAULT_PRESET, id: "focus", name: "Focus", workMinutes: 50 };
    const res = await fireMessage<{ success: boolean }>("savePreset", { preset: custom });
    expect(res).toEqual({ success: true });

    const list = (await fireMessage<any>("getPresets")).presets;
    expect(list).toHaveLength(2);
    expect(list.find((p: any) => p.id === "focus")).toMatchObject({
      name: "Focus",
      workMinutes: 50,
    });
  });

  it("savePreset updates an existing preset by id", async () => {
    const updated = { ...DEFAULT_PRESET, name: "Renamed" };
    await fireMessage("savePreset", { preset: updated });
    const list = (await fireMessage<any>("getPresets")).presets;
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("Renamed");
  });

  it("setActivePreset updates timerState.activePresetId", async () => {
    await fireMessage("savePreset", {
      preset: { ...DEFAULT_PRESET, id: "focus", name: "Focus" },
    });
    const res = await fireMessage<{ success: boolean }>("setActivePreset", {
      presetId: "focus",
    });
    expect(res).toEqual({ success: true });
    expect((await fireMessage<any>("getState")).activePresetId).toBe("focus");
  });

  it("deletePreset refuses to delete the default preset", async () => {
    const res = await fireMessage<{ success: boolean }>("deletePreset", {
      presetId: "default",
    });
    expect(res).toEqual({ success: false });
  });

  it("deletePreset falls back to default when the active preset is removed", async () => {
    await fireMessage("savePreset", {
      preset: { ...DEFAULT_PRESET, id: "focus", name: "Focus" },
    });
    await fireMessage("setActivePreset", { presetId: "focus" });

    const res = await fireMessage<{ success: boolean }>("deletePreset", {
      presetId: "focus",
    });
    expect(res).toEqual({ success: true });

    const state = await fireMessage<any>("getState");
    expect(state.activePresetId).toBe("default");
    const list = (await fireMessage<any>("getPresets")).presets;
    expect(list.find((p: any) => p.id === "focus")).toBeUndefined();
  });
});

// ---------- Session Metadata ----------

describe("Session metadata", () => {
  beforeEach(boot);

  it("setSessionMeta + getSessionMeta round-trip note and tags", async () => {
    const set = await fireMessage<{ success: boolean }>("setSessionMeta", {
      note: "Design review",
      tags: ["focus", "design"],
    });
    expect(set).toEqual({ success: true });

    const got = await fireMessage<any>("getSessionMeta");
    expect(got).toEqual({ note: "Design review", tags: ["focus", "design"] });
  });

  it("getSessionMeta returns the raw timerState fields when unset (migration path leaves them undefined)", async () => {
    // NOTE: The legacy-schema migration in loadState() rebuilds timerState
    // without currentNote/currentTags, so a fresh install returns undefined
    // for both. Captured here to catch regressions; Phase 1+ should normalize.
    const res = await fireMessage<any>("getSessionMeta");
    expect(res.note).toBeUndefined();
    expect(res.tags).toBeUndefined();
  });

  it("getTagHistory reflects persisted tag history", async () => {
    getMocks().storage.set("tagHistory", ["deep-work", "triage"]);
    const res = await fireMessage<string[]>("getTagHistory");
    expect(res).toEqual(["deep-work", "triage"]);
  });

  it("getTagHistory returns [] when no history exists", async () => {
    const res = await fireMessage<string[]>("getTagHistory");
    expect(res).toEqual([]);
  });
});

// ---------- Focus Mode ----------

describe("Focus mode", () => {
  beforeEach(boot);

  it("getFocusModeSettings returns defaults when none are stored", async () => {
    const res = await fireMessage<any>("getFocusModeSettings");
    expect(res.settings.enabled).toBe(true);
    expect(res.settings.categories.social).toBe(true);
    expect(res.settings.customDomains).toEqual([]);
    expect(res.settings.allowOnceMinutes).toBe(5);
  });

  it("updateFocusModeSettings merges with existing settings", async () => {
    await fireMessage("updateFocusModeSettings", {
      settings: { customDomains: ["example.com"] },
    });
    const res = await fireMessage<any>("getFocusModeSettings");
    expect(res.settings.customDomains).toEqual(["example.com"]);
    // Merge preserves default categories.
    expect(res.settings.categories.social).toBe(true);
  });

  it("starting a work phase installs dynamic blocking rules", async () => {
    await fireMessage("startTimer", { phase: "work", minutes: 25 });
    // enableFocusMode is fire-and-forget; flush.
    await flushMicrotasks();
    await flushMicrotasks();

    const mocks = getMocks();
    expect(mocks.dnrRules.length).toBeGreaterThan(0);

    const status = await fireMessage<any>("getFocusModeStatus");
    expect(status.active).toBe(true);
    expect(status.blockedCount).toBeGreaterThan(0);
    expect(status.temporaryAllows).toEqual([]);
  });

  it("allowOnce removes a blocking rule and records a temporary allow", async () => {
    await fireMessage("startTimer", { phase: "work", minutes: 25 });
    await flushMicrotasks();
    await flushMicrotasks();

    const before = getMocks().dnrRules.length;
    const res = await fireMessage<{ success: boolean }>("allowOnce", {
      domain: "facebook.com",
      minutes: 5,
    });
    expect(res.success).toBe(true);
    expect(getMocks().dnrRules.length).toBeLessThan(before);

    const status = await fireMessage<any>("getFocusModeStatus");
    expect(status.temporaryAllows).toContain("facebook.com");

    // A reblock alarm was scheduled.
    expect(getMocks().alarms.has("focus-reblock-facebook.com")).toBe(true);
  });

  it("endActivity clears all blocking rules and temporary allows", async () => {
    await fireMessage("startTimer", { phase: "work", minutes: 25 });
    await flushMicrotasks();
    await flushMicrotasks();
    await fireMessage("endActivity");
    await flushMicrotasks();

    const status = await fireMessage<any>("getFocusModeStatus");
    expect(status.active).toBe(false);
    expect(status.blockedCount).toBe(0);
    expect(status.temporaryAllows).toEqual([]);
  });
});

// ---------- Health ----------

describe("Health", () => {
  beforeEach(boot);

  it("ping responds with success and a timestamp", async () => {
    const res = await fireMessage<{ success: boolean; timestamp: number }>("ping");
    expect(res.success).toBe(true);
    expect(res.timestamp).toBeGreaterThan(0);
  });
});
