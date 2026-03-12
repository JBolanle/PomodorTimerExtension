// Pomodoro Timer - Background Service Worker

const POMODORO_ALARM = 'pomodoro-timer';
const AUTO_START_ALARM = 'pomodoro-auto-start';
const AUTO_START_DELAY_SEC = 3;
const MAX_SESSIONS = 200;
const BADGE_ALARM = 'pomodoro-badge';

const DEFAULT_PRESET = {
  id: 'default',
  name: 'Default',
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
};

// Cached badge setting (avoids reading storage on every 30s update)
let showBadge = true;

// In-memory state (restored from storage on wake)
let timerState = {
  state: 'idle',
  endTime: null,
  remainingMs: null,
  sessionStartedAt: null,
  currentPhase: 'work',
  workSessionsCompleted: 0,
  suggestedNext: null,
  lastCompletedDurationMs: null,
  activePresetId: 'default',
  autoStartNext: false,
  totalPausedMs: 0,
  pausedAt: null,
};

// --- Session Grouping ---

let currentSession = null;

function createNewSession(preset) {
  currentSession = {
    id: crypto.randomUUID(),
    startedAt: Date.now(),
    endedAt: null,
    status: 'active',
    phases: [],
    totalFocusMs: 0,
    totalBreakMs: 0,
    presetId: preset.id,
    presetName: preset.name,
  };
}

function addPhaseToCurrentSession(mode, plannedMs, actualMs, completionType, startedAt) {
  if (!currentSession) return;
  const phase = {
    id: crypto.randomUUID(),
    mode,
    plannedDurationMs: plannedMs,
    actualDurationMs: Math.max(0, actualMs),
    completionType,
    startedAt,
    completedAt: Date.now(),
  };
  currentSession.phases.push(phase);
  if (mode === 'work') {
    currentSession.totalFocusMs += phase.actualDurationMs;
  } else {
    currentSession.totalBreakMs += phase.actualDurationMs;
  }
}

async function closeCurrentSession(status) {
  if (!currentSession) return;
  currentSession.endedAt = Date.now();
  currentSession.status = status;
  try {
    const { sessions: stored } = await chrome.storage.local.get('sessions');
    const sessions = stored || [];
    sessions.push(currentSession);
    if (sessions.length > MAX_SESSIONS) {
      sessions.splice(0, sessions.length - MAX_SESSIONS);
    }
    await chrome.storage.local.set({ sessions });
  } catch (err) {
    console.error('[Pomodoro] Failed to save session:', err);
  }
  currentSession = null;
}

// --- Badge ---

const BADGE_COLORS = {
  work: '#e74c3c',
  shortBreak: '#2ecc71',
  longBreak: '#3498db',
};

function updateBadge() {
  try {
    if (!showBadge) {
      chrome.action.setBadgeText({ text: '' });
      return;
    }

    let remainingMs = 0;

    if (timerState.state === 'running' && timerState.endTime) {
      remainingMs = Math.max(0, timerState.endTime - Date.now());
    } else if (timerState.state === 'paused' && timerState.remainingMs) {
      remainingMs = timerState.remainingMs;
    } else {
      chrome.action.setBadgeText({ text: '' });
      return;
    }

    const minutes = Math.ceil(remainingMs / 60000);
    const text = minutes < 1 ? '<1' : String(minutes);

    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({
      color: BADGE_COLORS[timerState.currentPhase] || BADGE_COLORS.work,
    });
  } catch (err) {
    console.error('[Pomodoro] Badge update failed:', err);
  }
}

function startBadgeAlarm() {
  chrome.alarms.clear(BADGE_ALARM).catch(() => {});
  updateBadge();
  chrome.alarms.create(BADGE_ALARM, { periodInMinutes: 0.5 }).catch(() => {});
}

function clearBadgeAlarm() {
  chrome.alarms.clear(BADGE_ALARM).catch(() => {});
}

// --- Persistence ---

const STATE_KEYS = [
  'state', 'endTime', 'remainingMs', 'sessionStartedAt',
  'currentPhase', 'workSessionsCompleted', 'suggestedNext',
  'lastCompletedDurationMs', 'activePresetId', 'autoStartNext',
  'totalPausedMs', 'pausedAt',
];

async function persistState() {
  const data = {};
  for (const key of STATE_KEYS) {
    data[key] = timerState[key];
  }
  data.currentSession = currentSession;
  try {
    await chrome.storage.local.set(data);
  } catch (err) {
    console.error('[Pomodoro] Failed to persist state:', err);
  }
}

async function loadState() {
  const data = await chrome.storage.local.get([...STATE_KEYS, 'currentSession']);
  // Detect old schema (has 'running' boolean instead of 'state' string)
  if (data.state === undefined) {
    try {
      const oldData = await chrome.storage.local.get(['running', 'paused', 'completedSessions', 'endTime', 'remainingMs', 'sessionTotalMs']);
      timerState = {
        state: 'idle',
        endTime: oldData.endTime || null,
        remainingMs: oldData.remainingMs || null,
        sessionStartedAt: null,
        currentPhase: 'work',
        workSessionsCompleted: oldData.completedSessions || 0,
        suggestedNext: null,
        lastCompletedDurationMs: null,
        activePresetId: 'default',
        autoStartNext: false,
      };
      // Migrate state from old booleans
      if (oldData.running && timerState.endTime) {
        timerState.state = 'running';
      } else if (oldData.paused && timerState.remainingMs) {
        timerState.state = 'paused';
      }
      // Clean up old keys
      await chrome.storage.local.remove(['running', 'paused', 'completedSessions', 'sessionTotalMs']);
      await persistState();
      // Migrate presets
      const { presets } = await chrome.storage.local.get('presets');
      if (!presets) {
        // Migrate old settings to a preset
        const { settings: oldSettings } = await chrome.storage.local.get('settings');
        if (oldSettings && (oldSettings.workMinutes || oldSettings.shortBreakMinutes || oldSettings.longBreakMinutes)) {
          const migratedPreset = {
            ...DEFAULT_PRESET,
            workMinutes: oldSettings.workMinutes ?? DEFAULT_PRESET.workMinutes,
            shortBreakMinutes: oldSettings.shortBreakMinutes ?? DEFAULT_PRESET.shortBreakMinutes,
            longBreakMinutes: oldSettings.longBreakMinutes ?? DEFAULT_PRESET.longBreakMinutes,
            sessionsBeforeLongBreak: oldSettings.sessionsBeforeLongBreak ?? DEFAULT_PRESET.sessionsBeforeLongBreak,
          };
          await chrome.storage.local.set({ presets: [migratedPreset] });
          // Migrate settings to new shape (only notificationsEnabled + autoStartNext)
          await chrome.storage.local.set({
            settings: {
              notificationsEnabled: oldSettings.notificationsEnabled ?? true,
              autoStartNext: false,
            },
          });
        } else {
          await chrome.storage.local.set({ presets: [DEFAULT_PRESET] });
        }
      }
      // Migrate old session history records
      const { sessionHistory } = await chrome.storage.local.get('sessionHistory');
      if (sessionHistory && sessionHistory.length > 0 && sessionHistory[0].duration !== undefined) {
        const migrated = sessionHistory.map((r) => ({
          id: r.id,
          mode: r.mode,
          plannedDurationMs: r.duration * 60000,
          actualDurationMs: r.duration * 60000,
          completionType: 'completed',
          completedAt: r.completedAt,
        }));
        await chrome.storage.local.set({ sessionHistory: migrated });
      }
    } catch (err) {
      console.error('[Pomodoro] Migration from old schema failed:', err);
    }
    return;
  }
  // Normal load from new schema
  for (const key of STATE_KEYS) {
    if (data[key] !== undefined) {
      timerState[key] = data[key];
    }
  }
  if (data.currentSession) {
    currentSession = data.currentSession;
  }
}

// --- Initialization & Recovery ---

async function initialize() {
  try {
    await loadState();
  } catch (err) {
    console.error('[Pomodoro] Failed to load state, using defaults:', err);
  }

  // One-time migration: clear old sessionHistory key
  try {
    const { sessionHistory } = await chrome.storage.local.get('sessionHistory');
    if (sessionHistory) {
      await chrome.storage.local.remove('sessionHistory');
    }
  } catch (err) {
    console.error('[Pomodoro] Failed to clear old sessionHistory:', err);
  }

  // Load badge setting
  try {
    const { settings } = await chrome.storage.local.get('settings');
    showBadge = settings?.showBadge ?? true;
  } catch (err) {
    console.error('[Pomodoro] Failed to load badge setting:', err);
  }

  if (timerState.state === 'running') {
    if (timerState.endTime && timerState.endTime <= Date.now()) {
      // Timer completed while SW was dead
      await handleTimerComplete().catch((err) => console.error('[Pomodoro] Recovery handleTimerComplete failed:', err));
    } else if (timerState.endTime) {
      // Timer still running, recreate alarm
      const remainingMin = (timerState.endTime - Date.now()) / 60000;
      await chrome.alarms.create(POMODORO_ALARM, { delayInMinutes: Math.max(0.01, remainingMin) })
        .catch((err) => console.error('[Pomodoro] Recovery alarm creation failed:', err));
    }
  }
  // PAUSED and TRANSITION states need no recovery action — they just wait for user input

  // Restore badge
  if (timerState.state === 'running') {
    startBadgeAlarm();
  } else if (timerState.state === 'paused') {
    updateBadge();
  }
}

initialize().catch((err) => console.error('[Pomodoro] initialize() failed:', err));

// Update cached settings when they change
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.settings) {
    const newSettings = changes.settings.newValue;
    showBadge = newSettings?.showBadge ?? true;
    updateBadge();
  }
});

// --- Keyboard Shortcut Commands ---

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

async function handleToggleTimer() {
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
    const phase = timerState.suggestedNext || 'work';
    const preset = await getActivePreset();
    const minutes = getMinutesForPhase(phase, preset);
    await doStartTimer(phase, minutes);
    showBadgeNotification('▶');
  }
}

async function handleSkipShortcut() {
  if (timerState.state === 'running' || timerState.state === 'paused') {
    await doSkip();
    showBadgeNotification('⏭');
  }
}

function showBadgeNotification(emoji) {
  chrome.action.setBadgeText({ text: emoji });
  chrome.action.setBadgeBackgroundColor({ color: '#333' });
  setTimeout(() => {
    updateBadge();
  }, 500);
}

// --- Alarm Handlers ---

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === POMODORO_ALARM) {
    handleTimerComplete();
  } else if (alarm.name === AUTO_START_ALARM) {
    handleAutoStart();
  } else if (alarm.name === BADGE_ALARM) {
    updateBadge();
  }
});

// --- Message Handler ---

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = messageHandlers[message.action];
  if (handler) {
    handler(message)
      .then(sendResponse)
      .catch((err) => {
        console.error(`[Pomodoro] handler "${message.action}" failed:`, err);
        sendResponse({ success: false, error: err.message });
      });
    return true; // async response
  }
});

const messageHandlers = {
  startTimer: async (msg) => {
    if (timerState.state !== 'idle') return { success: false };
    const { phase, minutes } = msg;
    return await doStartTimer(phase, minutes);
  },
  pauseTimer: async () => {
    if (timerState.state !== 'running') return { success: false };
    return await doPause();
  },
  resumeTimer: async () => {
    if (timerState.state !== 'paused') return { success: false };
    return await doResume();
  },
  skipPhase: async () => {
    if (timerState.state !== 'running' && timerState.state !== 'paused') return { success: false };
    return await doSkip();
  },
  endActivity: async () => {
    if (timerState.state === 'idle') return { success: false };
    return await doEndActivity();
  },
  startNext: async (msg) => {
    if (timerState.state !== 'transition') return { success: false };
    const phase = msg.phase || timerState.suggestedNext || 'work';
    const preset = await getActivePreset();
    const minutes = msg.minutes || getMinutesForPhase(phase, preset);
    return await doStartTimer(phase, minutes);
  },
  getState: async () => {
    return { ...timerState };
  },
  // Preset CRUD
  getPresets: async () => {
    const { presets } = await chrome.storage.local.get('presets');
    return { presets: presets || [DEFAULT_PRESET], activePresetId: timerState.activePresetId };
  },
  savePreset: async (msg) => {
    const { presets } = await chrome.storage.local.get('presets');
    const list = presets || [DEFAULT_PRESET];
    const idx = list.findIndex((p) => p.id === msg.preset.id);
    if (idx >= 0) {
      list[idx] = msg.preset;
    } else {
      list.push(msg.preset);
    }
    await chrome.storage.local.set({ presets: list });
    return { success: true };
  },
  deletePreset: async (msg) => {
    if (msg.presetId === 'default') return { success: false };
    const { presets } = await chrome.storage.local.get('presets');
    const list = (presets || []).filter((p) => p.id !== msg.presetId);
    await chrome.storage.local.set({ presets: list });
    // If deleted the active preset, switch to default
    if (timerState.activePresetId === msg.presetId) {
      timerState.activePresetId = 'default';
      await persistState();
    }
    return { success: true };
  },
  setActivePreset: async (msg) => {
    timerState.activePresetId = msg.presetId;
    await persistState();
    return { success: true };
  },
};

// --- Timer Operations ---

async function doStartTimer(phase, minutes) {
  const sessionTotalMs = minutes * 60000;
  const endTime = Date.now() + sessionTotalMs;

  // Create a new grouped session if none exists
  if (currentSession === null) {
    const preset = await getActivePreset();
    createNewSession(preset);
  }

  timerState.state = 'running';
  timerState.currentPhase = phase;
  timerState.endTime = endTime;
  timerState.remainingMs = null;
  timerState.sessionStartedAt = Date.now();
  timerState.suggestedNext = null;
  timerState.lastCompletedDurationMs = null;
  timerState.totalPausedMs = 0;
  timerState.pausedAt = null;

  await persistState();
  try {
    await chrome.alarms.create(POMODORO_ALARM, { delayInMinutes: minutes });
  } catch (err) {
    console.error('[Pomodoro] Failed to create timer alarm:', err);
    timerState.state = 'idle';
    timerState.endTime = null;
    timerState.sessionStartedAt = null;
    await persistState().catch(() => {});
    return { success: false, error: 'Failed to create alarm' };
  }
  // Cancel any pending auto-start
  chrome.alarms.clear(AUTO_START_ALARM).catch(() => {});
  startBadgeAlarm();
  return { success: true };
}

async function doPause() {
  const remaining = Math.max(0, timerState.endTime - Date.now());

  timerState.state = 'paused';
  timerState.endTime = null;
  timerState.remainingMs = remaining;
  timerState.pausedAt = Date.now();

  await persistState();
  chrome.alarms.clear(POMODORO_ALARM).catch(() => {});
  clearBadgeAlarm();
  updateBadge();
  return { success: true };
}

async function doResume() {
  const remaining = timerState.remainingMs;
  const endTime = Date.now() + remaining;

  timerState.state = 'running';
  timerState.endTime = endTime;
  timerState.remainingMs = null;
  if (timerState.pausedAt) {
    timerState.totalPausedMs += Date.now() - timerState.pausedAt;
  }
  timerState.pausedAt = null;

  await persistState();
  try {
    await chrome.alarms.create(POMODORO_ALARM, { delayInMinutes: remaining / 60000 });
  } catch (err) {
    console.error('[Pomodoro] Failed to create alarm on resume:', err);
    timerState.state = 'paused';
    timerState.endTime = null;
    timerState.remainingMs = remaining;
    await persistState().catch(() => {});
    return { success: false, error: 'Failed to create alarm' };
  }
  startBadgeAlarm();
  return { success: true };
}

async function doSkip() {
  const elapsedMs = calculateElapsedMs();
  const preset = await getActivePreset();
  const plannedMs = getMinutesForPhase(timerState.currentPhase, preset) * 60000;

  // Record the skipped phase
  addPhaseToCurrentSession(timerState.currentPhase, plannedMs, elapsedMs, 'skipped', timerState.sessionStartedAt || Date.now());

  // If skipping work, it counts
  if (timerState.currentPhase === 'work') {
    timerState.workSessionsCompleted++;
  }

  // Compute suggestion and enter transition
  const suggestion = computeSuggestion();
  timerState.state = 'transition';
  timerState.endTime = null;
  timerState.remainingMs = null;
  timerState.suggestedNext = suggestion;
  timerState.lastCompletedDurationMs = elapsedMs;

  await persistState();
  chrome.alarms.clear(POMODORO_ALARM).catch(() => {});
  clearBadgeAlarm();
  updateBadge();

  // Notify
  await sendNotification(getSkipMessage());
  await playNotificationSound(timerState.currentPhase);

  // Auto-start if enabled
  if (timerState.autoStartNext) {
    chrome.alarms.create(AUTO_START_ALARM, { delayInMinutes: AUTO_START_DELAY_SEC / 60 }).catch(() => {});
  }

  return { success: true };
}

async function doEndActivity() {
  const elapsedMs = calculateElapsedMs();

  // Record the in-progress phase if running/paused
  if (timerState.state === 'running' || timerState.state === 'paused') {
    const preset = await getActivePreset();
    const plannedMs = getMinutesForPhase(timerState.currentPhase, preset) * 60000;
    addPhaseToCurrentSession(timerState.currentPhase, plannedMs, elapsedMs, 'ended', timerState.sessionStartedAt || Date.now());
  }

  // Close the grouped session
  await closeCurrentSession('ended');

  timerState.state = 'idle';
  timerState.endTime = null;
  timerState.remainingMs = null;
  timerState.sessionStartedAt = null;
  timerState.currentPhase = 'work';
  timerState.workSessionsCompleted = 0;
  timerState.suggestedNext = null;
  timerState.lastCompletedDurationMs = null;
  timerState.totalPausedMs = 0;
  timerState.pausedAt = null;

  await persistState();
  chrome.alarms.clear(POMODORO_ALARM).catch(() => {});
  chrome.alarms.clear(AUTO_START_ALARM).catch(() => {});
  clearBadgeAlarm();
  updateBadge();
  return { success: true };
}

// --- Timer Completion ---

async function handleTimerComplete() {
  if (timerState.state !== 'running') return;

  const preset = await getActivePreset();
  const plannedMs = getMinutesForPhase(timerState.currentPhase, preset) * 60000;
  let actualMs = timerState.sessionStartedAt
    ? (Date.now() - timerState.sessionStartedAt) - (timerState.totalPausedMs || 0)
    : plannedMs;
  actualMs = Math.min(actualMs, plannedMs); // Cap for SW wake latency

  // Record completed phase
  addPhaseToCurrentSession(timerState.currentPhase, plannedMs, actualMs, 'completed', timerState.sessionStartedAt || Date.now());

  // Update cycle
  if (timerState.currentPhase === 'work') {
    timerState.workSessionsCompleted++;
  } else if (timerState.currentPhase === 'longBreak') {
    timerState.workSessionsCompleted = 0;
    // Long break completion = natural end of a Pomodoro cycle
    await closeCurrentSession('completed');
  }

  const suggestion = computeSuggestion();

  timerState.state = 'transition';
  timerState.endTime = null;
  timerState.remainingMs = null;
  timerState.suggestedNext = suggestion;
  timerState.lastCompletedDurationMs = actualMs;

  await persistState();
  clearBadgeAlarm();
  updateBadge();

  // Notify
  const { settings } = await chrome.storage.local.get('settings');
  const notificationsEnabled = settings?.notificationsEnabled ?? true;
  if (notificationsEnabled) {
    await sendNotification(getCompletionMessage());
  }
  await playNotificationSound(timerState.currentPhase);

  // Auto-start if enabled
  const autoStart = settings?.autoStartNext ?? false;
  timerState.autoStartNext = autoStart;
  if (autoStart) {
    chrome.alarms.create(AUTO_START_ALARM, { delayInMinutes: AUTO_START_DELAY_SEC / 60 }).catch(() => {});
  }
}

async function handleAutoStart() {
  if (timerState.state !== 'transition' || !timerState.suggestedNext) return;

  const phase = timerState.suggestedNext;
  const preset = await getActivePreset();
  const minutes = getMinutesForPhase(phase, preset);
  await doStartTimer(phase, minutes);
}

// --- Cycle Logic ---

function computeSuggestion() {
  const preset = getActivePresetSync();
  const sessionsBeforeLong = preset?.sessionsBeforeLongBreak ?? 4;

  if (timerState.currentPhase === 'work') {
    return timerState.workSessionsCompleted >= sessionsBeforeLong ? 'longBreak' : 'shortBreak';
  }
  return 'work';
}

// --- Helpers ---

function calculateElapsedMs() {
  if (timerState.state === 'running' && timerState.sessionStartedAt) {
    return (Date.now() - timerState.sessionStartedAt) - (timerState.totalPausedMs || 0);
  }
  if (timerState.state === 'paused' && timerState.sessionStartedAt && timerState.remainingMs != null) {
    // Total time minus remaining = elapsed
    const totalMs = timerState.endTime
      ? timerState.endTime - timerState.sessionStartedAt
      : 0;
    // When paused, endTime is null, so use the original session duration
    const preset = getActivePresetSync();
    const plannedMs = getMinutesForPhase(timerState.currentPhase, preset) * 60000;
    return Math.max(0, plannedMs - timerState.remainingMs);
  }
  return 0;
}

function getMinutesForPhase(phase, preset) {
  switch (phase) {
    case 'work': return preset.workMinutes;
    case 'shortBreak': return preset.shortBreakMinutes;
    case 'longBreak': return preset.longBreakMinutes;
    default: return 25;
  }
}

let cachedPresets = null;
let cachedActivePresetId = null;

async function getActivePreset() {
  const { presets } = await chrome.storage.local.get('presets');
  const list = presets || [DEFAULT_PRESET];
  cachedPresets = list;
  cachedActivePresetId = timerState.activePresetId;
  return list.find((p) => p.id === timerState.activePresetId) || list[0] || DEFAULT_PRESET;
}

function getActivePresetSync() {
  if (cachedPresets && cachedActivePresetId === timerState.activePresetId) {
    return cachedPresets.find((p) => p.id === timerState.activePresetId) || cachedPresets[0] || DEFAULT_PRESET;
  }
  return DEFAULT_PRESET;
}


function getCompletionMessage() {
  switch (timerState.currentPhase) {
    case 'work': return 'Work session complete! Time for a break.';
    case 'shortBreak': return 'Break over! Ready to focus?';
    case 'longBreak': return 'Long break over! Starting a new cycle.';
    default: return 'Session complete!';
  }
}

function getSkipMessage() {
  switch (timerState.currentPhase) {
    case 'work': return 'Work session skipped. Take a break!';
    case 'shortBreak': return 'Break skipped. Back to work!';
    case 'longBreak': return 'Long break skipped. Back to work!';
    default: return 'Session skipped.';
  }
}

// --- Sound Playback ---

let creatingOffscreen = null;

async function ensureOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL('offscreen/offscreen.html');
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl],
  });
  if (existingContexts.length > 0) return;

  if (creatingOffscreen) {
    await creatingOffscreen;
    return;
  }

  creatingOffscreen = chrome.offscreen.createDocument({
    url: offscreenUrl,
    reasons: ['AUDIO_PLAYBACK'],
    justification: 'Play notification sound when timer completes',
  });

  await creatingOffscreen;
  creatingOffscreen = null;
}

const SOUNDS = {
  default: 'sounds/notification.mp3',
  work: 'sounds/work-complete.mp3',
  'short-break': 'sounds/short-break-complete.mp3',
  'long-break': 'sounds/long-break-complete.mp3',
};

function getSoundForPhase(phase, settings) {
  if (!settings?.soundPerPhase) return SOUNDS.default;
  if (phase === 'work') {
    return SOUNDS[settings.workCompleteSound] || SOUNDS.work;
  }
  // Both shortBreak and longBreak use breakCompleteSound
  return SOUNDS[settings.breakCompleteSound] || SOUNDS['short-break'];
}

async function playNotificationSound(phase) {
  try {
    const { settings } = await chrome.storage.local.get('settings');
    const soundEnabled = settings?.soundEnabled ?? true;
    if (!soundEnabled) return;

    const volume = settings?.soundVolume ?? 1.0;
    const soundPath = getSoundForPhase(phase, settings);

    if (!chrome.offscreen) {
      // Firefox fallback — no offscreen API
      return;
    }

    await ensureOffscreenDocument();
    await chrome.runtime.sendMessage({
      action: 'playSound',
      sound: soundPath,
      volume,
    });
  } catch (err) {
    console.error('[Pomodoro] Sound playback failed:', err);
  }
}

async function sendNotification(message) {
  try {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: 'Pomodoro Timer',
      message,
    });
  } catch (err) {
    console.error('[Pomodoro] Notification failed (permission denied?):', err);
  }
}
