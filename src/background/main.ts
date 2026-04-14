// Pomodoro Timer — TypeScript service worker entry.
//
// Wires chrome.* event listeners to the typed dispatchers in
// `messaging/router.ts`, `timer/completion.ts`, and friends; then kicks
// off `initialize()` to hydrate in-memory state from storage.
//
// See docs/planning/roadmap.md for the module map (Phase 3).

import {
  AUTO_START_ALARM,
  BADGE_ALARM,
  FOCUS_REBLOCK_ALARM_PREFIX,
  POMODORO_ALARM,
} from './constants';
import { showBadgeNotification, updateBadge } from './badge';
import { handleFocusReblock } from './focusMode/ruleManager';
import { initialize } from './initialize';
import { dispatchMessage } from './messaging/router';
import { registerPortConnections } from './messaging/portConnection';
import { getActivePreset, getMinutesForPhase } from './presets/store';
import { runtime, timerState } from './state';
import { handleAutoStart, handleTimerComplete } from './timer/completion';
import { doPause, doResume, doSkip, doStartTimer } from './timer/operations';
void runtime; // Read by badge + focus mode paths; keep the import live.

// --- Messaging ---

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== 'object' || !('action' in message)) {
    return false;
  }
  const wire = message as { action: string } & Record<string, unknown>;
  const promise = dispatchMessage(wire);
  if (!promise) return false;

  promise
    .then((response) => {
      if (response === undefined) return;
      sendResponse(response);
    })
    .catch((err: Error) => {
      console.error(`[Pomodoro] handler "${wire.action}" failed:`, err);
      sendResponse({ success: false, error: err.message });
    });
  return true; // async response
});

// --- Alarms ---

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === POMODORO_ALARM) {
    void handleTimerComplete();
  } else if (alarm.name === AUTO_START_ALARM) {
    void handleAutoStart();
  } else if (alarm.name === BADGE_ALARM) {
    updateBadge();
  } else if (alarm.name.startsWith(FOCUS_REBLOCK_ALARM_PREFIX)) {
    void handleFocusReblock(alarm.name.slice(FOCUS_REBLOCK_ALARM_PREFIX.length));
  }
});

// --- Storage sync: keep cached settings fresh ---

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.settings) {
    const next = changes.settings.newValue as
      | { showBadge?: boolean }
      | undefined;
    runtime.showBadge = next?.showBadge ?? true;
    updateBadge();
  }
});

// --- Keyboard shortcuts ---

chrome.commands.onCommand.addListener(async (command) => {
  switch (command) {
    case 'toggle-timer':
      await handleToggleTimer();
      break;
    case 'skip-phase':
      await handleSkipShortcut();
      break;
  }
});

async function handleToggleTimer(): Promise<void> {
  if (timerState.state === 'running') {
    await doPause();
    showBadgeNotification('⏸');
  } else if (timerState.state === 'paused') {
    await doResume();
    showBadgeNotification('▶');
  } else if (timerState.state === 'idle') {
    const preset = await getActivePreset();
    await doStartTimer('work', preset.workMinutes);
    showBadgeNotification('▶');
  } else if (timerState.state === 'transition') {
    const phase = timerState.suggestedNext ?? 'work';
    const preset = await getActivePreset();
    const minutes = getMinutesForPhase(phase, preset);
    await doStartTimer(phase, minutes);
    showBadgeNotification('▶');
  }
}

async function handleSkipShortcut(): Promise<void> {
  if (timerState.state === 'running' || timerState.state === 'paused') {
    await doSkip();
    showBadgeNotification('⏭');
  }
}

// --- Boot ---

registerPortConnections();
initialize().catch((err) => console.error('[Pomodoro] initialize() failed:', err));

console.log('[Pomodoro SW] TypeScript service worker loaded');
