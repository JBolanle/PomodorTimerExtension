# Roadmap

The architecture rewrite is a **big-bang on a separate branch** (see [ADR-001](decisions/ADR-001-rewrite-architecture.md)). All phases happen on that branch; main remains untouched until merge.

Each phase has explicit deliverables and exit criteria. Phases are sequential — later phases depend on earlier ones — but tasks within a phase can be parallelized.

---

## Phase 0 — Foundation

**Goal**: Lock in current behavior with tests; prove the build pipeline can compile a TypeScript SW.

**Deliverables**:
- Vitest + @testing-library/react + happy-dom installed and configured
- Chrome API mock harness (`src/test/chromeMocks.ts`)
- Characterization test suite covering the current public messaging API (all 19 actions) — calls them in scenarios that match real user flows, asserts on the resulting state and storage
- Build spike: a minimal TypeScript SW (e.g., just the message router shell) compiles via Vite to a single bundled JS file and loads in both Chrome and Firefox
- This planning doc suite committed to `docs/planning/`

**Exit criteria**: Tests pass against the current SW. The TS-built SW shell loads successfully in both browsers.

---

## Phase 1 — Shared Foundation

**Goal**: Establish the shared types, schema, and constants layer that both contexts will import.

**Deliverables**:
- `src/shared/types/` — entity types + `MessageMap` discriminated union (covers all 19 actions)
- `src/shared/schema/` — storage key registry with per-key schemas
- `src/shared/constants/` — single-source `DEFAULT_PRESET`, theme list, etc. (replaces duplicate definitions)
- `src/lib/messaging/client.ts` — typed `sendMessage<K extends keyof MessageMap>(action, payload)` for React side
- Update existing React hooks to use the typed messaging client where possible (without changing behavior)

**Exit criteria**: All current React-side messaging compiles through the typed client. No `string` action names in `sendMessage` calls.

---

## Phase 2 — Storage Abstraction

**Goal**: Replace all direct `chrome.storage.local` calls with typed repository access.

**Deliverables**:
- `src/background/storage/adapter.ts` — `StorageAdapter<T>` class
- `src/background/storage/schema.ts` — schema definitions
- `src/background/storage/migrations.ts` — versioned migrations (port the existing migration in `loadState()`, structure for future migrations)
- Concrete repos: `settingsRepo`, `presetsRepo`, `themeRepo`, `focusModeRepo`, `tagHistoryRepo`, `timerStateRepo`, `currentSessionRepo`
- Update React hooks (`useSettings`, `useTheme`, `useHistory`) to use a parallel typed storage client (`src/lib/storage/client.ts`)
- Backup-before-migrate behavior on first run

**Exit criteria**: Grep for `chrome.storage.local` returns matches only inside the storage layer modules. Characterization tests still pass.

---

## Phase 3 — Service Worker Decomposition (TypeScript)

**Goal**: Split the monolith into focused TypeScript modules.

**Deliverables**:
- `src/background/main.ts` — entry point
- `src/background/timer/` — FSM, operations, completion handler
- `src/background/sessions/` — grouping logic, session store (still chrome.storage at this phase; IDB in Phase 5)
- `src/background/presets/` — preset CRUD
- `src/background/focusMode/` — controller, rule manager
- `src/background/messaging/router.ts` — typed dispatcher
- `src/background/messaging/portConnection.ts` — port handler (push behavior in Phase 4)
- `src/background/notifications/`, `src/background/sound/`, `src/background/badge/`
- Vite config updated to build the SW as a TypeScript entry; `public/background/service-worker.js` deleted
- Manifest transform updated to point at the new build output

**Exit criteria**: Service worker is fully TypeScript. No file in `src/background/**` exceeds 300 lines. Characterization tests still pass on the new SW.

---

## Phase 4 — React Side Refactor

**Goal**: Apply Context providers, switch popup to port-based updates, fix prop drilling.

**Deliverables**:
- Context providers: `TimerStateProvider`, `SettingsProvider`, `ThemeProvider`, `FocusModeProvider` (mounted at popup and options roots)
- `src/lib/messaging/portClient.ts` — popup-side port consumer with reconnect logic
- `useTimerState` rewritten to use port; local ticking display between push updates
- Remove polling-related code
- Component refactor: hooks consume context instead of receiving props from parent
- Loading and error states standardized via context

**Exit criteria**: No `setInterval`-based polling. Popup updates from port pushes. No prop drilling for timer/settings/theme state.

---

## Phase 5 — IndexedDB for Sessions

**Goal**: Move session storage to IndexedDB to remove the 200-cap.

**Deliverables**:
- `src/background/sessions/sessionStore.ts` — IndexedDB-backed store with `query({ dateRange, tags })` API
- IDB wrapper choice committed (native + thin wrapper, or `idb` library) — see [ADR-005](decisions/ADR-005-storage-abstraction.md)
- Migration: copy existing `sessions` array from `chrome.storage.local` to IDB on first run, then delete the storage key
- Update `useHistory` to consume from a new typed query API (via SW message or direct IDB read — decide in implementation)
- Update export/import to work with the IDB-backed store

**Exit criteria**: Sessions can grow beyond 200. Filtering by date and tags uses IDB indexes. Existing session data migrates without loss.

---

## Phase 6 — Focus Mode Persistence Fix

**Goal**: Fix the long-standing bug where focus mode in-memory state is lost on SW restart.

**Deliverables**:
- Persist `focusRuleMap` and `temporaryAllows` to storage on every modification
- On SW wake: reconcile persisted map with `chrome.declarativeNetRequest.getDynamicRules()`; prune orphans
- On SW wake: check `temporaryAllows` expirations; re-block expired entries
- Test: SW kill scenario verifies state survives correctly

**Exit criteria**: Killing the SW mid-session does not break focus mode rule management.

---

## Phase 7 — Verification & Polish

**Goal**: Confirm everything works end-to-end before merge.

**Deliverables**:
- Full characterization test suite passes against the new architecture
- Manual smoke test on Chrome (load `dist/`, exercise every feature in [user-stories.md](user-stories.md))
- Manual smoke test on Firefox (load `dist-firefox/`, exercise every feature)
- Migration test: load build with a snapshot of legacy storage state; verify no data loss
- Bundle size check: SW build < 100KB
- Test coverage check: ≥ 70% on `src/background/**` and `src/lib/**`
- README and CLAUDE.md updated for the new architecture
- Existing implementation docs in `docs/` reviewed; outdated references corrected

**Exit criteria**: All success metrics in [prd.md](prd.md) are met.

---

## Phase 8 — Merge & Cleanup

**Goal**: Merge the rewrite to main; archive the old code.

**Deliverables**:
- Tag the last pre-rewrite commit on main as `pre-rewrite-final` for rollback reference
- Squash-merge or rebase-merge the rewrite branch
- Release notes documenting: architecture changes, new test infrastructure, migration behavior, rollback plan
- Delete the rewrite branch
- Update the planning docs with any deltas discovered during implementation

**Exit criteria**: Main builds, tests pass, both browser builds load and function correctly.

---

## Phase Dependencies

```
Phase 0  ──→  Phase 1  ──→  Phase 2  ──→  Phase 3  ──→  Phase 4  ──→  Phase 7  ──→  Phase 8
                                                ↓
                                            Phase 5
                                                ↓
                                            Phase 6
```

Phases 5 and 6 can be done in parallel with Phase 4 once Phase 3 is complete (different parts of the codebase).

---

## Out of Scope for the Rewrite

These are deliberately deferred to follow-up work:

- Playwright end-to-end tests (manual smoke testing only for the rewrite)
- New features (themes, sync, etc.) — see ADR-001
- CI/CD pipeline (set up after the rewrite stabilizes)
- Performance benchmarking infrastructure beyond the bundle size check
