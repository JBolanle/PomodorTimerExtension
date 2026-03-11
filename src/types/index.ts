export type Theme = 'arctic' | 'obsidian' | 'ember';

export type TimerMode = 'work' | 'shortBreak' | 'longBreak';

export interface TimerState {
  endTime: number | null;
  running: boolean;
  completedSessions: number;
}

export interface Settings {
  workMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  sessionsBeforeLongBreak: number;
  notificationsEnabled: boolean;
}

export interface SessionRecord {
  id: string;
  mode: TimerMode;
  duration: number; // minutes
  completedAt: number; // timestamp
}
