# Simple / Advanced Mode Implementation

## Overview

Add a mode toggle to the extension:
- **Simple**: Clean, minimal Pomodoro timer
- **Advanced**: Full features with stats, history, insights

History tracking stays on in both modes (data preserved for mode switching).

---

## Storage Schema Update

Add `mode` to settings:

```typescript
// types/index.ts

export type AppMode = 'simple' | 'advanced';

export interface Settings {
  mode: AppMode;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  soundVolume: number;
  showBadge: boolean;
  autoStartNext: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  mode: 'simple', // Default for new users
  notificationsEnabled: true,
  soundEnabled: true,
  soundVolume: 1.0,
  showBadge: true,
  autoStartNext: false,
};
```

> **Note**: Existing users will have `mode: undefined`. Handle this by defaulting to `'advanced'` for existing installs (they already have all features) or `'simple'` for fresh installs.

---

## Feature Visibility Matrix

| Feature | Simple | Advanced | Implementation |
|---------|--------|----------|----------------|
| Timer core | ✅ | ✅ | Always show |
| Start/Pause/Reset/Skip | ✅ | ✅ | Always show |
| Phase indicator | ✅ | ✅ | Always show |
| Session counter (cycle) | ✅ | ✅ | Always show |
| Preset selector | ✅ | ✅ | Always show |
| Notifications | ✅ | ✅ | Always enabled |
| Sound | ✅ | ✅ | Always enabled |
| Badge | ✅ | ✅ | Always enabled |
| Theme toggle | ✅ | ✅ | Always show |
| Settings button | ✅ | ✅ | Always show |
| Preset CRUD (create/edit/delete) | ❌ | ✅ | Conditional |
| Auto-start toggle | ❌ | ✅ | Conditional |
| History section | ❌ | ✅ | Conditional |
| Stats section | ❌ | ✅ | Conditional |
| Insights section | ❌ | ✅ | Conditional |
| Export buttons | ❌ | ✅ | Conditional |
| Clear history | ❌ | ✅ | Conditional |

---

## 1. Mode Hook

Create a hook to access and update mode:

```tsx
// hooks/useAppMode.ts
import { useState, useEffect, useCallback } from 'react';
import { AppMode } from '../types';

export function useAppMode() {
  const [mode, setModeState] = useState<AppMode>('simple');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadMode() {
      const { settings } = await chrome.storage.local.get('settings');
      // Default to 'advanced' if mode is undefined (existing users)
      // Default to 'simple' if settings don't exist (new users)
      const currentMode = settings?.mode ?? (settings ? 'advanced' : 'simple');
      setModeState(currentMode);
      setIsLoading(false);
    }
    loadMode();

    // Listen for changes
    const listener = (changes: any, area: string) => {
      if (area === 'local' && changes.settings?.newValue?.mode) {
        setModeState(changes.settings.newValue.mode);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const setMode = useCallback(async (newMode: AppMode) => {
    const { settings } = await chrome.storage.local.get('settings');
    await chrome.storage.local.set({
      settings: { ...settings, mode: newMode },
    });
    setModeState(newMode);
  }, []);

  return {
    mode,
    setMode,
    isSimple: mode === 'simple',
    isAdvanced: mode === 'advanced',
    isLoading,
  };
}
```

---

## 2. Settings Page - Mode Toggle

Add a prominent mode selector at the top of settings:

```tsx
// components/ModeToggle.tsx
import { AppMode } from '../types';
import { Zap, BarChart3 } from 'lucide-react';

interface ModeToggleProps {
  mode: AppMode;
  onChange: (mode: AppMode) => void;
}

export function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div className="bg-muted/30 rounded-lg p-4 mb-6">
      <h3 className="text-sm font-medium mb-3">App Mode</h3>
      
      <div className="grid grid-cols-2 gap-3">
        <ModeCard
          title="Simple"
          description="Clean, distraction-free timer"
          icon={<Zap className="w-5 h-5" />}
          selected={mode === 'simple'}
          onClick={() => onChange('simple')}
        />
        <ModeCard
          title="Advanced"
          description="Stats, history & insights"
          icon={<BarChart3 className="w-5 h-5" />}
          selected={mode === 'advanced'}
          onClick={() => onChange('advanced')}
        />
      </div>

      <p className="text-xs text-muted-foreground mt-3">
        {mode === 'simple' 
          ? "Your sessions are still being tracked. Switch to Advanced anytime to see your stats."
          : "Full access to history, statistics, and productivity insights."
        }
      </p>
    </div>
  );
}

interface ModeCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  selected: boolean;
  onClick: () => void;
}

function ModeCard({ title, description, icon, selected, onClick }: ModeCardProps) {
  return (
    <button
      onClick={onClick}
      className={`
        flex flex-col items-center text-center p-4 rounded-lg border-2 transition-all
        ${selected 
          ? 'border-primary bg-primary/10' 
          : 'border-border hover:border-muted-foreground/50 bg-background'
        }
      `}
    >
      <div className={`mb-2 ${selected ? 'text-primary' : 'text-muted-foreground'}`}>
        {icon}
      </div>
      <div className={`font-medium text-sm ${selected ? 'text-primary' : ''}`}>
        {title}
      </div>
      <div className="text-xs text-muted-foreground mt-1">
        {description}
      </div>
    </button>
  );
}
```

### Settings Page Integration

```tsx
// pages/SettingsPage.tsx (or options page component)

import { useAppMode } from '../hooks/useAppMode';
import { ModeToggle } from '../components/ModeToggle';

export function SettingsPage() {
  const { mode, setMode, isAdvanced } = useAppMode();

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {/* Mode Toggle - Always visible at top */}
      <ModeToggle mode={mode} onChange={setMode} />

      {/* General Settings - Always visible */}
      <section className="space-y-4 mb-6">
        <h2 className="text-lg font-semibold">General</h2>
        {/* Notifications toggle */}
        {/* Sound toggle + volume */}
        {/* Badge toggle */}
        {/* Theme selector */}
      </section>

      {/* Presets Section */}
      <section className="space-y-4 mb-6">
        <h2 className="text-lg font-semibold">Timer Presets</h2>
        {/* Preset list - always visible */}
        
        {/* Create/Edit/Delete - Advanced only */}
        {isAdvanced && (
          <>
            {/* Add preset button */}
            {/* Edit/delete controls */}
          </>
        )}
      </section>

      {/* Advanced-only sections */}
      {isAdvanced && (
        <>
          <section className="space-y-4 mb-6">
            <h2 className="text-lg font-semibold">Automation</h2>
            {/* Auto-start toggle */}
          </section>

          <section className="space-y-4 mb-6">
            <h2 className="text-lg font-semibold">Data</h2>
            {/* Export buttons */}
            {/* Clear history button */}
          </section>
        </>
      )}
    </div>
  );
}
```

---

## 3. Options Page - Conditional Tabs/Sections

If your options page has tabs or navigation:

```tsx
// pages/OptionsPage.tsx

import { useAppMode } from '../hooks/useAppMode';

export function OptionsPage() {
  const { isAdvanced } = useAppMode();

  // Define available tabs based on mode
  const tabs = [
    { id: 'settings', label: 'Settings' },
    ...(isAdvanced ? [
      { id: 'history', label: 'History & Stats' },
    ] : []),
  ];

  return (
    <div>
      <TabNav tabs={tabs} />
      {/* Tab content */}
    </div>
  );
}
```

Or if it's a single scrollable page with sections:

```tsx
export function OptionsPage() {
  const { isAdvanced } = useAppMode();

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      {/* Settings section - always visible */}
      <SettingsSection />

      {/* History & Stats - Advanced only */}
      {isAdvanced && (
        <>
          <CollapsibleSection title="Statistics">
            <StatsContent ... />
          </CollapsibleSection>

          <CollapsibleSection title="Insights">
            <InsightsContent ... />
          </CollapsibleSection>

          <CollapsibleSection title="Session History">
            <SessionList ... />
          </CollapsibleSection>
        </>
      )}
    </div>
  );
}
```

---

## 4. Popup - Minimal Changes

The popup stays mostly the same. Only hide Advanced-specific elements if any exist there:

```tsx
// pages/Popup.tsx

import { useAppMode } from '../hooks/useAppMode';

export function Popup() {
  const { isAdvanced } = useAppMode();

  return (
    <div className="w-[350px] p-6 flex flex-col items-center gap-4">
      {/* Timer display - always */}
      <TimerDisplay />

      {/* Controls - always */}
      <TimerControls />

      {/* Session counter - always */}
      <SessionCounter />

      {/* Preset selector - always (but simplified in Simple mode) */}
      <PresetSelector showEditButton={isAdvanced} />

      <Separator />

      {/* Footer - always */}
      <footer className="w-full flex items-center justify-between">
        <ThemeToggle />
        <SettingsButton />
      </footer>
    </div>
  );
}
```

---

## 5. Preset Selector Simplification

In Simple mode, just show preset selection without edit capabilities:

```tsx
// components/PresetSelector.tsx

interface PresetSelectorProps {
  presets: Preset[];
  activePresetId: string;
  onSelect: (id: string) => void;
  showEditButton?: boolean; // false in Simple mode
}

export function PresetSelector({ 
  presets, 
  activePresetId, 
  onSelect, 
  showEditButton = true 
}: PresetSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <select
        value={activePresetId}
        onChange={(e) => onSelect(e.target.value)}
        className="..."
      >
        {presets.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.name} ({preset.workMinutes}m)
          </option>
        ))}
      </select>

      {showEditButton && (
        <Button variant="ghost" size="icon" onClick={openPresetEditor}>
          <Pencil className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}
```

---

## 6. Migration for Existing Users

In the service worker initialization, handle existing users:

```typescript
// background/service-worker.js

async function migrateSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  
  if (settings && settings.mode === undefined) {
    // Existing user without mode setting
    // Default to 'advanced' since they already have all features
    await chrome.storage.local.set({
      settings: { ...settings, mode: 'advanced' },
    });
  }
}

// Call on startup
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'update') {
    await migrateSettings();
  }
});
```

---

## Summary Checklist

| Task | Location |
|------|----------|
| Add `AppMode` type | `types/index.ts` |
| Add `mode` to settings schema | `types/index.ts` |
| Create `useAppMode` hook | `hooks/useAppMode.ts` |
| Create `ModeToggle` component | `components/ModeToggle.tsx` |
| Add toggle to Settings page | `pages/SettingsPage.tsx` |
| Conditionally render Stats/History/Insights | `pages/OptionsPage.tsx` |
| Conditionally show preset edit button | `components/PresetSelector.tsx` |
| Hide auto-start in Simple mode | `pages/SettingsPage.tsx` |
| Hide export/clear in Simple mode | `pages/SettingsPage.tsx` |
| Migrate existing users to `advanced` | `background/service-worker.js` |

---

## Prompt for Claude Code

```
Implement Simple/Advanced mode toggle following MODE_TOGGLE_IMPLEMENTATION.md.

Key points:
1. Add 'mode' field to settings ('simple' | 'advanced')
2. Create useAppMode hook for accessing mode
3. Create ModeToggle component with card-style selector
4. Add toggle to top of Settings page
5. In Simple mode, hide:
   - Stats, Insights, History sections
   - Preset create/edit/delete
   - Auto-start toggle
   - Export and Clear history buttons
6. Keep visible in both modes:
   - Timer, controls, preset selection
   - Notifications, sound, badge, theme
7. Existing users default to 'advanced'
8. New users default to 'simple'
9. History tracking stays on in both modes
```

---

## Testing Checklist

1. ☐ New install defaults to Simple mode
2. ☐ Existing user upgrade defaults to Advanced mode
3. ☐ Toggle switches modes instantly
4. ☐ Simple mode hides stats/history/insights
5. ☐ Simple mode hides preset editing
6. ☐ Simple mode hides auto-start toggle
7. ☐ Simple mode hides export/clear buttons
8. ☐ Timer works identically in both modes
9. ☐ Sessions still recorded in Simple mode
10. ☐ Switching to Advanced shows accumulated history
