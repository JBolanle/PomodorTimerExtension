# User Stories & Use Cases

Every user-facing behavior the extension currently supports. These serve as acceptance criteria for any architecture rewrite — all stories must still pass after the rewrite unless explicitly dropped.

Stories marked **(Advanced)** are only available when the app mode is set to "advanced."

---

## Core Timer

### Starting a Session

- **As a user, I can start a work session** by clicking the Start button in the popup. The timer counts down from the preset's work duration (default 25 minutes).
- **As a user, I can see the remaining time** displayed as MM:SS in the popup, updating in real-time.
- **As a user, I can close the popup** and the timer continues running in the background. When I reopen the popup, it shows the correct remaining time.
- **As a user, I see which phase I'm in** (Work, Short Break, Long Break) displayed above the timer.

### Pause & Resume

- **As a user, I can pause a running timer** by clicking Pause. The remaining time is preserved.
- **As a user, I can resume a paused timer** by clicking Resume. The countdown continues from where it stopped.

### Skip & End

- **As a user, I can skip the current phase** to move to the transition screen (suggested next phase).
- **As a user, I can end the entire activity** to reset everything to idle, regardless of current state.

### Timer Completion & Transitions

- **As a user, when a timer completes**, I see a transition screen showing what just finished and what comes next.
- **As a user, I can start the suggested next phase** from the transition screen, or choose a different phase.
- **As a user, I receive a desktop notification** when a timer completes (if notifications are enabled).
- **As a user, I hear a sound** when a timer completes (if sounds are enabled).

### Session Cycling (Pomodoro Method)

- **As a user, the timer automatically suggests short breaks** between work sessions.
- **As a user, after completing N work sessions** (default 4), the timer suggests a long break instead of a short break.
- **As a user, after completing a long break**, the work session counter resets and a new cycle begins.

### Auto-Start

- **As a user, I can enable auto-start** so the next phase begins automatically after a short delay (3 seconds) instead of waiting at the transition screen.

---

## Presets

- **As a user, I have a Default preset** (25/5/15/4) that cannot be deleted.
- **As a user, I can switch between presets** via a dropdown in the popup (only when timer is idle).
- **(Advanced) As a user, I can create custom presets** with my own work/break durations and cycle length.
- **(Advanced) As a user, I can edit existing custom presets** from the options page.
- **(Advanced) As a user, I can delete custom presets** (except Default). If I delete the active preset, it switches to Default.

---

## Focus Mode (Advanced)

### Site Blocking

- **(Advanced) As a user, I can enable focus mode** when starting a work session. Distracting sites are blocked for the duration of the work phase.
- **(Advanced) When I visit a blocked site during focus**, I see a custom blocked page showing the remaining timer time and a motivational message.
- **(Advanced) Focus mode automatically disables** when the work phase ends (completion, skip, or end activity).

### Blocklist Configuration

- **(Advanced) I can toggle predefined blocklist categories**: Social Media, Video, News, Shopping, Gaming.
- **(Advanced) I can add custom domains** to the blocklist.
- **(Advanced) I can remove custom domains** from the blocklist.

### Allow Once

- **(Advanced) From the blocked page, I can "Allow Once"** to temporarily access a blocked site for a configurable duration (default 5 minutes).
- **(Advanced) After the allow-once period expires**, the site is re-blocked automatically.

---

## Session Tracking (Advanced)

### Notes & Tags

- **(Advanced) Before starting a work session**, I see a modal where I can add a note and tags describing what I'll work on.
- **(Advanced) Tags auto-suggest** from my previously used tags.
- **(Advanced) During a session, I can see my current note and tags** displayed in the popup.

### Session Grouping

- **Sessions are automatically grouped** — a session group starts when I begin work and includes all subsequent work/break phases until I end the activity or complete a long break.
- **Each phase within a session records**: type (work/break), planned duration, actual duration, how it ended (completed/skipped/ended), and timestamps.

---

## History & Insights (Advanced)

### Session History

- **(Advanced) I can view my session history** on the options page, showing date, duration, preset used, notes, and tags for each session.
- **(Advanced) I can filter sessions by date**: Today, This Week, This Month, All Time, or a Custom date range.
- **(Advanced) I can filter sessions by tags** using a multi-select tag filter.

### Statistics

- **(Advanced) I can see aggregate statistics**: total focus time, total sessions, and average session length (for the filtered period).
- **(Advanced) I can see a streak counter** showing my current consecutive-day streak.
- **(Advanced) I can see week-over-week trend comparison** showing if I'm doing more or less than last week.
- **(Advanced) I can see a weekly focus chart** (bar chart by day of week).
- **(Advanced) I can see a productive hours heatmap** showing which hours of the day I'm most active.

### Import & Export

- **(Advanced) I can export my sessions as JSON** (includes presets and sessions).
- **(Advanced) I can export my sessions as CSV** (flat format).
- **(Advanced) I can import sessions from a JSON file**, choosing to merge with or replace existing data.
- **(Advanced) I can clear all session history** with a confirmation dialog.

---

## Customization

### Themes

- **I can choose from three themes**: Arctic (light), Obsidian (dark), Ember (warm/golden).
- **The theme applies immediately** across popup and options page.
- **Each theme has unique visual effects**: text shadows, glow effects on session dots, and timer styling.
- **I can cycle through themes** from the popup footer.

### Sounds

- **I hear a notification sound when a timer completes** (if enabled).
- **I can adjust the sound volume** via a slider (0-100%).
- **I can choose different sounds for work vs. break completion** (when per-phase sounds are enabled).
- **Sound works on both Chrome** (via offscreen document API) **and Firefox** (via direct Audio).

### Badge

- **The extension icon shows remaining minutes** as a badge when a timer is running (if enabled).
- **Badge color indicates the phase**: red for work, green for short break, blue for long break.
- **Badge updates every 30 seconds** via a Chrome alarm.

### Mode Toggle

- **I can switch between Simple and Advanced mode** from the options page sidebar.
- **Simple mode** hides: preset management, session notes/tags, focus mode, history/insights page.
- **Advanced mode** shows all features.

### Break Tips

- **During breaks, I see a motivational tip** displayed below the timer (if enabled).

---

## Keyboard Shortcuts

### Global (Browser-Level)

- **Alt+Shift+P**: Open/toggle the popup
- **Alt+Shift+S**: Start or pause the timer
- **Alt+Shift+K**: Skip the current phase

### Popup-Level

- **Space**: Start or pause the timer
- **S**: Skip the current phase
- **R**: Reset / end activity
- **Escape**: Close the popup

---

## Accessibility

- **Screen reader users hear announcements** for timer state changes (start, pause, complete, phase transitions) and periodic time updates via an ARIA live region.
- **All interactive elements have ARIA labels** describing their function.
- **Modals trap focus** so keyboard users can't tab out of the dialog.
- **Previous focus is restored** when a modal closes.
- **Visual indicators are not color-dependent** — states are communicated through text labels, not just color.
- **All features are operable via keyboard** without requiring a mouse.

---

## Cross-Browser Support

- **The extension works on Chrome and Firefox** from the same codebase.
- **Build produces separate outputs**: `dist/` for Chrome, `dist-firefox/` for Firefox.
- **Firefox differences**: uses `background.scripts` instead of `service_worker`, does not use offscreen API for sound (uses direct Audio), includes `browser_specific_settings.gecko`.

---

## Edge Cases & Constraints

- **Maximum 200 sessions stored**. Oldest sessions are dropped when the cap is reached.
- **Tag history capped at 50 entries**. Most recently used tags kept.
- **Popup width fixed at 350px**. Not resizable.
- **Service worker may be killed by the browser** at any time. Timer state survives via storage + Chrome alarms. Focus mode rules survive via Chrome's declarativeNetRequest.
- **Default preset cannot be deleted or renamed.**
