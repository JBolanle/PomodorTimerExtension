# ADR-001: Rewrite Architecture, Keep Feature Set

**Status**: Accepted

## Context

The Pomodoro Timer Extension has a mature, stable user-facing feature set that the maintainer is satisfied with. The underlying architecture, however, has accumulated significant debt:

- 1,068-line untyped JavaScript service worker
- No message contracts between contexts
- No tests
- Storage access scattered with no abstraction
- Known bugs (focus mode persistence, 200-session cap)

The question is: do we incrementally improve, or rewrite?

## Decision

We will **rewrite the architecture** while **preserving the current feature set exactly**. No new user-facing features will be added during the rewrite. The rewrite will happen on a separate branch (big-bang approach — see [ADR-003](ADR-003-decomposition-strategy.md)).

The rewrite is bounded by [user-stories.md](../user-stories.md): every story listed there must still pass after the rewrite. Any feature not listed there is out of scope and not added.

## Consequences

### Positive
- Clear scope boundary — easy to say "no" to scope creep
- Acceptance criteria are explicit (the user stories doc)
- Users see no functional change, only stability/quality improvements over time
- Rewrite can be tested against a known-good behavior baseline

### Negative
- No user-visible improvements during the rewrite period
- Any latent bugs in the current behavior get codified into characterization tests and re-implemented as-is (unless explicitly identified for fix during rewrite)
- Maintainer motivation must be sustained without new-feature dopamine

### Neutral
- Bug fixes that come "for free" with the new architecture (e.g., focus mode persistence) are allowed and encouraged
- Post-rewrite, new features can be built on the improved foundation
