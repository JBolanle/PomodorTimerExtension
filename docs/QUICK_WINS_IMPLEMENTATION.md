# Quick Wins Implementation Guide

Three features in one guide:
1. Import Data (JSON backup restore)
2. Different Completion Sounds (per-phase sounds)
3. Break Suggestions (tips during breaks)

---

# Feature 1: Import Data

## Overview

Allow users to re-import a previously exported JSON backup. Options:
- **Merge**: Add imported sessions to existing history
- **Replace**: Clear existing data and use imported data

---

## 1.1 Import Utility Functions

```typescript
// utils/import.ts

import { SessionRecord, Preset } from '../types';

export interface ImportData {
  version: string;
  exportedAt: string;
  app: string;
  sessions: SessionRecord[];
  presets?: Preset[];
}

export interface ImportResult {
  success: boolean;
  sessionsImported: number;
  presetsImported: number;
  errors: string[];
}

export async function parseImportFile(file: File): Promise<ImportData> {
  const text = await file.text();
  const data = JSON.parse(text);
  
  // Validate structure
  if (!data.sessions || !Array.isArray(data.sessions)) {
    throw new Error('Invalid file: missing sessions array');
  }
  
  // Validate sessions have required fields
  for (const session of data.sessions) {
    if (!session.id || !session.mode || !session.completedAt) {
      throw new Error('Invalid session data: missing required fields');
    }
  }
  
  return data as ImportData;
}

export async function importData(
  data: ImportData,
  mode: 'merge' | 'replace'
): Promise<ImportResult> {
  const errors: string[] = [];
  let sessionsImported = 0;
  let presetsImported = 0;

  try {
    // Handle sessions
    if (mode === 'replace') {
      // Replace all existing sessions
      await chrome.storage.local.set({ sessionHistory: data.sessions });
      sessionsImported = data.sessions.length;
    } else {
      // Merge: add new sessions, skip duplicates by ID
      const { sessionHistory } = await chrome.storage.local.get('sessionHistory');
      const existing = sessionHistory || [];
      const existingIds = new Set(existing.map((s: SessionRecord) => s.id));
      
      const newSessions = data.sessions.filter(s => !existingIds.has(s.id));
      const merged = [...existing, ...newSessions];
      
      // Sort by completedAt
      merged.sort((a, b) => a.completedAt - b.completedAt);
      
      await chrome.storage.local.set({ sessionHistory: merged });
      sessionsImported = newSessions.length;
    }

    // Handle presets (optional, merge only - don't overwrite user's presets)
    if (data.presets && data.presets.length > 0) {
      const { presets } = await chrome.storage.local.get('presets');
      const existing = presets || [];
      const existingIds = new Set(existing.map((p: Preset) => p.id));
      
      const newPresets = data.presets.filter(p => !existingIds.has(p.id));
      
      if (newPresets.length > 0) {
        // Add with modified IDs to avoid conflicts
        const renamedPresets = newPresets.map(p => ({
          ...p,
          id: `imported-${p.id}`,
          name: `${p.name} (imported)`,
        }));
        
        await chrome.storage.local.set({ presets: [...existing, ...renamedPresets] });
        presetsImported = renamedPresets.length;
      }
    }

    return {
      success: true,
      sessionsImported,
      presetsImported,
      errors,
    };
  } catch (error) {
    return {
      success: false,
      sessionsImported: 0,
      presetsImported: 0,
      errors: [(error as Error).message],
    };
  }
}
```

---

## 1.2 Import Modal Component

```tsx
// components/ImportModal.tsx
import { useState, useRef } from 'react';
import { Upload, AlertCircle, CheckCircle, FileJson } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { parseImportFile, importData, ImportData, ImportResult } from '../utils/import';

interface ImportModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

type ImportStep = 'select' | 'preview' | 'importing' | 'result';
type ImportMode = 'merge' | 'replace';

export function ImportModal({ onClose, onSuccess }: ImportModalProps) {
  const [step, setStep] = useState<ImportStep>('select');
  const [mode, setMode] = useState<ImportMode>('merge');
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<ImportData | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);

    try {
      const parsed = await parseImportFile(selectedFile);
      setData(parsed);
      setStep('preview');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleImport() {
    if (!data) return;

    setStep('importing');

    const importResult = await importData(data, mode);
    setResult(importResult);
    setStep('result');

    if (importResult.success) {
      onSuccess();
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border border-border rounded-lg p-6 w-[420px] max-w-[90vw]">
        
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Upload className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-lg">Import Data</h3>
        </div>

        {/* Step: Select File */}
        {step === 'select' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Import a previously exported JSON backup file.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="hidden"
            />

            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-24 border-dashed flex flex-col gap-2"
            >
              <FileJson className="w-8 h-8 text-muted-foreground" />
              <span>Click to select JSON file</span>
            </Button>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && data && (
          <div className="space-y-4">
            <div className="bg-muted/30 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">File:</span>
                <span className="font-medium">{file?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sessions:</span>
                <span className="font-medium">{data.sessions.length}</span>
              </div>
              {data.presets && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Presets:</span>
                  <span className="font-medium">{data.presets.length}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Exported:</span>
                <span className="font-medium">
                  {new Date(data.exportedAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Import mode:</p>
              
              <label className="flex items-start gap-3 p-3 border border-border rounded-lg cursor-pointer hover:bg-muted/30">
                <input
                  type="radio"
                  name="importMode"
                  checked={mode === 'merge'}
                  onChange={() => setMode('merge')}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium text-sm">Merge</div>
                  <div className="text-xs text-muted-foreground">
                    Add imported sessions to existing history. Duplicates are skipped.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 border border-border rounded-lg cursor-pointer hover:bg-muted/30">
                <input
                  type="radio"
                  name="importMode"
                  checked={mode === 'replace'}
                  onChange={() => setMode('replace')}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium text-sm">Replace</div>
                  <div className="text-xs text-muted-foreground">
                    Clear existing sessions and use imported data only.
                  </div>
                </div>
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button onClick={handleImport}>Import</Button>
            </div>
          </div>
        )}

        {/* Step: Importing */}
        {step === 'importing' && (
          <div className="py-8 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Importing data...</p>
          </div>
        )}

        {/* Step: Result */}
        {step === 'result' && result && (
          <div className="space-y-4">
            {result.success ? (
              <div className="flex flex-col items-center py-4 text-center">
                <CheckCircle className="w-12 h-12 text-green-500 mb-3" />
                <p className="font-medium">Import successful!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {result.sessionsImported} session{result.sessionsImported !== 1 ? 's' : ''} imported
                  {result.presetsImported > 0 && `, ${result.presetsImported} preset${result.presetsImported !== 1 ? 's' : ''}`}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center py-4 text-center">
                <AlertCircle className="w-12 h-12 text-destructive mb-3" />
                <p className="font-medium">Import failed</p>
                <p className="text-sm text-destructive mt-1">
                  {result.errors.join(', ')}
                </p>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={onClose}>Done</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## 1.3 Add Import Button to Settings

In your data/export section of Settings:

```tsx
// In SettingsPage.tsx or HistoryStatsPage.tsx

import { ImportModal } from '../components/ImportModal';

// Inside the component:
const [showImportModal, setShowImportModal] = useState(false);

// In the JSX (near ExportDropdown):
<div className="flex gap-2">
  <Button
    variant="outline"
    size="sm"
    onClick={() => setShowImportModal(true)}
  >
    <Upload className="w-4 h-4 mr-2" />
    Import
  </Button>
  <ExportDropdown ... />
</div>

{showImportModal && (
  <ImportModal
    onClose={() => setShowImportModal(false)}
    onSuccess={() => {
      // Refresh data
      loadData();
    }}
  />
)}
```

---

# Feature 2: Different Completion Sounds

## Overview

Play different sounds based on which phase completed:
- **Work complete**: Triumphant chime
- **Short break complete**: Gentle, refreshing tone
- **Long break complete**: Calm, ready-to-go tone

---

## 2.1 Sound Files

Three MP3 files provided:
- `work-complete.mp3` (8KB) - Energetic, accomplished feel
- `short-break-complete.mp3` (5KB) - Light, refreshing
- `long-break-complete.mp3` (8KB) - Warm, calm

Copy these to `src/assets/sounds/` or your static assets folder.

---

## 2.2 Settings Schema Update

Add sound selection to settings:

```typescript
// types/index.ts

export type SoundOption = 'default' | 'work' | 'short-break' | 'long-break' | 'none';

export interface Settings {
  // ... existing fields
  soundEnabled: boolean;
  soundVolume: number;
  soundPerPhase: boolean; // New: use different sounds per phase
  workCompleteSound: SoundOption; // New
  breakCompleteSound: SoundOption; // New
}

export const DEFAULT_SETTINGS: Settings = {
  // ... existing
  soundEnabled: true,
  soundVolume: 1.0,
  soundPerPhase: true, // Default to phase-specific sounds
  workCompleteSound: 'work',
  breakCompleteSound: 'short-break',
};
```

---

## 2.3 Update Sound Playback Logic

```typescript
// In background/service-worker.js

const SOUNDS = {
  'default': 'assets/sounds/notification.mp3',
  'work': 'assets/sounds/work-complete.mp3',
  'short-break': 'assets/sounds/short-break-complete.mp3',
  'long-break': 'assets/sounds/long-break-complete.mp3',
};

async function playNotificationSound(phase) {
  const { settings } = await chrome.storage.local.get('settings');
  const soundEnabled = settings?.soundEnabled ?? true;
  
  if (!soundEnabled) return;
  
  // Determine which sound to play
  let soundKey = 'default';
  
  if (settings?.soundPerPhase) {
    if (phase === 'work') {
      soundKey = settings?.workCompleteSound || 'work';
    } else {
      // Both short and long breaks
      soundKey = settings?.breakCompleteSound || 'short-break';
      // Or use specific long-break sound:
      if (phase === 'longBreak') {
        soundKey = 'long-break';
      }
    }
  }
  
  const soundPath = SOUNDS[soundKey] || SOUNDS['default'];
  const volume = settings?.soundVolume ?? 1.0;

  try {
    if (chrome.offscreen) {
      await ensureOffscreenDocument();
      await chrome.runtime.sendMessage({
        action: 'playSound',
        sound: soundPath,
        volume: volume,
      });
    }
  } catch (error) {
    console.error('Failed to play sound:', error);
  }
}

// Update handleTimerComplete to pass phase
async function handleTimerComplete() {
  // ... existing code ...
  
  // Play sound with current phase
  await playNotificationSound(timerState.currentPhase);
  
  // ... rest of existing code ...
}
```

---

## 2.4 Sound Settings UI

```tsx
// components/SoundSettings.tsx
import { useState, useEffect } from 'react';
import { Volume2, VolumeX, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';

const SOUND_OPTIONS = [
  { id: 'default', label: 'Default chime' },
  { id: 'work', label: 'Work complete (triumphant)' },
  { id: 'short-break', label: 'Break complete (gentle)' },
  { id: 'long-break', label: 'Long break (calm)' },
];

const SOUND_FILES = {
  'default': 'assets/sounds/notification.mp3',
  'work': 'assets/sounds/work-complete.mp3',
  'short-break': 'assets/sounds/short-break-complete.mp3',
  'long-break': 'assets/sounds/long-break-complete.mp3',
};

interface SoundSettingsProps {
  settings: {
    soundEnabled: boolean;
    soundVolume: number;
    soundPerPhase: boolean;
    workCompleteSound: string;
    breakCompleteSound: string;
  };
  onUpdate: (updates: Partial<SoundSettingsProps['settings']>) => void;
}

export function SoundSettings({ settings, onUpdate }: SoundSettingsProps) {
  const [audioElement] = useState(() => new Audio());

  function previewSound(soundId: string) {
    const soundPath = chrome.runtime.getURL(SOUND_FILES[soundId] || SOUND_FILES['default']);
    audioElement.src = soundPath;
    audioElement.volume = settings.soundVolume;
    audioElement.play().catch(console.error);
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium flex items-center gap-2">
        <Volume2 className="w-4 h-4" />
        Sound Settings
      </h3>

      {/* Master toggle */}
      <div className="flex items-center justify-between">
        <span className="text-sm">Enable sounds</span>
        <Switch
          checked={settings.soundEnabled}
          onCheckedChange={(checked) => onUpdate({ soundEnabled: checked })}
        />
      </div>

      {settings.soundEnabled && (
        <>
          {/* Volume slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Volume</span>
              <span className="text-muted-foreground">
                {Math.round(settings.soundVolume * 100)}%
              </span>
            </div>
            <Slider
              value={[settings.soundVolume * 100]}
              onValueChange={([value]) => onUpdate({ soundVolume: value / 100 })}
              min={0}
              max={100}
              step={5}
            />
          </div>

          {/* Per-phase toggle */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm">Different sounds per phase</span>
              <p className="text-xs text-muted-foreground">
                Play different sounds for work and breaks
              </p>
            </div>
            <Switch
              checked={settings.soundPerPhase}
              onCheckedChange={(checked) => onUpdate({ soundPerPhase: checked })}
            />
          </div>

          {/* Sound selection (if per-phase enabled) */}
          {settings.soundPerPhase && (
            <div className="space-y-3 pl-4 border-l-2 border-border">
              {/* Work complete sound */}
              <div className="space-y-2">
                <span className="text-sm font-medium">Work complete</span>
                <div className="flex gap-2">
                  <select
                    value={settings.workCompleteSound}
                    onChange={(e) => onUpdate({ workCompleteSound: e.target.value })}
                    className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-background"
                  >
                    {SOUND_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                  </select>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => previewSound(settings.workCompleteSound)}
                  >
                    <Play className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Break complete sound */}
              <div className="space-y-2">
                <span className="text-sm font-medium">Break complete</span>
                <div className="flex gap-2">
                  <select
                    value={settings.breakCompleteSound}
                    onChange={(e) => onUpdate({ breakCompleteSound: e.target.value })}
                    className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-background"
                  >
                    {SOUND_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                  </select>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => previewSound(settings.breakCompleteSound)}
                  >
                    <Play className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

---

# Feature 3: Break Suggestions

## Overview

Show helpful tips during break phases:
- Stretch reminders
- Hydration prompts
- Movement suggestions
- Eye rest tips

---

## 3.1 Break Tips Data

```typescript
// data/breakTips.ts

export interface BreakTip {
  id: string;
  emoji: string;
  text: string;
  category: 'stretch' | 'hydrate' | 'move' | 'eyes' | 'breathe' | 'mindful';
}

export const BREAK_TIPS: BreakTip[] = [
  // Stretch
  { id: 's1', emoji: '🙆', text: 'Stretch your arms above your head', category: 'stretch' },
  { id: 's2', emoji: '🧘', text: 'Roll your shoulders back 5 times', category: 'stretch' },
  { id: 's3', emoji: '💆', text: 'Gently tilt your head side to side', category: 'stretch' },
  { id: 's4', emoji: '🤸', text: 'Stand up and touch your toes', category: 'stretch' },
  { id: 's5', emoji: '🙋', text: 'Stretch your wrists and fingers', category: 'stretch' },
  
  // Hydrate
  { id: 'h1', emoji: '💧', text: 'Drink a glass of water', category: 'hydrate' },
  { id: 'h2', emoji: '☕', text: 'Refill your water bottle', category: 'hydrate' },
  { id: 'h3', emoji: '🫖', text: 'Make yourself some tea', category: 'hydrate' },
  
  // Move
  { id: 'm1', emoji: '🚶', text: 'Take a short walk around the room', category: 'move' },
  { id: 'm2', emoji: '🏃', text: 'Do 10 jumping jacks', category: 'move' },
  { id: 'm3', emoji: '🪜', text: 'Walk up and down the stairs', category: 'move' },
  { id: 'm4', emoji: '🧍', text: 'Stand up and shake out your legs', category: 'move' },
  
  // Eyes
  { id: 'e1', emoji: '👀', text: 'Look at something 20 feet away for 20 seconds', category: 'eyes' },
  { id: 'e2', emoji: '😌', text: 'Close your eyes and relax for a moment', category: 'eyes' },
  { id: 'e3', emoji: '🌳', text: 'Look out the window at something green', category: 'eyes' },
  
  // Breathe
  { id: 'b1', emoji: '🌬️', text: 'Take 5 deep breaths', category: 'breathe' },
  { id: 'b2', emoji: '😮‍💨', text: 'Try box breathing: 4 in, 4 hold, 4 out, 4 hold', category: 'breathe' },
  { id: 'b3', emoji: '🧘‍♂️', text: 'Breathe in for 4, out for 8', category: 'breathe' },
  
  // Mindful
  { id: 'n1', emoji: '🪟', text: 'Step outside for fresh air', category: 'mindful' },
  { id: 'n2', emoji: '🎵', text: 'Listen to a favorite song', category: 'mindful' },
  { id: 'n3', emoji: '🌱', text: 'Check on your plants', category: 'mindful' },
  { id: 'n4', emoji: '😊', text: 'Text someone you appreciate', category: 'mindful' },
];

// Get a random tip (avoid repeating the last one)
let lastTipId: string | null = null;

export function getRandomBreakTip(): BreakTip {
  const available = BREAK_TIPS.filter(t => t.id !== lastTipId);
  const tip = available[Math.floor(Math.random() * available.length)];
  lastTipId = tip.id;
  return tip;
}

// Get a random tip from specific categories
export function getBreakTipByCategory(categories: BreakTip['category'][]): BreakTip {
  const filtered = BREAK_TIPS.filter(t => categories.includes(t.category));
  if (filtered.length === 0) return getRandomBreakTip();
  return filtered[Math.floor(Math.random() * filtered.length)];
}
```

---

## 3.2 Break Tip Component

```tsx
// components/BreakTip.tsx
import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getRandomBreakTip, BreakTip } from '../data/breakTips';

interface BreakTipProps {
  visible: boolean; // Only show during break phases
}

export function BreakTipDisplay({ visible }: BreakTipProps) {
  const [tip, setTip] = useState<BreakTip | null>(null);

  useEffect(() => {
    if (visible) {
      setTip(getRandomBreakTip());
    }
  }, [visible]);

  function refreshTip() {
    setTip(getRandomBreakTip());
  }

  if (!visible || !tip) return null;

  return (
    <div className="w-full bg-primary/10 border border-primary/20 rounded-lg p-3">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{tip.emoji}</span>
        <div className="flex-1">
          <p className="text-sm font-medium text-primary">Break suggestion</p>
          <p className="text-sm text-foreground mt-1">{tip.text}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={refreshTip}
          className="shrink-0 h-8 w-8 text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
```

---

## 3.3 Integrate into Popup

Show the break tip when in a break phase:

```tsx
// pages/Popup.tsx

import { BreakTipDisplay } from '../components/BreakTip';

export function Popup() {
  const { state, currentPhase } = useTimer();
  
  // Show break tip during break phases (running or transition after work)
  const showBreakTip = 
    (state === 'running' || state === 'paused') && 
    (currentPhase === 'shortBreak' || currentPhase === 'longBreak');

  return (
    <div className="w-[350px] p-6 flex flex-col items-center gap-4">
      {/* Phase indicator */}
      <PhaseIndicator ... />

      {/* Timer display */}
      <TimerDisplay ... />

      {/* Break tip - shown during breaks */}
      <BreakTipDisplay visible={showBreakTip} />

      {/* Controls */}
      <TimerControls ... />

      {/* ... rest of popup */}
    </div>
  );
}
```

---

## 3.4 Optional: Settings Toggle

Let users enable/disable break suggestions:

```typescript
// Add to settings
export interface Settings {
  // ... existing
  showBreakTips: boolean;
}

export const DEFAULT_SETTINGS = {
  // ... existing
  showBreakTips: true,
};
```

```tsx
// In Settings page
<div className="flex items-center justify-between">
  <div>
    <span className="text-sm">Break suggestions</span>
    <p className="text-xs text-muted-foreground">
      Show activity tips during breaks
    </p>
  </div>
  <Switch
    checked={settings.showBreakTips}
    onCheckedChange={(checked) => updateSettings({ showBreakTips: checked })}
  />
</div>
```

Update the popup to check the setting:

```tsx
const showBreakTip = 
  settings.showBreakTips &&
  (state === 'running' || state === 'paused') && 
  (currentPhase === 'shortBreak' || currentPhase === 'longBreak');
```

---

# Summary

## Files to Create/Update

| Feature | Files |
|---------|-------|
| **Import Data** | `utils/import.ts`, `components/ImportModal.tsx` |
| **Different Sounds** | Add 3 MP3s, update service worker, `components/SoundSettings.tsx` |
| **Break Suggestions** | `data/breakTips.ts`, `components/BreakTip.tsx` |

## Settings Additions

```typescript
interface Settings {
  // Import - no settings needed
  
  // Sounds
  soundPerPhase: boolean;
  workCompleteSound: string;
  breakCompleteSound: string;
  
  // Break tips
  showBreakTips: boolean;
}
```

---

# Prompt for Claude Code

```
Implement three quick win features following QUICK_WINS_IMPLEMENTATION.md.

## 1. Import Data
- Create parseImportFile and importData utilities
- Create ImportModal with merge/replace options
- Add Import button near Export in settings

## 2. Different Completion Sounds  
- Add the 3 new MP3 files to assets/sounds/
- Update playNotificationSound to select sound based on phase
- Create SoundSettings component with per-phase sound selection
- Add preview/play buttons for each sound

## 3. Break Suggestions
- Create breakTips.ts with tip data
- Create BreakTipDisplay component
- Show in popup during break phases
- Add showBreakTips toggle to settings

All features should respect Simple/Advanced mode where appropriate.
```

---

# Testing Checklist

## Import Data
1. ☐ File picker accepts only .json
2. ☐ Invalid JSON shows error
3. ☐ Preview shows session/preset counts
4. ☐ Merge mode adds new sessions only
5. ☐ Replace mode clears existing data
6. ☐ Success message shows count imported
7. ☐ History refreshes after import

## Different Sounds
8. ☐ Default sound plays if soundPerPhase disabled
9. ☐ Work-specific sound plays on work complete
10. ☐ Break-specific sound plays on break complete
11. ☐ Preview buttons play correct sounds
12. ☐ Volume slider affects all sounds
13. ☐ Mute toggle stops all sounds

## Break Suggestions
14. ☐ Tip appears during short break
15. ☐ Tip appears during long break
16. ☐ Tip hidden during work phase
17. ☐ Refresh button shows new tip
18. ☐ Setting toggle hides tips when disabled
