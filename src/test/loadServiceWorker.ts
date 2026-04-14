import { vi } from "vitest";

/**
 * Import the TypeScript service worker entry into a fresh module graph.
 *
 * Every call resets Vitest's module cache so all SW-internal module
 * singletons (timerState, currentSession, focus rule maps, cached
 * presets, etc.) start empty. The entry file (`src/background/main.ts`)
 * registers chrome.* listeners and kicks off `initialize()`; we await
 * microtask flushes so initialize completes before returning.
 */
export async function loadServiceWorker(): Promise<void> {
  vi.resetModules();
  await import("../background/main");
  // initialize() chains several awaits; two microtask flushes are
  // enough to settle it in practice.
  await flushMicrotasks();
  await flushMicrotasks();
  await flushMicrotasks();
}

export async function flushMicrotasks(): Promise<void> {
  await new Promise<void>((r) => setTimeout(r, 0));
}
