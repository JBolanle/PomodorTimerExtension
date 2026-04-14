# Data Model & Schema Design

This document specifies every data structure in the Pomodoro Timer Extension — what is persisted, what lives only in memory, and where the gaps are.

---

## Entity Definitions

### TimerState

The core state machine for the timer. Owned exclusively by the service worker; the popup reads it via `getState` message.

| Field | Type | Description |
|---|---|---|
| `state` | `'idle' \| 'running' \| 'paused' \| 'transition'` | Current FSM state |
| `endTime` | `number \| null` | Unix ms when running timer expires |
| `remainingMs` | `number \| null` | Ms remaining when paused |
| `sessionStartedAt` | `number \| null` | Unix ms when current phase started |
| `currentPhase` | `'work' \| 'shortBreak' \| 'longBreak'` | Active timer mode |
| `workSessionsCompleted` | `number` | Work sessions done in current cycle (resets after long break) |
| `suggestedNext` | `TimerMode \| null` | Phase suggested after completion/skip |
| `lastCompletedDurationMs` | `number \| null` | Actual duration of last completed phase |
| `activePresetId` | `string` | ID of the currently active preset |
| `autoStartNext` | `boolean` | Whether to auto-start the next phase |
| `totalPausedMs` | `number` | Accumulated pause time for current phase |
| `pausedAt` | `number \| null` | Unix ms when timer was paused |
| `currentNote` | `string \| null` | Note for current session (advanced mode) |
| `currentTags` | `string[]` | Tags for current session (advanced mode) |

**Note:** `currentNote` and `currentTags` are part of TimerState in the service worker but are NOT included in the TypeScript `TimerState` interface (`src/types/index.ts`). This is a type safety gap — the popup accesses these via `getSessionMeta` / `setSessionMeta` messages instead.

### Preset

Timer duration configuration. Multiple presets supported; one is active at a time.

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique identifier (`'default'` for built-in) |
| `name` | `string` | Display name |
| `workMinutes` | `number` | Work session duration (1-60) |
| `shortBreakMinutes` | `number` | Short break duration (1-30) |
| `longBreakMinutes` | `number` | Long break duration (1-60) |
| `sessionsBeforeLongBreak` | `number` | Work sessions before long break (1-10) |

**Default values:** 25 / 5 / 15 / 4

### Settings

User preferences. Read/written directly by the options page via `chrome.storage.local` (bypasses service worker).

| Field | Type | Default | Description |
|---|---|---|---|
| `mode` | `'simple' \| 'advanced'` | `'simple'` | App mode |
| `notificationsEnabled` | `boolean` | `true` | Desktop notifications |
| `autoStartNext` | `boolean` | `false` | Auto-start next phase |
| `showBadge` | `boolean` | `true` | Show remaining time on icon |
| `soundEnabled` | `boolean` | `true` | Play sounds on completion |
| `soundVolume` | `number` | `1.0` | Volume (0-1) |
| `soundPerPhase` | `boolean` | `true` | Different sounds per phase |
| `workCompleteSound` | `string` | `'work'` | Sound key for work completion |
| `breakCompleteSound` | `string` | `'short-break'` | Sound key for break completion |
| `showBreakTips` | `boolean` | `true` | Show motivational tips during breaks |

**Note:** The service worker also reads `settings` from storage (for `notificationsEnabled`, `autoStartNext`, `soundEnabled`, `soundVolume`, `soundPerPhase`, `workCompleteSound`, `breakCompleteSound`) but there is no coordination — the options page writes directly to storage and the service worker reads on next access.

### Session

A grouped Pomodoro cycle: one or more work phases and breaks bundled together.

| Field | Type | Description |
|---|---|---|
| `id` | `string` | UUID |
| `startedAt` | `number` | Unix ms when session started |
| `endedAt` | `number \| null` | Unix ms when session closed |
| `status` | `'active' \| 'completed' \| 'ended'` | How the session concluded |
| `phases` | `PhaseRecord[]` | Ordered list of work/break phases |
| `totalFocusMs` | `number` | Accumulated work time |
| `totalBreakMs` | `number` | Accumulated break time |
| `presetId` | `string` | Preset used for this session |
| `presetName` | `string` | Preset name (denormalized for display) |
| `note` | `string?` | Optional session note |
| `tags` | `string[]?` | Optional session tags |

### PhaseRecord

An individual work or break phase within a session.

| Field | Type | Description |
|---|---|---|
| `id` | `string` | UUID |
| `mode` | `'work' \| 'shortBreak' \| 'longBreak'` | Phase type |
| `plannedDurationMs` | `number` | Intended duration |
| `actualDurationMs` | `number` | Actual elapsed time |
| `completionType` | `'completed' \| 'skipped' \| 'ended'` | How this phase ended |
| `startedAt` | `number` | Unix ms |
| `completedAt` | `number` | Unix ms |
| `note` | `string?` | (Defined in type but not populated by service worker) |
| `tags` | `string[]?` | (Defined in type but not populated by service worker) |

### FocusModeSettings

Configuration for the site-blocking focus mode.

| Field | Type | Default | Description |
|---|---|---|---|
| `enabled` | `boolean` | `true` | Master toggle |
| `categories` | `Record<string, boolean>` | `{ social: true, video: true, news: false, shopping: false, gaming: false }` | Which blocklists are active |
| `customDomains` | `string[]` | `[]` | User-added domains |
| `allowOnceMinutes` | `number` | `5` | Duration for temporary unblock |

---

## Storage Key Registry

All keys written to `chrome.storage.local`:

| Key | Type | Written By | Read By | Default |
|---|---|---|---|---|
| `state` | `string` | SW (persistState) | SW (loadState) | `'idle'` |
| `endTime` | `number \| null` | SW | SW | `null` |
| `remainingMs` | `number \| null` | SW | SW | `null` |
| `sessionStartedAt` | `number \| null` | SW | SW | `null` |
| `currentPhase` | `string` | SW | SW | `'work'` |
| `workSessionsCompleted` | `number` | SW | SW | `0` |
| `suggestedNext` | `string \| null` | SW | SW | `null` |
| `lastCompletedDurationMs` | `number \| null` | SW | SW | `null` |
| `activePresetId` | `string` | SW | SW | `'default'` |
| `autoStartNext` | `boolean` | SW | SW | `false` |
| `totalPausedMs` | `number` | SW | SW | `0` |
| `pausedAt` | `number \| null` | SW | SW | `null` |
| `currentNote` | `string \| null` | SW | SW | `null` |
| `currentTags` | `string[]` | SW | SW | `[]` |
| `currentSession` | `Session \| null` | SW (persistState) | SW (loadState) | `null` |
| `sessions` | `Session[]` | SW (closeCurrentSession) | Options (useHistory) | `[]` |
| `presets` | `Preset[]` | SW (savePreset, deletePreset, migration) | SW (getPresets, getActivePreset) | `[DEFAULT_PRESET]` |
| `settings` | `Settings` | Options (useSettings) | SW (handleTimerComplete, playNotificationSound), Options (useSettings) | See Settings defaults |
| `focusModeSettings` | `FocusModeSettings` | SW (updateFocusModeSettings) | SW (enableFocusMode, getFocusModeSettings), Options (FocusModeSettings component) | See FocusModeSettings defaults |
| `tagHistory` | `string[]` | SW (addTagsToHistory) | SW (getTagHistory) | `[]` |
| `theme` | `string` | Popup/Options (useTheme) | Popup/Options (useTheme) | `'arctic'` |

**SW** = Service Worker, **Options** = Options page, **Popup** = Popup page

### Legacy Keys (migrated away)

These keys existed in the old schema and are cleaned up during migration:

| Key | Replaced By |
|---|---|
| `running` (boolean) | `state` (string enum) |
| `paused` (boolean) | `state` (string enum) |
| `completedSessions` | `workSessionsCompleted` |
| `sessionTotalMs` | Removed (calculated from preset) |
| `sessionHistory` (old format) | `sessions` (new grouped format) |

---

## In-Memory-Only State

State that exists only in the service worker's JavaScript runtime and is **lost when the service worker is killed**:

| Variable | Type | Purpose | Persistence Issue |
|---|---|---|---|
| `focusRuleMap` | `Map<string, number>` | Maps domain → declarativeNetRequest rule ID | Rules survive in Chrome's DNR engine, but the SW loses the mapping. Cannot remove specific rules without this map. |
| `temporaryAllows` | `Map<string, { ruleId, expiresAt }>` | Tracks "allow once" temporary unblocks | Completely lost on restart. Allowed domains remain unblocked until focus mode is fully re-enabled. |
| `cachedPresets` | `Preset[] \| null` | Cached preset list to avoid storage reads | Harmless — just a performance cache, re-populated on next `getActivePreset()` call. |
| `cachedActivePresetId` | `string \| null` | Cached active preset ID | Same as above. |
| `showBadge` | `boolean` | Cached badge setting | Defaults to `true` on restart; re-read from settings on next timer event. |
| `creatingOffscreen` | `Promise \| null` | Dedup lock for offscreen document creation | Harmless — only relevant during active sound playback. |

### Recovery on Service Worker Wake

When the service worker restarts (`loadState()`):
1. Timer state keys are restored from storage (the 14 STATE_KEYS + currentSession)
2. If `state === 'running'` and `endTime` has passed → calls `handleTimerComplete()`
3. If `state === 'running'` and `endTime` is in the future → alarm already exists in Chrome, will fire normally
4. Focus mode rules remain active in Chrome's DNR engine but `focusRuleMap` is empty — the SW cannot selectively modify or remove rules until focus mode is fully re-enabled

---

## Known Issues

1. **Focus mode state not persisted**: `focusRuleMap` and `temporaryAllows` are lost on SW restart. The DNR rules remain active but become unmanageable.

2. **Duplicate DEFAULT_PRESET**: Defined in both `public/background/service-worker.js` (line 9) and `src/lib/constants.ts` (line 3). Changes must be synchronized manually.

3. **Session cap**: Sessions stored as a flat array capped at `MAX_SESSIONS = 200` with oldest records dropped. No pagination, indexing, or archival strategy.

4. **Settings split ownership**: `settings` key is written by the Options page (via `useSettings`) and read by the service worker (for notifications, sound, auto-start, badge). No locking or coordination mechanism.

5. **PhaseRecord note/tags**: The TypeScript interface defines optional `note` and `tags` fields on `PhaseRecord`, but the service worker never populates them — notes/tags are only stored at the `Session` level.

6. **Tag history unbounded growth**: `tagHistory` is capped at 50 entries but never cleaned up when tags are no longer used.

7. **No storage quota handling**: The extension uses `chrome.storage.local` with a 10MB quota. There is a catch for persistence errors but no proactive quota management.
