# ADR-006: Vitest + Testing Library for Tests

**Status**: Accepted

## Context

The codebase has zero test coverage. The architecture rewrite ([ADR-003](ADR-003-decomposition-strategy.md)) depends on a characterization test suite to verify feature parity. We need to pick a testing framework before any other phase begins.

Options considered:

1. **Vitest + @testing-library/react** — Vite-native, fast, modern API
2. **Jest + @testing-library/react** — most mature ecosystem, more docs
3. **Defer the decision** — pick later when needed

Constraints:
- The build is already Vite; tooling alignment matters
- Tests run on Node, not in a browser, so `chrome.*` APIs must be mocked
- Need to test both vanilla TypeScript modules (timer FSM, storage adapters) and React components

## Decision

Use **Vitest** as the test runner with **@testing-library/react** for component tests and **happy-dom** as the DOM environment.

A typed Chrome API mock harness lives in `src/test/chromeMocks.ts` and is auto-loaded via Vitest's `setupFiles` config.

Test types:
- **Unit**: timer FSM, storage adapters, focus mode controller, messaging router — direct module tests
- **Integration**: round-trip messaging via mock port; storage migrations
- **Component**: popup view states, modal behavior, settings forms

Coverage target: ≥ 70% lines on `src/background/**` and `src/lib/**`. Components are tested at lower coverage targets — focus on critical paths.

End-to-end testing (Playwright with the extension loaded) is **out of scope** for the rewrite. Manual smoke tests on Chrome and Firefox cover this gap. Playwright can be added post-rewrite.

## Consequences

### Positive
- Vitest shares Vite's config and transform pipeline — minimal duplication
- Fast (Vite-native, parallel by default)
- ESM-first matches our build output
- API is largely Jest-compatible — minimal learning curve
- happy-dom is faster than jsdom and sufficient for our needs

### Negative
- Smaller ecosystem than Jest (most issues are well-documented though)
- Some Jest-specific tooling (e.g., snapshot serializers) may need adaptation

### Neutral
- Chrome API mocking is the same effort regardless of framework
- Rejected: Jest. Mature but introduces a separate config and transform pipeline; Vitest is the better fit for a Vite project.
- Rejected: deferring. The rewrite literally cannot start without test infrastructure (Phase 0 = characterization tests).
