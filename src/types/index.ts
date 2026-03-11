export type Theme = 'arctic' | 'obsidian' | 'ember';

export type TimerMode = 'work' | 'shortBreak' | 'longBreak';

export type TimerStateEnum = 'idle' | 'running' | 'paused' | 'transition';

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
  notificationsEnabled: boolean;
  autoStartNext: boolean;
}

export interface SessionRecord {
  id: string;
  mode: TimerMode;
  plannedDurationMs: number;
  actualDurationMs: number;
  completionType: CompletionType;
  completedAt: number;
}
