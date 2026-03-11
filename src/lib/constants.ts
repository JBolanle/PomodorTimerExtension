import type { Settings, Theme } from '@/types';

export const DEFAULTS: Settings = {
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
  notificationsEnabled: true,
};

export const THEMES: Theme[] = ['arctic', 'obsidian', 'ember'];

export const THEME_META: Record<Theme, { label: string; description: string }> = {
  arctic: { label: 'Arctic', description: 'Light, frosted' },
  obsidian: { label: 'Obsidian', description: 'Dark, chrome-extruded' },
  ember: { label: 'Ember', description: 'Warm, golden' },
};
