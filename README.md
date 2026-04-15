# Pomodoro Timer Extension

A Chrome/Firefox Pomodoro timer extension built with **Manifest V3**, TypeScript, React, Vite, Tailwind CSS and shadcn/ui.

Core features:

- Configurable work / short-break / long-break durations (via presets)
- Three themes: **Arctic** (light), **Obsidian** (dark), **Ember** (warm)
- Focus mode: blocks distracting sites (category + custom lists) during work
- Session tracking with notes, tags, history, stats, and CSV/JSON export
- Cross-browser: Chrome (MV3 service worker) + Firefox (MV3 background script)
- No telemetry, no cloud, no accounts — everything is local

## Install & run

```bash
bun install                # install dependencies
bun run dev                # Vite dev server (HMR for popup + options pages)
bun run build              # Chrome production build → dist/
bun run build:firefox      # Firefox production build → dist-firefox/
bun run build:all          # both
bun run test               # Vitest (unit + integration tests)
bun run test:coverage      # Vitest with v8 coverage
```

The build uses a `BROWSER` env var (`chrome` default, `firefox`) to transform the manifest: Firefox gets `background.scripts` instead of `background.service_worker` and the required `browser_specific_settings.gecko`.

Load the extension:

- **Chrome**: `chrome://extensions` → Developer Mode → Load unpacked → pick `dist/`
- **Firefox**: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → pick `dist-firefox/manifest.json`

## Architecture

The extension runs in three contexts with a strict contract between them:

| Context | Role | Source root |
|---|---|---|
| Background service worker | Owns all timer / focus-mode / session state. Persists across popup close. | `src/background/` |
| Popup | Ephemeral UI, subscribes to SW state via a long-lived `chrome.runtime.Port`. | `src/popup/` |
| Options page | Full settings / history / stats UI. Same state source as the popup. | `src/options/` |

Key tenets:

- **The popup is a pure view** — all timer logic lives in the SW.
- **Typed messaging everywhere.** `MessageMap` in `src/shared/types` is the single source of truth for the message contract; `sendMessage` is generic over it.
- **No direct `chrome.storage.local`** outside `src/background/storage/` and `src/lib/storage/`. Access is through typed `StorageAdapter<K>` repos.
- **Sessions live in IndexedDB** (`idb` library; store `sessions` with `by-startedAt` + multiEntry `by-tags` indexes). Unlimited history. SW-to-UI reactivity via `BroadcastChannel('pomodoro-sessions')`.
- **Port-based push**, not polling. The SW broadcasts `TimerState` on every mutation; the popup ticks the display locally between pushes.
- **Focus-mode runtime state is persisted** — `focusRuleMap` and `temporaryAllows` survive SW wake via `chrome.storage.local` + reconciliation against `declarativeNetRequest.getDynamicRules()`.

### Source layout

```
src/
  background/           # Service worker (TypeScript; bundled by vite.sw.config.ts)
    main.ts             # Entry — wires chrome.runtime/alarms/commands/storage listeners
    initialize.ts       # Boot: migrations → state restore → focus-mode rehydrate
    state.ts            # Module-singleton timerState / runtime / focus maps
    persist.ts          # Single invariant: on-disk == broadcast state
    timer/              # FSM (operations), completion handler, cycle helpers
    sessions/           # sessionStore (IDB), closeCurrentSession flow
    focusMode/          # controller, ruleManager, persist, rehydrate
    presets/            # preset CRUD + getActivePreset cache
    messaging/          # typed router + port connection handler
    storage/            # StorageAdapter + migrations + concrete repos
    badge/ notifications/ sound/
  shared/               # Types, schema, constants shared across contexts
    types/              # Entities + MessageMap discriminated union
    schema/             # StorageSchema key registry
    constants/          # DEFAULT_PRESET, DEFAULT_SETTINGS, focus rule-id range, etc.
  lib/                  # React-side helpers
    messaging/          # client.ts (sendMessage), portClient.ts (subscribeTimerState)
    storage/client.ts   # Re-exports repos + useStorageValue hook
    sessions/client.ts  # Re-exports sessionStore + useSessions hook
    export.ts import.ts utils.ts errorMessages.ts
  contexts/             # TimerStateProvider, SettingsProvider, ThemeProvider, FocusModeProvider
  hooks/ components/ popup/ options/ styles/
public/
  background/           # Static assets copied into dist/ (not JS — the SW is compiled)
  icons/                # Extension icons
```

### Testing

Tests run with Vitest + happy-dom and a chrome-API mock harness at `src/test/chromeMocks.ts`. IndexedDB is polyfilled via `fake-indexeddb/auto` with a fresh `IDBFactory` per test. Coverage target: ≥70% lines on `src/background/**` and `src/lib/**`.

## Design docs

The architecture rewrite is documented in [`docs/planning/`](docs/planning/):

- [`prd.md`](docs/planning/prd.md) — product requirements
- [`architecture.md`](docs/planning/architecture.md) — target system shape
- [`user-stories.md`](docs/planning/user-stories.md) — acceptance criteria
- [`roadmap.md`](docs/planning/roadmap.md) — phased migration plan
- [`decisions/`](docs/planning/decisions/) — ADRs for each major choice

Older `docs/*_IMPLEMENTATION.md` files describe the pre-rewrite implementation of individual features and are kept as a historical reference; the planning suite is authoritative for current architecture.
