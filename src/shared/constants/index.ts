// Single source for default values and enumerations shared across
// the background SW and React contexts. Legacy `src/lib/constants.ts`
// re-exports from here.

import type {
  FocusModeSettings,
  Preset,
  Settings,
  Theme,
} from '@/shared/types';

export const DEFAULT_PRESET: Preset = {
  id: 'default',
  name: 'Default',
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
};

export const DEFAULT_SETTINGS: Settings = {
  mode: 'simple',
  notificationsEnabled: true,
  autoStartNext: false,
  showBadge: true,
  soundEnabled: true,
  soundVolume: 1.0,
  soundPerPhase: true,
  workCompleteSound: 'work',
  breakCompleteSound: 'short-break',
  showBreakTips: true,
};

export const DEFAULT_FOCUS_MODE_SETTINGS: FocusModeSettings = {
  enabled: true,
  categories: {
    social: true,
    video: true,
    news: false,
    shopping: false,
    gaming: false,
  },
  customDomains: [],
  allowOnceMinutes: 5,
};

export const THEMES: Theme[] = ['arctic', 'obsidian', 'ember'];

export const THEME_META: Record<Theme, { label: string; description: string }> = {
  arctic: { label: 'Arctic', description: 'Light, frosted' },
  obsidian: { label: 'Obsidian', description: 'Dark, chrome-extruded' },
  ember: { label: 'Ember', description: 'Warm, golden' },
};
