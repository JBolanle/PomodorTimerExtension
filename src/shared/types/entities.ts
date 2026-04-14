// Core entity types shared across background SW and React contexts.
// Canonical location; legacy `src/types/index.ts` re-exports from here.

export type Theme = 'arctic' | 'obsidian' | 'ember';

export type TimerMode = 'work' | 'shortBreak' | 'longBreak';

export type TimerStateEnum = 'idle' | 'running' | 'paused' | 'transition';

export type AppMode = 'simple' | 'advanced';

export type CompletionType = 'completed' | 'skipped' | 'ended';

export interface TimerState {
  state: TimerStateEnum;
  endTime: number | null;
  remainingMs: number | null;
  sessionStartedAt: number | null;
  currentPhase: TimerMode;
  workSessionsCompleted: number;
  suggestedNext: TimerMode | null;
  lastCompletedDurationMs: number | null;
  activePresetId: string;
  autoStartNext: boolean;
  totalPausedMs: number;
  pausedAt: number | null;
}

export interface Preset {
  id: string;
  name: string;
  workMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  sessionsBeforeLongBreak: number;
}

export interface Settings {
  mode: AppMode;
  notificationsEnabled: boolean;
  autoStartNext: boolean;
  showBadge: boolean;
  soundEnabled: boolean;
  soundVolume: number;
  soundPerPhase: boolean;
  workCompleteSound: string;
  breakCompleteSound: string;
  showBreakTips: boolean;
}

export interface PhaseRecord {
  id: string;
  mode: TimerMode;
  plannedDurationMs: number;
  actualDurationMs: number;
  completionType: CompletionType;
  startedAt: number;
  completedAt: number;
  note?: string;
  tags?: string[];
}

export interface Session {
  id: string;
  startedAt: number;
  endedAt: number | null;
  status: 'active' | 'completed' | 'ended';
  phases: PhaseRecord[];
  totalFocusMs: number;
  totalBreakMs: number;
  presetId: string;
  presetName: string;
  note?: string;
  tags?: string[];
}

export type DateFilterOption = 'today' | 'week' | 'month' | 'all' | 'custom';

export interface FocusModeSettings {
  enabled: boolean;
  categories: Record<string, boolean>;
  customDomains: string[];
  allowOnceMinutes: number;
}

export interface FocusModeStatus {
  active: boolean;
  blockedCount: number;
  temporaryAllows: string[];
}
