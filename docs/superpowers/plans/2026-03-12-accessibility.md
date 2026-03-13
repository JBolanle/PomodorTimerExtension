# Accessibility Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add WCAG 2.1 AA accessibility to the Pomodoro Timer Extension popup and options pages.

**Architecture:** Incremental enhancement of existing components with ARIA attributes, plus two new shared utilities (Announcer context, useFocusTrap hook). No component rewrites — all changes are additive.

**Tech Stack:** React, TypeScript, Tailwind CSS, Radix UI primitives, Lucide icons

**Spec:** `docs/superpowers/specs/2026-03-12-accessibility-design.md`

**Global rule:** All decorative Lucide icon SVGs must have `aria-hidden="true"` added wherever they appear.

**No test framework is configured.** Testing is manual (VoiceOver, Chrome DevTools Accessibility panel, keyboard navigation). Each task ends with `bun run build` to verify no build errors.

---

## Chunk 1: Foundation & Infrastructure

### Task 1: Global CSS accessibility utilities

**Files:**
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Add sr-only class**

Add at the **end of the file** (after line 219, after the noise texture overlay block):

```css
/* ─── Accessibility utilities ─── */

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

- [ ] **Step 2: Add focus-ring utility**

Add immediately after the `.sr-only` block:

Note: This project uses Tailwind CSS v4. The `@layer utilities` + `@apply` pattern may not work in v4. If build fails, use plain CSS instead:

```css
.focus-ring {
  outline: none;
}
.focus-ring:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}
```

Try the `@apply` version first; fall back to plain CSS if it errors:

```css
@layer utilities {
  .focus-ring {
    @apply focus-visible:outline-none focus-visible:ring-2
           focus-visible:ring-offset-2 focus-visible:ring-ring;
  }
}
```

- [ ] **Step 3: Add reduced motion support**

Add after the focus-ring utility:

```css
/* ─── Reduced motion ─── */

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 4: Add high contrast support**

Add after the reduced motion block:

```css
/* ─── High contrast ─── */

@media (prefers-contrast: high) {
  :root {
    --border: 0 0% 0%;
  }

  button, input, select, textarea {
    border-width: 2px;
  }
}
```

- [ ] **Step 5: Verify build**

Run: `bun run build`
Expected: Build succeeds with no errors.

- [ ] **Step 6: Commit**

```bash
git add src/styles/globals.css
git commit -m "feat(a11y): add sr-only, focus-ring, reduced motion, and high contrast CSS utilities"
```

---

### Task 2: Announcer context provider

**Files:**
- Create: `src/components/Announcer.tsx`
- Modify: `src/popup/main.tsx`
- Modify: `src/options/main.tsx`

- [ ] **Step 1: Create Announcer.tsx**

Create `src/components/Announcer.tsx`:

```tsx
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

const AnnouncerContext = createContext<((text: string) => void) | null>(null);

export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');

  const announce = useCallback((text: string) => {
    setMessage('');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setMessage(text);
      });
    });
  }, []);

  return (
    <AnnouncerContext.Provider value={announce}>
      {children}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {message}
      </div>
    </AnnouncerContext.Provider>
  );
}

export function useAnnounce() {
  const announce = useContext(AnnouncerContext);
  if (!announce) {
    throw new Error('useAnnounce must be used within AnnouncerProvider');
  }
  return announce;
}
```

- [ ] **Step 2: Wrap popup root with AnnouncerProvider**

In `src/popup/main.tsx`, add import and wrap:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/jetbrains-mono";
import "@/styles/globals.css";
import { AnnouncerProvider } from "@/components/Announcer";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AnnouncerProvider>
      <App />
    </AnnouncerProvider>
  </StrictMode>,
);
```

- [ ] **Step 3: Wrap options root with AnnouncerProvider**

In `src/options/main.tsx`, same pattern — add `AnnouncerProvider` import and wrap `<App />`.

- [ ] **Step 4: Verify build**

Run: `bun run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/Announcer.tsx src/popup/main.tsx src/options/main.tsx
git commit -m "feat(a11y): add AnnouncerProvider for screen reader status announcements"
```

---

### Task 3: Focus trap hook

**Files:**
- Create: `src/hooks/useFocusTrap.ts`

- [ ] **Step 1: Create useFocusTrap.ts**

Create `src/hooks/useFocusTrap.ts`:

```ts
import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function useFocusTrap(isActive: boolean, onEscape?: () => void) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    firstElement?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && onEscape) {
        e.preventDefault();
        onEscape();
        return;
      }

      if (e.key !== 'Tab') return;

      // Re-query in case DOM changed
      const elements = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      const first = elements[0];
      const last = elements[elements.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [isActive, onEscape]);

  return containerRef;
}
```

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useFocusTrap.ts
git commit -m "feat(a11y): add useFocusTrap hook for modal focus management"
```

---

## Chunk 2: Popup Components

### Task 4: TimerDisplay accessibility

**Files:**
- Modify: `src/components/timer/TimerDisplay.tsx`

- [ ] **Step 1: Add accessibility to TimerDisplay**

Rewrite the component's return JSX and add state for live announcements. The component needs new imports (`useState`, `useEffect`) and a `phase` label. Here is the full updated file:

```tsx
import { useState, useEffect } from 'react';
import { formatTime } from '@/lib/utils';
import type { TimerMode, TimerStateEnum, Preset } from '@/types';

const PHASE_LABELS: Record<TimerMode, string> = {
  work: 'Work',
  shortBreak: 'Short Break',
  longBreak: 'Long Break',
};

interface TimerDisplayProps {
  remainingSeconds: number;
  mode: TimerMode;
  timerState: TimerStateEnum;
  activePreset: Preset;
  suggestedNext: TimerMode | null;
}

function getDefaultSeconds(mode: TimerMode, preset: Preset): number {
  switch (mode) {
    case 'work':
      return preset.workMinutes * 60;
    case 'shortBreak':
      return preset.shortBreakMinutes * 60;
    case 'longBreak':
      return preset.longBreakMinutes * 60;
  }
}

export function TimerDisplay({ remainingSeconds, mode, timerState, activePreset, suggestedNext }: TimerDisplayProps) {
  let displaySeconds: number;

  switch (timerState) {
    case 'running':
    case 'paused':
      displaySeconds = remainingSeconds;
      break;
    case 'transition':
      displaySeconds = suggestedNext ? getDefaultSeconds(suggestedNext, activePreset) : 0;
      break;
    case 'idle':
    default:
      displaySeconds = getDefaultSeconds(mode, activePreset);
      break;
  }

  const formatted = formatTime(displaySeconds);
  const [minutesStr, secondsStr] = formatted.split(':');
  const minutes = Math.floor(displaySeconds / 60);
  const seconds = displaySeconds % 60;

  const [lastAnnounced, setLastAnnounced] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    if (timerState === 'running' && minutes !== lastAnnounced && seconds === 0 && minutes > 0) {
      setAnnouncement(`${minutes} minutes remaining`);
      setLastAnnounced(minutes);
    }
  }, [timerState, minutes, seconds, lastAnnounced]);

  useEffect(() => {
    if (timerState !== 'running') {
      setLastAnnounced(null);
      setAnnouncement('');
    }
  }, [timerState]);

  const phaseLabel = PHASE_LABELS[timerState === 'transition' && suggestedNext ? suggestedNext : mode];

  return (
    <div
      className="timer-wrap flex items-center justify-center py-6 select-none"
      role="timer"
      aria-label={`${phaseLabel} session timer`}
    >
      <time
        className="flex items-center"
        dateTime={`PT${minutes}M${seconds}S`}
        aria-hidden="true"
      >
        <span className="timer-text text-7xl font-bold tracking-tight tabular-nums">
          {minutesStr}
        </span>
        <span className="timer-text text-7xl font-bold tracking-tight colon-pulse mx-0.5">
          :
        </span>
        <span className="timer-text text-7xl font-bold tracking-tight tabular-nums">
          {secondsStr}
        </span>
      </time>

      <span className="sr-only">
        {minutes} minutes and {seconds} seconds remaining
      </span>

      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/timer/TimerDisplay.tsx
git commit -m "feat(a11y): add timer role, sr-only time text, and live minute announcements"
```

---

### Task 5: TimerControls accessibility

**Files:**
- Modify: `src/components/timer/TimerControls.tsx`

- [ ] **Step 1: Add aria-labels to all buttons**

The buttons already have visible text ("Start", "Pause", "Resume", "Skip", "End Activity"), so we primarily need `aria-label` on context-dependent buttons. Update the component:

For the idle state Start button (line 34), add `aria-label="Start timer"`:
```tsx
<Button size="lg" className="min-w-[120px] btn-press" onClick={onStart} aria-label="Start timer">
```

For the transition state "Start {nextLabel}" button (line 45), add `aria-label`:
```tsx
<Button size="lg" className="min-w-[120px] btn-press" onClick={onStartNext} aria-label={`Start ${nextLabel}`}>
```

For the transition state "End Activity" button (line 48-53), add `aria-label="End activity"`.

For the running/paused Pause/Resume button (lines 63-67), add dynamic aria-label:
```tsx
<Button
  size="lg"
  className="min-w-[120px] btn-press"
  onClick={timerState === 'running' ? onPause : onResume}
  aria-label={timerState === 'running' ? 'Pause timer' : 'Resume timer'}
>
```

For the Skip button (lines 71-77), add a dynamic aria-label. The component needs to compute the next phase from `suggestedNext`:
```tsx
<Button
  variant="ghost"
  size="sm"
  className="text-xs text-muted-foreground"
  onClick={onSkip}
  aria-label={`Skip to ${suggestedNext ? PHASE_LABELS[suggestedNext] : 'next phase'}`}
>
```
Note: `PHASE_LABELS` is already defined at the top of the file.

For the End Activity button (lines 79-86), add `aria-label="End activity"`.

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/timer/TimerControls.tsx
git commit -m "feat(a11y): add aria-labels to timer control buttons"
```

---

### Task 6: SessionDots accessibility

**Files:**
- Modify: `src/components/timer/SessionDots.tsx`

- [ ] **Step 1: Add group role and dot labels**

Update `SessionDots` to add `role="group"` with `aria-label` and label each dot. The component also needs to know `currentPhase` and `timerState` to determine "in progress" state. Update the interface and usage:

```tsx
import { cn } from '@/lib/utils';
import type { TimerMode, TimerStateEnum } from '@/types';

interface SessionDotsProps {
  completedSessions: number;
  total: number;
  currentPhase?: TimerMode;
  timerState?: TimerStateEnum;
}

export function SessionDots({ completedSessions, total, currentPhase, timerState }: SessionDotsProps) {
  const filledCount = completedSessions % total;

  function getDotLabel(index: number): string {
    if (index < filledCount) return `Session ${index + 1}: completed`;
    if (index === filledCount && currentPhase === 'work' && (timerState === 'running' || timerState === 'paused'))
      return `Session ${index + 1}: in progress`;
    return `Session ${index + 1}: not started`;
  }

  return (
    <div
      className="flex items-center gap-2"
      role="group"
      aria-label={`Work sessions: ${filledCount} of ${total} completed`}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          role="img"
          aria-label={getDotLabel(i)}
          className={cn(
            'h-2.5 w-2.5 rounded-full transition-all',
            i < filledCount
              ? 'bg-primary session-dot-active'
              : 'bg-muted-foreground/25'
          )}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Update SessionDots usage in popup App.tsx**

In `src/popup/App.tsx`, update the `<SessionDots>` usage (around line 177) to pass the new props:

```tsx
<SessionDots
  completedSessions={workSessionsCompleted}
  total={activePreset.sessionsBeforeLongBreak}
  currentPhase={currentPhase}
  timerState={timerState}
/>
```

- [ ] **Step 3: Check if SessionDots is used in options TimerPage.tsx and update there too**

Search for other usages and update them the same way.

- [ ] **Step 4: Verify build**

Run: `bun run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/timer/SessionDots.tsx src/popup/App.tsx
git commit -m "feat(a11y): add group role and descriptive labels to session dots"
```

---

### Task 7: BreakTip and CurrentSessionMeta accessibility

**Files:**
- Modify: `src/components/timer/BreakTip.tsx`
- Modify: `src/components/timer/CurrentSessionMeta.tsx`

- [ ] **Step 1: Update BreakTip.tsx**

Add `aria-live="polite"` to the tip content container and `aria-label` to the button:

```tsx
return (
  <div className="w-full px-3 py-2 rounded-md bg-muted/50 text-center space-y-1">
    <p className="text-sm" aria-live="polite">
      <span className="mr-1" aria-hidden="true">{tip.emoji}</span>
      {tip.text}
    </p>
    <button
      onClick={refresh}
      aria-label="Show another break tip"
      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      Another tip
    </button>
  </div>
);
```

- [ ] **Step 2: Update CurrentSessionMeta.tsx**

Add `aria-label` to the Edit button and `aria-hidden` to icons.

For the edit button (line 59), add `aria-label="Edit session note"`.

For the `<Edit2>` icon on line 60, add `aria-hidden="true"`.

For the `<Check>` icon on line 35, add `aria-hidden="true"`.

For the "Add note or tags" button's `<Edit2>` icon on line 68, add `aria-hidden="true"`.

- [ ] **Step 3: Verify build**

Run: `bun run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/timer/BreakTip.tsx src/components/timer/CurrentSessionMeta.tsx
git commit -m "feat(a11y): add aria-labels and aria-hidden to break tip and session meta"
```

---

### Task 8: Popup App.tsx — footer labels and announcer integration

**Files:**
- Modify: `src/popup/App.tsx`

- [ ] **Step 1: Add aria-labels to footer buttons**

For the theme cycle button (around line 186-193), add `aria-label`:
```tsx
<Button
  variant="ghost"
  size="sm"
  onClick={cycleTheme}
  className="text-xs text-muted-foreground"
  aria-label={`Switch theme, current: ${THEME_META[theme].label}`}
>
```

For the Settings button (around line 194-200), add `aria-label="Open settings"`.

For the focus mode indicator SVG (line 159), add `aria-hidden="true"`.

- [ ] **Step 2: Add announcer integration**

Add `useAnnounce` import and `useEffect` blocks for state announcements. Add after the existing hooks:

```tsx
import { useAnnounce } from '@/components/Announcer';

// Inside App component, after other hooks:
const announce = useAnnounce();

// Track previous state to detect transitions
const prevStateRef = useRef(timerState);
const prevPhaseRef = useRef(currentPhase);

useEffect(() => {
  const prevState = prevStateRef.current;
  prevStateRef.current = timerState;

  if (prevState === timerState) return;

  if (timerState === 'running' && prevState === 'idle') {
    announce('Timer started');
  } else if (timerState === 'running' && prevState === 'paused') {
    announce('Timer resumed');
  } else if (timerState === 'paused' && prevState === 'running') {
    announce('Timer paused');
  } else if (timerState === 'transition') {
    announce('Session completed');
  } else if (timerState === 'idle' && prevState !== 'idle') {
    announce('Activity ended');
  }
}, [timerState, announce]);

useEffect(() => {
  const prevPhase = prevPhaseRef.current;
  prevPhaseRef.current = currentPhase;

  if (prevPhase === currentPhase) return;

  if (timerState === 'running') {
    if (currentPhase === 'work') {
      announce('Work session started');
    } else {
      announce('Break time!');
    }
  }
}, [currentPhase, timerState, announce]);
```

Also add `useRef` to the import from 'react' (line 1).

- [ ] **Step 3: Verify build**

Run: `bun run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/popup/App.tsx
git commit -m "feat(a11y): add footer aria-labels and announcer integration to popup"
```

---

## Chunk 3: Modals

### Task 9: StartSessionModal accessibility

**Files:**
- Modify: `src/components/timer/StartSessionModal.tsx`

- [ ] **Step 1: Add dialog role, focus trap, and aria attributes**

Add imports for `useEffect`, `useRef`, and `useFocusTrap`. Update the modal markup:

Add to imports:
```tsx
import { useState, useEffect, useRef } from 'react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
```

Inside the component, before the return:
```tsx
const previousFocus = useRef<Element | null>(null);
const modalRef = useFocusTrap(true, onCancel);

useEffect(() => {
  previousFocus.current = document.activeElement;
  return () => {
    if (previousFocus.current instanceof HTMLElement) {
      previousFocus.current.focus();
    }
  };
}, []);
```

Update the outer div:
```tsx
<div
  className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
  role="dialog"
  aria-modal="true"
  aria-labelledby="start-session-title"
>
```

Add `ref={modalRef}` to the inner content div (the `bg-background` one).

Add `id="start-session-title"` to the `<h3>`:
```tsx
<h3 id="start-session-title" className="font-semibold">Start Work Session</h3>
```

Add `aria-label="Close"` to the X button. Add `aria-hidden="true"` to the `<X>`, `<Shield>`, and `<Play>` icons.

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/timer/StartSessionModal.tsx
git commit -m "feat(a11y): add dialog role, focus trap, and aria attributes to StartSessionModal"
```

---

### Task 10: ClearHistoryModal accessibility

**Files:**
- Modify: `src/components/history/ClearHistoryModal.tsx`

- [ ] **Step 1: Add alertdialog role, focus trap, and aria attributes**

Add imports:
```tsx
import { useEffect, useRef } from 'react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
```

Inside the component, add focus management:
```tsx
const previousFocus = useRef<Element | null>(null);
const modalRef = useFocusTrap(true, onCancel);

useEffect(() => {
  previousFocus.current = document.activeElement;
  return () => {
    if (previousFocus.current instanceof HTMLElement) {
      previousFocus.current.focus();
    }
  };
}, []);
```

Update the outer container div (line 12):
```tsx
<div
  className="fixed inset-0 z-50 flex items-center justify-center"
  role="alertdialog"
  aria-modal="true"
  aria-labelledby="clear-history-title"
  aria-describedby="clear-history-warning"
>
```

Add `ref={modalRef}` to the inner content div (the `relative z-50 ...` one).

Add `id="clear-history-title"` to the `<h3>` (line 20).

Add `id="clear-history-warning"` to the warning paragraph (line 21-23).

Add `aria-hidden="true"` to the `<AlertTriangle>` icon.

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/history/ClearHistoryModal.tsx
git commit -m "feat(a11y): add alertdialog role, focus trap, and aria attributes to ClearHistoryModal"
```

---

### Task 11: ImportModal accessibility

**Files:**
- Modify: `src/components/history/ImportModal.tsx`

- [ ] **Step 1: Add dialog role, focus trap, and aria attributes**

Add imports:
```tsx
import { useState, useRef, useEffect } from 'react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
```

Inside the component, add focus management:
```tsx
const previousFocus = useRef<Element | null>(null);
const modalRef = useFocusTrap(true, onClose);

useEffect(() => {
  previousFocus.current = document.activeElement;
  return () => {
    if (previousFocus.current instanceof HTMLElement) {
      previousFocus.current.focus();
    }
  };
}, []);
```

Update the outer div (line 50):
```tsx
<div
  className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
  role="dialog"
  aria-modal="true"
  aria-labelledby="import-modal-title"
>
```

Add `ref={modalRef}` to the inner content div.

Add `id="import-modal-title"` to the `<h2>`:
```tsx
<h2 id="import-modal-title" className="text-lg font-semibold">Import Data</h2>
```

Add `aria-label="Select backup file"` to the file input (line 63-68).

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/history/ImportModal.tsx
git commit -m "feat(a11y): add dialog role, focus trap, and aria attributes to ImportModal"
```

---

### Task 12: ExportDropdown accessibility

**Files:**
- Modify: `src/components/history/ExportDropdown.tsx`

- [ ] **Step 1: Add menu roles and aria attributes**

Update the trigger button (line 30) to add `aria-haspopup` and `aria-expanded`:
```tsx
<Button
  variant="outline"
  size="sm"
  disabled={disabled}
  onClick={() => setOpen(!open)}
  aria-haspopup="true"
  aria-expanded={open}
>
  <Download className="mr-1 h-4 w-4" aria-hidden="true" />
  Export
</Button>
```

Update the dropdown container div (line 35) to add `role="menu"`:
```tsx
<div
  className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-border bg-popover p-1 shadow-md"
  role="menu"
>
```

Add `role="menuitem"` to both menu buttons (lines 36-43, 44-49):
```tsx
<button type="button" role="menuitem" className="...">
```

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/history/ExportDropdown.tsx
git commit -m "feat(a11y): add menu roles and aria attributes to ExportDropdown"
```

---

## Chunk 4: Options Page Components

### Task 13: Sidebar accessibility

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add aria-hidden to nav icons**

React Router v6's `NavLink` already sets `aria-current="page"` on active links by default — no change needed for that.

Add `aria-hidden="true"` to the `<Icon>` component (line 36):
```tsx
<Icon className="h-4 w-4" aria-hidden="true" />
```

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat(a11y): add aria-current and aria-hidden to sidebar navigation"
```

---

### Task 14: ThemePicker accessibility

**Files:**
- Modify: `src/components/settings/ThemePicker.tsx`

- [ ] **Step 1: Add radiogroup semantics**

Update the container div to add `role="radiogroup"` and `aria-label`. Update each button to add `role="radio"` and `aria-checked`:

```tsx
return (
  <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="Select theme">
    {THEMES.map((t) => {
      const meta = THEME_META[t];
      const isActive = theme === t;

      return (
        <button
          key={t}
          onClick={() => setTheme(t)}
          role="radio"
          aria-checked={isActive}
          className={cn(
            'flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors cursor-pointer',
            isActive
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-muted-foreground/40'
          )}
        >
          <div className={cn('h-8 w-8 rounded-full', THEME_SWATCHES[t])} aria-hidden="true" />
          <span className="text-sm font-medium text-foreground">{meta.label}</span>
          <span className="text-xs text-muted-foreground">{meta.description}</span>
        </button>
      );
    })}
  </div>
);
```

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/ThemePicker.tsx
git commit -m "feat(a11y): add radiogroup semantics to ThemePicker"
```

---

### Task 15: FocusModeSettings accessibility

**Files:**
- Modify: `src/components/settings/FocusModeSettings.tsx`

- [ ] **Step 1: Add aria-labels to icon buttons and input**

For the Trash2 delete button (around line 146-153), add `aria-label`:
```tsx
<Button
  variant="ghost"
  size="sm"
  className="h-6 w-6 p-0"
  onClick={() => handleRemoveDomain(domain)}
  aria-label={`Remove ${domain}`}
>
  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
</Button>
```

For the custom domain input (around line 159-170), add `aria-label` and `aria-describedby`:
```tsx
<input
  type="text"
  value={customInput}
  onChange={(e) => {
    setCustomInput(e.target.value);
    if (inputError) setInputError('');
  }}
  onKeyDown={(e) => {
    if (e.key === 'Enter') handleAddDomain();
  }}
  placeholder="e.g. example.com"
  aria-label="Custom domain to block"
  aria-describedby={inputError ? 'custom-domain-error' : undefined}
  className="flex-1 px-3 py-1.5 text-sm border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
/>
```

For the Plus button (around line 172-174), add `aria-label`:
```tsx
<Button variant="outline" size="sm" onClick={handleAddDomain} aria-label="Add custom domain">
  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
</Button>
```

For the error message (around line 176-178), add `id` and `aria-live`:
```tsx
{inputError && (
  <p id="custom-domain-error" className="text-xs text-destructive" aria-live="polite">{inputError}</p>
)}
```

Add `aria-hidden="true"` to the Shield icon (line 92).

For the "Allow Once duration" select (around line 187-197), add `aria-label`:
```tsx
<select
  value={focusSettings.allowOnceMinutes}
  onChange={(e) => handleAllowOnceChange(Number(e.target.value))}
  aria-label="Allow once duration"
  className="text-sm border rounded-md px-2 py-1 bg-background text-foreground"
>
```

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/FocusModeSettings.tsx
git commit -m "feat(a11y): add aria-labels to FocusModeSettings icon buttons, input, and error region"
```

---

### Task 16: SettingsPage accessibility

**Files:**
- Modify: `src/options/pages/SettingsPage.tsx`

- [ ] **Step 1: Add aria-labels to PresetEditor buttons**

In the `PresetEditor` component, update the Edit button (line 47):
```tsx
<Button variant="ghost" size="sm" onClick={() => setEditing(true)} aria-label={`Edit preset ${preset.name}`}>
  Edit
</Button>
```

Update the Delete button (line 50-52):
```tsx
<Button variant="ghost" size="sm" onClick={() => onDelete(preset.id)} aria-label={`Delete preset ${preset.name}`}>
  Delete
</Button>
```

- [ ] **Step 2: Add aria-valuetext to sliders**

For the Work slider (line 78), add `aria-valuetext`:
```tsx
<Slider value={[draft.workMinutes]} onValueChange={([v]) => setDraft({ ...draft, workMinutes: v })} min={1} max={60} step={1} aria-valuetext={`${draft.workMinutes} minutes`} />
```

Same for Short Break slider (line 86): `aria-valuetext={`${draft.shortBreakMinutes} minutes`}`

Same for Long Break slider (line 94): `aria-valuetext={`${draft.longBreakMinutes} minutes`}`

Same for Sessions slider (line 102): `aria-valuetext={`${draft.sessionsBeforeLongBreak} sessions`}`

For the Volume slider (line 238-246): `aria-valuetext={`${Math.round(settings.soundVolume * 100)} percent`}`

- [ ] **Step 3: Add htmlFor associations to preset editor labels**

Update the Name label (line 64) to use `htmlFor`:
```tsx
<label htmlFor="preset-name" className="text-sm text-muted-foreground">Name</label>
<input
  id="preset-name"
  type="text"
  ...
```

- [ ] **Step 4: Add aria-labels to sound select dropdowns**

For the "Work complete" select (line 264-273), add `aria-label="Work complete sound"`.

For the "Break complete" select (line 277-286), add `aria-label="Break complete sound"`.

- [ ] **Step 5: Add announcer integration for settings saved**

Add import and hook:
```tsx
import { useAnnounce } from '@/components/Announcer';
```

Inside `SettingsPage`, add:
```tsx
const announce = useAnnounce();
```

Add `announce('Settings saved')` after the `resetSettings` call (line 320-321):
```tsx
<Button variant="outline" onClick={() => { resetSettings(); announce('Settings restored to defaults'); }}>
  Restore Defaults
</Button>
```

Note: The Radix Switch `onCheckedChange` callbacks already persist immediately via `updateSettings`. Adding `announce('Settings saved')` after each toggle would be noisy. Only announce on the "Restore Defaults" action, which is a significant bulk change.

- [ ] **Step 6: Verify Radix Switch has correct role**

The shadcn/ui Switch component is built on `@radix-ui/react-switch`, which automatically renders `role="switch"` with `aria-checked`. No changes needed — just verify by inspecting the rendered HTML in devtools.

- [ ] **Step 7: Verify build**

Run: `bun run build`
Expected: Build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/options/pages/SettingsPage.tsx
git commit -m "feat(a11y): add aria-labels, aria-valuetext, label associations, and announcer to SettingsPage"
```

---

### Task 17: HistoryPage accessibility and announcer

**Files:**
- Modify: `src/options/pages/HistoryPage.tsx`

- [ ] **Step 1: Add aria-hidden to icons**

For the Import button's `<Upload>` icon (line 35), add `aria-hidden="true"`.

For the Clear button's `<Trash2>` icon (line 60), add `aria-hidden="true"`.

- [ ] **Step 2: Add announcer integration for history cleared**

Add import and hook:
```tsx
import { useAnnounce } from '@/components/Announcer';
```

Inside `HistoryPage`, add:
```tsx
const announce = useAnnounce();
```

Update the `onConfirm` callback in `ClearHistoryModal` (line 71):
```tsx
onConfirm={() => { clearHistory(); setShowClearModal(false); announce('History cleared'); }}
```

- [ ] **Step 3: Verify build**

Run: `bun run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/options/pages/HistoryPage.tsx
git commit -m "feat(a11y): add aria-hidden to icons and announcer to HistoryPage"
```

---

### Task 18: Decorative icon sweep and filter aria-labels

**Files:**
- Modify: Any components with Lucide icons not yet covered (search for Lucide imports)
- Modify: `src/components/history/DateFilter.tsx` (if it has unlabeled controls)
- Modify: `src/components/history/TagFilter.tsx` (if it has unlabeled controls)
- Modify: `src/components/settings/ModeToggle.tsx` (if it has icons)
- Modify: `src/components/settings/KeyboardShortcuts.tsx` (if it has icons)
- Modify: `src/components/history/CollapsibleSection.tsx` (if it has icons)

- [ ] **Step 1: Search for all Lucide icon imports**

Run: `grep -r "from 'lucide-react'" src/components/ src/options/ src/popup/ --include="*.tsx" -l`

For each file found that hasn't been covered in Tasks 4-17, open it and add `aria-hidden="true"` to all decorative Lucide icons.

- [ ] **Step 2: Add aria-labels to filter controls**

Check `DateFilter.tsx` and `TagFilter.tsx` for any `<select>`, `<input>`, or `<button>` elements missing `aria-label`. Add labels like:
- DateFilter select: `aria-label="Filter by date range"`
- TagFilter: `aria-label="Filter by tag"` (if applicable)

- [ ] **Step 3: Verify build**

Run: `bun run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(a11y): sweep decorative icons with aria-hidden and add filter aria-labels"
```

---

### Task 19: Final build verification

- [ ] **Step 1: Build both targets**

Run: `bun run build:all`
Expected: Both Chrome and Firefox builds succeed.

- [ ] **Step 2: Verify in browser**

Load the extension in Chrome and:
1. Tab through the popup — verify all elements are reachable
2. Check Chrome DevTools → Accessibility panel on the popup
3. Enable `prefers-reduced-motion: reduce` in DevTools → Rendering — verify animations stop
4. Open options page and tab through settings

- [ ] **Step 3: Final commit if any fixes needed**

Fix any issues found during manual testing, commit them.
