# ADR-005: Storage Abstraction with Typed Repositories + IndexedDB for Sessions

**Status**: Accepted

## Context

Currently `chrome.storage.local.get/set` calls are scattered throughout the codebase:

- The service worker uses raw calls in `loadState()`, `persistState()`, `getActivePreset()`, focus mode handlers, sound playback, etc.
- React-side hooks (`useSettings`, `useHistory`, `useTheme`) call `chrome.storage.local` directly via thin wrappers in `src/lib/storage.ts`
- Storage keys are string literals; no central registry
- Sessions are stored as a flat array in `chrome.storage.local`, capped at 200 to fit within the 10MB quota

Problems:
- No type safety on stored values
- No coordination between writers (settings written by options, read by SW with no notification)
- Adding a new key requires hunting for all read/write sites
- The 200-session cap prevents long-term history; filtering is O(n) on the full array

## Decision

Implement a **typed storage adapter pattern** for `chrome.storage.local`, and **move sessions to IndexedDB**.

### chrome.storage.local

A `StorageAdapter<T>` class encapsulates each key:

```typescript
class StorageAdapter<T> {
  constructor(key: string, schema: Schema<T>) {}
  async get(): Promise<T>;
  async set(value: T): Promise<void>;
  onChange(callback: (value: T) => void): () => void;
}

const settingsRepo = new StorageAdapter('settings', SettingsSchema);
const presetsRepo = new StorageAdapter('presets', PresetsSchema);
// ... one per key
```

A central registry (`src/background/storage/schema.ts`) lists every key with its schema and default value.

**Architectural rule**: no code outside `src/background/storage/` or `src/lib/storage/` calls `chrome.storage.local` directly. Lint rule or grep check enforces this.

### Sessions → IndexedDB

A new `sessionStore.ts` module backed by IndexedDB:

- Object store: `sessions`, keyPath `id`
- Indexes: `startedAt` (for date filtering), `tags` (multi-entry, for tag filtering)
- Typed query API: `query({ dateRange, tags }) → Session[]`
- Migration: on first run of new version, copy existing `sessions` array from `chrome.storage.local` into IDB, then delete the storage key

**IDB wrapper choice**: use the [`idb`](https://github.com/jakearchibald/idb) library (~1KB, well-maintained, promise-based). Hand-rolling a wrapper is possible but adds maintenance burden for no real benefit.

## Consequences

### Positive
- Type-safe storage access throughout
- Single source of truth for what keys exist and what shape they have
- Sessions can grow indefinitely (limited only by browser storage quota)
- Date and tag filtering becomes index-backed (fast even with thousands of sessions)
- Future migrations follow a predictable pattern

### Negative
- One new dependency (`idb`)
- Storage adapter layer is more code than direct calls (offset by removing scattered calls)
- IndexedDB has more browser quirks than `chrome.storage.local` (handled by `idb`)
- Settings are still split-owned (options writes, SW reads); the adapter pattern makes this explicit but doesn't solve coordination — a separate ADR may be needed if it becomes a problem

### Neutral
- Rejected: chunked `chrome.storage.local` (split sessions across keys by month). Solves the size cap but not the query cost.
- Rejected: hand-rolled IDB wrapper. Reinventing what `idb` already does well.
- Rejected: leaving sessions as-is with the 200 cap. Conflicts with PRD success metrics and is one of the explicit pain points to solve.
