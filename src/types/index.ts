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
}

export interface PhaseRecord {
  id: string;
  mode: TimerMode;
  plannedDurationMs: number;
  actualDurationMs: number;
  completionType: CompletionType;
  startedAt: number;
  completedAt: number;
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
}

export type DateFilterOption = 'today' | 'week' | 'month' | 'all' | 'custom';
