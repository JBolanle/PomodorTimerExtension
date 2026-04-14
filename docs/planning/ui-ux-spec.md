# UI/UX Design Specification

Documents the current UI structure, component hierarchy, and interaction patterns. The rewrite preserves all current UI/UX — this spec is a contract for what must remain functional after the architecture rewrite.

---

## Popup

**Container**: 350px fixed width. Opens on toolbar icon click. Ephemeral — destroyed when closed.

### Layout (vertical stack)

```
┌────────────────────────────────┐
│  Phase Label (Work / Break)    │  ← only when running/paused/transition
│         ┌──────────┐            │
│         │  25:00   │            │  ← TimerDisplay (large MM:SS)
│         └──────────┘            │
│   • • • ○ ○                     │  ← SessionDots (work sessions in cycle)
│  [Note + tag chips]             │  ← only in advanced mode if set
├────────────────────────────────┤
│  [Preset Selector ▾]            │  ← only when idle
│  [Start] [Pause] [Skip] [End]  │  ← state-dependent controls
├────────────────────────────────┤
│  💡 Break tip text...            │  ← only during breaks if enabled
├────────────────────────────────┤
│  [Theme] [Settings] [Shortcuts] │  ← footer
└────────────────────────────────┘
```

### State-Dependent Views

| Timer State | Primary UI |
|---|---|
| `idle` | Preset selector + Start button |
| `running` | TimerDisplay + Pause / Skip / End controls |
| `paused` | TimerDisplay (frozen) + Resume / Skip / End controls |
| `transition` | "Phase complete" message + suggested next phase + Start Next button |

### Modals

- **StartSessionModal** (advanced mode, before work session): Note input, tag input with autocomplete, focus mode toggle, Skip / Start buttons.

---

## Options Page

**Container**: Full-page with sidebar navigation. Routed via React Router HashRouter.

### Layout

```
┌──────────────┬─────────────────────────────────────┐
│  Pomodoro    │  Page Title                          │
│              │  Page Description                     │
│  ⏱ Timer     │  ─────────────────────                │
│  ⚙ Settings  │                                       │
│  📊 History  │  [Page Content]                       │
│  (advanced)  │                                       │
│              │                                       │
│  ─ ─ ─ ─ ─   │                                       │
│  Mode toggle │                                       │
│  Theme       │                                       │
└──────────────┴─────────────────────────────────────┘
```

### Pages

#### `/timer` — Timer Page
- Mirrors the popup timer UI in a larger format
- Same controls and state-dependent views
- Useful for users who keep the options page open

#### `/settings` — Settings Page
- Mode toggle (Simple / Advanced)
- Preset management (Default + custom presets, edit/delete, add new in advanced)
- Notification settings (toggle)
- Sound settings (toggle, volume slider, per-phase sounds, sound dropdowns)
- Show badge toggle (advanced)
- Show break tips toggle
- Auto-start next toggle (advanced)
- Focus mode settings (advanced) — master toggle, category checkboxes, custom domain list, allow-once duration
- Keyboard shortcuts reference
- Theme picker (radio grid)
- Restore defaults button

#### `/history` — History & Stats Page (advanced only)
- Date filter (Today / Week / Month / All / Custom)
- Tag filter (multi-select)
- Stats overview (total focus, total sessions, average length)
- Insights section (collapsible):
  - Streak card
  - Trend comparison (week-over-week)
  - Weekly focus chart (Recharts bar chart)
  - Productive hours chart (heatmap-style)
- Session list (scrollable)
- Export dropdown (CSV / JSON)
- Import modal (file upload, merge/replace mode)
- Clear history button (with confirmation modal)

---

## Theme System

### Themes

| Theme | Style | Notes |
|---|---|---|
| **Arctic** | Light, frosted | Default. Soft text shadows with blue undertones. |
| **Obsidian** | Dark, chrome-extruded | Gray text shadows for embossed effect. |
| **Ember** | Warm, golden | Golden gradient text, drop shadows, radial glow effect. |

### Implementation

- CSS custom properties on `:root` and `[data-theme="<theme>"]` selectors
- `data-theme` attribute on `<html>` element
- Theme-specific effects (text shadows, glows, session dot styling) defined in `src/styles/globals.css`
- Variables: `--background`, `--foreground`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--radius` (all HSL)

### Switching

- `useTheme` hook reads/writes `theme` storage key
- Sets `data-theme` attribute on document root
- Cross-tab sync via `chrome.storage.onChanged`
- Theme picker UI: radio button grid in settings; cycle button in popup

---

## Component Inventory

### Timer Components (`src/components/timer/`)

| Component | Responsibility |
|---|---|
| `TimerDisplay` | Renders MM:SS countdown with theme-specific text effects |
| `TimerControls` | Start/Pause/Resume/Skip/End buttons, state-dependent |
| `PresetSelector` | Dropdown to select active preset (when idle, multiple presets exist) |
| `SessionDots` | Visual indicator of work sessions completed in current cycle |
| `SessionMetaInput` | Note + tag input fields (advanced) |
| `CurrentSessionMeta` | Display current note/tags during session (advanced) |
| `StartSessionModal` | Modal for note/tag entry + focus mode toggle before starting work |
| `BreakTip` | Random motivational tip during breaks |
| `ModeSelector` | Manual phase selector (work/short/long break) |

### Settings Components (`src/components/settings/`)

| Component | Responsibility |
|---|---|
| `ThemePicker` | Radio grid for theme selection |
| `ModeToggle` | Simple/Advanced mode switch |
| `KeyboardShortcuts` | Reference list of keyboard shortcuts |
| `FocusModeSettings` | Focus mode config (toggle, categories, custom domains, allow-once) |

### History Components (`src/components/history/`)

| Component | Responsibility |
|---|---|
| `HistoryList` | Scrollable session list with notes/tags |
| `StatsOverview` | Total focus, count, average display |
| `InsightsContent` | Container for charts and metrics |
| `StreakCard` | Current consecutive-day streak |
| `TrendComparison` | Week-over-week comparison |
| `WeeklyFocusChart` | Recharts bar chart by day of week |
| `ProductiveHoursChart` | Heatmap of productive hours |
| `DateFilter` | Today/week/month/all/custom date range |
| `TagFilter` | Multi-select tag filter |
| `ExportDropdown` | CSV/JSON export menu |
| `ImportModal` | File upload + merge/replace mode |
| `ClearHistoryModal` | Confirmation dialog |
| `CollapsibleSection` | Accordion wrapper |

### Layout Components (`src/components/layout/`)

| Component | Responsibility |
|---|---|
| `Sidebar` | Navigation + mode/theme controls |
| `PageHeader` | Title + description for each page |

### shadcn/ui Primitives (`src/components/ui/`)

`Button`, `Slider`, `Switch`, `Select`, `Separator`, `Tabs`, `Toast`

### Cross-Cutting Components

| Component | Responsibility |
|---|---|
| `Announcer` | ARIA live region for screen reader announcements |
| `ErrorBoundary` | Catches React errors with retry UI |

---

## Interaction Patterns

### Communication with Service Worker

**Current**: 500ms polling via `getTimerState()`.
**After rewrite**: `chrome.runtime.Port` long-lived connection. SW pushes state changes; popup ticks display locally between updates.

### Modals

- Use `useFocusTrap()` hook to keep keyboard focus inside
- Restore previous focus on close
- Closeable via Escape key

### Toasts

- Bottom-left fixed position
- `role="alert"`, `aria-live="polite"`
- Auto-dismiss after configurable duration
- Types: success / error / info

### Connection Loss

- `useConnectionStatus()` pings SW periodically
- On disconnect: alert bar appears in popup and options page header with reload button

### Storage Sync

- `useSettings`, `useHistory`, `useTheme` listen to `chrome.storage.onChanged`
- Updates propagate across popup and options page tabs automatically

---

## Accessibility Patterns

- **Announcer**: Screen reader announcements for state changes (start, pause, complete, transitions) and periodic time updates
- **ARIA labels**: All interactive elements
- **`role` attributes**: Semantic meaning where HTML elements are insufficient
- **`sr-only` class**: Screen-reader-only descriptive text
- **Focus trap**: All modals
- **Focus restoration**: On modal close
- **Keyboard operability**: Every feature accessible without mouse
- **Color independence**: Visual states communicated through text and icons, not just color

---

## Constraints

- **Popup width fixed**: 350px (browser-controlled, not resizable)
- **Popup height**: Variable based on content; browser will scroll if too tall
- **Options page**: Full page; sidebar fixed at left
- **Modal backdrop**: Within the popup or page only (cannot overlay browser chrome)
