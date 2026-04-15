# Documentation

Two kinds of documents live in here. Know which is which before citing one.

## Authoritative: [`planning/`](./planning/)

The architecture rewrite (branch `rewrite/architecture`) is specified and tracked here:

- [`prd.md`](./planning/prd.md) — product requirements
- [`architecture.md`](./planning/architecture.md) — current system shape
- [`user-stories.md`](./planning/user-stories.md) — acceptance criteria (authoritative feature list)
- [`roadmap.md`](./planning/roadmap.md) — phased migration plan
- [`data-model.md`](./planning/data-model.md) — storage + IDB schemas
- [`ui-ux-spec.md`](./planning/ui-ux-spec.md) — interaction spec
- [`decisions/ADR-*.md`](./planning/decisions/) — one ADR per major decision (rewrite strategy, TS SW, storage abstraction, port-based updates, IDB, focus-mode persistence)

These documents reflect the post-rewrite architecture and should be kept in sync with the code.

## Historical: `*_IMPLEMENTATION.md` and `CROSS_BROWSER_GUIDE.md`

Top-level Markdown files (`ACCESSIBILITY_IMPLEMENTATION.md`, `FOCUS_MODE_IMPLEMENTATION.md`, `SOUND_IMPLEMENTATION.md`, etc.) describe **how individual features were originally built** on top of the pre-rewrite JavaScript service worker (`public/background/service-worker.js`, now removed).

They are retained as a historical reference: useful for understanding *why* a feature exists or what invariants it was designed to preserve, but **not authoritative** for current architecture. Specifically:

- The service worker is now TypeScript under `src/background/`, not `public/background/service-worker.js`.
- Sessions are stored in IndexedDB (see ADR-005), not `chrome.storage.local.sessions`; the 200-session cap no longer exists.
- Popup updates come from a `chrome.runtime.Port` (see ADR-008), not from 500ms polling.
- Focus-mode rules are persisted and rehydrated on SW wake (Phase 6); the "lost on SW restart" caveats in those docs no longer apply.

When current docs and historical docs disagree, trust the planning suite and the code.
