// Phase 4 will populate this module with port-based push updates
// (replacing the popup's 500ms polling loop). Phase 3 only stubs the
// registration point so `main.ts` can wire it up now.

export function registerPortConnections(): void {
  // No-op for Phase 3. Phase 4 will listen on `chrome.runtime.onConnect`
  // here and fan out timer-state snapshots to connected popups.
}
