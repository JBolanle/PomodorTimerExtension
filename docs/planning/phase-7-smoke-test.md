# Phase 7 — Manual Smoke-Test Checklist

Run this against a freshly loaded unpacked build in **both** Chrome (`dist/`) and Firefox (`dist-firefox/`). Every box should check before Phase 8 merge.

Build: `bun run build:all`. Load: see README.

A story that reads "**(Advanced)**" requires switching to Advanced mode in the options sidebar first.

---

## 1. Core timer

- [ ] Open popup; click **Start** → timer counts down from 25:00. Phase label reads "Work".
- [ ] Close popup → reopen → time reflects elapsed seconds (not reset, not paused).
- [ ] **Pause**, wait 5s, **Resume** → remaining time preserved; countdown continues from paused value.
- [ ] **Skip** → transition screen shows "just finished: Work" and suggested "Short Break".
- [ ] **End activity** from any state → popup returns to idle with a fresh Start button.
- [ ] Complete a full work phase by waiting it out (use a 1-minute test preset): transition screen appears, sound plays (if enabled), OS notification posts.
- [ ] Complete 4 work phases in a row → 4th suggests **Long Break** (not short).
- [ ] After long break completes, work counter resets to 0.
- [ ] Auto-start: flip the toggle → next phase starts automatically after the 3s transition countdown.

## 2. Presets (Advanced)

- [ ] Default preset exists, is active, cannot be deleted or renamed.
- [ ] **(Advanced)** Create a new preset ("Deep 50/10/20/3"). It appears in the popup dropdown.
- [ ] **(Advanced)** Switch to it while idle → new durations apply on next Start.
- [ ] Starting a work session disables the preset dropdown. Ending/skipping re-enables it.
- [ ] **(Advanced)** Edit the custom preset → changes reflected on next session.
- [ ] **(Advanced)** Delete the active custom preset → active preset reverts to Default.

## 3. Focus mode (Advanced)

- [ ] **(Advanced)** Enable focus mode, toggle "Social Media" category, start a work session.
- [ ] Navigate to `facebook.com` in a new tab → redirected to the blocked page showing remaining timer time.
- [ ] On blocked page, click **Allow Once** with default duration → redirect clears, site loads.
- [ ] After the allow-once window elapses, a fresh tab to the same site is re-blocked.
- [ ] Add a custom domain (`example.com`) → new tab to it is blocked.
- [ ] Remove the custom domain → no longer blocked.
- [ ] **Kill the SW** (Chrome: `chrome://extensions` → "Service worker" → "terminate") mid-work. Open a blocked site → still blocked. Allow-once still works after SW wakes. (Phase 6 exit criterion.)
- [ ] Work phase completes (or user ends activity) → focus mode auto-disables; previously blocked sites load normally.

## 4. Session tracking (Advanced)

- [ ] **(Advanced)** Start a work session → note/tags modal appears. Add "deep-work" tag.
- [ ] Previously used tag suggestions show on the second session.
- [ ] During a work session, popup displays the current note and tags.
- [ ] Complete several sessions → options → History shows them with correct date, duration, note, tags.

## 5. History & insights (Advanced)

- [ ] **(Advanced)** History filters: Today / This Week / This Month / All Time / Custom range — each returns the expected subset.
- [ ] Tag filter multiselect narrows the list by tag intersection/union as expected.
- [ ] Stats: total focus time, total sessions, avg session length update as the filter changes.
- [ ] Streak counter shows consecutive-day count.
- [ ] Week-over-week trend indicator reflects real direction.
- [ ] Weekly bar chart + productive-hours heatmap render without errors.
- [ ] **(Advanced)** Export JSON → file downloads; Import same JSON in merge mode → duplicates skipped. Import in replace mode → history replaced.
- [ ] **(Advanced)** Export CSV → opens cleanly in a spreadsheet.
- [ ] **(Advanced)** Clear history confirms, then empties.

## 6. Sessions beyond 200 (Phase 5 exit)

- [ ] Seed IDB with >200 sessions via export/import (or repeated manual runs). Confirm:
  - history page still paginates/renders
  - export JSON contains all rows
  - filtering by date range uses IDB indexes (no visible lag)

## 7. Migration from legacy storage (Phase 7 deliverable)

- [ ] Take a snapshot of pre-rewrite `chrome.storage.local` (running/paused booleans, sessions array, old settings shape) via `chrome.storage.local.set({...})` in the DevTools console of the *old* build.
- [ ] Load the new build over the same profile. Verify:
  - Timer state is idle (or resumed correctly if the profile was mid-session)
  - Preset derived from old `settings.workMinutes/…` durations
  - `sessions` key removed from `chrome.storage.local`; same sessions visible on the History page (sourced from IDB)
  - `__backup_before_legacy-boolean-state-v1` and `__backup_before_sessions-to-idb-v1` exist in storage
  - `sessionHistory` entries have `plannedDurationMs` / `actualDurationMs` (not `duration`)

## 8. Themes, sound, badge

- [ ] Arctic / Obsidian / Ember — each applies instantly across popup + options.
- [ ] Per-theme effects (timer shadow, session-dot glow, ember glow) render.
- [ ] Cycle-theme button in popup footer cycles all three.
- [ ] Completion sound plays; slider changes volume; per-phase sounds distinct when enabled.
- [ ] Badge shows remaining minutes, color by phase (red/green/blue), updates ≤30s.
- [ ] Toggle badge off → badge clears; toggle back on → reappears.

## 9. Mode toggle

- [ ] Simple mode hides presets / notes+tags / focus mode / history+insights.
- [ ] Advanced mode shows all.
- [ ] Toggle propagates across popup + options immediately (no reload required).

## 10. Keyboard & a11y

- [ ] Global shortcuts: Alt+Shift+P toggles popup; Alt+Shift+S starts/pauses; Alt+Shift+K skips.
- [ ] Popup-level: Space / S / R / Escape behave as documented.
- [ ] Screen reader announces state changes (smoke with VoiceOver or NVDA).
- [ ] Modal focus trap: Tab cycles within the dialog; previous focus restored on close.
- [ ] All interactive elements reachable by keyboard alone.

## 11. Cross-browser deltas

- [ ] Firefox build loads from `dist-firefox/manifest.json` and runs timer → complete cycle.
- [ ] Firefox uses direct `Audio` (no offscreen document). Sounds play.
- [ ] Firefox shows `browser_specific_settings.gecko` present in shipped manifest.
- [ ] Chrome build uses the offscreen document for sounds (verify via `chrome://extensions` → inspect views → "offscreen.html" reachable during playback).

---

## Exit

- All boxes checked on **both** browsers ⇒ Phase 7 complete, ready for Phase 8.
- Any unchecked box ⇒ file it as a blocker issue and do not proceed to merge.
