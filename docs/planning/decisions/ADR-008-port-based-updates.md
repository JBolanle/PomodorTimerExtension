# ADR-008: Port-Based Updates Replace Polling

**Status**: Accepted

## Context

The current popup polls `getTimerState` every 500ms while open. This:

- Wastes CPU when the timer is idle (the state never changes)
- Wakes the SW every 500ms (forces it to stay alive, slows other work)
- Adds up to 1 second of UI latency for state changes (worst case)
- Doesn't propagate state changes triggered from elsewhere (options page, keyboard shortcuts) until the next poll

Options considered:

1. **`chrome.runtime.Port` long-lived connection** — SW pushes state changes; popup ticks display locally
2. **Smarter polling** — keep `setInterval` but stop when idle, restart when running
3. **Local tick + storage events** — popup reads state once, computes ticking display from `endTime`, listens to `chrome.storage.onChanged` for state changes

## Decision

Use **`chrome.runtime.Port`** for popup ↔ SW communication of state updates.

- Popup opens a long-lived port on mount: `chrome.runtime.connect({ name: 'timer-state' })`
- SW maintains a `connectedPorts: Set<Port>` and broadcasts `TimerState` updates to all connected ports on every state change
- Popup ticks the display locally between push updates using `endTime` (one `requestAnimationFrame` loop or `setInterval(250ms)` for second-precision MM:SS display)
- On port disconnect (SW killed, popup closed): popup detects via `port.onDisconnect`, attempts reconnect with one-shot `getState` to refresh state, then re-establishes the port

Request/response messaging (the rest of the API) continues via `chrome.runtime.sendMessage` with the typed contract from [ADR-004](ADR-004-messaging-contract.md). The port is for state push only.

## Consequences

### Positive
- No polling — SW is only woken when something changes
- Sub-100ms latency for state changes (push vs. poll wait)
- State changes from any source (options page, keyboard shortcut, alarm completion) propagate immediately
- Local ticking display is smoother and more battery-friendly than full state polls

### Negative
- New failure mode: port disconnect handling (mitigated by reconnect logic)
- Slightly more SW code: maintain port set, broadcast on changes
- Two communication channels (`sendMessage` + `Port`) instead of one — modestly more complexity

### Neutral
- Rejected: smarter polling. Mitigates idle waste but doesn't fix latency or other-source propagation.
- Rejected: storage events only. Possible but awkward — TimerState lives in many keys, would need to coalesce changes; storage events have their own latency profile.
- Future option: open a second port for focus-mode status updates if those become latency-sensitive.
