# Technical Specification & Architecture

## Current Architecture

### Execution Contexts

The extension runs in three isolated JavaScript contexts:

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Browser Process                                │
│                                                                          │
│   ┌──────────────────────┐    ┌──────────────────────┐                 │
│   │     Popup (React)     │    │  Options (React)      │                │
│   │   ephemeral, 350px    │    │   full page, router   │                │
│   └──────────────────────┘    └──────────────────────┘                 │
│            ↕                              ↕                              │
│      sendMessage()                 sendMessage() + storage                │
│            ↕                              ↕                              │
│   ┌────────────────────────────────────────────────────┐                │
│   │       Background Service Worker (plain JS)          │                │
│   │  Timer FSM • Focus Mode • Sessions • Presets        │                │
│   │  Messaging dispatcher • Persistence • Sound • Badge │                │
│   └────────────────────────────────────────────────────┘                │
│            ↕                              ↕                              │
│   chrome.alarms          chrome.storage.local         chrome.dnr        │
│   chrome.notifications   chrome.offscreen (Chrome)                       │
└────────────────────────────────────────────────────────────────────────┘
```

### Build Pipeline

- **Vite** with `@vitejs/plugin-react` and `@tailwindcss/vite`
- Multi-entry build: `src/popup/index.html` and `src/options/index.html`
- Service worker copied as-is from `public/background/service-worker.js` to `dist/`
- `BROWSER` env var (`chrome` | `firefox`) transforms `manifest.json`:
  - Chrome: `background.service_worker` field
  - Firefox: `background.scripts` array, `browser_specific_settings.gecko`, no offscreen permission
- Output: `dist/` (Chrome), `dist-firefox/` (Firefox)

### State Management

| Layer | Pattern | Notes |
|---|---|---|
| Service worker | Mutable global object (`timerState`) | All timer state lives here. Persisted to storage on every change. |
| Popup React | `useTimerState` polls `getState` every 500ms | Stateless — derives display from polled state |
| Options React | Mix: `useTimerState` (poll) + `useSettings`, `useHistory`, `useTheme` (direct storage) | Inconsistent — some data via SW, some via direct storage |

### File Structure

```
public/background/service-worker.js     1068 lines  ← the monolith
src/
  popup/                                            React popup entry
  options/                                          React options entry + 3 pages
  components/                          26 components across timer/settings/history/layout/ui
  hooks/                               10 custom hooks
  lib/                                 messaging, storage, chrome wrappers, constants, errorMessages, export, import, utils
  types/index.ts                       7 entity types (no message contract types)
  styles/globals.css                                Theme variables + effects
  data/                                blocklists, breakTips
```

---

## Pain Points (Current Architecture)

| # | Issue | Impact |
|---|---|---|
| 1 | 1,068-line untyped JavaScript service worker | Hard to navigate, test, or refactor; mixes timer FSM, focus mode, session store, preset CRUD, messaging, persistence, sound, badge |
| 2 | No message type contracts between contexts | `sendMessage('typo')` compiles fine; response shapes drift silently |
| 3 | Direct `chrome.storage.local` calls scattered everywhere | No abstraction, no validation, no transaction semantics |
| 4 | Focus mode in-memory state lost on SW restart | `focusRuleMap` and `temporaryAllows` cleared; DNR rules orphaned |
| 5 | No tests of any kind | Zero safety net for refactoring |
| 6 | Popup polls every 500ms regardless of state | Wastes CPU even when timer is idle |
| 7 | Duplicate `DEFAULT_PRESET` definition in SW and `src/lib/constants.ts` | Drift hazard |
| 8 | Sessions stored as flat array capped at 200 | No pagination or efficient querying |
| 9 | Storage access split: presets via SW messaging, settings/sessions via direct storage | Architectural inconsistency, no clear rule for which path to use |
| 10 | Service worker is plain JS in `public/`, not built | Cannot import shared TS modules; cannot use TypeScript |

---

## Proposed Architecture

The rewrite is a **big-bang on a separate branch**: build the new architecture from scratch, swap when feature parity is verified by the test suite.

### Target Module Structure

```
src/
  background/                          ← NEW: SW source as TypeScript
    main.ts                              entry point, lifecycle, routing
    timer/
      timerMachine.ts                    FSM (idle/running/paused/transition)
      timerOperations.ts                 start/pause/resume/skip/end
      timerCompletion.ts                 alarm handler, auto-start
    focusMode/
      focusController.ts                 enable/disable
      ruleManager.ts                     DNR rules + persistent rule map
      blocklists.ts                      predefined categories
    sessions/
      sessionStore.ts                    IndexedDB-backed session storage
      sessionGrouping.ts                 phase recording, session lifecycle
    presets/
      presetStore.ts                     CRUD operations
    messaging/
      router.ts                          dispatcher
      contracts.ts                       typed message map (shared with React)
      portConnection.ts                  long-lived port for popup state push
    storage/
      adapter.ts                         typed repository pattern
      schema.ts                          storage key registry
      migrations.ts                      version-aware migrations
    notifications/
      notify.ts                          chrome.notifications wrapper
    sound/
      offscreenAudio.ts                  Chrome offscreen API
      directAudio.ts                     Firefox direct Audio
    badge/
      badgeUpdater.ts                    icon badge logic

  shared/                              ← NEW: code used by both SW and React
    types/                               entities + message contracts
    schema/                              storage key definitions
    constants/                           single source of truth (DEFAULT_PRESET, etc.)

  popup/                               ← unchanged structure
  options/                             ← unchanged structure
  components/                          ← unchanged structure
  hooks/
    useTimerState.ts                     ← refactor to use Port instead of polling
    ...others mostly unchanged
  lib/
    messaging/
      client.ts                          ← typed sendMessage<Action>(payload)
      portClient.ts                      ← popup-side port consumer
    storage/
      client.ts                          ← typed storage hooks (replace direct calls)
```

### Key Architectural Decisions

#### 1. TypeScript service worker

The SW becomes TypeScript. Vite is configured to compile `src/background/main.ts` as a separate entry, output to `dist/background/service-worker.js`. This requires:
- Adding a Vite build entry for the SW (`build.rollupOptions.input`)
- Bundling all `src/background/**` and `src/shared/**` imports into a single SW file (no dynamic imports — MV3 SWs cannot import modules at runtime in all browsers)
- Removing `public/background/service-worker.js`
- Updating manifest transform to point at the new build output

See [decisions/ADR-002-typescript-sw.md](decisions/ADR-002-typescript-sw.md).

#### 2. Typed messaging contract

Define a `MessageMap` discriminated union shared by SW and React:

```typescript
// src/shared/types/messages.ts
type MessageMap = {
  startTimer: {
    request: { phase: TimerMode; minutes: number; focusMode?: boolean };
    response: { success: boolean };
  };
  pauseTimer: { request: {}; response: { success: boolean } };
  // ... all 19 actions
};

function sendMessage<K extends keyof MessageMap>(
  action: K,
  payload: MessageMap[K]['request']
): Promise<MessageMap[K]['response']>;
```

The SW router validates `action` against the map and dispatches to typed handlers. See [decisions/ADR-004-messaging-contract.md](decisions/ADR-004-messaging-contract.md).

#### 3. Port-based state push

Replace 500ms polling with `chrome.runtime.Port`:
- Popup opens long-lived port on mount (`chrome.runtime.connect({ name: 'timer-state' })`)
- SW pushes `TimerState` updates on every state change
- Popup ticks the display locally between pushes (using `endTime`)
- Disconnect is detected automatically; popup falls back to one-shot `getState` on reconnect

See [decisions/ADR-008-port-based-updates.md](decisions/ADR-008-port-based-updates.md).

#### 4. Storage abstraction

A typed repository layer wraps all storage access:

```typescript
// src/background/storage/adapter.ts
class StorageAdapter<T> {
  constructor(private key: string, private schema: Schema<T>) {}
  async get(): Promise<T>;
  async set(value: T): Promise<void>;
  onChange(callback: (value: T) => void): () => void;
}

// Concrete repos
const settingsRepo = new StorageAdapter('settings', SettingsSchema);
const presetsRepo = new StorageAdapter('presets', PresetsSchema);
// etc.
```

No code outside `src/background/storage/` or `src/lib/storage/` calls `chrome.storage.local` directly. See [decisions/ADR-005-storage-abstraction.md](decisions/ADR-005-storage-abstraction.md).

#### 5. IndexedDB for sessions

Sessions move to IndexedDB to remove the 200-cap and enable efficient filtering:
- Object store `sessions` with keyPath `id`
- Indexes on `startedAt` and `tags` (multiEntry)
- Wrapper module `sessions/sessionStore.ts` with typed `query({ dateRange, tags })` API
- Migration: on first run of new version, copy existing sessions array from `chrome.storage.local.sessions` into IndexedDB, then delete the storage key

Library choice: native IDB API with a thin promisified wrapper, OR `idb` (Jake Archibald's wrapper, ~1KB). Decision deferred to ADR.

#### 6. Focus mode persistence

Persist `focusRuleMap` and `temporaryAllows` to storage. On SW wake:
- Reconcile in-memory map with `chrome.declarativeNetRequest.getDynamicRules()`
- Restore `temporaryAllows` and check expirations
- If expired allow-once entries exist, re-apply blocking rules

#### 7. React state — hooks + Context

Promote `useSettings`, `useTheme`, `useTimerState`, `useFocusMode` to Context providers at the popup/options root. Components consume via hooks; no prop drilling. No new dependencies. See [decisions/ADR-007-react-state.md](decisions/ADR-007-react-state.md).

#### 8. Testing strategy

- **Vitest** + **@testing-library/react** + **happy-dom**
- Mock `chrome.*` APIs with a typed test harness (`src/test/chromeMocks.ts`)
- Test types:
  - Unit: timer FSM, storage adapters, messaging router, focus mode controller
  - Integration: round-trip messaging via mock port
  - Component: popup view states (idle/running/paused/transition), modals
  - End-to-end: optionally Playwright with extension loaded (deferred — not in MVP)
- Coverage target: ≥ 70% lines on `src/background/**` and `src/lib/**`

See [decisions/ADR-006-testing-framework.md](decisions/ADR-006-testing-framework.md).

---

## Migration Approach

**Big-bang rewrite on a feature branch**, with characterization tests written against the current behavior first to lock in what "correct" means.

1. On a new branch, set up Vitest and write characterization tests that exercise the current behavior through the existing `chrome.runtime.sendMessage` API.
2. Build the new architecture from scratch under `src/background/` and `src/shared/`.
3. Reuse React components and most hooks unchanged.
4. Refactor `useTimerState` to use the port-based updates.
5. Migrate React hooks (`useSettings`, `useHistory`, `useTheme`) to use the new typed storage layer.
6. Rebuild the Vite config to compile the SW as a TypeScript entry.
7. Run characterization tests against the new implementation; fix discrepancies.
8. Run a manual smoke test against both Chrome and Firefox builds.
9. Verify storage migration from old schema by loading the new build with a populated old-schema storage state.
10. Merge to main when all tests pass and smoke tests succeed.

See [risk-assessment.md](risk-assessment.md) for risks specific to this approach.

---

## Cross-Browser Considerations

The new architecture preserves the existing browser conditional logic:

| Capability | Chrome | Firefox |
|---|---|---|
| Background | `service_worker` field | `scripts` array |
| Sound | Offscreen Document API | Direct `Audio` constructor |
| Manifest extras | None | `browser_specific_settings.gecko` |
| Build target | `dist/` | `dist-firefox/` |

The Vite manifest transform plugin (already in place) continues to handle this. The new SW source must avoid Chrome-only APIs at module top-level — runtime feature detection via `if (chrome.offscreen)` etc.
