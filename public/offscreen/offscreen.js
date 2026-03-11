chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'playSound') {
    const audio = document.getElementById('audio');
    audio.src = chrome.runtime.getURL(message.sound);
    audio.volume = message.volume ?? 1.0;
    audio.play().catch((err) => {
      console.error('[Pomodoro] Offscreen audio playback failed:', err);
    });
  }
});
