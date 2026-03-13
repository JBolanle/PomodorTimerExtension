# Accessibility Implementation Design

## Overview

Add WCAG 2.1 AA accessibility support to the Pomodoro Timer Extension popup and options pages. The blocked page already has accessibility implemented. This work covers ARIA attributes, screen reader support, keyboard navigation, focus management, reduced motion support, and high contrast mode.

## Approach

Incremental enhancement — modify existing components in-place, add two new shared utilities (Announcer context, useFocusTrap hook), and update global CSS. No component rewrites or wrapper layers.

## Scope

### In Scope
- All popup components (timer display, controls, session dots, modals)
- All options page components (settings, history, navigation)
- Global CSS accessibility utilities
- New: Announcer context provider for status announcements
- New: useFocusTrap hook for modal focus management

### Out of Scope
- Blocked page (already done)
- Background service worker (no UI)
- Color contrast ratio audit (separate follow-up — note that `prefers-contrast: high` support below is a partial measure for border thickness only)

### Global Rule: Decorative Icons
All decorative icon SVGs (Lucide icons used as button adornments) must have `aria-hidden="true"`. This applies everywhere, not just the components explicitly listed below.

---

## Section 1: Global CSS & Utilities

**File:** `src/styles/globals.css`

Additions:
- `.sr-only` class — visually hidden, accessible to screen readers
- `@media (prefers-reduced-motion: reduce)` — disables all animations and transitions
- `@media (prefers-contrast: high)` — thicker borders on interactive elements
- `.focus-ring` utility in `@layer utilities` — consistent focus-visible ring style

---

## Section 2: New Shared Infrastructure

### Announcer Context

**New file:** `src/components/Announcer.tsx`

- `AnnouncerProvider` component wrapping app roots
- `useAnnounce()` hook returning an `announce(text)` function
- Renders a sr-only `aria-live="polite"` div
- Clears then sets message via double `requestAnimationFrame` to ensure re-announcement (more reliable across screen readers than single rAF)

**Integration points:**
- Wrap popup `main.tsx` root with `<AnnouncerProvider>`
- Wrap options `main.tsx` root with `<AnnouncerProvider>`

### Focus Trap Hook

**New file:** `src/hooks/useFocusTrap.ts`

- `useFocusTrap(isActive: boolean, onEscape?: () => void)` returns a `containerRef`
- When active: queries focusable elements, traps Tab/Shift+Tab cycle
- Focuses first focusable element on mount
- Calls `onEscape` callback on Escape key (avoids CustomEvent/React impedance mismatch)
- Cleans up event listeners on unmount/deactivation

---

## Section 3: Timer Display & Controls (Popup)

### TimerDisplay.tsx

- Container: `role="timer"`, `aria-label="{phase} session timer"`
- Visual time: wrap in `<time dateTime="PT{m}M{s}S">`, mark `aria-hidden="true"`
- Add sr-only span (NOT a live region): "{minutes} minutes and {seconds} seconds remaining" — provides static accessible text for screen readers on focus
- Add a **separate** `aria-live="polite"` sr-only div for minute-by-minute announcements. Content: "{minutes} minutes remaining". This div is distinct from the static sr-only span to avoid double-announcement.
- Track `lastAnnounced` minute in state; only update the live region when minutes change and seconds === 0

### TimerControls.tsx

- Start/Pause/Resume: dynamic `aria-label` based on timer state
- Skip button: `aria-label="Skip to {nextPhase}"`
- Reset/End Activity: descriptive `aria-label`
- All icon SVGs: `aria-hidden="true"`

### SessionDots.tsx

- Container: `role="group"`, `aria-label="Work sessions: {completed} of {total} completed"`
- Each dot: `role="img"`, `aria-label="Session {n}: {completed|in progress|not started}"`

### BreakTip.tsx

- "Another tip" button: `aria-label="Show another break tip"`
- Tip content container: `aria-live="polite"` so new tips are announced when refreshed

### CurrentSessionMeta.tsx

- Edit button (Edit2 icon): `aria-label="Edit session note"`
- Done button (Check icon): `aria-hidden="true"` on icon
- All icon SVGs: `aria-hidden="true"`

### Popup Footer (App.tsx)

- Theme cycle button: `aria-label="Switch theme, current: {themeName}"`
- Settings button: `aria-label="Open settings"`

---

## Section 4: Modals

### StartSessionModal.tsx

- Outer container: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to title element (add `id`)
- Close button: `aria-label="Close"`
- Integrate `useFocusTrap(isOpen)`
- Store `document.activeElement` on open, restore focus on close

### ClearHistoryModal.tsx

- Outer container: `role="alertdialog"` (destructive action — use `alertdialog` not `dialog`), `aria-modal="true"`, `aria-labelledby` pointing to title
- Add `aria-describedby` pointing to warning text paragraph (add `id`)
- Integrate `useFocusTrap(isOpen, onClose)`
- Store and restore focus on open/close

### ImportModal.tsx

- Outer container: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to title (add `id`)
- Integrate `useFocusTrap(isOpen, onClose)`
- Store and restore focus on open/close
- File input: ensure label association

### ExportDropdown.tsx

- Trigger button: `aria-haspopup="true"`, `aria-expanded={isOpen}`
- Download icon: `aria-hidden="true"`
- Dropdown menu: `role="menu"`, each item: `role="menuitem"`

---

## Section 5: Options Page — Settings & Navigation

### Sidebar.tsx

- Active nav link: add `aria-current="page"`

### SettingsPage.tsx

- Icon-only buttons (Edit, Delete on presets): add `aria-label`
- Input fields: ensure `htmlFor` label associations
- Radix sliders: add `aria-valuetext` (e.g., "25 minutes")
- Mode toggle: ensure `role="switch"` with `aria-checked` via Radix Switch

### FocusModeSettings.tsx

- Add button (Plus icon): `aria-label="Add custom domain"`
- Delete button (Trash icon): `aria-label="Remove {domain}"`
- Custom domain input: `aria-label="Custom domain to block"`
- Error messages: `aria-live="polite"` region with `aria-describedby`

### HistoryPage.tsx

- Filter controls: `aria-label` on dropdowns
- Import/Export buttons: descriptive `aria-label` if icon-only

### ThemePicker.tsx

- Container: `role="radiogroup"`, `aria-label="Select theme"`
- Each theme button: `role="radio"`, `aria-checked={isActive}`
- Color swatch div: `aria-hidden="true"`

---

## Section 6: Announcer Integration

Wire `useAnnounce()` into components. Timer state transitions are detected via the `useTimerState` hook in `App.tsx`, so announcements should be triggered in `useEffect` blocks watching relevant state changes (e.g., `isRunning`, `phase`), not in click handlers.

### Popup (App.tsx)
- `useEffect` watching `isRunning`: announce "Timer started" / "Timer paused" / "Timer resumed"
- `useEffect` watching `phase`: announce "Break time!" / "Work session started"
- `useEffect` watching session completion: announce "Session completed"

### Options (SettingsPage.tsx)
- `announce('Settings saved')` on setting changes

### Options (HistoryPage.tsx)
- `announce('History cleared')` after clear confirmation

---

## Files Modified

| File | Changes |
|------|---------|
| `src/styles/globals.css` | sr-only, reduced-motion, high-contrast, focus-ring |
| `src/components/Announcer.tsx` | **New** — AnnouncerProvider + useAnnounce |
| `src/hooks/useFocusTrap.ts` | **New** — focus trap hook |
| `src/popup/main.tsx` | Wrap with AnnouncerProvider |
| `src/options/main.tsx` | Wrap with AnnouncerProvider |
| `src/components/timer/TimerDisplay.tsx` | role, aria-label, live region, sr-only time |
| `src/components/timer/TimerControls.tsx` | aria-labels on buttons, aria-hidden on icons |
| `src/components/timer/SessionDots.tsx` | role="group", aria-labels on dots |
| `src/components/timer/StartSessionModal.tsx` | dialog role, focus trap, aria-labelledby |
| `src/components/history/ClearHistoryModal.tsx` | alertdialog role, focus trap, aria-describedby |
| `src/components/history/ImportModal.tsx` | dialog role, focus trap, aria-labelledby |
| `src/components/history/ExportDropdown.tsx` | aria-haspopup, aria-expanded, menu roles |
| `src/components/timer/BreakTip.tsx` | aria-label on button, aria-live on tip content |
| `src/components/timer/CurrentSessionMeta.tsx` | aria-labels on icon buttons |
| `src/popup/App.tsx` | Announcer useEffect calls, footer button aria-labels |
| `src/components/layout/Sidebar.tsx` | aria-current on active link |
| `src/options/pages/SettingsPage.tsx` | aria-labels, htmlFor, aria-valuetext |
| `src/components/settings/FocusModeSettings.tsx` | aria-labels on icon buttons, error live region |
| `src/components/settings/ThemePicker.tsx` | radiogroup role, aria-checked on theme buttons |
| `src/options/pages/HistoryPage.tsx` | aria-labels on filters, announce history cleared |

## Testing

- VoiceOver (Mac): verify all announcements, timer updates, modal focus
- Tab through entire popup and options UI
- Chrome DevTools Accessibility panel audit
- Test with `prefers-reduced-motion: reduce` enabled
- Test with `prefers-contrast: high` enabled
