'use strict';

const QUOTES = [
  'The secret of getting ahead is getting started. — Mark Twain',
  'It does not matter how slowly you go as long as you do not stop. — Confucius',
  'Focus on being productive instead of busy. — Tim Ferriss',
  'You don\'t have to be great to start, but you have to start to be great. — Zig Ziglar',
  'The successful warrior is the average man, with laser-like focus. — Bruce Lee',
  'Concentration is the root of all the higher abilities in man. — Bruce Lee',
  'Where focus goes, energy flows. — Tony Robbins',
  'Your future is created by what you do today, not tomorrow. — Robert Kiyosaki',
  'The key is not to prioritize what\'s on your schedule, but to schedule your priorities. — Stephen Covey',
  'Deep work is the ability to focus without distraction on a cognitively demanding task. — Cal Newport',
];

let blockedDomain = null;
let redirectTimer = null;

// ─── Init ───────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  applyTheme();
  resolveBlockedDomain();
  showRandomQuote();
  startTimerPolling();
  attachClickHandlers();
});

// ─── Theme ──────────────────────────────────────────────────────────────────

function applyTheme() {
  chrome.storage.local.get('theme', (result) => {
    const theme = result.theme || 'obsidian';
    document.documentElement.setAttribute('data-theme', theme);
  });
}

// ─── Blocked Domain ─────────────────────────────────────────────────────────

function resolveBlockedDomain() {
  const params = new URLSearchParams(window.location.search);
  let domain = params.get('domain') || params.get('url');

  if (!domain && document.referrer) {
    try {
      domain = new URL(document.referrer).hostname;
    } catch (_) {
      domain = null;
    }
  }

  blockedDomain = domain || null;

  const el = document.getElementById('blocked-url');
  if (domain) {
    el.textContent = `${domain} is blocked during your focus session.`;
  } else {
    el.textContent = 'This site is blocked during your focus session.';
  }

  updateAllowButton();
}

// ─── Quote ───────────────────────────────────────────────────────────────────

function showRandomQuote() {
  const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  document.getElementById('quote').textContent = `"${quote}"`;
}

// ─── Timer ───────────────────────────────────────────────────────────────────

function startTimerPolling() {
  updateTimer();
  setInterval(updateTimer, 1000);
}

function handleCommunicationError() {
  const display = document.getElementById('timer-display');
  display.textContent = '--:--';

  let errorEl = document.getElementById('error-status');
  if (!errorEl) {
    errorEl = document.createElement('p');
    errorEl.id = 'error-status';
    errorEl.style.color = '#d97706';
    errorEl.style.fontSize = '0.85rem';
    errorEl.textContent = 'Unable to connect to extension';
    display.parentNode.insertBefore(errorEl, display.nextSibling);
  }
  errorEl.style.display = '';

  setTimeout(updateTimer, 2000);
}

function updateTimer() {
  chrome.runtime.sendMessage({ action: 'getState' }, (response) => {
    if (chrome.runtime.lastError || !response) {
      handleCommunicationError();
      return;
    }

    const display = document.getElementById('timer-display');
    const { state, currentPhase, endTime, remainingMs } = response;

    const errorEl = document.getElementById('error-status');
    if (errorEl) errorEl.remove();

    if (state === 'running' && currentPhase === 'work') {
      const remaining = endTime - Date.now();
      if (remaining > 0) {
        display.textContent = formatMs(remaining);
      } else {
        display.textContent = '00:00';
      }
      cancelRedirect();
    } else if (state === 'paused' && currentPhase === 'work') {
      const ms = typeof remainingMs === 'number' ? remainingMs : 0;
      display.textContent = formatMs(ms);
      cancelRedirect();
    } else {
      // idle or non-work phase — session ended
      display.textContent = 'Session ended';
      scheduleRedirect();
    }
  });
}

function formatMs(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function scheduleRedirect() {
  if (redirectTimer !== null) return;
  redirectTimer = setTimeout(() => {
    goBack();
  }, 2000);
}

function cancelRedirect() {
  if (redirectTimer !== null) {
    clearTimeout(redirectTimer);
    redirectTimer = null;
  }
}

// ─── Click Handlers ─────────────────────────────────────────────────────────

function attachClickHandlers() {
  document.getElementById('btn-back').addEventListener('click', goBack);
  document.getElementById('btn-allow').addEventListener('click', () => {
    if (blockedDomain) {
      allowOnce(blockedDomain);
    } else {
      goBack();
    }
  });
}

// ─── Navigation ─────────────────────────────────────────────────────────────

function goBack() {
  if (history.length > 1) {
    history.back();
  } else {
    window.close();
  }
}

// ─── Allow Once ─────────────────────────────────────────────────────────────

function updateAllowButton() {
  chrome.storage.local.get('focusModeSettings', (result) => {
    const settings = result.focusModeSettings || {};
    const minutes = settings.allowOnceMinutes || 5;
    const btn = document.getElementById('btn-allow');
    btn.textContent = `Allow for ${minutes} minute${minutes !== 1 ? 's' : ''}`;
  });
}

function allowOnce(domain) {
  chrome.storage.local.get('focusModeSettings', (result) => {
    const settings = result.focusModeSettings || {};
    const minutes = settings.allowOnceMinutes || 5;

    chrome.runtime.sendMessage({ action: 'allowOnce', domain, minutes }, (response) => {
      if (chrome.runtime.lastError) {
        // Service worker may not handle this yet; fall back to navigation
        navigateAfterAllow(domain);
        return;
      }

      if (response && response.success) {
        navigateAfterAllow(domain);
      }
    });
  });
}

function navigateAfterAllow(domain) {
  if (document.referrer) {
    window.location.href = document.referrer;
  } else {
    window.location.href = `https://${domain}`;
  }
}
