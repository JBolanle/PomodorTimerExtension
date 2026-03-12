# Keyboard Shortcuts Implementation

## Overview

Add browser-wide keyboard shortcuts for:
- Open popup (`Alt+Shift+P`)
- Start/Pause timer (`Alt+Shift+S`)
- Skip phase (`Alt+Shift+K`)

Plus in-popup shortcuts when popup is focused.

---

## 1. Manifest Commands (Chrome)

Add to `manifest.json`:

```json
{
  "commands": {
    "_execute_action": {
      "suggested_key": {
        "default": "Alt+Shift+P",
        "mac": "Alt+Shift+P"
      },
      "description": "Open Pomodoro Timer"
    },
    "toggle-timer": {
      "suggested_key": {
        "default": "Alt+Shift+S",
        "mac": "Alt+Shift+S"
      },
      "description": "Start or pause timer"
    },
    "skip-phase": {
      "suggested_key": {
        "default": "Alt+Shift+K",
        "mac": "Alt+Shift+K"
      },
      "description": "Skip to next phase"
    }
  }
}
```

**Notes:**
- `_execute_action` is a reserved name that opens the popup
- Custom command names must be lowercase with hyphens
- `suggested_key` is the default; users can change it
- Mac uses "Alt" in manifest but displays as "Option" to users

---

## 2. Manifest Commands (Firefox)

Firefox uses slightly different key names. Add a Firefox-specific manifest or use compatible names:

```json
{
  "commands": {
    "_execute_browser_action": {
      "suggested_key": {
        "default": "Alt+Shift+P"
      },
      "description": "Open Pomodoro Timer"
    },
    "toggle-timer": {
      "suggested_key": {
        "default": "Alt+Shift+S"
      },
      "description": "Start or pause timer"
    },
    "skip-phase": {
      "suggested_key": {
        "default": "Alt+Shift+K"
      },
      "description": "Skip to next phase"
    }
  }
}
```

**Firefox differences:**
- Uses `_execute_browser_action` instead of `_execute_action` (MV2 naming, but still works in MV3)
- Some key combos behave differently

---

## 3. Background Service Worker Handler

Add command listener to `background/service-worker.js`:

```javascript
// --- Keyboard Shortcut Commands ---

chrome.commands.onCommand.addListener(async (command) => {
  console.log('Command received:', command);

  switch (command) {
    case 'toggle-timer':
      await handleToggleTimer();
      break;
    case 'skip-phase':
      await handleSkipShortcut();
      break;
    // '_execute_action' is handled automatically (opens popup)
  }
});

async function handleToggleTimer() {
  // Get current state and toggle
  if (timerState.state === 'running') {
    await doPause();
    showBadgeNotification('⏸️');
  } else if (timerState.state === 'paused') {
    await doResume();
    showBadgeNotification('▶️');
  } else if (timerState.state === 'idle') {
    // Start a new work session with active preset
    const preset = await getActivePreset();
    await doStartTimer('work', preset.workMinutes);
    showBadgeNotification('▶️');
  } else if (timerState.state === 'transition') {
    // Start suggested next phase
    const phase = timerState.suggestedNext || 'work';
    const preset = await getActivePreset();
    const minutes = getMinutesForPhase(phase, preset);
    await doStartTimer(phase, minutes);
    showBadgeNotification('▶️');
  }
}

async function handleSkipShortcut() {
  if (timerState.state === 'running' || timerState.state === 'paused') {
    await doSkip();
    showBadgeNotification('⏭️');
  }
}

// Brief visual feedback on the badge
function showBadgeNotification(emoji) {
  const originalText = chrome.action.getBadgeText({});
  
  chrome.action.setBadgeText({ text: emoji });
  chrome.action.setBadgeBackgroundColor({ color: '#333' });
  
  setTimeout(async () => {
    // Restore normal badge
    updateBadge();
  }, 500);
}
```

---

## 4. Settings UI - Display Shortcuts

Show users their current shortcuts and link to browser settings:

```tsx
// components/KeyboardShortcuts.tsx
import { useState, useEffect } from 'react';
import { Keyboard, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ShortcutCommand {
  name: string;
  description: string;
  shortcut: string | undefined;
}

export function KeyboardShortcuts() {
  const [commands, setCommands] = useState<ShortcutCommand[]>([]);

  useEffect(() => {
    loadCommands();
  }, []);

  async function loadCommands() {
    // chrome.commands.getAll() returns all registered commands
    const allCommands = await chrome.commands.getAll();
    
    const mapped = allCommands.map((cmd) => ({
      name: formatCommandName(cmd.name || ''),
      description: cmd.description || '',
      shortcut: cmd.shortcut || undefined,
    }));

    setCommands(mapped);
  }

  function formatCommandName(name: string): string {
    switch (name) {
      case '_execute_action':
      case '_execute_browser_action':
        return 'Open Popup';
      case 'toggle-timer':
        return 'Start / Pause';
      case 'skip-phase':
        return 'Skip Phase';
      default:
        return name;
    }
  }

  function openShortcutSettings() {
    // Chrome: opens chrome://extensions/shortcuts
    // Firefox: opens about:addons (user navigates to shortcuts manually)
    if (chrome.runtime.getURL('').startsWith('chrome-extension://')) {
      chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    } else {
      chrome.tabs.create({ url: 'about:addons' });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Keyboard className="w-4 h-4" />
          Keyboard Shortcuts
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={openShortcutSettings}
          className="text-xs"
        >
          Customize
          <ExternalLink className="w-3 h-3 ml-1" />
        </Button>
      </div>

      <div className="space-y-2">
        {commands.map((cmd) => (
          <ShortcutRow
            key={cmd.name}
            name={cmd.name}
            description={cmd.description}
            shortcut={cmd.shortcut}
          />
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Shortcuts work browser-wide, even when the popup is closed.
      </p>
    </div>
  );
}

interface ShortcutRowProps {
  name: string;
  description: string;
  shortcut: string | undefined;
}

function ShortcutRow({ name, description, shortcut }: ShortcutRowProps) {
  return (
    <div className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-lg">
      <div>
        <div className="text-sm font-medium">{name}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <div>
        {shortcut ? (
          <kbd className="px-2 py-1 text-xs font-mono bg-background border border-border rounded">
            {formatShortcut(shortcut)}
          </kbd>
        ) : (
          <span className="text-xs text-muted-foreground italic">Not set</span>
        )}
      </div>
    </div>
  );
}

// Format shortcut for display (e.g., "Alt+Shift+S" → "Alt + Shift + S")
function formatShortcut(shortcut: string): string {
  return shortcut
    .replace(/\+/g, ' + ')
    .replace('MacCtrl', '⌃')
    .replace('Ctrl', 'Ctrl')
    .replace('Alt', navigator.platform.includes('Mac') ? '⌥' : 'Alt')
    .replace('Shift', navigator.platform.includes('Mac') ? '⇧' : 'Shift')
    .replace('Command', '⌘');
}
```

---

## 5. Settings Page Integration

Add the shortcuts section to Settings:

```tsx
// pages/SettingsPage.tsx

import { KeyboardShortcuts } from '../components/KeyboardShortcuts';

export function SettingsPage() {
  const { isAdvanced } = useAppMode();

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Mode Toggle */}
      <ModeToggle ... />

      {/* General Settings */}
      <section>
        <h2 className="text-lg font-semibold mb-4">General</h2>
        {/* ... other settings ... */}
      </section>

      {/* Keyboard Shortcuts - visible in both modes */}
      <section>
        <KeyboardShortcuts />
      </section>

      {/* Advanced sections ... */}
    </div>
  );
}
```

---

## 6. In-Popup Shortcuts (Bonus)

Add shortcuts that work when the popup is open/focused:

```tsx
// hooks/usePopupShortcuts.ts
import { useEffect } from 'react';

interface PopupShortcutHandlers {
  onToggle: () => void;
  onSkip: () => void;
  onReset: () => void;
}

export function usePopupShortcuts({
  onToggle,
  onSkip,
  onReset,
}: PopupShortcutHandlers) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          onToggle();
          break;
        case 'KeyS':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            onSkip();
          }
          break;
        case 'KeyR':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            onReset();
          }
          break;
        case 'Escape':
          window.close(); // Close popup
          break;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onToggle, onSkip, onReset]);
}
```

### Usage in Popup

```tsx
// pages/Popup.tsx

import { usePopupShortcuts } from '../hooks/usePopupShortcuts';

export function Popup() {
  const { startTimer, pauseTimer, resumeTimer, skipPhase, endActivity } = useTimer();

  const handleToggle = () => {
    if (state === 'running') pauseTimer();
    else if (state === 'paused') resumeTimer();
    else if (state === 'idle') startTimer('work', activePreset.workMinutes);
    else if (state === 'transition') startNext();
  };

  usePopupShortcuts({
    onToggle: handleToggle,
    onSkip: skipPhase,
    onReset: endActivity,
  });

  return (
    // ... existing popup JSX
  );
}
```

### Show Popup Shortcuts Hint

Add a subtle hint in the popup footer:

```tsx
// In Popup footer
<footer className="w-full flex items-center justify-between text-xs text-muted-foreground">
  <span className="opacity-50">Space to start/pause</span>
  <div className="flex gap-2">
    <ThemeToggle />
    <SettingsButton />
  </div>
</footer>
```

---

## 7. Cross-Browser Build Handling

If you have separate manifests for Chrome and Firefox:

**Chrome (`manifest.json`):**
```json
{
  "commands": {
    "_execute_action": { ... }
  }
}
```

**Firefox (`manifest.firefox.json`):**
```json
{
  "commands": {
    "_execute_browser_action": { ... }
  }
}
```

Or use a build script to transform the manifest.

---

## Summary

| Shortcut | Scope | Default Key | Action |
|----------|-------|-------------|--------|
| Open popup | Browser-wide | `Alt+Shift+P` | Opens extension popup |
| Toggle timer | Browser-wide | `Alt+Shift+S` | Start/pause/resume |
| Skip phase | Browser-wide | `Alt+Shift+K` | Skip to next phase |
| Space | Popup only | `Space` | Start/pause/resume |
| S | Popup only | `S` | Skip |
| R | Popup only | `R` | Reset/end |
| Esc | Popup only | `Escape` | Close popup |

---

## Prompt for Claude Code

```
Add keyboard shortcuts following KEYBOARD_SHORTCUTS_IMPLEMENTATION.md.

1. Add commands to manifest.json:
   - _execute_action (Alt+Shift+P) - open popup
   - toggle-timer (Alt+Shift+S) - start/pause
   - skip-phase (Alt+Shift+K) - skip

2. Handle commands in service worker with chrome.commands.onCommand

3. Create KeyboardShortcuts component showing current bindings

4. Add to Settings page (visible in both Simple/Advanced modes)

5. Add usePopupShortcuts hook for in-popup shortcuts (Space, S, R, Esc)

6. Firefox manifest needs _execute_browser_action instead of _execute_action
```

---

## Testing Checklist

1. ☐ `Alt+Shift+P` opens popup
2. ☐ `Alt+Shift+S` starts timer when idle
3. ☐ `Alt+Shift+S` pauses timer when running
4. ☐ `Alt+Shift+S` resumes timer when paused
5. ☐ `Alt+Shift+S` starts next phase when in transition
6. ☐ `Alt+Shift+K` skips current phase
7. ☐ Badge shows brief feedback on shortcut use
8. ☐ Settings shows current shortcuts
9. ☐ "Customize" link opens browser shortcut settings
10. ☐ In-popup: Space toggles timer
11. ☐ In-popup: S skips phase
12. ☐ In-popup: R resets
13. ☐ In-popup: Esc closes popup
14. ☐ Shortcuts don't fire when typing in inputs
15. ☐ Firefox commands work correctly
