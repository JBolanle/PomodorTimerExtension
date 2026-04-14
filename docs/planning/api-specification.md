# API Specification — Messaging Contract

This document defines every message exchanged between the extension's execution contexts (popup, options page, service worker) and the storage-direct access patterns that bypass messaging.

---

## Communication Architecture

```
┌─────────────────┐     chrome.runtime.sendMessage      ┌──────────────────┐
│     Popup        │ ──────────────────────────────────→ │  Service Worker   │
│  (React, TS)     │ ←────────────────────────────────── │  (Plain JS)       │
└─────────────────┘     sendResponse (async)             └──────────────────┘
                                                                  ↕
┌─────────────────┐     chrome.runtime.sendMessage              storage
│  Options Page    │ ──────────────────────────────────→          ↕
│  (React, TS)     │ ←──────────────────────────────────  ┌──────────────────┐
│                  │ ←─── chrome.storage.local (direct) ──│ chrome.storage   │
└─────────────────┘                                       └──────────────────┘
```

**Key characteristics:**
- All messaging is **request/response** (popup/options → SW → response). There are no push messages from SW to popup.
- The popup polls `getState` every **500ms** while open, even when the timer is idle.
- The options page **bypasses** the service worker for `settings`, `sessions`, and `theme` — reading/writing `chrome.storage.local` directly via `useSettings`, `useHistory`, and `useTheme` hooks.
- Messages are sent via `chrome.runtime.sendMessage({ action, ...payload })` and dispatched by the SW's `messageHandlers` object.

---

## Client-Side Messaging Layer

### `sendMessage<T>(action, payload)` — `src/lib/messaging.ts`

The popup/options side sends all messages through this function:

```typescript
sendMessage<T = unknown>(action: string, payload: Record<string, unknown> = {}): Promise<T>
```

**Error handling:**
- `chrome.runtime.lastError` → throws `ExtensionError` with code `CONNECTION_ERROR`
- `null`/`undefined` response → throws `ExtensionError` with code `NO_RESPONSE`
- Response with `{ success: false }` → throws `ExtensionError` with code from response or `OPERATION_FAILED`

### Typed Wrappers — `src/lib/chrome.ts`

Each message action has a typed wrapper function. These are the "client SDK" for the service worker:

```typescript
getTimerState(): Promise<TimerState>
startTimer(phase: TimerMode, minutes: number, focusMode?: boolean): Promise<{ success: boolean }>
pauseTimer(): Promise<{ success: boolean }>
resumeTimer(): Promise<{ success: boolean }>
skipPhase(): Promise<{ success: boolean }>
endActivity(): Promise<{ success: boolean }>
startNext(phase?: TimerMode, minutes?: number): Promise<{ success: boolean }>
getPresets(): Promise<{ presets: Preset[]; activePresetId: string }>
savePreset(preset: Preset): Promise<{ success: boolean }>
deletePreset(presetId: string): Promise<{ success: boolean }>
setActivePreset(presetId: string): Promise<{ success: boolean }>
```

**Note:** Not all message actions have typed wrappers. `setSessionMeta`, `getSessionMeta`, `getTagHistory`, focus mode messages, and `ping` are called via raw `sendMessage()` from components/hooks.

---

## Message Catalog

### Timer Control

#### `startTimer`
Start a new timer phase.

| | Shape |
|---|---|
| **Request** | `{ action: 'startTimer', phase: TimerMode, minutes: number, focusMode?: boolean }` |
| **Response** | `{ success: true }` |
| **Error** | `{ success: false }` if state is not `idle`; `{ success: false, error: 'Failed to create alarm' }` if alarm creation fails |
| **Side effects** | Creates `chrome.alarms` entry, creates new session group if none exists, enables focus mode for work phases (unless `focusMode === false`), starts badge alarm |

#### `pauseTimer`
Pause a running timer.

| | Shape |
|---|---|
| **Request** | `{ action: 'pauseTimer' }` |
| **Response** | `{ success: true }` |
| **Error** | `{ success: false }` if state is not `running` |
| **Side effects** | Clears alarm, records `pausedAt` timestamp, captures `remainingMs` |

#### `resumeTimer`
Resume a paused timer.

| | Shape |
|---|---|
| **Request** | `{ action: 'resumeTimer' }` |
| **Response** | `{ success: true }` |
| **Error** | `{ success: false }` if state is not `paused`; alarm creation failure |
| **Side effects** | Creates new alarm with remaining time, accumulates pause duration in `totalPausedMs`, re-enables focus mode for work |

#### `skipPhase`
Skip the current phase and enter transition state.

| | Shape |
|---|---|
| **Request** | `{ action: 'skipPhase' }` |
| **Response** | `{ success: true }` |
| **Error** | `{ success: false }` if state is not `running` or `paused` |
| **Side effects** | Records skipped phase in session, increments `workSessionsCompleted` (if work), computes next suggestion, sends notification, plays sound, may trigger auto-start alarm |

#### `endActivity`
End the entire activity and reset to idle.

| | Shape |
|---|---|
| **Request** | `{ action: 'endActivity' }` |
| **Response** | `{ success: true }` |
| **Error** | `{ success: false }` if state is `idle` |
| **Side effects** | Records in-progress phase, closes session group, disables focus mode, resets all timer state to idle defaults, clears all alarms |

#### `startNext`
Start the next phase from transition state.

| | Shape |
|---|---|
| **Request** | `{ action: 'startNext', phase?: TimerMode, minutes?: number }` |
| **Response** | `{ success: true }` |
| **Error** | `{ success: false }` if state is not `transition` |
| **Side effects** | Falls through to `doStartTimer()`. Uses `suggestedNext` if `phase` not provided. Calculates minutes from active preset if not provided. |

#### `getState`
Get current timer state (polled every 500ms by popup).

| | Shape |
|---|---|
| **Request** | `{ action: 'getState' }` |
| **Response** | `TimerState` (shallow copy of in-memory state) |
| **Side effects** | None (read-only) |

---

### Preset Management

#### `getPresets`

| | Shape |
|---|---|
| **Request** | `{ action: 'getPresets' }` |
| **Response** | `{ presets: Preset[], activePresetId: string }` |

#### `savePreset`
Create or update a preset (upsert by `id`).

| | Shape |
|---|---|
| **Request** | `{ action: 'savePreset', preset: Preset }` |
| **Response** | `{ success: true }` |

#### `deletePreset`

| | Shape |
|---|---|
| **Request** | `{ action: 'deletePreset', presetId: string }` |
| **Response** | `{ success: true }` |
| **Error** | `{ success: false }` if `presetId === 'default'` |
| **Side effects** | If deleted preset was active, switches to `'default'` |

#### `setActivePreset`

| | Shape |
|---|---|
| **Request** | `{ action: 'setActivePreset', presetId: string }` |
| **Response** | `{ success: true }` |
| **Side effects** | Updates `timerState.activePresetId`, persists |

---

### Session Metadata (Advanced Mode)

#### `setSessionMeta`

| | Shape |
|---|---|
| **Request** | `{ action: 'setSessionMeta', note?: string, tags?: string[] }` |
| **Response** | `{ success: true }` |
| **Side effects** | Updates `timerState.currentNote` and/or `timerState.currentTags`, persists |

#### `getSessionMeta`

| | Shape |
|---|---|
| **Request** | `{ action: 'getSessionMeta' }` |
| **Response** | `{ note: string \| null, tags: string[] }` |

#### `getTagHistory`

| | Shape |
|---|---|
| **Request** | `{ action: 'getTagHistory' }` |
| **Response** | `string[]` (up to 50 most recent unique tags) |

---

### Focus Mode

#### `getFocusModeSettings`

| | Shape |
|---|---|
| **Request** | `{ action: 'getFocusModeSettings' }` |
| **Response** | `{ settings: FocusModeSettings }` |

#### `updateFocusModeSettings`

| | Shape |
|---|---|
| **Request** | `{ action: 'updateFocusModeSettings', settings: Partial<FocusModeSettings> }` |
| **Response** | `{ success: true }` |
| **Side effects** | Merges with existing settings, persists. If timer is running/paused during work phase, re-enables focus mode with updated settings. |

#### `allowOnce`

| | Shape |
|---|---|
| **Request** | `{ action: 'allowOnce', domain: string, minutes?: number }` |
| **Response** | `{ success: true }` |
| **Side effects** | Temporarily removes blocking rule for domain. Sets expiry timer. Stores in `temporaryAllows` (in-memory only). |

#### `getFocusModeStatus`

| | Shape |
|---|---|
| **Request** | `{ action: 'getFocusModeStatus' }` |
| **Response** | `{ active: boolean, blockedCount: number, temporaryAllows: string[] }` |

---

### Health

#### `ping`

| | Shape |
|---|---|
| **Request** | `{ action: 'ping' }` |
| **Response** | `{ success: true, timestamp: number }` |
| **Used by** | `useConnectionStatus` hook to detect service worker disconnection |

---

## Storage-Direct Access (Bypasses Service Worker)

These data access patterns skip the messaging layer entirely, reading/writing `chrome.storage.local` from the popup or options page:

| Hook / Component | Storage Key | Operations | Why It Matters |
|---|---|---|---|
| `useSettings` (`src/hooks/useSettings.ts`) | `settings` | Read, write, listen | SW also reads `settings` — no coordination |
| `useHistory` (`src/hooks/useHistory.ts`) | `sessions` | Read, listen, clear | SW writes sessions; options page reads directly |
| `useTheme` (`src/hooks/useTheme.ts`) | `theme` | Read, write, listen | SW never reads theme — purely UI concern |

**Architectural inconsistency:** Presets are accessed through the SW messaging layer (`getPresets`, `savePreset`, etc.), but sessions and settings are accessed directly via storage. There is no clear rule for when to use messaging vs. direct storage access.

---

## Error Protocol

### Error Shape

Failed operations return: `{ success: false, error?: string, code?: string }`

### ExtensionError Class (`src/lib/messaging.ts`)

```typescript
class ExtensionError extends Error {
  code: string;  // e.g., 'CONNECTION_ERROR', 'NO_RESPONSE', 'OPERATION_FAILED'
}
```

### Error Code Mapping (`src/lib/errorMessages.ts`)

Maps error codes to user-friendly messages for toast display. Handles:
- Custom error codes from the service worker
- `QuotaExceededError` (storage full)
- Connection/disconnection errors
- Invalid operation errors

---

## Type Safety Gaps

1. **Service worker is plain JavaScript** — no compile-time type checking on message handlers, storage access, or state mutations.

2. **`sendMessage` accepts any string** — the `action` parameter is typed as `string`, not a discriminated union. Typos in action names fail silently (no handler found, no response, times out).

3. **No shared message type definitions** — the request/response shapes documented above exist only implicitly in the code. The TypeScript types in `src/types/index.ts` cover data entities but not message contracts.

4. **Response types are lies** — `sendMessage<T>` casts the response to `T` without validation. If the SW returns a different shape, the popup receives wrong data with no error.

5. **Session metadata not in TimerState type** — `currentNote` and `currentTags` exist on the SW's `timerState` object but are absent from the TypeScript `TimerState` interface, forcing separate `getSessionMeta`/`setSessionMeta` messages.

6. **Focus mode messages have no typed wrappers** — called via raw `sendMessage()` with inline string action names from components.
