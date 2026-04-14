import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const SW_PATH = resolve(__dirname, "../../public/background/service-worker.js");
let cachedSource: string | null = null;

/**
 * Execute the service worker source in a fresh vm context that shares globals
 * (chrome, setTimeout, Date, crypto, etc.) with the test environment.
 *
 * Each call creates new module-level state (timerState, currentSession, etc.)
 * and re-registers listeners with the currently installed chrome mock.
 *
 * Awaits `initialize()` completion before returning so tests start from a
 * deterministic steady state.
 */
export async function loadServiceWorker(): Promise<void> {
  if (cachedSource === null) {
    cachedSource = readFileSync(SW_PATH, "utf-8");
  }
  // Running in the current vm context means `chrome` (installed on globalThis)
  // and all test-environment globals are directly visible to the SW.
  vm.runInThisContext(
    `(function(){\n${cachedSource}\n})()\n//# sourceURL=service-worker.js`,
  );
  // Flush microtasks so initialize() completes.
  await flushMicrotasks();
  await flushMicrotasks();
}

export async function flushMicrotasks(): Promise<void> {
  await new Promise<void>((r) => setTimeout(r, 0));
}
