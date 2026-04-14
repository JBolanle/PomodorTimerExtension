# Architecture Decision Records

Each ADR documents a single architectural decision: the context that prompted it, the decision itself, and its consequences.

## Status Values

- **Proposed** — under discussion
- **Accepted** — decision is in effect
- **Deprecated** — no longer recommended but not actively blocked
- **Superseded** — replaced by a later ADR (link to it)

## Index

| # | Title | Status |
|---|---|---|
| [001](ADR-001-rewrite-architecture.md) | Rewrite architecture, keep feature set | Accepted |
| [002](ADR-002-typescript-sw.md) | TypeScript service worker | Accepted |
| [003](ADR-003-decomposition-strategy.md) | Big-bang rewrite on a branch | Accepted |
| [004](ADR-004-messaging-contract.md) | Typed messaging contract via discriminated union | Accepted |
| [005](ADR-005-storage-abstraction.md) | Storage abstraction + IndexedDB for sessions | Accepted |
| [006](ADR-006-testing-framework.md) | Vitest + Testing Library | Accepted |
| [007](ADR-007-react-state.md) | React state via hooks + Context | Accepted |
| [008](ADR-008-port-based-updates.md) | Port-based updates replace polling | Accepted |

## Adding a New ADR

1. Number sequentially (next would be `ADR-009-...`)
2. Use the same structure: Status / Context / Decision / Consequences
3. Add an entry to the table above
4. If superseding an earlier ADR, update its status to "Superseded by ADR-XXX"
