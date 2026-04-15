# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Chrome/Firefox Manifest-V3 Pomodoro-timer extension. UI: React + Vite + Tailwind + shadcn/ui. Everything is TypeScript end-to-end (including the service worker).

## Development

```bash
bun install                # install dependencies
bun run dev                # vite dev server (HMR for popup/options pages)
bun run build              # Chrome production build → dist/
bun run build:firefox      # Firefox production build → dist-firefox/
bun run build:all          # both
bun run test               # Vitest
bun run test:coverage      # with v8 coverage
```

The build uses `BROWSER=chrome|firefox` (default `chrome`) to transform the manifest. Firefox gets `background.scripts` + `browser_specific_settings.gecko`; Chrome gets `background.service_worker`. Loading:

- **Chrome**: `chrome://extensions` → Developer Mode → Load unpacked → `dist/`
- **Firefox**: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → `dist-firefox/manifest.json`

## Architecture

Three contexts, one contract:

- **Background service worker** (`src/background/`): owns all timer, focus-mode, and session state. Survives popup close. Uses `chrome.alarms` for the timer tick, `chrome.declarativeNetRequest` for focus-mode blocks, `chrome.storage.local` for settings + timer state, and IndexedDB for session history.
- **Popup** (`src/popup/`): ephemeral UI. Subscribes to a long-lived `chrome.runtime.Port` named `'timer-state'`; the SW pushes fresh `TimerState` on every mutation. Between pushes the popup ticks its own display from `endTime` — it is not polling.
- **Options page** (`src/options/`): same state model as the popup. Full settings + history + stats UI with React Router (HashRouter).

Design invariants (enforced by convention, not types):

1. **All timer logic lives in the SW.** The popup is a pure view.
2. **Every message has a typed contract.** `MessageMap` in `src/shared/types` is the single source of truth. `sendMessage<K extends keyof MessageMap>` is the only sanctioned entry point.
3. **No direct `chrome.storage.local` calls** outside `src/background/storage/` and `src/lib/storage/`. Access is through typed `StorageAdapter<K extends StorageKey>` repos.
4. **Sessions live in IndexedDB**, not `chrome.storage.local`. Reactivity across contexts goes through `BroadcastChannel('pomodoro-sessions')` — IDB is same-origin shared across extension contexts, so popup/options read directly without a SW round-trip.
5. **Focus-mode runtime state is persisted.** `focusRuleMap` and `temporaryAllows` are mirrored into `chrome.storage.local` via sanctioned helpers in `src/background/focusMode/persist.ts`. On SW wake, `rehydrateFocusMode()` reconciles the persisted maps against `chrome.declarativeNetRequest.getDynamicRules()`.
6. **Single persistence invariant**: `persistState()` writes to disk *and* broadcasts on the port in one step. On-disk state == last broadcast state.

### Source layout

```
src/
  background/           # Service worker (TypeScript → dist/background/service-worker.js)
    main.ts             # Entry. Wires chrome.runtime / alarms / commands / storage listeners.
    initialize.ts       # Boot: migrations → state restore → rehydrateFocusMode → work-phase recovery.
    state.ts            # Module-singleton timerState, runtime, focusRuleMap, temporaryAllows.
    persist.ts          # persistState() — writes chrome.storage + broadcasts to ports.
    constants.ts        # Focus rule-id range, alarm prefixes, etc.
    timer/              # operations.ts (FSM), completion.ts, cycle.ts (pure math).
    sessions/           # sessionStore.ts (IDB), store.ts (in-memory currentSession lifecycle).
    focusMode/          # controller.ts, ruleManager.ts, persist.ts (write helpers), rehydrate.ts.
    presets/store.ts    # getActivePreset + sync cache.
    messaging/          # router.ts (typed dispatcher), portConnection.ts (port broadcaster).
    storage/            # adapter.ts, schema.ts (STORAGE_DEFAULTS), migrations.ts, repos.ts.
    badge/ notifications/ sound/
  shared/               # Cross-context code. No chrome.* APIs used here.
    types/              # Entities + MessageMap.
    schema/             # StorageSchema.
    constants/          # DEFAULT_PRESET, DEFAULT_SETTINGS, theme list, focus rule-id bounds.
  lib/                  # React-side helpers.
    messaging/client.ts # sendMessage (typed).
    messaging/portClient.ts # subscribeTimerState (reconnect + seed via getState).
    storage/client.ts   # re-exports repos + useStorageValue.
    sessions/client.ts  # re-exports sessionStore + useSessions.
    export.ts import.ts utils.ts errorMessages.ts
  contexts/             # TimerStateProvider, SettingsProvider, ThemeProvider, FocusModeProvider.
  hooks/ components/ popup/ options/ styles/
public/
  background/           # Static assets copied into dist/ (NOT JS — the SW is compiled).
  icons/
```

### Testing

- `src/test/chromeMocks.ts` — in-memory stub of `chrome.*` APIs (runtime, storage, alarms, commands, declarativeNetRequest, notifications, action, offscreen, onConnect). Call `installChromeMocks()` in `beforeEach`.
- IndexedDB is polyfilled via `fake-indexeddb/auto`. A fresh `IDBFactory` is installed per test, so SW module-singletons reopen against a clean DB after `vi.resetModules()`.
- `fireMessage(action, payload)` drives the SW's `chrome.runtime.onMessage` handler; `fireAlarm(name)` drives the alarm handler; `fireConnect(name)` simulates a popup opening the timer-state port.
- Coverage target: ≥70% lines on `src/background/**` and `src/lib/**`.

## Conventions

- **Chrome APIs used**: `alarms`, `storage.local`, `notifications`, `runtime.sendMessage/onMessage/connect/onConnect`, `declarativeNetRequest` (dynamic rules), `commands`, `action` (badge), `offscreen` (Chrome audio).
- **Timer defaults** (`DEFAULT_PRESET`): 25m / 5m / 15m, long break every 4 work sessions.
- **Themes** (three): Arctic (light, default), Obsidian (dark), Ember (warm). Applied via `data-theme` on `<html>`. Per-theme effects (text shadows, session dot glow, ember glow) live in `src/styles/globals.css`.
- **Focus rule IDs** are bounded: `[FOCUS_RULE_ID_BASE, FOCUS_RULE_ID_MAX)` in `src/shared/constants`. Reconciliation only touches dNR rules in this range.
- **UI components** from shadcn/ui live in `src/components/ui/` and are not hand-edited.
- **No plain `.js` source files** outside `public/`. The SW is compiled from `src/background/main.ts` by `vite.sw.config.ts` (IIFE output at `dist/background/service-worker.js`).

## Planning docs

Current architecture is described in [`docs/planning/`](docs/planning/):

- `prd.md`, `architecture.md`, `user-stories.md`, `roadmap.md`, `data-model.md`, `ui-ux-spec.md`
- `decisions/ADR-*.md` — one ADR per major decision (big-bang rewrite, TS SW, storage abstraction, port-based updates, etc.)

The older `docs/*_IMPLEMENTATION.md` files describe the pre-rewrite implementation of specific features. They are retained for historical reference but are **not** authoritative — the planning suite and the code are.
