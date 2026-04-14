// Phase 0 build spike — minimal TypeScript service worker.
//
// Proves the build pipeline can compile a TypeScript SW entry into a single
// classic (non-module) JS bundle that loads in both Chrome's MV3 service
// worker runtime and Firefox's `background.scripts` array.
//
// Intentionally tiny: only handles `ping` so we can confirm messaging works.
// Real decomposition happens in Phase 3 per docs/planning/roadmap.md.

type PingResponse = { success: true; timestamp: number; from: "ts-spike" };

type SpikeMessageMap = {
  ping: { request: Record<string, never>; response: PingResponse };
};

function handlePing(): PingResponse {
  return { success: true, timestamp: Date.now(), from: "ts-spike" };
}

chrome.runtime.onMessage.addListener(
  (message: { action: keyof SpikeMessageMap }, _sender, sendResponse) => {
    if (message.action === "ping") {
      sendResponse(handlePing());
      return false;
    }
    return false;
  },
);

// Marker log so the spike is identifiable in the extension console.
console.log("[Pomodoro SW spike] TypeScript service worker loaded");
