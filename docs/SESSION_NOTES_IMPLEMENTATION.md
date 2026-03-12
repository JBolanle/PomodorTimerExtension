# Session Notes & Tags Implementation

## Overview

Add optional notes and tags to sessions:
- **When**: Optional at start, editable during, shown on completion
- **Notes**: Free-form text describing what you're working on
- **Tags**: Quick labels for categorization, auto-suggested from history

---

## Data Schema Update

### Session Record

```typescript
// types/index.ts

export interface SessionRecord {
  id: string;
  mode: 'work' | 'shortBreak' | 'longBreak';
  plannedDurationMs: number;
  actualDurationMs: number;
  completionType: 'completed' | 'skipped' | 'ended';
  completedAt: number;
  
  // New fields
  note?: string;        // Free-form text, max ~200 chars
  tags?: string[];      // Array of tag strings
}
```

### Timer State

```typescript
// Add to timerState in service worker

let timerState = {
  // ... existing fields
  currentNote: null,    // Note for current session
  currentTags: [],      // Tags for current session
};
```

### Storage for Tag History

```typescript
// Stored separately for quick access
// Key: 'tagHistory'
// Value: string[] - unique tags used, most recent first
```

---

## 1. Tag History Utility

```typescript
// utils/tags.ts

const MAX_TAG_HISTORY = 50;

export async function getTagHistory(): Promise<string[]> {
  const { tagHistory } = await chrome.storage.local.get('tagHistory');
  return tagHistory || [];
}

export async function addTagsToHistory(tags: string[]): Promise<void> {
  if (!tags || tags.length === 0) return;
  
  const { tagHistory } = await chrome.storage.local.get('tagHistory');
  const existing = tagHistory || [];
  
  // Add new tags to front, remove duplicates, limit size
  const updated = [...new Set([...tags, ...existing])].slice(0, MAX_TAG_HISTORY);
  
  await chrome.storage.local.set({ tagHistory: updated });
}

export function normalizeTags(input: string): string[] {
  // Split by comma or space, trim, lowercase, remove empty
  return input
    .split(/[,\s]+/)
    .map(t => t.trim().toLowerCase())
    .filter(t => t.length > 0 && t.length <= 30)
    .slice(0, 10); // Max 10 tags per session
}
```

---

## 2. Service Worker Updates

### State Updates

```javascript
// background/service-worker.js

// Add to STATE_KEYS
const STATE_KEYS = [
  // ... existing
  'currentNote',
  'currentTags',
];

// Update default state
let timerState = {
  // ... existing
  currentNote: null,
  currentTags: [],
};
```

### Message Handlers

```javascript
// Add new message handlers

const messageHandlers = {
  // ... existing handlers
  
  setSessionMeta: async (msg) => {
    timerState.currentNote = msg.note ?? timerState.currentNote;
    timerState.currentTags = msg.tags ?? timerState.currentTags;
    await persistState();
    return { success: true };
  },
  
  getSessionMeta: async () => {
    return {
      note: timerState.currentNote,
      tags: timerState.currentTags,
    };
  },
  
  getTagHistory: async () => {
    const { tagHistory } = await chrome.storage.local.get('tagHistory');
    return tagHistory || [];
  },
};
```

### Update recordSession

```javascript
// Modify recordSession to include note and tags

async function recordSession(mode, plannedDurationMs, actualDurationMs, completionType) {
  const record = {
    id: crypto.randomUUID(),
    mode,
    plannedDurationMs,
    actualDurationMs: Math.max(0, actualDurationMs),
    completionType,
    completedAt: Date.now(),
    
    // Add note and tags (only for work sessions)
    ...(mode === 'work' && timerState.currentNote && { 
      note: timerState.currentNote 
    }),
    ...(mode === 'work' && timerState.currentTags?.length > 0 && { 
      tags: timerState.currentTags 
    }),
  };
  
  // Save to history
  const { sessionHistory } = await chrome.storage.local.get('sessionHistory');
  const history = sessionHistory || [];
  history.push(record);
  await chrome.storage.local.set({ sessionHistory: history });
  
  // Update tag history
  if (mode === 'work' && timerState.currentTags?.length > 0) {
    await addTagsToHistory(timerState.currentTags);
  }
  
  // Clear current session meta after recording
  timerState.currentNote = null;
  timerState.currentTags = [];
}

async function addTagsToHistory(tags) {
  const { tagHistory } = await chrome.storage.local.get('tagHistory');
  const existing = tagHistory || [];
  const updated = [...new Set([...tags, ...existing])].slice(0, 50);
  await chrome.storage.local.set({ tagHistory: updated });
}
```

### Clear on Reset/End

```javascript
// In doEndActivity and resetTimer, clear session meta

async function doEndActivity() {
  // ... existing code
  
  timerState.currentNote = null;
  timerState.currentTags = [];
  
  // ... rest
}
```

---

## 3. Session Meta Input Component

```tsx
// components/SessionMetaInput.tsx
import { useState, useEffect, useRef } from 'react';
import { Tag, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SessionMetaInputProps {
  note: string;
  tags: string[];
  onUpdate: (note: string, tags: string[]) => void;
  compact?: boolean; // For inline display during timer
}

export function SessionMetaInput({ 
  note, 
  tags, 
  onUpdate,
  compact = false 
}: SessionMetaInputProps) {
  const [localNote, setLocalNote] = useState(note);
  const [localTags, setLocalTags] = useState<string[]>(tags);
  const [tagInput, setTagInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load tag history for suggestions
  useEffect(() => {
    loadTagHistory();
  }, []);

  async function loadTagHistory() {
    const response = await chrome.runtime.sendMessage({ action: 'getTagHistory' });
    if (response) {
      setSuggestions(response);
    }
  }

  // Sync with parent
  useEffect(() => {
    setLocalNote(note);
    setLocalTags(tags);
  }, [note, tags]);

  function handleNoteChange(value: string) {
    setLocalNote(value);
    onUpdate(value, localTags);
  }

  function handleAddTag(tag: string) {
    const normalized = tag.trim().toLowerCase();
    if (!normalized || localTags.includes(normalized)) return;
    
    const newTags = [...localTags, normalized];
    setLocalTags(newTags);
    setTagInput('');
    setShowSuggestions(false);
    onUpdate(localNote, newTags);
  }

  function handleRemoveTag(tag: string) {
    const newTags = localTags.filter(t => t !== tag);
    setLocalTags(newTags);
    onUpdate(localNote, newTags);
  }

  function handleTagInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag(tagInput);
    } else if (e.key === 'Backspace' && !tagInput && localTags.length > 0) {
      handleRemoveTag(localTags[localTags.length - 1]);
    }
  }

  const filteredSuggestions = suggestions
    .filter(s => 
      s.includes(tagInput.toLowerCase()) && 
      !localTags.includes(s)
    )
    .slice(0, 5);

  if (compact) {
    return (
      <div className="w-full space-y-2">
        {/* Compact tag display */}
        {localTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {localTags.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/20 text-primary text-xs rounded-full"
              >
                {tag}
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="hover:text-primary/70"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        
        {/* Compact note display */}
        {localNote && (
          <p className="text-xs text-muted-foreground truncate">
            📝 {localNote}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      {/* Note input */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground flex items-center gap-1">
          <FileText className="w-3 h-3" />
          What are you working on?
        </label>
        <input
          type="text"
          value={localNote}
          onChange={(e) => handleNoteChange(e.target.value)}
          placeholder="e.g., Quarterly report draft"
          maxLength={200}
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      {/* Tags input */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground flex items-center gap-1">
          <Tag className="w-3 h-3" />
          Tags (optional)
        </label>
        
        <div className="relative">
          <div className="flex flex-wrap gap-1 p-2 border border-border rounded-lg bg-background min-h-[42px]">
            {localTags.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/20 text-primary text-xs rounded-full"
              >
                {tag}
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="hover:text-primary/70"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <input
              ref={inputRef}
              type="text"
              value={tagInput}
              onChange={(e) => {
                setTagInput(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              onKeyDown={handleTagInputKeyDown}
              placeholder={localTags.length === 0 ? "Add tags..." : ""}
              className="flex-1 min-w-[80px] text-sm bg-transparent outline-none"
            />
          </div>

          {/* Tag suggestions dropdown */}
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-10">
              {filteredSuggestions.map(suggestion => (
                <button
                  key={suggestion}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleAddTag(suggestion);
                  }}
                  className="w-full px-3 py-2 text-sm text-left hover:bg-muted transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
        
        <p className="text-xs text-muted-foreground">
          Press Enter or comma to add
        </p>
      </div>
    </div>
  );
}
```

---

## 4. Start Session Modal (Optional Input)

Create a modal that optionally shows before starting a work session:

```tsx
// components/StartSessionModal.tsx
import { useState } from 'react';
import { Play, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SessionMetaInput } from './SessionMetaInput';

interface StartSessionModalProps {
  presetName: string;
  duration: number;
  onStart: (note: string, tags: string[]) => void;
  onSkip: () => void;
  onCancel: () => void;
}

export function StartSessionModal({
  presetName,
  duration,
  onStart,
  onSkip,
  onCancel,
}: StartSessionModalProps) {
  const [note, setNote] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  function handleStart() {
    onStart(note, tags);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border border-border rounded-lg p-5 w-[340px] max-w-[90vw]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Start Work Session</h3>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="text-sm text-muted-foreground mb-4">
          {presetName} · {duration} minutes
        </div>

        <SessionMetaInput
          note={note}
          tags={tags}
          onUpdate={(n, t) => {
            setNote(n);
            setTags(t);
          }}
        />

        <div className="flex gap-2 mt-5">
          <Button variant="outline" onClick={onSkip} className="flex-1">
            Skip
          </Button>
          <Button onClick={handleStart} className="flex-1 gap-2">
            <Play className="w-4 h-4" />
            Start
          </Button>
        </div>
      </div>
    </div>
  );
}
```

---

## 5. Edit During Session (Popup)

Add an edit button/section when timer is running:

```tsx
// components/CurrentSessionMeta.tsx
import { useState, useEffect } from 'react';
import { Edit2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SessionMetaInput } from './SessionMetaInput';

interface CurrentSessionMetaProps {
  visible: boolean; // Only show during work sessions
}

export function CurrentSessionMeta({ visible }: CurrentSessionMetaProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [note, setNote] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    if (visible) {
      loadMeta();
    }
  }, [visible]);

  async function loadMeta() {
    const response = await chrome.runtime.sendMessage({ action: 'getSessionMeta' });
    if (response) {
      setNote(response.note || '');
      setTags(response.tags || []);
    }
  }

  async function saveMeta(newNote: string, newTags: string[]) {
    setNote(newNote);
    setTags(newTags);
    await chrome.runtime.sendMessage({
      action: 'setSessionMeta',
      note: newNote,
      tags: newTags,
    });
  }

  if (!visible) return null;

  // Compact display when not editing
  if (!isEditing) {
    const hasMeta = note || tags.length > 0;
    
    return (
      <div className="w-full">
        {hasMeta ? (
          <div className="flex items-start justify-between gap-2 p-3 bg-muted/30 rounded-lg">
            <div className="flex-1 min-w-0">
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1">
                  {tags.map(tag => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 bg-primary/20 text-primary text-xs rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {note && (
                <p className="text-sm text-muted-foreground truncate">{note}</p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsEditing(true)}
              className="shrink-0 h-8 w-8"
            >
              <Edit2 className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="w-full text-muted-foreground"
          >
            <Edit2 className="w-4 h-4 mr-2" />
            Add note or tags
          </Button>
        )}
      </div>
    );
  }

  // Edit mode
  return (
    <div className="w-full p-3 bg-muted/30 rounded-lg space-y-3">
      <SessionMetaInput
        note={note}
        tags={tags}
        onUpdate={saveMeta}
      />
      <Button
        size="sm"
        onClick={() => setIsEditing(false)}
        className="w-full gap-2"
      >
        <Check className="w-4 h-4" />
        Done
      </Button>
    </div>
  );
}
```

---

## 6. Popup Integration

```tsx
// pages/Popup.tsx

import { useState } from 'react';
import { StartSessionModal } from '../components/StartSessionModal';
import { CurrentSessionMeta } from '../components/CurrentSessionMeta';

export function Popup() {
  const { 
    state, 
    currentPhase,
    startTimer,
    // ... other hooks
  } = useTimer();
  
  const { activePreset } = usePresets();
  const { isAdvanced } = useAppMode();
  
  const [showStartModal, setShowStartModal] = useState(false);

  // Modified start handler - show modal in Advanced mode
  async function handleStartWork() {
    if (isAdvanced) {
      setShowStartModal(true);
    } else {
      // Simple mode - start immediately
      startTimer('work', activePreset.workMinutes);
    }
  }

  async function handleStartWithMeta(note: string, tags: string[]) {
    // Save meta first
    await chrome.runtime.sendMessage({
      action: 'setSessionMeta',
      note,
      tags,
    });
    // Then start
    startTimer('work', activePreset.workMinutes);
    setShowStartModal(false);
  }

  async function handleStartWithoutMeta() {
    startTimer('work', activePreset.workMinutes);
    setShowStartModal(false);
  }

  // Show current session meta during work
  const showSessionMeta = 
    isAdvanced &&
    (state === 'running' || state === 'paused') &&
    currentPhase === 'work';

  return (
    <div className="w-[350px] p-6 flex flex-col items-center gap-4">
      {/* ... phase indicator, timer display ... */}

      {/* Current session meta (Advanced mode, during work) */}
      <CurrentSessionMeta visible={showSessionMeta} />

      {/* ... controls, etc ... */}

      {/* Start session modal */}
      {showStartModal && (
        <StartSessionModal
          presetName={activePreset.name}
          duration={activePreset.workMinutes}
          onStart={handleStartWithMeta}
          onSkip={handleStartWithoutMeta}
          onCancel={() => setShowStartModal(false)}
        />
      )}
    </div>
  );
}
```

---

## 7. History - Display Notes & Tags

Update SessionItem to show notes/tags:

```tsx
// components/SessionItem.tsx (updated)

interface SessionItemProps {
  session: SessionRecord;
}

export function SessionItem({ session }: SessionItemProps) {
  const time = new Date(session.completedAt).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  const actualMinutes = Math.round(session.actualDurationMs / 60000);
  const hasMeta = session.note || (session.tags && session.tags.length > 0);

  return (
    <div className="p-3 bg-muted/20 rounded-lg space-y-2">
      {/* Top row: mode, time, duration */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`text-xs px-2 py-1 rounded ${MODE_COLORS[session.mode]}`}>
            {MODE_LABELS[session.mode]}
          </span>
          <span className="text-sm text-muted-foreground">{time}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm">{actualMinutes}m</span>
          <span className="text-xs">{COMPLETION_ICONS[session.completionType]}</span>
        </div>
      </div>

      {/* Meta row: tags and note */}
      {hasMeta && (
        <div className="pt-1 border-t border-border/50">
          {session.tags && session.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1">
              {session.tags.map(tag => (
                <span
                  key={tag}
                  className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          {session.note && (
            <p className="text-xs text-muted-foreground">{session.note}</p>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## 8. History - Filter by Tag

Add tag filtering to history section:

```tsx
// components/TagFilter.tsx
import { useState, useEffect } from 'react';
import { Tag, X } from 'lucide-react';

interface TagFilterProps {
  sessions: SessionRecord[];
  selectedTags: string[];
  onChange: (tags: string[]) => void;
}

export function TagFilter({ sessions, selectedTags, onChange }: TagFilterProps) {
  // Extract all unique tags from sessions
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    sessions.forEach(s => {
      s.tags?.forEach(t => tags.add(t));
    });
    return Array.from(tags).sort();
  }, [sessions]);

  function toggleTag(tag: string) {
    if (selectedTags.includes(tag)) {
      onChange(selectedTags.filter(t => t !== tag));
    } else {
      onChange([...selectedTags, tag]);
    }
  }

  if (allTags.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Tag className="w-3 h-3" />
        Filter by tag:
      </div>
      <div className="flex flex-wrap gap-1">
        {allTags.map(tag => {
          const isSelected = selectedTags.includes(tag);
          return (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`
                px-2 py-1 text-xs rounded-full transition-colors
                ${isSelected 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }
              `}
            >
              {tag}
              {isSelected && <X className="w-3 h-3 ml-1 inline" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

### Integrate into History Section

```tsx
// In HistoryStatsPage or History section

const [selectedTags, setSelectedTags] = useState<string[]>([]);

// Filter sessions by selected tags
const filteredByTags = useMemo(() => {
  if (selectedTags.length === 0) return filteredSessions;
  return filteredSessions.filter(s =>
    s.tags?.some(t => selectedTags.includes(t))
  );
}, [filteredSessions, selectedTags]);

// In JSX
<CollapsibleSection title="Session History">
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <DateFilter ... />
      <ClearHistoryButton ... />
    </div>
    
    {/* Tag filter */}
    <TagFilter
      sessions={sessions}
      selectedTags={selectedTags}
      onChange={setSelectedTags}
    />
    
    {/* Session list */}
    <SessionList sessions={filteredByTags} />
  </div>
</CollapsibleSection>
```

---

## Summary

### New Components

| Component | Purpose |
|-----------|---------|
| `SessionMetaInput` | Reusable note + tag input with suggestions |
| `StartSessionModal` | Optional modal before starting work |
| `CurrentSessionMeta` | Display/edit meta during running session |
| `TagFilter` | Filter history by tags |

### Schema Changes

| Location | Change |
|----------|--------|
| `SessionRecord` | Add `note?: string`, `tags?: string[]` |
| `timerState` | Add `currentNote`, `currentTags` |
| `chrome.storage` | Add `tagHistory: string[]` |

### Service Worker Changes

| Handler | Purpose |
|---------|---------|
| `setSessionMeta` | Update current session note/tags |
| `getSessionMeta` | Get current session note/tags |
| `getTagHistory` | Get autocomplete suggestions |
| `recordSession` | Include note/tags in saved record |

---

## Prompt for Claude Code

```
Implement session notes and tags following SESSION_NOTES_IMPLEMENTATION.md.

Key features:
1. Optional note + tags when starting work session (Advanced mode)
2. Edit note/tags during running session
3. Auto-suggest tags from history
4. Display notes/tags in session history
5. Filter history by tags

Service worker needs:
- setSessionMeta and getSessionMeta handlers
- Update recordSession to save note/tags
- Track tagHistory for suggestions

UI components:
- SessionMetaInput (reusable)
- StartSessionModal (shows before starting)
- CurrentSessionMeta (shows during work)
- TagFilter (in history)

Only show meta features in Advanced mode.
```

---

## Testing Checklist

1. ☐ Start session modal appears in Advanced mode
2. ☐ "Skip" starts without prompting for meta
3. ☐ Note saves and persists through session
4. ☐ Tags save and persist through session
5. ☐ Tag autocomplete shows previous tags
6. ☐ Tags added with Enter or comma
7. ☐ Tags removed with X or backspace
8. ☐ Edit button appears during work session
9. ☐ Meta clears after session ends
10. ☐ Note appears in session history
11. ☐ Tags appear in session history
12. ☐ Tag filter shows all unique tags
13. ☐ Tag filter correctly filters sessions
14. ☐ Multiple tag selection works (AND/OR)
15. ☐ Simple mode skips all meta features
16. ☐ Break sessions don't show meta input
