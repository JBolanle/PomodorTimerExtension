# ADR-002: TypeScript Service Worker

**Status**: Accepted

## Context

The current service worker (`public/background/service-worker.js`) is plain JavaScript, copied as-is into the build output. The popup and options page use TypeScript with shared entity types in `src/types/index.ts`. This split has consequences:

- Types are defined on the React side but the SW that owns the data is untyped
- Message payloads have no compile-time validation in either direction
- Refactoring the SW is high-risk because the compiler cannot catch breakage
- Shared constants (e.g., `DEFAULT_PRESET`) must be duplicated between SW and `src/lib/constants.ts`

The alternatives considered:

1. **Full TypeScript SW** — convert to TS, share types/constants with React side
2. **JSDoc type annotations** — keep JS but add JSDoc referencing shared `.d.ts` files
3. **Status quo** — keep plain JS, focus rewrite on decomposition only

## Decision

**Migrate the service worker to TypeScript.** The SW source moves from `public/background/` to `src/background/`. Vite is configured to compile and bundle it into a single file at `dist/background/service-worker.js`.

This requires:
- A new Vite build entry for the SW
- Bundling all imports into a single file (no runtime `import()` — MV3 SWs don't support dynamic imports reliably across browsers)
- Manifest transform updated to point at the new build output
- Removing the legacy file from `public/`

## Consequences

### Positive
- Compile-time type safety across all three execution contexts
- Shared types and constants in `src/shared/` — no more duplication
- Refactoring confidence dramatically improved
- Better IDE support (autocomplete, jump-to-def, rename) for SW code

### Negative
- Vite build configuration becomes more complex
- Bundle size will likely increase modestly (TypeScript helpers, bundling overhead)
- Slightly slower builds
- Cannot live-edit the SW file in browser DevTools as easily (it's now generated)

### Neutral
- All existing SW logic must be ported file-by-file; no behavioral change expected
- Rejected: JSDoc approach. It would solve the type-safety gap with less build complexity but produces a worse developer experience and doesn't enable importing TS modules.
