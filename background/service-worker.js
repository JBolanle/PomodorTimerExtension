// Pomodoro Timer - Background Service Worker

const POMODORO_ALARM = 'pomodoro-timer';

const DEFAULTS = {
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
};

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === POMODORO_ALARM) {
    handleTimerComplete();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'startTimer':
      startTimer(message.minutes);
      sendResponse({ success: true });
      break;
    case 'stopTimer':
      stopTimer();
      sendResponse({ success: true });
      break;
    case 'getState':
      getState().then(sendResponse);
      return true; // async response
  }
});

async function startTimer(minutes) {
  const endTime = Date.now() + minutes * 60 * 1000;
  await chrome.storage.local.set({ endTime, running: true });
  chrome.alarms.create(POMODORO_ALARM, { delayInMinutes: minutes });
}

async function stopTimer() {
  await chrome.storage.local.set({ endTime: null, running: false });
  chrome.alarms.clear(POMODORO_ALARM);
}

async function getState() {
  const data = await chrome.storage.local.get(['endTime', 'running', 'completedSessions']);
  return {
    endTime: data.endTime || null,
    running: data.running || false,
    completedSessions: data.completedSessions || 0,
  };
}

async function handleTimerComplete() {
  const data = await chrome.storage.local.get(['completedSessions']);
  const sessions = (data.completedSessions || 0) + 1;
  await chrome.storage.local.set({ completedSessions: sessions, running: false, endTime: null });

  chrome.notifications.create({
    type: 'basic',
    iconUrl: '../icons/icon128.png',
    title: 'Pomodoro Timer',
    message: 'Session complete! Time for a break.',
  });
}
