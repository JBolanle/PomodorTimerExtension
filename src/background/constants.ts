// Service-worker-local constants. See `src/shared/constants` for values
// shared with the React side.

export const POMODORO_ALARM = 'pomodoro-timer';
export const AUTO_START_ALARM = 'pomodoro-auto-start';
export const BADGE_ALARM = 'pomodoro-badge';
export const FOCUS_REBLOCK_ALARM_PREFIX = 'focus-reblock-';

export const AUTO_START_DELAY_SEC = 3;
export const MAX_SESSIONS = 200;

export const FOCUS_RULE_ID_BASE = 10000;
export const FOCUS_RULE_ID_MAX = FOCUS_RULE_ID_BASE + 10000;
export const FOCUS_REBLOCK_FALLBACK_RULE_ID = FOCUS_RULE_ID_BASE + 9999;

export const BADGE_COLORS = {
  work: '#e74c3c',
  shortBreak: '#2ecc71',
  longBreak: '#3498db',
} as const;

export const BADGE_NOTIFICATION_MS = 500;
export const BADGE_PERIOD_MINUTES = 0.5;
