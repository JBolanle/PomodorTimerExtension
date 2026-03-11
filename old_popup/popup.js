// Pomodoro Timer - Popup Script

const WORK_MINUTES = 25;

const timerDisplay = document.getElementById('timer-display');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const sessionCount = document.getElementById('session-count');

let updateInterval = null;

startBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'startTimer', minutes: WORK_MINUTES }, () => {
    setRunningUI(true);
    startDisplayUpdate();
  });
});

stopBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'stopTimer' }, () => {
    setRunningUI(false);
    stopDisplayUpdate();
    timerDisplay.textContent = formatTime(WORK_MINUTES * 60);
  });
});

function setRunningUI(running) {
  startBtn.disabled = running;
  stopBtn.disabled = !running;
}

function startDisplayUpdate() {
  stopDisplayUpdate();
  updateDisplay();
  updateInterval = setInterval(updateDisplay, 500);
}

function stopDisplayUpdate() {
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
}

function updateDisplay() {
  chrome.runtime.sendMessage({ action: 'getState' }, (state) => {
    if (!state) return;

    sessionCount.textContent = state.completedSessions;

    if (state.running && state.endTime) {
      const remaining = Math.max(0, Math.ceil((state.endTime - Date.now()) / 1000));
      timerDisplay.textContent = formatTime(remaining);

      if (remaining <= 0) {
        setRunningUI(false);
        stopDisplayUpdate();
        timerDisplay.textContent = formatTime(0);
      }
    } else {
      setRunningUI(false);
      stopDisplayUpdate();
      timerDisplay.textContent = formatTime(WORK_MINUTES * 60);
    }
  });
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Initialize on popup open
updateDisplay();
