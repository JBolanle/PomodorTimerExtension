# ADR-004: Typed Messaging Contract via Discriminated Union

**Status**: Accepted

## Context

Messages between contexts (popup → SW, options → SW) are currently sent via `chrome.runtime.sendMessage({ action: 'someString', ...payload })`. The `action` field is an untyped string. The response shape is whatever the handler returns. This means:

- Typos in action names compile fine and fail silently at runtime
- Request payload shapes are documented only in the handler implementation
- Response shapes have no type guarantees on the receiving side
- Adding a new message requires changes in 2-3 places with no compiler help

Approaches considered:

1. **Discriminated union `MessageMap` type** — single shared type maps each action to its request and response shapes; `sendMessage<K extends keyof MessageMap>` is fully typed
2. **Per-action typed wrapper functions** (current partial approach) — `startTimer()`, `pauseTimer()`, etc., each typed individually; SW side still untyped
3. **Code generation from a schema** — define messages in JSON schema or similar; generate types and validators
4. **A library like Comlink** — wrap message passing as RPC; auto-typed proxies

## Decision

Define a **`MessageMap` discriminated union** in `src/shared/types/messages.ts`:

```typescript
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

The SW message router takes typed handlers:

```typescript
type Handlers = { [K in keyof MessageMap]: (req: MessageMap[K]['request']) => Promise<MessageMap[K]['response']> };
```

This makes both sides of every message strongly typed and gives compiler errors on:
- Typos in action names
- Wrong payload shape
- Wrong response shape
- Missing handlers

## Consequences

### Positive
- Compile-time safety end-to-end on every message
- Adding a new message: add one entry to `MessageMap`, the compiler tells you everywhere you need to update
- IDE autocomplete on `sendMessage('...')` shows all available actions
- Rename refactoring works across both sides

### Negative
- Runtime payload validation is not automatic — types are erased at runtime
- If the SW and popup are built from different versions (e.g., during incremental rollout), type guarantees can be violated. Not a concern for our deployment model.

### Neutral
- Rejected: code generation. Adds a build step for marginal benefit over a hand-written discriminated union.
- Rejected: Comlink. Heavyweight for our needs and we'd lose visibility into the actual messages flowing.
- Rejected: per-action wrappers only. Doesn't solve the SW-side type gap.
- Optional future enhancement: add runtime validation (Zod schemas keyed off the same `MessageMap`) at message boundaries if drift becomes a concern.
