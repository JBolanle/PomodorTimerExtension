# Accessibility Implementation Guide

## Current Status

| Page | Status | Notes |
|------|--------|-------|
| **Blocked page** | ✅ Done | Skip link, ARIA roles, live regions, focus states, reduced motion |
| **Popup** | 🔧 Needs work | Timer, controls, phase indicators |
| **Options** | 🔧 Needs work | Forms, toggles, presets |

---

## 1. Timer Display (Popup)

The countdown timer needs live region announcements for screen readers.

### Component Pattern

```jsx
// components/TimerDisplay.jsx

function TimerDisplay({ minutes, seconds, phase, isRunning }) {
  const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  
  // Announce every minute (not every second - too noisy)
  const [lastAnnounced, setLastAnnounced] = useState(null);
  const announcement = useRef('');
  
  useEffect(() => {
    if (isRunning && minutes !== lastAnnounced && seconds === 0) {
      announcement.current = `${minutes} minutes remaining`;
      setLastAnnounced(minutes);
    }
  }, [minutes, seconds, isRunning, lastAnnounced]);

  return (
    <div 
      className="timer-container"
      role="timer"
      aria-label={`${phase} session timer`}
    >
      {/* Visual display */}
      <time 
        className="timer-display font-mono text-5xl"
        dateTime={`PT${minutes}M${seconds}S`}
        aria-hidden="true"
      >
        {timeString}
      </time>
      
      {/* Screen reader accessible time */}
      <span className="sr-only">
        {minutes} minutes and {seconds} seconds remaining
      </span>
      
      {/* Live announcements (polite, not assertive) */}
      <div 
        role="status" 
        aria-live="polite" 
        aria-atomic="true"
        className="sr-only"
      >
        {announcement.current}
      </div>
    </div>
  );
}
```

---

## 2. Control Buttons

### Start/Pause Button

```jsx
function PlayPauseButton({ isRunning, isPaused, onClick, disabled }) {
  // Dynamic label based on state
  const getLabel = () => {
    if (!isRunning && !isPaused) return 'Start timer';
    if (isRunning) return 'Pause timer';
    return 'Resume timer';
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={getLabel()}
      aria-pressed={isRunning}
      className="btn-primary focus-visible:ring-2 focus-visible:ring-offset-2 
                 focus-visible:ring-blue-500 focus-visible:outline-none"
    >
      {isRunning ? <PauseIcon aria-hidden="true" /> : <PlayIcon aria-hidden="true" />}
      <span className="ml-2">{isRunning ? 'Pause' : isPaused ? 'Resume' : 'Start'}</span>
    </button>
  );
}
```

### Skip Button

```jsx
function SkipButton({ onClick, currentPhase, disabled }) {
  const nextPhase = currentPhase === 'work' ? 'break' : 'work';
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={`Skip to ${nextPhase}`}
      title={`Skip to ${nextPhase}`}
      className="btn-icon focus-visible:ring-2 focus-visible:ring-offset-2"
    >
      <SkipForwardIcon aria-hidden="true" />
    </button>
  );
}
```

### Reset Button

```jsx
function ResetButton({ onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label="Reset timer to beginning"
      className="btn-icon focus-visible:ring-2 focus-visible:ring-offset-2"
    >
      <RotateCcwIcon aria-hidden="true" />
    </button>
  );
}
```

---

## 3. Phase Indicators

The dots showing work sessions completed need accessible labeling.

```jsx
function PhaseIndicators({ completed, total, currentPhase }) {
  return (
    <div 
      role="group" 
      aria-label={`Work sessions: ${completed} of ${total} completed`}
      className="flex gap-2"
    >
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          role="img"
          aria-label={
            i < completed 
              ? `Session ${i + 1}: completed` 
              : i === completed && currentPhase === 'work'
                ? `Session ${i + 1}: in progress`
                : `Session ${i + 1}: not started`
          }
          className={cn(
            "w-3 h-3 rounded-full",
            i < completed ? "bg-green-500" : "bg-gray-300"
          )}
        />
      ))}
    </div>
  );
}
```

---

## 4. Mode Toggle (Simple/Advanced)

```jsx
function ModeToggle({ mode, onToggle }) {
  const isAdvanced = mode === 'advanced';
  
  return (
    <div className="flex items-center gap-3">
      <span 
        id="mode-label" 
        className={cn("text-sm", !isAdvanced && "font-medium")}
      >
        Simple
      </span>
      
      <button
        role="switch"
        aria-checked={isAdvanced}
        aria-labelledby="mode-label mode-label-advanced"
        onClick={onToggle}
        className="relative w-11 h-6 bg-gray-200 rounded-full 
                   focus-visible:ring-2 focus-visible:ring-offset-2 
                   focus-visible:ring-blue-500 focus-visible:outline-none
                   data-[checked=true]:bg-blue-600"
        data-checked={isAdvanced}
      >
        <span 
          className={cn(
            "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform",
            isAdvanced && "translate-x-5"
          )}
          aria-hidden="true"
        />
      </button>
      
      <span 
        id="mode-label-advanced" 
        className={cn("text-sm", isAdvanced && "font-medium")}
      >
        Advanced
      </span>
    </div>
  );
}
```

---

## 5. Settings Toggles (Options Page)

### Accessible Toggle Switch

```jsx
function ToggleSwitch({ id, label, description, checked, onChange, disabled }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="flex-1">
        <label 
          id={`${id}-label`}
          htmlFor={id}
          className="text-sm font-medium cursor-pointer"
        >
          {label}
        </label>
        {description && (
          <p 
            id={`${id}-description`} 
            className="text-xs text-muted-foreground mt-0.5"
          >
            {description}
          </p>
        )}
      </div>
      
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-description` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative w-11 h-6 rounded-full transition-colors",
          "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary",
          "focus-visible:outline-none",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          checked ? "bg-primary" : "bg-input"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform",
            checked && "translate-x-5"
          )}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}
```

### Usage

```jsx
<ToggleSwitch
  id="sound-enabled"
  label="Play sound on completion"
  description="Plays a notification sound when timer completes"
  checked={settings.soundEnabled}
  onChange={(v) => updateSettings({ soundEnabled: v })}
/>

<ToggleSwitch
  id="notifications-enabled"
  label="Desktop notifications"
  description="Show system notifications for timer events"
  checked={settings.notificationsEnabled}
  onChange={(v) => updateSettings({ notificationsEnabled: v })}
/>
```

---

## 6. Slider (Volume Control)

```jsx
function VolumeSlider({ value, onChange, disabled }) {
  const percentage = Math.round(value * 100);
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label 
          htmlFor="volume-slider" 
          className="text-sm font-medium"
        >
          Volume
        </label>
        <span 
          id="volume-value" 
          className="text-sm text-muted-foreground"
          aria-hidden="true"
        >
          {percentage}%
        </span>
      </div>
      
      <input
        id="volume-slider"
        type="range"
        min="0"
        max="1"
        step="0.1"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        disabled={disabled}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentage}
        aria-valuetext={`${percentage} percent`}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer
                   focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary
                   disabled:opacity-50 disabled:cursor-not-allowed"
      />
    </div>
  );
}
```

---

## 7. Preset Selector

```jsx
function PresetSelector({ presets, activeId, onChange }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Timer Preset</legend>
      
      <div 
        role="radiogroup" 
        aria-label="Select a timer preset"
        className="space-y-2"
      >
        {presets.map((preset) => (
          <label
            key={preset.id}
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg border cursor-pointer",
              "focus-within:ring-2 focus-within:ring-primary",
              activeId === preset.id ? "border-primary bg-primary/5" : "border-input"
            )}
          >
            <input
              type="radio"
              name="preset"
              value={preset.id}
              checked={activeId === preset.id}
              onChange={() => onChange(preset.id)}
              className="sr-only"
            />
            <span 
              className={cn(
                "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                activeId === preset.id ? "border-primary" : "border-muted-foreground"
              )}
              aria-hidden="true"
            >
              {activeId === preset.id && (
                <span className="w-2 h-2 rounded-full bg-primary" />
              )}
            </span>
            <div>
              <span className="font-medium">{preset.name}</span>
              <span className="text-xs text-muted-foreground ml-2">
                {preset.workMinutes}/{preset.shortBreakMinutes}/{preset.longBreakMinutes}
              </span>
            </div>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
```

---

## 8. Focus Mode Category Toggles

```jsx
function CategoryToggle({ category, enabled, onChange }) {
  const categoryLabels = {
    social: 'Social media sites',
    video: 'Video streaming sites',
    news: 'News websites',
    shopping: 'Shopping sites',
    gaming: 'Gaming platforms',
  };

  return (
    <label className="flex items-center justify-between py-2 cursor-pointer">
      <span className="text-sm">{categoryLabels[category.id]}</span>
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={`${category.id}-sites`}
        className="w-4 h-4 rounded border-gray-300 text-primary 
                   focus:ring-2 focus:ring-primary focus:ring-offset-2"
      />
      {/* Hidden description for screen readers */}
      <span id={`${category.id}-sites`} className="sr-only">
        Includes: {category.domains.slice(0, 3).join(', ')}
        {category.domains.length > 3 && ` and ${category.domains.length - 3} more`}
      </span>
    </label>
  );
}
```

---

## 9. Session Notes Input

```jsx
function SessionNoteInput({ note, tags, onNoteChange, onTagsChange, tagSuggestions }) {
  const [inputValue, setInputValue] = useState('');
  
  return (
    <div className="space-y-3">
      {/* Note textarea */}
      <div>
        <label 
          htmlFor="session-note" 
          className="block text-sm font-medium mb-1"
        >
          Session note
          <span className="text-muted-foreground font-normal ml-1">(optional)</span>
        </label>
        <textarea
          id="session-note"
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="What are you working on?"
          rows={2}
          maxLength={200}
          aria-describedby="note-hint"
          className="w-full px-3 py-2 border rounded-lg resize-none
                     focus:ring-2 focus:ring-primary focus:border-primary"
        />
        <p id="note-hint" className="text-xs text-muted-foreground mt-1">
          {200 - (note?.length || 0)} characters remaining
        </p>
      </div>

      {/* Tags input */}
      <div>
        <label 
          htmlFor="tag-input" 
          className="block text-sm font-medium mb-1"
        >
          Tags
        </label>
        
        {/* Current tags */}
        <div 
          role="list" 
          aria-label="Selected tags"
          className="flex flex-wrap gap-1 mb-2"
        >
          {tags.map((tag) => (
            <span 
              key={tag}
              role="listitem"
              className="inline-flex items-center gap-1 px-2 py-0.5 
                         bg-primary/10 text-primary text-xs rounded-full"
            >
              {tag}
              <button
                onClick={() => onTagsChange(tags.filter(t => t !== tag))}
                aria-label={`Remove tag: ${tag}`}
                className="hover:text-primary/70 focus:outline-none 
                           focus-visible:ring-1 focus-visible:ring-primary rounded"
              >
                <XIcon className="w-3 h-3" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>

        {/* Tag input with datalist suggestions */}
        <div className="relative">
          <input
            id="tag-input"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && inputValue.trim()) {
                e.preventDefault();
                if (!tags.includes(inputValue.trim())) {
                  onTagsChange([...tags, inputValue.trim()]);
                }
                setInputValue('');
              }
            }}
            list="tag-suggestions"
            placeholder="Add a tag..."
            aria-describedby="tag-hint"
            className="w-full px-3 py-2 border rounded-lg
                       focus:ring-2 focus:ring-primary focus:border-primary"
          />
          <datalist id="tag-suggestions">
            {tagSuggestions
              .filter(t => !tags.includes(t))
              .map(tag => (
                <option key={tag} value={tag} />
              ))}
          </datalist>
        </div>
        <p id="tag-hint" className="text-xs text-muted-foreground mt-1">
          Press Enter to add a tag
        </p>
      </div>
    </div>
  );
}
```

---

## 10. Global Styles

Add these to your Tailwind base styles or global CSS:

```css
/* globals.css */

/* Screen reader only utility */
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

/* Focus visible ring (Tailwind v3+) */
@layer utilities {
  .focus-ring {
    @apply focus-visible:outline-none focus-visible:ring-2 
           focus-visible:ring-offset-2 focus-visible:ring-primary;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  :root {
    --border: 0 0% 0%;
  }
  
  button, input, select, textarea {
    border-width: 2px;
  }
}
```

---

## 11. Keyboard Navigation

### Focus Trap for Modals

```jsx
// hooks/useFocusTrap.js
import { useEffect, useRef } from 'react';

export function useFocusTrap(isActive) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus first element on open
    firstElement?.focus();

    function handleKeyDown(e) {
      if (e.key !== 'Tab') return;

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }

    function handleEscape(e) {
      if (e.key === 'Escape') {
        // Let parent handle close
        container.dispatchEvent(new CustomEvent('escape'));
      }
    }

    container.addEventListener('keydown', handleKeyDown);
    container.addEventListener('keydown', handleEscape);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      container.removeEventListener('keydown', handleEscape);
    };
  }, [isActive]);

  return containerRef;
}
```

### Usage in Preset Editor Modal

```jsx
function PresetEditorModal({ isOpen, onClose, preset, onSave }) {
  const modalRef = useFocusTrap(isOpen);
  const previousFocus = useRef(null);

  useEffect(() => {
    if (isOpen) {
      previousFocus.current = document.activeElement;
    } else if (previousFocus.current) {
      previousFocus.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div 
        ref={modalRef}
        className="bg-background rounded-lg p-6 max-w-md w-full mx-4"
        onEscape={onClose}
      >
        <h2 id="modal-title" className="text-lg font-semibold mb-4">
          {preset ? 'Edit Preset' : 'New Preset'}
        </h2>
        
        {/* Form content */}
        
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="btn-secondary focus-ring">
            Cancel
          </button>
          <button onClick={onSave} className="btn-primary focus-ring">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## 12. Status Announcements

Centralized announcer for async actions:

```jsx
// components/Announcer.jsx
import { createContext, useContext, useState, useCallback } from 'react';

const AnnouncerContext = createContext(null);

export function AnnouncerProvider({ children }) {
  const [message, setMessage] = useState('');

  const announce = useCallback((text, priority = 'polite') => {
    // Clear then set to ensure re-announcement
    setMessage('');
    requestAnimationFrame(() => {
      setMessage(text);
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
  return useContext(AnnouncerContext);
}
```

### Usage

```jsx
function TimerControls() {
  const announce = useAnnounce();

  const handleStart = async () => {
    await startTimer();
    announce('Timer started');
  };

  const handlePause = async () => {
    await pauseTimer();
    announce('Timer paused');
  };

  const handleSkip = async () => {
    await skipPhase();
    announce('Skipped to next phase');
  };

  // ...
}
```

---

## 13. Color Contrast Requirements

Ensure all themes meet WCAG 2.1 AA (4.5:1 for text, 3:1 for large text/UI).

### Testing Checklist

| Element | Foreground | Background | Ratio | Pass? |
|---------|------------|------------|-------|-------|
| Body text | `--foreground` | `--background` | ≥4.5:1 | ☐ |
| Muted text | `--muted-foreground` | `--background` | ≥4.5:1 | ☐ |
| Primary button text | white | `--primary` | ≥4.5:1 | ☐ |
| Timer display | `--accent` | `--card` | ≥3:1 | ☐ |
| Focus ring | `--ring` | any | ≥3:1 | ☐ |

**Tools:**
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- Chrome DevTools → Rendering → Emulate vision deficiencies

---

## 14. Testing Checklist

### Keyboard Navigation
- [ ] All interactive elements reachable via Tab
- [ ] Tab order follows visual order
- [ ] Enter/Space activates buttons
- [ ] Escape closes modals/dropdowns
- [ ] Arrow keys navigate within groups (radio, tabs)
- [ ] Focus visible on all interactive elements

### Screen Reader (VoiceOver / NVDA)
- [ ] Timer time announced on change
- [ ] Phase changes announced
- [ ] Button actions announced
- [ ] Form labels read correctly
- [ ] Toggles announce state ("on" / "off")
- [ ] Error messages announced

### Visual
- [ ] Focus indicators visible
- [ ] Color not sole indicator of state
- [ ] Text resizable to 200% without loss
- [ ] Reduced motion respected

### Forms
- [ ] All inputs have labels
- [ ] Required fields indicated
- [ ] Errors linked to inputs
- [ ] Autocomplete attributes set

---

## Claude Code Prompt

```
Add accessibility improvements to the Pomodoro extension popup and options pages.

Reference: ACCESSIBILITY_IMPLEMENTATION.md

Key changes:

1. Timer display:
   - Add role="timer" and aria-label
   - Add live region for minute-by-minute announcements (not every second)
   - Add sr-only element with full time text for screen readers

2. Control buttons:
   - Add aria-label to all icon-only buttons (skip, reset)
   - Add aria-pressed to play/pause toggle
   - Ensure all buttons have focus-visible ring styles

3. Toggle switches (mode, settings):
   - Use role="switch" with aria-checked
   - Link labels with aria-labelledby
   - Add descriptions with aria-describedby

4. Phase indicators (session dots):
   - Add role="group" with aria-label showing completed count
   - Each dot needs aria-label describing its state

5. Preset selector:
   - Use proper radiogroup with role and aria-label
   - Ensure focus-within styling on cards

6. Global CSS:
   - Add .sr-only utility class
   - Add @media (prefers-reduced-motion: reduce) to disable animations
   - Add @media (prefers-contrast: high) for high contrast support

7. Create Announcer context for status messages:
   - Timer started/paused/completed
   - Phase transitions
   - Settings saved confirmations

8. Focus management:
   - Modal focus trap with useFocusTrap hook
   - Return focus to trigger element on modal close
   - Escape key to close modals

Testing:
- Use VoiceOver (Mac) or NVDA (Windows) to verify announcements
- Tab through entire UI to verify keyboard navigation
- Use Chrome DevTools Accessibility panel to audit
```
