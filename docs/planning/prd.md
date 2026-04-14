# Product Requirements Document

## Product Vision

A polished, well-maintained, open-source Pomodoro timer extension for Chrome and Firefox that serves as a credible alternative to existing closed-source or ad-supported options. The extension prioritizes reliability, accessibility, and respect for user privacy (no telemetry, no cloud, all data local).

## Target Users

**Primary**: Knowledge workers, students, and developers who want to apply the Pomodoro Technique without leaving their browser, who value:
- A trustworthy open-source alternative to commercial Pomodoro extensions
- A timer that survives popup close (background service worker)
- Optional advanced features without forced complexity

**Secondary**: Contributors looking for a well-architected example of a modern WebExtension built with React, TypeScript, and Manifest V3.

## Feature Set

See [user-stories.md](user-stories.md) for detailed acceptance criteria. Features are categorized by priority for the rewrite:

### Core (must work in all modes)
- Timer state machine: idle → running → paused → transition
- Pomodoro cycle (work / short break / long break with N-cycle long break)
- Default preset, theme switching, notifications, sounds, badge
- Cross-browser support (Chrome + Firefox)
- Accessibility (WCAG 2.1 AA target)
- Keyboard shortcuts (global + popup-level)

### Advanced (gated by mode toggle)
- Custom presets (CRUD)
- Focus mode (site blocker with categories + custom domains, allow-once)
- Session notes & tags
- Session history with date/tag filtering
- Insights: stats, streak, trend, weekly chart, productive hours heatmap
- CSV/JSON import/export

### Out of Scope (explicit non-goals)
- **No cloud sync**: All data stays in `chrome.storage.local` / IndexedDB.
- **No telemetry or analytics**: No tracking of any kind.
- **No accounts or authentication**: The extension is fully usable without identity.
- **No mobile**: Browser extension only; no PWA, no mobile app.
- **No team or collaboration features**: Single-user tool.
- **No ads or paid tier**: Free and open source.

## Non-Functional Requirements

### Performance

| Metric | Target | Rationale |
|---|---|---|
| Popup open time | < 100ms | Should feel instant when clicking toolbar icon |
| Timer accuracy | < 1s drift over 25min | Users notice if a "25 minute" timer is off by more |
| Service worker wake time | < 50ms | Popup polling / port reconnection should not stall |
| Storage write latency | < 10ms typical | State persistence should not block UI |

### Storage

- **chrome.storage.local**: Settings, presets, focus mode config, theme, current timer state, current session, tag history. Stays within the 10MB quota.
- **IndexedDB**: Session history (replaces the current 200-session array cap). Indexed by `startedAt` and `tags` for efficient filtering.

### Browser Support

- **Chrome**: Manifest V3, latest stable + 2 previous versions
- **Firefox**: Manifest V3, latest stable
- **Edge**: Inherited via Chromium compatibility (not separately tested)

### Accessibility

- WCAG 2.1 AA compliance target
- Full keyboard operation (no mouse required)
- Screen reader support via ARIA live regions and labels
- Focus management in modals

### Code Quality (rewrite goals)

| Metric | Target |
|---|---|
| Test coverage (lines) | ≥ 70% |
| Service worker file size | No single file > 300 lines |
| Type safety | 100% — no `any`, no plain JS files |
| Untyped message actions | 0 |
| Build time | < 10s for either browser |

## Success Metrics

The architecture rewrite is successful when:

1. **Feature parity** — every user story in [user-stories.md](user-stories.md) still passes.
2. **Test suite exists** — Vitest + Testing Library set up, ≥70% line coverage on core logic.
3. **Full TypeScript** — service worker is TypeScript; no `.js` source files (excluding generated/config).
4. **Typed messaging** — every message between contexts has a typed contract; `sendMessage` is type-safe end-to-end.
5. **Decomposed service worker** — the monolith is split into focused modules (timer FSM, focus mode, session store, preset store, messaging router, storage adapter), each < 300 lines.
6. **Storage abstraction** — no direct `chrome.storage.local.get/set` calls outside the storage layer.
7. **Event-driven UI updates** — popup uses `chrome.runtime.Port` for state changes; no polling.
8. **Sessions in IndexedDB** — no 200-session cap.
9. **Focus mode persistence** — DNR rule mappings survive service worker restart.
10. **Documentation** — this planning suite stays accurate; ADRs capture the why behind each decision.
