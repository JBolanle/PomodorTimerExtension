# ADR-003: Big-Bang Rewrite on a Branch

**Status**: Accepted

## Context

The architecture rewrite ([ADR-001](ADR-001-rewrite-architecture.md)) can be sequenced in several ways:

1. **Incremental on main** — each phase ships independently; app stays working between phases
2. **Big-bang on a branch** — build the new architecture from scratch on a separate branch; merge when feature parity is verified
3. **Hybrid** — rewrite the SW only, keep React mostly untouched, swap SW in one cutover

The rewrite touches the build pipeline, the messaging contracts, the storage layer, and the SW source location simultaneously. Incremental delivery would require maintaining multiple compatibility shims (typed and untyped messaging, old and new storage adapters, etc.) for the duration of the migration.

## Decision

**Big-bang rewrite on a separate branch.** Build the new architecture from scratch under `src/background/` and `src/shared/`. Verify feature parity via the characterization test suite. Merge to main when all tests pass and manual smoke tests on Chrome and Firefox succeed.

The old branch (`main` at the time of branching) is preserved and tagged as a rollback target.

## Consequences

### Positive
- No compatibility shims — clean slate inside the branch
- Easier to think about: one architecture at a time, not two coexisting
- Faster to complete: no time wasted maintaining two paths
- Branch can be discarded if the rewrite proves unsuccessful

### Negative
- No user-visible progress until merge
- Higher merge risk (large diff)
- If main receives bug fixes during the rewrite, they must be cherry-picked into the branch
- Test coverage must be high before merge — there is no incremental safety net

### Mitigations
- Phase 0 of the rewrite ([roadmap.md](../roadmap.md)) is dedicated to characterization tests written against the current behavior. These tests run unchanged against the new code, locking in feature parity.
- The branch is rebased onto main periodically to keep merge risk manageable.
- Bug fixes on main during the rewrite are kept minimal; non-critical fixes wait for the rewrite merge.
- Rejected: incremental-on-main approach. The number of compatibility shims required (especially for the messaging contract and storage layer changes) would slow progress significantly. Hybrid approach rejected because the React side also needs the new typed messaging client.
