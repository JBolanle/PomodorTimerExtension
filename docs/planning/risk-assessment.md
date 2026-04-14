# Risk Assessment

Risks specific to rewriting a working Manifest V3 browser extension on a separate branch (big-bang approach).

---

## High Severity

### R-1: Feature regression with no test safety net

**Description**: The current codebase has zero tests. A big-bang rewrite without first capturing existing behavior risks silent regressions in edge cases (timer drift handling, migration paths, focus mode state recovery, cycle counting after long break).

**Likelihood**: High
**Impact**: High — users notice broken timers immediately

**Mitigation**:
- **Phase 0 of the rewrite is mandatory**: write characterization tests against the current behavior before touching any architecture. These tests exercise the public surface (messaging API, storage state) so they remain valid through the rewrite.
- Manual smoke-test checklist for both Chrome and Firefox before merging.
- Keep the old branch available as a rollback target until 1-2 weeks of real-world use confirm stability.

### R-2: Storage migration data loss

**Description**: Existing users have data in `chrome.storage.local`. The new architecture changes:
- Sessions move to IndexedDB
- Storage adapter validates schemas (may reject malformed legacy data)
- Focus mode rule map gains a persisted shape

If migration fails or runs partially, users could lose history, presets, or settings.

**Likelihood**: Medium
**Impact**: High — irreversible data loss

**Mitigation**:
- Versioned schema with migration functions (`migrations.ts` module).
- On first run of the new build, snapshot the entire `chrome.storage.local` state to a backup key (`__migration_backup_v1`) before applying any migration.
- Migration must be idempotent and tested with realistic legacy fixtures (200 sessions, multiple presets, all settings populated).
- Provide an export-before-update prompt in the release notes.

### R-3: Service worker lifecycle bugs

**Description**: MV3 service workers can be killed at any time. The rewrite's new modules must handle this correctly. The current focus mode persistence bug (R-7 below) is one example; others may emerge if module-level state is added during the rewrite.

**Likelihood**: Medium
**Impact**: High — broken state recovery is hard to debug

**Mitigation**:
- Architectural rule: no module-level mutable state in `src/background/**` outside the storage adapters.
- Test: simulate SW restart by re-importing modules in tests, verify state recovery.
- Document the lifecycle contract for each module (what survives restart, what does not).

---

## Medium Severity

### R-4: Vite SW build complexity

**Description**: The current SW is plain JS copied as-is. Bundling TypeScript + multiple modules into a single MV3-compatible SW file requires Vite config changes that are not trivial. Risks: bundling errors, accidental dynamic imports (forbidden in MV3 SWs in some browsers), polyfills bloating the bundle.

**Likelihood**: Medium
**Impact**: Medium — blocks the rewrite until resolved

**Mitigation**:
- Spike the build config first (Phase 0). Get a "hello world" TypeScript SW building and loading before writing any feature code.
- Use Vite's `build.rollupOptions.input` with a separate config object to control SW output.
- Configure `format: 'iife'` to ensure no `import()` statements in output.
- Verify in both Chrome and Firefox.

### R-5: Cross-browser regressions

**Description**: Firefox and Chrome have subtle MV3 differences. The current code handles them; the rewrite must preserve all conditional logic. Specific risks:
- Firefox doesn't support `chrome.offscreen` — sound playback path differs
- Firefox's `declarativeNetRequest` has different rule ID ranges
- `chrome.runtime.Port` semantics differ slightly between browsers
- Firefox MV3 still evolving — APIs may behave unexpectedly

**Likelihood**: Medium
**Impact**: Medium — breaks one browser silently

**Mitigation**:
- Smoke-test on both browsers after every significant module is rewritten.
- Keep all Chrome-specific code behind runtime feature checks (`if (chrome.offscreen)`).
- Add a CI step (eventually) to load the extension headlessly in both browsers.

### R-6: Port disconnect handling

**Description**: Switching from polling to `chrome.runtime.Port` introduces new failure modes:
- Port disconnects when SW dies; popup must reconnect
- Race conditions during reconnect (state changes missed in the gap)
- Multiple popups (popup + options page) opening ports simultaneously

**Likelihood**: Medium
**Impact**: Medium — UI shows stale state silently

**Mitigation**:
- On reconnect, popup fetches fresh state via one-shot `getState` before relying on push.
- SW maintains a `connectedPorts: Set<Port>` and broadcasts to all on state change.
- Test: kill the SW (via chrome://serviceworker-internals or `chrome.runtime.reload`), verify popup reconnects and shows correct state.

### R-7: Focus mode persistence bug (existing, must not regress)

**Description**: Already documented in [data-model.md](data-model.md). The current `focusRuleMap` and `temporaryAllows` are lost on SW restart, leaving DNR rules orphaned. The rewrite is the opportunity to fix this — but if the fix is incorrect, focus mode could become unreliable.

**Likelihood**: High (the bug exists today; the rewrite must fix it correctly)
**Impact**: Medium — focus mode behavior becomes unpredictable

**Mitigation**:
- Persist the rule map to storage on every modification.
- On SW wake: reconcile persisted map with `chrome.declarativeNetRequest.getDynamicRules()` and prune any orphans.
- Persist `temporaryAllows` with absolute expiry timestamps; check expiry on wake.
- Add a specific test scenario: enable focus mode → kill SW → verify rules and map remain consistent.

---

## Low Severity

### R-8: IndexedDB browser quirks

**Description**: IndexedDB has well-known quirks across browsers (Safari historically; Firefox private mode has limits). The migration from a flat array also adds a one-time upgrade step that could fail.

**Likelihood**: Low
**Impact**: Low — affects only history feature
**Mitigation**: Use a thin wrapper (`idb` or hand-rolled). Test in both browsers. If IDB unavailable, fall back to current array storage with a warning.

### R-9: Scope creep

**Description**: A from-scratch rewrite invites "while we're at it" feature additions (new themes, new charts, sync, etc.) that delay completion and increase regression risk.

**Likelihood**: Medium
**Impact**: Low — slows progress but doesn't break anything
**Mitigation**:
- ADR-001 explicitly states "rewrite architecture, keep features." Reference it when tempted.
- Maintain a separate "post-rewrite ideas" doc for new feature thoughts.
- Resist scope changes during the rewrite branch; defer to follow-up PRs.

### R-10: Bundle size growth

**Description**: TypeScript + module bundling in the SW could produce a larger output than the current hand-written JS. MV3 SWs have no hard size limit but larger SWs cold-start slower.

**Likelihood**: Low
**Impact**: Low — slower SW wake-up
**Mitigation**:
- Track SW bundle size as a build artifact; set a soft limit (e.g., 100KB).
- Use Vite's tree shaking; avoid large dependencies in SW code.
- Profile cold-start time before and after; document in success metrics.

### R-11: Documentation drift

**Description**: This planning suite (PRD, architecture, ADRs, etc.) becomes stale if not maintained alongside the code.

**Likelihood**: High
**Impact**: Low — confuses future contributors
**Mitigation**:
- Update the relevant doc as part of the same PR that changes the underlying behavior.
- The Roadmap doc has explicit "update docs" steps in each phase.

---

## Risk Acceptance

The big-bang rewrite approach was chosen with these risks in mind. The largest mitigations are:

1. **Phase 0 characterization tests** address R-1 (regression risk).
2. **Storage backup before migration** addresses R-2 (data loss).
3. **Build spike first** addresses R-4 (build complexity).
4. **Keep the old branch** for rollback addresses R-1, R-3, R-5 simultaneously.

All other risks are within acceptable tolerance for a personal/community open-source project.
