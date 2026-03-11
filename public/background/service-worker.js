// Pomodoro Timer - Background Service Worker

const POMODORO_ALARM = 'pomodoro-timer';
const AUTO_START_ALARM = 'pomodoro-auto-start';
const AUTO_START_DELAY_SEC = 3;

const DEFAULT_PRESET = {
  id: 'default',
  name: 'Default',
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
};

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
};

// --- Persistence ---

const STATE_KEYS = [
  'state', 'endTime', 'remainingMs', 'sessionStartedAt',
  'currentPhase', 'workSessionsCompleted', 'suggestedNext',
  'lastCompletedDurationMs', 'activePresetId', 'autoStartNext',
];

async function persistState() {
  const data = {};
  for (const key of STATE_KEYS) {
    data[key] = timerState[key];
  }
  await chrome.storage.local.set(data);
}

async function loadState() {
  const data = await chrome.storage.local.get(STATE_KEYS);
  // Detect old schema (has 'running' boolean instead of 'state' string)
  if (data.state === undefined) {
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
    return;
  }
  // Normal load from new schema
  for (const key of STATE_KEYS) {
    if (data[key] !== undefined) {
      timerState[key] = data[key];
    }
  }
}

// --- Initialization & Recovery ---

async function initialize() {
  await loadState();

  if (timerState.state === 'running') {
    if (timerState.endTime && timerState.endTime <= Date.now()) {
      // Timer completed while SW was dead
      await handleTimerComplete();
    } else if (timerState.endTime) {
      // Timer still running, recreate alarm
      const remainingMin = (timerState.endTime - Date.now()) / 60000;
      chrome.alarms.create(POMODORO_ALARM, { delayInMinutes: Math.max(0.01, remainingMin) });
    }
  }
  // PAUSED and TRANSITION states need no recovery action — they just wait for user input
}

initialize();

// --- Alarm Handlers ---

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === POMODORO_ALARM) {
    handleTimerComplete();
  } else if (alarm.name === AUTO_START_ALARM) {
    handleAutoStart();
  }
});

// --- Message Handler ---

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = messageHandlers[message.action];
  if (handler) {
    handler(message).then(sendResponse);
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

  timerState.state = 'running';
  timerState.currentPhase = phase;
  timerState.endTime = endTime;
  timerState.remainingMs = null;
  timerState.sessionStartedAt = Date.now();
  timerState.suggestedNext = null;
  timerState.lastCompletedDurationMs = null;

  await persistState();
  chrome.alarms.create(POMODORO_ALARM, { delayInMinutes: minutes });
  // Cancel any pending auto-start
  chrome.alarms.clear(AUTO_START_ALARM);
  return { success: true };
}

async function doPause() {
  const remaining = Math.max(0, timerState.endTime - Date.now());

  timerState.state = 'paused';
  timerState.endTime = null;
  timerState.remainingMs = remaining;

  await persistState();
  chrome.alarms.clear(POMODORO_ALARM);
  return { success: true };
}

async function doResume() {
  const remaining = timerState.remainingMs;
  const endTime = Date.now() + remaining;

  timerState.state = 'running';
  timerState.endTime = endTime;
  timerState.remainingMs = null;

  await persistState();
  chrome.alarms.create(POMODORO_ALARM, { delayInMinutes: remaining / 60000 });
  return { success: true };
}

async function doSkip() {
  const elapsedMs = calculateElapsedMs();
  const preset = await getActivePreset();
  const plannedMs = getMinutesForPhase(timerState.currentPhase, preset) * 60000;

  // Record the skipped session
  await recordSession(timerState.currentPhase, plannedMs, elapsedMs, 'skipped');

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
  chrome.alarms.clear(POMODORO_ALARM);

  // Notify
  await sendNotification(getSkipMessage());

  // Auto-start if enabled
  if (timerState.autoStartNext) {
    chrome.alarms.create(AUTO_START_ALARM, { delayInMinutes: AUTO_START_DELAY_SEC / 60 });
  }

  return { success: true };
}

async function doEndActivity() {
  const elapsedMs = calculateElapsedMs();

  // Only record if we were in a running/paused work session
  if (timerState.state === 'running' || timerState.state === 'paused') {
    const preset = await getActivePreset();
    const plannedMs = getMinutesForPhase(timerState.currentPhase, preset) * 60000;
    await recordSession(timerState.currentPhase, plannedMs, elapsedMs, 'ended');
  }

  timerState.state = 'idle';
  timerState.endTime = null;
  timerState.remainingMs = null;
  timerState.sessionStartedAt = null;
  timerState.currentPhase = 'work';
  timerState.workSessionsCompleted = 0;
  timerState.suggestedNext = null;
  timerState.lastCompletedDurationMs = null;

  await persistState();
  chrome.alarms.clear(POMODORO_ALARM);
  chrome.alarms.clear(AUTO_START_ALARM);
  return { success: true };
}

// --- Timer Completion ---

async function handleTimerComplete() {
  if (timerState.state !== 'running') return;

  const preset = await getActivePreset();
  const plannedMs = getMinutesForPhase(timerState.currentPhase, preset) * 60000;
  const actualMs = timerState.sessionStartedAt ? Date.now() - timerState.sessionStartedAt : plannedMs;

  // Record completed session
  await recordSession(timerState.currentPhase, plannedMs, actualMs, 'completed');

  // Update cycle
  if (timerState.currentPhase === 'work') {
    timerState.workSessionsCompleted++;
  } else if (timerState.currentPhase === 'longBreak') {
    timerState.workSessionsCompleted = 0;
  }

  const suggestion = computeSuggestion();

  timerState.state = 'transition';
  timerState.endTime = null;
  timerState.remainingMs = null;
  timerState.suggestedNext = suggestion;
  timerState.lastCompletedDurationMs = actualMs;

  await persistState();

  // Notify
  const { settings } = await chrome.storage.local.get('settings');
  const notificationsEnabled = settings?.notificationsEnabled ?? true;
  if (notificationsEnabled) {
    await sendNotification(getCompletionMessage());
  }

  // Auto-start if enabled
  const autoStart = settings?.autoStartNext ?? false;
  timerState.autoStartNext = autoStart;
  if (autoStart) {
    chrome.alarms.create(AUTO_START_ALARM, { delayInMinutes: AUTO_START_DELAY_SEC / 60 });
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
    return Date.now() - timerState.sessionStartedAt;
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

async function recordSession(mode, plannedDurationMs, actualDurationMs, completionType) {
  const record = {
    id: crypto.randomUUID(),
    mode,
    plannedDurationMs,
    actualDurationMs: Math.max(0, actualDurationMs),
    completionType,
    completedAt: Date.now(),
  };
  const { sessionHistory } = await chrome.storage.local.get('sessionHistory');
  const history = sessionHistory || [];
  history.push(record);
  await chrome.storage.local.set({ sessionHistory: history });
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

async function sendNotification(message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title: 'Pomodoro Timer',
    message,
  });
}
