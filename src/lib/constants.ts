import type { Settings, Theme, Preset } from '@/types';

export const DEFAULT_PRESET: Preset = {
  id: 'default',
  name: 'Default',
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
};

export const DEFAULTS: Settings = {
  notificationsEnabled: true,
  autoStartNext: false,
};

export const THEMES: Theme[] = ['arctic', 'obsidian', 'ember'];

export const THEME_META: Record<Theme, { label: string; description: string }> = {
  arctic: { label: 'Arctic', description: 'Light, frosted' },
  obsidian: { label: 'Obsidian', description: 'Dark, chrome-extruded' },
  ember: { label: 'Ember', description: 'Warm, golden' },
};
